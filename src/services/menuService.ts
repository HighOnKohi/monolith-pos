import { supabase } from '@/lib/supabase'
import { DEFAULT_FOOD_PLACEHOLDER, type MenuItem, type Category } from '@/types/menu'
import { isMorningMenuTime } from '@/services/configurationService'
import { broadcastMenuItemStatus } from '@/hooks/useRealtimeMenu'

export interface ScheduledPresetItems {
  wholeDayItemIds?: string[]
  morningItemIds?: string[]
  afternoonItemIds?: string[]
}

export interface MenuPreset {
  PRESET_ID: number
  PRESET_NAME: string
  IS_DEFAULT?: boolean
  WHOLE_DAY_ITEM_IDS: string[]
  MORNING_ITEM_IDS: string[]
  AFTERNOON_ITEM_IDS: string[]
  ITEM_IDS: string[]
}

/**
 * Resolves active item IDs for a preset based on the current time and morning cutoff.
 * If morning: returns Whole Day items + Morning items.
 * If afternoon: returns Whole Day items + Afternoon items.
 */
export function resolveActivePresetItems(
  preset: {
    WHOLE_DAY_ITEM_IDS?: string[]
    MORNING_ITEM_IDS?: string[]
    AFTERNOON_ITEM_IDS?: string[]
  },
  cutoffTime?: string,
): string[] {
  const wholeDay = (preset.WHOLE_DAY_ITEM_IDS ?? []).map(String)
  const morning = (preset.MORNING_ITEM_IDS ?? []).map(String)
  const afternoon = (preset.AFTERNOON_ITEM_IDS ?? []).map(String)

  const isMorning = isMorningMenuTime(cutoffTime)
  const scheduled = isMorning ? morning : afternoon

  const combined = new Set([...wholeDay, ...scheduled])
  return Array.from(combined)
}

/**
 * Returns all item IDs across all schedules in a preset.
 */
export function getAllPresetItemIds(preset: {
  WHOLE_DAY_ITEM_IDS?: string[]
  MORNING_ITEM_IDS?: string[]
  AFTERNOON_ITEM_IDS?: string[]
}): string[] {
  const combined = new Set([
    ...(preset.WHOLE_DAY_ITEM_IDS ?? []).map(String),
    ...(preset.MORNING_ITEM_IDS ?? []).map(String),
    ...(preset.AFTERNOON_ITEM_IDS ?? []).map(String),
  ])
  return Array.from(combined)
}

export function sortMenuPresets(presets: MenuPreset[]): MenuPreset[] {
  return [...presets].sort((a, b) => {
    const aGlobal = a.PRESET_NAME.trim().toLowerCase() === 'global'
    const bGlobal = b.PRESET_NAME.trim().toLowerCase() === 'global'
    if (aGlobal && !bGlobal) return -1
    if (!aGlobal && bGlobal) return 1

    const aDefault = Boolean(a.IS_DEFAULT)
    const bDefault = Boolean(b.IS_DEFAULT)
    if (aDefault && !bDefault) return -1
    if (!aDefault && bDefault) return 1

    return a.PRESET_ID - b.PRESET_ID
  })
}

export async function fetchMenuPresets(): Promise<MenuPreset[]> {
  try {
    const { data, error } = await supabase
      .schema('menu')
      .from('Menu_Presets')
      .select('PRESET_ID, PRESET_NAME, IS_DEFAULT, WHOLE_DAY_ITEM_IDS, MORNING_ITEM_IDS, AFTERNOON_ITEM_IDS')
      .order('PRESET_ID')

    if (!error && data) {
      let presets: MenuPreset[] = data.map((row) => {
        const wholeDay = Array.isArray(row.WHOLE_DAY_ITEM_IDS)
          ? row.WHOLE_DAY_ITEM_IDS.map((id: unknown) => String(id))
          : []
        const morning = Array.isArray(row.MORNING_ITEM_IDS)
          ? row.MORNING_ITEM_IDS.map((id: unknown) => String(id))
          : []
        const afternoon = Array.isArray(row.AFTERNOON_ITEM_IDS)
          ? row.AFTERNOON_ITEM_IDS.map((id: unknown) => String(id))
          : []

        const activeIds = resolveActivePresetItems({
          WHOLE_DAY_ITEM_IDS: wholeDay,
          MORNING_ITEM_IDS: morning,
          AFTERNOON_ITEM_IDS: afternoon,
        })

        return {
          PRESET_ID: Number(row.PRESET_ID),
          PRESET_NAME: String(row.PRESET_NAME),
          IS_DEFAULT: Boolean(row.IS_DEFAULT),
          WHOLE_DAY_ITEM_IDS: wholeDay,
          MORNING_ITEM_IDS: morning,
          AFTERNOON_ITEM_IDS: afternoon,
          ITEM_IDS: activeIds,
        }
      })

      // Ensure Global preset exists
      const hasGlobal = presets.some((p) => p.PRESET_NAME.trim().toLowerCase() === 'global')
      if (!hasGlobal) {
        try {
          const globalPreset = await createMenuPreset('Global', { wholeDayItemIds: [] })
          presets.push(globalPreset)
        } catch {
          // Non-fatal if creation fails
        }
      }

      // Sort: 1st Global, 2nd Default, followed by other presets
      return sortMenuPresets(presets)
    }
  } catch {
    // Fallback if schema is being adjusted
  }

  const { data: fallbackData, error: fallbackError } = await supabase
    .schema('menu')
    .from('Menu_Presets')
    .select('PRESET_ID, PRESET_NAME, IS_DEFAULT')
    .order('PRESET_ID')

  if (fallbackError) throw fallbackError

  return (fallbackData ?? []).map((row) => ({
    PRESET_ID: Number(row.PRESET_ID),
    PRESET_NAME: String(row.PRESET_NAME),
    IS_DEFAULT: Boolean(row.IS_DEFAULT),
    WHOLE_DAY_ITEM_IDS: [],
    MORNING_ITEM_IDS: [],
    AFTERNOON_ITEM_IDS: [],
    ITEM_IDS: [],
  }))
}

