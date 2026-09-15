import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { CashierShift, ShiftSummaryMetrics } from '@/types/cashierShift'
import type { StaffCodeItem } from '@/types/account'
import {
  getActiveCashierShift,
  startCashierShift as apiStartShift,
  endCashierShift as apiEndShift,
  calculateShiftMetrics,
  validateCashierStaff,
} from '@/services/cashierShiftService'

export interface CashierSessionContextValue {
  shift: CashierShift | null
  staff: StaffCodeItem | null
  isAuthenticated: boolean
  loading: boolean
  error: string | null
  startShift: (staffId: number) => Promise<CashierShift>
  endShift: (totals?: { totalEarning?: number; totalTablesHandled?: number }) => Promise<CashierShift | null>
  getShiftMetrics: () => Promise<ShiftSummaryMetrics | null>
  refreshShift: () => Promise<void>
  clearError: () => void
}

export const CashierSessionContext = createContext<CashierSessionContextValue | undefined>(undefined)

export function CashierSessionProvider({ children }: { children: React.ReactNode }) {
  const [shift, setShift] = useState<CashierShift | null>(null)
  const [staff, setStaff] = useState<StaffCodeItem | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const clearError = useCallback(() => setError(null), [])

  // Restore active shift from authoritative source on load & refresh
  const restoreActiveShift = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const active = await getActiveCashierShift()
      if (active && active.status === 'ACTIVE') {
        setShift(active)
        if (active.staffId) {
          const val = await validateCashierStaff(active.staffId)
          if (val.valid && val.staff) {
            setStaff(val.staff)
          }
        }
      } else {
        // Stale or ended shift
        setShift(null)
        setStaff(null)
      }
    } catch (err) {
      console.warn('[CashierSessionProvider] Failed to restore active shift:', err)
      setShift(null)
      setStaff(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void restoreActiveShift()

    // Synchronize across browser tabs when cashier shift starts/ends
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'monolith_cashier_shift_id' || e.key === 'monolith_cashier_staff_id') {
        void restoreActiveShift()
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => {
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [restoreActiveShift])

  // Start shift
  const startShift = useCallback(async (staffId: number): Promise<CashierShift> => {
    setLoading(true)
    setError(null)
    try {
      const newShift = await apiStartShift(staffId)
      setShift(newShift)
      if (newShift.staffId) {
        const val = await validateCashierStaff(newShift.staffId)
        if (val.valid && val.staff) {
          setStaff(val.staff)
        }
      }
      return newShift
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start cashier shift.'
      setError(msg)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  // End shift
  const endShift = useCallback(
    async (totals?: { totalEarning?: number; totalTablesHandled?: number }): Promise<CashierShift | null> => {
      if (!shift) return null
      setLoading(true)
      setError(null)
      try {
        const updated = await apiEndShift(shift.shiftId, totals)
        setShift(null)
        setStaff(null)
        return updated
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to end cashier shift.'
        setError(msg)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [shift],
  )

  // Compute live metrics for the end shift modal
  const getShiftMetrics = useCallback(async (): Promise<ShiftSummaryMetrics | null> => {
    if (!shift?.startedAt) return null
    return calculateShiftMetrics(shift.startedAt)
  }, [shift?.startedAt])

  const value: CashierSessionContextValue = {
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

  return <CashierSessionContext.Provider value={value}>{children}</CashierSessionContext.Provider>
}

export function useCashierSessionContext(): CashierSessionContextValue {
  const ctx = useContext(CashierSessionContext)
  if (!ctx) {
    throw new Error('useCashierSessionContext must be used within a CashierSessionProvider')
  }
  return ctx
}
