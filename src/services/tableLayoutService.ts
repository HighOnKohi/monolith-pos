import { supabase } from '@/lib/supabase'

export type TableType = 1 | 2 | 3 | 4 | 5

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
    name: 'Rectangle Table (Horizontal)',
    width: 3,
    height: 1,
    defaultCapacity: 8,
    shape: 'rectangle',
    description: '3x1 Rectangle (8 Chairs)',
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
  5: {
    type: 5,
    name: 'Rectangle Table (Vertical)',
    width: 1,
    height: 3,
    defaultCapacity: 8,
    shape: 'rectangle',
    description: '1x3 Rectangle (8 Chairs)',
  },
}

export interface TableLayoutPreset {
  LAYOUT_PRESET_ID: number
  PRESET_NAME: string
  PRESET_GRID_WIDTH: number
  PRESET_GRID_HEIGHT: number
  IS_DEFAULT: boolean
  IS_PROTECTED?: boolean
  MAX_PAX?: number | null
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
  TABLE_CAPACITY?: number | null
  LABEL_ID?: number | null
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
  LABEL_ID?: number | null
}

export interface MergedTableNode extends TableLayoutInfo {
  // Live status merged from Restaurant_Tables
  STATUS?: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'HAS_REQUEST' | 'UNAVAILABLE'
  CURRENT_GUEST_COUNT?: number
  GUEST_CAPACITY?: number
  BILL_OUT_REQUESTED?: boolean
  TABLE_ID?: number
  LABEL_ID?: number | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Preset Operations
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Preset Operations
// ─────────────────────────────────────────────────────────────────────────────

const PRESET_MAX_PAX_STORAGE_PREFIX = 'monolith_preset_max_pax_'

function getCachedPresetMaxPax(presetId: number): number | null {
  if (typeof window === 'undefined') return null
  try {
    const val = localStorage.getItem(`${PRESET_MAX_PAX_STORAGE_PREFIX}${presetId}`)
    if (val) {
      const parsed = parseInt(val, 10)
      if (!isNaN(parsed) && parsed > 0) return parsed
    }
  } catch {
    // Ignore
  }
  return null
}

function setCachedPresetMaxPax(presetId: number, maxPax: number): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(`${PRESET_MAX_PAX_STORAGE_PREFIX}${presetId}`, String(maxPax))
  } catch {
    // Ignore
  }
}

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
  return (data ?? []).map((row: Record<string, unknown>) => {
    const id = Number(row.LAYOUT_PRESET_ID)
    const cachedPax = getCachedPresetMaxPax(id)
    const maxPax = row.MAX_PAX != null ? Number(row.MAX_PAX) : (cachedPax ?? 50)
    if (row.MAX_PAX != null) {
      setCachedPresetMaxPax(id, maxPax)
    }
    return {
      LAYOUT_PRESET_ID: id,
      PRESET_NAME: String(row.PRESET_NAME || ''),
      PRESET_GRID_WIDTH: Number(row.PRESET_GRID_WIDTH || 20),
      PRESET_GRID_HEIGHT: Number(row.PRESET_GRID_HEIGHT || 16),
      IS_DEFAULT: Boolean(row.IS_DEFAULT),
      IS_PROTECTED: Boolean(row.IS_PROTECTED),
      MAX_PAX: maxPax,
      CREATED_AT: row.CREATED_AT != null ? String(row.CREATED_AT) : undefined,
      UPDATED_AT: row.UPDATED_AT != null ? String(row.UPDATED_AT) : undefined,
      CREATED_BY: row.CREATED_BY != null ? String(row.CREATED_BY) : null,
    }
  })
}

export async function fetchDefaultOrFirstPreset(): Promise<TableLayoutPreset | null> {
  const presets = await fetchAllLayoutPresets()
  if (presets.length === 0) return null
  const defaultPreset = presets.find((p) => p.IS_DEFAULT)
  return defaultPreset ?? presets[0]
}

