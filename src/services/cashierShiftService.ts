import { supabase } from '@/lib/supabase'
import type { StaffCodeItem } from '@/types/account'
import type {
  CashierShift,
  CashierStaffValidationResult,
  ShiftSummaryMetrics,
  CashierShiftSummary,
  ShiftPaymentBreakdown,
  ShiftTransactionRow,
} from '@/types/cashierShift'
import { fetchStaffCodes } from './staffCodeService'
import { logCashierAction } from './cashierAuditService'
import { getActiveBusinessDay } from './businessDayService'

const LOCAL_STORAGE_SHIFT_ID = 'monolith_cashier_shift_id'
const LOCAL_STORAGE_STAFF_ID = 'monolith_cashier_staff_id'
const LOCAL_STORAGE_SHIFTS_FALLBACK = 'monolith_cashier_shifts_fallback'

// ─── Local Fallback Storage Helpers ──────────────────────────────────────────

function getFallbackShifts(): CashierShift[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_SHIFTS_FALLBACK)
    if (raw) return JSON.parse(raw) as CashierShift[]
  } catch (err) {
    console.warn('[cashierShiftService] Error reading fallback shifts:', err)
  }
  return []
}

function saveFallbackShift(shift: CashierShift): void {
  try {
    const shifts = getFallbackShifts()
    const index = shifts.findIndex((s) => s.shiftId === shift.shiftId)
    if (index >= 0) {
      shifts[index] = shift
    } else {
      shifts.unshift(shift)
    }
    localStorage.setItem(LOCAL_STORAGE_SHIFTS_FALLBACK, JSON.stringify(shifts))
  } catch (err) {
    console.warn('[cashierShiftService] Error saving fallback shift:', err)
  }
}

// ─── Staff ID Validation ─────────────────────────────────────────────────────

/**
 * Validates a Staff ID against the Staff_Codes table.
 * Enforces role authorization and account status.
 */
export async function validateCashierStaff(staffId: number): Promise<CashierStaffValidationResult> {
  if (!staffId || isNaN(staffId) || staffId <= 0) {
    return {
      valid: false,
      error: 'Please enter a valid numeric Staff ID.',
    }
  }

  let staff: StaffCodeItem | null = null

  try {
    // Query Staff_Codes table
    const { data, error } = await supabase
      .schema('staff')
      .from('Staff_Codes')
      .select('*')
      .eq('CODE_ID', staffId)
      .maybeSingle()

    if (error || !data) {
      // Try public view
      const { data: pubData } = await supabase
        .from('Staff_Codes')
        .select('*')
        .eq('CODE_ID', staffId)
        .maybeSingle()

      if (pubData) {
        staff = {
          codeId: Number(pubData.CODE_ID),
          staffName: String(pubData.STAFF_NAME || 'Staff'),
          staffRole: String(pubData.STAFF_ROLE || 'STAFF').toUpperCase() as StaffCodeItem['staffRole'],
          status: String(pubData.STATUS || 'ACTIVE').toUpperCase() as StaffCodeItem['status'],
        }
      }
    } else {
      staff = {
        codeId: Number(data.CODE_ID),
        staffName: String(data.STAFF_NAME || 'Staff'),
        staffRole: String(data.STAFF_ROLE || 'STAFF').toUpperCase() as StaffCodeItem['staffRole'],
        status: String(data.STATUS || 'ACTIVE').toUpperCase() as StaffCodeItem['status'],
      }
    }
  } catch (err) {
    console.warn('[cashierShiftService] Supabase Staff_Codes query error, checking fallback:', err)
  }

  // Fallback to local staff service if network/schema error
  if (!staff) {
    const allStaff = await fetchStaffCodes({}, 1, 100)
    staff = allStaff.codes.find((s) => s.codeId === staffId) ?? null
  }

  // 1. Check if staff exists
  if (!staff) {
    return {
      valid: false,
      error: 'Invalid Staff ID. Please enter a valid active cashier Staff ID.',
    }
  }

  // 2. Check Status
  if (staff.status === 'INACTIVE') {
    return {
      valid: false,
      error: 'This staff account is inactive. Please contact an administrator.',
    }
  }

  if (staff.status === 'SUSPENDED') {
    return {
      valid: false,
      error: 'This staff account is suspended. Please contact an administrator.',
    }
  }

  // 3. Check Role Authorization
  // Authorized roles for Cashier interface: CASHIER, ADMIN, MANAGER
  const authorizedRoles = ['CASHIER', 'ADMIN', 'MANAGER']
  const normalizedRole = staff.staffRole?.toUpperCase() || ''

  if (!authorizedRoles.includes(normalizedRole)) {
    return {
      valid: false,
      error: 'This Staff ID is not authorized to operate the cashier interface.',
    }
  }

  return {
    valid: true,
    staff,
  }
}

