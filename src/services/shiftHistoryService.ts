import { supabase } from '@/lib/supabase'
import type { StaffRole } from '@/types/account'

export interface ShiftHistoryEntry {
  shiftHistoryId?: number
  staffCode: number
  staffName: string
  staffRole: StaffRole
  totalOrdersPunched?: number
  totalOrdersPunchedValue?: number
  ordersAccepted?: number
  ordersCooked?: number
  ordersCancelled?: number
  ordersCompleted?: number
  totalTablesHandled?: number
  totalShiftEarning?: number
  shiftStarted: string
  shiftEnded: string
}

/**
 * Ensures that a single shift state row exists for the staff member in the
 * corresponding role table (Cashier_Staff, Dispatcher_Staff, Service_Staff).
 * Receptionist and Organizer do not have shift tables.
 * Also deduplicates rows if any duplicates exist.
 */
export async function ensureRoleStaffRecord(staffId: number, role: StaffRole): Promise<void> {
  if (!staffId || isNaN(staffId) || staffId <= 0) return
  if (role === 'RECEPTIONIST' || role === 'ORGANIZER') return

  try {
    if (role === 'CASHIER') {
      const { data } = await supabase
        .schema('staff')
        .from('Cashier_Staff')
        .select('*')
        .eq('STAFF_ID', staffId)

      const records = (data as Array<Record<string, unknown>>) || []
      if (records.length === 0) {
        await supabase
          .schema('staff')
          .from('Cashier_Staff')
          .insert([
            {
              STAFF_ID: staffId,
              TOTAL_SHIFT_EARNING: 0,
              TOTAL_TABLES_HANDLED: 0,
            },
          ])
      } else if (records.length > 1) {
        // Keep the first row, delete duplicate rows to enforce 1-to-1 relationship
        const duplicateIds = records.slice(1).map((r) => r.CASHIER_ID).filter(Boolean)
        if (duplicateIds.length > 0) {
          await supabase
            .schema('staff')
            .from('Cashier_Staff')
            .delete()
            .in('CASHIER_ID', duplicateIds)
        }
      }
    } else if (role === 'DISPATCHER') {
      const { data } = await supabase
        .schema('staff')
        .from('Dispatcher_Staff')
        .select('*')
        .eq('STAFF_ID', staffId)

      const records = (data as Array<Record<string, unknown>>) || []
      if (records.length === 0) {
        await supabase
          .schema('staff')
          .from('Dispatcher_Staff')
          .insert([
            {
              STAFF_ID: staffId,
              ORDERS_ACCEPTED: 0,
              ORDERS_COOKED: 0,
              ORDERS_CANCELLED: 0,
              ORDERS_COMPLETED: 0,
            },
          ])
      } else if (records.length > 1) {
        const duplicateIds = records.slice(1).map((r) => r.DISPATCHER_ID).filter(Boolean)
        if (duplicateIds.length > 0) {
          await supabase
            .schema('staff')
            .from('Dispatcher_Staff')
            .delete()
            .in('DISPATCHER_ID', duplicateIds)
        }
      }
    } else if (role === 'SERVICE') {
      const { data } = await supabase
        .schema('staff')
        .from('Service_Staff')
        .select('*')
        .eq('STAFF_ID', staffId)

      const records = (data as Array<Record<string, unknown>>) || []
      if (records.length === 0) {
        await supabase
          .schema('staff')
          .from('Service_Staff')
          .insert([
            {
              STAFF_ID: staffId,
              TOTAL_ORDERS_PUNCHED: 0,
              TOTAL_PUNCHED_ORDERS_VALUE: 0,
            },
          ])
      } else if (records.length > 1) {
        const duplicateIds = records.slice(1).map((r) => r.SERVICE_ID).filter(Boolean)
        if (duplicateIds.length > 0) {
          await supabase
            .schema('staff')
            .from('Service_Staff')
            .delete()
            .in('SERVICE_ID', duplicateIds)
        }
      }
    }
  } catch (err) {
    console.warn(`[shiftHistoryService] ensureRoleStaffRecord error for staff #${staffId} (${role}):`, err)
  }
}

/**
 * Removes role shift table records when a staff code is deleted.
 */
