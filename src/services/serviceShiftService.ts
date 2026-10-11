import { supabase } from '@/lib/supabase'
import type { StaffCodeItem } from '@/types/account'
import type {
  ServiceShift,
  ServiceStaffValidationResult,
  ServiceShiftSummaryMetrics,
} from '@/types/serviceShift'
import { fetchStaffCodes } from './staffCodeService'
import { logCashierAction } from './cashierAuditService'
import { getActiveBusinessDay } from './businessDayService'
import { ensureRoleStaffRecord, recordShiftHistoryAndReset } from './shiftHistoryService'

const LOCAL_STORAGE_SERVICE_SHIFT_ID = 'monolith_service_shift_id'
const LOCAL_STORAGE_SERVICE_STAFF_ID = 'monolith_service_staff_id'
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
 * Starts a new service shift or restores an active one for the server.
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

  // Check if staff already has an ACTIVE service shift
  const existingActive = await findActiveServiceShiftForStaff(staffId)
  if (existingActive) {
    localStorage.setItem(LOCAL_STORAGE_SERVICE_SHIFT_ID, String(existingActive.shiftId))
    localStorage.setItem(LOCAL_STORAGE_SERVICE_STAFF_ID, String(staffId))
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

  // 1. Update Staff_Codes table
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

  localStorage.setItem(LOCAL_STORAGE_SERVICE_SHIFT_ID, String(newShift.shiftId))
  localStorage.setItem(LOCAL_STORAGE_SERVICE_STAFF_ID, String(staffId))
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
 * Authoritatively retrieves active service shift.
 */
export async function getActiveServiceShift(shiftId?: number): Promise<ServiceShift | null> {
  const staffId = Number(localStorage.getItem(LOCAL_STORAGE_SERVICE_STAFF_ID)) || null
  if (!staffId) return null

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
    // ignore
  }

  const targetId = shiftId ?? (Number(localStorage.getItem(LOCAL_STORAGE_SERVICE_SHIFT_ID)) || null)
  if (!targetId) return null

  const fallbackShifts = getFallbackServiceShifts()
  const shift = fallbackShifts.find((s) => s.shiftId === targetId && s.status === 'ACTIVE') ?? null
  return shift
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
    staffId: activeShift?.staffId ?? (Number(localStorage.getItem(LOCAL_STORAGE_SERVICE_STAFF_ID)) || 0),
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

  // 4. Clear service session references
  localStorage.removeItem(LOCAL_STORAGE_SERVICE_SHIFT_ID)
  localStorage.removeItem(LOCAL_STORAGE_SERVICE_STAFF_ID)

  return updatedShift
}

/**
 * Increments total orders punched and order value in Service_Staff when a server punches an order.
 */
export async function recordServiceOrderPunched(amount = 1, orderValue = 0): Promise<void> {
  const staffIdStr = localStorage.getItem(LOCAL_STORAGE_SERVICE_STAFF_ID)
  if (!staffIdStr) return
  const staffId = Number(staffIdStr)
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
    } else {
      const { data: pubData } = await supabase
        .from('Service_Staff')
        .select('*')
        .eq('STAFF_ID', staffId)
        .limit(1)
        .maybeSingle()
      if (pubData) currentRecord = pubData as Record<string, unknown>
    }

    const currentPunched = Number(currentRecord?.TOTAL_ORDERS_PUNCHED || 0)
    const currentVal = Number(currentRecord?.TOTAL_PUNCHED_ORDERS_VALUE || 0)
    const newPunched = currentPunched + amount
    const newVal = currentVal + Number(orderValue || 0)

    await supabase
      .schema('staff')
      .from('Service_Staff')
      .update({
        TOTAL_ORDERS_PUNCHED: newPunched,
        TOTAL_PUNCHED_ORDERS_VALUE: newVal,
      })
      .eq('STAFF_ID', staffId)
  } catch (err) {
    console.warn('[serviceShiftService] recordServiceOrderPunched error:', err)
  }
}

// ─── Shift Summary Calculator ────────────────────────────────────────────────

export async function calculateServiceShiftMetrics(
  startedAt: string,
  staffId?: number,
): Promise<ServiceShiftSummaryMetrics> {
  const startTime = new Date(startedAt).getTime()
  const nowTime = Date.now()
  const durationMinutes = Math.max(1, Math.round((nowTime - startTime) / 60000))

  const orderIds = new Set<number>()
  const tableIds = new Set<number>()

  // 1. Query active Restaurant_Orders created during this shift
  try {
    const { data: activeOrders, error: activeErr } = await supabase
      .from('Restaurant_Orders')
      .select('ORDER_ID, TABLE_ID, TIME, STAFF_ID')
      .gte('TIME', startedAt)

    if (!activeErr && activeOrders) {
      for (const o of activeOrders) {
        if (staffId && o.STAFF_ID != null && Number(o.STAFF_ID) !== staffId) {
          continue
        }
        if (o.ORDER_ID) {
          orderIds.add(Number(o.ORDER_ID))
          if (o.TABLE_ID) tableIds.add(Number(o.TABLE_ID))
        }
      }
    }
  } catch (err) {
    console.warn('[serviceShiftService] Restaurant_Orders metrics lookup error:', err)
  }

  // 2. Query system_history.Order_History (orders settled/completed during this shift)
  try {
    const { data: histOrders, error: histErr } = await supabase
      .schema('system_history')
      .from('Order_History')
      .select('ORIGINAL_ORDER_ID, ORDER_ID, TABLE_ID, TIME, COMPLETED_AT, FROM_SERVICE_ID')
      .or(`TIME.gte.${startedAt},COMPLETED_AT.gte.${startedAt}`)

    if (!histErr && histOrders) {
      for (const c of histOrders) {
        if (staffId && c.FROM_SERVICE_ID != null && Number(c.FROM_SERVICE_ID) !== staffId) {
          continue
        }
        const oId = Number(c.ORIGINAL_ORDER_ID || c.ORDER_ID)
        if (oId) {
          orderIds.add(oId)
          if (c.TABLE_ID) tableIds.add(Number(c.TABLE_ID))
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
        if (orderMatch) orderIds.add(Number(orderMatch[1]))
        const tableMatch = desc.match(/Table (\d+)/i)
        if (tableMatch) tableIds.add(Number(tableMatch[1]))
      }
    }
  } catch {
    // Non-blocking
  }

  // 4. Fallback localStorage audit logs for instant reflection / offline mode
  try {
    const fallbackAudit = localStorage.getItem('monolith_cashier_audit_logs_fallback') || '[]'
    const logs = JSON.parse(fallbackAudit) as Array<{
      action: string
      createdAt: string
      staffId?: number
      metadata?: Record<string, unknown>
      entityId?: string
    }>
    for (const l of logs) {
      if (l.action === 'ORDER_CREATED' && new Date(l.createdAt).getTime() >= startTime) {
        if (staffId && l.staffId != null && Number(l.staffId) !== staffId) {
          continue
        }
        const oId = Number(l.metadata?.['order_id'] ?? l.entityId)
        if (oId) orderIds.add(oId)
        const tId = Number(l.metadata?.['table_id'])
        if (tId) tableIds.add(tId)
      }
    }
  } catch {
    // Ignore
  }

  return {
    ordersPunched: orderIds.size,
    tablesServed: tableIds.size,
    durationMinutes,
    startedAt,
  }
}

// ─── Mapper ───────────────────────────────────────────────────────────────────

function mapDbRowToServiceShift(row: Record<string, unknown>, staff?: StaffCodeItem): ServiceShift {
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