// ─── Shift Operations ────────────────────────────────────────────────────────

/**
 * Starts a new cashier shift or restores an existing active shift for the staff member.
 */
export async function startCashierShift(staffId: number): Promise<CashierShift> {
  const validation = await validateCashierStaff(staffId)
  if (!validation.valid || !validation.staff) {
    throw new Error(validation.error || 'Staff ID validation failed.')
  }

  const staff = validation.staff

  // Business Day verification: A shift cannot be started when Business Day is closed
  const activeDay = await getActiveBusinessDay()
  if (!activeDay || activeDay.status !== 'OPEN') {
    throw new Error(
      'Cannot start cashier shift: The Business Day is currently closed. Please contact an administrator to start the business day.',
    )
  }

  // Check if this staff already has an ACTIVE shift in Supabase or fallback
  const existingActive = await findActiveShiftForStaff(staffId)
  if (existingActive) {
    // Restore the active shift
    localStorage.setItem(LOCAL_STORAGE_SHIFT_ID, String(existingActive.shiftId))
    localStorage.setItem(LOCAL_STORAGE_STAFF_ID, String(staffId))
    return {
      ...existingActive,
      businessDayId: activeDay.businessDayId,
      staffName: staff.staffName,
      staffRole: staff.staffRole,
    }
  }

  // Create new Shift record
  const now = new Date().toISOString()
  let newShift: CashierShift = {
    shiftId: Date.now(),
    staffId,
    businessDayId: activeDay.businessDayId,
    startedAt: now,
    endedAt: null,
    status: 'ACTIVE',
    totalEarning: 0,
    totalTablesHandled: 0,
    staffName: staff.staffName,
    staffRole: staff.staffRole,
  }

  try {
    const payload = {
      STAFF_ID: staffId,
      BUSINESS_DAY_ID: activeDay.businessDayId,
      STARTED_AT: now,
      STATUS: 'ACTIVE',
      TOTAL_EARNING: 0,
      TOTAL_TABLES_HANDLED: 0,
    }

    const { data, error } = await supabase
      .schema('staff')
      .from('Cashier_Shifts')
      .insert([payload])
      .select('*')
      .single()

    if (!error && data) {
      newShift = mapDbRowToCashierShift(data, staff)
    } else {
      // Try public view
      const { data: pubData, error: pubError } = await supabase
        .from('Cashier_Shifts')
        .insert([payload])
        .select('*')
        .single()

      if (!pubError && pubData) {
        newShift = mapDbRowToCashierShift(pubData, staff)
      }
    }
  } catch (err) {
    console.warn('[cashierShiftService] Supabase Cashier_Shifts insert failed, using fallback:', err)
  }

  // Persist session references and fallback
  localStorage.setItem(LOCAL_STORAGE_SHIFT_ID, String(newShift.shiftId))
  localStorage.setItem(LOCAL_STORAGE_STAFF_ID, String(staffId))
  saveFallbackShift(newShift)

  // Append SHIFT_STARTED audit record
  void logCashierAction({
    action: 'SHIFT_STARTED',
    businessDayId: activeDay.businessDayId,
    shiftId: newShift.shiftId,
    staffId: newShift.staffId,
    entityType: 'SHIFT',
    entityId: String(newShift.shiftId),
    description: `Cashier shift started by ${staff.staffName} (${staff.staffRole}) for Business Day #${activeDay.businessDayId}`,
    metadata: {
      business_day_id: activeDay.businessDayId,
      staff_name: staff.staffName,
      staff_role: staff.staffRole,
      started_at: newShift.startedAt,
    },
  })

  return newShift
}

/**
 * Finds an active shift for a staff member.
 */
