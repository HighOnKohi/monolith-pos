import { supabase } from '@/lib/supabase'
import type { StaffCodeItem } from '@/types/account'
import { getActiveBusinessDay } from './businessDayService'

const LOCAL_STORAGE_DISPATCHER_SHIFT_ID = 'monolith_dispatcher_shift_id'
const LOCAL_STORAGE_DISPATCHER_STAFF_ID = 'monolith_dispatcher_staff_id'

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
 * Starts a new dispatcher shift.
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

  const now = new Date().toISOString()
  const shiftId = Date.now()

  // 1. Update Staff_Codes row
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

  // 2. Create/upsert row in Dispatcher_Staff
  try {
    const dispatcherPayload = {
      DISPATCHER_ID: shiftId,
      STAFF_ID: staffId,
      ORDERS_ACCEPTED: 0,
      ORDERS_COOKED: 0,
      ORDERS_CANCELLED: 0,
      ORDERS_COMPLETED: 0,
    }

    const { error: dispErr } = await supabase
      .schema('staff')
      .from('Dispatcher_Staff')
      .insert([dispatcherPayload])

    if (dispErr) {
      await supabase.from('Dispatcher_Staff').insert([dispatcherPayload])
    }
  } catch (err) {
    console.warn('[dispatcherShiftService] Failed to insert Dispatcher_Staff record:', err)
  }

  localStorage.setItem(LOCAL_STORAGE_DISPATCHER_SHIFT_ID, String(shiftId))
  localStorage.setItem(LOCAL_STORAGE_DISPATCHER_STAFF_ID, String(staffId))

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
 * Restores the currently active dispatcher shift from localStorage and Supabase.
 */
export async function getActiveDispatcherShift(): Promise<DispatcherShift | null> {
  const staffIdStr = localStorage.getItem(LOCAL_STORAGE_DISPATCHER_STAFF_ID)
  const shiftIdStr = localStorage.getItem(LOCAL_STORAGE_DISPATCHER_SHIFT_ID)

  if (!staffIdStr) return null
  const staffId = Number(staffIdStr)
  if (!staffId || isNaN(staffId)) return null

  const validation = await validateDispatcherStaff(staffId)
  if (!validation.valid || !validation.staff) {
    localStorage.removeItem(LOCAL_STORAGE_DISPATCHER_SHIFT_ID)
    localStorage.removeItem(LOCAL_STORAGE_DISPATCHER_STAFF_ID)
    return null
  }

  const staff = validation.staff
  if (staff.shiftStatus === 'ENDED') {
    localStorage.removeItem(LOCAL_STORAGE_DISPATCHER_SHIFT_ID)
    localStorage.removeItem(LOCAL_STORAGE_DISPATCHER_STAFF_ID)
    return null
  }

  return {
    shiftId: shiftIdStr ? Number(shiftIdStr) : Date.now(),
    staffId,
    staffName: staff.staffName,
    staffRole: staff.staffRole,
    startedAt: staff.shiftStart || new Date().toISOString(),
    ordersAccepted: 0,
    ordersCooked: 0,
    ordersCancelled: 0,
    ordersCompleted: 0,
  }
}

/**
 * Ends the active dispatcher shift.
 */
export async function endDispatcherShift(): Promise<void> {
  const staffIdStr = localStorage.getItem(LOCAL_STORAGE_DISPATCHER_STAFF_ID)
  const now = new Date().toISOString()

  if (staffIdStr) {
    const staffId = Number(staffIdStr)
    try {
      const codePayload = {
        SHIFT_STATUS: 'ENDED',
        SHIFT_END: now,
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
      console.warn('[dispatcherShiftService] Failed to end Staff_Codes shift:', err)
    }
  }

  localStorage.removeItem(LOCAL_STORAGE_DISPATCHER_SHIFT_ID)
  localStorage.removeItem(LOCAL_STORAGE_DISPATCHER_STAFF_ID)
}

// ─── Metric Increments in Dispatcher_Staff ─────────────────────────────────────

async function incrementDispatcherColumn(columnName: 'ORDERS_ACCEPTED' | 'ORDERS_COOKED' | 'ORDERS_CANCELLED' | 'ORDERS_COMPLETED', amount = 1) {
  const staffIdStr = localStorage.getItem(LOCAL_STORAGE_DISPATCHER_STAFF_ID)
  if (!staffIdStr) return
  const staffId = Number(staffIdStr)
  if (!staffId) return

  try {
    // 1. Fetch current value in Dispatcher_Staff
    let record: Record<string, unknown> | null = null
    const { data: schemaData } = await supabase
      .schema('staff')
      .from('Dispatcher_Staff')
      .select('*')
      .eq('STAFF_ID', staffId)
      .order('DISPATCHER_ID', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (schemaData) {
      record = schemaData as Record<string, unknown>
    } else {
      const { data: pubData } = await supabase
        .from('Dispatcher_Staff')
        .select('*')
        .eq('STAFF_ID', staffId)
        .order('DISPATCHER_ID', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (pubData) record = pubData as Record<string, unknown>
    }

    const currentVal = Number(record?.[columnName] || 0)
    const newVal = currentVal + amount

    if (record?.DISPATCHER_ID) {
      const { error: updateErr } = await supabase
        .schema('staff')
        .from('Dispatcher_Staff')
        .update({ [columnName]: newVal })
        .eq('DISPATCHER_ID', record.DISPATCHER_ID)

      if (updateErr) {
        await supabase
          .from('Dispatcher_Staff')
          .update({ [columnName]: newVal })
          .eq('DISPATCHER_ID', record.DISPATCHER_ID)
      }
    } else {
      // Insert new row if none found
      const newPayload = {
        DISPATCHER_ID: Date.now(),
        STAFF_ID: staffId,
        ORDERS_ACCEPTED: columnName === 'ORDERS_ACCEPTED' ? amount : 0,
        ORDERS_COOKED: columnName === 'ORDERS_COOKED' ? amount : 0,
        ORDERS_CANCELLED: columnName === 'ORDERS_CANCELLED' ? amount : 0,
        ORDERS_COMPLETED: columnName === 'ORDERS_COMPLETED' ? amount : 0,
      }
      const { error: insErr } = await supabase.schema('staff').from('Dispatcher_Staff').insert([newPayload])
      if (insErr) await supabase.from('Dispatcher_Staff').insert([newPayload])
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
