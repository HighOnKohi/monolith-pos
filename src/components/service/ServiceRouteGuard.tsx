import React from 'react'
import { useServiceSession } from '@/hooks/useServiceSession'
import { useBusinessDay } from '@/hooks/useBusinessDay'
import { ServiceStaffGate } from './ServiceStaffGate'
import { BusinessDayClosedNotice } from '@/components/common/BusinessDayClosedNotice'
import PageLoader from '@/components/common/PageLoader'

interface ServiceRouteGuardProps {
  children: React.ReactNode
}

/**
 * ServiceRouteGuard
 *
 * Wraps the Service Interface route (/service).
 * 1. Verifies that the Business Day is currently OPEN. If closed, shows BusinessDayClosedNotice.
 * 2. Verifies that an active Service Shift exists. If not, renders ServiceStaffGate.
 * Note: Decoupled from Cashier Shift and Supabase Auth.
 */
export function ServiceRouteGuard({ children }: ServiceRouteGuardProps) {
  const { isOpen, loading: dayLoading, refresh: refreshDay } = useBusinessDay()
  const { isAuthenticated, loading: serviceLoading } = useServiceSession()

  if (dayLoading || serviceLoading) {
    return <PageLoader />
  }

  if (!isOpen) {
    return <BusinessDayClosedNotice mode="service" onRetry={() => void refreshDay()} />
  }

  if (!isAuthenticated) {
    return <ServiceStaffGate />
  }

  return <>{children}</>
}