async function findActiveShiftForStaff(staffId: number): Promise<CashierShift | null> {
  try {
    const { data, error } = await supabase
      .schema('staff')
      .from('Cashier_Shifts')
      .select('*')
      .eq('STAFF_ID', staffId)
      .eq('STATUS', 'ACTIVE')
      .maybeSingle()

    if (!error && data) {
      return mapDbRowToCashierShift(data)
    }

    // Try public view
    const { data: pubData } = await supabase
      .from('Cashier_Shifts')
      .select('*')
      .eq('STAFF_ID', staffId)
      .eq('STATUS', 'ACTIVE')
      .maybeSingle()

    if (pubData) {
      return mapDbRowToCashierShift(pubData)
    }
  } catch {
    // fallback check below
  }

  const fallbackShifts = getFallbackShifts()
  return fallbackShifts.find((s) => s.staffId === staffId && s.status === 'ACTIVE') ?? null
}

/**
 * Authoritatively retrieves the active shift by ID, verifying that STATUS === 'ACTIVE'.
 */
export async function getActiveCashierShift(shiftId?: number): Promise<CashierShift | null> {
  const targetId = shiftId ?? (Number(localStorage.getItem(LOCAL_STORAGE_SHIFT_ID)) || null)
  if (!targetId) return null

  let shift: CashierShift | null = null

  try {
    const { data, error } = await supabase
      .schema('staff')
      .from('Cashier_Shifts')
      .select('*')
      .eq('SHIFT_ID', targetId)
      .maybeSingle()

    if (!error && data) {
      shift = mapDbRowToCashierShift(data)
    } else {
      const { data: pubData } = await supabase
        .from('Cashier_Shifts')
        .select('*')
        .eq('SHIFT_ID', targetId)
        .maybeSingle()

      if (pubData) {
        shift = mapDbRowToCashierShift(pubData)
      }
    }
  } catch {
    // ignore
  }

  if (!shift) {
    const fallbackShifts = getFallbackShifts()
    shift = fallbackShifts.find((s) => s.shiftId === targetId) ?? null
  }

  // Only consider valid if STATUS is ACTIVE
  if (!shift || shift.status !== 'ACTIVE') {
    return null
  }

  // Attach staff details
  if (shift.staffId) {
    const validation = await validateCashierStaff(shift.staffId)
    if (validation.valid && validation.staff) {
      shift.staffName = validation.staff.staffName
      shift.staffRole = validation.staff.staffRole
    }
  }

  return shift
}

/**
 * Finalizes and ends a cashier shift.
 */
export async function endCashierShift(
  shiftId: number,
  totals?: { totalEarning?: number; totalTablesHandled?: number },
): Promise<CashierShift> {
  const activeShift = await getActiveCashierShift(shiftId)
  const now = new Date().toISOString()
  const finalEarning = totals?.totalEarning ?? activeShift?.totalEarning ?? 0
  const finalTables = totals?.totalTablesHandled ?? activeShift?.totalTablesHandled ?? 0

  const updatedShift: CashierShift = {
    shiftId,
    staffId: activeShift?.staffId ?? (Number(localStorage.getItem(LOCAL_STORAGE_STAFF_ID)) || 0),
    startedAt: activeShift?.startedAt ?? now,
    endedAt: now,
    status: 'ENDED',
    totalEarning: finalEarning,
    totalTablesHandled: finalTables,
    staffName: activeShift?.staffName,
    staffRole: activeShift?.staffRole,
  }

  // 1. Update in Supabase
  try {
    const payload = {
      STATUS: 'ENDED',
      ENDED_AT: now,
      TOTAL_EARNING: finalEarning,
      TOTAL_TABLES_HANDLED: finalTables,
    }

    const { error } = await supabase
      .schema('staff')
      .from('Cashier_Shifts')
      .update(payload)
      .eq('SHIFT_ID', shiftId)

    if (error) {
      await supabase
        .from('Cashier_Shifts')
        .update(payload)
        .eq('SHIFT_ID', shiftId)
    }
  } catch (err) {
    console.warn('[cashierShiftService] Failed to update shift in Supabase:', err)
  }

  // 2. Update in fallback storage
  saveFallbackShift(updatedShift)

  // 3. Log SHIFT_ENDED audit record
  await logCashierAction({
    action: 'SHIFT_ENDED',
    shiftId,
    staffId: updatedShift.staffId,
    entityType: 'SHIFT',
    entityId: String(shiftId),
    description: `Shift ended by ${updatedShift.staffName || 'Cashier'}. Handled ${finalTables} table(s), total earnings: ₱${finalEarning.toFixed(2)}`,
    metadata: {
      total_earning: finalEarning,
      total_tables_handled: finalTables,
      started_at: updatedShift.startedAt,
      ended_at: now,
    },
  })

  // 4. Clear cashier operational session from localStorage
  localStorage.removeItem(LOCAL_STORAGE_SHIFT_ID)
  localStorage.removeItem(LOCAL_STORAGE_STAFF_ID)

  return updatedShift
}

