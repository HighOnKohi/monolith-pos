import { supabase } from '@/lib/supabase'
import type { StaffCodeItem } from '@/types/account'
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


export interface DispatcherShift {
  shiftId: number
  staffId: number
  staffName?: string
  staffRole?: string
  startedAt: string
  ordersAccepted: number
  ordersCooked: number
  ordersCancelled: number
  ordersCompleted: number
}

export interface DispatcherStaffValidationResult {
  valid: boolean
  error?: string
  staff?: StaffCodeItem
}

/**
 * Validates a Staff ID for Dispatcher Interface operation.
 * Role must be DISPATCHER and status must be ACTIVE.
 */
export async function validateDispatcherStaff(staffId: number): Promise<DispatcherStaffValidationResult> {
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

    if (!error && data) {
      staff = {
        codeId: Number(data.CODE_ID),
        staffName: String(data.STAFF_NAME || 'Dispatcher'),
        staffRole: String(data.STAFF_ROLE || 'DISPATCHER').toUpperCase() as StaffCodeItem['staffRole'],
        codeStatus: (data.CODE_STATUS || data.STATUS || 'ACTIVE') as StaffCodeItem['codeStatus'],
        status: (data.CODE_STATUS || data.STATUS || 'ACTIVE') as StaffCodeItem['codeStatus'],
        shiftStatus: (data.SHIFT_STATUS || 'ENDED') as StaffCodeItem['shiftStatus'],
        shiftStart: data.SHIFT_START ? String(data.SHIFT_START) : null,
        shiftEnd: data.SHIFT_END ? String(data.SHIFT_END) : null,
      }
    } else {
      return {
        valid: false,
        error: `Dispatcher staff code #${staffId} not found. Please verify with management.`,
      }
    }
  } catch (err) {
    console.warn('[dispatcherShiftService] Supabase Staff_Codes query error:', err)
  }

  if (!staff) {
    return {
      valid: false,
      error: 'Invalid Staff ID. Please enter a valid registered Dispatcher Staff ID.',
    }
  }

  if (staff.codeStatus === 'INACTIVE') {
    return {
      valid: false,
      error: 'This staff account is inactive. Please contact an administrator.',
    }
  }

  if (staff.staffRole !== 'DISPATCHER') {
    return {
      valid: false,
      error: `Staff #${staff.codeId} is registered as ${staff.staffRole}. Only DISPATCHER staff can operate the kitchen dispatch line.`,
    }
  }

  return {
    valid: true,
    staff,
  }
}

/**
 * Starts a new dispatcher shift on this terminal.
 */
export async function startDispatcherShift(staffId: number): Promise<DispatcherShift> {
  const validation = await validateDispatcherStaff(staffId)
  if (!validation.valid || !validation.staff) {
    throw new Error(validation.error || 'Staff ID validation failed.')
  }

  const staff = validation.staff

  // Check business day status
  const activeDay = await getActiveBusinessDay()
  if (!activeDay || activeDay.status !== 'OPEN') {
    throw new Error('Cannot start shift: The Business Day is currently closed.')
  }

  // Cross-PC conflict check: Verify that this staff member is not currently active on another terminal
  const conflict = await checkStaffActiveOnOtherTerminal(staffId, 'DISPATCHER')
  if (conflict.isConflict) {
    throw new Error(
      `Staff #${staffId} (${conflict.staffName}) is already on an active shift on another terminal. Sessions are unique per PC to prevent interference.`,
    )
  }

  const now = new Date().toISOString()
  const shiftId = Date.now()

  // 1. Update Staff_Codes row in Supabase
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
    console.warn('[dispatcherShiftService] Failed to update Staff_Codes shift status:', err)
  }

  // 2. Ensure row in Dispatcher_Staff and reset metrics to 0
  try {
    await ensureRoleStaffRecord(staffId, 'DISPATCHER')
    await supabase
      .schema('staff')
      .from('Dispatcher_Staff')
      .update({
        ORDERS_ACCEPTED: 0,
        ORDERS_COOKED: 0,
        ORDERS_CANCELLED: 0,
        ORDERS_COMPLETED: 0,
      })
      .eq('STAFF_ID', staffId)
  } catch (err) {
    console.warn('[dispatcherShiftService] Failed to reset Dispatcher_Staff record:', err)
  }

  // 3. Save terminal session explicitly bound to THIS PC
  saveTerminalSession({
    staffId,
    staffName: staff.staffName,
    staffRole: 'DISPATCHER',
    shiftId,
    startedAt: now,
    deviceId: getDeviceId(),
    deviceName: getDeviceName(),
  })
  localStorage.setItem('monolith_dispatcher_shift_id', String(shiftId))
  localStorage.setItem('monolith_dispatcher_staff_id', String(staffId))
  localStorage.setItem('monolith_dispatcher_shift_start', now)

  return {
    shiftId,
    staffId,
    staffName: staff.staffName,
    staffRole: staff.staffRole,
    startedAt: now,
    ordersAccepted: 0,
    ordersCooked: 0,
    ordersCancelled: 0,
    ordersCompleted: 0,
  }
}

