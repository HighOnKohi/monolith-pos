import { startDispatcherShift } from '@/services/dispatcherShiftService'
import { UnifiedStaffCodeGate } from '@/components/common/UnifiedStaffCodeGate'

interface DispatcherStaffGateProps {
  onSuccess?: () => void
}

export function DispatcherStaffGate({ onSuccess }: DispatcherStaffGateProps) {
  const handleStartShift = async (staffId: number) => {
    await startDispatcherShift(staffId)
  }

  return (
    <UnifiedStaffCodeGate
      role="DISPATCHER"
      onSubmit={handleStartShift}
      onSuccess={onSuccess}
    />
  )
}