// ─── Shift Summary Calculator ────────────────────────────────────────────────

/**
 * Computes metrics during an active shift for the End Shift summary modal.
 */
export async function calculateShiftMetrics(startedAt: string): Promise<ShiftSummaryMetrics> {
  const startTime = new Date(startedAt).getTime()
  const nowTime = Date.now()
  const durationMinutes = Math.max(1, Math.round((nowTime - startTime) / 60000))

  let totalEarnings = 0
  let tablesHandled = 0
  let ordersHandled = 0

  try {
    // Query Completed_Orders from analytics or Restaurant_Orders settled since startedAt
    const { data: orders } = await supabase
      .schema('orders')
      .from('Restaurant_Orders')
      .select('ORDER_ID, TOTAL_AMOUNT, TABLE_ID, UPDATED_AT, ORDER_STATUS')
      .in('ORDER_STATUS', ['COMPLETED', 'SETTLED', 'PAID'])
      .gte('UPDATED_AT', startedAt)

    if (orders && orders.length > 0) {
      ordersHandled = orders.length
      const uniqueTables = new Set<number>()
      orders.forEach((o) => {
        totalEarnings += Number(o.TOTAL_AMOUNT || 0)
        if (o.TABLE_ID) uniqueTables.add(Number(o.TABLE_ID))
      })
      tablesHandled = uniqueTables.size
    }
  } catch {
    // Fallback: estimate based on fallback audit logs
    const fallbackAudit = (localStorage.getItem('monolith_cashier_audit_logs_fallback') || '[]')
    try {
      const logs = JSON.parse(fallbackAudit) as Array<{ action: string; createdAt: string; metadata?: Record<string, unknown> }>
      const shiftLogs = logs.filter((l) => new Date(l.createdAt).getTime() >= startTime)
      const paymentLogs = shiftLogs.filter((l) => l.action === 'PAYMENT_COMPLETED')
      tablesHandled = paymentLogs.length
      paymentLogs.forEach((p) => {
        totalEarnings += Number(p.metadata?.['amount'] || 0)
      })
    } catch {
      // ignore
    }
  }

  return {
    totalEarnings,
    tablesHandled,
    ordersHandled,
    durationMinutes,
    startedAt,
  }
}

/**
 * Computes a rich End of Shift Summary for a specific Cashier Shift.
 * Aggregates gross revenue, completed orders, customers served, payment method breakdown,
 * discounts/voids, and drill-down transaction rows.
 */
