import { supabase } from '@/lib/supabase'

export type TableType = 1 | 2 | 3 | 4

export interface TableTypeConfig {
  type: TableType
  name: string
  width: number
  height: number
  defaultCapacity: number
  shape: 'square' | 'rectangle' | 'circle' | 'big_circle'
  description: string
}

export const TABLE_TYPES: Record<TableType, TableTypeConfig> = {
  1: {
    type: 1,
    name: 'Square Table',
    width: 1,
    height: 1,
    defaultCapacity: 4,
    shape: 'square',
    description: '1x1 Square (4 Chairs)',
  },
  2: {
    type: 2,
    name: 'Rectangle Table',
    width: 3,
    height: 1,
    defaultCapacity: 8,
    shape: 'rectangle',
    description: '1x3 Rectangle (8 Chairs)',
  },
  3: {
    type: 3,
    name: 'Small Circle Table',
    width: 1,
    height: 1,
    defaultCapacity: 4,
    shape: 'circle',
    description: '1x1 Circle (4 Chairs)',
  },
  4: {
    type: 4,
    name: 'Big Circle Table',
    width: 2,
    height: 2,
    defaultCapacity: 6,
    shape: 'big_circle',
    description: '2x2 Big Circle (6 Chairs)',
  },
}

export interface TableLayoutPreset {
  LAYOUT_PRESET_ID: number
  PRESET_NAME: string
  PRESET_GRID_WIDTH: number
  PRESET_GRID_HEIGHT: number
  IS_DEFAULT: boolean
  CREATED_AT?: string
  UPDATED_AT?: string
  CREATED_BY?: string | null
}

export interface TableLayoutInfo {
  INFO_ID: string
  LAYOUT_PRESET_ID: number
  TABLE_NUM: number
  MERGE_GROUP_ID: number | null
  TABLE_TYPE: TableType
  X_POS: number
  Y_POS: number
}

export interface RestaurantTableData {
  TABLE_ID: number
  TABLE_NUM: number
  STATUS: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'HAS_REQUEST' | 'UNAVAILABLE'
  GUEST_CAPACITY: number
  CURRENT_GUEST_COUNT: number
  RESERVED_SINCE: string | null
  BILL_OUT_REQUESTED: boolean
  MERGE_GROUP_ID: number | null
}