export async function setDefaultMenuPreset(presetId: number): Promise<void> {
  // 1. Reset other presets to IS_DEFAULT = false
  try {
    await supabase
      .schema('menu')
      .from('Menu_Presets')
      .update({ IS_DEFAULT: false })
      .neq('PRESET_ID', presetId)
  } catch (err) {
    console.warn('[menuService] Notice when resetting IS_DEFAULT on Menu_Presets:', err)
  }

  // 2. Set target preset to IS_DEFAULT = true
  const { error } = await supabase
    .schema('menu')
    .from('Menu_Presets')
    .update({ IS_DEFAULT: true })
    .eq('PRESET_ID', presetId)

  if (error) {
    console.error('[menuService] Error setting default menu preset:', error)
    throw error
  }

  if (typeof window !== 'undefined') {
    localStorage.setItem('menu-active-preset-id', String(presetId))
    const detail = { type: 'menu_preset_changed', presetId }
    window.dispatchEvent(new CustomEvent('menu-preset-changed', { detail: presetId }))
    window.dispatchEvent(new CustomEvent('monolith-order-update', { detail }))

    // Broadcast across browser tabs
    try {
      const bc = new BroadcastChannel('monolith_order_events')
      bc.postMessage(detail)
      bc.close()
    } catch {
      // Ignore
    }

    // Broadcast across devices via Supabase channel
    try {
      const channel = supabase.channel('shared-menu-sync-realtime')
      void channel.send({
        type: 'broadcast',
        event: 'menu_preset_changed',
        payload: { presetId },
      })
    } catch {
      // Ignore
    }
  }
}

export async function createMenuPreset(
  name: string,
  initialItems: ScheduledPresetItems | string[] = {},
): Promise<MenuPreset> {
  const wholeDayNumbers = (Array.isArray(initialItems) ? initialItems : (initialItems.wholeDayItemIds ?? []))
    .map(Number)
    .filter((n) => !isNaN(n))
  const morningNumbers = (Array.isArray(initialItems) ? [] : (initialItems.morningItemIds ?? []))
    .map(Number)
    .filter((n) => !isNaN(n))
  const afternoonNumbers = (Array.isArray(initialItems) ? [] : (initialItems.afternoonItemIds ?? []))
    .map(Number)
    .filter((n) => !isNaN(n))

  const { data, error } = await supabase
    .schema('menu')
    .from('Menu_Presets')
    .insert({
      PRESET_NAME: name,
      IS_DEFAULT: false,
      WHOLE_DAY_ITEM_IDS: wholeDayNumbers,
      MORNING_ITEM_IDS: morningNumbers,
      AFTERNOON_ITEM_IDS: afternoonNumbers,
    })
    .select('PRESET_ID, PRESET_NAME, IS_DEFAULT, WHOLE_DAY_ITEM_IDS, MORNING_ITEM_IDS, AFTERNOON_ITEM_IDS')
    .single()

  if (error) throw error

  const wholeDay = Array.isArray(data.WHOLE_DAY_ITEM_IDS) ? data.WHOLE_DAY_ITEM_IDS.map(String) : []
  const morning = Array.isArray(data.MORNING_ITEM_IDS) ? data.MORNING_ITEM_IDS.map(String) : []
  const afternoon = Array.isArray(data.AFTERNOON_ITEM_IDS) ? data.AFTERNOON_ITEM_IDS.map(String) : []

  return {
    PRESET_ID: Number(data.PRESET_ID),
    PRESET_NAME: String(data.PRESET_NAME),
    IS_DEFAULT: Boolean(data.IS_DEFAULT),
    WHOLE_DAY_ITEM_IDS: wholeDay,
    MORNING_ITEM_IDS: morning,
    AFTERNOON_ITEM_IDS: afternoon,
    ITEM_IDS: resolveActivePresetItems({
      WHOLE_DAY_ITEM_IDS: wholeDay,
      MORNING_ITEM_IDS: morning,
      AFTERNOON_ITEM_IDS: afternoon,
    }),
  }
}

