import React from 'react'
import { useOrganizerSession } from '@/contexts/OrganizerSessionContext'
import { OrganizerStaffGate } from './OrganizerStaffGate'
import PageLoader from '@/components/common/PageLoader'

interface OrganizerRouteGuardProps {
  children: React.ReactNode
}

/**
 * OrganizerRouteGuard
 *
 * Wraps Management interface routes (/tables, /catalog, /menu, /events).
 * Verifies that an active Organizer staff code session is unlocked.
 * If not, renders OrganizerStaffGate prompt requiring an ORGANIZER staff code.
 */
export function OrganizerRouteGuard({ children }: OrganizerRouteGuardProps) {
  const { isAuthenticated, loading } = useOrganizerSession()

  if (loading) {
    return <PageLoader />
  }

  if (!isAuthenticated) {
    return <OrganizerStaffGate />
  }

  return <>{children}</>
}
