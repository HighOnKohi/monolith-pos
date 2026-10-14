import { useState } from 'react'
import { BarChart3 } from 'lucide-react'
import { useCashierSession } from '@/hooks/useCashierSession'
import { CashierShiftSummaryModal } from './CashierShiftSummaryModal'
import { UnifiedShiftHeaderBar } from '@/components/common/UnifiedShiftHeaderBar'

interface CashierShiftHeaderBarProps {
  className?: string
}

export function CashierShiftHeaderBar({ className = '' }: CashierShiftHeaderBarProps) {
  const { shift, staff, finalizeShift, clearSession, getShiftSummary } = useCashierSession()
  const [showSummaryModal, setShowSummaryModal] = useState(false)

  if (!shift) return null

  const cashierName = staff?.staffName || shift.staffName || `Staff #${shift.staffId}`

  const handleEndShift = async () => {
    try {
      const summary = await getShiftSummary().catch(() => null)
      await finalizeShift({
        totalEarning: summary?.grossRevenue || shift.totalEarning || 0,
        totalTablesHandled: summary?.tablesHandled || shift.totalTablesHandled || 0,
      })
      clearSession()
    } catch (err) {
      console.error('[CashierShiftHeaderBar] Failed to end cashier shift:', err)
    }
  }

  return (
    <>
      <UnifiedShiftHeaderBar
        role="CASHIER"
        staffName={cashierName}
        startedAt={shift.startedAt}
        onEndShift={handleEndShift}
        confirmTitle="Conclude Cashier Shift"
        confirmMessage={`End cashier shift for ${cashierName}?`}
        className={className}
        extraActions={
          <button
            type="button"
            onClick={() => setShowSummaryModal(true)}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200/80 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
            title="View current shift performance & breakdown"
          >
            <BarChart3 className="w-3.5 h-3.5 text-[#14274E]" />
            <span className="hidden sm:inline">Shift</span> Summary
          </button>
        }
      />

      {/* Revamped Simplified Cashier Shift Summary Modal */}
      <CashierShiftSummaryModal
        isOpen={showSummaryModal}
        onClose={() => setShowSummaryModal(false)}
        shift={shift}
      />
    </>
  )
}
