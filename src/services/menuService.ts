import { supabase } from '@/lib/supabase'
import { DEFAULT_FOOD_PLACEHOLDER, type MenuItem, type Category } from '@/types/menu'

function mapDietaryType(value: unknown): MenuItem['dietaryType'] {
  return String(value).toUpperCase() === 'VEGETARIAN' || String(value).toLowerCase() === 'veg' ? 'veg' : 'non-veg'
}

function toDatabaseDietaryType(value: string): 'VEGETARIAN' | 'NON-VEGETARIAN' {
  return value.toUpperCase() === 'VEGETARIAN' || value.toLowerCase() === 'veg' ? 'VEGETARIAN' : 'NON-VEGETARIAN'
}

function mapItem(row: Record<string, unknown>): MenuItem {
  return {
    id: String(row['ITEM_ID']),
    name: String(row['ITEM_NAME']),
    code: String(row['ITEM_ID']),
    price: Number(row['ITEM_PRICE']),
    categoryId: String(row['CATEGORY_ID']),
    dietaryType: mapDietaryType(row['MENU_ITEM_DIETARY']),
    imageUrl: (row['ITEM_IMAGE_URL'] as string | undefined) || DEFAULT_FOOD_PLACEHOLDER,
    isAvailable: row['ITEM_STATUS'] !== 'OUT_OF_STOCK',
    isSoldOut: row['ITEM_STATUS'] === 'OUT_OF_STOCK',
    description: (row['ITEM_DESCRIPTION'] as string | undefined) ?? undefined,
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
    .from('Menu_Items')
    .select('*')
    .order('ITEM_NAME')

  if (error) throw error
  const rawItems = (data ?? []).map((row) => mapItem(row as Record<string, unknown>))

  // Determine best sellers per category using Order_Items sales volume
  try {
    const isCacheValid = cachedBestSellerIds && (Date.now() - lastBestSellerFetchTime < BEST_SELLER_CACHE_TTL)
    let bestSellerIds = cachedBestSellerIds

    if (!isCacheValid) {
      const { data: orderItemsData } = await supabase
        .from('Order_Items')
        .select('ITEM_ID, QUANTITY')
        .order('ORDER_ITEM_ID', { ascending: false })
        .limit(500)

      // Sum sales volume by item ID
      const salesMap = (orderItemsData ?? []).reduce<Record<string, number>>((acc, row) => {
        const id = String(row['ITEM_ID'])
        const qty = Number(row['QUANTITY'] ?? 1)
        acc[id] = (acc[id] ?? 0) + (isNaN(qty) ? 1 : qty)
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
      const isBest = bestSellerIds?.has(item.id) ?? false
      return {
        ...item,
        isBestSeller: isBest,
        badge: isBest
          ? { label: 'Best Seller', type: 'best-seller' }
          : item.badge,
      }
    })
  } catch (err) {
    console.warn('[menuService] Could not calculate best sellers from Order_Items:', err)
    // Fallback: mark first item of each category
    const seenCategories = new Set<string>()
    return rawItems.map((item) => {
      const isBest = !seenCategories.has(item.categoryId)
      if (isBest) seenCategories.add(item.categoryId)
      return {
        ...item,
        isBestSeller: isBest,
        badge: isBest
          ? { label: 'Best Seller', type: 'best-seller' }
          : item.badge,
      }
    })
  }
}

export async function fetchCategories(items: MenuItem[]): Promise<Category[]> {
  const { data, error } = await supabase
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
  categoryId: string
  dietaryType: string
  imageUrl?: string
  description?: string
  isAvailable?: boolean
}): Promise<MenuItem> {
  const { data, error } = await supabase
    .from('Menu_Items')
    .insert({
      ITEM_NAME: payload.name,
      ITEM_PRICE: payload.price,
      CATEGORY_ID: Number(payload.categoryId),
      ITEM_STATUS: payload.isAvailable === false ? 'OUT_OF_STOCK' : 'AVAILABLE',
      MENU_ITEM_DIETARY: toDatabaseDietaryType(payload.dietaryType),
      ITEM_IMAGE_URL: payload.imageUrl ?? null,
      ITEM_DESCRIPTION: payload.description ?? null,
    })
    .select()
    .single()

  if (error) throw error
  return mapItem(data as Record<string, unknown>)
}

export async function updateMenuItem(id: string, patch: {
  name?: string
  price?: number
  categoryId?: string
  dietaryType?: string
  isAvailable?: boolean
  imageUrl?: string
  description?: string
}): Promise<void> {
  const update: Record<string, unknown> = {}
  if (patch.name        !== undefined) update['ITEM_NAME']        = patch.name
  if (patch.price       !== undefined) update['ITEM_PRICE']       = patch.price
  if (patch.categoryId  !== undefined) update['CATEGORY_ID']      = Number(patch.categoryId)
  if (patch.imageUrl    !== undefined) update['ITEM_IMAGE_URL']  = patch.imageUrl
  if (patch.description !== undefined) update['ITEM_DESCRIPTION'] = patch.description
  if (patch.dietaryType !== undefined) update['MENU_ITEM_DIETARY'] = toDatabaseDietaryType(patch.dietaryType)
  if (patch.isAvailable !== undefined) update['ITEM_STATUS']      = patch.isAvailable ? 'AVAILABLE' : 'OUT_OF_STOCK'

  const { error } = await supabase.from('Menu_Items').update(update).eq('ITEM_ID', Number(id))
  if (error) throw error
}

export async function deleteMenuItem(id: string): Promise<void> {
  const { error } = await supabase.from('Menu_Items').delete().eq('ITEM_ID', Number(id))
  if (error) throw error
}

export async function createCategory(name: string, icon: string): Promise<Category> {
  const { data, error } = await supabase
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
    .from('Menu_Categories')
    .update({ CATEGORY_NAME: name, CATEGORY_ICON: icon })
    .eq('CATEGORY_ID', Number(id))
  if (error) throw error
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase
    .from('Menu_Categories')
    .delete()
    .eq('CATEGORY_ID', Number(id))
  if (error) throw error
}

// ── Table lookup ──────────────────────────────────────────────────────────────

export async function fetchTableByNumber(tableNum: string | number): Promise<{ id: number; label: string } | null> {
  const { data, error } = await supabase
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
