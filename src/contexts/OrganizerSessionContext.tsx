import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { StaffCodeItem } from '@/types/account'
import { validateOrganizerStaff, endStaffShiftManually } from '@/services/staffCodeService'
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

export interface OrganizerSessionContextValue {
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

export const OrganizerSessionContext = createContext<OrganizerSessionContextValue | undefined>(undefined)

export function OrganizerSessionProvider({ children }: { children: React.ReactNode }) {
  const [staff, setStaff] = useState<StaffCodeItem | null>(null)
  const [shiftStart, setShiftStart] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const clearError = useCallback(() => setError(null), [])

  const logout = useCallback(() => {
    clearTerminalSession('ORGANIZER')
    setStaff(null)
    setShiftStart(null)
    setError(null)
  }, [])

  const restoreSession = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const activeTermSession = getTerminalSession('ORGANIZER')
      if (!activeTermSession) {
        // No session belonging to THIS terminal
        logout()
        return
      }

      const result = await validateOrganizerStaff(activeTermSession.staffId)
      if (result.valid && result.staff) {
        // Authoritative database check: shift MUST be ONGOING
        if (result.staff.shiftStatus !== 'ONGOING') {
          console.info('[OrganizerSessionProvider] Shift was ended in database. Clearing terminal session.')
          logout()
          return
        }

        setStaff(result.staff)
        setShiftStart(activeTermSession.startedAt || result.staff.shiftStart || new Date().toISOString())
      } else {
        logout()
      }
    } catch (err) {
      console.warn('[OrganizerSessionProvider] Failed to restore session:', err)
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
            console.info(`[OrganizerSessionProvider] Received ${ev.type} for staff #${ev.staffId}. Logging out.`)
            clearTerminalSession('ORGANIZER', ev.staffId)
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
      const result = await validateOrganizerStaff(staffId)
      if (!result.valid || !result.staff) {
        const msg = result.error || 'Organizer verification failed.'
        setError(msg)
        throw new Error(msg)
      }

      // Check if this staff member is already actively clocked in on another terminal
      const conflict = await checkStaffActiveOnOtherTerminal(staffId, 'ORGANIZER')
      if (conflict.isConflict) {
        const conflictMsg = `Staff #${staffId} (${conflict.staffName}) is already on an active shift on another terminal. Terminal sessions are unique per PC.`
        setError(conflictMsg)
        throw new Error(conflictMsg)
      }

      const now = new Date().toISOString()
      const shiftId = Date.now()

      // Update Staff_Codes shift status to ONGOING in Supabase
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
        console.warn('[OrganizerSessionProvider] Failed to update Staff_Codes shift status:', updateErr)
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
        staffRole: 'ORGANIZER',
        shiftId,
        startedAt: now,
        deviceId: getDeviceId(),
        deviceName: getDeviceName(),
      })

      setStaff(updatedStaff)
      setShiftStart(now)
      return updatedStaff
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Organizer verification failed.'
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
        console.warn('[OrganizerSessionProvider] Error ending organizer shift:', err)
      }
    }
    logout()
  }, [staff, logout])

  const value: OrganizerSessionContextValue = {
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
    <OrganizerSessionContext.Provider value={value}>
      {children}
    </OrganizerSessionContext.Provider>
  )
}

export function useOrganizerSession(): OrganizerSessionContextValue {
  const context = useContext(OrganizerSessionContext)
  if (!context) {
    throw new Error('useOrganizerSession must be used within an OrganizerSessionProvider')
  }
  return context
}