export interface MergedTableNode extends TableLayoutInfo {
  // Live status merged from Restaurant_Tables
  STATUS?: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'HAS_REQUEST' | 'UNAVAILABLE'
  CURRENT_GUEST_COUNT?: number
  GUEST_CAPACITY?: number
  BILL_OUT_REQUESTED?: boolean
  TABLE_ID?: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Preset Operations
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// Preset Operations
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchAllLayoutPresets(): Promise<TableLayoutPreset[]> {
  const { data, error } = await supabase
    .schema('tables')
    .from('Table_Layout_Presets')
    .select('*')
    .order('LAYOUT_PRESET_ID', { ascending: true })

  if (error) {
    console.error('[tableLayoutService] Error fetching presets:', error)
    return []
  }
  return data ?? []
}

export async function fetchDefaultOrFirstPreset(): Promise<TableLayoutPreset | null> {
  const presets = await fetchAllLayoutPresets()
  if (presets.length === 0) return null
  const defaultPreset = presets.find((p) => p.IS_DEFAULT)
  return defaultPreset ?? presets[0]
}

export async function createLayoutPreset(
  name: string,
  gridWidth: number = 20,
  gridHeight: number = 16,
  isDefault: boolean = false,
): Promise<TableLayoutPreset> {
  if (isDefault) {
    // Clear other default flags first
    try {
      await supabase
        .schema('tables')
        .from('Table_Layout_Presets')
        .update({ IS_DEFAULT: false })
        .neq('LAYOUT_PRESET_ID', 0)
    } catch {
      // Ignore
    }
  }

  const { data, error } = await supabase
    .schema('tables')
    .from('Table_Layout_Presets')
    .insert({
      PRESET_NAME: name,
      PRESET_GRID_WIDTH: gridWidth,
      PRESET_GRID_HEIGHT: gridHeight,
      IS_DEFAULT: isDefault,
      CREATED_AT: new Date().toISOString(),
      UPDATED_AT: new Date().toISOString(),
    })
    .select('*')
    .single()

  if (error) {
    console.error('[tableLayoutService] Error creating preset:', error)
    throw error
  }
  return data
}

export async function setDefaultLayoutPreset(presetId: number): Promise<void> {
  // 1. Reset all to false
  try {
    await supabase
      .schema('tables')
      .from('Table_Layout_Presets')
      .update({ IS_DEFAULT: false })
      .neq('LAYOUT_PRESET_ID', 0)
  } catch {
    // Ignore
  }

  // 2. Set chosen preset as default
  const { error } = await supabase
    .schema('tables')
    .from('Table_Layout_Presets')
    .update({ IS_DEFAULT: true, UPDATED_AT: new Date().toISOString() })
    .eq('LAYOUT_PRESET_ID', presetId)

  if (error) {
    console.warn('[tableLayoutService] Error setting default layout preset:', error)
  }

  // 3. Synchronize Restaurant_Tables with this preset's tables
  try {
    const layoutTables = await fetchPresetLayout(presetId)
    if (layoutTables.length > 0) {
      await savePresetLayout(presetId, layoutTables)
    }
  } catch (err) {
    console.warn('[tableLayoutService] Error applying layout tables on setDefaultLayoutPreset:', err)
  }
}

export async function updateLayoutPresetName(presetId: number, name: string): Promise<void> {
  const { error } = await supabase
    .schema('tables')
    .from('Table_Layout_Presets')
    .update({ PRESET_NAME: name, UPDATED_AT: new Date().toISOString() })
    .eq('LAYOUT_PRESET_ID', presetId)

  if (error) {
    console.error('[tableLayoutService] Error updating preset name:', error)
  }
}

export async function deleteLayoutPreset(presetId: number): Promise<void> {
  // First delete associated layout info
  try {
    await supabase
      .schema('tables')
      .from('Table_Layout_Info')
      .delete()
      .eq('LAYOUT_PRESET_ID', presetId)
  } catch {
    // Ignore
  }

  const { error } = await supabase
    .schema('tables')
    .from('Table_Layout_Presets')
    .delete()
    .eq('LAYOUT_PRESET_ID', presetId)

  if (error) {
    console.error('[tableLayoutService] Error deleting preset:', error)
  }
}

export async function updateLayoutPresetDimensions(
  presetId: number,
  gridWidth: number,
  gridHeight: number,
): Promise<void> {
  const { error } = await supabase
    .schema('tables')
    .from('Table_Layout_Presets')
    .update({
      PRESET_GRID_WIDTH: gridWidth,
      PRESET_GRID_HEIGHT: gridHeight,
      UPDATED_AT: new Date().toISOString(),
    })
    .eq('LAYOUT_PRESET_ID', presetId)

  if (error) {
    console.error('[tableLayoutService] Error updating preset dimensions:', error)
  }
}

export async function updateTableCapacity(
  tableNum: number,
  capacity: number,
): Promise<void> {
  const { error } = await supabase
    .schema('tables')
    .from('Restaurant_Tables')
    .update({ GUEST_CAPACITY: capacity })
    .eq('TABLE_NUM', tableNum)

  if (error) {
    console.error('[tableLayoutService] Error updating table capacity:', error)
    throw error
  }
}

export async function updateTableStatus(
  tableNum: number,
  status: RestaurantTableData['STATUS'],
): Promise<void> {
  const { error } = await supabase
    .schema('tables')
    .from('Restaurant_Tables')
    .update({ STATUS: status })
    .eq('TABLE_NUM', tableNum)

  if (error) {
    console.error('[tableLayoutService] Error updating table status:', error)
    throw error
  }
}

export async function updateTableGuestCount(
  tableNum: number,
  guestCount: number,
): Promise<void> {
  const { error } = await supabase
    .schema('tables')
    .from('Restaurant_Tables')
    .update({ CURRENT_GUEST_COUNT: guestCount })
    .eq('TABLE_NUM', tableNum)

  if (error) {
    console.error('[tableLayoutService] Error updating table guest count:', error)
    throw error
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Layout Info & Restaurant Tables Operations
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchPresetLayout(presetId: number): Promise<TableLayoutInfo[]> {
  const { data, error } = await supabase
    .schema('tables')
    .from('Table_Layout_Info')
    .select('*')
    .eq('LAYOUT_PRESET_ID', presetId)
    .order('TABLE_NUM', { ascending: true })

  if (error) {
    console.error('[tableLayoutService] Error fetching layout info:', error)
    return []
  }

  return (data ?? []).map((row: any) => ({
    INFO_ID: String(row.INFO_ID),
    LAYOUT_PRESET_ID: Number(row.LAYOUT_PRESET_ID),
    TABLE_NUM: Number(row.TABLE_NUM),
    MERGE_GROUP_ID: row.MERGE_GROUP_ID != null ? Number(row.MERGE_GROUP_ID) : null,
    TABLE_TYPE: Number(row.TABLE_TYPE) as TableType,
    X_POS: Number(row.X_POS),
    Y_POS: Number(row.Y_POS),
  }))
}

export async function fetchLiveRestaurantTables(): Promise<RestaurantTableData[]> {
  const { data, error } = await supabase
    .schema('tables')
    .from('Restaurant_Tables')
    .select('*')
    .order('TABLE_NUM', { ascending: true })

  if (error) {
    console.error('[tableLayoutService] Error fetching restaurant tables:', error)
    return []
  }

  return (data ?? []).map((row: any) => ({
    TABLE_ID: Number(row.TABLE_ID),
    TABLE_NUM: Number(row.TABLE_NUM),
    STATUS: (row.STATUS || 'AVAILABLE') as RestaurantTableData['STATUS'],
    GUEST_CAPACITY: Number(row.GUEST_CAPACITY || 0),
    CURRENT_GUEST_COUNT: Number(row.CURRENT_GUEST_COUNT || 0),
    RESERVED_SINCE: row.RESERVED_SINCE ? String(row.RESERVED_SINCE) : null,
    BILL_OUT_REQUESTED: Boolean(row.BILL_OUT_REQUESTED),
    MERGE_GROUP_ID: row.MERGE_GROUP_ID != null ? Number(row.MERGE_GROUP_ID) : null,
  }))
}

/**
 * Saves all layout tables for a preset into Table_Layout_Info
 * and synchronizes corresponding rows in Restaurant_Tables (tables schema).
 */
export async function savePresetLayout(
  presetId: number,
  tables: TableLayoutInfo[],
  tableCapacities?: Map<number, number>,
): Promise<void> {
  // 1. Clear existing layout info for this preset
  try {
    await supabase
      .schema('tables')
      .from('Table_Layout_Info')
      .delete()
      .eq('LAYOUT_PRESET_ID', presetId)
  } catch {
    // Ignore
  }

  // 2. Insert new layout info if any
  if (tables.length > 0) {
    const rowsToInsert = tables.map((t, idx) => ({
      INFO_ID: t.INFO_ID || `layout-info-${presetId}-${t.TABLE_NUM}-${Date.now()}-${idx}`,
      LAYOUT_PRESET_ID: presetId,
      TABLE_NUM: t.TABLE_NUM,
      MERGE_GROUP_ID: t.MERGE_GROUP_ID ?? null,
      TABLE_TYPE: t.TABLE_TYPE,
      X_POS: t.X_POS,
      Y_POS: t.Y_POS,
    }))

    const { error: insError } = await supabase
      .schema('tables')
      .from('Table_Layout_Info')
      .insert(rowsToInsert)

    if (insError) {
      console.warn('[tableLayoutService] Error inserting Table_Layout_Info:', insError)
    }
  }

  // 3. Update preset timestamp
  try {
    await supabase
      .schema('tables')
      .from('Table_Layout_Presets')
      .update({ UPDATED_AT: new Date().toISOString() })
      .eq('LAYOUT_PRESET_ID', presetId)
  } catch {
    // Ignore
  }

  // 4. Synchronize Restaurant_Tables in tables schema so Cashier & Service Interface reflect active tables
  try {
    const existingRestaurantTables = await fetchLiveRestaurantTables()
    const existingByNum = new Map(existingRestaurantTables.map((t) => [t.TABLE_NUM, t]))
    const newTableNums = new Set(tables.map((t) => t.TABLE_NUM))

    // A. Upsert / update active tables
    for (const t of tables) {
      const typeConfig = TABLE_TYPES[t.TABLE_TYPE] || TABLE_TYPES[1]
      const capacity = tableCapacities?.get(t.TABLE_NUM) ?? typeConfig.defaultCapacity
      const existing = existingByNum.get(t.TABLE_NUM)

      if (existing) {
        await supabase
          .schema('tables')
          .from('Restaurant_Tables')
          .update({
            GUEST_CAPACITY: capacity,
            MERGE_GROUP_ID: t.MERGE_GROUP_ID ?? null,
            LAYOUT_X: t.X_POS,
            LAYOUT_Y: t.Y_POS,
          })
          .eq('TABLE_ID', existing.TABLE_ID)
      } else {
        await supabase
          .schema('tables')
          .from('Restaurant_Tables')
          .insert({
            TABLE_NUM: t.TABLE_NUM,
            STATUS: 'AVAILABLE',
            GUEST_CAPACITY: capacity,
            CURRENT_GUEST_COUNT: 0,
            BILL_OUT_REQUESTED: false,
            MERGE_GROUP_ID: t.MERGE_GROUP_ID ?? null,
            LAYOUT_X: t.X_POS,
            LAYOUT_Y: t.Y_POS,
          })
      }
    }

    // B. Clean up removed tables that are not in the layout and currently have AVAILABLE status
    for (const existing of existingRestaurantTables) {
      if (!newTableNums.has(existing.TABLE_NUM) && existing.STATUS === 'AVAILABLE' && existing.CURRENT_GUEST_COUNT === 0) {
        try {
          await supabase
            .schema('tables')
            .from('Restaurant_Tables')
            .delete()
            .eq('TABLE_ID', existing.TABLE_ID)
        } catch {
          // Ignore
        }
      }
    }

    // C. Dispatch broadcast event for realtime inter-interface sync
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('monolith-order-update', { detail: { type: 'tables_sync', presetId } }))
    }
  } catch (err) {
    console.warn('[tableLayoutService] Notice when syncing Restaurant_Tables:', err)
  }
}
