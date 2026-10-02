import React, { useState } from 'react'
import { ChefHat, Clock, PowerOff } from 'lucide-react'
import type { DispatcherShift } from '@/services/dispatcherShiftService'
import { endDispatcherShift } from '@/services/dispatcherShiftService'

function formatShiftTime(isoString?: string): string {
  if (!isoString) return 'Just now'
  try {
    const d = new Date(isoString)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return 'Active'
  }
}

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
  const [isEnding, setIsEnding] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const handleConfirmEndShift = async () => {
    setIsEnding(true)
    try {
      await endDispatcherShift()
      setShowConfirm(false)
      onShiftEnded()
    } finally {
      setIsEnding(false)
    }
  }

  const startTime = formatShiftTime(shift.startedAt)

  return (
    <>
      <div
        className={`flex items-center justify-between gap-3 px-3.5 py-2 bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200/80 shadow-xs ${className}`}
      >
        {/* Dispatcher Status Info */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-700 font-black text-xs shrink-0">
              <ChefHat className="w-4 h-4" />
            </div>
            <span
              className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-white animate-pulse"
              title="Shift is Active"
            />
          </div>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-extrabold text-xs text-[#14274E] truncate max-w-[140px] sm:max-w-xs">
                {shift.staffName || `Dispatcher #${shift.staffId}`}
              </span>
              <span className="text-[10px] font-black px-1.5 py-0.2 rounded-md bg-slate-100 text-slate-600 uppercase">
                ID: {shift.staffId}
              </span>
              <span className="hidden sm:inline-block text-[10px] font-black px-1.5 py-0.2 rounded-md bg-amber-50 text-amber-700 border border-amber-200 uppercase">
                DISPATCHER
              </span>
            </div>
            <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-400">
              <Clock className="w-3 h-3 text-slate-400" />
              <span>Shift active since {startTime}</span>
            </div>
          </div>
        </div>

        {/* End Shift Button */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowConfirm(true)}
            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
            title="Conclude current dispatcher shift"
          >
            <PowerOff className="w-3.5 h-3.5 text-rose-600" />
            <span>End Shift</span>
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-2xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <PowerOff className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-[#14274E]">Conclude Dispatcher Shift</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  End kitchen shift for {shift.staffName || `Staff #${shift.staffId}`}?
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600">
              This will record your shift end timestamp and log you out of the kitchen dispatch line.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={isEnding}
                className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmEndShift}
                disabled={isEnding}
                className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs active:scale-98 transition-all cursor-pointer disabled:opacity-50"
              >
                {isEnding ? 'Ending...' : 'Yes, End Shift'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