export async function fetchPresetItemIds(presetId: number): Promise<ScheduledPresetItems> {
  try {
    const { data, error } = await supabase
      .schema('menu')
      .from('Menu_Presets')
      .select('WHOLE_DAY_ITEM_IDS, MORNING_ITEM_IDS, AFTERNOON_ITEM_IDS')
      .eq('PRESET_ID', presetId)
      .single()

    if (error) throw error
    return {
      wholeDayItemIds: Array.isArray(data?.WHOLE_DAY_ITEM_IDS) ? data.WHOLE_DAY_ITEM_IDS.map(String) : [],
      morningItemIds: Array.isArray(data?.MORNING_ITEM_IDS) ? data.MORNING_ITEM_IDS.map(String) : [],
      afternoonItemIds: Array.isArray(data?.AFTERNOON_ITEM_IDS) ? data.AFTERNOON_ITEM_IDS.map(String) : [],
    }
  } catch (err) {
    console.warn('[menuService] Error fetching preset scheduled item IDs:', err)
    return {
      wholeDayItemIds: [],
      morningItemIds: [],
      afternoonItemIds: [],
    }
  }
}

export async function savePresetItems(
  presetId: number,
  items: ScheduledPresetItems | string[],
): Promise<void> {
  let payload: Record<string, unknown> = {}
  if (Array.isArray(items)) {
    payload = {
      WHOLE_DAY_ITEM_IDS: items.map(Number).filter((n) => !isNaN(n)),
    }
  } else {
    payload = {
      WHOLE_DAY_ITEM_IDS: (items.wholeDayItemIds ?? []).map(Number).filter((n) => !isNaN(n)),
      MORNING_ITEM_IDS: (items.morningItemIds ?? []).map(Number).filter((n) => !isNaN(n)),
      AFTERNOON_ITEM_IDS: (items.afternoonItemIds ?? []).map(Number).filter((n) => !isNaN(n)),
    }
  }

  const { error } = await supabase
    .schema('menu')
    .from('Menu_Presets')
    .update(payload)
    .eq('PRESET_ID', presetId)

  if (error) throw error

  // Broadcast preset items change event
  if (typeof window !== 'undefined') {
    const detail = { type: 'menu_preset_items_changed', presetId, items }
    window.dispatchEvent(new CustomEvent('monolith-order-update', { detail }))
    window.dispatchEvent(new CustomEvent('menu-preset-items-changed', { detail }))
    try {
      const bc = new BroadcastChannel('monolith_order_events')
      bc.postMessage(detail)
      bc.close()
    } catch {
      // Ignore
    }
  }
}

export async function updateMenuPreset(presetId: number, name: string): Promise<void> {
  const { error } = await supabase.schema('menu').from('Menu_Presets').update({
    PRESET_NAME: name,
  }).eq('PRESET_ID', presetId)
  if (error) throw error
}

export async function deleteMenuPreset(presetId: number): Promise<void> {
  const { error } = await supabase.schema('menu').from('Menu_Presets').delete().eq('PRESET_ID', presetId)
  if (error) throw error
}

export interface MenuItemMetadata {
  originalPrice?: number
  discountPercent?: number
  discountAmount?: number
  isBestSeller?: boolean
}

export function parseItemDescription(rawDesc?: string | null): { description: string; meta: MenuItemMetadata } {
  if (!rawDesc) return { description: '', meta: {} }
  const match = rawDesc.match(/<!--META:(.*?)-->/)
  if (match) {
    try {
      const meta = JSON.parse(match[1]) as MenuItemMetadata
      const cleanDesc = rawDesc.replace(/<!--META:.*?-->/, '').trim()
      return { description: cleanDesc, meta }
    } catch {
      // ignore JSON parse error
    }
  }
  return { description: rawDesc.trim(), meta: {} }
}

export function formatItemDescription(desc?: string | null, meta?: MenuItemMetadata): string {
  const clean = (desc || '').replace(/<!--META:.*?-->/, '').trim()
  if (!meta) return clean
  const hasMeta =
    meta.originalPrice != null ||
    meta.discountPercent != null ||
    meta.discountAmount != null ||
    meta.isBestSeller != null
  if (!hasMeta) return clean
  return `${clean} <!--META:${JSON.stringify(meta)}-->`.trim()
}

function mapDietaryType(value: unknown): MenuItem['dietaryType'] {
  return String(value).toUpperCase() === 'VEGETARIAN' || String(value).toLowerCase() === 'veg' ? 'veg' : 'non-veg'
}

function toDatabaseDietaryType(value: string): 'VEGETARIAN' | 'NON-VEGETARIAN' {
  return value.toUpperCase() === 'VEGETARIAN' || value.toLowerCase() === 'veg' ? 'VEGETARIAN' : 'NON-VEGETARIAN'
}

