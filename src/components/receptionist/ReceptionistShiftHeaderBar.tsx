import React from 'react'
import { useReceptionistSession } from '@/contexts/ReceptionistSessionContext'
import { UnifiedShiftHeaderBar } from '@/components/common/UnifiedShiftHeaderBar'

interface ReceptionistShiftHeaderBarProps {
  className?: string
}

export const ReceptionistShiftHeaderBar: React.FC<ReceptionistShiftHeaderBarProps> = ({
  className = '',
}) => {
  const { staff, shiftStart, endShift } = useReceptionistSession()

  if (!staff) return null

  return (
    <UnifiedShiftHeaderBar
      role="RECEPTIONIST"
      staffName={staff.staffName || `Staff #${staff.codeId}`}
      startedAt={shiftStart || staff.shiftStart}
      onEndShift={endShift}
      className={className}
      confirmTitle="Conclude Receptionist Shift"
      confirmMessage={`End reception shift for ${staff.staffName || `Staff #${staff.codeId}`}?`}
    />
  )
}
