import React from 'react'
import { useCashierSession } from '@/hooks/useCashierSession'
import { useBusinessDay } from '@/hooks/useBusinessDay'
import { CashierStaffGate } from './CashierStaffGate'
import { BusinessDayClosedNotice } from '@/components/common/BusinessDayClosedNotice'
import PageLoader from '@/components/common/PageLoader'

interface CashierRouteGuardProps {
  children: React.ReactNode
}

/**
 * CashierRouteGuard
 *
 * Wraps the Cashier Interface route (/cashier).
 * 1. Verifies that the Business Day is currently OPEN. If closed, shows BusinessDayClosedNotice.
 * 2. Verifies that an active Cashier Shift session exists. If not, renders CashierStaffGate.
 * Note: Decoupled from the application's Supabase Auth user.
 */
export function CashierRouteGuard({ children }: CashierRouteGuardProps) {
  const { isOpen, loading: dayLoading, refresh: refreshDay } = useBusinessDay()
  const { isAuthenticated, loading: cashierLoading } = useCashierSession()

  if (dayLoading || cashierLoading) {
    return <PageLoader />
  }

  if (!isOpen) {
    return <BusinessDayClosedNotice mode="cashier" onRetry={() => void refreshDay()} />
  }

  if (!isAuthenticated) {
    return <CashierStaffGate />
  }

  return <>{children}</>
}
