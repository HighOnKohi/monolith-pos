import { supabase } from '@/lib/supabase'
import type {
  BusinessDay,
  DailySummary,
  CashierDailyPerformance,
  DailyPaymentBreakdown,
  DailyTransactionRow,
  ActiveOrdersCheckResult,
  ActiveShiftsCheckResult,
} from '@/types/businessDay'
import type { CashierShift } from '@/types/cashierShift'
import type { ServiceShift } from '@/types/serviceShift'
import { logCashierAction } from './cashierAuditService'
import { fetchStaffCodes } from './staffCodeService'

const LOCAL_STORAGE_BUSINESS_DAYS_FALLBACK = 'monolith_business_days_fallback'
const LOCAL_STORAGE_ACTIVE_BUSINESS_DAY_ID = 'monolith_active_business_day_id'
const LOCAL_STORAGE_CASHIER_SHIFTS_FALLBACK = 'monolith_cashier_shifts_fallback'
const LOCAL_STORAGE_SERVICE_SHIFTS_FALLBACK = 'monolith_service_shifts_fallback'

// ─── Local Fallback Helpers ──────────────────────────────────────────────────

export function getFallbackBusinessDays(): BusinessDay[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_BUSINESS_DAYS_FALLBACK)
    if (raw) return JSON.parse(raw) as BusinessDay[]
  } catch (err) {
    console.warn('[businessDayService] Error reading fallback business days:', err)
  }
  return []
}

export function saveFallbackBusinessDay(day: BusinessDay): void {
  try {
    const days = getFallbackBusinessDays()
    const index = days.findIndex((d) => d.businessDayId === day.businessDayId)
    if (index >= 0) {
      days[index] = day
    } else {
      days.unshift(day)
    }
    localStorage.setItem(LOCAL_STORAGE_BUSINESS_DAYS_FALLBACK, JSON.stringify(days))
  } catch (err) {
    console.warn('[businessDayService] Error saving fallback business day:', err)
  }
}

export function getActiveFallbackBusinessDay(): BusinessDay | null {
  const days = getFallbackBusinessDays()
  return days.find((d) => d.status === 'OPEN') ?? null
}

// ─── Authoritative Business Day State ────────────────────────────────────────

/**
 * Retrieves the currently open Business Day from Supabase or fallback storage.
 */
export async function getActiveBusinessDay(): Promise<BusinessDay | null> {
  let day: BusinessDay | null = null

  try {
    const { data, error } = await supabase
      .schema('staff')
      .from('Business_Days')
      .select('*')
      .eq('STATUS', 'OPEN')
      .order('STARTED_AT', { ascending: false })
      .maybeSingle()

    if (!error && data) {
      day = mapDbRowToBusinessDay(data)
    } else {
      const { data: pubData, error: pubError } = await supabase
        .from('Business_Days')
        .select('*')
        .eq('STATUS', 'OPEN')
        .order('STARTED_AT', { ascending: false })
        .maybeSingle()

      if (!pubError && pubData) {
        day = mapDbRowToBusinessDay(pubData)
      }
    }
  } catch (err) {
    console.warn('[businessDayService] Supabase Business_Days check failed, checking fallback:', err)
  }

  if (!day) {
    day = getActiveFallbackBusinessDay()
  }

  if (day) {
    localStorage.setItem(LOCAL_STORAGE_ACTIVE_BUSINESS_DAY_ID, String(day.businessDayId))
  } else {
    localStorage.removeItem(LOCAL_STORAGE_ACTIVE_BUSINESS_DAY_ID)
  }

  return day
}

// ─── Active Orders & Active Shifts Checks ────────────────────────────────────

/**
 * Checks for any existing/unresolved orders in Restaurant_Orders.
 * Active statuses: REQUESTED, VERIFIED, PREPARING, READY, SERVED.
 */
