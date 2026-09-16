import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { ServiceShift, ServiceShiftSummaryMetrics } from '@/types/serviceShift'
import type { StaffCodeItem } from '@/types/account'
import {
  getActiveServiceShift,
  startServiceShift as apiStartShift,
  endServiceShift as apiEndShift,
  calculateServiceShiftMetrics,
  validateServiceStaff,
} from '@/services/serviceShiftService'

export interface ServiceSessionContextValue {
  shift: ServiceShift | null
  staff: StaffCodeItem | null
  isAuthenticated: boolean
  loading: boolean
  error: string | null
  startShift: (staffId: number) => Promise<ServiceShift>
  endShift: (totals?: { totalOrdersPunched?: number; totalTablesServed?: number }) => Promise<ServiceShift | null>
  getShiftMetrics: () => Promise<ServiceShiftSummaryMetrics | null>
  refreshShift: () => Promise<void>
  clearError: () => void
}

export const ServiceSessionContext = createContext<ServiceSessionContextValue | undefined>(undefined)

export function ServiceSessionProvider({ children }: { children: React.ReactNode }) {
  const [shift, setShift] = useState<ServiceShift | null>(null)
  const [staff, setStaff] = useState<StaffCodeItem | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const clearError = useCallback(() => setError(null), [])

  // Restore active service shift from authoritative source on load & refresh
  const restoreActiveShift = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const active = await getActiveServiceShift()
      if (active && active.status === 'ACTIVE') {
        setShift(active)
        if (active.staffId) {
          const val = await validateServiceStaff(active.staffId)
          if (val.valid && val.staff) {
            setStaff(val.staff)
          }
        }
      } else {
        setShift(null)
        setStaff(null)
      }
    } catch (err) {
      console.warn('[ServiceSessionProvider] Failed to restore active service shift:', err)
      setShift(null)
      setStaff(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void restoreActiveShift()

    // Synchronize across browser tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'monolith_service_shift_id' || e.key === 'monolith_service_staff_id') {
        void restoreActiveShift()
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => {
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [restoreActiveShift])

  // Start shift
  const startShift = useCallback(async (staffId: number): Promise<ServiceShift> => {
    setLoading(true)
    setError(null)
    try {
      const newShift = await apiStartShift(staffId)
      setShift(newShift)
      if (newShift.staffId) {
        const val = await validateServiceStaff(newShift.staffId)
        if (val.valid && val.staff) {
          setStaff(val.staff)
        }
      }
      return newShift
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start service shift.'
      setError(msg)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  // End shift
  const endShift = useCallback(
    async (totals?: { totalOrdersPunched?: number; totalTablesServed?: number }): Promise<ServiceShift | null> => {
      if (!shift) return null
      setLoading(true)
      setError(null)
      try {
        const updated = await apiEndShift(shift.shiftId, totals)
        setShift(null)
        setStaff(null)
        return updated
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to end service shift.'
        setError(msg)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [shift],
  )

  // Live metrics for end shift modal
  const getShiftMetrics = useCallback(async (): Promise<ServiceShiftSummaryMetrics | null> => {
    if (!shift?.startedAt) return null
    return calculateServiceShiftMetrics(shift.startedAt, shift.staffId)
  }, [shift?.startedAt, shift?.staffId])

  const value: ServiceSessionContextValue = {
    shift,
    staff,
    isAuthenticated: Boolean(shift && shift.status === 'ACTIVE'),
    loading,
    error,
    startShift,
    endShift,
    getShiftMetrics,
    refreshShift: restoreActiveShift,
    clearError,
  }

  return <ServiceSessionContext.Provider value={value}>{children}</ServiceSessionContext.Provider>
}

export function useServiceSessionContext(): ServiceSessionContextValue {
  const ctx = useContext(ServiceSessionContext)
  if (!ctx) {
    throw new Error('useServiceSessionContext must be used within a ServiceSessionProvider')
  }
  return ctx
}