function mapItem(row: Record<string, unknown>): MenuItem {
  const { description, meta } = parseItemDescription(row['ITEM_DESCRIPTION'] as string | undefined)
  const isDirectBestSeller = row['IS_BEST_SELLER'] === true || meta.isBestSeller === true
  const originalPrice = meta.originalPrice ?? (row['ORIGINAL_PRICE'] != null ? Number(row['ORIGINAL_PRICE']) : undefined)
  const discountPercent = meta.discountPercent ?? (row['DISCOUNT_PERCENT'] != null ? Number(row['DISCOUNT_PERCENT']) : undefined)
  const discountAmount = meta.discountAmount

  let badge = undefined
  if (discountPercent && discountPercent > 0) {
    badge = { label: `${discountPercent}% OFF`, type: 'discount' as const }
  } else if (isDirectBestSeller) {
    badge = { label: 'Best Seller', type: 'best-seller' as const }
  }

  const rawLimit = row['ORDER_LIMIT']
  const orderLimit = rawLimit != null ? Number(rawLimit) : undefined
  const isOutOfStock =
    String(row['ITEM_STATUS'] ?? 'AVAILABLE') === 'OUT_OF_STOCK' ||
    (orderLimit !== undefined && orderLimit <= 0)

  return {
    id: String(row['ITEM_ID']),
    name: String(row['ITEM_NAME']),
    code: String(row['ITEM_ID']),
    price: Number(row['ITEM_PRICE']),
    originalPrice,
    discountPercent,
    discountAmount,
    categoryId: String(row['CATEGORY_ID']),
    dietaryType: mapDietaryType(row['MENU_ITEM_DIETARY']),
    imageUrl: (row['ITEM_IMAGE_URL'] as string | undefined) || DEFAULT_FOOD_PLACEHOLDER,
    isAvailable: !isOutOfStock,
    isSoldOut: isOutOfStock,
    isItemGroup: row['IS_ITEM_GROUP'] === true,
    description: description || undefined,
    isBestSeller: isDirectBestSeller,
    badge,
    orderLimit,
  }
}

function mapCategory(row: Record<string, unknown>, count: number): Category {
  return {
    id: String(row['CATEGORY_ID']),
    name: String(row['CATEGORY_NAME']),
    count,
    icon: typeof row['CATEGORY_ICON'] === 'string' ? row['CATEGORY_ICON'] : undefined,
  }
}

let cachedBestSellerIds: Set<string> | null = null
let lastBestSellerFetchTime = 0
const BEST_SELLER_CACHE_TTL = 15 * 60 * 1000 // 15 minutes

export async function fetchMenuItems(): Promise<MenuItem[]> {
  const { data, error } = await supabase
    .schema('menu')
    .from('Menu_Items')
    .select('*')
    .order('ITEM_NAME')

  if (error) throw error

  const rawItems = (data ?? [])
    .filter((row) => (row as Record<string, unknown>)['IS_ITEM_GROUP'] !== true)
    .map((row) => mapItem(row as Record<string, unknown>))

  // Determine best sellers per category using Order_Items sales volume
  try {
    const isCacheValid = cachedBestSellerIds && (Date.now() - lastBestSellerFetchTime < BEST_SELLER_CACHE_TTL)
    let bestSellerIds = cachedBestSellerIds

    if (!isCacheValid) {
      const { data: orderItemsData } = await supabase
        .from('Order_Items')
        .select('ITEM_ID')
        .order('ORDER_ITEM_ID', { ascending: false })
        .limit(500)

      // Count rows per item ID (each row = 1 unit)
      const salesMap = (orderItemsData ?? []).reduce<Record<string, number>>((acc, row) => {
        const id = String(row['ITEM_ID'])
        acc[id] = (acc[id] ?? 0) + 1
        return acc
      }, {})

      // Group items by category
      const categoryGroups = rawItems.reduce<Record<string, MenuItem[]>>((acc, item) => {
        if (!acc[item.categoryId]) acc[item.categoryId] = []
        acc[item.categoryId].push(item)
        return acc
      }, {})

      // Pick top-selling item(s) for each category
      const newBestSellerIds = new Set<string>()
      for (const [, catItems] of Object.entries(categoryGroups)) {
        if (catItems.length === 0) continue

        // Sort category items by sales descending; if tied, keep original order
        const sorted = [...catItems].sort((a, b) => {
          const salesA = salesMap[a.id] ?? 0
          const salesB = salesMap[b.id] ?? 0
          return salesB - salesA
        })

        // Top item in this category is the best seller
        newBestSellerIds.add(sorted[0].id)
      }

      cachedBestSellerIds = newBestSellerIds
      lastBestSellerFetchTime = Date.now()
      bestSellerIds = newBestSellerIds
    }

    return rawItems.map((item) => {
      const isBest = item.isBestSeller || (bestSellerIds?.has(item.id) ?? false)
      let badge = item.badge
      if (item.discountPercent && item.discountPercent > 0) {
        badge = { label: `${item.discountPercent}% OFF`, type: 'discount' }
      } else if (isBest) {
        badge = { label: 'Best Seller', type: 'best-seller' }
      }
      return {
        ...item,
        isBestSeller: isBest,
        badge,
      }
    })
  } catch (err) {
    console.warn('[menuService] Could not calculate best sellers from Order_Items:', err)
    return rawItems
  }
}