export async function checkActiveOrders(): Promise<ActiveOrdersCheckResult> {
  const activeStatuses = ['REQUESTED', 'VERIFIED', 'PREPARING', 'READY', 'SERVED']
  try {
    const { data, error, count } = await supabase
      .from('Restaurant_Orders')
      .select('ORDER_ID, TABLE_ID, ORDER_STATUS, TOTAL_BILL', { count: 'exact' })
      .in('ORDER_STATUS', activeStatuses)

    if (!error && data) {
      const mapped = data.map((o) => ({
        orderId: Number(o.ORDER_ID),
        tableId: Number(o.TABLE_ID),
        status: String(o.ORDER_STATUS),
        totalBill: Number(o.TOTAL_BILL || 0),
      }))
      return {
        hasActiveOrders: mapped.length > 0,
        count: count ?? mapped.length,
        orders: mapped,
      }
    }
  } catch (err) {
    console.warn('[businessDayService] Failed to query active orders from Supabase:', err)
  }

  return {
    hasActiveOrders: false,
    count: 0,
    orders: [],
  }
}

/**
 * Checks for any active cashier or service shifts.
 */
export async function checkActiveShifts(): Promise<ActiveShiftsCheckResult> {
  const activeCashier: Array<{ shiftId: number; staffId: number; staffName?: string; startedAt: string }> = []
  const activeService: Array<{ shiftId: number; staffId: number; staffName?: string; startedAt: string }> = []

  // 1. Check Cashier Shifts in Supabase
  try {
    const { data: cData } = await supabase
      .schema('staff')
      .from('Cashier_Shifts')
      .select('SHIFT_ID, STAFF_ID, STARTED_AT, STATUS')
      .eq('STATUS', 'ACTIVE')

    if (cData && cData.length > 0) {
      for (const row of cData) {
        activeCashier.push({
          shiftId: Number(row.SHIFT_ID),
          staffId: Number(row.STAFF_ID),
          startedAt: String(row.STARTED_AT),
        })
      }
    }
  } catch {
    // Check fallback
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_CASHIER_SHIFTS_FALLBACK)
      if (raw) {
        const shifts = JSON.parse(raw) as CashierShift[]
        shifts.filter((s) => s.status === 'ACTIVE').forEach((s) => {
          activeCashier.push({
            shiftId: s.shiftId,
            staffId: s.staffId,
            staffName: s.staffName,
            startedAt: s.startedAt,
          })
        })
      }
    } catch {
      // ignore
    }
  }

  // 2. Check Service Shifts in Supabase
  try {
    const { data: sData } = await supabase
      .schema('staff')
      .from('Service_Shifts')
      .select('SHIFT_ID, STAFF_ID, STARTED_AT, STATUS')
      .eq('STATUS', 'ACTIVE')

    if (sData && sData.length > 0) {
      for (const row of sData) {
        activeService.push({
          shiftId: Number(row.SHIFT_ID),
          staffId: Number(row.STAFF_ID),
          startedAt: String(row.STARTED_AT),
        })
      }
    }
  } catch {
    // Check fallback
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_SERVICE_SHIFTS_FALLBACK)
      if (raw) {
        const shifts = JSON.parse(raw) as ServiceShift[]
        shifts.filter((s) => s.status === 'ACTIVE').forEach((s) => {
          activeService.push({
            shiftId: s.shiftId,
            staffId: s.staffId,
            staffName: s.staffName,
            startedAt: s.startedAt,
          })
        })
      }
    } catch {
      // ignore
    }
  }

  // Attach staff names if missing
  if (activeCashier.length > 0 || activeService.length > 0) {
    try {
      const staffRes = await fetchStaffCodes({}, 1, 100)
      const map = new Map(staffRes.codes.map((s) => [s.codeId, s.staffName]))
      activeCashier.forEach((c) => {
        if (!c.staffName) c.staffName = map.get(c.staffId) || `Staff #${c.staffId}`
      })
      activeService.forEach((s) => {
        if (!s.staffName) s.staffName = map.get(s.staffId) || `Staff #${s.staffId}`
      })
    } catch {
      // ignore
    }
  }

  return {
    hasActiveShifts: activeCashier.length > 0 || activeService.length > 0,
    cashierShifts: activeCashier,
    serviceShifts: activeService,
  }
}

// ─── Start & End Business Day ────────────────────────────────────────────────

