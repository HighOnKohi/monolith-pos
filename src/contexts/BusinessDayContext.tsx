import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type {
  BusinessDay,
  DailySummary,
  ActiveOrdersCheckResult,
  ActiveShiftsCheckResult,
} from '@/types/businessDay'
import {
  getActiveBusinessDay,
  startBusinessDay as apiStartDay,
  endBusinessDay as apiEndDay,
  checkActiveOrders as apiCheckActiveOrders,
  checkActiveShifts as apiCheckActiveShifts,
  calculateDailySummary as apiCalculateDailySummary,
} from '@/services/businessDayService'
import { supabase } from '@/lib/supabase'

export interface BusinessDayContextValue {
  activeBusinessDay: BusinessDay | null
  isOpen: boolean
  loading: boolean
  error: string | null
  checkActiveOrders: () => Promise<ActiveOrdersCheckResult>
  checkActiveShifts: () => Promise<ActiveShiftsCheckResult>
  startDay: (startedBy?: string) => Promise<BusinessDay>
  endDay: (endedBy?: string) => Promise<BusinessDay>
  getSummary: (dayId?: number) => Promise<DailySummary>
  refresh: () => Promise<void>
  clearError: () => void
}

export const BusinessDayContext = createContext<BusinessDayContextValue | undefined>(undefined)

export function BusinessDayProvider({ children }: { children: React.ReactNode }) {
  const [activeBusinessDay, setActiveBusinessDay] = useState<BusinessDay | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const clearError = useCallback(() => setError(null), [])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const day = await getActiveBusinessDay()
      setActiveBusinessDay(day)
    } catch (err) {
      console.warn('[BusinessDayProvider] Failed to fetch active business day:', err)
      setActiveBusinessDay(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()

    // 1. Cross-tab synchronization via storage event
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'monolith_active_business_day_id' || e.key === 'monolith_business_days_fallback') {
        void refresh()
      }
    }
    window.addEventListener('storage', handleStorageChange)

    // 2. Realtime listener on Business_Days table
    const channel = supabase
      .channel('business-days-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'staff', table: 'Business_Days' },
        () => {
          void refresh()
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'Business_Days' },
        () => {
          void refresh()
        },
      )
      .subscribe()

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      void supabase.removeChannel(channel)
    }
  }, [refresh])

  const startDay = useCallback(
    async (startedBy?: string): Promise<BusinessDay> => {
      setLoading(true)
      setError(null)
      try {
        const day = await apiStartDay(startedBy)
        setActiveBusinessDay(day)
        return day
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to start business day.'
        setError(msg)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  const endDay = useCallback(
    async (endedBy?: string): Promise<BusinessDay> => {
      setLoading(true)
      setError(null)
      try {
        const closed = await apiEndDay(endedBy)
        setActiveBusinessDay(null)
        return closed
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to end business day.'
        setError(msg)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  const checkActiveOrders = useCallback(async (): Promise<ActiveOrdersCheckResult> => {
    return apiCheckActiveOrders()
  }, [])

  const checkActiveShifts = useCallback(async (): Promise<ActiveShiftsCheckResult> => {
    return apiCheckActiveShifts()
  }, [])

  const getSummary = useCallback(
    async (dayId?: number): Promise<DailySummary> => {
      const targetId = dayId ?? activeBusinessDay?.businessDayId
      if (!targetId) {
        throw new Error('No business day specified to calculate summary.')
      }
      return apiCalculateDailySummary(targetId)
    },
    [activeBusinessDay],
  )

  const value: BusinessDayContextValue = {
    activeBusinessDay,
    isOpen: Boolean(activeBusinessDay && activeBusinessDay.status === 'OPEN'),
    loading,
    error,
    checkActiveOrders,
    checkActiveShifts,
    startDay,
    endDay,
    getSummary,
    refresh,
    clearError,
  }

  return <BusinessDayContext.Provider value={value}>{children}</BusinessDayContext.Provider>
}

export function useBusinessDayContext(): BusinessDayContextValue {
  const ctx = useContext(BusinessDayContext)
  if (!ctx) {
    throw new Error('useBusinessDayContext must be used within a BusinessDayProvider')
  }
  return ctx
}