/**
 * Restores the currently active dispatcher shift for THIS terminal.
 */
export async function getActiveDispatcherShift(): Promise<DispatcherShift | null> {
  const terminalSession = getTerminalSession('DISPATCHER')
  if (!terminalSession) return null

  const staffId = terminalSession.staffId
  const validation = await validateDispatcherStaff(staffId)

  if (!validation.valid || !validation.staff) {
    clearTerminalSession('DISPATCHER', staffId)
    return null
  }

  const staff = validation.staff
  if (staff.shiftStatus === 'ENDED') {
    clearTerminalSession('DISPATCHER', staffId)
    return null
  }

  const effectiveStart = terminalSession.startedAt || staff.shiftStart || new Date().toISOString()

  return {
    shiftId: terminalSession.shiftId,
    staffId,
    staffName: staff.staffName,
    staffRole: staff.staffRole,
    startedAt: effectiveStart,
    ordersAccepted: 0,
    ordersCooked: 0,
    ordersCancelled: 0,
    ordersCompleted: 0,
  }
}

/**
 * Ends the active dispatcher shift on this terminal.
 */
export async function endDispatcherShift(): Promise<void> {
  const terminalSession = getTerminalSession('DISPATCHER')
  const staffId = terminalSession?.staffId
  const now = new Date().toISOString()

  if (staffId) {
    try {
      await recordShiftHistoryAndReset(staffId, {
        staffRole: 'DISPATCHER',
        endedAt: now,
      })
    } catch (err) {
      console.warn('[dispatcherShiftService] Failed to record shift history and reset:', err)
    }
  }

  clearTerminalSession('DISPATCHER', staffId || undefined)
}

// ─── Metric Increments in Dispatcher_Staff ─────────────────────────────────────

async function incrementDispatcherColumn(columnName: 'ORDERS_ACCEPTED' | 'ORDERS_COOKED' | 'ORDERS_CANCELLED' | 'ORDERS_COMPLETED', amount = 1) {
  const terminalSession = getTerminalSession('DISPATCHER')
  const staffId =
    terminalSession?.staffId ||
    Number(localStorage.getItem('monolith_dispatcher_staff_id')) ||
    null
  if (!staffId) return

  const shiftId =
    terminalSession?.shiftId ||
    Number(localStorage.getItem('monolith_dispatcher_shift_id')) ||
    staffId

  // Buffer locally in terminal session for instant reactivity
  if (shiftId) {
    try {
      const key = `monolith_dispatcher_shift_${shiftId}_metrics`
      const counts = JSON.parse(localStorage.getItem(key) || '{}')
      counts[columnName] = (Number(counts[columnName]) || 0) + amount
      localStorage.setItem(key, JSON.stringify(counts))
    } catch {
      // non-blocking
    }
  }

  try {
    await ensureRoleStaffRecord(staffId, 'DISPATCHER')

    const { data: schemaData } = await supabase
      .schema('staff')
      .from('Dispatcher_Staff')
      .select('*')
      .eq('STAFF_ID', staffId)
      .limit(1)
      .maybeSingle()

    if (schemaData) {
      const currentVal = Number((schemaData as Record<string, unknown>)[columnName] || 0)
      await supabase
        .schema('staff')
        .from('Dispatcher_Staff')
        .update({ [columnName]: currentVal + amount })
        .eq('STAFF_ID', staffId)
    }
  } catch (err) {
    console.warn(`[dispatcherShiftService] Increment ${columnName} error:`, err)
  }
}

