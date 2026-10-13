import { supabase } from '@/lib/supabase'
import { sequentializeLayoutTables } from '@/utils/floorPlan/adjacency'

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

export const DEFAULT_GRID_WIDTH = 17
export const DEFAULT_GRID_HEIGHT = 11
export const GRID_MARGIN_BLOCKS = 0.5
export const TOTAL_GRID_WIDTH_BLOCKS = 18
export const TOTAL_GRID_HEIGHT_BLOCKS = 12

export interface TableLayoutPreset {
  LAYOUT_PRESET_ID: number
  PRESET_NAME: string
  PRESET_GRID_WIDTH?: number
  PRESET_GRID_HEIGHT?: number
  IS_DEFAULT: boolean
  IS_ACTIVE: boolean
  IS_PROTECTED?: boolean
  MAX_PAX?: number | null
  TABLE_IDS: number[]
  CREATED_AT?: string
  UPDATED_AT?: string
  CREATED_BY?: string | null
}

export interface TableLayoutInfo {
  INFO_ID: string
  TABLE_ID?: number
  LAYOUT_PRESET_ID: number
  TABLE_NUM: number
  MERGE_GROUP_ID: number | null
  TABLE_TYPE: TableType
  X_POS: number
  Y_POS: number
  TABLE_CAPACITY?: number | null
  SEAT_CAPACITY?: number | null
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
  MERGE_PERSISTENCY?: 'TEMPORARY' | 'CONTINOUOUS' | null
  OCCUPIED_SINCE?: string | null
  RESERVATION_ID?: number | null
  LABEL_ID?: number | null
  // Reservation fields joined from Table_Reservations
  RESERVATION_NAME?: string | null
  RESERVATION_PAX?: number | null
  RESERVATION_NOTES?: string | null
  RESERVATION_TIME_LIMIT?: string | null
  RESERVATION_PHONE_NUMBER?: string | null
}

export interface MergedTableNode extends TableLayoutInfo {
  // Live status merged from Active_Tables
  STATUS?: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'HAS_REQUEST' | 'UNAVAILABLE'
  CURRENT_GUEST_COUNT?: number
  GUEST_CAPACITY?: number
  BILL_OUT_REQUESTED?: boolean
  MERGE_PERSISTENCY?: 'TEMPORARY' | 'CONTINOUOUS' | null
  OCCUPIED_SINCE?: string | null
  RESERVATION_ID?: number | null
  LABEL_ID?: number | null
  RESERVATION_NAME?: string | null
  RESERVATION_PAX?: number | null
  RESERVATION_NOTES?: string | null
  RESERVATION_TIME_LIMIT?: string | null
  RESERVATION_PHONE_NUMBER?: string | null
  RESERVED_SINCE?: string | null
}

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

    const tableIds: number[] = Array.isArray(row.TABLE_IDS)
      ? (row.TABLE_IDS as unknown[]).map(Number).filter((n) => !isNaN(n))
      : []

    const isActive = Boolean(row.IS_ACTIVE)

    return {
      LAYOUT_PRESET_ID: id,
      PRESET_NAME: String(row.PRESET_NAME || ''),
      PRESET_GRID_WIDTH: Number((row as Record<string, unknown>).PRESET_GRID_WIDTH || DEFAULT_GRID_WIDTH),
      PRESET_GRID_HEIGHT: Number((row as Record<string, unknown>).PRESET_GRID_HEIGHT || DEFAULT_GRID_HEIGHT),
      IS_DEFAULT: isActive,
      IS_ACTIVE: isActive,
      IS_PROTECTED: Boolean(row.IS_PROTECTED),
      MAX_PAX: maxPax,
      TABLE_IDS: tableIds,
      CREATED_AT: row.CREATED_AT != null ? String(row.CREATED_AT) : undefined,
      UPDATED_AT: row.UPDATED_AT != null ? String(row.UPDATED_AT) : undefined,
      CREATED_BY: row.CREATED_BY != null ? String(row.CREATED_BY) : null,
    }
  })
}

