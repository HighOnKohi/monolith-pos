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
  IS_MERGE_MEMBER: boolean
  IS_MERGE_CAPTAIN: boolean
  RESERVED_SINCE: string | null
  RESERVATION_NAME: string | null
  RESERVATION_PAX: number | null
  RESERVATION_NOTES: string | null
  LAYOUT_X?: number | null
  LAYOUT_Y?: number | null
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

const ACTIVE_ORDER_STATUSES = ['REQUESTED', 'VERIFIED', 'PREPARING', 'READY', 'SERVED', 'COMPLETED']
const OCCUPIED_STATUSES: TableStatus[] = ['OCCUPIED', 'HAS_REQUEST']
export const MAX_LAYOUT_PAX = 50

export async function assertCapacityLimit(
  additionalCapacity: number,
  currentEffectivePax?: number,
  maxPaxLimit: number = MAX_LAYOUT_PAX,
): Promise<void> {
  const limit = maxPaxLimit > 0 ? maxPaxLimit : MAX_LAYOUT_PAX
  if (currentEffectivePax !== undefined) {
    if (currentEffectivePax + additionalCapacity > limit) {
      throw new Error(`Maximum seating capacity reached. The layout cannot exceed ${limit} Pax (currently at ${currentEffectivePax} Pax).`)
    }
    return
  }

  const { data, error } = await supabase.from('Restaurant_Tables').select('GUEST_CAPACITY')
  if (error) throw error
  const current = (data ?? []).reduce((sum, table) => sum + Number(table.GUEST_CAPACITY ?? 0), 0)
  if (current + additionalCapacity > limit) {
    throw new Error(`Maximum seating capacity reached. The layout cannot exceed ${limit} Pax.`)
  }
}

let cachedTables: TableData[] | null = null

export function getCachedTables(): TableData[] | null {
  return cachedTables
}