export const fetchCatalogItems = fetchMenuItems

export async function fetchCategories(items: MenuItem[]): Promise<Category[]> {
  const { data, error } = await supabase
    .schema('menu')
    .from('Menu_Categories')
    .select('*')
    .order('CATEGORY_NAME')

  if (error) throw error

  // Count items per category using already-fetched items (avoids extra queries)
  const countMap = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.categoryId] = (acc[item.categoryId] ?? 0) + 1
    return acc
  }, {})

  const categoryRows = (data ?? []).map((row) =>
    mapCategory(row as Record<string, unknown>, countMap[String(row['CATEGORY_ID'])] ?? 0),
  )

  // Prepend "All Menu" virtual category
  const allCategory: Category = { id: 'all', name: 'All Menu', count: items.length }

  return [allCategory, ...categoryRows]
}

// ── Admin / Menu Manager mutations ────────────────────────────────────────────

export async function createMenuItem(payload: {
  name: string
  price: number
  originalPrice?: number
  discountPercent?: number
  discountAmount?: number
  isBestSeller?: boolean
  categoryId: string
  dietaryType: string
  imageUrl?: string
  description?: string
  isAvailable?: boolean
  orderLimit?: number
  itemIds?: string[]
}): Promise<MenuItem> {
  const meta: MenuItemMetadata = {}
  if (payload.originalPrice !== undefined) meta.originalPrice = payload.originalPrice
  if (payload.discountPercent !== undefined) meta.discountPercent = payload.discountPercent
  if (payload.discountAmount !== undefined) meta.discountAmount = payload.discountAmount
  if (payload.isBestSeller !== undefined) meta.isBestSeller = payload.isBestSeller

  const formattedDesc = formatItemDescription(payload.description, meta)

  const { data, error } = await supabase
    .schema('menu')
    .from('Menu_Items')
    .insert({
      ITEM_NAME: payload.name,
      ITEM_PRICE: payload.price,
      CATEGORY_ID: Number(payload.categoryId),
      ITEM_STATUS:
        payload.isAvailable === false || (payload.orderLimit !== undefined && payload.orderLimit <= 0)
          ? 'OUT_OF_STOCK'
          : 'AVAILABLE',
      MENU_ITEM_DIETARY: toDatabaseDietaryType(payload.dietaryType),
      ITEM_IMAGE_URL: payload.imageUrl ?? null,
      ITEM_DESCRIPTION: formattedDesc || null,
      ORDER_LIMIT: payload.orderLimit !== undefined ? payload.orderLimit : null,
      IS_ITEM_GROUP: (payload.itemIds?.length ?? 0) > 0,
    })
    .select()
    .single()

  if (error) throw error
  const item = mapItem(data as Record<string, unknown>)
  if (payload.itemIds?.length) {
    const { error: linkError } = await supabase.schema('menu').from('Item_Groups').insert(
      payload.itemIds.map((itemId) => ({ MENU_GROUP_ID: Number(data.ITEM_ID), ITEM_ID: Number(itemId) })),
    )
    if (linkError) throw linkError
  }
  return item
}

