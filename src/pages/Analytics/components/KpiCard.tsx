import type { LucideIcon } from 'lucide-react'
import { TrendingUp, TrendingDown, HelpCircle } from 'lucide-react'

interface KpiCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  changePercent?: number | null
  changeLabel?: string
  subtitle?: string
  isUnavailable?: boolean
  tooltipText?: string
  accentColor?: string
}

export function KpiCard({
  title,
  value,
  icon: Icon,
  changePercent,
  changeLabel = 'vs previous period',
  subtitle,
  isUnavailable = false,
  tooltipText,
  accentColor = '#14274E',
}: KpiCardProps) {
  const hasChange = changePercent !== undefined && changePercent !== null
  const isPositive = hasChange && changePercent > 0
  const isNeutral = hasChange && changePercent === 0

  return (
    <div className="relative bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between overflow-hidden group">
      {/* Top row: Label & Icon */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{title}</span>
          {tooltipText && (
            <div className="relative group/tip cursor-help">
              <HelpCircle className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600 transition-colors" />
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 hidden group-hover/tip:flex w-48 p-2 bg-slate-900 text-white text-[10px] rounded-lg shadow-lg z-50 pointer-events-none leading-relaxed">
                {tooltipText}
              </div>
            </div>
          )}
        </div>

        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105"
          style={{ backgroundColor: `${accentColor}15`, color: accentColor }}
        >
          <Icon className="w-4 h-4" />
        </div>
      </div>

      {/* Metric Value */}
      <div className="mt-2.5">
        {isUnavailable ? (
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-slate-400">—</span>
            <span className="text-[11px] font-medium text-slate-400 italic">Unavailable</span>
          </div>
        ) : (
          <div className="text-2xl sm:text-3xl font-black text-[#14274E] tracking-tight leading-none">
            {value}
          </div>
        )}
      </div>

      {/* Bottom row: Trend or Subtitle */}
      <div className="mt-3 flex items-center gap-2 text-xs">
        {hasChange ? (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md font-bold text-[11px] ${
                isNeutral
                  ? 'bg-slate-100 text-slate-600'
                  : isPositive
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-rose-50 text-rose-700'
              }`}
            >
              {isNeutral ? null : isPositive ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              {isPositive ? `+${changePercent}%` : `${changePercent}%`}
            </span>
            <span className="text-[11px] text-slate-400">{changeLabel}</span>
          </div>
        ) : subtitle ? (
          <span className="text-[11px] text-slate-500 font-medium truncate">{subtitle}</span>
        ) : null}
      </div>
    </div>
  )
}