export async function calculateShiftSummary(shift: CashierShift): Promise<CashierShiftSummary> {
  const startTime = shift.startedAt
  const endTime = shift.endedAt || new Date().toISOString()
  const durationMinutes = Math.max(1, Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 60000))

  // 1. Fetch completed orders from Completed_Orders (system_history or public schema)
  let completedRows: Array<Record<string, unknown>> = []
  try {
    let dbOrders: Array<Record<string, unknown>> | null = null
    try {
      const res = await supabase
        .schema('system_history')
        .from('Completed_Orders')
        .select('*')
        .or(`SHIFT_ID.eq.${shift.shiftId},COMPLETED_AT.gte.${startTime}`)
        .order('COMPLETED_AT', { ascending: false })
      if (!res.error && res.data) {
        dbOrders = res.data
      } else {
        throw res.error
      }
    } catch {
      const res = await supabase
        .from('Completed_Orders')
        .select('*')
        .or(`SHIFT_ID.eq.${shift.shiftId},COMPLETED_AT.gte.${startTime}`)
        .order('COMPLETED_AT', { ascending: false })
      dbOrders = res.data
    }

    if (dbOrders && dbOrders.length > 0) {
      completedRows = dbOrders.filter((o) => {
        if (o.SHIFT_ID && Number(o.SHIFT_ID) === shift.shiftId) return true
        if (o.STAFF_ID && Number(o.STAFF_ID) === shift.staffId) {
          const cTime = String(o.COMPLETED_AT || o.TIME || '')
          return cTime >= startTime && cTime <= endTime
        }
        return false
      })
    }
  } catch (err) {
    console.warn('[cashierShiftService] Failed to query Completed_Orders:', err)
  }

  // 2. Fetch audit logs for the shift (for voids, cancellations, discounts)
  let auditRows: Array<Record<string, unknown>> = []
  try {
    let dbLogs: Array<Record<string, unknown>> | null = null
    try {
      const res = await supabase
        .schema('staff')
        .from('Audit_Logs')
        .select('*')
        .gte('CREATED_AT', startTime)
        .lte('CREATED_AT', endTime)
      if (!res.error && res.data) dbLogs = res.data
    } catch {
      try {
        const res2 = await supabase
          .from('Audit_Logs')
          .select('*')
          .gte('CREATED_AT', startTime)
          .lte('CREATED_AT', endTime)
        if (!res2.error && res2.data) dbLogs = res2.data
      } catch {
        // ignore
      }
    }
    if (dbLogs) {
      auditRows = dbLogs.filter((l) => {
        const sId = Number(l['STAFF_ID'] || l['staffId'])
        const shId = Number(l['SHIFT_ID'] || l['shiftId'])
        return shId === shift.shiftId || sId === shift.staffId
      })
    }
  } catch {
    // ignore
  }

  // Fallback audit logs from localStorage
  try {
    const raw = localStorage.getItem('monolith_cashier_audit_logs_fallback')
    if (raw) {
      const localLogs = JSON.parse(raw) as Array<Record<string, unknown>>
      const matchedLocal = localLogs.filter((l) => {
        const t = String(l.createdAt || '')
        const shId = Number(l.shiftId)
        const sId = Number(l.staffId)
        const inTime = t >= startTime && t <= endTime
        return inTime && (shId === shift.shiftId || sId === shift.staffId)
      })
      auditRows = [...auditRows, ...matchedLocal]
    }
  } catch {
    // ignore
  }

  let grossRevenue = 0
  let subtotalRevenue = 0
  let totalDiscounts = 0
  let customersServed = 0
  const uniqueTables = new Set<string>()
  const paymentMethodMap: Record<string, { count: number; total: number }> = {}
  const transactionsList: ShiftTransactionRow[] = []

  for (const row of completedRows) {
    const total = Number(row['TOTAL_BILL'] || row['TOTAL_AMOUNT'] || 0)
    const subtotal = Number(row['SUBTOTAL_BILL'] || total)
    const discount = Number(row['DISCOUNT_AMOUNT'] || Math.max(subtotal - total, 0))
    const guests = Math.max(Number(row['GUEST_COUNT'] || 1), 1)
    const method = String(row['PAYMENT_METHOD'] || 'CASH').toUpperCase()
    const orderId = Number(row['ORIGINAL_ORDER_ID'] || row['ORDER_ID'] || 0)
    const tableNum = String(row['TABLE_NUM'] || row['TABLE_ID'] || '0')
    const time = String(row['COMPLETED_AT'] || row['TIME'] || startTime)

    grossRevenue += total
    subtotalRevenue += subtotal
    totalDiscounts += discount
    customersServed += guests
    uniqueTables.add(tableNum)

    if (!paymentMethodMap[method]) {
      paymentMethodMap[method] = { count: 0, total: 0 }
    }
    paymentMethodMap[method].count += 1
    paymentMethodMap[method].total += total

    transactionsList.push({
      orderId,
      time,
      tableLabel: `Table ${tableNum}`,
      staffId: shift.staffId,
      cashierName: shift.staffName || `Staff #${shift.staffId}`,
      shiftId: shift.shiftId,
      paymentMethod: method,
      amount: total,
      discount,
      status: 'COMPLETED',
    })
  }

  // If completedRows was empty but we have payment completed audit logs (offline / fallback mode):
  if (transactionsList.length === 0) {
    const paymentLogs = auditRows.filter((l) => String(l['ACTION'] || l['action']) === 'PAYMENT_COMPLETED')
    for (const p of paymentLogs) {
      const meta = (p['METADATA'] || p['metadata'] || {}) as Record<string, unknown>
      const total = Number(meta['total'] || meta['amount'] || 0)
      const subtotal = Number(meta['subtotal'] || total)
      const discount = Number(meta['custom_discount'] || 0)
      const method = String(meta['payment_method'] || 'CASH').toUpperCase()
      const orderIds = (meta['order_ids'] as number[] | undefined) || []
      const tableNums = (meta['table_nums'] as number[] | undefined) || []
      const time = String(p['CREATED_AT'] || p['createdAt'] || startTime)

      grossRevenue += total
      subtotalRevenue += subtotal
      totalDiscounts += discount
      customersServed += Math.max(orderIds.length, 1)
      tableNums.forEach((t) => uniqueTables.add(String(t)))

      if (!paymentMethodMap[method]) {
        paymentMethodMap[method] = { count: 0, total: 0 }
      }
      paymentMethodMap[method].count += Math.max(orderIds.length, 1)
      paymentMethodMap[method].total += total

      transactionsList.push({
        orderId: orderIds[0] || Number(p['ENTITY_ID'] || p['entityId'] || 0),
        time,
        tableLabel: `Table ${tableNums.join(' + ') || '1'}`,
        staffId: shift.staffId,
        cashierName: shift.staffName || `Staff #${shift.staffId}`,
        shiftId: shift.shiftId,
        paymentMethod: method,
        amount: total,
        discount,
        status: 'COMPLETED',
      })
    }
  }

  // Count voids and cancellations from audit rows
  let voidsCount = 0
  for (const log of auditRows) {
    const act = String(log['ACTION'] || log['action'] || '')
    if (act === 'ORDER_CANCELLED' || act === 'ORDER_DELETED' || act === 'PAYMENT_VOIDED') {
      voidsCount += 1
    }
  }

  const paymentBreakdown: ShiftPaymentBreakdown[] = Object.entries(paymentMethodMap).map(([method, data]) => ({
    method,
    count: data.count,
    total: data.total,
    percentage: grossRevenue > 0 ? (data.total / grossRevenue) * 100 : 0,
  }))
  paymentBreakdown.sort((a, b) => b.total - a.total)

  transactionsList.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())

  const completedOrdersCount = transactionsList.length
  const averageOrderValue = completedOrdersCount > 0 ? grossRevenue / completedOrdersCount : 0
  const averageSpendPerCustomer = customersServed > 0 ? grossRevenue / customersServed : 0

  return {
    shift,
    grossRevenue,
    subtotalRevenue,
    totalDiscounts,
    completedOrdersCount,
    cancelledOrdersCount: voidsCount,
    customersServed,
    tablesHandled: uniqueTables.size,
    averageOrderValue,
    averageSpendPerCustomer,
    durationMinutes,
    paymentBreakdown,
    adjustments: {
      discounts: totalDiscounts,
      refunds: 0,
      voids: voidsCount,
    },
    transactionsList,
  }
}

// ─── Mapper ───────────────────────────────────────────────────────────────────

function mapDbRowToCashierShift(row: Record<string, unknown>, staff?: StaffCodeItem): CashierShift {
  return {
    shiftId: Number(row['SHIFT_ID']),
    staffId: Number(row['STAFF_ID']),
    businessDayId: row['BUSINESS_DAY_ID'] ? Number(row['BUSINESS_DAY_ID']) : null,
    startedAt: String(row['STARTED_AT'] || new Date().toISOString()),
    endedAt: row['ENDED_AT'] ? String(row['ENDED_AT']) : null,
    status: (String(row['STATUS'] || 'ACTIVE').toUpperCase() as CashierShift['status']) || 'ACTIVE',
    totalEarning: Number(row['TOTAL_EARNING'] || 0),
    totalTablesHandled: Number(row['TOTAL_TABLES_HANDLED'] || 0),
    staffName: staff?.staffName,
    staffRole: staff?.staffRole,
  }
}
