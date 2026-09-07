import type { StatusStat } from '@/services/analyticsService'

interface OrderStatusBreakdownProps {
  statuses: StatusStat[]
}

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  COMPLETED: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  CANCELLED: { bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-500' },
  SERVED: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  READY: { bg: 'bg-cyan-50', text: 'text-cyan-700', dot: 'bg-cyan-500' },
  PREPARING: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  VERIFIED: { bg: 'bg-indigo-50', text: 'text-indigo-700', dot: 'bg-indigo-500' },
  REQUESTED: { bg: 'bg-slate-100', text: 'text-slate-700', dot: 'bg-slate-400' },
}

export function OrderStatusBreakdown({ statuses }: OrderStatusBreakdownProps) {
  if (!statuses || statuses.length === 0) {
    return (
      <div className="h-44 flex items-center justify-center text-slate-400 text-xs italic">
        No orders found in this period.
      </div>
    )
  }

  const activeStatuses = statuses.filter((s) => s.count > 0)
  const displayStatuses = activeStatuses.length > 0 ? activeStatuses : statuses

  return (
    <div className="flex flex-col gap-3">
      {/* Segmented multi-color progress bar */}
      <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex shadow-2xs">
        {displayStatuses.map((st) => {
          const cfg = STATUS_COLORS[st.status] ?? { dot: 'bg-slate-400' }
          if (st.percentage <= 0) return null
          return (
            <div
              key={st.status}
              className={`h-full ${cfg.dot} transition-all duration-300`}
              style={{ width: `${st.percentage}%` }}
              title={`${st.status}: ${st.count} (${st.percentage}%)`}
            />
          )
        })}
      </div>

      {/* Status pills list */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-xs">
        {displayStatuses.map((st) => {
          const cfg = STATUS_COLORS[st.status] ?? {
            bg: 'bg-slate-100',
            text: 'text-slate-700',
            dot: 'bg-slate-400',
          }

          return (
            <div
              key={st.status}
              className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl border border-slate-200/60 ${cfg.bg}`}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                <span className={`font-bold text-[11px] truncate ${cfg.text}`}>{st.status}</span>
              </div>
              <div className="flex items-center gap-1 text-[11px] font-black shrink-0">
                <span className="text-slate-800">{st.count}</span>
                <span className="text-[10px] text-slate-400 font-normal">({st.percentage}%)</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