/**
 * Starts a new Business Day.
 * Validates that:
 * 1. No other business day is currently open.
 * 2. No active/unresolved orders exist in Restaurant_Orders.
 */
export async function startBusinessDay(startedBy?: string): Promise<BusinessDay> {
  const currentOpen = await getActiveBusinessDay()
  if (currentOpen) {
    throw new Error('A business day is already open. Please conclude the current business day first.')
  }

  // Check active orders
  const activeCheck = await checkActiveOrders()
  if (activeCheck.hasActiveOrders) {
    void logCashierAction({
      action: 'BUSINESS_DAY_END_BLOCKED',
      description: `Attempted to start business day but blocked by ${activeCheck.count} active order(s).`,
      metadata: {
        reason: 'ACTIVE_ORDERS_EXIST',
        active_orders_count: activeCheck.count,
        orders: activeCheck.orders,
      },
    })
    throw new Error(
      `Cannot start business day: ${activeCheck.count} active order(s) exist. All active orders must be completed or cancelled before opening a new day.`,
    )
  }

  const now = new Date()
  const localDateStr = now.toISOString().slice(0, 10) // YYYY-MM-DD

  let newDay: BusinessDay = {
    businessDayId: Date.now(),
    businessDate: localDateStr,
    status: 'OPEN',
    startedAt: now.toISOString(),
    startedBy: startedBy || 'Administrator',
    endedAt: null,
    endedBy: null,
    totalTransactions: 0,
    totalRevenue: 0,
    totalCustomersServed: 0,
  }

  // 1. Attempt Supabase RPC or direct insert
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('start_business_day', {
      p_started_by: startedBy || 'Administrator',
      p_business_date: localDateStr,
    })

    if (!rpcError && rpcData) {
      newDay = mapDbRowToBusinessDay(rpcData as Record<string, unknown>)
    } else {
      const payload = {
        BUSINESS_DATE: localDateStr,
        STATUS: 'OPEN',
        STARTED_AT: now.toISOString(),
        STARTED_BY: startedBy || 'Administrator',
      }

      const { data, error } = await supabase
        .schema('staff')
        .from('Business_Days')
        .insert([payload])
        .select('*')
        .single()

      if (!error && data) {
        newDay = mapDbRowToBusinessDay(data)
      } else {
        const { data: pubData, error: pubError } = await supabase
          .from('Business_Days')
          .insert([payload])
          .select('*')
          .single()

        if (!pubError && pubData) {
          newDay = mapDbRowToBusinessDay(pubData)
        }
      }
    }
  } catch (err) {
    console.warn('[businessDayService] Supabase start_business_day failed, using fallback:', err)
  }

  // 2. Save locally
  localStorage.setItem(LOCAL_STORAGE_ACTIVE_BUSINESS_DAY_ID, String(newDay.businessDayId))
  saveFallbackBusinessDay(newDay)

  // 3. Log Audit Action
  void logCashierAction({
    action: 'BUSINESS_DAY_STARTED',
    businessDayId: newDay.businessDayId,
    entityType: 'BUSINESS_DAY',
    entityId: String(newDay.businessDayId),
    description: `Business Day opened for ${newDay.businessDate} by ${newDay.startedBy || 'Administrator'}.`,
    metadata: {
      business_day_id: newDay.businessDayId,
      business_date: newDay.businessDate,
      started_at: newDay.startedAt,
      started_by: newDay.startedBy,
    },
  })

  return newDay
}

/**
 * Concludes and closes an active Business Day.
 * Validates that:
 * 1. An active business day exists.
 * 2. No active orders exist in Restaurant_Orders.
 * 3. No active Cashier or Service shifts are still open.
 */
