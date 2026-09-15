import { supabase } from '@/lib/supabase'
import type { StaffCodeItem } from '@/types/account'
import type {
  CashierShift,
  CashierStaffValidationResult,
  ShiftSummaryMetrics,
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
