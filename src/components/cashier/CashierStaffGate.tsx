import { useCashierSession } from '@/hooks/useCashierSession'
import { UnifiedStaffCodeGate } from '@/components/common/UnifiedStaffCodeGate'

interface CashierStaffGateProps {
  onSuccess?: () => void
}

export function CashierStaffGate({ onSuccess }: CashierStaffGateProps) {
  const { startShift, loading, error, clearError } = useCashierSession()

  return (
    <UnifiedStaffCodeGate
      role="CASHIER"
      onSubmit={startShift}
      loading={loading}
      error={error}
      onClearError={clearError}
      onSuccess={onSuccess}
    />
  )
}
