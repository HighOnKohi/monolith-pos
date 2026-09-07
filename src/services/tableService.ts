import { supabase } from '@/lib/supabase'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type TableStatus =
  | 'AVAILABLE'
  | 'RESERVED'
  | 'OCCUPIED'
  | 'HAS_REQUEST'
  | 'UNAVAILABLE'

export interface TableData {
  TABLE_ID: number
  TABLE_NUM: number
  STATUS: TableStatus
  GUEST_CAPACITY: number
  CURRENT_GUEST_COUNT: number
  BILL_OUT_REQUESTED: boolean
  MERGE_GROUP_ID: number | null
  RESERVED_SINCE: string | null           // ISO timestamp, reused as reservation datetime
  RESERVATION_NAME: string | null
  RESERVATION_PAX: number | null
  RESERVATION_NOTES: string | null
}

export interface TableWithOrders extends TableData {
  activeOrderCount: number
  totalBill: number
}

export interface BulkDeleteResult {
  deleted: number[]
  blocked: Array<{ id: number; num: number; reason: string }>
}

export interface BatchCreateResult {
  created: TableData[]
  skipped: number[]   // table numbers that already existed
}

export interface MergePreview {
  primaryTable: TableData
  allMembers: TableData[]
  totalCapacity: number
  totalSeatedPax: number
  occupiedTables: TableData[]
  canMerge: boolean
  blockReason?: string
}

const ACTIVE_ORDER_STATUSES = ['REQUESTED', 'VERIFIED', 'PREPARING', 'READY', 'SERVED']
const OCCUPIED_STATUSES: TableStatus[] = ['OCCUPIED', 'HAS_REQUEST']

// ─────────────────────────────────────────────────────────────────────────────
// Fetch
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchAllTables(): Promise<TableData[]> {
  const { data, error } = await supabase
    .from('Restaurant_Tables')
    .select('*')
    .order('TABLE_NUM')

  if (error) throw error
  return (data as TableData[]) ?? []
}

export async function fetchTablesByIds(ids: number[]): Promise<TableData[]> {
  if (ids.length === 0) return []
  const { data, error } = await supabase
    .from('Restaurant_Tables')
    .select('*')
    .in('TABLE_ID', ids)
    .order('TABLE_NUM')
  if (error) throw error
  return (data as TableData[]) ?? []
}

export async function fetchTableWithOrders(tableId: number): Promise<TableWithOrders | null> {
  const { data: tableData, error: tableError } = await supabase
    .from('Restaurant_Tables')
    .select('*')
    .eq('TABLE_ID', tableId)
    .maybeSingle()

  if (tableError) throw tableError
  if (!tableData) return null

  const { data: orders } = await supabase
    .from('Restaurant_Orders')
    .select('ORDER_ID, TOTAL_BILL')
    .eq('TABLE_ID', tableId)
    .in('ORDER_STATUS', ACTIVE_ORDER_STATUSES)

  const activeOrderCount = orders?.length ?? 0
  const totalBill = (orders ?? []).reduce((sum, o) => sum + (Number(o.TOTAL_BILL) || 0), 0)

  return { ...(tableData as TableData), activeOrderCount, totalBill }
}

/**
 * Fetch order summaries for a specific set of table IDs.
 * Used for targeted refreshes (e.g. after a single table status change).
 */
export async function fetchOrderSummariesForIds(
  tableIds: number[],
): Promise<Map<number, { totalBill: number; activeOrderCount: number }>> {
  if (tableIds.length === 0) return new Map()

  const { data: orders } = await supabase
    .from('Restaurant_Orders')
    .select('TABLE_ID, TOTAL_BILL')
    .in('TABLE_ID', tableIds)
    .in('ORDER_STATUS', ACTIVE_ORDER_STATUSES)

  const map = new Map<number, { totalBill: number; activeOrderCount: number }>()
  for (const id of tableIds) {
    const tableOrders = (orders ?? []).filter((o) => Number(o.TABLE_ID) === id)
    map.set(id, {
      totalBill: tableOrders.reduce((s, o) => s + (Number(o.TOTAL_BILL) || 0), 0),
      activeOrderCount: tableOrders.length,
    })
  }
  return map
}

// ─────────────────────────────────────────────────────────────────────────────
// Create — single table
// ─────────────────────────────────────────────────────────────────────────────

