import { supabase } from '@/lib/supabase'
import type { StaffCodeItem } from '@/types/account'
import type {
  ServiceShift,
  ServiceStaffValidationResult,
  ServiceShiftSummaryMetrics,
  ServiceShiftPunchedOrder,
  ServiceShiftPunchedTable,
  ServiceShiftDetailedSummary,
} from '@/types/serviceShift'
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

const LOCAL_STORAGE_SERVICE_SHIFTS_FALLBACK = 'monolith_service_shifts_fallback'

// ─── Local Fallback Storage Helpers ──────────────────────────────────────────

function getFallbackServiceShifts(): ServiceShift[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_SERVICE_SHIFTS_FALLBACK)
    if (raw) return JSON.parse(raw) as ServiceShift[]
  } catch (err) {
    console.warn('[serviceShiftService] Error reading fallback shifts:', err)
  }
  return []
}

function saveFallbackServiceShift(shift: ServiceShift): void {
  try {
    const shifts = getFallbackServiceShifts()
    const index = shifts.findIndex((s) => s.shiftId === shift.shiftId)
    if (index >= 0) {
      shifts[index] = shift
    } else {
      shifts.unshift(shift)
    }
    localStorage.setItem(LOCAL_STORAGE_SERVICE_SHIFTS_FALLBACK, JSON.stringify(shifts))
  } catch (err) {
    console.warn('[serviceShiftService] Error saving fallback shift:', err)
  }
}

// ─── Staff ID Validation for Service Interface ───────────────────────────────

/**
 * Validates a Staff ID for Service Interface operation.
 * Authorized roles: STAFF, SERVER, WAITER, CASHIER, ADMIN, MANAGER.
 */
