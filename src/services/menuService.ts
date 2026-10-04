import { supabase } from '@/lib/supabase'
import { DEFAULT_FOOD_PLACEHOLDER, type MenuItem, type Category } from '@/types/menu'

export interface MenuPreset {
  PRESET_ID: number
  PRESET_NAME: string
  IS_DEFAULT?: boolean
  ITEM_IDS: string[]
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
      .select('PRESET_ID, PRESET_NAME, IS_DEFAULT, ITEM_IDS')
      .order('PRESET_ID')

    if (!error && data) {
      let presets: MenuPreset[] = data.map((row) => ({
        PRESET_ID: Number(row.PRESET_ID),
        PRESET_NAME: String(row.PRESET_NAME),
        IS_DEFAULT: Boolean(row.IS_DEFAULT),
        ITEM_IDS: Array.isArray(row.ITEM_IDS)
          ? row.ITEM_IDS.map((id: unknown) => String(id))
          : [],
      }))

      // Ensure Global preset exists
      const hasGlobal = presets.some((p) => p.PRESET_NAME.trim().toLowerCase() === 'global')
      if (!hasGlobal) {
        try {
          const globalPreset = await createMenuPreset('Global', [])
          presets.push(globalPreset)
        } catch {
          // Non-fatal if creation fails
        }
      }

      // Sort: 1st Global, 2nd Default, followed by other presets
      return sortMenuPresets(presets)
    }
  } catch {
    // Fallback if ITEM_IDS column is being migrated
  }

  const { data: fallbackData, error: fallbackError } = await supabase
    .schema('menu')
    .from('Menu_Presets')
    .select('PRESET_ID, PRESET_NAME, IS_DEFAULT')
    .order('PRESET_ID')

  if (fallbackError) throw fallbackError

  const fallbackPresetMap: Record<number, string[]> = {
    1: ['5', '6', '7', '8'],
    2: ['10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24', '33', '34'],
    5: ['27', '28', '29'],
    6: [],
    7: ['32'],
  }



  return (fallbackData ?? []).map((row) => ({
    PRESET_ID: Number(row.PRESET_ID),
    PRESET_NAME: String(row.PRESET_NAME),
    IS_DEFAULT: Boolean(row.IS_DEFAULT),
    ITEM_IDS: fallbackPresetMap[Number(row.PRESET_ID)] ?? [],
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

export async function createMenuPreset(name: string, initialItemIds: string[] = []): Promise<MenuPreset> {
  const numericItemIds = initialItemIds.map(Number).filter((n) => !isNaN(n))
  const { data, error } = await supabase
    .schema('menu')
    .from('Menu_Presets')
    .insert({
      PRESET_NAME: name,
      IS_DEFAULT: false,
      ITEM_IDS: numericItemIds,
    })
    .select('PRESET_ID, PRESET_NAME, IS_DEFAULT, ITEM_IDS')
    .single()
  if (error) throw error
  return {
    PRESET_ID: Number(data.PRESET_ID),
    PRESET_NAME: String(data.PRESET_NAME),
    IS_DEFAULT: Boolean(data.IS_DEFAULT),
    ITEM_IDS: Array.isArray(data.ITEM_IDS) ? data.ITEM_IDS.map(String) : [],
  }
}

export async function fetchPresetItemIds(presetId: number): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .schema('menu')
      .from('Menu_Presets')
      .select('ITEM_IDS')
      .eq('PRESET_ID', presetId)
      .single()

    if (error) throw error
    return Array.isArray(data?.ITEM_IDS) ? data.ITEM_IDS.map(String) : []
  } catch (err) {
    console.warn('[menuService] Error fetching preset ITEM_IDS:', err)
    return []
  }
}

export async function savePresetItems(presetId: number, itemIds: string[]): Promise<void> {
  const numericItemIds = itemIds.map(Number).filter((n) => !isNaN(n))
  const { error } = await supabase
    .schema('menu')
    .from('Menu_Presets')
    .update({ ITEM_IDS: numericItemIds })
    .eq('PRESET_ID', presetId)

  if (error) throw error

  // Broadcast preset items change event
  if (typeof window !== 'undefined') {
    const detail = { type: 'menu_preset_items_changed', presetId, itemIds }
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
    isAvailable: String(row['ITEM_STATUS'] ?? 'AVAILABLE') !== 'OUT_OF_STOCK',
    isSoldOut: String(row['ITEM_STATUS'] ?? 'AVAILABLE') === 'OUT_OF_STOCK',
    isItemGroup: row['IS_ITEM_GROUP'] === true,
    description: description || undefined,
    isBestSeller: isDirectBestSeller,
    badge,
    orderLimit: row['ORDER_LIMIT'] != null ? Number(row['ORDER_LIMIT']) : 0,
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
    // Fallback: mark first item of each category
    const seenCategories = new Set<string>()
    return rawItems.map((item) => {
      const isBest = item.isBestSeller || !seenCategories.has(item.categoryId)
      if (isBest) seenCategories.add(item.categoryId)
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
      ITEM_STATUS: payload.isAvailable === false ? 'OUT_OF_STOCK' : 'AVAILABLE',
      MENU_ITEM_DIETARY: toDatabaseDietaryType(payload.dietaryType),
      ITEM_IMAGE_URL: payload.imageUrl ?? null,
      ITEM_DESCRIPTION: formattedDesc || null,
      ORDER_LIMIT: payload.orderLimit ?? 0,
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
  orderLimit?: number
  itemIds?: string[]
}): Promise<void> {
  const update: Record<string, unknown> = {}
  if (patch.name !== undefined) update['ITEM_NAME'] = patch.name
  if (patch.price !== undefined) update['ITEM_PRICE'] = patch.price
  if (patch.categoryId !== undefined) update['CATEGORY_ID'] = Number(patch.categoryId)
  if (patch.imageUrl !== undefined) update['ITEM_IMAGE_URL'] = patch.imageUrl
  if (patch.dietaryType !== undefined) update['MENU_ITEM_DIETARY'] = toDatabaseDietaryType(patch.dietaryType)
  if (patch.isAvailable !== undefined) update['ITEM_STATUS'] = patch.isAvailable ? 'AVAILABLE' : 'OUT_OF_STOCK'
  if (patch.orderLimit !== undefined) update['ORDER_LIMIT'] = patch.orderLimit
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
  orderLimit: number
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
      orderLimit: Number(raw['ORDER_LIMIT'] ?? 0),
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

  const groupItems: MenuItem[] = groups.map((group) => ({
    id: group.id,
    name: group.name,
    description: group.description || undefined,
    code: group.id,
    price: group.price,
    categoryId: group.categoryId,
    dietaryType: 'non-veg',
    imageUrl: group.imageUrl || DEFAULT_FOOD_PLACEHOLDER,
    isAvailable: group.status !== 'OUT_OF_STOCK',
    isSoldOut: group.status === 'OUT_OF_STOCK',
    isItemGroup: true,
    includedItemNames: group.itemNames,
    orderLimit: group.orderLimit,
  }))

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
  orderLimit: number
  categoryId: string
  itemIds: string[]
}): Promise<void> {
  const { error } = await supabase.schema('menu').from('Menu_Items').update({ IS_ITEM_GROUP: true, ITEM_NAME: payload.name, ITEM_DESCRIPTION: payload.description || null, ITEM_PRICE: payload.price, ITEM_IMAGE_URL: payload.imageUrl ?? null, ITEM_STATUS: payload.status, ORDER_LIMIT: payload.orderLimit, CATEGORY_ID: Number(payload.categoryId) }).eq('ITEM_ID', Number(id))
  if (error) throw error
  const { error: deleteError } = await supabase.schema('menu').from('Item_Groups').delete().eq('MENU_GROUP_ID', Number(id))
  if (deleteError) throw deleteError
  const { error: linkError } = await supabase.schema('menu').from('Item_Groups').insert(payload.itemIds.map((itemId) => ({ MENU_GROUP_ID: Number(id), ITEM_ID: Number(itemId) })))
  if (linkError) throw linkError
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
    const { data: presets } = await supabase.schema('menu').from('Menu_Presets').select('PRESET_ID, ITEM_IDS')
    if (presets && presets.length > 0) {
      for (const p of presets) {
        if (Array.isArray(p.ITEM_IDS) && p.ITEM_IDS.includes(numId)) {
          const updatedIds = p.ITEM_IDS.filter((itemId: number) => itemId !== numId)
          await supabase.schema('menu').from('Menu_Presets').update({ ITEM_IDS: updatedIds }).eq('PRESET_ID', p.PRESET_ID)
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
