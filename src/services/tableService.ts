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
  MERGE_PERSISTENCY: 'TEMPORARY' | 'CONTINOUOUS' | null
  OCCUPIED_SINCE: string | null
  RESERVATION_ID: number | null
  IS_MERGE_MEMBER: boolean
  IS_MERGE_CAPTAIN: boolean
  RESERVED_SINCE: string | null
  RESERVATION_NAME: string | null
  RESERVATION_PAX: number | null
  RESERVATION_NOTES: string | null
  RESERVATION_TIME_LIMIT?: string | null
  RESERVATION_PHONE_NUMBER?: string | null
  LAYOUT_X?: number | null
  LAYOUT_Y?: number | null
  TABLE_TYPE?: number | null
  LABEL_ID?: number | null
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
  skipped: number[] // table numbers that already existed
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
export const MAX_LAYOUT_PAX = 50

export async function assertCapacityLimit(
  additionalCapacity: number,
  currentEffectivePax?: number,
  maxPaxLimit: number = MAX_LAYOUT_PAX,
): Promise<void> {
  const limit = maxPaxLimit > 0 ? maxPaxLimit : MAX_LAYOUT_PAX
  if (currentEffectivePax !== undefined) {
    if (currentEffectivePax + additionalCapacity > limit) {
      throw new Error(
        `Maximum seating capacity reached. The layout cannot exceed ${limit} Pax (currently at ${currentEffectivePax} Pax).`,
      )
    }
    return
  }

  const { data, error } = await supabase
    .schema('tables')
    .from('Table_Info')
    .select('SEAT_CAPACITY')
  if (error) throw error
  const current = (data ?? []).reduce((sum, table) => sum + Number(table.SEAT_CAPACITY ?? 0), 0)
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

/**
 * Helper to assemble full TableData records from Active_Tables, Table_Info, and Table_Reservations.
 */
function assembleTableData(
  activeRows: Array<Record<string, unknown>>,
  infoRows: Array<Record<string, unknown>>,
  reservationRows: Array<Record<string, unknown>>,
): TableData[] {
  const infoMap = new Map<number, Record<string, unknown>>()
  infoRows.forEach((r) => infoMap.set(Number(r.TABLE_ID), r))

  const resMap = new Map<number, Record<string, unknown>>()
  reservationRows.forEach((r) => {
    resMap.set(Number(r.RESERVATION_ID), r)
    resMap.set(Number(r.TABLE_ID), r)
  })

  // Determine captains (tables referenced by others as MERGE_GROUP_ID)
  const captainIds = new Set<number>()
  activeRows.forEach((a) => {
    if (a.MERGE_GROUP_ID != null) {
      captainIds.add(Number(a.MERGE_GROUP_ID))
    }
  })

  return activeRows.map((active) => {
    const tableId = Number(active.TABLE_ID)
    const info = infoMap.get(tableId)
    const tableNum = info?.TABLE_NUM != null ? Number(info.TABLE_NUM) : tableId
    const capacity = info?.SEAT_CAPACITY != null ? Number(info.SEAT_CAPACITY) : 4

    const reservation = active.RESERVATION_ID != null
      ? resMap.get(Number(active.RESERVATION_ID))
      : resMap.get(tableId)

    const mergeGroupId = active.MERGE_GROUP_ID != null ? Number(active.MERGE_GROUP_ID) : null
    const isMergeMember = mergeGroupId !== null
    const isMergeCaptain = captainIds.has(tableId) && !isMergeMember

    return {
      TABLE_ID: tableId,
      TABLE_NUM: tableNum,
      STATUS: (active.STATUS || 'AVAILABLE') as TableStatus,
      GUEST_CAPACITY: capacity,
      CURRENT_GUEST_COUNT: Number(active.SEATED_GUEST_COUNT || 0),
      BILL_OUT_REQUESTED: Boolean(active.BILL_OUT_REQUESTED),
      MERGE_GROUP_ID: mergeGroupId,
      MERGE_PERSISTENCY: (active.MERGE_PERSISTENCY as 'TEMPORARY' | 'CONTINOUOUS') || null,
      OCCUPIED_SINCE: active.OCCUPIED_SINCE ? String(active.OCCUPIED_SINCE) : null,
      RESERVATION_ID: active.RESERVATION_ID != null ? Number(active.RESERVATION_ID) : null,
      IS_MERGE_MEMBER: isMergeMember,
      IS_MERGE_CAPTAIN: isMergeCaptain,
      RESERVED_SINCE: reservation?.RESERVED_SINCE ? String(reservation.RESERVED_SINCE) : null,
      RESERVATION_NAME: reservation?.APPOINTED_NAME ? String(reservation.APPOINTED_NAME) : null,
      RESERVATION_PAX: reservation?.EXPECTED_GUEST_COUNT != null ? Number(reservation.EXPECTED_GUEST_COUNT) : null,
      RESERVATION_NOTES: reservation?.RESERVATION_NOTE ? String(reservation.RESERVATION_NOTE) : null,
      RESERVATION_TIME_LIMIT: reservation?.TIME_LIMIT ? String(reservation.TIME_LIMIT) : null,
      RESERVATION_PHONE_NUMBER: reservation?.APPOINTED_PHONE_NUMBER != null ? String(reservation.APPOINTED_PHONE_NUMBER) : null,
      LAYOUT_X: info?.X_POS != null ? Number(info.X_POS) : null,
      LAYOUT_Y: info?.Y_POS != null ? Number(info.Y_POS) : null,
      TABLE_TYPE: info?.TABLE_TYPE != null ? Number(info.TABLE_TYPE) : 1,
      LABEL_ID: active.LABEL_ID != null ? Number(active.LABEL_ID) : (info?.LABEL_ID != null ? Number(info.LABEL_ID) : null),
    }
  }).sort((a, b) => a.TABLE_NUM - b.TABLE_NUM)
}

export async function fetchAllTables(): Promise<TableData[]> {
  try {
    const [{ data: activeData, error: activeErr }, { data: infoData }, { data: resData }] = await Promise.all([
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

    if (activeErr) throw activeErr

    return assembleTableData(
      (activeData ?? []) as Array<Record<string, unknown>>,
      (infoData ?? []) as Array<Record<string, unknown>>,
      (resData ?? []) as Array<Record<string, unknown>>,
    )
  } catch (err) {
    console.error('[tableService] Error fetching all tables:', err)
    return []
  }
}

export async function fetchTablesByIds(ids: number[]): Promise<TableData[]> {
  if (ids.length === 0) return []
  const [{ data: activeData, error }, { data: infoData }, { data: resData }] = await Promise.all([
    supabase
      .schema('tables')
      .from('Active_Tables')
      .select('*')
      .in('TABLE_ID', ids),
    supabase
      .schema('tables')
      .from('Table_Info')
      .select('*')
      .in('TABLE_ID', ids),
    supabase
      .schema('tables')
      .from('Table_Reservations')
      .select('*')
      .in('TABLE_ID', ids),
  ])

  if (error) throw error

  return assembleTableData(
    (activeData ?? []) as Array<Record<string, unknown>>,
    (infoData ?? []) as Array<Record<string, unknown>>,
    (resData ?? []) as Array<Record<string, unknown>>,
  )
}

export async function fetchTableWithOrders(tableId: number): Promise<TableWithOrders | null> {
  const tables = await fetchTablesByIds([tableId])
  if (tables.length === 0) return null
  const tableData = tables[0]

  const { data: orders } = await supabase
    .from('Restaurant_Orders')
    .select('ORDER_ID, TOTAL_BILL')
    .eq('TABLE_ID', tableId)
    .in('ORDER_STATUS', ACTIVE_ORDER_STATUSES)

  const activeOrderCount = orders?.length ?? 0
  const totalBill = (orders ?? []).reduce((sum, o) => sum + (Number(o.TOTAL_BILL) || 0), 0)

  return { ...tableData, activeOrderCount, totalBill }
}

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
    map.set(id, { totalBill: 0, activeOrderCount: 0 })
  }

  for (const o of orders ?? []) {
    const tId = Number(o.TABLE_ID)
    const cur = map.get(tId) || { totalBill: 0, activeOrderCount: 0 }
    cur.activeOrderCount += 1
    cur.totalBill += Number(o.TOTAL_BILL) || 0
    map.set(tId, cur)
  }

  return map
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

  const anchorId = current.MERGE_GROUP_ID ?? current.TABLE_ID
  const { data: groupTablesData, error: grpErr } = await supabase
    .schema('tables')
    .from('Active_Tables')
    .select('*')
    .or(`TABLE_ID.eq.${anchorId},MERGE_GROUP_ID.eq.${anchorId}`)

  if (grpErr) throw grpErr

  const allGroupMembers = (groupTablesData ?? []) as Array<Record<string, unknown>>
  const isMerged = allGroupMembers.length > 1
  const targetIds = isMerged
    ? allGroupMembers.map((m) => Number(m.TABLE_ID))
    : [tableId]

  const currentPax = current.CURRENT_GUEST_COUNT

  // Validate capacity
  if (fields.capacity !== undefined && !isMerged && fields.capacity < currentPax) {
    throw new Error(
      `Cannot reduce capacity to ${fields.capacity}. Table currently has ${currentPax} seated guests. Reduce seated pax first.`,
    )
  }

  // Update capacity in Table_Info
  if (fields.capacity !== undefined) {
    const { error: capErr } = await supabase
      .schema('tables')
      .from('Table_Info')
      .update({ SEAT_CAPACITY: fields.capacity })
      .eq('TABLE_ID', tableId)
    if (capErr) throw capErr
  }

  // Update tableNum in Table_Info
  if (fields.tableNum !== undefined && fields.tableNum !== current.TABLE_NUM) {
    const { data: dup } = await supabase
      .schema('tables')
      .from('Table_Info')
      .select('TABLE_ID')
      .eq('TABLE_NUM', fields.tableNum)
      .neq('TABLE_ID', tableId)
      .maybeSingle()
    if (dup) throw new Error(`Table ${fields.tableNum} already exists.`)

    const { error: numErr } = await supabase
      .schema('tables')
      .from('Table_Info')
      .update({ TABLE_NUM: fields.tableNum })
      .eq('TABLE_ID', tableId)
    if (numErr) throw numErr
  }

  // Update seatedPax in Active_Tables
  if (fields.seatedPax !== undefined) {
    const newPax = fields.seatedPax
    const payload: Record<string, unknown> = { SEATED_GUEST_COUNT: newPax }
    if (newPax > 0 && (current.STATUS === 'AVAILABLE' || current.STATUS === 'RESERVED')) {
      payload.STATUS = 'OCCUPIED'
      payload.OCCUPIED_SINCE = new Date().toISOString()
    } else if (newPax === 0 && current.STATUS !== 'AVAILABLE') {
      payload.STATUS = 'AVAILABLE'
      payload.OCCUPIED_SINCE = null
      payload.BILL_OUT_REQUESTED = false
    }

    const idsToUpdate = isMerged ? targetIds : [tableId]
    const { error: paxErr } = await supabase
      .schema('tables')
      .from('Active_Tables')
      .update(payload)
      .in('TABLE_ID', idsToUpdate)
    if (paxErr) throw paxErr
  }

  return fetchTablesByIds(targetIds)
}

// ─────────────────────────────────────────────────────────────────────────────
// Availability & Status
// ─────────────────────────────────────────────────────────────────────────────

export async function setTableStatus(
  tableId: number,
  status: TableStatus,
): Promise<TableData[]> {
  const { data: current, error: fetchErr } = await supabase
    .schema('tables')
    .from('Active_Tables')
    .select('TABLE_ID, STATUS, SEATED_GUEST_COUNT, MERGE_GROUP_ID, RESERVATION_ID')
    .eq('TABLE_ID', tableId)
    .maybeSingle()

  if (fetchErr) throw fetchErr
  if (!current) throw new Error('Table not found.')

  const anchorId = (current.MERGE_GROUP_ID != null ? Number(current.MERGE_GROUP_ID) : null) ?? tableId
  const { data: secondaries } = await supabase
    .schema('tables')
    .from('Active_Tables')
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
        `Table has ${activeOrders.length} active order(s). Settle or cancel orders before marking as ${status.toLowerCase()}.`,
      )
    }
  }

  const payload: Record<string, unknown> = { STATUS: status }
  if (status === 'AVAILABLE') {
    payload.SEATED_GUEST_COUNT = 0
    payload.BILL_OUT_REQUESTED = false
    payload.OCCUPIED_SINCE = null
    payload.RESERVATION_ID = null

    // If reservation existed on table, remove it from Table_Reservations
    try {
      await supabase
        .schema('tables')
        .from('Table_Reservations')
        .delete()
        .in('TABLE_ID', targetIds)
    } catch {
      // Non-fatal
    }
  } else if (status === 'UNAVAILABLE') {
    payload.SEATED_GUEST_COUNT = 0
    payload.BILL_OUT_REQUESTED = false
    payload.OCCUPIED_SINCE = null
  } else if (status === 'OCCUPIED') {
    payload.OCCUPIED_SINCE = new Date().toISOString()
    if (Number(current.SEATED_GUEST_COUNT || 0) === 0) {
      payload.SEATED_GUEST_COUNT = 2
    }
  }

  const { error: updateErr } = await supabase
    .schema('tables')
    .from('Active_Tables')
    .update(payload)
    .in('TABLE_ID', targetIds)

  if (updateErr) throw updateErr

  return fetchTablesByIds(targetIds)
}

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
  phoneNumber?: string | number | null
}