export async function incrementDispatcherAccepted(count = 1): Promise<void> {
  await incrementDispatcherColumn('ORDERS_ACCEPTED', count)
}

export async function incrementDispatcherCooked(count = 1): Promise<void> {
  await incrementDispatcherColumn('ORDERS_COOKED', count)
}

export async function incrementDispatcherCancelled(count = 1): Promise<void> {
  await incrementDispatcherColumn('ORDERS_CANCELLED', count)
}

export async function incrementDispatcherCompleted(count = 1): Promise<void> {
  await incrementDispatcherColumn('ORDERS_COMPLETED', count)
}

export async function getDispatcherShiftMetrics(staffId: number): Promise<{
  ordersAccepted: number
  ordersCooked: number
  ordersCancelled: number
  ordersCompleted: number
}> {
  const localCounts = (() => {
    try {
      const session = getTerminalSession('DISPATCHER')
      const shiftId =
        session?.shiftId ||
        Number(localStorage.getItem('monolith_dispatcher_shift_id')) ||
        staffId
      if (shiftId) {
        return JSON.parse(localStorage.getItem(`monolith_dispatcher_shift_${shiftId}_metrics`) || '{}')
      }
    } catch {}
    return {}
  })()

  try {
    const { data: schemaData } = await supabase
      .schema('staff')
      .from('Dispatcher_Staff')
      .select('*')
      .eq('STAFF_ID', staffId)
      .limit(1)
      .maybeSingle()

    const rec = schemaData as Record<string, unknown> | null

    return {
      ordersAccepted: Math.max(Number(rec?.ORDERS_ACCEPTED || 0), Number(localCounts.ORDERS_ACCEPTED || 0)),
      ordersCooked: Math.max(Number(rec?.ORDERS_COOKED || 0), Number(localCounts.ORDERS_COOKED || 0)),
      ordersCancelled: Math.max(Number(rec?.ORDERS_CANCELLED || 0), Number(localCounts.ORDERS_CANCELLED || 0)),
      ordersCompleted: Math.max(Number(rec?.ORDERS_COMPLETED || 0), Number(localCounts.ORDERS_COMPLETED || 0)),
    }
  } catch (err) {
    console.warn('[dispatcherShiftService] getDispatcherShiftMetrics error:', err)
    return {
      ordersAccepted: Number(localCounts.ORDERS_ACCEPTED || 0),
      ordersCooked: Number(localCounts.ORDERS_COOKED || 0),
      ordersCancelled: Number(localCounts.ORDERS_CANCELLED || 0),
      ordersCompleted: Number(localCounts.ORDERS_COMPLETED || 0),
    }
  }
}

// ─── Dispatcher Handled Orders & Shift Details ───────────────────────────────

export type DispatcherStage = 'ACCEPTED' | 'COOKED' | 'SENT' | 'CANCELLED'

export interface DispatcherHandledOrder {
  orderId: number
  tableId: number
  tableNum: number
  tableDisplay: string
  status: string
  stages: DispatcherStage[]
  items: Array<{ name: string; quantity: number }>
  itemCount: number
  time: string
  totalBill: number
  lastActionTime?: string
}

export interface DispatcherHandledTable {
  tableId: number
  tableNum: number
  tableDisplay: string
  ordersCount: number
  orders: DispatcherHandledOrder[]
}

export interface DispatcherShiftDetails {
  metrics: {
    ordersAccepted: number
    ordersCooked: number
    ordersCompleted: number
    ordersCancelled: number
  }
  orders: DispatcherHandledOrder[]
  tables: DispatcherHandledTable[]
}

/**
 * Records an order action performed by the dispatcher on this shift into local tracking.
 */