export async function deleteRoleStaffRecord(staffId: number, role?: StaffRole): Promise<void> {
  if (!staffId) return

  try {
    if (!role || role === 'CASHIER') {
      await supabase.schema('staff').from('Cashier_Staff').delete().eq('STAFF_ID', staffId)
    }
    if (!role || role === 'DISPATCHER') {
      await supabase.schema('staff').from('Dispatcher_Staff').delete().eq('STAFF_ID', staffId)
    }
    if (!role || role === 'SERVICE') {
      await supabase.schema('staff').from('Service_Staff').delete().eq('STAFF_ID', staffId)
    }
  } catch (err) {
    console.warn(`[shiftHistoryService] deleteRoleStaffRecord error for staff #${staffId}:`, err)
  }
}

/**
 * When ending a staff member's shift:
 * 1. Reads current shift metrics from the respective role table.
 * 2. Writes a complete record to system_history.Shift_History with the role-specific metrics.
 * 3. Resets the role table values back to 0 for that staff member.
 * 4. Marks Staff_Codes.SHIFT_STATUS = 'ENDED'.
 */
export async function recordShiftHistoryAndReset(
  staffId: number,
  fallbackInfo?: {
    staffCode?: number
    staffName?: string
    staffRole?: StaffRole
    startedAt?: string
    endedAt?: string
  },
): Promise<void> {
  if (!staffId) return

  const now = fallbackInfo?.endedAt || new Date().toISOString()

  // 1. Fetch Staff_Codes record
  let staffName = fallbackInfo?.staffName || `Staff #${staffId}`
  let staffRole: StaffRole = fallbackInfo?.staffRole || 'CASHIER'
  let staffCode = fallbackInfo?.staffCode || staffId
  let shiftStarted = fallbackInfo?.startedAt || now

  try {
    const { data: codeData } = await supabase
      .schema('staff')
      .from('Staff_Codes')
      .select('*')
      .eq('CODE_ID', staffId)
      .maybeSingle()

    if (codeData) {
      staffName = (codeData.STAFF_NAME as string) || staffName
      staffRole = (codeData.STAFF_ROLE as StaffRole) || staffRole
      staffCode = Number(codeData.STAFF_CODE || codeData.CODE_ID || staffCode)
      shiftStarted = (codeData.SHIFT_START as string) || shiftStarted
    }
  } catch (err) {
    console.warn(`[shiftHistoryService] Error loading Staff_Codes for #${staffId}:`, err)
  }

  // Receptionist and Organizer do not track shifts
  if (staffRole === 'RECEPTIONIST' || staffRole === 'ORGANIZER') {
    try {
      await supabase
        .schema('staff')
        .from('Staff_Codes')
        .update({ SHIFT_STATUS: 'ENDED', SHIFT_END: now })
        .eq('CODE_ID', staffId)
    } catch {
      // ignore
    }
    return
  }

  // 2. Fetch role-specific shift metrics & prepare Shift_History payload
  const historyPayload: Record<string, unknown> = {
    STAFF_CODE: staffCode,
    STAFF_NAME: staffName,
    STAFF_ROLE: staffRole,
    SHIFT_STARTED: shiftStarted,
    SHIFT_ENDED: now,
  }

  try {
    if (staffRole === 'CASHIER') {
      const { data: cashierRows } = await supabase
        .schema('staff')
        .from('Cashier_Staff')
        .select('*')
        .eq('STAFF_ID', staffId)

      const row = (cashierRows?.[0] as Record<string, unknown>) || null
      const totalTables = Number(row?.TOTAL_TABLES_HANDLED || 0)
      const totalEarnings = Number(row?.TOTAL_SHIFT_EARNING || 0)

      historyPayload.TOTAL_TABLES_HANDLED = totalTables
      historyPayload.TOTAL_SHIFT_EARNING = totalEarnings

      // Reset Cashier_Staff metrics to 0
      await supabase
        .schema('staff')
        .from('Cashier_Staff')
        .update({
          TOTAL_TABLES_HANDLED: 0,
          TOTAL_SHIFT_EARNING: 0,
        })
        .eq('STAFF_ID', staffId)

      // Deduplicate if needed
      if (cashierRows && cashierRows.length > 1) {
        const dupIds = cashierRows.slice(1).map((r) => r.CASHIER_ID).filter(Boolean)
        if (dupIds.length > 0) {
          await supabase.schema('staff').from('Cashier_Staff').delete().in('CASHIER_ID', dupIds)
        }
      }
    } else if (staffRole === 'DISPATCHER') {
      const { data: dispRows } = await supabase
        .schema('staff')
        .from('Dispatcher_Staff')
        .select('*')
        .eq('STAFF_ID', staffId)

      const row = (dispRows?.[0] as Record<string, unknown>) || null
      const accepted = Number(row?.ORDERS_ACCEPTED || 0)
      const cooked = Number(row?.ORDERS_COOKED || 0)
      const cancelled = Number(row?.ORDERS_CANCELLED || 0)
      const completed = Number(row?.ORDERS_COMPLETED || 0)

      historyPayload.ORDERS_ACCEPTED = accepted
      historyPayload.ORDERS_COOKED = cooked
      historyPayload.ORDERS_CANCELLED = cancelled
      historyPayload.ORDERS_COMPLETED = completed

      // Reset Dispatcher_Staff metrics to 0
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

      if (dispRows && dispRows.length > 1) {
        const dupIds = dispRows.slice(1).map((r) => r.DISPATCHER_ID).filter(Boolean)
        if (dupIds.length > 0) {
          await supabase.schema('staff').from('Dispatcher_Staff').delete().in('DISPATCHER_ID', dupIds)
        }
      }
    } else if (staffRole === 'SERVICE') {
      const { data: servRows } = await supabase
        .schema('staff')
        .from('Service_Staff')
        .select('*')
        .eq('STAFF_ID', staffId)

      const row = (servRows?.[0] as Record<string, unknown>) || null
      const punched = Number(row?.TOTAL_ORDERS_PUNCHED || 0)
      const punchedValue = Number(row?.TOTAL_PUNCHED_ORDERS_VALUE || 0)

      historyPayload.TOTAL_ORDERS_PUNCHED = punched
      historyPayload.TOTAL_ORDERS_PUNCHED_VALUE = punchedValue

      // Reset Service_Staff metrics to 0
      await supabase
        .schema('staff')
        .from('Service_Staff')
        .update({
          TOTAL_ORDERS_PUNCHED: 0,
          TOTAL_PUNCHED_ORDERS_VALUE: 0,
        })
        .eq('STAFF_ID', staffId)

      if (servRows && servRows.length > 1) {
        const dupIds = servRows.slice(1).map((r) => r.SERVICE_ID).filter(Boolean)
        if (dupIds.length > 0) {
          await supabase.schema('staff').from('Service_Staff').delete().in('SERVICE_ID', dupIds)
        }
      }
    }
  } catch (fetchErr) {
    console.warn(`[shiftHistoryService] Error querying role table for #${staffId}:`, fetchErr)
  }

  // 3. Write record into system_history.Shift_History
  try {
    const { error: histErr } = await supabase
      .schema('system_history')
      .from('Shift_History')
      .insert([historyPayload])

    if (histErr) {
      // Try public schema fallback
      const { error: pubHistErr } = await supabase
        .from('Shift_History')
        .insert([historyPayload])
      if (pubHistErr) {
        console.warn('[shiftHistoryService] Insert into Shift_History failed:', histErr, pubHistErr)
      }
    }
  } catch (insertErr) {
    console.warn('[shiftHistoryService] Insert into Shift_History error:', insertErr)
  }

  // 4. Update Staff_Codes to mark shift as ended
  try {
    const { error: codeErr } = await supabase
      .schema('staff')
      .from('Staff_Codes')
      .update({
        SHIFT_STATUS: 'ENDED',
        SHIFT_END: now,
      })
      .eq('CODE_ID', staffId)

    if (codeErr) {
      await supabase
        .from('Staff_Codes')
        .update({
          SHIFT_STATUS: 'ENDED',
          SHIFT_END: now,
        })
        .eq('CODE_ID', staffId)
    }
  } catch (err) {
    console.warn(`[shiftHistoryService] Error updating Staff_Codes shift end for #${staffId}:`, err)
  }
}