export async function reserveTable(
  tableId: number,
  reservation: ReservationData,
): Promise<TableData[]> {
  const { data: current, error: fetchErr } = await supabase
    .schema('tables')
    .from('Active_Tables')
    .select('TABLE_ID, STATUS, MERGE_GROUP_ID')
    .eq('TABLE_ID', tableId)
    .maybeSingle()

  if (fetchErr) throw fetchErr
  if (!current) throw new Error('Table not found in Active_Tables.')

  const status = current.STATUS as string
  if (OCCUPIED_STATUSES.includes(status as TableStatus)) {
    throw new Error('Table is currently occupied and cannot be reserved.')
  }
  if (reservation.pax < 1) throw new Error('Reservation pax must be at least 1.')
  if (!reservation.name.trim()) throw new Error('Guest name is required.')

  const anchorId = (current.MERGE_GROUP_ID != null ? Number(current.MERGE_GROUP_ID) : null) ?? tableId
  const { data: secondaries } = await supabase
    .schema('tables')
    .from('Active_Tables')
    .select('TABLE_ID')
    .eq('MERGE_GROUP_ID', anchorId)

  const memberIds = new Set<number>()
  memberIds.add(anchorId)
  ;(secondaries ?? []).forEach((s) => memberIds.add(Number(s.TABLE_ID)))
  const targetIds = Array.from(memberIds)

  const cleanedPhone = reservation.phoneNumber ? String(reservation.phoneNumber).replace(/\D/g, '') : null
  const appointedPhone = cleanedPhone ? Number(cleanedPhone) : null

  // 1. Insert into Table_Reservations
  const { data: reservationRow, error: reservationError } = await supabase
    .schema('tables')
    .from('Table_Reservations')
    .insert({
      TABLE_ID: tableId,
      APPOINTED_NAME: reservation.name.trim(),
      APPOINTED_PHONE_NUMBER: appointedPhone,
      EXPECTED_GUEST_COUNT: reservation.pax,
      RESERVATION_NOTE: reservation.notes?.trim() || null,
      TIME_LIMIT: reservation.timeLimit || null,
      RESERVED_SINCE: new Date().toISOString(),
    })
    .select()
    .single()

  if (reservationError || !reservationRow) {
    throw reservationError ?? new Error('Failed to save reservation.')
  }

  const reservationId = Number(reservationRow.RESERVATION_ID)

  // 2. Update Active_Tables with RESERVATION_ID and STATUS = RESERVED
  const { error: activeErr } = await supabase
    .schema('tables')
    .from('Active_Tables')
    .update({
      STATUS: 'RESERVED',
      RESERVATION_ID: reservationId,
      SEATED_GUEST_COUNT: reservation.pax,
    })
    .in('TABLE_ID', targetIds)

  if (activeErr) throw activeErr

  return fetchTablesByIds(targetIds)
}

