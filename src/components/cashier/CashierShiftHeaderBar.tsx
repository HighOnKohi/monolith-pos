import { useState } from 'react'
import { BarChart3 } from 'lucide-react'
import { useCashierSession } from '@/hooks/useCashierSession'
import { EndOfShiftModal } from './EndOfShiftModal'
import { UnifiedShiftHeaderBar } from '@/components/common/UnifiedShiftHeaderBar'

interface CashierShiftHeaderBarProps {
  className?: string
}

export function CashierShiftHeaderBar({ className = '' }: CashierShiftHeaderBarProps) {
  const { shift, staff } = useCashierSession()
  const [showModal, setShowModal] = useState(false)
  const [isEndShiftFlow, setIsEndShiftFlow] = useState(false)

  if (!shift) return null

  const cashierName = staff?.staffName || shift.staffName || `Staff #${shift.staffId}`

  const handleOpenSummary = () => {
    setIsEndShiftFlow(false)
    setShowModal(true)
  }

  const handleOpenEndShift = () => {
    setIsEndShiftFlow(true)
    setShowModal(true)
  }

  return (
    <>
      <UnifiedShiftHeaderBar
        role="CASHIER"
        staffName={cashierName}
        startedAt={shift.startedAt}
        onEndShiftClick={handleOpenEndShift}
        className={className}
        extraActions={
          <button
            type="button"
            onClick={handleOpenSummary}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200/80 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
            title="View current shift performance & breakdown"
          >
            <BarChart3 className="w-3.5 h-3.5 text-[#14274E]" />
            <span className="hidden sm:inline">Shift</span> Summary
          </button>
        }
      />

      {/* Rich End of Shift Summary Modal */}
      <EndOfShiftModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        isEndShiftFlow={isEndShiftFlow}
      />
    </>
  )
}