export async function endBusinessDay(endedBy?: string): Promise<BusinessDay> {
  const activeDay = await getActiveBusinessDay()
  if (!activeDay) {
    throw new Error('No open business day found to conclude.')
  }

  void logCashierAction({
    action: 'BUSINESS_DAY_END_ATTEMPTED',
    businessDayId: activeDay.businessDayId,
    entityType: 'BUSINESS_DAY',
    entityId: String(activeDay.businessDayId),
    description: `Attempting to close Business Day #${activeDay.businessDayId}`,
  })

  // Pre-flight check 1: Active orders
  const activeOrders = await checkActiveOrders()
  if (activeOrders.hasActiveOrders) {
    void logCashierAction({
      action: 'BUSINESS_DAY_END_BLOCKED',
      businessDayId: activeDay.businessDayId,
      entityType: 'BUSINESS_DAY',
      entityId: String(activeDay.businessDayId),
      description: `End Day blocked: ${activeOrders.count} active order(s) still exist.`,
      metadata: {
        reason: 'ACTIVE_ORDERS_EXIST',
        count: activeOrders.count,
        orders: activeOrders.orders,
      },
    })
    throw new Error(
      `Cannot end business day: ${activeOrders.count} active order(s) still exist. Please settle or cancel all orders before concluding the day.`,
    )
  }

  // Pre-flight check 2: Active staff shifts
  const activeShifts = await checkActiveShifts()
  if (activeShifts.hasActiveShifts) {
    const totalShifts = activeShifts.cashierShifts.length + activeShifts.serviceShifts.length
    void logCashierAction({
      action: 'BUSINESS_DAY_END_BLOCKED',
      businessDayId: activeDay.businessDayId,
      entityType: 'BUSINESS_DAY',
      entityId: String(activeDay.businessDayId),
      description: `End Day blocked: ${totalShifts} active staff shift(s) are still open.`,
      metadata: {
        reason: 'ACTIVE_SHIFTS_EXIST',
        cashier_shifts: activeShifts.cashierShifts,
        service_shifts: activeShifts.serviceShifts,
      },
    })
    throw new Error(
      `Cannot end business day: ${totalShifts} staff shift(s) are still active. All cashiers and floor staff must conclude their shifts first.`,
    )
  }

  // Calculate final summary metrics
  const summary = await calculateDailySummary(activeDay.businessDayId)
  const now = new Date().toISOString()

  let updatedDay: BusinessDay = {
    ...activeDay,
    status: 'CLOSED',
    endedAt: now,
    endedBy: endedBy || 'Administrator',
    totalTransactions: summary.completedOrdersCount,
    totalRevenue: summary.grossRevenue,
    totalCustomersServed: summary.customersServed,
  }

  // 1. Attempt Supabase RPC or update
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('end_business_day', {
      p_ended_by: endedBy || 'Administrator',
    })

    if (!rpcError && rpcData) {
      updatedDay = mapDbRowToBusinessDay(rpcData as Record<string, unknown>)
    } else {
      const payload = {
        STATUS: 'CLOSED',
        ENDED_AT: now,
        ENDED_BY: endedBy || 'Administrator',
        TOTAL_TRANSACTIONS: updatedDay.totalTransactions,
        TOTAL_REVENUE: updatedDay.totalRevenue,
        TOTAL_CUSTOMERS_SERVED: updatedDay.totalCustomersServed,
      }

      const { data, error } = await supabase
        .schema('staff')
        .from('Business_Days')
        .update(payload)
        .eq('BUSINESS_DAY_ID', activeDay.businessDayId)
        .select('*')
        .single()

      if (!error && data) {
        updatedDay = mapDbRowToBusinessDay(data)
      } else {
        const { data: pubData, error: pubError } = await supabase
          .from('Business_Days')
          .update(payload)
          .eq('BUSINESS_DAY_ID', activeDay.businessDayId)
          .select('*')
          .single()

        if (!pubError && pubData) {
          updatedDay = mapDbRowToBusinessDay(pubData)
        }
      }
    }
  } catch (err) {
    console.warn('[businessDayService] Supabase end_business_day failed, using fallback:', err)
  }

  // 2. Clear active storage and save to fallback
  localStorage.removeItem(LOCAL_STORAGE_ACTIVE_BUSINESS_DAY_ID)
  saveFallbackBusinessDay(updatedDay)

  // 3. Log Audit Action
  void logCashierAction({
    action: 'BUSINESS_DAY_ENDED',
    businessDayId: updatedDay.businessDayId,
    entityType: 'BUSINESS_DAY',
    entityId: String(updatedDay.businessDayId),
    description: `Business Day #${updatedDay.businessDayId} (${updatedDay.businessDate}) concluded by ${updatedDay.endedBy}. Total Revenue: ₱${updatedDay.totalRevenue.toFixed(2)}, Transactions: ${updatedDay.totalTransactions}, Customers: ${updatedDay.totalCustomersServed}`,
    metadata: {
      business_day_id: updatedDay.businessDayId,
      total_revenue: updatedDay.totalRevenue,
      total_transactions: updatedDay.totalTransactions,
      total_customers_served: updatedDay.totalCustomersServed,
      started_at: updatedDay.startedAt,
      ended_at: updatedDay.endedAt,
    },
  })

  return updatedDay
}