export async function updateMenuItem(id: string, patch: {
  name?: string
  price?: number
  originalPrice?: number
  discountPercent?: number
  discountAmount?: number
  isBestSeller?: boolean
  categoryId?: string
  dietaryType?: string
  isAvailable?: boolean
  imageUrl?: string
  description?: string
  orderLimit?: number | null
  itemIds?: string[]
}): Promise<void> {
  const update: Record<string, unknown> = {}
  if (patch.name !== undefined) update['ITEM_NAME'] = patch.name
  if (patch.price !== undefined) update['ITEM_PRICE'] = patch.price
  if (patch.categoryId !== undefined) update['CATEGORY_ID'] = Number(patch.categoryId)
  if (patch.imageUrl !== undefined) update['ITEM_IMAGE_URL'] = patch.imageUrl
  if (patch.dietaryType !== undefined) update['MENU_ITEM_DIETARY'] = toDatabaseDietaryType(patch.dietaryType)
  if (patch.isAvailable !== undefined) update['ITEM_STATUS'] = patch.isAvailable ? 'AVAILABLE' : 'OUT_OF_STOCK'
  if (patch.orderLimit !== undefined) {
    update['ORDER_LIMIT'] = patch.orderLimit
    if (patch.orderLimit !== null && patch.orderLimit <= 0) {
      update['ITEM_STATUS'] = 'OUT_OF_STOCK'
    } else if (patch.orderLimit !== null && patch.orderLimit > 0 && patch.isAvailable === undefined) {
      update['ITEM_STATUS'] = 'AVAILABLE'
    }
  }
  if (patch.itemIds !== undefined) update['IS_ITEM_GROUP'] = patch.itemIds.length > 0

  if (
    patch.description !== undefined ||
    patch.originalPrice !== undefined ||
    patch.discountPercent !== undefined ||
    patch.discountAmount !== undefined ||
    patch.isBestSeller !== undefined
  ) {
    const baseDesc = patch.description ?? ''
    const meta: MenuItemMetadata = {}
    if (patch.originalPrice !== undefined) meta.originalPrice = patch.originalPrice
    if (patch.discountPercent !== undefined) meta.discountPercent = patch.discountPercent
    if (patch.discountAmount !== undefined) meta.discountAmount = patch.discountAmount
    if (patch.isBestSeller !== undefined) meta.isBestSeller = patch.isBestSeller

    update['ITEM_DESCRIPTION'] = formatItemDescription(baseDesc, meta)
  }

  const { error } = await supabase
    .schema('menu')
    .from('Menu_Items')
    .update(update)
    .eq('ITEM_ID', Number(id))
  if (error) throw error

  if (patch.isAvailable !== undefined || patch.orderLimit !== undefined) {
    const isSoldOut = update['ITEM_STATUS'] === 'OUT_OF_STOCK'
    const newLimit = patch.orderLimit !== null && patch.orderLimit !== undefined ? patch.orderLimit : undefined
    broadcastMenuItemStatus(id, isSoldOut, newLimit)
  }

  if (patch.itemIds !== undefined) {
    const { error: deleteError } = await supabase
      .schema('menu')
      .from('Item_Groups')
      .delete()
      .eq('MENU_GROUP_ID', Number(id))

    if (deleteError) throw deleteError

    if (patch.itemIds.length > 0) {
      const { error: linkError } = await supabase
        .schema('menu')
        .from('Item_Groups')
        .insert(patch.itemIds.map((itemId) => ({
          MENU_GROUP_ID: Number(id),
          ITEM_ID: Number(itemId),
        })))
      if (linkError) throw linkError
    }
  }

  if (patch.isAvailable !== undefined && patch.itemIds === undefined) {
    const { data: parentLinks, error: parentLinksError } = await supabase
      .schema('menu')
      .from('Item_Groups')
      .select('MENU_GROUP_ID')
      .eq('ITEM_ID', Number(id))

    if (parentLinksError) throw parentLinksError

    const parentIds = [...new Set((parentLinks ?? []).map((link) => Number((link as Record<string, unknown>)['MENU_GROUP_ID'])))]
    if (parentIds.length > 0) {
      const { data: allLinks, error: allLinksError } = await supabase
        .schema('menu')
        .from('Item_Groups')
        .select('MENU_GROUP_ID, ITEM_ID')
        .in('MENU_GROUP_ID', parentIds)

      if (allLinksError) throw allLinksError

      const childIds = [...new Set((allLinks ?? []).map((link) => Number((link as Record<string, unknown>)['ITEM_ID'])))]
      const { data: childItems, error: childItemsError } = await supabase
        .schema('menu')
        .from('Menu_Items')
        .select('ITEM_ID, ITEM_STATUS')
        .in('ITEM_ID', childIds)

      if (childItemsError) throw childItemsError

      const unavailableParents = parentIds.filter((parentId) =>
        (allLinks ?? [])
          .filter((link) => Number((link as Record<string, unknown>)['MENU_GROUP_ID']) === parentId)
          .some((link) => (childItems ?? []).some((child) =>
            Number((child as Record<string, unknown>)['ITEM_ID']) === Number((link as Record<string, unknown>)['ITEM_ID'])
            && String((child as Record<string, unknown>)['ITEM_STATUS']) === 'OUT_OF_STOCK',
          )),
      )

      for (const parentId of parentIds) {
        const { error: parentError } = await supabase
          .schema('menu')
          .from('Menu_Items')
          .update({ ITEM_STATUS: unavailableParents.includes(parentId) ? 'OUT_OF_STOCK' : 'AVAILABLE' })
          .eq('ITEM_ID', parentId)
        if (parentError) throw parentError
      }
    }
  }
}

export interface MenuItemGroup {
  id: string
  presetId?: number
  name: string
  description: string
  price: number
  imageUrl: string
  status: string
  orderLimit?: number
  categoryId: string
  itemIds: string[]
  itemNames: string[]
  itemImages: string[]
  itemAvailability: boolean[]
}