export function recordDispatcherHandledOrder(
  orderId: number,
  stage: DispatcherStage,
  extra?: {
    tableId?: number
    tableNum?: number
    tableDisplay?: string
    items?: Array<{ name: string; quantity: number }>
    totalBill?: number
  },
): void {
  try {
    const session = getTerminalSession('DISPATCHER')
    const shiftId =
      session?.shiftId ||
      Number(localStorage.getItem('monolith_dispatcher_shift_id')) ||
      Number(localStorage.getItem('monolith_dispatcher_staff_id')) ||
      (typeof session?.staffId === 'number' ? session.staffId : null)
    if (!shiftId) return

    const key = `monolith_dispatcher_shift_${shiftId}_orders`
    const raw = localStorage.getItem(key)
    const list: Array<{
      orderId: number
      stage: DispatcherStage
      time: string
      tableId?: number
      tableNum?: number
      tableDisplay?: string
      items?: Array<{ name: string; quantity: number }>
      totalBill?: number
    }> = raw ? JSON.parse(raw) : []

    list.push({
      orderId,
      stage,
      time: new Date().toISOString(),
      tableId: extra?.tableId,
      tableNum: extra?.tableNum,
      tableDisplay: extra?.tableDisplay,
      items: extra?.items,
      totalBill: extra?.totalBill,
    })

    localStorage.setItem(key, JSON.stringify(list))
  } catch (err) {
    console.warn('[dispatcherShiftService] recordDispatcherHandledOrder error:', err)
  }
}

/**
 * Authoritatively retrieves comprehensive shift details for the Dispatcher,
 * including metrics, handled orders list, and handled tables list with nested orders.
 */
