import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { StaffCodeItem } from '@/types/account'
import { validateReceptionistStaff, endStaffShiftManually } from '@/services/staffCodeService'
import {
  getDeviceId,
  getDeviceName,
  getTerminalSession,
  saveTerminalSession,
  clearTerminalSession,
  checkStaffActiveOnOtherTerminal,
  subscribeToSessionEvents,
} from '@/services/terminalSessionService'
import { supabase } from '@/lib/supabase'

export interface ReceptionistSessionContextValue {
  staff: StaffCodeItem | null
  shiftStart: string | null
  isAuthenticated: boolean
  loading: boolean
  error: string | null
  authenticate: (staffId: number) => Promise<StaffCodeItem>
  endShift: () => Promise<void>
  logout: () => void
  clearError: () => void
}

export const ReceptionistSessionContext = createContext<ReceptionistSessionContextValue | undefined>(undefined)

export function ReceptionistSessionProvider({ children }: { children: React.ReactNode }) {
  const [staff, setStaff] = useState<StaffCodeItem | null>(null)
  const [shiftStart, setShiftStart] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const clearError = useCallback(() => setError(null), [])

  const logout = useCallback(() => {
    clearTerminalSession('RECEPTIONIST')
    setStaff(null)
    setShiftStart(null)
    setError(null)
  }, [])

  const restoreSession = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const activeTermSession = getTerminalSession('RECEPTIONIST')
      if (!activeTermSession) {
        logout()
        return
      }

      const result = await validateReceptionistStaff(activeTermSession.staffId)
      if (result.valid && result.staff) {
        // Authoritative database check: shift must be ONGOING
        if (result.staff.shiftStatus !== 'ONGOING') {
          console.info('[ReceptionistSessionProvider] Shift was ended in database. Clearing terminal session.')
          logout()
          return
        }

        setStaff(result.staff)
        setShiftStart(activeTermSession.startedAt || result.staff.shiftStart || new Date().toISOString())
      } else {
        logout()
      }
    } catch (err) {
      console.warn('[ReceptionistSessionProvider] Failed to restore session:', err)
      logout()
    } finally {
      setLoading(false)
    }
  }, [logout])

  useEffect(() => {
    void restoreSession()

    // Listen for real-time shift ends / force-logouts across network
    const unsubscribe = subscribeToSessionEvents((ev) => {
      if (ev.type === 'FORCE_LOGOUT' || ev.type === 'SHIFT_ENDED') {
        setStaff((currentStaff) => {
          if (currentStaff && currentStaff.codeId === ev.staffId) {
            console.info(`[ReceptionistSessionProvider] Received ${ev.type} for staff #${ev.staffId}. Logging out.`)
            clearTerminalSession('RECEPTIONIST', ev.staffId)
            setShiftStart(null)
            return null
          }
          return currentStaff
        })
      }
    })

    return () => {
      unsubscribe()
    }
  }, [restoreSession])

  const authenticate = useCallback(async (staffId: number): Promise<StaffCodeItem> => {
    setLoading(true)
    setError(null)
    try {
      const result = await validateReceptionistStaff(staffId)
      if (!result.valid || !result.staff) {
        const msg = result.error || 'Receptionist verification failed.'
        setError(msg)
        throw new Error(msg)
      }

      // Check if this staff member is already actively clocked in on another terminal
      const conflict = await checkStaffActiveOnOtherTerminal(staffId, 'RECEPTIONIST')
      if (conflict.isConflict) {
        const conflictMsg = `Staff #${staffId} (${conflict.staffName}) is already on an active shift on another terminal. Terminal sessions are unique per PC.`
        setError(conflictMsg)
        throw new Error(conflictMsg)
      }

      const now = new Date().toISOString()
      const shiftId = Date.now()

      // Update Staff_Codes shift status to ONGOING
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
      } catch (updateErr) {
        console.warn('[ReceptionistSessionProvider] Failed to update Staff_Codes shift status:', updateErr)
      }

      const updatedStaff: StaffCodeItem = {
        ...result.staff,
        shiftStatus: 'ONGOING',
        shiftStart: now,
        shiftEnd: null,
      }

      // Save terminal-specific session bound to this device
      saveTerminalSession({
        staffId: result.staff.codeId,
        staffName: result.staff.staffName,
        staffRole: 'RECEPTIONIST',
        shiftId,
        startedAt: now,
        deviceId: getDeviceId(),
        deviceName: getDeviceName(),
      })

      setStaff(updatedStaff)
      setShiftStart(now)
      return updatedStaff
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Receptionist verification failed.'
      setError(msg)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const endShift = useCallback(async () => {
    if (staff?.codeId) {
      try {
        await endStaffShiftManually(staff.codeId)
      } catch (err) {
        console.warn('[ReceptionistSessionProvider] Error ending receptionist shift:', err)
      }
    }
    logout()
  }, [staff, logout])

  const value: ReceptionistSessionContextValue = {
    staff,
    shiftStart,
    isAuthenticated: Boolean(staff && staff.shiftStatus === 'ONGOING'),
    loading,
    error,
    authenticate,
    endShift,
    logout,
    clearError,
  }

  return (
    <ReceptionistSessionContext.Provider value={value}>
      {children}
    </ReceptionistSessionContext.Provider>
  )
}

export function useReceptionistSession(): ReceptionistSessionContextValue {
  const context = useContext(ReceptionistSessionContext)
  if (!context) {
    throw new Error('useReceptionistSession must be used within a ReceptionistSessionProvider')
  }
  return context
}