export async function fetchDefaultOrFirstPreset(): Promise<TableLayoutPreset | null> {
  const presets = await fetchAllLayoutPresets()
  if (presets.length === 0) return null
  const activePreset = presets.find((p) => p.IS_ACTIVE)
  return activePreset ?? presets[0]
}

export async function createLayoutPreset(
  name: string,
  maxPax: number = 50,
  _gridWidth: number = DEFAULT_GRID_WIDTH,
  _gridHeight: number = DEFAULT_GRID_HEIGHT,
  isActive: boolean = false,
): Promise<TableLayoutPreset> {
  if (isActive) {
    try {
      await supabase
        .schema('tables')
        .from('Table_Layout_Presets')
        .update({ IS_ACTIVE: false })
        .neq('LAYOUT_PRESET_ID', 0)
    } catch {
      // Ignore
    }
  }

  const validMaxPax = Math.max(1, Math.round(maxPax))

  const { data, error } = await supabase
    .schema('tables')
    .from('Table_Layout_Presets')
    .insert({
      PRESET_NAME: name,
      MAX_PAX: validMaxPax,
      IS_ACTIVE: isActive,
      TABLE_IDS: [],
      CREATED_AT: new Date().toISOString(),
      UPDATED_AT: new Date().toISOString(),
    })
    .select('*')
    .single()

  if (error || !data) {
    console.error('[tableLayoutService] Error creating preset:', error)
    throw error ?? new Error('Failed to create preset.')
  }

  const presetId = Number(data.LAYOUT_PRESET_ID)
  setCachedPresetMaxPax(presetId, validMaxPax)

  const createdPreset: TableLayoutPreset = {
    LAYOUT_PRESET_ID: presetId,
    PRESET_NAME: String(data.PRESET_NAME || name),
    PRESET_GRID_WIDTH: DEFAULT_GRID_WIDTH,
    PRESET_GRID_HEIGHT: DEFAULT_GRID_HEIGHT,
    IS_DEFAULT: isActive,
    IS_ACTIVE: isActive,
    MAX_PAX: validMaxPax,
    TABLE_IDS: [],
    CREATED_AT: String(data.CREATED_AT),
    UPDATED_AT: String(data.UPDATED_AT),
  }

  if (isActive) {
    await populateActiveTablesForPreset(presetId)
  }

  return createdPreset
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

/**
 * Synchronize Active_Tables with the selected preset's TABLE_IDS array.
 * When a preset is selected / active:
 * - Table IDs in TABLE_IDS populate Active_Tables.
 * - Tables not in TABLE_IDS that have no active operational orders/guests are pruned.
 */
export async function populateActiveTablesForPreset(presetId: number): Promise<void> {
  const { data: preset, error: pErr } = await supabase
    .schema('tables')
    .from('Table_Layout_Presets')
    .select('LAYOUT_PRESET_ID, TABLE_IDS, IS_ACTIVE')
    .eq('LAYOUT_PRESET_ID', presetId)
    .single()

  if (pErr || !preset) {
    console.error('[tableLayoutService] Preset not found when populating active tables:', pErr)
    return
  }

  const targetTableIds: number[] = Array.isArray(preset.TABLE_IDS)
    ? (preset.TABLE_IDS as unknown[]).map(Number).filter((n) => !isNaN(n))
    : []

  const targetIdSet = new Set(targetTableIds)

  // 1. Fetch current Active_Tables
  const { data: currentActive } = await supabase
    .schema('tables')
    .from('Active_Tables')
    .select('*')

  const activeRows = (currentActive ?? []) as Array<Record<string, unknown>>
  const activeIdSet = new Set(activeRows.map((r) => Number(r.TABLE_ID)))

  // 2. Fetch active orders from Restaurant_Orders to avoid pruning tables in progress
  let activeOrderTableIds = new Set<number>()
  try {
    const { data: activeOrders } = await supabase
      .from('Restaurant_Orders')
      .select('TABLE_ID')
      .in('ORDER_STATUS', ['REQUESTED', 'VERIFIED', 'PREPARING', 'READY', 'SERVED'])
    if (activeOrders) {
      activeOrderTableIds = new Set(activeOrders.map((o) => Number(o.TABLE_ID)))
    }
  } catch {
    // Non-fatal
  }

  // 3. Remove tables in Active_Tables that are not in target layout
  for (const row of activeRows) {
    const tId = Number(row.TABLE_ID)
    if (!targetIdSet.has(tId)) {
      const hasGuests = Number(row.SEATED_GUEST_COUNT || 0) > 0
      const hasOrders = activeOrderTableIds.has(tId)
      const hasReservation = row.RESERVATION_ID != null
      const isAvailable = row.STATUS === 'AVAILABLE'

      if (isAvailable && !hasGuests && !hasOrders && !hasReservation) {
        await supabase
          .schema('tables')
          .from('Active_Tables')
          .delete()
          .eq('TABLE_ID', tId)
      } else {
        console.warn(
          `[tableLayoutService] Table ID ${tId} is active in operations (guests=${hasGuests}, orders=${hasOrders}, reserved=${hasReservation}) but removed from preset. Kept in Active_Tables until settled.`,
        )
      }
    }
  }

  // 4. Insert newly activated tables that are not yet in Active_Tables
  const toAddIds = targetTableIds.filter((id) => !activeIdSet.has(id))
  if (toAddIds.length > 0) {
    // Get label information from Table_Info
    const { data: infoRows } = await supabase
      .schema('tables')
      .from('Table_Info')
      .select('TABLE_ID, LABEL_ID')
      .in('TABLE_ID', toAddIds)

    const labelMap = new Map((infoRows ?? []).map((r) => [Number(r.TABLE_ID), r.LABEL_ID]))

    const rowsToInsert = toAddIds.map((tId) => ({
      TABLE_ID: tId,
      STATUS: 'AVAILABLE',
      SEATED_GUEST_COUNT: 0,
      BILL_OUT_REQUESTED: false,
      MERGE_GROUP_ID: null,
      LABEL_ID: labelMap.get(tId) != null ? Number(labelMap.get(tId)) : null,
      MERGE_PERSISTENCY: 'TEMPORARY',
      OCCUPIED_SINCE: null,
      RESERVATION_ID: null,
    }))

    const { error: insErr } = await supabase
      .schema('tables')
      .from('Active_Tables')
      .insert(rowsToInsert)

    if (insErr) {
      console.warn('[tableLayoutService] Error inserting into Active_Tables:', insErr)
    }
  }
}

export async function setActiveLayoutPreset(presetId: number): Promise<void> {
  // 1. Reset other presets
  try {
    await supabase
      .schema('tables')
      .from('Table_Layout_Presets')
      .update({ IS_ACTIVE: false, UPDATED_AT: new Date().toISOString() })
      .neq('LAYOUT_PRESET_ID', presetId)
  } catch (err) {
    console.warn('[tableLayoutService] Notice resetting IS_ACTIVE on Table_Layout_Presets:', err)
  }

  // 2. Set target preset as active
  const { error } = await supabase
    .schema('tables')
    .from('Table_Layout_Presets')
    .update({ IS_ACTIVE: true, UPDATED_AT: new Date().toISOString() })
    .eq('LAYOUT_PRESET_ID', presetId)

  if (error) {
    console.warn('[tableLayoutService] Error setting active layout preset:', error)
  }

  // 3. Populate Active_Tables with this preset's TABLE_IDS
  await populateActiveTablesForPreset(presetId)

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

/** Backward compatibility alias for setActiveLayoutPreset */
export const setDefaultLayoutPreset = setActiveLayoutPreset

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
  // Block deletion of protected presets
  try {
    const { data: preset } = await supabase
      .schema('tables')
      .from('Table_Layout_Presets')
      .select('IS_PROTECTED')
      .eq('LAYOUT_PRESET_ID', presetId)
      .maybeSingle()

    if (preset && Boolean(preset.IS_PROTECTED)) {
      throw new Error('Cannot delete the protected Default Layout.')
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('Cannot delete')) throw err
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
  _presetId: number,
  _gridWidth: number,
  _gridHeight: number,
): Promise<void> {
  // Schema no longer stores grid dimensions in presets table
}

export async function syncAllLayoutPresetsToDefaultGridSize(): Promise<void> {
  // No-op for new schema
}

export async function updateTableCapacity(
  tableNum: number,
  capacity: number,
): Promise<void> {
  const { error } = await supabase
    .schema('tables')
    .from('Table_Info')
    .update({ SEAT_CAPACITY: capacity })
    .eq('TABLE_NUM', tableNum)

  if (error) {
    console.error('[tableLayoutService] Error updating table capacity in Table_Info:', error)
    throw error
  }
}

export async function updateTableStatus(
  tableNum: number,
  status: RestaurantTableData['STATUS'],
): Promise<void> {
  // Find table_id from Table_Info
  const { data: tInfo } = await supabase
    .schema('tables')
    .from('Table_Info')
    .select('TABLE_ID')
    .eq('TABLE_NUM', tableNum)
    .maybeSingle()

  const tableId = tInfo?.TABLE_ID ?? tableNum

  const payload: Record<string, unknown> = { STATUS: status }
  if (status === 'OCCUPIED') {
    payload.OCCUPIED_SINCE = new Date().toISOString()
  } else if (status === 'AVAILABLE') {
    payload.OCCUPIED_SINCE = null
    payload.SEATED_GUEST_COUNT = 0
    payload.BILL_OUT_REQUESTED = false
  }

  const { error } = await supabase
    .schema('tables')
    .from('Active_Tables')
    .update(payload)
    .eq('TABLE_ID', tableId)

  if (error) {
    console.error('[tableLayoutService] Error updating table status in Active_Tables:', error)
    throw error
  }
}

export async function updateTableGuestCount(
  tableNum: number,
  guestCount: number,
): Promise<void> {
  // Find table_id from Table_Info
  const { data: tInfo } = await supabase
    .schema('tables')
    .from('Table_Info')
    .select('TABLE_ID')
    .eq('TABLE_NUM', tableNum)
    .maybeSingle()

  const tableId = tInfo?.TABLE_ID ?? tableNum

  const { data: current } = await supabase
    .schema('tables')
    .from('Active_Tables')
    .select('TABLE_ID, MERGE_GROUP_ID, STATUS')
    .eq('TABLE_ID', tableId)
    .maybeSingle()

  if (current) {
    const anchorId = current.MERGE_GROUP_ID ?? current.TABLE_ID
    const { data: members } = await supabase
      .schema('tables')
      .from('Active_Tables')
      .select('TABLE_ID')
      .or(`TABLE_ID.eq.${anchorId},MERGE_GROUP_ID.eq.${anchorId}`)

    const targetIds = members && members.length > 0
      ? members.map((m) => Number(m.TABLE_ID))
      : [current.TABLE_ID]

    const updatePayload: Record<string, unknown> = { SEATED_GUEST_COUNT: guestCount }
    if (guestCount > 0 && (current.STATUS === 'AVAILABLE' || current.STATUS === 'RESERVED')) {
      updatePayload.STATUS = 'OCCUPIED'
      updatePayload.OCCUPIED_SINCE = new Date().toISOString()
    } else if (guestCount === 0 && current.STATUS !== 'AVAILABLE') {
      updatePayload.STATUS = 'AVAILABLE'
      updatePayload.OCCUPIED_SINCE = null
      updatePayload.BILL_OUT_REQUESTED = false
    }

    const { error } = await supabase
      .schema('tables')
      .from('Active_Tables')
      .update(updatePayload)
      .in('TABLE_ID', targetIds)

    if (error) {
      console.error('[tableLayoutService] Error updating table guest count in Active_Tables:', error)
      throw error
    }
    return
  }

  const { error } = await supabase
    .schema('tables')
    .from('Active_Tables')
    .update({ SEATED_GUEST_COUNT: guestCount })
    .eq('TABLE_ID', tableId)

  if (error) {
    console.error('[tableLayoutService] Error updating table guest count in Active_Tables:', error)
    throw error
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Layout Info & Active Tables Operations
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchPresetLayout(presetId: number): Promise<TableLayoutInfo[]> {
  // 1. Fetch preset to get TABLE_IDS
  const { data: preset, error: pErr } = await supabase
    .schema('tables')
    .from('Table_Layout_Presets')
    .select('LAYOUT_PRESET_ID, TABLE_IDS')
    .eq('LAYOUT_PRESET_ID', presetId)
    .maybeSingle()

  if (pErr || !preset) {
    console.error('[tableLayoutService] Error fetching preset for layout:', pErr)
    return []
  }

  const tableIds: number[] = Array.isArray(preset.TABLE_IDS)
    ? (preset.TABLE_IDS as unknown[]).map(Number).filter((n) => !isNaN(n))
    : []

  if (tableIds.length === 0) {
    return []
  }

  // 2. Fetch corresponding Table_Info rows
  const [{ data: infoRows, error: infoErr }, { data: activeRows }] = await Promise.all([
    supabase
      .schema('tables')
      .from('Table_Info')
      .select('*')
      .in('TABLE_ID', tableIds)
      .order('TABLE_NUM', { ascending: true }),
    supabase
      .schema('tables')
      .from('Active_Tables')
      .select('TABLE_ID, MERGE_GROUP_ID, LABEL_ID')
      .in('TABLE_ID', tableIds),
  ])

  if (infoErr) {
    console.error('[tableLayoutService] Error fetching Table_Info:', infoErr)
    return []
  }

  const activeMap = new Map((activeRows ?? []).map((a) => [Number(a.TABLE_ID), a]))

  const captainIds = new Set<number>()
  for (const a of activeRows ?? []) {
    if (a.MERGE_GROUP_ID != null) {
      captainIds.add(Number(a.MERGE_GROUP_ID))
    }
  }

  const tableIdToNumMap = new Map((infoRows ?? []).map((r) => [Number(r.TABLE_ID), Number(r.TABLE_NUM)]))

  const rawTables: TableLayoutInfo[] = (infoRows ?? []).map((row: Record<string, unknown>) => {
    const tableId = Number(row.TABLE_ID)
    const active = activeMap.get(tableId)
    const capacity = row.SEAT_CAPACITY != null ? Number(row.SEAT_CAPACITY) : 4

    let mergeGroupId: number | null = null
    if (active?.MERGE_GROUP_ID != null) {
      const capId = Number(active.MERGE_GROUP_ID)
      mergeGroupId = tableIdToNumMap.get(capId) ?? capId
    } else if (captainIds.has(tableId)) {
      mergeGroupId = Number(row.TABLE_NUM)
    }

    return {
      INFO_ID: String(tableId),
      TABLE_ID: tableId,
      LAYOUT_PRESET_ID: presetId,
      TABLE_NUM: Number(row.TABLE_NUM),
      MERGE_GROUP_ID: mergeGroupId,
      TABLE_TYPE: (Number(row.TABLE_TYPE) || 1) as TableType,
      X_POS: Number(row.X_POS ?? 0),
      Y_POS: Number(row.Y_POS ?? 0),
      TABLE_CAPACITY: capacity,
      SEAT_CAPACITY: capacity,
      LABEL_ID: active?.LABEL_ID != null ? Number(active.LABEL_ID) : (row.LABEL_ID != null ? Number(row.LABEL_ID) : null),
    }
  })

  return sequentializeLayoutTables(rawTables)
}

export async function fetchLiveRestaurantTables(): Promise<RestaurantTableData[]> {
  const [{ data: activeData, error: activeErr }, { data: allInfo }, { data: reservations }] = await Promise.all([
    supabase
      .schema('tables')
      .from('Active_Tables')
      .select('*'),
    supabase
      .schema('tables')
      .from('Table_Info')
      .select('*'),
    supabase
      .schema('tables')
      .from('Table_Reservations')
      .select('*'),
  ])

  if (activeErr) {
    console.error('[tableLayoutService] Error fetching Active_Tables:', activeErr)
    return []
  }

  const infoMap = new Map((allInfo ?? []).map((i) => [Number(i.TABLE_ID), i]))
  const resMap = new Map((reservations ?? []).map((r) => [Number(r.TABLE_ID), r]))

  const result: RestaurantTableData[] = (activeData ?? []).map((row: Record<string, unknown>) => {
    const tableId = Number(row.TABLE_ID)
    const info = infoMap.get(tableId)
    const res = row.RESERVATION_ID != null
      ? (reservations ?? []).find((r) => Number(r.RESERVATION_ID) === Number(row.RESERVATION_ID))
      : resMap.get(tableId)

    const capacity = info?.SEAT_CAPACITY != null ? Number(info.SEAT_CAPACITY) : 4
    const tableNum = info?.TABLE_NUM != null ? Number(info.TABLE_NUM) : tableId

    return {
      TABLE_ID: tableId,
      TABLE_NUM: tableNum,
      STATUS: (row.STATUS || 'AVAILABLE') as RestaurantTableData['STATUS'],
      GUEST_CAPACITY: capacity,
      CURRENT_GUEST_COUNT: Number(row.SEATED_GUEST_COUNT || 0),
      BILL_OUT_REQUESTED: Boolean(row.BILL_OUT_REQUESTED),
      MERGE_GROUP_ID: row.MERGE_GROUP_ID != null ? Number(row.MERGE_GROUP_ID) : null,
      MERGE_PERSISTENCY: (row.MERGE_PERSISTENCY as 'TEMPORARY' | 'CONTINOUOUS') || 'TEMPORARY',
      OCCUPIED_SINCE: row.OCCUPIED_SINCE ? String(row.OCCUPIED_SINCE) : null,
      RESERVATION_ID: row.RESERVATION_ID != null ? Number(row.RESERVATION_ID) : null,
      LABEL_ID: row.LABEL_ID != null ? Number(row.LABEL_ID) : (info?.LABEL_ID != null ? Number(info.LABEL_ID) : null),
      // Reservation details joined from Table_Reservations
      RESERVED_SINCE: res?.RESERVED_SINCE ? String(res.RESERVED_SINCE) : (row.STATUS === 'RESERVED' && row.OCCUPIED_SINCE ? String(row.OCCUPIED_SINCE) : null),
      RESERVATION_NAME: res?.APPOINTED_NAME ? String(res.APPOINTED_NAME) : null,
      RESERVATION_PAX: res?.EXPECTED_GUEST_COUNT != null ? Number(res.EXPECTED_GUEST_COUNT) : null,
      RESERVATION_NOTES: res?.RESERVATION_NOTE ? String(res.RESERVATION_NOTE) : null,
      RESERVATION_TIME_LIMIT: res?.TIME_LIMIT ? String(res.TIME_LIMIT) : null,
      RESERVATION_PHONE_NUMBER: res?.APPOINTED_PHONE_NUMBER != null ? String(res.APPOINTED_PHONE_NUMBER) : null,
    }
  })

  return result.sort((a, b) => a.TABLE_NUM - b.TABLE_NUM)
}

/**
 * Saves all layout tables for a preset into Table_Info,
 * records the TABLE_IDS array in Table_Layout_Presets,
 * and if the preset is currently active, synchronizes Active_Tables.
 */
export async function savePresetLayout(
  presetId: number,
  tables: TableLayoutInfo[],
  tableCapacities?: Map<number, number>,
  maxPax?: number,
): Promise<void> {
  const sanitizedTables = sequentializeLayoutTables(tables)

  // 1. Fetch existing Table_Info to match existing TABLE_IDs or determine next TABLE_ID
  const { data: existingAllInfo } = await supabase
    .schema('tables')
    .from('Table_Info')
    .select('TABLE_ID, TABLE_NUM')

  const existingMap = new Map((existingAllInfo ?? []).map((r) => [Number(r.TABLE_NUM), Number(r.TABLE_ID)]))
  let highestTableId = (existingAllInfo ?? []).reduce(
    (max, r) => Math.max(max, Number(r.TABLE_ID || 0)),
    0,
  )

  const rowsToUpsert: Array<{
    TABLE_ID: number
    TABLE_NUM: number
    TABLE_TYPE: number
    X_POS: number
    Y_POS: number
    SEAT_CAPACITY: number
    LABEL_ID: number | null
  }> = []

  const assignedTableIds: number[] = []

  for (const t of sanitizedTables) {
    let tableId = t.TABLE_ID
    if (!tableId || tableId <= 0) {
      tableId = existingMap.get(t.TABLE_NUM) || ++highestTableId
    }

    const capacity =
      t.SEAT_CAPACITY ??
      t.TABLE_CAPACITY ??
      tableCapacities?.get(t.TABLE_NUM) ??
      TABLE_TYPES[t.TABLE_TYPE]?.defaultCapacity ??
      4

    rowsToUpsert.push({
      TABLE_ID: tableId,
      TABLE_NUM: t.TABLE_NUM,
      TABLE_TYPE: t.TABLE_TYPE,
      X_POS: t.X_POS,
      Y_POS: t.Y_POS,
      SEAT_CAPACITY: Math.max(1, capacity),
      LABEL_ID: t.LABEL_ID != null ? Number(t.LABEL_ID) : null,
    })

    assignedTableIds.push(tableId)
  }

  // 2. Upsert into Table_Info
  if (rowsToUpsert.length > 0) {
    const { error: upsertErr } = await supabase
      .schema('tables')
      .from('Table_Info')
      .upsert(rowsToUpsert, { onConflict: 'TABLE_ID' })

    if (upsertErr) {
      console.error('[tableLayoutService] Error upserting into Table_Info:', upsertErr)
      throw upsertErr
    }
  }

  // 3. Update Table_Layout_Presets with TABLE_IDS array and MAX_PAX
  const updatePresetPayload: Record<string, unknown> = {
    TABLE_IDS: assignedTableIds,
    UPDATED_AT: new Date().toISOString(),
  }
  if (maxPax != null && maxPax > 0) {
    updatePresetPayload.MAX_PAX = Math.round(maxPax)
  }

  const { error: presetUpdErr } = await supabase
    .schema('tables')
    .from('Table_Layout_Presets')
    .update(updatePresetPayload)
    .eq('LAYOUT_PRESET_ID', presetId)

  if (presetUpdErr) {
    console.error('[tableLayoutService] Error updating Table_Layout_Presets TABLE_IDS:', presetUpdErr)
  }

  // 4. If this preset is active, synchronize Active_Tables
  const { data: presetData } = await supabase
    .schema('tables')
    .from('Table_Layout_Presets')
    .select('IS_ACTIVE')
    .eq('LAYOUT_PRESET_ID', presetId)
    .single()

  if (presetData && Boolean(presetData.IS_ACTIVE)) {
    await populateActiveTablesForPreset(presetId)

    // Synchronize merge groups if specified on layout tables
    const tableNumToIdMap = new Map(rowsToUpsert.map((r) => [r.TABLE_NUM, r.TABLE_ID]))
    for (const t of sanitizedTables) {
      const liveId = tableNumToIdMap.get(t.TABLE_NUM)
      if (!liveId) continue

      let targetMergeId: number | null = null
      if (t.MERGE_GROUP_ID != null) {
        const anchorId = tableNumToIdMap.get(t.MERGE_GROUP_ID) ?? t.MERGE_GROUP_ID
        if (anchorId !== liveId) {
          targetMergeId = anchorId
        }
      }

      await supabase
        .schema('tables')
        .from('Active_Tables')
        .update({ MERGE_GROUP_ID: targetMergeId })
        .eq('TABLE_ID', liveId)
    }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('monolith-order-update', { detail: { type: 'tables_sync', presetId } }),
    )
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Table Setup Breakdown & Counts Per Type
// ─────────────────────────────────────────────────────────────────────────────

export interface TableTypeCount {
  type: TableType
  name: string
  count: number
  totalSeats: number
  shape: string
}

export interface TableSetupBreakdown {
  presetId?: number | null
  presetName?: string
  totalTables: number
  totalSeats: number
  byType: TableTypeCount[]
}

export function computeTableSetupBreakdown(
  tables: Array<{ TABLE_TYPE?: number; TABLE_CAPACITY?: number | null; SEAT_CAPACITY?: number | null }>,
  presetName?: string,
  presetId?: number | null,
): TableSetupBreakdown {
  const map = new Map<number, { count: number; totalSeats: number }>()
  let totalSeats = 0

  for (const t of tables) {
    const typeNum = Number(t.TABLE_TYPE || 1) as TableType
    const cfg = TABLE_TYPES[typeNum] || TABLE_TYPES[1]
    const cap = t.SEAT_CAPACITY ?? t.TABLE_CAPACITY ?? cfg.defaultCapacity ?? 4
    totalSeats += cap

    const entry = map.get(typeNum) || { count: 0, totalSeats: 0 }
    entry.count += 1
    entry.totalSeats += cap
    map.set(typeNum, entry)
  }

  const byType: TableTypeCount[] = []
  for (const [typeNum, data] of map.entries()) {
    const cfg = TABLE_TYPES[typeNum as TableType] || TABLE_TYPES[1]
    byType.push({
      type: typeNum as TableType,
      name: cfg.name,
      count: data.count,
      totalSeats: data.totalSeats,
      shape: cfg.shape,
    })
  }

  byType.sort((a, b) => a.type - b.type)

  return {
    presetId,
    presetName,
    totalTables: tables.length,
    totalSeats,
    byType,
  }
}

export async function fetchCurrentTableSetup(): Promise<TableSetupBreakdown> {
  try {
    const presets = await fetchAllLayoutPresets()
    let activePreset = null

    if (typeof window !== 'undefined') {
      const activeId = localStorage.getItem('table-active-preset-id')
      if (activeId) {
        activePreset = presets.find((p) => p.LAYOUT_PRESET_ID === Number(activeId)) || null
      }
    }

    if (!activePreset) {
      activePreset = presets.find((p) => p.IS_ACTIVE) || presets[0] || null
    }

    if (activePreset) {
      const layoutTables = await fetchPresetLayout(activePreset.LAYOUT_PRESET_ID)
      if (layoutTables && layoutTables.length > 0) {
        return computeTableSetupBreakdown(
          layoutTables,
          activePreset.PRESET_NAME,
          activePreset.LAYOUT_PRESET_ID,
        )
      }
    }
  } catch (err) {
    console.warn('[tableLayoutService] Could not load active layout preset:', err)
  }

  // Fallback to Table_Info
  try {
    const { data: infoRows } = await supabase
      .schema('tables')
      .from('Table_Info')
      .select('TABLE_TYPE, SEAT_CAPACITY')
      .limit(100)

    if (infoRows && infoRows.length > 0) {
      return computeTableSetupBreakdown(
        infoRows.map((r) => ({
          TABLE_TYPE: Number(r.TABLE_TYPE) as TableType,
          SEAT_CAPACITY: r.SEAT_CAPACITY != null ? Number(r.SEAT_CAPACITY) : 4,
        })),
        'Active Setup',
        null,
      )
    }
  } catch (err) {
    console.warn('[tableLayoutService] Could not query Table_Info fallback:', err)
  }

  return {
    totalTables: 0,
    totalSeats: 0,
    byType: [],
  }
}

export async function fetchPresetTableSetup(
  presetId: number,
  presetName?: string,
): Promise<TableSetupBreakdown> {
  try {
    const layoutTables = await fetchPresetLayout(presetId)
    return computeTableSetupBreakdown(layoutTables, presetName, presetId)
  } catch (err) {
    console.warn(`[tableLayoutService] Could not load preset layout #${presetId}:`, err)
    return {
      presetId,
      presetName,
      totalTables: 0,
      totalSeats: 0,
      byType: [],
    }
  }
}