export async function createLayoutPreset(
  name: string,
  maxPax: number = 50,
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

  const validMaxPax = Math.max(1, Math.round(maxPax))

  // Try inserting with MAX_PAX
  try {
    const { data, error } = await supabase
      .schema('tables')
      .from('Table_Layout_Presets')
      .insert({
        PRESET_NAME: name,
        MAX_PAX: validMaxPax,
        PRESET_GRID_WIDTH: gridWidth,
        PRESET_GRID_HEIGHT: gridHeight,
        IS_DEFAULT: isDefault,
        CREATED_AT: new Date().toISOString(),
        UPDATED_AT: new Date().toISOString(),
      })
      .select('*')
      .single()

    if (!error && data) {
      const preset = {
        ...data,
        MAX_PAX: data.MAX_PAX != null ? Number(data.MAX_PAX) : validMaxPax,
      }
      setCachedPresetMaxPax(Number(preset.LAYOUT_PRESET_ID), preset.MAX_PAX)
      return preset
    }
  } catch (err) {
    console.warn('[tableLayoutService] Notice when inserting preset with MAX_PAX, trying fallback:', err)
  }

  // Fallback if MAX_PAX column is not yet migrated in database
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

  const presetId = Number(data.LAYOUT_PRESET_ID)
  setCachedPresetMaxPax(presetId, validMaxPax)
  return {
    ...data,
    MAX_PAX: validMaxPax,
  }
}

export async function updateLayoutPresetMaxPax(presetId: number, maxPax: number): Promise<void> {
  const validMaxPax = Math.max(1, Math.round(maxPax))
  setCachedPresetMaxPax(presetId, validMaxPax)

  const { error } = await supabase
    .schema('tables')
    .from('Table_Layout_Presets')
    .update({ MAX_PAX: validMaxPax, UPDATED_AT: new Date().toISOString() })
    .eq('LAYOUT_PRESET_ID', presetId)

  if (error) {
    console.warn('[tableLayoutService] Error updating preset max pax:', error)
  }

  // If layout tables exist for this preset and exceed the new max pax, resolve overflow
  try {
    const layoutTables = await fetchPresetLayout(presetId)
    if (layoutTables.length > 0) {
      const { calculateLayoutSuppression, calculateLayoutCapacity, resolveLayoutCapacityOverflow } = await import('@/utils/floorPlan/capacity')
      const suppMap = calculateLayoutSuppression(layoutTables)
      const baseCaps = new Map<number, number>()
      for (const t of layoutTables) {
        baseCaps.set(t.TABLE_NUM, t.TABLE_CAPACITY ?? TABLE_TYPES[t.TABLE_TYPE]?.defaultCapacity ?? 4)
      }
      const totalCurrent = calculateLayoutCapacity(layoutTables, suppMap, baseCaps)
      if (totalCurrent > validMaxPax) {
        const resolvedCaps = resolveLayoutCapacityOverflow(layoutTables, suppMap, baseCaps, validMaxPax)
        const updatedTables = layoutTables.map((t) => ({
          ...t,
          TABLE_CAPACITY: resolvedCaps.get(t.TABLE_NUM) ?? t.TABLE_CAPACITY,
        }))
        await savePresetLayout(presetId, updatedTables, resolvedCaps, validMaxPax)
      }
    }
  } catch (err) {
    console.warn('[tableLayoutService] Notice when resolving layout overflow on updateLayoutPresetMaxPax:', err)
  }

  // Realtime notification & broadcast across tabs and interfaces
  if (typeof window !== 'undefined') {
    const detail = { type: 'table_layout_preset_changed', presetId, maxPax: validMaxPax }
    window.dispatchEvent(new CustomEvent('table-layout-preset-changed', { detail: presetId }))
    window.dispatchEvent(new CustomEvent('monolith-order-update', { detail }))

    try {
      const bc = new BroadcastChannel('monolith_order_events')
      bc.postMessage(detail)
      bc.close()
    } catch {
      // Ignore
    }
  }
}