export async function createTable(tableNum: number, capacity: number): Promise<TableData> {
  if (!Number.isInteger(capacity) || capacity < 1) throw new Error('Capacity must be a positive integer.')
  if (!Number.isInteger(tableNum) || tableNum < 1) throw new Error('Table number must be a positive integer.')

  const { data: existing } = await supabase
    .from('Restaurant_Tables')
    .select('TABLE_ID')
    .eq('TABLE_NUM', tableNum)
    .maybeSingle()
  if (existing) throw new Error(`Table ${tableNum} already exists.`)

  const { data, error } = await supabase
    .from('Restaurant_Tables')
    .insert({
      TABLE_NUM: tableNum,
      STATUS: 'AVAILABLE',
      GUEST_CAPACITY: capacity,
      CURRENT_GUEST_COUNT: 0,
      BILL_OUT_REQUESTED: false,
      MERGE_GROUP_ID: null,
    })
    .select()
    .single()

  if (error || !data) throw error ?? new Error('Failed to create table.')
  return data as TableData
}

// ─────────────────────────────────────────────────────────────────────────────
// Create — batch
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create multiple tables in a single batch INSERT.
 * Tables whose TABLE_NUM already exists are skipped (not an error).
 * Returns the list of created tables and skipped table numbers.
 */
export async function batchCreateTables(
  startNum: number,
  count: number,
  capacity: number,
): Promise<BatchCreateResult> {
  if (count < 1 || count > 50) throw new Error('Count must be between 1 and 50.')
  if (capacity < 1) throw new Error('Capacity must be at least 1.')
  if (startNum < 1) throw new Error('Starting table number must be at least 1.')

  const nums = Array.from({ length: count }, (_, i) => startNum + i)

  // Find which nums already exist
  const { data: existingData } = await supabase
    .from('Restaurant_Tables')
    .select('TABLE_NUM')
    .in('TABLE_NUM', nums)

  const existingNums = new Set((existingData ?? []).map((r) => Number(r.TABLE_NUM)))
  const toCreate = nums.filter((n) => !existingNums.has(n))
  const skipped = nums.filter((n) => existingNums.has(n))

  if (toCreate.length === 0) {
    return { created: [], skipped }
  }

  const rows = toCreate.map((num) => ({
    TABLE_NUM: num,
    STATUS: 'AVAILABLE',
    GUEST_CAPACITY: capacity,
    CURRENT_GUEST_COUNT: 0,
    BILL_OUT_REQUESTED: false,
    MERGE_GROUP_ID: null,
  }))

  const { data, error } = await supabase.from('Restaurant_Tables').insert(rows).select()
  if (error) throw error

  return { created: (data as TableData[]) ?? [], skipped }
}

// ─────────────────────────────────────────────────────────────────────────────
// Update
// ─────────────────────────────────────────────────────────────────────────────

export async function updateTable(
  tableId: number,
  fields: { tableNum?: number; capacity?: number; seatedPax?: number },
): Promise<TableData> {
  const current = await fetchTableWithOrders(tableId)
  if (!current) throw new Error('Table not found.')

  const newCapacity = fields.capacity ?? current.GUEST_CAPACITY
  const newSeatedPax = fields.seatedPax ?? current.CURRENT_GUEST_COUNT
  const newTableNum = fields.tableNum ?? current.TABLE_NUM

  if (fields.capacity !== undefined && newCapacity < current.CURRENT_GUEST_COUNT) {
    throw new Error(
      `Cannot reduce capacity to ${newCapacity}. Table currently has ${current.CURRENT_GUEST_COUNT} seated guests. Reduce seated pax first.`,
    )
  }
  if (fields.seatedPax !== undefined) {
    if (!Number.isInteger(newSeatedPax) || newSeatedPax < 0) throw new Error('Seated pax must be 0 or greater.')
    if (newSeatedPax > newCapacity) throw new Error(`Seated pax (${newSeatedPax}) cannot exceed capacity (${newCapacity}).`)
  }

  if (fields.tableNum !== undefined && fields.tableNum !== current.TABLE_NUM) {
    const { data: dup } = await supabase
      .from('Restaurant_Tables')
      .select('TABLE_ID')
      .eq('TABLE_NUM', fields.tableNum)
      .neq('TABLE_ID', tableId)
      .maybeSingle()
    if (dup) throw new Error(`Table ${fields.tableNum} already exists.`)
  }

  const payload: Record<string, unknown> = {}
  if (fields.tableNum !== undefined) payload.TABLE_NUM = newTableNum
  if (fields.capacity !== undefined) payload.GUEST_CAPACITY = newCapacity
  if (fields.seatedPax !== undefined) payload.CURRENT_GUEST_COUNT = newSeatedPax

  const { data, error } = await supabase
    .from('Restaurant_Tables')
    .update(payload)
    .eq('TABLE_ID', tableId)
    .select()
    .single()

  if (error || !data) throw error ?? new Error('Failed to update table.')
  return data as TableData
}