export async function cancelReservation(tableId: number): Promise<TableData[]> {
  const { data: current, error: fetchErr } = await supabase
    .schema('tables')
    .from('Active_Tables')
    .select('TABLE_ID, MERGE_GROUP_ID, RESERVATION_ID')
    .eq('TABLE_ID', tableId)
    .maybeSingle()

  if (fetchErr) throw fetchErr
  if (!current) throw new Error('Table not found.')

  const anchorId = (current.MERGE_GROUP_ID != null ? Number(current.MERGE_GROUP_ID) : null) ?? tableId
  const { data: secondaries } = await supabase
    .schema('tables')
    .from('Active_Tables')
    .select('TABLE_ID')
    .eq('MERGE_GROUP_ID', anchorId)

  const memberIds = new Set<number>()
  memberIds.add(anchorId)
  ;(secondaries ?? []).forEach((s) => memberIds.add(Number(s.TABLE_ID)))
  const targetIds = Array.from(memberIds)

  // 1. Remove from Table_Reservations
  if (current.RESERVATION_ID != null) {
    try {
      await supabase
        .schema('tables')
        .from('Table_Reservations')
        .delete()
        .eq('RESERVATION_ID', Number(current.RESERVATION_ID))
    } catch {
      // Non-fatal
    }
  }

  try {
    await supabase
      .schema('tables')
      .from('Table_Reservations')
      .delete()
      .in('TABLE_ID', targetIds)
  } catch {
    // Non-fatal
  }

  // 2. Reset Active_Tables
  const { error: resetErr } = await supabase
    .schema('tables')
    .from('Active_Tables')
    .update({
      STATUS: 'AVAILABLE',
      RESERVATION_ID: null,
      SEATED_GUEST_COUNT: 0,
      OCCUPIED_SINCE: null,
    })
    .in('TABLE_ID', targetIds)

  if (resetErr) throw resetErr

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
      .schema('tables')
      .from('Active_Tables')
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
    const { error } = await supabase.schema('tables').from('Active_Tables').delete().in('TABLE_ID', toDelete)
    if (error) throw error
    result.deleted.push(...toDelete)
  }

  return result
}