export function cacheTables(tables: TableData[]): void {
  cachedTables = tables
}

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
  statuses: string[] = ACTIVE_ORDER_STATUSES,
): Promise<Map<number, { totalBill: number; activeOrderCount: number }>> {
  if (tableIds.length === 0) return new Map()

  const { data: orders } = await supabase
    .from('Restaurant_Orders')
    .select('TABLE_ID, TOTAL_BILL')
    .in('TABLE_ID', tableIds)
    .in('ORDER_STATUS', statuses)

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

  const { data: lastTable } = await supabase
    .from('Restaurant_Tables')
    .select('TABLE_ID')
    .order('TABLE_ID', { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextTableId = Number(lastTable?.TABLE_ID ?? 0) + 1

  const { data, error } = await supabase
    .from('Restaurant_Tables')
    .insert({
      TABLE_ID: nextTableId,
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
  countOrCapacities: number | number[],
  defaultCapacity = 4,
  currentEffectivePax?: number,
  maxPaxLimit?: number,
): Promise<BatchCreateResult> {
  const capacities = Array.isArray(countOrCapacities)
    ? countOrCapacities
    : Array.from({ length: countOrCapacities }, () => defaultCapacity)

  const count = capacities.length
  if (count < 1 || count > 50) throw new Error('Table count must be between 1 and 50.')
  if (capacities.some((c) => c < 1)) throw new Error('Capacity must be at least 1.')
  if (startNum < 1) throw new Error('Starting table number must be at least 1.')

  const nums = Array.from({ length: count }, (_, i) => startNum + i)

  // Find which nums already exist
  const { data: existingData } = await supabase
    .from('Restaurant_Tables')
    .select('TABLE_NUM')
    .in('TABLE_NUM', nums)

  const existingNums = new Set((existingData ?? []).map((r) => Number(r.TABLE_NUM)))
  const toCreateItems = nums
    .map((num, i) => ({ num, capacity: capacities[i] }))
    .filter((item) => !existingNums.has(item.num))
  const skipped = nums.filter((n) => existingNums.has(n))

  if (toCreateItems.length === 0) {
    return { created: [], skipped }
  }

  const addedCapacity = toCreateItems.reduce((sum, item) => sum + item.capacity, 0)
  await assertCapacityLimit(addedCapacity, currentEffectivePax, maxPaxLimit)

  const { data: lastTable } = await supabase
    .from('Restaurant_Tables')
    .select('TABLE_ID')
    .order('TABLE_ID', { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextTableId = Number(lastTable?.TABLE_ID ?? 0) + 1

  const rows = toCreateItems.map((item, index) => ({
    TABLE_ID: nextTableId + index,
    TABLE_NUM: item.num,
    STATUS: 'AVAILABLE',
    GUEST_CAPACITY: item.capacity,
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
): Promise<TableData[]> {
  const current = await fetchTableWithOrders(tableId)
  if (!current) throw new Error('Table not found.')

  // Check if this table is part of a merge group (as anchor or secondary)
  const anchorId = current.MERGE_GROUP_ID ?? current.TABLE_ID
  const { data: secondariesData, error: secErr } = await supabase
    .from('Restaurant_Tables')
    .select('*')
    .eq('MERGE_GROUP_ID', anchorId)

  if (secErr) throw secErr

  const secondaries = (secondariesData ?? []) as TableData[]
  const isMerged = current.MERGE_GROUP_ID !== null || secondaries.length > 0

  const memberIds = new Set<number>()
  memberIds.add(anchorId)
  secondaries.forEach((s) => memberIds.add(Number(s.TABLE_ID)))
  const targetIds = Array.from(memberIds)

  const allMembers = isMerged ? await fetchTablesByIds(targetIds) : [current]
  const anchorTable = allMembers.find((t) => t.TABLE_ID === anchorId) ?? current

  const effectiveCapacity = isMerged
    ? anchorTable.GUEST_CAPACITY
    : (fields.capacity ?? current.GUEST_CAPACITY)
  const currentPax = isMerged ? anchorTable.CURRENT_GUEST_COUNT : current.CURRENT_GUEST_COUNT

  // Validate capacity
  if (fields.capacity !== undefined && !isMerged && fields.capacity < currentPax) {
    throw new Error(
      `Cannot reduce capacity to ${fields.capacity}. Table currently has ${currentPax} seated guests. Reduce seated pax first.`,
    )
  }

  // Validate seatedPax
  if (fields.seatedPax !== undefined) {
    if (!Number.isInteger(fields.seatedPax) || fields.seatedPax < 0) {
      throw new Error('Seated pax must be 0 or greater.')
    }
    if (fields.seatedPax > effectiveCapacity) {
      throw new Error(`Seated pax (${fields.seatedPax}) cannot exceed capacity (${effectiveCapacity}).`)
    }
  }

  // Validate tableNum (tableNum applies to the specific table selected)
  if (fields.tableNum !== undefined && fields.tableNum !== current.TABLE_NUM) {
    const { data: dup } = await supabase
      .from('Restaurant_Tables')
      .select('TABLE_ID')
      .eq('TABLE_NUM', fields.tableNum)
      .neq('TABLE_ID', tableId)
      .maybeSingle()
    if (dup) throw new Error(`Table ${fields.tableNum} already exists.`)

    const { error: numErr } = await supabase
      .from('Restaurant_Tables')
      .update({ TABLE_NUM: fields.tableNum })
      .eq('TABLE_ID', tableId)
    if (numErr) throw numErr
  }

  // Update capacity (only for non-merged single tables)
  if (fields.capacity !== undefined && !isMerged) {
    const { error: capErr } = await supabase
      .from('Restaurant_Tables')
      .update({ GUEST_CAPACITY: fields.capacity })
      .eq('TABLE_ID', tableId)
    if (capErr) throw capErr
  }

  // Update seatedPax
  if (fields.seatedPax !== undefined) {
    const newPax = fields.seatedPax

    if (isMerged) {
      // For merged groups: store guest count on anchor table; ensure secondaries have 0
      const { error: anchorPaxErr } = await supabase
        .from('Restaurant_Tables')
        .update({ CURRENT_GUEST_COUNT: newPax })
        .eq('TABLE_ID', anchorId)
      if (anchorPaxErr) throw anchorPaxErr

      if (secondaries.length > 0) {
        const secIds = secondaries.map((s) => s.TABLE_ID)
        await supabase
          .from('Restaurant_Tables')
          .update({ CURRENT_GUEST_COUNT: 0 })
          .in('TABLE_ID', secIds)
      }

      // If newPax > 0 and group status was AVAILABLE or RESERVED, update all members to OCCUPIED
      if (newPax > 0 && (anchorTable.STATUS === 'AVAILABLE' || anchorTable.STATUS === 'RESERVED')) {
        const { error: statusErr } = await supabase
          .from('Restaurant_Tables')
          .update({ STATUS: 'OCCUPIED' })
          .in('TABLE_ID', targetIds)
        if (statusErr) throw statusErr
      }
    } else {
      // Single table
      const payload: Record<string, unknown> = { CURRENT_GUEST_COUNT: newPax }
      if (newPax > 0 && (current.STATUS === 'AVAILABLE' || current.STATUS === 'RESERVED')) {
        payload.STATUS = 'OCCUPIED'
      }
      const { error: paxErr } = await supabase
        .from('Restaurant_Tables')
        .update(payload)
        .eq('TABLE_ID', tableId)
      if (paxErr) throw paxErr
    }
  }

  return fetchTablesByIds(targetIds)
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
  timeLimit: string
  notes?: string
}

export async function reserveTable(tableId: number, reservation: ReservationData): Promise<TableData[]> {
  const { data: current, error: fetchErr } = await supabase
    .from('Restaurant_Tables')
    .select('TABLE_ID, GUEST_CAPACITY, TABLE_NUM, STATUS, MERGE_GROUP_ID, RESERVED_SINCE')
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

  const anchorId = (current as { MERGE_GROUP_ID: number | null }).MERGE_GROUP_ID ?? tableId
  const { data: members, error: membersErr } = await supabase
    .from('Restaurant_Tables')
    .select('TABLE_ID')
    .eq('MERGE_GROUP_ID', anchorId)
  if (membersErr) throw membersErr

  const targetIds = [anchorId, ...(members ?? []).map((member) => Number(member.TABLE_ID))]
  const { data: reservationRow, error: reservationError } = await supabase
    .from('Table_Reservations')
    .insert({
      TABLE_ID: tableId,
      APPOINTED_NAME: reservation.name.trim(),
      GUEST_COUNT: reservation.pax,
      RESERVATION_NOTE: reservation.notes?.trim() || null,
      TIME_LIMIT: reservation.timeLimit,
    })
    .select()
    .single()
  if (reservationError || !reservationRow) throw reservationError ?? new Error('Failed to save reservation.')

  const { error } = await supabase
    .from('Restaurant_Tables')
    .update({ STATUS: 'RESERVED', RESERVED_SINCE: new Date().toISOString() })
    .in('TABLE_ID', targetIds)

  if (error) throw error
  return fetchTablesByIds(targetIds)
}

export async function cancelReservation(tableId: number): Promise<TableData[]> {
  const { data: current, error: fetchErr } = await supabase
    .from('Restaurant_Tables')
    .select('MERGE_GROUP_ID')
    .eq('TABLE_ID', tableId)
    .maybeSingle()
  if (fetchErr) throw fetchErr
  if (!current) throw new Error('Table not found.')

  const anchorId = current.MERGE_GROUP_ID ?? tableId
  const { data: members, error: membersErr } = await supabase
    .from('Restaurant_Tables')
    .select('TABLE_ID')
    .eq('MERGE_GROUP_ID', anchorId)
  if (membersErr) throw membersErr

  const targetIds = [anchorId, ...(members ?? []).map((member) => Number(member.TABLE_ID))]
  const { error } = await supabase
    .from('Restaurant_Tables')
    .update({
      STATUS: 'AVAILABLE',
      RESERVED_SINCE: null,
      RESERVATION_NAME: null,
      RESERVATION_PAX: null,
      RESERVATION_NOTES: null,
    })
    .in('TABLE_ID', targetIds)

  if (error) throw error
  return fetchTablesByIds(targetIds)
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

  // Restore primary capacity if it was combined
  const secTotalCap = secondaryList.reduce((sum, s) => sum + (s.GUEST_CAPACITY || 0), 0)
  const { data: primary } = await supabase
    .from('Restaurant_Tables')
    .select('GUEST_CAPACITY')
    .eq('TABLE_ID', primaryTableId)
    .single()
  if (primary && secTotalCap > 0) {
    const restoredCap = Math.max(1, (primary.GUEST_CAPACITY || 0) - secTotalCap)
    await supabase
      .from('Restaurant_Tables')
      .update({ GUEST_CAPACITY: restoredCap })
      .eq('TABLE_ID', primaryTableId)
  }

  // Return fresh data for all affected rows
  return fetchTablesByIds([primaryTableId, ...secondaryIds])
}

export async function saveTableMerge(captainId: number, memberIds: number[]): Promise<TableData[]> {
  const selectedIds = [captainId, ...memberIds]
  const allTables = await fetchAllTables()
  const touchedGroupIds = new Set<number>([captainId])

  for (const table of allTables) {
    if (selectedIds.includes(table.TABLE_ID) && table.MERGE_GROUP_ID !== null) {
      touchedGroupIds.add(table.MERGE_GROUP_ID)
    }
  }

  const affectedIds = allTables
    .filter((table) =>
      selectedIds.includes(table.TABLE_ID) ||
      touchedGroupIds.has(table.TABLE_ID) ||
      (table.MERGE_GROUP_ID !== null && touchedGroupIds.has(table.MERGE_GROUP_ID)),
    )
    .map((table) => table.TABLE_ID)

  const { error: clearError } = await supabase
    .from('Restaurant_Tables')
    .update({ MERGE_GROUP_ID: null, IS_MERGE_MEMBER: false, IS_MERGE_CAPTAIN: false })
    .in('TABLE_ID', affectedIds)

  if (clearError) throw clearError

  if (memberIds.length > 0) {
    const { error: captainError } = await supabase
      .from('Restaurant_Tables')
      .update({ MERGE_GROUP_ID: null, IS_MERGE_MEMBER: false, IS_MERGE_CAPTAIN: true })
      .eq('TABLE_ID', captainId)

    if (captainError) throw captainError

    const { error: memberError } = await supabase
      .from('Restaurant_Tables')
      .update({ MERGE_GROUP_ID: captainId, IS_MERGE_MEMBER: true, IS_MERGE_CAPTAIN: false })
      .in('TABLE_ID', memberIds)

    if (memberError) throw memberError
  }

  return fetchTablesByIds(affectedIds)
}

/**
 * Synchronize table merge groups (from Table Manager adjacency or layout presets)
 * to Restaurant_Tables in Supabase.
 *
 * Compares the desired state against current database rows and performs minimal
 * batched updates to avoid unnecessary network egress.
 */
export async function syncTableMergeGroups(
  mergeGroups: Array<{ anchorId: number; memberIds: number[] }>,
  allTableIds: number[],
  currentTables?: TableData[],
): Promise<TableData[]> {
  const existingTables = currentTables && currentTables.length > 0
    ? currentTables
    : await fetchTablesByIds(allTableIds)

  const existingMap = new Map<number, TableData>(existingTables.map((t) => [t.TABLE_ID, t]))

  // Only groups with 2+ members are considered active merge groups
  const validGroups = mergeGroups.filter((g) => g.memberIds && g.memberIds.length > 1)

  // Map each tableId to desired state: { mergeGroupId, isCaptain, isMember }
  const desiredState = new Map<number, {
    mergeGroupId: number | null
    isCaptain: boolean
    isMember: boolean
  }>()

  // Default: standalone table
  for (const id of allTableIds) {
    desiredState.set(id, {
      mergeGroupId: null,
      isCaptain: false,
      isMember: false,
    })
  }

  // Populate merge group participants
  for (const group of validGroups) {
    const anchorId = group.anchorId
    desiredState.set(anchorId, {
      mergeGroupId: null,
      isCaptain: true,
      isMember: false,
    })
    for (const memberId of group.memberIds) {
      if (memberId !== anchorId) {
        desiredState.set(memberId, {
          mergeGroupId: anchorId,
          isCaptain: false,
          isMember: true,
        })
      }
    }
  }

  // Diff with existing table records
  const toMakeStandalone: number[] = []
  const toMakeCaptain: number[] = []
  const toMakeMemberByAnchor = new Map<number, number[]>() // anchorId -> memberIds[]

  for (const [id, desired] of desiredState.entries()) {
    const cur = existingMap.get(id)
    if (!cur) continue

    const curGroupId = cur.MERGE_GROUP_ID ?? null
    const curCaptain = Boolean(cur.IS_MERGE_CAPTAIN)
    const curMember = Boolean(cur.IS_MERGE_MEMBER)

    const needsUpdate =
      curGroupId !== desired.mergeGroupId ||
      curCaptain !== desired.isCaptain ||
      curMember !== desired.isMember

    if (needsUpdate) {
      if (desired.isCaptain) {
        toMakeCaptain.push(id)
      } else if (desired.isMember && desired.mergeGroupId !== null) {
        const list = toMakeMemberByAnchor.get(desired.mergeGroupId) || []
        list.push(id)
        toMakeMemberByAnchor.set(desired.mergeGroupId, list)
      } else {
        toMakeStandalone.push(id)
      }
    }
  }

  const updatedTableIds: number[] = []

  // 1. Reset standalone tables
  if (toMakeStandalone.length > 0) {
    const { error } = await supabase
      .from('Restaurant_Tables')
      .update({
        MERGE_GROUP_ID: null,
        IS_MERGE_CAPTAIN: false,
        IS_MERGE_MEMBER: false,
      })
      .in('TABLE_ID', toMakeStandalone)

    if (error) {
      console.error('[tableService] Failed to reset standalone tables:', error)
      throw error
    }
    updatedTableIds.push(...toMakeStandalone)
  }

  // 2. Set captain tables
  if (toMakeCaptain.length > 0) {
    const { error } = await supabase
      .from('Restaurant_Tables')
      .update({
        MERGE_GROUP_ID: null,
        IS_MERGE_CAPTAIN: true,
        IS_MERGE_MEMBER: false,
      })
      .in('TABLE_ID', toMakeCaptain)

    if (error) {
      console.error('[tableService] Failed to set captain tables:', error)
      throw error
    }
    updatedTableIds.push(...toMakeCaptain)
  }

  // 3. Set member tables for each anchor
  for (const [anchorId, memberIds] of toMakeMemberByAnchor.entries()) {
    if (memberIds.length > 0) {
      const { error } = await supabase
        .from('Restaurant_Tables')
        .update({
          MERGE_GROUP_ID: anchorId,
          IS_MERGE_CAPTAIN: false,
          IS_MERGE_MEMBER: true,
        })
        .in('TABLE_ID', memberIds)

      if (error) {
        console.error(`[tableService] Failed to set members for anchor ${anchorId}:`, error)
        throw error
      }
      updatedTableIds.push(...memberIds)
    }
  }

  if (updatedTableIds.length === 0) {
    return existingTables
  }

  // Fetch updated rows for targeted update
  const freshlyUpdated = await fetchTablesByIds(updatedTableIds)
  const freshMap = new Map(freshlyUpdated.map((t) => [t.TABLE_ID, t]))

  return existingTables.map((t) => freshMap.get(t.TABLE_ID) ?? t)
}

/**
 * Pure helper to immediately project merge groups onto in-memory TableData[]
 * without awaiting network fetches.
 */
export function applyMergeGroupsToTableList(
  tables: TableData[],
  mergeGroups: Array<{ anchorId: number; memberIds: number[] }>,
): TableData[] {
  const validGroups = mergeGroups.filter((g) => g.memberIds && g.memberIds.length > 1)
  const groupMap = new Map<number, { anchorId: number; isCaptain: boolean }>()

  for (const group of validGroups) {
    groupMap.set(group.anchorId, { anchorId: group.anchorId, isCaptain: true })
    for (const mid of group.memberIds) {
      if (mid !== group.anchorId) {
        groupMap.set(mid, { anchorId: group.anchorId, isCaptain: false })
      }
    }
  }

  return tables.map((t) => {
    const info = groupMap.get(t.TABLE_ID)
    if (!info) {
      return {
        ...t,
        MERGE_GROUP_ID: null,
        IS_MERGE_CAPTAIN: false,
        IS_MERGE_MEMBER: false,
      }
    }
    if (info.isCaptain) {
      return {
        ...t,
        MERGE_GROUP_ID: null,
        IS_MERGE_CAPTAIN: true,
        IS_MERGE_MEMBER: false,
      }
    }
    return {
      ...t,
      MERGE_GROUP_ID: info.anchorId,
      IS_MERGE_CAPTAIN: false,
      IS_MERGE_MEMBER: true,
    }
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Pax
// ─────────────────────────────────────────────────────────────────────────────

export async function updateSeatedPax(tableId: number, newCount: number): Promise<TableData> {
  const updatedRows = await updateTable(tableId, { seatedPax: newCount })
  const updated = updatedRows.find((r) => r.TABLE_ID === tableId) ?? updatedRows[0]
  if (!updated) throw new Error('Failed to update pax.')
  return updated
}
