import React from 'react'
import { useBusinessDay } from '@/hooks/useBusinessDay'
import { BusinessDayClosedNotice } from '@/components/common/BusinessDayClosedNotice'
import PageLoader from '@/components/common/PageLoader'

interface CustomerDayGuardProps {
  children: React.ReactNode
}

/**
 * CustomerDayGuard
 *
 * Wraps customer-facing ordering interfaces (/customer/:tableId, /advance-order).
 * Verifies that the Business Day is currently OPEN. If closed, renders BusinessDayClosedNotice in customer mode.
 */
export function CustomerDayGuard({ children }: CustomerDayGuardProps) {
  const { isOpen, loading: dayLoading, refresh: refreshDay } = useBusinessDay()

  if (dayLoading) {
    return <PageLoader />
  }

  if (!isOpen) {
    return <BusinessDayClosedNotice mode="customer" onRetry={() => void refreshDay()} />
  }

  return <>{children}</>
}