export async function validateServiceStaff(staffId: number): Promise<ServiceStaffValidationResult> {
  if (!staffId || isNaN(staffId) || staffId <= 0) {
    return {
      valid: false,
      error: 'Please enter a valid numeric Staff ID.',
    }
  }

  let staff: StaffCodeItem | null = null

  try {
    const { data, error } = await supabase
      .schema('staff')
      .from('Staff_Codes')
      .select('*')
      .eq('CODE_ID', staffId)
      .maybeSingle()

    if (error || !data) {
      return {
        valid: false,
        error: `Staff code #${staffId} not found. Please verify with management.`,
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
    console.warn('[serviceShiftService] Supabase Staff_Codes query error, checking fallback:', err)
  }

  if (!staff) {
    const allStaff = await fetchStaffCodes({}, 1, 100)
    staff = allStaff.codes.find((s) => s.codeId === staffId) ?? null
  }

  if (!staff) {
    return {
      valid: false,
      error: 'Invalid Staff ID. Please enter a valid active server or staff ID.',
    }
  }

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

  // Authorized roles for Service Interface: SERVICE only
  const normalizedRole = staff.staffRole?.toUpperCase() || ''

  if (normalizedRole !== 'SERVICE') {
    return {
      valid: false,
      error: `Staff #${staff.codeId} (${staff.staffName}) is assigned as ${staff.staffRole}. Only SERVICE staff can operate the floor ordering terminal.`,
    }
  }

  return {
    valid: true,
    staff,
  }
}

// ─── Service Shift Operations ────────────────────────────────────────────────

/**
 * Starts a new service shift or restores an active one for the server on this terminal.
 */
export async function startServiceShift(staffId: number): Promise<ServiceShift> {
  const validation = await validateServiceStaff(staffId)
  if (!validation.valid || !validation.staff) {
    throw new Error(validation.error || 'Staff ID validation failed.')
  }

  const staff = validation.staff

  // Business Day verification: Floor service shift cannot be started when Business Day is closed
  const activeDay = await getActiveBusinessDay()
  if (!activeDay || activeDay.status !== 'OPEN') {
    throw new Error(
      'Cannot start service shift: The Business Day is currently closed. Please contact an administrator to start the business day.',
    )
  }

  // Cross-PC conflict check: Verify that this staff member is not currently active on another terminal
  const conflict = await checkStaffActiveOnOtherTerminal(staffId, 'SERVICE')
  if (conflict.isConflict) {
    throw new Error(
      `Staff #${staffId} (${conflict.staffName}) is already on an active shift on another terminal. Sessions are unique per PC to prevent interference.`,
    )
  }

  // Check if this terminal already holds an active session for this staff
  const existingActive = await findActiveServiceShiftForStaff(staffId)
  if (existingActive) {
    saveTerminalSession({
      staffId,
      staffName: staff.staffName,
      staffRole: 'SERVICE',
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

  const now = new Date().toISOString()
  const shiftId = Date.now()
  let newShift: ServiceShift = {
    shiftId,
    staffId,
    businessDayId: activeDay.businessDayId,
    startedAt: now,
    endedAt: null,
    status: 'ACTIVE',
    totalOrdersPunched: 0,
    totalTablesServed: 0,
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
    await supabase
      .schema('staff')
      .from('Staff_Codes')
      .update(codePayload)
      .eq('CODE_ID', staffId)
  } catch (err) {
    console.warn('[serviceShiftService] Update Staff_Codes shift error:', err)
  }

  // 2. Ensure row in Service_Staff and reset metrics to 0
  try {
    await ensureRoleStaffRecord(staffId, 'SERVICE')
    await supabase
      .schema('staff')
      .from('Service_Staff')
      .update({
        TOTAL_ORDERS_PUNCHED: 0,
        TOTAL_PUNCHED_ORDERS_VALUE: 0,
      })
      .eq('STAFF_ID', staffId)
  } catch (err) {
    console.warn('[serviceShiftService] Reset Service_Staff error:', err)
  }

  // 3. Save terminal session explicitly bound to THIS PC
  saveTerminalSession({
    staffId,
    staffName: staff.staffName,
    staffRole: 'SERVICE',
    shiftId: newShift.shiftId,
    startedAt: now,
    deviceId: getDeviceId(),
    deviceName: getDeviceName(),
  })
  saveFallbackServiceShift(newShift)

  // Append SERVICE_SHIFT_STARTED audit record
  void logCashierAction({
    action: 'SERVICE_SHIFT_STARTED',
    shiftType: 'SERVICE',
    businessDayId: activeDay.businessDayId,
    shiftId: newShift.shiftId,
    staffId: newShift.staffId,
    entityType: 'SERVICE_SHIFT',
    entityId: String(newShift.shiftId),
    description: `Service shift started by ${staff.staffName} (${staff.staffRole}) for Business Day #${activeDay.businessDayId}`,
    metadata: {
      business_day_id: activeDay.businessDayId,
      staff_name: staff.staffName,
      staff_role: staff.staffRole,
      started_at: newShift.startedAt,
      shift_type: 'SERVICE',
    },
  })

  return newShift
}

async function findActiveServiceShiftForStaff(staffId: number): Promise<ServiceShift | null> {
  try {
    const { data: codeData } = await supabase
      .schema('staff')
      .from('Staff_Codes')
      .select('*')
      .eq('CODE_ID', staffId)
      .eq('SHIFT_STATUS', 'ONGOING')
      .maybeSingle()

    if (codeData) {
      const { data: ssData } = await supabase
        .schema('staff')
        .from('Service_Staff')
        .select('*')
        .eq('STAFF_ID', staffId)
        .limit(1)
        .maybeSingle()

      return {
        shiftId: Number(codeData.CODE_ID),
        staffId: Number(codeData.CODE_ID),
        startedAt: String(codeData.SHIFT_START || new Date().toISOString()),
        endedAt: null,
        status: 'ACTIVE',
        totalOrdersPunched: Number(ssData?.TOTAL_ORDERS_PUNCHED || 0),
        totalTablesServed: 0,
        staffName: String(codeData.STAFF_NAME || 'Server'),
        staffRole: 'SERVICE',
      }
    }
  } catch {
    // fallback
  }

  const fallbackShifts = getFallbackServiceShifts()
  return fallbackShifts.find((s) => s.staffId === staffId && s.status === 'ACTIVE') ?? null
}

/**
 * Authoritatively retrieves active service shift for THIS terminal.
 */
export async function getActiveServiceShift(_shiftId?: number): Promise<ServiceShift | null> {
  const terminalSession = getTerminalSession('SERVICE')
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
      const { data: ssData } = await supabase
        .schema('staff')
        .from('Service_Staff')
        .select('*')
        .eq('STAFF_ID', staffId)
        .limit(1)
        .maybeSingle()

      return {
        shiftId: terminalSession.shiftId || Number(codeData.CODE_ID),
        staffId: Number(codeData.CODE_ID),
        startedAt: terminalSession.startedAt || String(codeData.SHIFT_START || new Date().toISOString()),
        endedAt: null,
        status: 'ACTIVE',
        totalOrdersPunched: Number(ssData?.TOTAL_ORDERS_PUNCHED || 0),
        totalTablesServed: 0,
        staffName: String(codeData.STAFF_NAME || 'Server'),
        staffRole: 'SERVICE',
      }
    } else if (!error && !codeData) {
      // Shift is ended in Supabase! Immediately purge local terminal session to stay 100% in sync
      clearTerminalSession('SERVICE', staffId)
      return null
    }
  } catch {
    // Network offline fallback — only return if terminalSession exists
  }

  return {
    shiftId: terminalSession.shiftId,
    staffId: terminalSession.staffId,
    startedAt: terminalSession.startedAt,
    endedAt: null,
    status: 'ACTIVE',
    totalOrdersPunched: 0,
    totalTablesServed: 0,
    staffName: terminalSession.staffName,
    staffRole: 'SERVICE',
  }
}

/**
 * Finalizes and ends a service shift.
 */
export async function endServiceShift(
  shiftId: number,
  totals?: { totalOrdersPunched?: number; totalTablesServed?: number },
): Promise<ServiceShift> {
  const activeShift = await getActiveServiceShift(shiftId)
  const now = new Date().toISOString()
  let finalOrders = totals?.totalOrdersPunched ?? activeShift?.totalOrdersPunched ?? 0
  let finalTables = totals?.totalTablesServed ?? activeShift?.totalTablesServed ?? 0

  // If passed totals are 0, dynamically calculate from orders/logs before concluding
  if ((finalOrders === 0 || finalTables === 0) && activeShift?.startedAt) {
    try {
      const liveMetrics = await calculateServiceShiftMetrics(activeShift.startedAt, activeShift.staffId)
      if (liveMetrics.ordersPunched > 0) {
        finalOrders = liveMetrics.ordersPunched
        finalTables = liveMetrics.tablesServed
      }
    } catch (err) {
      console.warn('[serviceShiftService] Error resolving live shift metrics on end:', err)
    }
  }

  const updatedShift: ServiceShift = {
    shiftId,
    staffId: activeShift?.staffId ?? (getTerminalSession('SERVICE')?.staffId || 0),
    startedAt: activeShift?.startedAt ?? now,
    endedAt: now,
    status: 'ENDED',
    totalOrdersPunched: finalOrders,
    totalTablesServed: finalTables,
    staffName: activeShift?.staffName,
    staffRole: activeShift?.staffRole,
  }

  // 1. Record Shift_History, reset Service_Staff, and mark Staff_Codes ended in Supabase
  try {
    if (updatedShift.staffId) {
      await recordShiftHistoryAndReset(updatedShift.staffId, {
        staffName: updatedShift.staffName,
        staffRole: 'SERVICE',
        startedAt: updatedShift.startedAt,
        endedAt: now,
      })
    }
  } catch (err) {
    console.warn('[serviceShiftService] Failed to record shift history and reset in Supabase:', err)
  }

  // 2. Fallback
  saveFallbackServiceShift(updatedShift)

  // 3. Log SERVICE_SHIFT_ENDED audit record
  await logCashierAction({
    action: 'SERVICE_SHIFT_ENDED',
    shiftType: 'SERVICE',
    shiftId,
    staffId: updatedShift.staffId,
    entityType: 'SERVICE_SHIFT',
    entityId: String(shiftId),
    description: `Service shift ended by ${updatedShift.staffName || 'Server'}. Punched ${finalOrders} order(s) across ${finalTables} table(s)`,
    metadata: {
      total_orders_punched: finalOrders,
      total_tables_served: finalTables,
      started_at: updatedShift.startedAt,
      ended_at: now,
      shift_type: 'SERVICE',
    },
  })

  // 4. Clear service session references on this terminal
  clearTerminalSession('SERVICE', updatedShift.staffId)

  return updatedShift
}

/**
 * Increments total orders punched and order value in Service_Staff when a server punches an order.
 */
export async function recordServiceOrderPunched(
  amount = 1,
  orderValue = 0,
  orderInfo?: {
    orderId?: number
    tableId?: number
    tableNum?: number
    totalBill?: number
    items?: Array<{ name: string; quantity: number; price?: number }>
  },
): Promise<void> {
  const terminalSession = getTerminalSession('SERVICE')
  const staffId =
    terminalSession?.staffId ||
    Number(localStorage.getItem('monolith_service_staff_id')) ||
    null

  const shiftId =
    terminalSession?.shiftId ||
    Number(localStorage.getItem('monolith_service_shift_id')) ||
    staffId

  if (shiftId) {
    try {
      const key = `monolith_service_shift_${shiftId}_orders`
      const raw = localStorage.getItem(key)
      const list = raw ? JSON.parse(raw) : []
      if (orderInfo?.orderId) {
        list.push({
          orderId: orderInfo.orderId,
          tableId: orderInfo.tableId,
          tableNum: orderInfo.tableNum || orderInfo.tableId,
          tableDisplay: `Table ${orderInfo.tableNum || orderInfo.tableId}`,
          totalBill: orderInfo.totalBill ?? orderValue,
          time: new Date().toISOString(),
          status: 'REQUESTED',
          items: orderInfo.items || [],
        })
        localStorage.setItem(key, JSON.stringify(list))
      }
    } catch {
      // non-blocking
    }

    try {
      const metricsKey = `monolith_service_shift_${shiftId}_metrics`
      const rawMetrics = localStorage.getItem(metricsKey)
      const counts = rawMetrics ? JSON.parse(rawMetrics) : { totalOrdersPunched: 0, totalPunchedOrdersValue: 0 }
      counts.totalOrdersPunched = (Number(counts.totalOrdersPunched) || 0) + amount
      counts.totalPunchedOrdersValue = (Number(counts.totalPunchedOrdersValue) || 0) + orderValue
      localStorage.setItem(metricsKey, JSON.stringify(counts))
    } catch {
      // non-blocking
    }
  }

  if (!staffId) return

  try {
    await ensureRoleStaffRecord(staffId, 'SERVICE')

    let currentRecord: Record<string, unknown> | null = null
    const { data: schemaData } = await supabase
      .schema('staff')
      .from('Service_Staff')
      .select('*')
      .eq('STAFF_ID', staffId)
      .limit(1)
      .maybeSingle()

    if (schemaData) {
      currentRecord = schemaData as Record<string, unknown>
    }

    const currentPunched = Number(currentRecord?.TOTAL_ORDERS_PUNCHED || 0)
    const currentVal = Number(currentRecord?.TOTAL_PUNCHED_ORDERS_VALUE || 0)
    const newPunched = currentPunched + amount
    const newVal = currentVal + Number(orderValue || 0)

    if (currentRecord) {
      await supabase
        .schema('staff')
        .from('Service_Staff')
        .update({
          TOTAL_ORDERS_PUNCHED: newPunched,
          TOTAL_PUNCHED_ORDERS_VALUE: newVal,
        })
        .eq('STAFF_ID', staffId)
    } else {
      await supabase
        .schema('staff')
        .from('Service_Staff')
        .insert({
          STAFF_ID: staffId,
          TOTAL_ORDERS_PUNCHED: newPunched,
          TOTAL_PUNCHED_ORDERS_VALUE: newVal,
        })
    }
  } catch (err) {
    console.warn('[serviceShiftService] recordServiceOrderPunched error:', err)
  }
}

// ─── Shift Summary Calculator ────────────────────────────────────────────────

export async function calculateServiceShiftMetrics(
  startedAt: string,
  staffId?: number,
): Promise<ServiceShiftSummaryMetrics> {
  const summary = await getServiceShiftDetailedSummary(staffId || 0, startedAt)
  return summary.metrics
}

/**
 * Authoritatively retrieves comprehensive shift details for the Service interface,
 * including metrics (with total value punched), orders punched list, and tables list.
 */
export async function getServiceShiftDetailedSummary(
  staffId: number,
  startedAt: string,
): Promise<ServiceShiftDetailedSummary> {
  const startTime = new Date(startedAt).getTime()
  const nowTime = Date.now()
  const durationMinutes = Math.max(1, Math.round((nowTime - startTime) / 60000))

  const ordersMap = new Map<number, ServiceShiftPunchedOrder>()
  const tableOrderIds = new Set<number>()

  // 1. Query active Restaurant_Orders created during this shift
  try {
    const { data: activeOrders, error: activeErr } = await supabase
      .from('Restaurant_Orders')
      .select('ORDER_ID, TABLE_ID, TOTAL_BILL, TIME, ORDER_STATUS, STAFF_ID')
      .gte('TIME', startedAt)

    if (!activeErr && activeOrders) {
      const activeIds: number[] = []
      for (const o of activeOrders) {
        if (staffId && o.STAFF_ID != null && Number(o.STAFF_ID) !== staffId) {
          continue
        }
        const oId = Number(o.ORDER_ID)
        activeIds.push(oId)
        tableOrderIds.add(oId)
      }

      // Fetch items for these active orders
      if (activeIds.length > 0) {
        const { data: activeItems } = await supabase
          .from('Order_Items')
          .select(`
            ORDER_ID,
            ITEM_ID,
            Menu_Items (
              ITEM_NAME,
              ITEM_PRICE
            )
          `)
          .in('ORDER_ID', activeIds)

        const itemsByOrder = new Map<number, Map<string, { quantity: number; price: number }>>()
        if (activeItems) {
          for (const item of activeItems as any[]) {
            const oid = Number(item.ORDER_ID)
            const rawMenu = item.Menu_Items
            const menuObj = Array.isArray(rawMenu) ? rawMenu[0] : rawMenu
            const name = String(menuObj?.ITEM_NAME || `Item #${item.ITEM_ID}`)
            const price = Number(menuObj?.ITEM_PRICE || 0)

            if (!itemsByOrder.has(oid)) itemsByOrder.set(oid, new Map())
            const map = itemsByOrder.get(oid)!
            if (!map.has(name)) {
              map.set(name, { quantity: 1, price })
            } else {
              map.get(name)!.quantity += 1
            }
          }
        }

        for (const o of activeOrders) {
          const oId = Number(o.ORDER_ID)
          if (!tableOrderIds.has(oId)) continue
          const tId = Number(o.TABLE_ID)
          const itemMap = itemsByOrder.get(oId)
          const itemsList: Array<{ name: string; quantity: number; price?: number }> = itemMap
            ? Array.from(itemMap.entries()).map(([name, data]) => ({
                name,
                quantity: data.quantity,
                price: data.price,
              }))
            : []

          ordersMap.set(oId, {
            orderId: oId,
            tableId: tId,
            tableNum: tId,
            tableDisplay: `Table ${tId}`,
            totalBill: Number(o.TOTAL_BILL || 0),
            time: String(o.TIME || startedAt),
            status: String(o.ORDER_STATUS || 'REQUESTED'),
            itemCount: itemsList.reduce((sum, it) => sum + it.quantity, 0),
            items: itemsList,
          })
        }
      }
    }
  } catch (err) {
    console.warn('[serviceShiftService] Restaurant_Orders metrics lookup error:', err)
  }

  // 2. Query system_history.Order_History for orders settled/completed during this shift
  try {
    const { data: histOrders, error: histErr } = await supabase
      .schema('system_history')
      .from('Order_History')
      .select('ORIGINAL_ORDER_ID, ORDER_ID, TABLE_ID, TABLE_NUM, TOTAL_BILL, TIME, COMPLETED_AT, FROM_SERVICE_ID, ORDER_ITEMS')
      .or(`TIME.gte.${startedAt},COMPLETED_AT.gte.${startedAt}`)

    if (!histErr && histOrders) {
      for (const c of histOrders) {
        if (staffId && c.FROM_SERVICE_ID != null && Number(c.FROM_SERVICE_ID) !== staffId) {
          continue
        }
        const oId = Number(c.ORIGINAL_ORDER_ID || c.ORDER_ID)
        if (oId && !ordersMap.has(oId)) {
          const tId = Number(c.TABLE_ID || 0)
          const tNum = Number(c.TABLE_NUM) || tId || 1
          const parsedItems: Array<{ name: string; quantity: number; price?: number }> = []

          if (Array.isArray(c.ORDER_ITEMS)) {
            for (const it of c.ORDER_ITEMS as any[]) {
              parsedItems.push({
                name: String(it.item_name || it.itemName || 'Dish'),
                quantity: Number(it.quantity || 1),
                price: Number(it.price || it.unitPrice || 0),
              })
            }
          }

          ordersMap.set(oId, {
            orderId: oId,
            tableId: tId,
            tableNum: tNum,
            tableDisplay: `Table ${tNum}`,
            totalBill: Number(c.TOTAL_BILL || 0),
            time: String(c.TIME || c.COMPLETED_AT || startedAt),
            status: 'COMPLETED',
            itemCount: parsedItems.reduce((sum, it) => sum + it.quantity, 0),
            items: parsedItems,
          })
        }
      }
    }
  } catch (err) {
    console.warn('[serviceShiftService] Order_History metrics lookup error:', err)
  }

  // 3. Query operational system_history.Action_History for ORDER_CREATED actions
  try {
    const { data: schemaRows } = await supabase
      .schema('system_history')
      .from('Action_History')
      .select('*')
      .eq('ACTION_TYPE', 'ORDER_CREATED')
      .gte('CREATED_AT', startedAt)

    if (schemaRows) {
      for (const row of schemaRows) {
        const staffCode = row.STAFF_ID != null ? Number(row.STAFF_ID) : null
        if (staffId && staffCode != null && staffCode !== staffId) {
          continue
        }
        const desc = String(row.DESCRIPTION || '')
        const orderMatch = desc.match(/Order #(\d+)/i)
        const tableMatch = desc.match(/Table (\d+)/i)
        const priceMatch = desc.match(/₱([\d,.]+)/i)

        if (orderMatch) {
          const oId = Number(orderMatch[1])
          if (!ordersMap.has(oId)) {
            const tNum = tableMatch ? Number(tableMatch[1]) : 1
            const parsedVal = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : 0
            ordersMap.set(oId, {
              orderId: oId,
              tableId: tNum,
              tableNum: tNum,
              tableDisplay: `Table ${tNum}`,
              totalBill: parsedVal,
              time: String(row.CREATED_AT || startedAt),
              status: 'REQUESTED',
              itemCount: 1,
              items: [],
            })
          }
        }
      }
    }
  } catch {
    // Non-blocking
  }

  // 4. Fallback localStorage audit logs for offline/immediate reactivity
  try {
    const fallbackAudit = localStorage.getItem('monolith_cashier_audit_logs_fallback') || '[]'
    const logs = JSON.parse(fallbackAudit) as Array<{
      action: string
      createdAt: string
      staffId?: number
      metadata?: Record<string, unknown>
      entityId?: string
      description?: string
    }>
    for (const l of logs) {
      if (l.action === 'ORDER_CREATED' && new Date(l.createdAt).getTime() >= startTime) {
        if (staffId && l.staffId != null && Number(l.staffId) !== staffId) {
          continue
        }
        const oId = Number(l.metadata?.['order_id'] ?? l.entityId)
        if (oId && !ordersMap.has(oId)) {
          const tId = Number(l.metadata?.['table_id'] || 1)
          const val = Number(l.metadata?.['total_bill'] || 0)
          ordersMap.set(oId, {
            orderId: oId,
            tableId: tId,
            tableNum: tId,
            tableDisplay: `Table ${tId}`,
            totalBill: val,
            time: l.createdAt,
            status: 'REQUESTED',
            itemCount: Number(l.metadata?.['items_count'] || 1),
            items: [],
          })
        }
      }
    }
  } catch {
    // Ignore
  }

  // 4b. Local buffered shift orders
  const terminalSession = getTerminalSession('SERVICE')
  const effectiveShiftId =
    terminalSession?.shiftId ||
    Number(localStorage.getItem('monolith_service_shift_id')) ||
    staffId
  if (effectiveShiftId) {
    try {
      const raw = localStorage.getItem(`monolith_service_shift_${effectiveShiftId}_orders`)
      if (raw) {
        const buffered = JSON.parse(raw) as Array<any>
        for (const bo of buffered) {
          const oId = Number(bo.orderId)
          if (oId && !ordersMap.has(oId)) {
            const parsedItems = Array.isArray(bo.items) ? bo.items : []
            ordersMap.set(oId, {
              orderId: oId,
              tableId: Number(bo.tableId || 1),
              tableNum: Number(bo.tableNum || bo.tableId || 1),
              tableDisplay: String(bo.tableDisplay || `Table ${bo.tableNum || 1}`),
              totalBill: Number(bo.totalBill || 0),
              time: String(bo.time || new Date().toISOString()),
              status: String(bo.status || 'REQUESTED'),
              itemCount: parsedItems.reduce((s: number, it: any) => s + (Number(it.quantity) || 1), 0),
              items: parsedItems,
            })
          }
        }
      }
    } catch {
      // non-blocking
    }
  }

  // 5. Query Service_Staff for authoritative recorded totals if available
  let recordedPunchedTotal = 0
  let recordedPunchedCount = 0
  if (effectiveShiftId) {
    try {
      const rawMetrics = localStorage.getItem(`monolith_service_shift_${effectiveShiftId}_metrics`)
      if (rawMetrics) {
        const parsed = JSON.parse(rawMetrics)
        recordedPunchedTotal = Math.max(recordedPunchedTotal, Number(parsed.totalPunchedOrdersValue || 0))
        recordedPunchedCount = Math.max(recordedPunchedCount, Number(parsed.totalOrdersPunched || 0))
      }
    } catch {}
  }

  if (staffId) {
    try {
      const { data: ssData } = await supabase
        .schema('staff')
        .from('Service_Staff')
        .select('TOTAL_PUNCHED_ORDERS_VALUE, TOTAL_ORDERS_PUNCHED')
        .eq('STAFF_ID', staffId)
        .maybeSingle()

      if (ssData) {
        recordedPunchedTotal = Math.max(recordedPunchedTotal, Number(ssData.TOTAL_PUNCHED_ORDERS_VALUE || 0))
        recordedPunchedCount = Math.max(recordedPunchedCount, Number(ssData.TOTAL_ORDERS_PUNCHED || 0))
      }
    } catch {
      // ignore
    }
  }

  const ordersList = Array.from(ordersMap.values())
  ordersList.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())

  // Compute calculated sum of punched orders
  const calculatedTotal = ordersList.reduce((sum, ord) => sum + ord.totalBill, 0)
  const totalValuePunched = Math.max(calculatedTotal, recordedPunchedTotal)

  // 6. Group orders by table for "Tables" mode
  const tablesMap = new Map<number, ServiceShiftPunchedTable>()
  for (const ord of ordersList) {
    const key = ord.tableNum || ord.tableId
    const existing = tablesMap.get(key) || {
      tableId: ord.tableId,
      tableNum: ord.tableNum,
      tableDisplay: ord.tableDisplay,
      ordersCount: 0,
      totalValue: 0,
      orders: [],
    }
    existing.ordersCount += 1
    existing.totalValue += ord.totalBill
    existing.orders.push(ord)
    tablesMap.set(key, existing)
  }

  const tablesList = Array.from(tablesMap.values())
  tablesList.sort((a, b) => a.tableNum - b.tableNum)

  const metrics: ServiceShiftSummaryMetrics = {
    ordersPunched: Math.max(ordersList.length, recordedPunchedCount),
    tablesServed: tablesList.length,
    totalValuePunched,
    durationMinutes,
    startedAt,
  }

  return {
    metrics,
    orders: ordersList,
    tables: tablesList,
  }
}

// ─── Mapper ───────────────────────────────────────────────────────────────────

export function mapDbRowToServiceShift(row: Record<string, unknown>, staff?: StaffCodeItem): ServiceShift {
  return {
    shiftId: Number(row['SHIFT_ID']),
    staffId: Number(row['STAFF_ID']),
    businessDayId: row['BUSINESS_DAY_ID'] ? Number(row['BUSINESS_DAY_ID']) : null,
    startedAt: String(row['STARTED_AT'] || new Date().toISOString()),
    endedAt: row['ENDED_AT'] ? String(row['ENDED_AT']) : null,
    status: (String(row['STATUS'] || 'ACTIVE').toUpperCase() as ServiceShift['status']) || 'ACTIVE',
    totalOrdersPunched: Number(row['TOTAL_ORDERS_PUNCHED'] || 0),
    totalTablesServed: Number(row['TOTAL_TABLES_SERVED'] || 0),
    staffName: staff?.staffName,
    staffRole: staff?.staffRole,
  }
}
