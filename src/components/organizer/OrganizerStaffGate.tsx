import { useOrganizerSession } from '@/contexts/OrganizerSessionContext'
import { UnifiedStaffCodeGate } from '@/components/common/UnifiedStaffCodeGate'

interface OrganizerStaffGateProps {
  onSuccess?: () => void
}

export function OrganizerStaffGate({ onSuccess }: OrganizerStaffGateProps) {
  const { authenticate, clearError, error, loading } = useOrganizerSession()

  const handleAuthenticate = async (staffId: number) => {
    await authenticate(staffId)
  }

  return (
    <UnifiedStaffCodeGate
      role="ORGANIZER"
      onSubmit={handleAuthenticate}
      loading={loading}
      error={error}
      onClearError={clearError}
      onSuccess={onSuccess}
    />
  )
}
