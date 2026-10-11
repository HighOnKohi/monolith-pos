import { useReceptionistSession } from '@/contexts/ReceptionistSessionContext'
import { UnifiedStaffCodeGate } from '@/components/common/UnifiedStaffCodeGate'

interface ReceptionistStaffGateProps {
  onSuccess?: () => void
}

export function ReceptionistStaffGate({ onSuccess }: ReceptionistStaffGateProps) {
  const { authenticate, clearError, error, loading } = useReceptionistSession()

  const handleAuthenticate = async (staffId: number) => {
    await authenticate(staffId)
  }

  return (
    <UnifiedStaffCodeGate
      role="RECEPTIONIST"
      onSubmit={handleAuthenticate}
      loading={loading}
      error={error}
      onClearError={clearError}
      onSuccess={onSuccess}
    />
  )
}