// ─── Daily Summary & Cashier Breakdown Calculator ───────────────────────────

/**
 * Calculates a rich Daily Summary for a specific Business Day.
 * Compiles gross revenue, payment method breakdowns, cashier performance,
 * and individual drill-down transactions.
 */
export async function calculateDailySummary(businessDayId: number): Promise<DailySummary> {
  // 1. Get Day details
  let targetDay: BusinessDay | null = null
  try {
    const { data } = await supabase
      .schema('staff')
      .from('Business_Days')
      .select('*')
      .eq('BUSINESS_DAY_ID', businessDayId)
      .maybeSingle()

    if (data) targetDay = mapDbRowToBusinessDay(data)
  } catch {
    // ignore
  }

  if (!targetDay) {
    const fallbackDays = getFallbackBusinessDays()
    targetDay = fallbackDays.find((d) => d.businessDayId === businessDayId) ?? null
  }

  if (!targetDay) {
    targetDay = {
      businessDayId,
      businessDate: new Date().toISOString().slice(0, 10),
      status: 'OPEN',
      startedAt: new Date().toISOString(),
      startedBy: 'Admin',
      endedAt: null,
      endedBy: null,
      totalTransactions: 0,
      totalRevenue: 0,
      totalCustomersServed: 0,
    }
  }

  const startTime = targetDay.startedAt
  const endTime = targetDay.endedAt || new Date().toISOString()

  // 2. Fetch completed orders from Completed_Orders (system_history schema or public view)
  let completedRows: Array<Record<string, unknown>> = []
  try {
    let dbOrders: Array<Record<string, unknown>> | null = null
    try {
      const res = await supabase
        .schema('system_history')
        .from('Completed_Orders')
        .select('*')
        .or(`BUSINESS_DAY_ID.eq.${businessDayId},COMPLETED_AT.gte.${startTime}`)
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
        .or(`BUSINESS_DAY_ID.eq.${businessDayId},COMPLETED_AT.gte.${startTime}`)
        .order('COMPLETED_AT', { ascending: false })
      dbOrders = res.data
    }

    if (dbOrders && dbOrders.length > 0) {
      completedRows = dbOrders.filter((o) => {
        if (o.BUSINESS_DAY_ID && Number(o.BUSINESS_DAY_ID) === businessDayId) return true
        const cTime = String(o.COMPLETED_AT || o.TIME)
        return cTime >= startTime && cTime <= endTime
      })
    }
  } catch (err) {
    console.warn('[businessDayService] Failed to query Completed_Orders:', err)
  }

  // 3. Fetch audit logs for the day (for discounts, voids, refunds, cashier actions)
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
      if (!res.error && res.data) {
        dbLogs = res.data
      } else {
        throw res.error
      }
    } catch {
      try {
        const res2 = await supabase
          .schema('staff')
          .from('Cashier_Audit_Logs')
          .select('*')
          .gte('CREATED_AT', startTime)
          .lte('CREATED_AT', endTime)
        if (!res2.error && res2.data) {
          dbLogs = res2.data
        } else {
          throw res2.error
        }
      } catch {
        const res3 = await supabase
          .from('Audit_Logs')
          .select('*')
          .gte('CREATED_AT', startTime)
          .lte('CREATED_AT', endTime)
        dbLogs = res3.data
      }
    }

    if (dbLogs) auditRows = dbLogs
  } catch {
    try {
      const raw = localStorage.getItem('monolith_cashier_audit_logs_fallback')
      if (raw) {
        const logs = JSON.parse(raw) as Array<Record<string, unknown>>
        auditRows = logs.filter((l) => {
          const t = String(l.createdAt || '')
          return t >= startTime && t <= endTime
        })
      }
    } catch {
      // ignore
    }
  }

  // 4. Fetch staff list for naming
  const staffMap = new Map<number, { name: string; role: string }>()
  try {
    const staffRes = await fetchStaffCodes({}, 1, 100)
    staffRes.codes.forEach((s) => {
      staffMap.set(s.codeId, { name: s.staffName, role: s.staffRole })
    })
  } catch {
    // ignore
  }

  // Aggregate Metrics
  let grossRevenue = 0
  let subtotalRevenue = 0
  let totalDiscounts = 0
  let customersServed = 0
  const paymentMethodMap: Record<string, { count: number; total: number }> = {}
  const cashierMap: Record<number, CashierDailyPerformance> = {}
  const transactionsList: DailyTransactionRow[] = []

  // Process Completed Orders
  for (const row of completedRows) {
    const total = Number(row['TOTAL_BILL'] || 0)
    const subtotal = Number(row['SUBTOTAL_BILL'] || total)
    const discount = Number(row['DISCOUNT_AMOUNT'] || Math.max(subtotal - total, 0))
    const guests = Math.max(Number(row['GUEST_COUNT'] || 1), 1)
    const method = String(row['PAYMENT_METHOD'] || 'CASH').toUpperCase()
    const staffId = row['STAFF_ID'] ? Number(row['STAFF_ID']) : null
    const shiftId = row['SHIFT_ID'] ? Number(row['SHIFT_ID']) : null
    const cashierName = String(row['CASHIER_NAME'] || (staffId ? staffMap.get(staffId)?.name : null) || 'Counter Cashier')
    const time = String(row['COMPLETED_AT'] || row['TIME'] || startTime)
    const orderId = Number(row['ORIGINAL_ORDER_ID'] || row['ORDER_ID'] || 0)
    const tableNum = row['TABLE_NUM'] || row['TABLE_ID'] || 0

    grossRevenue += total
    subtotalRevenue += subtotal
    totalDiscounts += discount
    customersServed += guests

    // Payment methods
    if (!paymentMethodMap[method]) {
      paymentMethodMap[method] = { count: 0, total: 0 }
    }
    paymentMethodMap[method].count += 1
    paymentMethodMap[method].total += total

    // Cashier breakdown
    const effectiveStaffId = staffId || 1003 // default to standard cashier if untagged
    if (!cashierMap[effectiveStaffId]) {
      const stInfo = staffMap.get(effectiveStaffId)
      cashierMap[effectiveStaffId] = {
        staffId: effectiveStaffId,
        staffName: stInfo?.name || cashierName,
        staffRole: stInfo?.role || 'CASHIER',
        shiftIds: shiftId ? [shiftId] : [],
        shiftTimes: [],
        transactionsCount: 0,
        customersServed: 0,
        totalSales: 0,
        cashTotal: 0,
        cardTotal: 0,
        eWalletTotal: 0,
        voidsCount: 0,
        discountsTotal: 0,
      }
    }

    const c = cashierMap[effectiveStaffId]
    if (shiftId && !c.shiftIds.includes(shiftId)) {
      c.shiftIds.push(shiftId)
    }
    c.transactionsCount += 1
    c.customersServed += guests
    c.totalSales += total
    c.discountsTotal += discount

    if (method.includes('CASH')) c.cashTotal += total
    else if (method.includes('CARD')) c.cardTotal += total
    else c.eWalletTotal += total

    // Transaction drill-down row
    transactionsList.push({
      orderId,
      time,
      tableLabel: `Table ${tableNum}`,
      staffId: effectiveStaffId,
      cashierName: c.staffName,
      shiftId,
      transactionType: 'PAYMENT',
      paymentMethod: method,
      amount: total,
      discount,
      status: 'COMPLETED',
    })
  }

  // Count voids and cancellations from audit logs
  let voidsCount = 0
  let refundsCount = 0
  for (const log of auditRows) {
    const act = String(log['ACTION'] || log['action'] || '')
    const sId = Number(log['STAFF_ID'] || log['staffId'])
    if (act === 'ORDER_CANCELLED' || act === 'ORDER_DELETED' || act === 'PAYMENT_VOIDED') {
      voidsCount += 1
      if (sId && cashierMap[sId]) {
        cashierMap[sId].voidsCount += 1
      }
    }
    if (act === 'REFUND_CREATED') {
      refundsCount += 1
    }
  }

  const completedOrdersCount = completedRows.length
  const averageOrderValue = completedOrdersCount > 0 ? grossRevenue / completedOrdersCount : 0
  const averageSpendPerCustomer = customersServed > 0 ? grossRevenue / customersServed : 0

  // Format payment breakdown list
  const paymentBreakdown: DailyPaymentBreakdown[] = Object.entries(paymentMethodMap).map(([method, data]) => ({
    method,
    count: data.count,
    total: data.total,
    percentage: grossRevenue > 0 ? (data.total / grossRevenue) * 100 : 0,
  }))

  return {
    businessDay: targetDay,
    grossRevenue,
    subtotalRevenue,
    totalDiscounts,
    completedOrdersCount,
    cancelledOrdersCount: voidsCount,
    customersServed,
    averageOrderValue,
    averageSpendPerCustomer,
    paymentBreakdown,
    adjustments: {
      discounts: totalDiscounts,
      refunds: refundsCount,
      voids: voidsCount,
    },
    cashierPerformance: Object.values(cashierMap),
    transactionsList,
  }
}

