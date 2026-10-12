import { useLocation } from 'react-router-dom'
import { useOrganizerSession } from '@/contexts/OrganizerSessionContext'
import { OrganizerStaffGate } from './OrganizerStaffGate'
import { OrganizerShiftHeaderBar } from './OrganizerShiftHeaderBar'
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
 * When authenticated, displays OrganizerShiftHeaderBar with active Organizer details and End Shift button.
 */
export function OrganizerRouteGuard({ children }: OrganizerRouteGuardProps) {
  const { isAuthenticated, loading } = useOrganizerSession()
  const location = useLocation()

  if (loading) {
    return <PageLoader />
  }

  if (!isAuthenticated) {
    return <OrganizerStaffGate />
  }

  // When on /tables (Layout Manager), the shift header is docked inside inner-table-manager-container
  if (location.pathname.startsWith('/tables')) {
    return <>{children}</>
  }

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      <div className="px-4 pt-3 pb-1 shrink-0">
        <OrganizerShiftHeaderBar />
      </div>
      <div className="flex-1 min-h-0 overflow-hidden relative">
        {children}
      </div>
    </div>
  )
}
