import React, { useState, useEffect } from 'react'
import {
  BarChart3,
  Clock,
  X,
  Loader2,
  ChefHat,
  Flame,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import type { DispatcherShift } from '@/services/dispatcherShiftService'
import { endDispatcherShift, getDispatcherShiftMetrics } from '@/services/dispatcherShiftService'
import { UnifiedShiftHeaderBar } from '@/components/common/UnifiedShiftHeaderBar'

interface DispatcherShiftHeaderBarProps {
  shift: DispatcherShift
  onShiftEnded: () => void
  className?: string
}

function formatShiftTime(isoString?: string): string {
  if (!isoString) return 'Just now'
  try {
    const d = new Date(isoString)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return 'Active'
  }
}

export const DispatcherShiftHeaderBar: React.FC<DispatcherShiftHeaderBarProps> = ({
  shift,
  onShiftEnded,
  className = '',
}) => {
  const [showSummary, setShowSummary] = useState(false)
  const [metrics, setMetrics] = useState({
    ordersAccepted: shift.ordersAccepted || 0,
    ordersCooked: shift.ordersCooked || 0,
    ordersCancelled: shift.ordersCancelled || 0,
    ordersCompleted: shift.ordersCompleted || 0,
  })
  const [loadingMetrics, setLoadingMetrics] = useState(false)

  useEffect(() => {
    if (showSummary && shift.staffId) {
      setLoadingMetrics(true)
      void getDispatcherShiftMetrics(shift.staffId)
        .then((res) => {
          setMetrics(res)
        })
        .finally(() => {
          setLoadingMetrics(false)
        })
    }
  }, [showSummary, shift.staffId])

  const handleEndShift = async () => {
    await endDispatcherShift()
    onShiftEnded()
  }

  const startTime = formatShiftTime(shift.startedAt)

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

      {/* Dispatcher Shift Summary Modal */}
      {showSummary && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          onClick={() => setShowSummary(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-[#14274E] px-6 py-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-400 text-amber-950 flex items-center justify-center shadow-xs">
                  <ChefHat className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base leading-tight">Dispatcher Shift Summary</h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    {shift.staffName || `Staff #${shift.staffId}`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSummary(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                aria-label="Close summary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {/* Shift info row */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-200/60">
                  <span className="text-slate-500 font-bold flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    Shift Started
                  </span>
                  <span className="font-extrabold text-[#14274E]">{startTime}</span>
                </div>

                {/* 2x2 Metrics Grid */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="bg-white p-3 rounded-xl border border-slate-200/70 shadow-2xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                      <ChefHat className="w-3 h-3 text-blue-500" />
                      Orders Accepted
                    </span>
                    <p className="text-base font-black text-[#14274E] mt-0.5">
                      {loadingMetrics ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400 mt-1" />
                      ) : (
                        metrics.ordersAccepted
                      )}
                    </p>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-slate-200/70 shadow-2xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                      <Flame className="w-3 h-3 text-amber-500" />
                      Orders Cooked
                    </span>
                    <p className="text-base font-black text-amber-700 mt-0.5">
                      {loadingMetrics ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400 mt-1" />
                      ) : (
                        metrics.ordersCooked
                      )}
                    </p>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-slate-200/70 shadow-2xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                      Orders Completed
                    </span>
                    <p className="text-base font-black text-emerald-700 mt-0.5">
                      {loadingMetrics ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400 mt-1" />
                      ) : (
                        metrics.ordersCompleted
                      )}
                    </p>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-slate-200/70 shadow-2xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                      <XCircle className="w-3 h-3 text-rose-500" />
                      Orders Cancelled
                    </span>
                    <p className="text-base font-black text-rose-700 mt-0.5">
                      {loadingMetrics ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400 mt-1" />
                      ) : (
                        metrics.ordersCancelled
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setShowSummary(false)}
                className="px-4 py-2 rounded-xl bg-[#14274E] hover:bg-[#1E3A8A] text-white text-xs font-black transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
