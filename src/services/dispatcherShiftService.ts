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
      const { data: pubData } = await supabase
        .from('Staff_Codes')
        .select('*')
        .eq('CODE_ID', staffId)
        .maybeSingle()

      if (pubData) {
        staff = {
          codeId: Number(pubData.CODE_ID),
          staffName: String(pubData.STAFF_NAME || 'Dispatcher'),
          staffRole: String(pubData.STAFF_ROLE || 'DISPATCHER').toUpperCase() as StaffCodeItem['staffRole'],
          codeStatus: (pubData.CODE_STATUS || pubData.STATUS || 'ACTIVE') as StaffCodeItem['codeStatus'],
          status: (pubData.CODE_STATUS || pubData.STATUS || 'ACTIVE') as StaffCodeItem['codeStatus'],
          shiftStatus: (pubData.SHIFT_STATUS || 'ENDED') as StaffCodeItem['shiftStatus'],
          shiftStart: pubData.SHIFT_START ? String(pubData.SHIFT_START) : null,
          shiftEnd: pubData.SHIFT_END ? String(pubData.SHIFT_END) : null,
        }
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
    const { error: codeErr } = await supabase
      .schema('staff')
      .from('Staff_Codes')
      .update(codePayload)
      .eq('CODE_ID', staffId)

    if (codeErr) {
      await supabase.from('Staff_Codes').update(codePayload).eq('CODE_ID', staffId)
    }
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
  const staffId = terminalSession?.staffId
  if (!staffId) return

  try {
    await ensureRoleStaffRecord(staffId, 'DISPATCHER')

    let record: Record<string, unknown> | null = null
    const { data: schemaData } = await supabase
      .schema('staff')
      .from('Dispatcher_Staff')
      .select('*')
      .eq('STAFF_ID', staffId)
      .limit(1)
      .maybeSingle()

    if (schemaData) {
      record = schemaData as Record<string, unknown>
    } else {
      const { data: pubData } = await supabase
        .from('Dispatcher_Staff')
        .select('*')
        .eq('STAFF_ID', staffId)
        .limit(1)
        .maybeSingle()
      if (pubData) record = pubData as Record<string, unknown>
    }

    const currentVal = Number(record?.[columnName] || 0)
    const newVal = currentVal + amount

    await supabase
      .schema('staff')
      .from('Dispatcher_Staff')
      .update({ [columnName]: newVal })
      .eq('STAFF_ID', staffId)
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
  try {
    let record: Record<string, unknown> | null = null
    const { data: schemaData } = await supabase
      .schema('staff')
      .from('Dispatcher_Staff')
      .select('*')
      .eq('STAFF_ID', staffId)
      .limit(1)
      .maybeSingle()

    if (schemaData) {
      record = schemaData as Record<string, unknown>
    } else {
      const { data: pubData } = await supabase
        .from('Dispatcher_Staff')
        .select('*')
        .eq('STAFF_ID', staffId)
        .limit(1)
        .maybeSingle()
      if (pubData) record = pubData as Record<string, unknown>
    }

    return {
      ordersAccepted: Number(record?.ORDERS_ACCEPTED || 0),
      ordersCooked: Number(record?.ORDERS_COOKED || 0),
      ordersCancelled: Number(record?.ORDERS_CANCELLED || 0),
      ordersCompleted: Number(record?.ORDERS_COMPLETED || 0),
    }
  } catch (err) {
    console.warn('[dispatcherShiftService] getDispatcherShiftMetrics error:', err)
    return {
      ordersAccepted: 0,
      ordersCooked: 0,
      ordersCancelled: 0,
      ordersCompleted: 0,
    }
  }
}