export async function setDefaultLayoutPreset(presetId: number): Promise<void> {
  // 1. Reset other presets to IS_DEFAULT = false
  try {
    await supabase
      .schema('tables')
      .from('Table_Layout_Presets')
      .update({ IS_DEFAULT: false })
      .neq('LAYOUT_PRESET_ID', presetId)
  } catch (err) {
    console.warn('[tableLayoutService] Notice when resetting IS_DEFAULT on Table_Layout_Presets:', err)
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
    const [layoutTables, liveTables] = await Promise.all([
      fetchPresetLayout(presetId),
      fetchLiveRestaurantTables(),
    ])
    if (layoutTables.length > 0) {
      const capacityMap = new Map<number, number>()
      for (const t of layoutTables) {
        if (t.TABLE_CAPACITY != null) {
          capacityMap.set(t.TABLE_NUM, t.TABLE_CAPACITY)
        } else {
          const r = liveTables.find((lt) => lt.TABLE_NUM === t.TABLE_NUM)
          if (r) {
            capacityMap.set(t.TABLE_NUM, r.GUEST_CAPACITY)
          }
        }
      }
      await savePresetLayout(presetId, layoutTables, capacityMap)
    }
  } catch (err) {
    console.warn('[tableLayoutService] Error applying layout tables on setDefaultLayoutPreset:', err)
  }

  // 4. Dispatch events & broadcast across tabs and devices
  if (typeof window !== 'undefined') {
    localStorage.setItem('table-active-preset-id', String(presetId))
    const detail = { type: 'table_layout_preset_changed', presetId }
    window.dispatchEvent(new CustomEvent('table-layout-preset-changed', { detail: presetId }))
    window.dispatchEvent(new CustomEvent('monolith-order-update', { detail }))

    try {
      const bc = new BroadcastChannel('monolith_order_events')
      bc.postMessage(detail)
      bc.close()
    } catch {
      // Ignore
    }

    try {
      const channel = supabase.channel('table-manager-live-sync')
      void channel.send({
        type: 'broadcast',
        event: 'table_preset_changed',
        payload: { presetId },
      })
    } catch {
      // Ignore
    }
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
  // Block deletion of protected presets (Default Layout)
  try {
    const { data: preset } = await supabase
      .schema('tables')
      .from('Table_Layout_Presets')
      .select('IS_PROTECTED')
      .eq('LAYOUT_PRESET_ID', presetId)
      .maybeSingle()

    if (preset && Boolean(preset.IS_PROTECTED)) {
      throw new Error('Cannot delete the protected Default Layout. Use admin authorization to modify it instead.')
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('Cannot delete')) throw err
    // If IS_PROTECTED column doesn't exist yet, continue with deletion
  }

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

  return (data ?? []).map((row: Record<string, unknown>) => ({
    INFO_ID: String(row.INFO_ID),
    LAYOUT_PRESET_ID: Number(row.LAYOUT_PRESET_ID),
    TABLE_NUM: Number(row.TABLE_NUM),
    MERGE_GROUP_ID: row.MERGE_GROUP_ID != null ? Number(row.MERGE_GROUP_ID) : null,
    TABLE_TYPE: Number(row.TABLE_TYPE) as TableType,
    X_POS: Number(row.X_POS),
    Y_POS: Number(row.Y_POS),
    TABLE_CAPACITY: row.TABLE_CAPACITY != null ? Number(row.TABLE_CAPACITY) : null,
    LABEL_ID: row.LABEL_ID != null ? Number(row.LABEL_ID) : null,
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

  return (data ?? []).map((row: Record<string, unknown>) => ({
    TABLE_ID: Number(row.TABLE_ID),
    TABLE_NUM: Number(row.TABLE_NUM),
    STATUS: (row.STATUS || 'AVAILABLE') as RestaurantTableData['STATUS'],
    GUEST_CAPACITY: Number(row.GUEST_CAPACITY || 0),
    CURRENT_GUEST_COUNT: Number(row.CURRENT_GUEST_COUNT || 0),
    RESERVED_SINCE: row.RESERVED_SINCE ? String(row.RESERVED_SINCE) : null,
    BILL_OUT_REQUESTED: Boolean(row.BILL_OUT_REQUESTED),
    MERGE_GROUP_ID: row.MERGE_GROUP_ID != null ? Number(row.MERGE_GROUP_ID) : null,
    LABEL_ID: row.LABEL_ID != null ? Number(row.LABEL_ID) : null,
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
  maxPax?: number,
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
      TABLE_CAPACITY: t.TABLE_CAPACITY ?? tableCapacities?.get(t.TABLE_NUM) ?? TABLE_TYPES[t.TABLE_TYPE]?.defaultCapacity ?? 4,
      LABEL_ID: t.LABEL_ID != null ? Number(t.LABEL_ID) : null,
    }))

    const { error: insError } = await supabase
      .schema('tables')
      .from('Table_Layout_Info')
      .insert(rowsToInsert)

    if (insError) {
      console.warn('[tableLayoutService] Notice when inserting Table_Layout_Info with TABLE_CAPACITY, trying fallback:', insError)
      // Fallback without TABLE_CAPACITY if column does not exist yet
      const fallbackRows = rowsToInsert.map((row) => {
        const copy: Record<string, unknown> = { ...row }
        delete copy.TABLE_CAPACITY
        return copy
      })
      await supabase
        .schema('tables')
        .from('Table_Layout_Info')
        .insert(fallbackRows)
    }
  }

  // 3. Update preset timestamp and MAX_PAX if provided
  try {
    const updatePayload: Record<string, unknown> = { UPDATED_AT: new Date().toISOString() }
    if (maxPax != null && maxPax > 0) {
      updatePayload.MAX_PAX = Math.round(maxPax)
    }
    await supabase
      .schema('tables')
      .from('Table_Layout_Presets')
      .update(updatePayload)
      .eq('LAYOUT_PRESET_ID', presetId)
  } catch {
    // Ignore
  }

  // 4. Synchronize Restaurant_Tables in tables schema so Cashier & Service Interface reflect active tables
  try {
    const existingRestaurantTables = await fetchLiveRestaurantTables()
    const existingByNum = new Map(existingRestaurantTables.map((t) => [t.TABLE_NUM, t]))
    const newTableNums = new Set(tables.map((t) => t.TABLE_NUM))

    // Determine effective venue cap
    let effectiveVenueCap = maxPax
    if (!effectiveVenueCap || effectiveVenueCap <= 0) {
      try {
        const { data: presetData } = await supabase
          .schema('tables')
          .from('Table_Layout_Presets')
          .select('MAX_PAX')
          .eq('LAYOUT_PRESET_ID', presetId)
          .single()
        if (presetData?.MAX_PAX) {
          effectiveVenueCap = Number(presetData.MAX_PAX)
        }
      } catch {
        // Ignore
      }
    }
    const VENUE_CAP = effectiveVenueCap && effectiveVenueCap > 0 ? effectiveVenueCap : 50

    // A. Pass 1: Calculate target capacities & clamp strictly to dynamic VENUE_CAP
    const targetCapacities = new Map<number, number>()
    for (const t of tables) {
      const typeConfig = TABLE_TYPES[t.TABLE_TYPE] || TABLE_TYPES[1]
      const existing = existingByNum.get(t.TABLE_NUM)
      const cap = t.TABLE_CAPACITY ?? tableCapacities?.get(t.TABLE_NUM) ?? existing?.GUEST_CAPACITY ?? typeConfig.defaultCapacity
      targetCapacities.set(t.TABLE_NUM, Math.max(1, cap))
    }

    // Enforce max venue capacity limit across layout
    let totalCap = Array.from(targetCapacities.values()).reduce((sum, c) => sum + c, 0)
    if (totalCap > VENUE_CAP) {
      const tableNums = Array.from(targetCapacities.keys())
      for (let i = tableNums.length - 1; i >= 0 && totalCap > VENUE_CAP; i--) {
        const num = tableNums[i]
        const currentCap = targetCapacities.get(num)!
        const canReduce = currentCap - 1
        const excess = totalCap - VENUE_CAP
        const reduction = Math.min(excess, canReduce)
        if (reduction > 0) {
          targetCapacities.set(num, currentCap - reduction)
          totalCap -= reduction
        }
      }
    }

    // Upsert / update active tables (capacities & layout coordinates)
    for (const t of tables) {
      const capacity = targetCapacities.get(t.TABLE_NUM) ?? 4
      const existing = existingByNum.get(t.TABLE_NUM)

      if (existing) {
        const { error: updErr } = await supabase
          .schema('tables')
          .from('Restaurant_Tables')
          .update({
            GUEST_CAPACITY: capacity,
          })
          .eq('TABLE_ID', existing.TABLE_ID)

        if (updErr) {
          console.warn('[tableLayoutService] Error updating table capacity:', existing.TABLE_ID, updErr)
        }
      } else {
        const { error: insErr } = await supabase
          .schema('tables')
          .from('Restaurant_Tables')
          .insert({
            TABLE_NUM: t.TABLE_NUM,
            STATUS: 'AVAILABLE',
            GUEST_CAPACITY: capacity,
            CURRENT_GUEST_COUNT: 0,
            BILL_OUT_REQUESTED: false,
            MERGE_GROUP_ID: null,
          })

        if (insErr) {
          console.warn('[tableLayoutService] Error inserting table:', t.TABLE_NUM, insErr)
        }
      }
    }

    // B. Pass 2: Fetch latest live tables to obtain verified TABLE_IDs and persist MERGE_GROUP_ID
    const updatedLiveTables = await fetchLiveRestaurantTables()
    const liveByNum = new Map(updatedLiveTables.map((t) => [t.TABLE_NUM, t]))

    for (const t of tables) {
      const liveCurrent = liveByNum.get(t.TABLE_NUM)
      if (!liveCurrent) continue

      let targetMergeId: number | null = null
      if (t.MERGE_GROUP_ID != null) {
        const anchor = liveByNum.get(t.MERGE_GROUP_ID)
        // Secondary tables reference the primary anchor's TABLE_ID.
        // Primary anchor table sets MERGE_GROUP_ID to null (per migration 007 conventions)
        if (anchor && anchor.TABLE_NUM !== t.TABLE_NUM) {
          targetMergeId = anchor.TABLE_ID
        } else {
          targetMergeId = null
        }
      }

      const { error: mergeErr } = await supabase
        .schema('tables')
        .from('Restaurant_Tables')
        .update({
          MERGE_GROUP_ID: targetMergeId,
        })
        .eq('TABLE_ID', liveCurrent.TABLE_ID)

      if (mergeErr) {
        console.warn('[tableLayoutService] Error updating MERGE_GROUP_ID for table:', liveCurrent.TABLE_ID, mergeErr)
      }
    }

    // C. Clean up removed tables that are not in the layout, protecting tables with active reservations or orders
    let reservedTableIds = new Set<number>()
    try {
      const { data: reservations } = await supabase
        .schema('tables')
        .from('Table_Reservations')
        .select('TABLE_ID')
        .in('STATUS', ['CONFIRMED', 'PENDING'])
      reservedTableIds = new Set((reservations ?? []).map((r: Record<string, unknown>) => Number(r.TABLE_ID)))
    } catch {
      // Ignore
    }

    let activeOrderTableNums = new Set<number>()
    try {
      const { data: activeOrders } = await supabase
        .from('Orders')
        .select('TABLE_NUM, ORDER_STATUS')
        .in('ORDER_STATUS', ['PENDING', 'PREPARING', 'READY', 'SERVED'])
      if (activeOrders) {
        activeOrderTableNums = new Set(
          activeOrders
            .map((o: Record<string, unknown>) => (o.TABLE_NUM != null ? Number(o.TABLE_NUM) : null))
            .filter((n: number | null): n is number => n !== null && !isNaN(n)),
        )
      }
    } catch {
      // Ignore
    }

    for (const existing of updatedLiveTables) {
      const isReferencedInLayout = newTableNums.has(existing.TABLE_NUM)
      const isReserved = reservedTableIds.has(existing.TABLE_ID)
      const hasActiveGuests = existing.CURRENT_GUEST_COUNT > 0
      const hasActiveOrders = activeOrderTableNums.has(existing.TABLE_NUM)
      const isAvailable = existing.STATUS === 'AVAILABLE'

      if (!isReferencedInLayout) {
        if (isAvailable && !hasActiveGuests && !isReserved && !hasActiveOrders) {
          try {
            await supabase
              .schema('tables')
              .from('Restaurant_Tables')
              .delete()
              .eq('TABLE_ID', existing.TABLE_ID)
          } catch {
            // Ignore
          }
        } else {
          console.warn(
            `[tableLayoutService] Table #${existing.TABLE_NUM} has active operational state (guests=${hasActiveGuests}, reserved=${isReserved}, orders=${hasActiveOrders}) but is not in target layout. Retained for manual resolution.`,
          )
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('monolith-table-conflict', {
                detail: {
                  tableNum: existing.TABLE_NUM,
                  tableId: existing.TABLE_ID,
                  hasActiveOrders,
                  hasActiveGuests,
                  isReserved,
                },
              }),
            )
          }
        }
      }
    }

    // D. Dispatch broadcast event for realtime inter-interface sync
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('monolith-order-update', { detail: { type: 'tables_sync', presetId } }))
    }
  } catch (err) {
    console.warn('[tableLayoutService] Notice when syncing Restaurant_Tables:', err)
  }
}