// ─────────────────────────────────────────────────────────────────────────────
// Availability
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Set a table's status. If the table belongs to a merge group (as primary or secondary),
 * ALL member tables in that merge group are updated to the same status.
 * Returns the list of freshly updated TableData rows for all affected tables.
 */
export async function setTableStatus(
  tableId: number,
  status: TableStatus,
): Promise<TableData[]> {
  const { data: current, error: fetchErr } = await supabase
    .from('Restaurant_Tables')
    .select('TABLE_ID, TABLE_NUM, STATUS, CURRENT_GUEST_COUNT, MERGE_GROUP_ID')
    .eq('TABLE_ID', tableId)
    .maybeSingle()

  if (fetchErr) throw fetchErr
  if (!current) throw new Error('Table not found.')

  // Resolve all tables belonging to the merge group
  const anchorId = current.MERGE_GROUP_ID ?? current.TABLE_ID
  const { data: secondaries } = await supabase
    .from('Restaurant_Tables')
    .select('TABLE_ID')
    .eq('MERGE_GROUP_ID', anchorId)

  const memberIds = new Set<number>()
  memberIds.add(anchorId)
  ;(secondaries ?? []).forEach((s) => memberIds.add(Number(s.TABLE_ID)))
  const targetIds = Array.from(memberIds)

  // Safety guard: Cannot mark as AVAILABLE or UNAVAILABLE if active orders exist
  if (status === 'AVAILABLE' || status === 'UNAVAILABLE') {
    const { data: activeOrders } = await supabase
      .from('Restaurant_Orders')
      .select('ORDER_ID')
      .in('TABLE_ID', targetIds)
      .in('ORDER_STATUS', ACTIVE_ORDER_STATUSES)

    if (activeOrders && activeOrders.length > 0) {
      throw new Error(
        `Table ${current.TABLE_NUM} has ${activeOrders.length} active order(s). Settle or cancel orders before marking as ${status.toLowerCase()}.`,
      )
    }
  }

  const payload: Record<string, unknown> = { STATUS: status }
  if (status === 'AVAILABLE') {
    payload.CURRENT_GUEST_COUNT = 0
    payload.BILL_OUT_REQUESTED = false
    payload.RESERVED_SINCE = null
    payload.RESERVATION_NAME = null
    payload.RESERVATION_PAX = null
    payload.RESERVATION_NOTES = null
  } else if (status === 'UNAVAILABLE') {
    payload.CURRENT_GUEST_COUNT = 0
    payload.BILL_OUT_REQUESTED = false
  } else if (status === 'OCCUPIED') {
    if (current.CURRENT_GUEST_COUNT === 0) {
      payload.CURRENT_GUEST_COUNT = 2
    }
  }

  const { error: updateErr } = await supabase
    .from('Restaurant_Tables')
    .update(payload)
    .in('TABLE_ID', targetIds)

  if (updateErr) throw updateErr

  return fetchTablesByIds(targetIds)
}

/**
 * Backward compatibility wrapper for setTableStatus.
 */
export async function setTableAvailability(
  tableId: number,
  status: 'AVAILABLE' | 'UNAVAILABLE',
): Promise<TableData> {
  const rows = await setTableStatus(tableId, status)
  return rows.find((r) => r.TABLE_ID === tableId) ?? rows[0]
}

// ─────────────────────────────────────────────────────────────────────────────
// Reservations
// ─────────────────────────────────────────────────────────────────────────────

export interface ReservationData {
  name: string
  pax: number
  reservedSince: string   // ISO timestamp (date + time combined)
  notes?: string
}

