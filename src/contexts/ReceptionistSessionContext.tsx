import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { StaffCodeItem } from '@/types/account'
import { validateReceptionistStaff, endStaffShiftManually } from '@/services/staffCodeService'
import { supabase } from '@/lib/supabase'

const SESSION_STORAGE_RECEPTIONIST_STAFF_ID = 'monolith_receptionist_staff_id'
const SESSION_STORAGE_RECEPTIONIST_SHIFT_START = 'monolith_receptionist_shift_start'

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

  const restoreSession = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const storedId =
        sessionStorage.getItem(SESSION_STORAGE_RECEPTIONIST_STAFF_ID) ||
        localStorage.getItem('monolith_receptionist_staff_id')
      const storedStart =
        sessionStorage.getItem(SESSION_STORAGE_RECEPTIONIST_SHIFT_START) ||
        localStorage.getItem('monolith_receptionist_shift_start')

      if (storedId) {
        const parsedId = Number(storedId)
        if (parsedId > 0) {
          const result = await validateReceptionistStaff(parsedId)
          if (result.valid && result.staff) {
            setStaff(result.staff)
            setShiftStart(storedStart || result.staff.shiftStart || new Date().toISOString())
          } else {
            sessionStorage.removeItem(SESSION_STORAGE_RECEPTIONIST_STAFF_ID)
            localStorage.removeItem('monolith_receptionist_staff_id')
            sessionStorage.removeItem(SESSION_STORAGE_RECEPTIONIST_SHIFT_START)
            localStorage.removeItem('monolith_receptionist_shift_start')
            setStaff(null)
            setShiftStart(null)
          }
        }
      } else {
        setStaff(null)
        setShiftStart(null)
      }
    } catch (err) {
      console.warn('[ReceptionistSessionProvider] Failed to restore session:', err)
      sessionStorage.removeItem(SESSION_STORAGE_RECEPTIONIST_STAFF_ID)
      localStorage.removeItem('monolith_receptionist_staff_id')
      sessionStorage.removeItem(SESSION_STORAGE_RECEPTIONIST_SHIFT_START)
      localStorage.removeItem('monolith_receptionist_shift_start')
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
      const result = await validateReceptionistStaff(staffId)
      if (!result.valid || !result.staff) {
        const msg = result.error || 'Receptionist verification failed.'
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
        console.warn('[ReceptionistSessionProvider] Failed to update Staff_Codes shift status:', updateErr)
      }

      const updatedStaff: StaffCodeItem = {
        ...result.staff,
        shiftStatus: 'ONGOING',
        shiftStart: now,
        shiftEnd: null,
      }

      setStaff(updatedStaff)
      setShiftStart(now)
      sessionStorage.setItem(SESSION_STORAGE_RECEPTIONIST_STAFF_ID, String(result.staff.codeId))
      localStorage.setItem('monolith_receptionist_staff_id', String(result.staff.codeId))
      sessionStorage.setItem(SESSION_STORAGE_RECEPTIONIST_SHIFT_START, now)
      localStorage.setItem('monolith_receptionist_shift_start', now)
      return updatedStaff
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Receptionist verification failed.'
      setError(msg)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(() => {
    sessionStorage.removeItem(SESSION_STORAGE_RECEPTIONIST_STAFF_ID)
    localStorage.removeItem('monolith_receptionist_staff_id')
    sessionStorage.removeItem(SESSION_STORAGE_RECEPTIONIST_SHIFT_START)
    localStorage.removeItem('monolith_receptionist_shift_start')
    setStaff(null)
    setShiftStart(null)
    setError(null)
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
    isAuthenticated: Boolean(staff),
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
