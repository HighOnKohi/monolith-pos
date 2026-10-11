import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { StaffCodeItem } from '@/types/account'
import { validateReceptionistStaff } from '@/services/staffCodeService'

const SESSION_STORAGE_RECEPTIONIST_STAFF_ID = 'monolith_receptionist_staff_id'

export interface ReceptionistSessionContextValue {
  staff: StaffCodeItem | null
  isAuthenticated: boolean
  loading: boolean
  error: string | null
  authenticate: (staffId: number) => Promise<StaffCodeItem>
  logout: () => void
  clearError: () => void
}

export const ReceptionistSessionContext = createContext<ReceptionistSessionContextValue | undefined>(undefined)

export function ReceptionistSessionProvider({ children }: { children: React.ReactNode }) {
  const [staff, setStaff] = useState<StaffCodeItem | null>(null)
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

      if (storedId) {
        const parsedId = Number(storedId)
        if (parsedId > 0) {
          const result = await validateReceptionistStaff(parsedId)
          if (result.valid && result.staff) {
            setStaff(result.staff)
          } else {
            sessionStorage.removeItem(SESSION_STORAGE_RECEPTIONIST_STAFF_ID)
            localStorage.removeItem('monolith_receptionist_staff_id')
            setStaff(null)
          }
        }
      } else {
        setStaff(null)
      }
    } catch (err) {
      console.warn('[ReceptionistSessionProvider] Failed to restore session:', err)
      sessionStorage.removeItem(SESSION_STORAGE_RECEPTIONIST_STAFF_ID)
      localStorage.removeItem('monolith_receptionist_staff_id')
      setStaff(null)
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
      setStaff(result.staff)
      sessionStorage.setItem(SESSION_STORAGE_RECEPTIONIST_STAFF_ID, String(result.staff.codeId))
      localStorage.setItem('monolith_receptionist_staff_id', String(result.staff.codeId))
      return result.staff
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
    setStaff(null)
    setError(null)
  }, [])

  const value: ReceptionistSessionContextValue = {
    staff,
    isAuthenticated: Boolean(staff),
    loading,
    error,
    authenticate,
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