export async function reserveTable(tableId: number, reservation: ReservationData): Promise<TableData> {
  const { data: current, error: fetchErr } = await supabase
    .from('Restaurant_Tables')
    .select('GUEST_CAPACITY, TABLE_NUM, STATUS')
    .eq('TABLE_ID', tableId)
    .maybeSingle()

  if (fetchErr) throw fetchErr
  if (!current) throw new Error('Table not found.')

  const capacity = (current as { GUEST_CAPACITY: number }).GUEST_CAPACITY
  const status = (current as { STATUS: string }).STATUS

  if (OCCUPIED_STATUSES.includes(status as TableStatus)) {
    throw new Error(`Table ${(current as { TABLE_NUM: number }).TABLE_NUM} is occupied and cannot be reserved.`)
  }
  if (reservation.pax < 1) throw new Error('Reservation pax must be at least 1.')
  if (reservation.pax > capacity) {
    throw new Error(
      `Reservation pax (${reservation.pax}) exceeds table capacity (${capacity}).`,
    )
  }
  if (!reservation.name.trim()) throw new Error('Guest name is required.')

  const { data, error } = await supabase
    .from('Restaurant_Tables')
    .update({
      STATUS: 'RESERVED',
      RESERVED_SINCE: reservation.reservedSince,
      RESERVATION_NAME: reservation.name.trim(),
      RESERVATION_PAX: reservation.pax,
      RESERVATION_NOTES: reservation.notes?.trim() || null,
    })
    .eq('TABLE_ID', tableId)
    .select()
    .single()

  if (error || !data) throw error ?? new Error('Failed to reserve table.')
  return data as TableData
}

export async function cancelReservation(tableId: number): Promise<TableData> {
  const { data, error } = await supabase
    .from('Restaurant_Tables')
    .update({
      STATUS: 'AVAILABLE',
      RESERVED_SINCE: null,
      RESERVATION_NAME: null,
      RESERVATION_PAX: null,
      RESERVATION_NOTES: null,
    })
    .eq('TABLE_ID', tableId)
    .select()
    .single()

  if (error || !data) throw error ?? new Error('Failed to cancel reservation.')
  return data as TableData
}

// ─────────────────────────────────────────────────────────────────────────────
// Delete
// ─────────────────────────────────────────────────────────────────────────────

export async function deleteTables(tableIds: number[]): Promise<BulkDeleteResult> {
  const result: BulkDeleteResult = { deleted: [], blocked: [] }

  const summaries = await Promise.all(tableIds.map((id) => fetchTableWithOrders(id)))

  const toDelete: number[] = []

  for (const table of summaries) {
    if (!table) continue

    if (table.MERGE_GROUP_ID !== null) {
      result.blocked.push({ id: table.TABLE_ID, num: table.TABLE_NUM, reason: 'Part of a merge group. Unmerge first.' })
      continue
    }

    const { data: secondaries } = await supabase
      .from('Restaurant_Tables')
      .select('TABLE_ID')
      .eq('MERGE_GROUP_ID', table.TABLE_ID)

    if (secondaries && secondaries.length > 0) {
      result.blocked.push({ id: table.TABLE_ID, num: table.TABLE_NUM, reason: 'Primary of a merge group. Unmerge first.' })
      continue
    }

    if (table.activeOrderCount > 0) {
      result.blocked.push({
        id: table.TABLE_ID,
        num: table.TABLE_NUM,
        reason: `Has ${table.activeOrderCount} active order(s). Complete or clear the session first.`,
      })
      continue
    }

    toDelete.push(table.TABLE_ID)
  }

  if (toDelete.length > 0) {
    const { error } = await supabase.from('Restaurant_Tables').delete().in('TABLE_ID', toDelete)
    if (error) throw error
    result.deleted.push(...toDelete)
  }

  return result
}

// ─────────────────────────────────────────────────────────────────────────────
// Bulk edit
// ─────────────────────────────────────────────────────────────────────────────

export interface BulkEditResult {
  updated: TableData[]
  blocked: Array<{ id: number; num: number; reason: string }>
}

