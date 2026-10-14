import React, { useState } from 'react'
import { BarChart3 } from 'lucide-react'
import type { DispatcherShift } from '@/services/dispatcherShiftService'
import { endDispatcherShift } from '@/services/dispatcherShiftService'
import { UnifiedShiftHeaderBar } from '@/components/common/UnifiedShiftHeaderBar'
import { DispatcherShiftSummaryModal } from './DispatcherShiftSummaryModal'

interface DispatcherShiftHeaderBarProps {
  shift: DispatcherShift
  onShiftEnded: () => void
  className?: string
}

export const DispatcherShiftHeaderBar: React.FC<DispatcherShiftHeaderBarProps> = ({
  shift,
  onShiftEnded,
  className = '',
}) => {
  const [showSummary, setShowSummary] = useState(false)

  const handleEndShift = async () => {
    await endDispatcherShift()
    onShiftEnded()
  }

  return (
    <>
      <UnifiedShiftHeaderBar
        role="DISPATCHER"
        staffName={shift.staffName || `Dispatcher #${shift.staffId}`}
        startedAt={shift.startedAt}
        onEndShift={handleEndShift}
        className={className}
        confirmTitle="Conclude Dispatcher Shift"
        confirmMessage={`End kitchen shift for ${shift.staffName || `Staff #${shift.staffId}`}?`}
        extraActions={
          <button
            type="button"
            onClick={() => setShowSummary(true)}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200/80 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
            title="View current shift performance & breakdown"
          >
            <BarChart3 className="w-3.5 h-3.5 text-[#14274E]" />
            <span className="hidden sm:inline">Shift</span> Summary
          </button>
        }
      />

      {/* Revamped Dispatcher Shift Summary Modal */}
      <DispatcherShiftSummaryModal
        isOpen={showSummary}
        onClose={() => setShowSummary(false)}
        shift={shift}
      />
    </>
  )
}
