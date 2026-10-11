import React from 'react'
import { useReceptionistSession } from '@/contexts/ReceptionistSessionContext'
import { useBusinessDay } from '@/hooks/useBusinessDay'
import { ReceptionistStaffGate } from './ReceptionistStaffGate'
import { BusinessDayClosedNotice } from '@/components/common/BusinessDayClosedNotice'
import PageLoader from '@/components/common/PageLoader'

interface ReceptionistRouteGuardProps {
  children: React.ReactNode
}

/**
 * ReceptionistRouteGuard
 *
 * Wraps the Receptionist Interface route (/reception).
 * 1. Verifies that the Business Day is currently OPEN. If closed, shows BusinessDayClosedNotice.
 * 2. Verifies that an active Receptionist staff session exists. If not, renders ReceptionistStaffGate.
 */
export function ReceptionistRouteGuard({ children }: ReceptionistRouteGuardProps) {
  const { isOpen, loading: dayLoading, refresh: refreshDay } = useBusinessDay()
  const { isAuthenticated, loading: receptionistLoading } = useReceptionistSession()

  if (dayLoading || receptionistLoading) {
    return <PageLoader />
  }

  if (!isOpen) {
    return <BusinessDayClosedNotice mode="receptionist" onRetry={() => void refreshDay()} />
  }

  if (!isAuthenticated) {
    return <ReceptionistStaffGate />
  }

  return <>{children}</>
}