export async function bulkEditTables(
  tableIds: number[],
  fields: { capacity?: number; status?: TableStatus; availability?: 'AVAILABLE' | 'UNAVAILABLE' },
): Promise<BulkEditResult> {
  const result: BulkEditResult = { updated: [], blocked: [] }
  const effectiveStatus = fields.status ?? fields.availability
  if (!fields.capacity && !effectiveStatus) return result

  const tables = await fetchTablesByIds(tableIds)
  const processedStatusIds = new Set<number>()

  for (const table of tables) {
    if (fields.capacity !== undefined) {
      if (fields.capacity < table.CURRENT_GUEST_COUNT) {
        result.blocked.push({
          id: table.TABLE_ID,
          num: table.TABLE_NUM,
          reason: `New capacity (${fields.capacity}) < current seated pax (${table.CURRENT_GUEST_COUNT}).`,
        })
        continue
      }

      const { data, error } = await supabase
        .from('Restaurant_Tables')
        .update({ GUEST_CAPACITY: fields.capacity })
        .eq('TABLE_ID', table.TABLE_ID)
        .select()
        .single()

      if (error || !data) {
        result.blocked.push({ id: table.TABLE_ID, num: table.TABLE_NUM, reason: 'Database error.' })
      } else {
        const row = data as TableData
        const existingIdx = result.updated.findIndex((u) => u.TABLE_ID === row.TABLE_ID)
        if (existingIdx >= 0) result.updated[existingIdx] = row
        else result.updated.push(row)
      }
    }

    if (effectiveStatus !== undefined && !processedStatusIds.has(table.TABLE_ID)) {
      try {
        const updatedMembers = await setTableStatus(table.TABLE_ID, effectiveStatus)
        updatedMembers.forEach((m) => {
          processedStatusIds.add(m.TABLE_ID)
          const existingIdx = result.updated.findIndex((u) => u.TABLE_ID === m.TABLE_ID)
          if (existingIdx >= 0) result.updated[existingIdx] = m
          else result.updated.push(m)
        })
      } catch (err: unknown) {
        result.blocked.push({
          id: table.TABLE_ID,
          num: table.TABLE_NUM,
          reason: (err as Error).message,
        })
      }
    }
  }

  return result
}

// ─────────────────────────────────────────────────────────────────────────────
// Merge
// ─────────────────────────────────────────────────────────────────────────────

export async function previewMerge(tableIds: number[]): Promise<MergePreview> {
  if (tableIds.length < 2) {
    return {
      primaryTable: {} as TableData,
      allMembers: [],
      totalCapacity: 0,
      totalSeatedPax: 0,
      occupiedTables: [],
      canMerge: false,
      blockReason: 'Select at least 2 tables to merge.',
    }
  }

  const { data: tables, error } = await supabase
    .from('Restaurant_Tables')
    .select('*')
    .in('TABLE_ID', tableIds)
    .order('TABLE_NUM')

  if (error || !tables) throw error ?? new Error('Failed to fetch tables.')

  let allMemberIds = new Set(tableIds)
  const groupIds = (tables as TableData[])
    .map((t) => t.MERGE_GROUP_ID)
    .filter((id): id is number => id !== null)

  if (tableIds.length > 0) {
    const { data: secondaries } = await supabase
      .from('Restaurant_Tables')
      .select('TABLE_ID')
      .in('MERGE_GROUP_ID', tableIds)
    ;(secondaries ?? []).forEach((s) => allMemberIds.add(Number(s.TABLE_ID)))
  }
  if (groupIds.length > 0) {
    allMemberIds = new Set([...allMemberIds, ...groupIds])
    const { data: siblings } = await supabase
      .from('Restaurant_Tables')
      .select('TABLE_ID')
      .in('MERGE_GROUP_ID', groupIds)
    ;(siblings ?? []).forEach((s) => allMemberIds.add(Number(s.TABLE_ID)))
  }

  const { data: allData } = await supabase
    .from('Restaurant_Tables')
    .select('*')
    .in('TABLE_ID', [...allMemberIds])
    .order('TABLE_NUM')

  const allMembers = (allData as TableData[]) ?? []
  const primaryTable = allMembers.find((t) => t.TABLE_ID === tableIds[0]) ?? allMembers[0]
  const totalCapacity = allMembers.reduce((s, t) => s + t.GUEST_CAPACITY, 0)
  const totalSeatedPax = allMembers.reduce((s, t) => s + t.CURRENT_GUEST_COUNT, 0)

  const { data: orders } = await supabase
    .from('Restaurant_Orders')
    .select('TABLE_ID')
    .in('TABLE_ID', allMembers.map((t) => t.TABLE_ID))
    .in('ORDER_STATUS', ACTIVE_ORDER_STATUSES)

  const occupiedTableIds = new Set((orders ?? []).map((o) => Number(o.TABLE_ID)))
  const occupiedTables = allMembers.filter((t) => occupiedTableIds.has(t.TABLE_ID))

  return { primaryTable, allMembers, totalCapacity, totalSeatedPax, occupiedTables, canMerge: true }
}

/**
 * Execute merge. Returns the updated TableData rows for all affected tables
 * so the caller can do a targeted state update without a full reload.
 */