export async function fetchMenuItemGroups(): Promise<MenuItemGroup[]> {
  const { data, error } = await supabase
    .schema('menu')
    .from('Menu_Items')
    .select('ITEM_ID, ITEM_NAME, ITEM_DESCRIPTION, ITEM_PRICE, ITEM_IMAGE_URL, ITEM_STATUS, ORDER_LIMIT, CATEGORY_ID, IS_ITEM_GROUP, Item_Groups(ITEM_ID)')
    .eq('IS_ITEM_GROUP', true)
    .order('ITEM_ID')
  if (error) throw error

  const rows = (data ?? []) as Array<Record<string, unknown>>
  const linksByGroup = new Map<string, string[]>()
  const childIds = new Set<string>()
  rows.forEach((row) => {
    const groupId = String(row['ITEM_ID'])
    const links = row['Item_Groups'] as Array<Record<string, unknown>> ?? []
    const ids = links.map((link) => String(link['ITEM_ID']))
    linksByGroup.set(groupId, ids)
    ids.forEach((id) => childIds.add(id))
  })

  const childNames = new Map<string, string>()
  const childImages = new Map<string, string>()
  const childStatuses = new Map<string, string>()
  if (childIds.size > 0) {
    const { data: childRows, error: childError } = await supabase
      .schema('menu')
      .from('Menu_Items')
      .select('ITEM_ID, ITEM_NAME, ITEM_IMAGE_URL, ITEM_STATUS')
      .in('ITEM_ID', [...childIds])
    if (childError) throw childError
    ;(childRows ?? []).forEach((child) => {
      const row = child as Record<string, unknown>
      const itemId = String(row['ITEM_ID'])
      childNames.set(itemId, String(row['ITEM_NAME'] ?? ''))
      childImages.set(itemId, String(row['ITEM_IMAGE_URL'] ?? ''))
      childStatuses.set(itemId, String(row['ITEM_STATUS'] ?? 'AVAILABLE'))
    })
  }

  return rows.map((raw) => {
    const id = String(raw['ITEM_ID'])
    const itemIds = linksByGroup.get(id) ?? []
    return {
      id,
      name: String(raw['ITEM_NAME'] ?? ''),
      description: String(raw['ITEM_DESCRIPTION'] ?? ''),
      price: Number(raw['ITEM_PRICE'] ?? 0),
      imageUrl: String(raw['ITEM_IMAGE_URL'] ?? ''),
      status: itemIds.some((itemId) => childStatuses.get(itemId) === 'OUT_OF_STOCK')
        ? 'OUT_OF_STOCK'
        : String(raw['ITEM_STATUS'] ?? 'AVAILABLE'),
      orderLimit: raw['ORDER_LIMIT'] != null ? Number(raw['ORDER_LIMIT']) : undefined,
      categoryId: String(raw['CATEGORY_ID'] ?? ''),
      itemIds,
      itemNames: itemIds.map((itemId) => childNames.get(itemId) ?? `Item #${itemId}`),
      itemImages: itemIds.map((itemId) => childImages.get(itemId) ?? ''),
      itemAvailability: itemIds.map((itemId) => childStatuses.get(itemId) !== 'OUT_OF_STOCK'),
    }
  })
}

export async function fetchServiceMenuItems(): Promise<MenuItem[]> {
  const [items, groups] = await Promise.all([fetchMenuItems(), fetchMenuItemGroups()])

  const groupItems: MenuItem[] = groups.map((group) => {
    const isOutOfStock = group.status === 'OUT_OF_STOCK' || (group.orderLimit !== undefined && group.orderLimit <= 0)
    return {
      id: group.id,
      name: group.name,
      description: group.description || undefined,
      code: group.id,
      price: group.price,
      categoryId: group.categoryId,
      dietaryType: 'non-veg',
      imageUrl: group.imageUrl || DEFAULT_FOOD_PLACEHOLDER,
      isAvailable: !isOutOfStock,
      isSoldOut: isOutOfStock,
      isItemGroup: true,
      includedItemNames: group.itemNames,
      orderLimit: group.orderLimit,
    }
  })

  return [...items, ...groupItems]
}

export async function createMenuItemGroup(payload: {
  name: string
  description: string
  price: number
  imageUrl?: string
  status: string
  orderLimit: number
  categoryId: string
  itemIds: string[]
}): Promise<void> {
  const { data, error } = await supabase
    .schema('menu')
    .from('Menu_Items')
    .insert({
      IS_ITEM_GROUP: true,
      ITEM_NAME: payload.name,
      ITEM_DESCRIPTION: payload.description || null,
      ITEM_PRICE: payload.price,
      ITEM_IMAGE_URL: payload.imageUrl ?? null,
      ITEM_STATUS: payload.status,
      ORDER_LIMIT: payload.orderLimit,
      CATEGORY_ID: Number(payload.categoryId),
    })
    .select('ITEM_ID')
    .single()
  if (error || !data) throw error ?? new Error('Failed to create group item.')
  const groupId = Number((data as Record<string, unknown>)['ITEM_ID'])
  const { error: linkError } = await supabase
    .schema('menu')
    .from('Item_Groups')
    .insert(payload.itemIds.map((itemId) => ({ MENU_GROUP_ID: groupId, ITEM_ID: Number(itemId) })))
  if (linkError) throw linkError
}

