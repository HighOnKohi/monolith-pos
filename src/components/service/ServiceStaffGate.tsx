import { useServiceSession } from '@/hooks/useServiceSession'
import { UnifiedStaffCodeGate } from '@/components/common/UnifiedStaffCodeGate'

interface ServiceStaffGateProps {
  onSuccess?: () => void
}

export function ServiceStaffGate({ onSuccess }: ServiceStaffGateProps) {
  const { startShift, loading, error, clearError } = useServiceSession()

  return (
    <UnifiedStaffCodeGate
      role="SERVICE"
      onSubmit={startShift}
      loading={loading}
      error={error}
      onClearError={clearError}
      onSuccess={onSuccess}
    />
  )
}
