import { useState } from 'react'
import { BarChart3 } from 'lucide-react'
import { useServiceSession } from '@/hooks/useServiceSession'
import { UnifiedShiftHeaderBar } from '@/components/common/UnifiedShiftHeaderBar'
import { ServiceShiftSummaryModal } from './ServiceShiftSummaryModal'

interface ServiceShiftHeaderBarProps {
  className?: string
}

export function ServiceShiftHeaderBar({ className = '' }: ServiceShiftHeaderBarProps) {
  const { shift, staff, endShift, getShiftMetrics } = useServiceSession()
  const [showSummaryModal, setShowSummaryModal] = useState(false)

  if (!shift) return null

  const serverName = staff?.staffName || shift.staffName || `Staff #${shift.staffId}`

  const handleEndShift = async () => {
    try {
      const metrics = await getShiftMetrics().catch(() => null)
      await endShift({
        totalOrdersPunched: metrics?.ordersPunched ?? shift.totalOrdersPunched,
        totalTablesServed: metrics?.tablesServed ?? shift.totalTablesServed,
      })
    } catch (err) {
      console.error('[ServiceShiftHeaderBar] Failed to end service shift:', err)
    }
  }

  return (
    <>
      <UnifiedShiftHeaderBar
        role="SERVICE"
        staffName={serverName}
        startedAt={shift.startedAt}
        onEndShift={handleEndShift}
        confirmTitle="Conclude Service Shift"
        confirmMessage={`End floor service shift for ${serverName}?`}
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

      {/* Revamped Service Shift Summary Modal */}
      <ServiceShiftSummaryModal
        isOpen={showSummaryModal}
        onClose={() => setShowSummaryModal(false)}
        shift={shift}
      />
    </>
  )
}