export async function getDispatcherShiftDetails(
  staffId: number,
  startedAt: string,
): Promise<DispatcherShiftDetails> {
  const metrics = await getDispatcherShiftMetrics(staffId)

  const session = getTerminalSession('DISPATCHER')
  const shiftId =
    session?.shiftId ||
    Number(localStorage.getItem('monolith_dispatcher_shift_id')) ||
    staffId

  // 1. Read local event history for this shift
  const localMap = new Map<
    number,
    {
      stages: Set<DispatcherStage>
      tableId?: number
      tableNum?: number
      tableDisplay?: string
      items?: Array<{ name: string; quantity: number }>
      totalBill?: number
      lastActionTime: string
    }
  >()

  if (shiftId) {
    try {
      const raw = localStorage.getItem(`monolith_dispatcher_shift_${shiftId}_orders`)
      if (raw) {
        const events = JSON.parse(raw) as Array<{
          orderId: number
          stage: DispatcherStage
          time: string
          tableId?: number
          tableNum?: number
          tableDisplay?: string
          items?: Array<{ name: string; quantity: number }>
          totalBill?: number
        }>
        for (const ev of events) {
          const existing = localMap.get(ev.orderId) || {
            stages: new Set<DispatcherStage>(),
            tableId: ev.tableId,
            tableNum: ev.tableNum,
            tableDisplay: ev.tableDisplay,
            items: ev.items,
            totalBill: ev.totalBill,
            lastActionTime: ev.time,
          }
          existing.stages.add(ev.stage)
          if (ev.tableId) existing.tableId = ev.tableId
          if (ev.tableNum) existing.tableNum = ev.tableNum
          if (ev.tableDisplay) existing.tableDisplay = ev.tableDisplay
          if (ev.items && ev.items.length > 0) existing.items = ev.items
          if (ev.totalBill) existing.totalBill = ev.totalBill
          existing.lastActionTime = ev.time
          localMap.set(ev.orderId, existing)
        }
      }
    } catch {
      // ignore
    }
  }

  // 2. Query Order_Events from Supabase for kitchen events since shift start
  try {
    const { data: dbEvents, error: evErr } = await supabase
      .from('Order_Events')
      .select('ORDER_ID, EVENT_TYPE, TIMESTAMP')
      .gte('TIMESTAMP', startedAt)
      .in('EVENT_TYPE', [
        'STATUS_COOKING',
        'STATUS_READY',
        'STATUS_COMPLETED',
        'ORDER_CANCELLED',
        'ITEMS_REJECTED',
      ])
      .order('TIMESTAMP', { ascending: true })

    if (!evErr && dbEvents) {
      for (const ev of dbEvents) {
        const oid = Number(ev.ORDER_ID)
        let stg: DispatcherStage = 'ACCEPTED'
        if (ev.EVENT_TYPE === 'STATUS_COOKING') stg = 'ACCEPTED'
        else if (ev.EVENT_TYPE === 'STATUS_READY') stg = 'COOKED'
        else if (ev.EVENT_TYPE === 'STATUS_COMPLETED') stg = 'SENT'
        else if (ev.EVENT_TYPE === 'ORDER_CANCELLED' || ev.EVENT_TYPE === 'ITEMS_REJECTED') stg = 'CANCELLED'

        const existing = localMap.get(oid) || {
          stages: new Set<DispatcherStage>(),
          lastActionTime: String(ev.TIMESTAMP || startedAt),
        }
        existing.stages.add(stg)
        existing.lastActionTime = String(ev.TIMESTAMP || existing.lastActionTime)
        localMap.set(oid, existing)
      }
    }
  } catch (err) {
    console.warn('[dispatcherShiftService] Error querying Order_Events:', err)
  }

  const handledOrderIds = Array.from(localMap.keys())

  // 3. Query active Restaurant_Orders and completed Order_History to populate full details
  const ordersMap = new Map<number, DispatcherHandledOrder>()

  if (handledOrderIds.length > 0) {
    try {
      // Query active Restaurant_Orders
      const { data: activeRows } = await supabase
        .from('Restaurant_Orders')
        .select('ORDER_ID, TABLE_ID, ORDER_STATUS, TOTAL_BILL, TIME, GUEST_COUNT')
        .in('ORDER_ID', handledOrderIds)

      // Query child items for active orders
      const { data: activeItems } = await supabase
        .from('Order_Items')
        .select(`
          ORDER_ID,
          ITEM_ID,
          ORDER_ITEM_STATUS,
          Menu_Items (
            ITEM_NAME
          )
        `)
        .in('ORDER_ID', handledOrderIds)

      const activeItemsByOrder = new Map<number, Map<string, number>>()
      if (activeItems) {
        for (const item of activeItems as any[]) {
          const oid = Number(item.ORDER_ID)
          const rawMenu = item.Menu_Items
          const menuObj = Array.isArray(rawMenu) ? rawMenu[0] : rawMenu
          const itemName = String(menuObj?.ITEM_NAME || `Item #${item.ITEM_ID}`)
          if (!activeItemsByOrder.has(oid)) activeItemsByOrder.set(oid, new Map())
          const map = activeItemsByOrder.get(oid)!
          map.set(itemName, (map.get(itemName) || 0) + 1)
        }
      }

      if (activeRows) {
        for (const row of activeRows) {
          const oid = Number(row.ORDER_ID)
          const localInfo = localMap.get(oid)
          const itemMap = activeItemsByOrder.get(oid)
          const itemsList: Array<{ name: string; quantity: number }> = itemMap
            ? Array.from(itemMap.entries()).map(([name, quantity]) => ({ name, quantity }))
            : localInfo?.items || []

          const tId = Number(row.TABLE_ID)
          const tNum = localInfo?.tableNum || tId

          ordersMap.set(oid, {
            orderId: oid,
            tableId: tId,
            tableNum: tNum,
            tableDisplay: localInfo?.tableDisplay || `Table ${tNum}`,
            status: String(row.ORDER_STATUS || 'PREPARING'),
            stages: Array.from(localInfo?.stages || ['ACCEPTED']),
            items: itemsList,
            itemCount: itemsList.reduce((sum, it) => sum + it.quantity, 0),
            time: String(row.TIME || localInfo?.lastActionTime || startedAt),
            totalBill: Number(row.TOTAL_BILL || localInfo?.totalBill || 0),
            lastActionTime: localInfo?.lastActionTime,
          })
        }
      }

      // Query system_history.Order_History for orders that are now completed/archived
      const missingIds = handledOrderIds.filter((id) => !ordersMap.has(id))
      if (missingIds.length > 0) {
        const { data: histRows } = await supabase
          .schema('system_history')
          .from('Order_History')
          .select('*')
          .in('ORDER_ID', missingIds)

        if (histRows) {
          for (const row of histRows) {
            const oid = Number(row.ORIGINAL_ORDER_ID || row.ORDER_ID)
            const localInfo = localMap.get(oid)
            const parsedItems: Array<{ name: string; quantity: number }> = []

            if (Array.isArray(row.ORDER_ITEMS)) {
              for (const it of row.ORDER_ITEMS as any[]) {
                parsedItems.push({
                  name: String(it.item_name || it.itemName || 'Dish'),
                  quantity: Number(it.quantity || 1),
                })
              }
            } else if (localInfo?.items) {
              parsedItems.push(...localInfo.items)
            }

            const tId = Number(row.TABLE_ID || 0)
            const tNum = Number(row.TABLE_NUM) || localInfo?.tableNum || tId

            ordersMap.set(oid, {
              orderId: oid,
              tableId: tId,
              tableNum: tNum,
              tableDisplay: localInfo?.tableDisplay || `Table ${tNum}`,
              status: String(row.ORDER_STATUS || 'COMPLETED'),
              stages: Array.from(localInfo?.stages || ['SENT']),
              items: parsedItems,
              itemCount: parsedItems.reduce((sum, it) => sum + it.quantity, 0),
              time: String(row.TIME || row.COMPLETED_AT || startedAt),
              totalBill: Number(row.TOTAL_BILL || 0),
              lastActionTime: localInfo?.lastActionTime,
            })
          }
        }
      }
    } catch (err) {
      console.warn('[dispatcherShiftService] Error resolving order details:', err)
    }
  }

  // 4. Fill in any orders only known from local tracking
  for (const [oid, info] of localMap.entries()) {
    if (!ordersMap.has(oid)) {
      const tNum = info.tableNum || info.tableId || 1
      ordersMap.set(oid, {
        orderId: oid,
        tableId: info.tableId || tNum,
        tableNum: tNum,
        tableDisplay: info.tableDisplay || `Table ${tNum}`,
        status: info.stages.has('SENT') ? 'COMPLETED' : info.stages.has('COOKED') ? 'READY' : 'PREPARING',
        stages: Array.from(info.stages),
        items: info.items || [],
        itemCount: (info.items || []).reduce((sum, it) => sum + it.quantity, 0),
        time: info.lastActionTime || startedAt,
        totalBill: info.totalBill || 0,
        lastActionTime: info.lastActionTime,
      })
    }
  }

  const ordersList = Array.from(ordersMap.values())
  ordersList.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())

  // 5. Group orders by table for "Tables" mode
  const tablesMap = new Map<number, DispatcherHandledTable>()
  for (const ord of ordersList) {
    const key = ord.tableNum || ord.tableId
    const existing = tablesMap.get(key) || {
      tableId: ord.tableId,
      tableNum: ord.tableNum,
      tableDisplay: ord.tableDisplay,
      ordersCount: 0,
      orders: [],
    }
    existing.ordersCount += 1
    existing.orders.push(ord)
    tablesMap.set(key, existing)
  }

  const tablesList = Array.from(tablesMap.values())
  tablesList.sort((a, b) => a.tableNum - b.tableNum)

  // Derive stage counts from resolved orders list to supplement or override empty metrics
  const derivedAccepted = ordersList.filter((o) =>
    o.stages.includes('ACCEPTED') || o.stages.includes('COOKED') || o.stages.includes('SENT')
  ).length
  const derivedCooked = ordersList.filter((o) =>
    o.stages.includes('COOKED') || o.stages.includes('SENT')
  ).length
  const derivedCompleted = ordersList.filter((o) => o.stages.includes('SENT')).length
  const derivedCancelled = ordersList.filter((o) => o.stages.includes('CANCELLED')).length

  const effectiveCompleted = Math.max(metrics.ordersCompleted, derivedCompleted)
  const effectiveCooked = Math.max(metrics.ordersCooked, derivedCooked, effectiveCompleted)
  const effectiveAccepted = Math.max(metrics.ordersAccepted, derivedAccepted, effectiveCooked, ordersList.length)
  const effectiveCancelled = Math.max(metrics.ordersCancelled, derivedCancelled)

  const effectiveMetrics = {
    ordersAccepted: effectiveAccepted,
    ordersCooked: effectiveCooked,
    ordersCancelled: effectiveCancelled,
    ordersCompleted: effectiveCompleted,
  }

  return {
    metrics: effectiveMetrics,
    orders: ordersList,
    tables: tablesList,
  }
}


