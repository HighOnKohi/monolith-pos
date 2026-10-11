import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { StaffCodeItem } from '@/types/account'
import { validateOrganizerStaff } from '@/services/staffCodeService'

const LOCAL_STORAGE_ORGANIZER_STAFF_ID = 'monolith_organizer_staff_id'

export interface OrganizerSessionContextValue {
  staff: StaffCodeItem | null
  isAuthenticated: boolean
  loading: boolean
  error: string | null
  authenticate: (staffId: number) => Promise<StaffCodeItem>
  logout: () => void
  clearError: () => void
}

export const OrganizerSessionContext = createContext<OrganizerSessionContextValue | undefined>(undefined)

export function OrganizerSessionProvider({ children }: { children: React.ReactNode }) {
  const [staff, setStaff] = useState<StaffCodeItem | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const clearError = useCallback(() => setError(null), [])

  const restoreSession = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const storedId = sessionStorage.getItem(LOCAL_STORAGE_ORGANIZER_STAFF_ID)
      if (storedId) {
        const parsedId = Number(storedId)
        if (parsedId > 0) {
          const result = await validateOrganizerStaff(parsedId)
          if (result.valid && result.staff) {
            setStaff(result.staff)
          } else {
            sessionStorage.removeItem(LOCAL_STORAGE_ORGANIZER_STAFF_ID)
            setStaff(null)
          }
        }
      } else {
        setStaff(null)
      }
    } catch (err) {
      console.warn('[OrganizerSessionProvider] Failed to restore session:', err)
      sessionStorage.removeItem(LOCAL_STORAGE_ORGANIZER_STAFF_ID)
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
      const result = await validateOrganizerStaff(staffId)
      if (!result.valid || !result.staff) {
        const msg = result.error || 'Organizer verification failed.'
        setError(msg)
        throw new Error(msg)
      }
      setStaff(result.staff)
      sessionStorage.setItem(LOCAL_STORAGE_ORGANIZER_STAFF_ID, String(result.staff.codeId))
      return result.staff
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Organizer verification failed.'
      setError(msg)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(() => {
    sessionStorage.removeItem(LOCAL_STORAGE_ORGANIZER_STAFF_ID)
    setStaff(null)
    setError(null)
  }, [])

  const value: OrganizerSessionContextValue = {
    staff,
    isAuthenticated: Boolean(staff),
    loading,
    error,
    authenticate,
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
