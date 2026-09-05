import { supabase } from '@/lib/supabase'
import { DEFAULT_FOOD_PLACEHOLDER, type MenuItem, type Category } from '@/types/menu'

function mapItem(row: Record<string, unknown>): MenuItem {
  return {
    id: String(row['ITEM_ID']),
    name: String(row['ITEM_NAME']),
    code: String(row['ITEM_ID']),
    price: Number(row['ITEM_PRICE']),
    categoryId: String(row['CATEGORY_ID']),
    dietaryType: 'non-veg', // DB doesn't have dietary type yet; default non-veg
    imageUrl: (row['ITEM_IMAGE'] as string | undefined) || (row['ITEM_IMAGE_URL'] as string | undefined) || DEFAULT_FOOD_PLACEHOLDER,
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
  }
}

export async function fetchMenuItems(): Promise<MenuItem[]> {
  const { data, error } = await supabase
    .from('Menu_Items')
    .select('*')
    .order('ITEM_NAME')

  if (error) throw error
  return (data ?? []).map((row) => mapItem(row as Record<string, unknown>))
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
}): Promise<MenuItem> {
  const { data, error } = await supabase
    .from('Menu_Items')
    .insert({
      ITEM_NAME: payload.name,
      ITEM_PRICE: payload.price,
      CATEGORY_ID: Number(payload.categoryId),
      ITEM_STATUS: 'AVAILABLE',
      ITEM_IMAGE: payload.imageUrl ?? null,
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
  if (patch.imageUrl    !== undefined) update['ITEM_IMAGE']       = patch.imageUrl
  if (patch.description !== undefined) update['ITEM_DESCRIPTION'] = patch.description
  if (patch.isAvailable !== undefined) update['ITEM_STATUS']      = patch.isAvailable ? 'AVAILABLE' : 'OUT_OF_STOCK'

  const { error } = await supabase.from('Menu_Items').update(update).eq('ITEM_ID', Number(id))
  if (error) throw error
}

export async function deleteMenuItem(id: string): Promise<void> {
  const { error } = await supabase.from('Menu_Items').delete().eq('ITEM_ID', Number(id))
  if (error) throw error
}

export async function createCategory(name: string): Promise<Category> {
  const { data, error } = await supabase
    .from('Menu_Categories')
    .insert({ CATEGORY_NAME: name })
    .select()
    .single()

  if (error) throw error
  const row = data as Record<string, unknown>
  return { id: String(row['CATEGORY_ID']), name: String(row['CATEGORY_NAME']), count: 0 }
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