export async function mergeTables(tableIds: number[]): Promise<TableData[]> {
  const preview = await previewMerge(tableIds)
  if (!preview.canMerge) throw new Error(preview.blockReason ?? 'Cannot merge.')

  const primaryId = preview.primaryTable.TABLE_ID
  const allMemberIds = preview.allMembers.map((t) => t.TABLE_ID)
  const secondaryIds = allMemberIds.filter((id) => id !== primaryId)

  // 1. Reassign active orders from secondaries to primary
  if (secondaryIds.length > 0) {
    const { error } = await supabase
      .from('Restaurant_Orders')
      .update({ TABLE_ID: primaryId })
      .in('TABLE_ID', secondaryIds)
      .in('ORDER_STATUS', ACTIVE_ORDER_STATUSES)
    if (error) throw error

    // Also reassign any active bill requests from secondaries to primary
    try {
      await supabase
        .from('Bill_Requests')
        .update({ TABLE_ID: primaryId })
        .in('TABLE_ID', secondaryIds)
        .in('STATUS', ['REQUESTED', 'PROCESSING'])
    } catch (brErr) {
      console.warn('[tableService] Could not reassign bill requests during merge:', brErr)
    }
  }

  // 2. Update primary
  const hasBillOut = preview.allMembers.some((t) => Boolean(t.BILL_OUT_REQUESTED))
  const { error: primaryErr } = await supabase
    .from('Restaurant_Tables')
    .update({
      GUEST_CAPACITY: preview.totalCapacity,
      CURRENT_GUEST_COUNT: preview.totalSeatedPax,
      STATUS: preview.totalSeatedPax > 0 || preview.occupiedTables.length > 0 ? 'OCCUPIED' : 'AVAILABLE',
      BILL_OUT_REQUESTED: hasBillOut,
      MERGE_GROUP_ID: null,
    })
    .eq('TABLE_ID', primaryId)
  if (primaryErr) throw primaryErr

  // 3. Update secondaries
  if (secondaryIds.length > 0) {
    const { error: secErr } = await supabase
      .from('Restaurant_Tables')
      .update({ MERGE_GROUP_ID: primaryId, STATUS: 'AVAILABLE', CURRENT_GUEST_COUNT: 0, BILL_OUT_REQUESTED: false })
      .in('TABLE_ID', secondaryIds)
    if (secErr) throw secErr
  }

  // 4. Return freshly fetched rows for targeted state update
  return fetchTablesByIds(allMemberIds)
}

// ─────────────────────────────────────────────────────────────────────────────
// Unmerge
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Unmerge a group. Returns updated rows for targeted state update.
 */
export async function unmergeTables(primaryTableId: number): Promise<TableData[]> {
  const { data: secondaries, error: secFetchErr } = await supabase
    .from('Restaurant_Tables')
    .select('*')
    .eq('MERGE_GROUP_ID', primaryTableId)

  if (secFetchErr) throw secFetchErr

  const secondaryList = (secondaries ?? []) as TableData[]
  if (secondaryList.length === 0) throw new Error('This table has no merged members to unmerge.')

  const secondaryIds = secondaryList.map((t) => t.TABLE_ID)

  const { error: releaseErr } = await supabase
    .from('Restaurant_Tables')
    .update({ MERGE_GROUP_ID: null, STATUS: 'AVAILABLE', CURRENT_GUEST_COUNT: 0 })
    .in('TABLE_ID', secondaryIds)
  if (releaseErr) throw releaseErr

  // Return fresh data for all affected rows
  return fetchTablesByIds([primaryTableId, ...secondaryIds])
}

// ─────────────────────────────────────────────────────────────────────────────
// Pax
// ─────────────────────────────────────────────────────────────────────────────

export async function updateSeatedPax(tableId: number, newCount: number): Promise<TableData> {
  const { data: table, error: fetchErr } = await supabase
    .from('Restaurant_Tables')
    .select('GUEST_CAPACITY, TABLE_NUM')
    .eq('TABLE_ID', tableId)
    .maybeSingle()

  if (fetchErr) throw fetchErr
  if (!table) throw new Error('Table not found.')

  if (!Number.isInteger(newCount) || newCount < 0) throw new Error('Seated pax must be 0 or greater.')
  const cap = (table as { GUEST_CAPACITY: number }).GUEST_CAPACITY
  if (newCount > cap) throw new Error(`Seated pax (${newCount}) cannot exceed capacity (${cap}).`)

  const { data, error } = await supabase
    .from('Restaurant_Tables')
    .update({ CURRENT_GUEST_COUNT: newCount })
    .eq('TABLE_ID', tableId)
    .select()
    .single()

  if (error || !data) throw error ?? new Error('Failed to update pax.')
  return data as TableData
}
