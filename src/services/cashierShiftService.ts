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
import { ensureRoleStaffRecord, recordShiftHistoryAndReset } from './shiftHistoryService'
import {
  getDeviceId,
  getDeviceName,
  getTerminalSession,
  saveTerminalSession,
  clearTerminalSession,
  checkStaffActiveOnOtherTerminal,
} from './terminalSessionService'

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
          shiftStatus: 'ENDED',
          codeStatus: String(pubData.STATUS || 'ACTIVE').toUpperCase() as StaffCodeItem['codeStatus'],
          status: String(pubData.STATUS || 'ACTIVE').toUpperCase() as StaffCodeItem['status'],
        }
      }
    } else {
      staff = {
        codeId: Number(data.CODE_ID),
        staffName: String(data.STAFF_NAME || 'Staff'),
        staffRole: String(data.STAFF_ROLE || 'STAFF').toUpperCase() as StaffCodeItem['staffRole'],
        shiftStatus: 'ENDED',
        codeStatus: String(data.STATUS || 'ACTIVE').toUpperCase() as StaffCodeItem['codeStatus'],
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
  // Authorized roles for Cashier interface: CASHIER only
  const normalizedRole = staff.staffRole?.toUpperCase() || ''

  if (normalizedRole !== 'CASHIER') {
    return {
      valid: false,
      error: `Staff #${staff.codeId} (${staff.staffName}) is assigned as ${staff.staffRole}. Only CASHIER staff can operate the checkout terminal.`,
    }
  }

  return {
    valid: true,
    staff,
  }
}

// ─── Shift Operations ────────────────────────────────────────────────────────

/**
 * Starts a new cashier shift or restores an existing active shift for the staff member on this terminal.
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

  // Cross-PC conflict check: Verify that this staff member is not currently active on another terminal
  const conflict = await checkStaffActiveOnOtherTerminal(staffId, 'CASHIER')
  if (conflict.isConflict) {
    throw new Error(
      `Staff #${staffId} (${conflict.staffName}) is already on an active shift on another terminal. Sessions are unique per PC to prevent interference.`,
    )
  }

  // Check if this terminal already holds an active shift for this staff
  const existingActive = await findActiveShiftForStaff(staffId)
  if (existingActive) {
    saveTerminalSession({
      staffId,
      staffName: staff.staffName,
      staffRole: 'CASHIER',
      shiftId: existingActive.shiftId,
      startedAt: existingActive.startedAt,
      deviceId: getDeviceId(),
      deviceName: getDeviceName(),
    })
    return {
      ...existingActive,
      businessDayId: activeDay.businessDayId,
      staffName: staff.staffName,
      staffRole: staff.staffRole,
    }
  }

  // Create new Shift record
  const now = new Date().toISOString()
  const shiftId = Date.now()
  let newShift: CashierShift = {
    shiftId,
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

  // 1. Update Staff_Codes table in Supabase
  try {
    const codePayload = {
      SHIFT_STATUS: 'ONGOING',
      SHIFT_START: now,
      SHIFT_END: null,
    }
    const { error: codeErr } = await supabase
      .schema('staff')
      .from('Staff_Codes')
      .update(codePayload)
      .eq('CODE_ID', staffId)

    if (codeErr) {
      await supabase.from('Staff_Codes').update(codePayload).eq('CODE_ID', staffId)
    }
  } catch (err) {
    console.warn('[cashierShiftService] Update Staff_Codes shift error:', err)
  }

  // 2. Ensure record exists in Cashier_Staff and reset shift metrics to 0
  try {
    await ensureRoleStaffRecord(staffId, 'CASHIER')
    await supabase
      .schema('staff')
      .from('Cashier_Staff')
      .update({
        TOTAL_SHIFT_EARNING: 0,
        TOTAL_TABLES_HANDLED: 0,
      })
      .eq('STAFF_ID', staffId)
  } catch (err) {
    console.warn('[cashierShiftService] Update Cashier_Staff on start error:', err)
  }

  // 3. Save terminal session explicitly bound to THIS PC
  saveTerminalSession({
    staffId,
    staffName: staff.staffName,
    staffRole: 'CASHIER',
    shiftId: newShift.shiftId,
    startedAt: now,
    deviceId: getDeviceId(),
    deviceName: getDeviceName(),
  })
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
 * Finds an active shift for a cashier staff member.
 */
async function findActiveShiftForStaff(staffId: number): Promise<CashierShift | null> {
  try {
    const { data: codeData } = await supabase
      .schema('staff')
      .from('Staff_Codes')
      .select('*')
      .eq('CODE_ID', staffId)
      .eq('SHIFT_STATUS', 'ONGOING')
      .maybeSingle()

    if (codeData) {
      const { data: csData } = await supabase
        .schema('staff')
        .from('Cashier_Staff')
        .select('*')
        .eq('STAFF_ID', staffId)
        .limit(1)
        .maybeSingle()

      return {
        shiftId: Number(csData?.CASHIER_ID || codeData.CODE_ID),
        staffId: Number(codeData.CODE_ID),
        startedAt: String(codeData.SHIFT_START || new Date().toISOString()),
        endedAt: null,
        status: 'ACTIVE',
        totalEarning: Number(csData?.TOTAL_SHIFT_EARNING || 0),
        totalTablesHandled: Number(csData?.TOTAL_TABLES_HANDLED || 0),
        staffName: String(codeData.STAFF_NAME || 'Cashier'),
        staffRole: 'CASHIER',
      }
    }
  } catch {
    // fallback check below
  }

  const fallbackShifts = getFallbackShifts()
  return fallbackShifts.find((s) => s.staffId === staffId && s.status === 'ACTIVE') ?? null
}

/**
 * Authoritatively retrieves the active cashier shift for THIS terminal.
 */
export async function getActiveCashierShift(_shiftId?: number): Promise<CashierShift | null> {
  const terminalSession = getTerminalSession('CASHIER')
  if (!terminalSession) return null

  const staffId = terminalSession.staffId

  try {
    const { data: codeData, error } = await supabase
      .schema('staff')
      .from('Staff_Codes')
      .select('*')
      .eq('CODE_ID', staffId)
      .eq('SHIFT_STATUS', 'ONGOING')
      .maybeSingle()

    if (!error && codeData) {
      const { data: csData } = await supabase
        .schema('staff')
        .from('Cashier_Staff')
        .select('*')
        .eq('STAFF_ID', staffId)
        .limit(1)
        .maybeSingle()

      return {
        shiftId: terminalSession.shiftId || Number(csData?.CASHIER_ID || codeData.CODE_ID),
        staffId: Number(codeData.CODE_ID),
        startedAt: terminalSession.startedAt || String(codeData.SHIFT_START || new Date().toISOString()),
        endedAt: null,
        status: 'ACTIVE',
        totalEarning: Number(csData?.TOTAL_SHIFT_EARNING || 0),
        totalTablesHandled: Number(csData?.TOTAL_TABLES_HANDLED || 0),
        staffName: String(codeData.STAFF_NAME || 'Cashier'),
        staffRole: 'CASHIER',
      }
    } else if (!error && !codeData) {
      // Shift is ended in Supabase! Immediately purge local terminal session to stay 100% in sync
      clearTerminalSession('CASHIER', staffId)
      return null
    }
  } catch {
    // Network offline fallback
  }

  return {
    shiftId: terminalSession.shiftId,
    staffId: terminalSession.staffId,
    startedAt: terminalSession.startedAt,
    endedAt: null,
    status: 'ACTIVE',
    totalEarning: 0,
    totalTablesHandled: 0,
    staffName: terminalSession.staffName,
    staffRole: 'CASHIER',
  }
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
    staffId: activeShift?.staffId ?? (getTerminalSession('CASHIER')?.staffId || 0),
    startedAt: activeShift?.startedAt ?? now,
    endedAt: now,
    status: 'ENDED',
    totalEarning: finalEarning,
    totalTablesHandled: finalTables,
    staffName: activeShift?.staffName,
    staffRole: activeShift?.staffRole,
  }

  // 1. Record Shift_History, reset Cashier_Staff, and mark Staff_Codes ended in Supabase
  try {
    if (updatedShift.staffId) {
      await recordShiftHistoryAndReset(updatedShift.staffId, {
        staffName: updatedShift.staffName,
        staffRole: 'CASHIER',
        startedAt: updatedShift.startedAt,
        endedAt: now,
      })
    }
  } catch (err) {
    console.warn('[cashierShiftService] Failed to record shift history and reset in Supabase:', err)
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

  // 4. Clear cashier operational session from this terminal
  clearTerminalSession('CASHIER', updatedShift.staffId)

  return updatedShift
}

/**
 * Increments earnings and tables handled in Cashier_Staff upon settlement.
 */
export async function recordCashierSettlement(amount = 0): Promise<void> {
  const terminalSession = getTerminalSession('CASHIER')
  const staffId = terminalSession?.staffId
  if (!staffId) return

  try {
    // Ensure single row exists
    await ensureRoleStaffRecord(staffId, 'CASHIER')

    let currentRecord: Record<string, unknown> | null = null
    const { data: schemaData } = await supabase
      .schema('staff')
      .from('Cashier_Staff')
      .select('*')
      .eq('STAFF_ID', staffId)
      .limit(1)
      .maybeSingle()

    if (schemaData) {
      currentRecord = schemaData as Record<string, unknown>
    } else {
      const { data: pubData } = await supabase
        .from('Cashier_Staff')
        .select('*')
        .eq('STAFF_ID', staffId)
        .limit(1)
        .maybeSingle()
      if (pubData) currentRecord = pubData as Record<string, unknown>
    }

    const currentEarning = Number(currentRecord?.TOTAL_SHIFT_EARNING || 0)
    const currentTables = Number(currentRecord?.TOTAL_TABLES_HANDLED || 0)
    const newEarning = currentEarning + Number(amount)
    const newTables = currentTables + 1

    await supabase
      .schema('staff')
      .from('Cashier_Staff')
      .update({
        TOTAL_SHIFT_EARNING: newEarning,
        TOTAL_TABLES_HANDLED: newTables,
      })
      .eq('STAFF_ID', staffId)
  } catch (err) {
    console.warn('[cashierShiftService] recordCashierSettlement error:', err)
  }
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
    // Query completed orders from system_history.Order_History since startedAt
    const { data: histOrders } = await supabase
      .schema('system_history')
      .from('Order_History')
      .select('ORDER_ID, TOTAL_BILL, TABLE_ID, COMPLETED_AT')
      .gte('COMPLETED_AT', startedAt)

    if (histOrders && histOrders.length > 0) {
      ordersHandled = histOrders.length
      const uniqueTables = new Set<number>()
      histOrders.forEach((o) => {
        totalEarnings += Number(o.TOTAL_BILL || 0)
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

  // 1. Fetch completed orders from system_history.Order_History
  let completedRows: Array<Record<string, unknown>> = []
  try {
    const { data: dbOrders, error: orderErr } = await supabase
      .schema('system_history')
      .from('Order_History')
      .select('*')
      .gte('COMPLETED_AT', startTime)
      .lte('COMPLETED_AT', endTime)
      .order('COMPLETED_AT', { ascending: false })

    if (!orderErr && dbOrders && dbOrders.length > 0) {
      completedRows = dbOrders.filter((o) => {
        if (o.FROM_CASHIER_ID && Number(o.FROM_CASHIER_ID) === shift.staffId) return true
        if (o.BUSINESS_DAY_ID && shift.businessDayId && Number(o.BUSINESS_DAY_ID) === shift.businessDayId) return true
        return true
      })
    }
  } catch (err) {
    console.warn('[cashierShiftService] Failed to query Order_History:', err)
  }

  // 2. Fetch audit logs for the shift (from system_history.Action_History)
  let auditRows: Array<Record<string, unknown>> = []
  try {
    const { data: dbLogs } = await supabase
      .schema('system_history')
      .from('Action_History')
      .select('*')
      .gte('CREATED_AT', startTime)
      .lte('CREATED_AT', endTime)

    if (dbLogs) {
      auditRows = dbLogs.filter((l) => {
        const sId = Number(l['STAFF_ID'] || l['staffId'])
        return sId === shift.staffId
      })
    }
  } catch {
    // ignore
  }

  // Fallback audit logs from localStorage
  try {
    const raw =
      localStorage.getItem('monolith_action_history_fallback') ||
      localStorage.getItem('monolith_cashier_audit_logs_fallback')
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
    const act = String(log['ACTION_TYPE'] || log['ACTION'] || log['action'] || '')
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

export function mapDbRowToCashierShift(row: Record<string, unknown>, staff?: StaffCodeItem): CashierShift {
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

// ─── Simplified & Revamped Cashier Shift Summary (Table & Payments Modes) ────

export interface CashierShiftBilledOrder {
  orderId: number
  totalBill: number
  subtotalBill: number
  discountAmount: number
  paymentMethod: string
  items: Array<{ name: string; quantity: number; price?: number }>
  completedAt: string
}

export interface CashierShiftTableItem {
  tableKey: string
  tableId: number
  tableNum: number
  tableDisplay: string
  totalBilled: number
  totalDiscounts: number
  ordersCount: number
  invoiceIds: number[]
  receiptIds: number[]
  paymentMethods: string[]
  orders: CashierShiftBilledOrder[]
  lastBilledAt: string
}

export interface CashierShiftPaymentItem {
  receiptId: number
  invoiceId: number
  datePaid: string
  timeFormatted: string
  tableNum: number
  tableDisplay: string
  paymentType: string
  amountReceived: number
  changeGiven: number
  netTotal: number
  cashierName?: string
}

export interface CashierShiftRevampedSummary {
  metrics: {
    grossRevenue: number
    completedOrdersCount: number
    tablesHandled: number
    totalDiscounts: number
    durationMinutes: number
    startedAt: string
  }
  tables: CashierShiftTableItem[]
  payments: CashierShiftPaymentItem[]
}

export async function getCashierRevampedShiftSummary(
  shift: CashierShift,
): Promise<CashierShiftRevampedSummary> {
  const startTime = shift.startedAt
  const endTime = shift.endedAt || new Date().toISOString()
  const durationMinutes = Math.max(
    1,
    Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 60000),
  )

  // 1. Fetch completed orders from system_history.Order_History
  let completedRows: Array<Record<string, unknown>> = []
  try {
    const { data: dbOrders, error: orderErr } = await supabase
      .schema('system_history')
      .from('Order_History')
      .select('*')
      .gte('COMPLETED_AT', startTime)
      .lte('COMPLETED_AT', endTime)
      .order('COMPLETED_AT', { ascending: false })

    if (!orderErr && dbOrders && dbOrders.length > 0) {
      completedRows = dbOrders.filter((o) => {
        if (o.FROM_CASHIER_ID && Number(o.FROM_CASHIER_ID) === shift.staffId) return true
        if (o.BUSINESS_DAY_ID && shift.businessDayId && Number(o.BUSINESS_DAY_ID) === shift.businessDayId) return true
        return true
      })
    }
  } catch (err) {
    console.warn('[cashierShiftService] Error querying Order_History for revamped summary:', err)
  }

  // 2. Fetch receipts and invoices
  const receiptsList: Array<Record<string, unknown>> = []
  const invoicesMap = new Map<number, Record<string, unknown>>()
  try {
    const { data: recRows } = await supabase
      .schema('orders')
      .from('Order_Receipts')
      .select('*')
      .gte('DATE_PAID', startTime)
      .lte('DATE_PAID', endTime)
      .order('DATE_PAID', { ascending: false })

    if (recRows && recRows.length > 0) {
      receiptsList.push(...recRows)
      const invIds = recRows.map((r) => Number(r.INVOICE_ID)).filter(Boolean)
      if (invIds.length > 0) {
        const { data: invRows } = await supabase
          .schema('orders')
          .from('Order_Invoices')
          .select('*')
          .in('INVOICE_ID', invIds)

        if (invRows) {
          for (const inv of invRows) {
            invoicesMap.set(Number(inv.INVOICE_ID), inv)
          }
        }
      }
    }
  } catch (err) {
    console.warn('[cashierShiftService] Error querying receipts & invoices:', err)
  }

  // 3. Group by table for "Table" Mode
  const tablesMap = new Map<string, CashierShiftTableItem>()
  let grossRevenue = 0
  let totalDiscounts = 0
  let completedOrdersCount = 0

  for (const row of completedRows) {
    const total = Number(row['TOTAL_BILL'] || row['TOTAL_AMOUNT'] || 0)
    const subtotal = Number(row['SUBTOTAL_BILL'] || total)
    const discount = Number(row['DISCOUNT_AMOUNT'] || Math.max(subtotal - total, 0))
    const oId = Number(row['ORIGINAL_ORDER_ID'] || row['ORDER_ID'] || 0)
    const tId = Number(row['TABLE_ID'] || 0)
    const tNum = Number(row['TABLE_NUM']) || tId || 1
    const tDisplay = `Table ${tNum}`
    const tKey = `tbl_${tNum}`
    const pMethod = String(row['PAYMENT_METHOD'] || 'CASH').toUpperCase()
    const invId = row['INVOICE_ID'] ? Number(row['INVOICE_ID']) : null
    const recId = row['RECEIPT_ID'] ? Number(row['RECEIPT_ID']) : null
    const time = String(row['COMPLETED_AT'] || row['TIME'] || startTime)

    grossRevenue += total
    totalDiscounts += discount
    completedOrdersCount += 1

    const parsedItems: Array<{ name: string; quantity: number; price?: number }> = []
    if (Array.isArray(row['ORDER_ITEMS'])) {
      for (const it of row['ORDER_ITEMS'] as any[]) {
        parsedItems.push({
          name: String(it.item_name || it.itemName || 'Dish'),
          quantity: Number(it.quantity || 1),
          price: Number(it.price || it.unitPrice || 0),
        })
      }
    }

    const billedOrder: CashierShiftBilledOrder = {
      orderId: oId,
      totalBill: total,
      subtotalBill: subtotal,
      discountAmount: discount,
      paymentMethod: pMethod,
      items: parsedItems,
      completedAt: time,
    }

    const existingTable = tablesMap.get(tKey) || {
      tableKey: tKey,
      tableId: tId,
      tableNum: tNum,
      tableDisplay: tDisplay,
      totalBilled: 0,
      totalDiscounts: 0,
      ordersCount: 0,
      invoiceIds: [],
      receiptIds: [],
      paymentMethods: [],
      orders: [],
      lastBilledAt: time,
    }

    existingTable.totalBilled += total
    existingTable.totalDiscounts += discount
    existingTable.ordersCount += 1
    existingTable.orders.push(billedOrder)
    if (invId && !existingTable.invoiceIds.includes(invId)) existingTable.invoiceIds.push(invId)
    if (recId && !existingTable.receiptIds.includes(recId)) existingTable.receiptIds.push(recId)
    if (!existingTable.paymentMethods.includes(pMethod)) existingTable.paymentMethods.push(pMethod)
    if (new Date(time).getTime() > new Date(existingTable.lastBilledAt).getTime()) {
      existingTable.lastBilledAt = time
    }

    tablesMap.set(tKey, existingTable)
  }

  // Fallback if completedRows was empty but local audit has payments
  if (tablesMap.size === 0) {
    try {
      const raw =
        localStorage.getItem('monolith_action_history_fallback') ||
        localStorage.getItem('monolith_cashier_audit_logs_fallback')
      if (raw) {
        const localLogs = JSON.parse(raw) as Array<Record<string, unknown>>
        const paymentLogs = localLogs.filter(
          (l) =>
            String(l['action'] || l['ACTION']) === 'PAYMENT_COMPLETED' &&
            new Date(String(l['createdAt'] || '')).getTime() >= new Date(startTime).getTime(),
        )
        for (const p of paymentLogs) {
          const meta = (p['metadata'] || p['METADATA'] || {}) as Record<string, unknown>
          const total = Number(meta['total'] || meta['amount'] || 0)
          const discount = Number(meta['custom_discount'] || 0)
          const tableNums = (meta['table_nums'] as number[] | undefined) || [1]
          const tNum = tableNums[0] || 1
          const tKey = `tbl_${tNum}`
          const method = String(meta['payment_method'] || 'CASH').toUpperCase()
          const time = String(p['createdAt'] || startTime)

          grossRevenue += total
          totalDiscounts += discount
          completedOrdersCount += 1

          const existingTable = tablesMap.get(tKey) || {
            tableKey: tKey,
            tableId: tNum,
            tableNum: tNum,
            tableDisplay: `Table ${tNum}`,
            totalBilled: 0,
            totalDiscounts: 0,
            ordersCount: 0,
            invoiceIds: [],
            receiptIds: [],
            paymentMethods: [],
            orders: [],
            lastBilledAt: time,
          }

          existingTable.totalBilled += total
          existingTable.totalDiscounts += discount
          existingTable.ordersCount += 1
          if (!existingTable.paymentMethods.includes(method)) existingTable.paymentMethods.push(method)
          tablesMap.set(tKey, existingTable)
        }
      }
    } catch {
      // ignore
    }
  }

  const tablesList = Array.from(tablesMap.values())
  tablesList.sort((a, b) => new Date(b.lastBilledAt).getTime() - new Date(a.lastBilledAt).getTime())

  // 4. Construct Payments List hierarchied by time issued
  const paymentsList: CashierShiftPaymentItem[] = []

  for (const rec of receiptsList) {
    const rId = Number(rec['RECEIPT_ID'])
    const iId = Number(rec['INVOICE_ID'])
    const inv = invoicesMap.get(iId)
    const tNum = inv ? Number(inv['TABLE_NUM']) || 1 : 1
    const pType = String(rec['PAYMENT_TYPE'] || 'CASH').toUpperCase()
    const amtReceived = Number(rec['AMOUNT_RECEIVED'] || 0)
    const chgGiven = Number(rec['CHANGE_GIVEN'] || 0)
    const datePaid = String(rec['DATE_PAID'] || startTime)
    const netTotal = inv ? Number(inv['TOTAL'] || 0) : Math.max(0, amtReceived - chgGiven)

    const dateObj = new Date(datePaid)
    const timeFormatted = !isNaN(dateObj.getTime())
      ? dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '—'

    paymentsList.push({
      receiptId: rId,
      invoiceId: iId,
      datePaid,
      timeFormatted,
      tableNum: tNum,
      tableDisplay: `Table ${tNum}`,
      paymentType: pType,
      amountReceived: amtReceived,
      changeGiven: chgGiven,
      netTotal,
      cashierName: shift.staffName || `Staff #${shift.staffId}`,
    })
  }

  // If receiptsList from DB was empty, construct from tables orders or audit
  if (paymentsList.length === 0) {
    for (const tbl of tablesList) {
      for (const ord of tbl.orders) {
        const dateObj = new Date(ord.completedAt)
        const timeFormatted = !isNaN(dateObj.getTime())
          ? dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : '—'
        paymentsList.push({
          receiptId: tbl.receiptIds[0] || ord.orderId,
          invoiceId: tbl.invoiceIds[0] || ord.orderId,
          datePaid: ord.completedAt,
          timeFormatted,
          tableNum: tbl.tableNum,
          tableDisplay: tbl.tableDisplay,
          paymentType: ord.paymentMethod,
          amountReceived: ord.totalBill,
          changeGiven: 0,
          netTotal: ord.totalBill,
          cashierName: shift.staffName || `Staff #${shift.staffId}`,
        })
      }
    }
  }

  // Sort hierarchied by time issued: latest first
  paymentsList.sort((a, b) => new Date(b.datePaid).getTime() - new Date(a.datePaid).getTime())

  return {
    metrics: {
      grossRevenue,
      completedOrdersCount,
      tablesHandled: tablesList.length,
      totalDiscounts,
      durationMinutes,
      startedAt: startTime,
    },
    tables: tablesList,
    payments: paymentsList,
  }
}

