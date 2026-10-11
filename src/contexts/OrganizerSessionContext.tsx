import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { StaffCodeItem } from '@/types/account'
import { validateOrganizerStaff, endStaffShiftManually } from '@/services/staffCodeService'
import { supabase } from '@/lib/supabase'

const SESSION_STORAGE_ORGANIZER_STAFF_ID = 'monolith_organizer_staff_id'
const SESSION_STORAGE_ORGANIZER_SHIFT_START = 'monolith_organizer_shift_start'

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

  const restoreSession = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const storedId =
        sessionStorage.getItem(SESSION_STORAGE_ORGANIZER_STAFF_ID) ||
        localStorage.getItem(SESSION_STORAGE_ORGANIZER_STAFF_ID)
      const storedStart =
        sessionStorage.getItem(SESSION_STORAGE_ORGANIZER_SHIFT_START) ||
        localStorage.getItem(SESSION_STORAGE_ORGANIZER_SHIFT_START)

      if (storedId) {
        const parsedId = Number(storedId)
        if (parsedId > 0) {
          const result = await validateOrganizerStaff(parsedId)
          if (result.valid && result.staff) {
            setStaff(result.staff)
            setShiftStart(storedStart || result.staff.shiftStart || new Date().toISOString())
          } else {
            sessionStorage.removeItem(SESSION_STORAGE_ORGANIZER_STAFF_ID)
            localStorage.removeItem(SESSION_STORAGE_ORGANIZER_STAFF_ID)
            sessionStorage.removeItem(SESSION_STORAGE_ORGANIZER_SHIFT_START)
            localStorage.removeItem(SESSION_STORAGE_ORGANIZER_SHIFT_START)
            setStaff(null)
            setShiftStart(null)
          }
        }
      } else {
        setStaff(null)
        setShiftStart(null)
      }
    } catch (err) {
      console.warn('[OrganizerSessionProvider] Failed to restore session:', err)
      sessionStorage.removeItem(SESSION_STORAGE_ORGANIZER_STAFF_ID)
      localStorage.removeItem(SESSION_STORAGE_ORGANIZER_STAFF_ID)
      sessionStorage.removeItem(SESSION_STORAGE_ORGANIZER_SHIFT_START)
      localStorage.removeItem(SESSION_STORAGE_ORGANIZER_SHIFT_START)
      setStaff(null)
      setShiftStart(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void restoreSession()
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

      const now = new Date().toISOString()

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
        console.warn('[OrganizerSessionProvider] Failed to update Staff_Codes shift status:', updateErr)
      }

      const updatedStaff: StaffCodeItem = {
        ...result.staff,
        shiftStatus: 'ONGOING',
        shiftStart: now,
        shiftEnd: null,
      }

      setStaff(updatedStaff)
      setShiftStart(now)
      sessionStorage.setItem(SESSION_STORAGE_ORGANIZER_STAFF_ID, String(result.staff.codeId))
      localStorage.setItem(SESSION_STORAGE_ORGANIZER_STAFF_ID, String(result.staff.codeId))
      sessionStorage.setItem(SESSION_STORAGE_ORGANIZER_SHIFT_START, now)
      localStorage.setItem(SESSION_STORAGE_ORGANIZER_SHIFT_START, now)
      return updatedStaff
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Organizer verification failed.'
      setError(msg)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(() => {
    sessionStorage.removeItem(SESSION_STORAGE_ORGANIZER_STAFF_ID)
    localStorage.removeItem(SESSION_STORAGE_ORGANIZER_STAFF_ID)
    sessionStorage.removeItem(SESSION_STORAGE_ORGANIZER_SHIFT_START)
    localStorage.removeItem(SESSION_STORAGE_ORGANIZER_SHIFT_START)
    setStaff(null)
    setShiftStart(null)
    setError(null)
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
    isAuthenticated: Boolean(staff),
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