/**
 * Fetches historical closed business days.
 */
export async function fetchBusinessDayHistory(page = 1, pageSize = 20): Promise<{ days: BusinessDay[]; totalCount: number }> {
  try {
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    const { data, count, error } = await supabase
      .schema('staff')
      .from('Business_Days')
      .select('*', { count: 'exact' })
      .order('STARTED_AT', { ascending: false })
      .range(from, to)

    if (!error && data) {
      return {
        days: data.map(mapDbRowToBusinessDay),
        totalCount: count ?? data.length,
      }
    }

    const { data: pubData, count: pubCount, error: pubError } = await supabase
      .from('Business_Days')
      .select('*', { count: 'exact' })
      .order('STARTED_AT', { ascending: false })
      .range(from, to)

    if (!pubError && pubData) {
      return {
        days: pubData.map(mapDbRowToBusinessDay),
        totalCount: pubCount ?? pubData.length,
      }
    }
  } catch (err) {
    console.warn('[businessDayService] Failed to query Business_Days history from Supabase:', err)
  }

  const fallbackDays = getFallbackBusinessDays()
  const from = (page - 1) * pageSize
  const slice = fallbackDays.slice(from, from + pageSize)
  return {
    days: slice,
    totalCount: fallbackDays.length,
  }
}

// ─── Row Mapper ─────────────────────────────────────────────────────────────

function mapDbRowToBusinessDay(row: Record<string, unknown>): BusinessDay {
  return {
    businessDayId: Number(row['BUSINESS_DAY_ID']),
    businessDate: String(row['BUSINESS_DATE'] || new Date().toISOString().slice(0, 10)),
    status: (String(row['STATUS'] || 'OPEN').toUpperCase() as BusinessDay['status']) || 'OPEN',
    startedAt: String(row['STARTED_AT'] || new Date().toISOString()),
    startedBy: row['STARTED_BY'] ? String(row['STARTED_BY']) : null,
    endedAt: row['ENDED_AT'] ? String(row['ENDED_AT']) : null,
    endedBy: row['ENDED_BY'] ? String(row['ENDED_BY']) : null,
    totalTransactions: Number(row['TOTAL_TRANSACTIONS'] || 0),
    totalRevenue: Number(row['TOTAL_REVENUE'] || 0),
    totalCustomersServed: Number(row['TOTAL_CUSTOMERS_SERVED'] || 0),
  }
}
