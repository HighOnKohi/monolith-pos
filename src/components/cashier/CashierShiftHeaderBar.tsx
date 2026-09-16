import { useState } from 'react'
import {
  User,
  Clock,
  LogOut,
  BarChart3,
} from 'lucide-react'
import { useCashierSession } from '@/hooks/useCashierSession'
import { EndOfShiftModal } from './EndOfShiftModal'

function formatShiftTime(isoString?: string): string {
  if (!isoString) return 'Just now'
  try {
    const d = new Date(isoString)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return 'Active'
  }
}

interface CashierShiftHeaderBarProps {
  className?: string
}

export function CashierShiftHeaderBar({ className = '' }: CashierShiftHeaderBarProps) {
  const { shift, staff } = useCashierSession()
  const [showModal, setShowModal] = useState(false)
  const [isEndShiftFlow, setIsEndShiftFlow] = useState(false)

  if (!shift) return null

  const cashierName = staff?.staffName || shift.staffName || `Staff #${shift.staffId}`
  const cashierRole = staff?.staffRole || shift.staffRole || 'CASHIER'
  const startTime = formatShiftTime(shift.startedAt)

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
      <div
        className={`flex items-center justify-between gap-3 px-3.5 py-2 bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200/80 shadow-xs ${className}`}
      >
        {/* Cashier Status Info */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative">
            <div className="w-8 h-8 rounded-xl bg-[#14274E]/10 border border-[#14274E]/15 flex items-center justify-center text-[#14274E] font-black text-xs shrink-0">
              <User className="w-4 h-4" />
            </div>
            <span
              className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-white animate-pulse"
              title="Shift is Active"
            />
          </div>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-extrabold text-xs text-[#14274E] truncate max-w-[140px] sm:max-w-xs">
                {cashierName}
              </span>
              <span className="text-[10px] font-black px-1.5 py-0.2 rounded-md bg-slate-100 text-slate-600 uppercase">
                ID: {shift.staffId}
              </span>
              <span className="hidden sm:inline-block text-[10px] font-black px-1.5 py-0.2 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
                {cashierRole}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-400">
              <Clock className="w-3 h-3 text-slate-400" />
              <span>Shift active since {startTime}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {/* View Shift Summary Button */}
          <button
            type="button"
            onClick={handleOpenSummary}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200/80 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
            title="View current shift performance & breakdown"
          >
            <BarChart3 className="w-3.5 h-3.5 text-[#14274E]" />
            <span className="hidden sm:inline">Shift</span> Summary
          </button>

          {/* End Shift Button */}
          <button
            type="button"
            onClick={handleOpenEndShift}
            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
            title="Conclude current cashier shift and view final report"
          >
            <LogOut className="w-3.5 h-3.5 text-rose-600" />
            <span>End Shift</span>
          </button>
        </div>
      </div>

      {/* Rich End of Shift Summary Modal */}
      <EndOfShiftModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        isEndShiftFlow={isEndShiftFlow}
      />
    </>
  )
}
