import React, { useState, useEffect } from 'react'
import {
  Store,
  UtensilsCrossed,
  ChefHat,
  ConciergeBell,
  FolderKanban,
  LogOut,
  Clock,
  type LucideIcon,
} from 'lucide-react'

export type ShiftRoleType = 'CASHIER' | 'SERVICE' | 'DISPATCHER' | 'RECEPTIONIST' | 'ORGANIZER'

interface RoleConfig {
  icon: LucideIcon
  roleLabel: string
  bgClass: string
  textClass: string
}

const ROLE_CONFIGS: Record<ShiftRoleType, RoleConfig> = {
  CASHIER: {
    icon: Store,
    roleLabel: 'Cashier',
    bgClass: 'bg-emerald-400',
    textClass: 'text-emerald-950',
  },
  SERVICE: {
    icon: UtensilsCrossed,
    roleLabel: 'Service',
    bgClass: 'bg-purple-400',
    textClass: 'text-purple-950',
  },
  DISPATCHER: {
    icon: ChefHat,
    roleLabel: 'Dispatcher',
    bgClass: 'bg-amber-400',
    textClass: 'text-amber-950',
  },
  RECEPTIONIST: {
    icon: ConciergeBell,
    roleLabel: 'Receptionist',
    bgClass: 'bg-teal-400',
    textClass: 'text-teal-950',
  },
  ORGANIZER: {
    icon: FolderKanban,
    roleLabel: 'Management',
    bgClass: 'bg-indigo-400',
    textClass: 'text-indigo-950',
  },
}

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const hh = hours.toString().padStart(2, '0')
  const mm = minutes.toString().padStart(2, '0')
  const ss = seconds.toString().padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

export interface UnifiedShiftHeaderBarProps {
  role: ShiftRoleType
  staffName: string
  startedAt?: string | null
  onEndShift?: () => Promise<void> | void
  onEndShiftClick?: () => void
  extraActions?: React.ReactNode
  className?: string
  confirmTitle?: string
  confirmMessage?: string
}

export const UnifiedShiftHeaderBar: React.FC<UnifiedShiftHeaderBarProps> = ({
  role,
  staffName,
  startedAt,
  onEndShift,
  onEndShiftClick,
  extraActions,
  className = '',
  confirmTitle,
  confirmMessage,
}) => {
  const config = ROLE_CONFIGS[role]
  const RoleIcon = config.icon

  const [showConfirm, setShowConfirm] = useState(false)
  const [isEnding, setIsEnding] = useState(false)

  // Live timer tracking how long the shift has been active
  const [elapsed, setElapsed] = useState(() => {
    if (!startedAt) return '00:00:00'
    const startMs = new Date(startedAt).getTime()
    if (isNaN(startMs)) return '00:00:00'
    const diffSec = Math.max(0, Math.floor((Date.now() - startMs) / 1000))
    return formatDuration(diffSec)
  })

  useEffect(() => {
    if (!startedAt) return
    const startMs = new Date(startedAt).getTime()
    if (isNaN(startMs)) return

    const updateTimer = () => {
      const diffSec = Math.max(0, Math.floor((Date.now() - startMs) / 1000))
      setElapsed(formatDuration(diffSec))
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [startedAt])

  const handleEndShiftClick = () => {
    if (onEndShiftClick) {
      onEndShiftClick()
    } else {
      setShowConfirm(true)
    }
  }

  const handleConfirmEndShift = async () => {
    if (!onEndShift) return
    setIsEnding(true)
    try {
      await onEndShift()
      setShowConfirm(false)
    } finally {
      setIsEnding(false)
    }
  }

  return (
    <>
      <div
        className={`flex items-center justify-between gap-3 px-3.5 py-2 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/80 shadow-xs ${className}`}
      >
        {/* Staff Info: Solid Role Icon + Staff Name + Live Elapsed Shift Timer */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${config.bgClass} ${config.textClass}`}
          >
            <RoleIcon className="w-4 h-4" />
          </div>

          <div className="flex flex-col min-w-0 leading-tight">
            <span className="font-extrabold text-xs sm:text-sm text-[#14274E] truncate max-w-[150px] sm:max-w-xs">
              {staffName}
            </span>
            <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 mt-0.5">
              <Clock className="w-2.5 h-2.5 text-slate-400 shrink-0" />
              <span className="font-mono tracking-tight">{elapsed}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons: Extra actions + End Shift */}
        <div className="flex items-center gap-2 shrink-0">
          {extraActions}

          <button
            type="button"
            onClick={handleEndShiftClick}
            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
            title="Conclude shift"
          >
            <LogOut className="w-3.5 h-3.5 text-rose-600" />
            <span>End Shift</span>
          </button>
        </div>
      </div>

      {/* Built-in Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-2xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <LogOut className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-[#14274E]">
                  {confirmTitle || `Conclude ${config.roleLabel} Shift`}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {confirmMessage || `End ${config.roleLabel.toLowerCase()} shift for ${staffName}?`}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600">
              This will record your shift end timestamp and log you out of the interface.
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
