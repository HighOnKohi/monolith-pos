import { useState, useEffect } from 'react'
import {
  User,
  Clock,
  LogOut,
  AlertTriangle,
  ShoppingBag,
  Grid,
  X,
  Loader2,
  UtensilsCrossed,
} from 'lucide-react'
import { useServiceSession } from '@/hooks/useServiceSession'
import type { ServiceShiftSummaryMetrics } from '@/types/serviceShift'

function formatShiftTime(isoString?: string): string {
  if (!isoString) return 'Just now'
  try {
    const d = new Date(isoString)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return 'Active'
  }
}

interface ServiceShiftHeaderBarProps {
  className?: string
}

export function ServiceShiftHeaderBar({ className = '' }: ServiceShiftHeaderBarProps) {
  const { shift, staff, endShift, getShiftMetrics } = useServiceSession()
  const [showEndModal, setShowEndModal] = useState(false)
  const [isEnding, setIsEnding] = useState(false)
  const [metrics, setMetrics] = useState<ServiceShiftSummaryMetrics | null>(null)
  const [loadingMetrics, setLoadingMetrics] = useState(false)

  useEffect(() => {
    if (showEndModal) {
      setLoadingMetrics(true)
      void getShiftMetrics()
        .then((res) => setMetrics(res))
        .catch(() => {})
        .finally(() => setLoadingMetrics(false))
    }
  }, [showEndModal, getShiftMetrics])

  if (!shift) return null

  const serverName = staff?.staffName || shift.staffName || `Staff #${shift.staffId}`
  const serverRole = staff?.staffRole || shift.staffRole || 'STAFF'
  const startTime = formatShiftTime(shift.startedAt)

  const handleConfirmEndShift = async () => {
    setIsEnding(true)
    try {
      await endShift({
        totalOrdersPunched: metrics?.ordersPunched ?? shift.totalOrdersPunched,
        totalTablesServed: metrics?.tablesServed ?? shift.totalTablesServed,
      })
      setShowEndModal(false)
    } catch (err) {
      console.error('[ServiceShiftHeaderBar] Failed to end service shift:', err)
    } finally {
      setIsEnding(false)
    }
  }

  return (
    <>
      <div
        className={`flex items-center justify-between gap-3 px-3.5 py-2 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/80 shadow-xs ${className}`}
      >
        {/* Server Status Info */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative">
            <div className="w-8 h-8 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-700 font-black text-xs shrink-0">
              <UtensilsCrossed className="w-4 h-4" />
            </div>
            <span
              className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-white animate-pulse"
              title="Service Shift is Active"
            />
          </div>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-extrabold text-xs text-[#14274E] truncate max-w-[140px] sm:max-w-xs">
                {serverName}
              </span>
              <span className="text-[10px] font-black px-1.5 py-0.2 rounded-md bg-slate-100 text-slate-600 uppercase">
                ID: {shift.staffId}
              </span>
              <span className="hidden sm:inline-block text-[10px] font-black px-1.5 py-0.2 rounded-md bg-purple-50 text-purple-700 border border-purple-200 uppercase">
                {serverRole}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-400">
              <Clock className="w-3 h-3 text-slate-400" />
              <span>Service shift active since {startTime}</span>
            </div>
          </div>
        </div>

        {/* End Shift Button */}
        <button
          type="button"
          onClick={() => setShowEndModal(true)}
          className="px-3 py-1.5 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 active:bg-rose-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer shadow-2xs active:scale-95"
          title="Conclude current floor service shift"
        >
          <LogOut className="w-3.5 h-3.5 text-rose-600" />
          <span>End Shift</span>
        </button>
      </div>

      {/* End Shift Confirmation Modal */}
      {showEndModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fade-in"
          onClick={() => !isEnding && setShowEndModal(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-rose-50 text-rose-600 border border-rose-100">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-[#14274E]">End Service Shift</h3>
                  <p className="text-[11px] font-semibold text-slate-400">Finalize floor service session &amp; lock interface</p>
                </div>
              </div>
              <button
                type="button"
                disabled={isEnding}
                onClick={() => setShowEndModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                Are you sure you want to conclude the service shift for{' '}
                <strong className="text-[#14274E] font-black">{serverName}</strong> (Staff ID:{' '}
                {shift.staffId})?
              </p>

              {/* Shift Summary Metrics */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-200/60">
                  <span className="text-slate-500 font-bold flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    Shift Started
                  </span>
                  <span className="font-extrabold text-[#14274E]">{startTime}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="bg-white p-3 rounded-xl border border-slate-200/70 shadow-2xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                      <ShoppingBag className="w-3 h-3 text-blue-500" />
                      Orders Punched
                    </span>
                    <p className="text-base font-black text-[#14274E] mt-0.5">
                      {loadingMetrics ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400 mt-1" />
                      ) : (
                        metrics?.ordersPunched ?? shift.totalOrdersPunched
                      )}
                    </p>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-slate-200/70 shadow-2xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                      <Grid className="w-3 h-3 text-purple-500" />
                      Tables Served
                    </span>
                    <p className="text-base font-black text-purple-700 mt-0.5">
                      {loadingMetrics ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400 mt-1" />
                      ) : (
                        metrics?.tablesServed ?? shift.totalTablesServed
                      )}
                    </p>
                  </div>
                </div>

                {metrics?.durationMinutes != null && (
                  <p className="text-[11px] text-slate-400 font-semibold text-center pt-1">
                    Shift duration: {metrics.durationMinutes} minute
                    {metrics.durationMinutes !== 1 ? 's' : ''}
                  </p>
                )}
              </div>

              <div className="bg-amber-50/80 border border-amber-200/70 rounded-xl p-3 text-[11px] font-semibold text-amber-800 leading-snug">
                Notice: Ending this shift locks the service interface. An audit record will be logged.
                The application session and any separate cashier shifts will remain active.
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isEnding}
                onClick={() => setShowEndModal(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isEnding}
                onClick={() => void handleConfirmEndShift()}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-black transition-all flex items-center gap-2 shadow-sm shadow-rose-600/30 cursor-pointer disabled:opacity-50"
              >
                {isEnding ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Ending Shift...</span>
                  </>
                ) : (
                  <>
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Confirm End Shift</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
