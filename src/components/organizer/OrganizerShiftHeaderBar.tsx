import React from 'react'
import { useOrganizerSession } from '@/contexts/OrganizerSessionContext'
import { UnifiedShiftHeaderBar } from '@/components/common/UnifiedShiftHeaderBar'

interface OrganizerShiftHeaderBarProps {
  className?: string
}

export const OrganizerShiftHeaderBar: React.FC<OrganizerShiftHeaderBarProps> = ({
  className = '',
}) => {
  const { staff, shiftStart, endShift } = useOrganizerSession()

  if (!staff) return null

  return (
    <UnifiedShiftHeaderBar
      role="ORGANIZER"
      staffName={staff.staffName || `Organizer #${staff.codeId}`}
      startedAt={shiftStart || staff.shiftStart}
      onEndShift={endShift}
      className={className}
      confirmTitle="Conclude Management Shift"
      confirmMessage={`End organizer session for ${staff.staffName || `Staff #${staff.codeId}`}?`}
    />
  )
}