export async function removeAllTables(): Promise<BulkDeleteResult> {
  const { data, error } = await supabase.schema('tables').from('Active_Tables').select('TABLE_ID')
  if (error) throw error
  const tableIds = (data ?? []).map((r) => Number(r.TABLE_ID))
  if (tableIds.length === 0) return { deleted: [], blocked: [] }
  return deleteTables(tableIds)
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

  const allMembers = await fetchTablesByIds(tableIds)
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
 * Execute table merge with MERGE_PERSISTENCY ('TEMPORARY' or 'CONTINOUOUS').
 */
export async function mergeTables(
  tableIds: number[],
  persistency: 'TEMPORARY' | 'CONTINOUOUS' = 'TEMPORARY',
): Promise<TableData[]> {
  const preview = await previewMerge(tableIds)
  if (!preview.canMerge) throw new Error(preview.blockReason ?? 'Cannot merge.')

  const primaryId = preview.primaryTable.TABLE_ID
  const allMemberIds = preview.allMembers.map((t) => t.TABLE_ID)
  const secondaryIds = allMemberIds.filter((id) => id !== primaryId)

  // 1. Reassign active orders from secondaries to primary
  if (secondaryIds.length > 0) {
    await supabase
      .from('Restaurant_Orders')
      .update({ TABLE_ID: primaryId })
      .in('TABLE_ID', secondaryIds)
      .in('ORDER_STATUS', ACTIVE_ORDER_STATUSES)

    try {
      await supabase
        .from('Bill_Requests')
        .update({ TABLE_ID: primaryId })
        .in('TABLE_ID', secondaryIds)
        .in('STATUS', ['REQUESTED', 'PROCESSING'])
    } catch {
      // Non-fatal
    }
  }

  // 2. Update primary and secondaries in Active_Tables
  const hasBillOut = preview.allMembers.some((t) => Boolean(t.BILL_OUT_REQUESTED))
  const combinedPax = preview.totalSeatedPax
  const isOccupied = combinedPax > 0 || preview.occupiedTables.length > 0
  const combinedStatus: TableStatus = isOccupied ? 'OCCUPIED' : 'AVAILABLE'

  const primaryPayload: Record<string, unknown> = {
    SEATED_GUEST_COUNT: combinedPax,
    STATUS: combinedStatus,
    BILL_OUT_REQUESTED: hasBillOut,
    MERGE_GROUP_ID: null,
    MERGE_PERSISTENCY: persistency,
  }
  if (isOccupied && !preview.primaryTable.OCCUPIED_SINCE) {
    primaryPayload.OCCUPIED_SINCE = new Date().toISOString()
  }

  const { error: primaryErr } = await supabase
    .schema('tables')
    .from('Active_Tables')
    .update(primaryPayload)
    .eq('TABLE_ID', primaryId)

  if (primaryErr) throw primaryErr

  if (secondaryIds.length > 0) {
    const secondaryPayload: Record<string, unknown> = {
      MERGE_GROUP_ID: primaryId,
      SEATED_GUEST_COUNT: combinedPax,
      STATUS: combinedStatus,
      BILL_OUT_REQUESTED: false,
      MERGE_PERSISTENCY: persistency,
    }
    if (isOccupied) {
      secondaryPayload.OCCUPIED_SINCE = primaryPayload.OCCUPIED_SINCE || new Date().toISOString()
    }

    const { error: secErr } = await supabase
      .schema('tables')
      .from('Active_Tables')
      .update(secondaryPayload)
      .in('TABLE_ID', secondaryIds)

    if (secErr) throw secErr
  }

  // Share VIP label across all merged tables if present
  const sharedLabel = preview.allMembers.find((t) => t.LABEL_ID != null)?.LABEL_ID ?? null
  if (sharedLabel != null) {
    await supabase
      .schema('tables')
      .from('Active_Tables')
      .update({ LABEL_ID: sharedLabel })
      .in('TABLE_ID', allMemberIds)
  }

  return fetchTablesByIds(allMemberIds)
}

/**
 * Unmerge a group in Active_Tables.
 */
export async function unmergeTables(primaryTableId: number): Promise<TableData[]> {
  const { data: secondaries, error: secFetchErr } = await supabase
    .schema('tables')
    .from('Active_Tables')
    .select('TABLE_ID')
    .eq('MERGE_GROUP_ID', primaryTableId)

  if (secFetchErr) throw secFetchErr

  const secondaryIds = (secondaries ?? []).map((t) => Number(t.TABLE_ID))
  if (secondaryIds.length === 0) throw new Error('This table has no merged members to unmerge.')

  const allGroupTableIds = [primaryTableId, ...secondaryIds]

  // Check active orders
  const { data: activeOrders } = await supabase
    .from('Restaurant_Orders')
    .select('ORDER_ID')
    .in('TABLE_ID', allGroupTableIds)
    .in('ORDER_STATUS', ACTIVE_ORDER_STATUSES)

  if (activeOrders && activeOrders.length > 0) {
    throw new Error('Cannot unmerge: This table group currently has active order(s). Settle or cancel orders before unmerging.')
  }

  const { error: releaseErr } = await supabase
    .schema('tables')
    .from('Active_Tables')
    .update({
      MERGE_GROUP_ID: null,
      MERGE_PERSISTENCY: null,
      STATUS: 'AVAILABLE',
      SEATED_GUEST_COUNT: 0,
      OCCUPIED_SINCE: null,
    })
    .in('TABLE_ID', allGroupTableIds)

  if (releaseErr) throw releaseErr

  return fetchTablesByIds(allGroupTableIds)
}

export async function saveTableMerge(
  captainId: number,
  memberIds: number[],
  persistency: 'TEMPORARY' | 'CONTINOUOUS' = 'TEMPORARY',
): Promise<TableData[]> {
  const selectedIds = [captainId, ...memberIds]

  // Reset any previous merge links for affected tables
  await supabase
    .schema('tables')
    .from('Active_Tables')
    .update({ MERGE_GROUP_ID: null, MERGE_PERSISTENCY: null })
    .in('TABLE_ID', selectedIds)

  if (memberIds.length > 0) {
    await supabase
      .schema('tables')
      .from('Active_Tables')
      .update({
        MERGE_GROUP_ID: null,
        MERGE_PERSISTENCY: persistency,
      })
      .eq('TABLE_ID', captainId)

    await supabase
      .schema('tables')
      .from('Active_Tables')
      .update({
        MERGE_GROUP_ID: captainId,
        MERGE_PERSISTENCY: persistency,
      })
      .in('TABLE_ID', memberIds)
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('monolith-order-update', { detail: { type: 'tables_sync', captainId, memberIds, persistency } })
    )
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        const bc = new BroadcastChannel('monolith_order_events')
        bc.postMessage({ type: 'tables_sync', captainId, memberIds, persistency })
        bc.close()
      } catch {
        // ignore
      }
    }
  }

  return fetchTablesByIds(selectedIds)
}

export async function updateSeatedPax(tableId: number, newCount: number): Promise<TableData> {
  const updatedRows = await updateTable(tableId, { seatedPax: newCount })
  const updated = updatedRows.find((r) => r.TABLE_ID === tableId) ?? updatedRows[0]
  if (!updated) throw new Error('Failed to update pax.')
  return updated
}

/**
 * Updates the merge persistency of an entire merged group ('TEMPORARY' or 'CONTINOUOUS').
 */
export async function setTableMergePersistency(
  tableId: number,
  persistency: 'TEMPORARY' | 'CONTINOUOUS',
): Promise<void> {
  const { data: target } = await supabase
    .schema('tables')
    .from('Active_Tables')
    .select('TABLE_ID, MERGE_GROUP_ID')
    .eq('TABLE_ID', tableId)
    .maybeSingle()

  if (!target) return
  const anchorId = target.MERGE_GROUP_ID != null ? target.MERGE_GROUP_ID : target.TABLE_ID

  await supabase
    .schema('tables')
    .from('Active_Tables')
    .update({ MERGE_PERSISTENCY: persistency })
    .or(`TABLE_ID.eq.${anchorId},MERGE_GROUP_ID.eq.${anchorId}`)
}
