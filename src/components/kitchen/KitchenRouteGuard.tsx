import React from 'react'
import { useBusinessDay } from '@/hooks/useBusinessDay'
import { BusinessDayClosedNotice } from '@/components/common/BusinessDayClosedNotice'
import PageLoader from '@/components/common/PageLoader'

interface KitchenRouteGuardProps {
  children: React.ReactNode
}

/**
 * KitchenRouteGuard
 *
 * Wraps kitchen-facing interfaces (/dispatcher, /order-viewer).
 * Verifies that the Business Day is currently OPEN. If closed, renders BusinessDayClosedNotice in kitchen mode.
 */
export function KitchenRouteGuard({ children }: KitchenRouteGuardProps) {
  const { isOpen, loading: dayLoading, refresh: refreshDay } = useBusinessDay()

  if (dayLoading) {
    return <PageLoader />
  }

  if (!isOpen) {
    return <BusinessDayClosedNotice mode="kitchen" onRetry={() => void refreshDay()} />
  }

  return <>{children}</>
}