export async function updateMenuItemGroup(id: string, payload: {
  name: string
  description: string
  price: number
  imageUrl?: string
  status: string
  orderLimit?: number
  categoryId: string
  itemIds: string[]
}): Promise<void> {
  const isOutOfStock = payload.status === 'OUT_OF_STOCK' || (payload.orderLimit !== undefined && payload.orderLimit <= 0)
  const status = isOutOfStock ? 'OUT_OF_STOCK' : payload.status
  const { error } = await supabase.schema('menu').from('Menu_Items').update({
    IS_ITEM_GROUP: true,
    ITEM_NAME: payload.name,
    ITEM_DESCRIPTION: payload.description || null,
    ITEM_PRICE: payload.price,
    ITEM_IMAGE_URL: payload.imageUrl ?? null,
    ITEM_STATUS: status,
    ORDER_LIMIT: payload.orderLimit !== undefined ? payload.orderLimit : null,
    CATEGORY_ID: Number(payload.categoryId),
  }).eq('ITEM_ID', Number(id))
  if (error) throw error
  const { error: deleteError } = await supabase.schema('menu').from('Item_Groups').delete().eq('MENU_GROUP_ID', Number(id))
  if (deleteError) throw deleteError
  const { error: linkError } = await supabase.schema('menu').from('Item_Groups').insert(payload.itemIds.map((itemId) => ({ MENU_GROUP_ID: Number(id), ITEM_ID: Number(itemId) })))
  if (linkError) throw linkError
  broadcastMenuItemStatus(id, isOutOfStock, payload.orderLimit)
}

export async function deleteMenuItemGroup(id: string): Promise<void> {
  const { error: deleteLinksError } = await supabase.schema('menu').from('Item_Groups').delete().eq('MENU_GROUP_ID', Number(id))
  if (deleteLinksError) throw deleteLinksError
  const { error } = await supabase.schema('menu').from('Menu_Items').delete().eq('ITEM_ID', Number(id))
  if (error) throw error
}

export async function deleteMenuItem(id: string): Promise<void> {
  const numId = Number(id)
  if (isNaN(numId)) return

  // 1. Clean up any item group references where this item is a combo parent or child inclusion
  try {
    await supabase.schema('menu').from('Item_Groups').delete().or(`MENU_GROUP_ID.eq.${numId},ITEM_ID.eq.${numId}`)
  } catch (err) {
    console.warn('[menuService] Non-fatal cleanup of Item_Groups failed:', err)
  }

  // 2. Remove this item ID from any presets that currently include it
  try {
    const { data: presets } = await supabase
      .schema('menu')
      .from('Menu_Presets')
      .select('PRESET_ID, WHOLE_DAY_ITEM_IDS, MORNING_ITEM_IDS, AFTERNOON_ITEM_IDS')
    if (presets && presets.length > 0) {
      for (const p of presets as Record<string, unknown>[]) {
        const whole = Array.isArray(p.WHOLE_DAY_ITEM_IDS) ? (p.WHOLE_DAY_ITEM_IDS as (number | string)[]).map(Number) : []
        const morning = Array.isArray(p.MORNING_ITEM_IDS) ? (p.MORNING_ITEM_IDS as (number | string)[]).map(Number) : []
        const afternoon = Array.isArray(p.AFTERNOON_ITEM_IDS) ? (p.AFTERNOON_ITEM_IDS as (number | string)[]).map(Number) : []

        const hasInWhole = whole.includes(numId)
        const hasInMorning = morning.includes(numId)
        const hasInAfternoon = afternoon.includes(numId)

        if (hasInWhole || hasInMorning || hasInAfternoon) {
          await supabase.schema('menu').from('Menu_Presets').update({
            WHOLE_DAY_ITEM_IDS: whole.filter((id) => id !== numId),
            MORNING_ITEM_IDS: morning.filter((id) => id !== numId),
            AFTERNOON_ITEM_IDS: afternoon.filter((id) => id !== numId),
          }).eq('PRESET_ID', p.PRESET_ID)
        }
      }
    }
  } catch (err) {
    console.warn('[menuService] Non-fatal cleanup of Menu_Presets failed:', err)
  }

  // 3. Delete the master item
  const { error } = await supabase
    .schema('menu')
    .from('Menu_Items')
    .delete()
    .eq('ITEM_ID', numId)
  if (error) throw error
}

export async function createCategory(name: string, icon: string): Promise<Category> {
  const { data, error } = await supabase
    .schema('menu')
    .from('Menu_Categories')
    .insert({ CATEGORY_NAME: name, CATEGORY_ICON: icon })
    .select()
    .single()

  if (error) throw error
  const row = data as Record<string, unknown>
  return mapCategory(row, 0)
}

export async function updateCategory(id: string, name: string, icon: string): Promise<void> {
  const { error } = await supabase
    .schema('menu')
    .from('Menu_Categories')
    .update({ CATEGORY_NAME: name, CATEGORY_ICON: icon })
    .eq('CATEGORY_ID', Number(id))
  if (error) throw error
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase
    .schema('menu')
    .from('Menu_Categories')
    .delete()
    .eq('CATEGORY_ID', Number(id))
  if (error) throw error
}

// ── Table lookup ──────────────────────────────────────────────────────────────

export async function fetchTableByNumber(tableNum: string | number): Promise<{ id: number; label: string } | null> {
  const { data, error } = await supabase
    .schema('tables')
    .from('Restaurant_Tables')
    .select('TABLE_ID, TABLE_NUM')
    .eq('TABLE_NUM', Number(tableNum))
    .single()

  if (error || !data) return null

  const row = data as Record<string, unknown>
  return {
    id: Number(row['TABLE_ID']),
    label: `Table ${row['TABLE_NUM']}`,
  }
}
