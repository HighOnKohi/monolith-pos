import React from 'react'
import { CalendarDays, Clock, TrendingUp, Calendar, Flame, Check } from 'lucide-react'
import type { EventSummaryStats, EventCardType } from '../utils/eventUtils'

export type { EventCardType }

interface EventsSummaryCardsProps {
  stats: EventSummaryStats
  loading?: boolean
  activeCard?: EventCardType | null
  onCardClick?: (type: EventCardType) => void
}

export const EventsSummaryCards: React.FC<EventsSummaryCardsProps> = ({
  stats,
  loading = false,
  activeCard = 'total',
  onCardClick,
}) => {
  const val = (n: number) => (loading ? '—' : n)

  const cards: Array<{
    type: EventCardType
    id: string
    label: string
    value: React.ReactNode
    sub: string
    icon: typeof CalendarDays
    iconBg: string
    iconColor: string
    valColor: string
  }> = [
    {
      type: 'total',
      id: 'summary-card-total',
      label: 'Total Events',
      value: val(stats.total),
      sub: 'all time',
      icon: CalendarDays,
      iconBg: 'bg-slate-100',
      iconColor: 'text-slate-600',
      valColor: 'text-[#14274E]',
    },
    {
      type: 'upcoming',
      id: 'summary-card-upcoming',
      label: 'Upcoming',
      value: val(stats.upcoming),
      sub: 'not yet started',
      icon: TrendingUp,
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
      valColor: 'text-blue-700',
    },
    {
      type: 'today',
      id: 'summary-card-today',
      label: 'Today',
      value: val(stats.today),
      sub: 'scheduled today',
      icon: Calendar,
      iconBg: 'bg-[#14274E]/10',
      iconColor: 'text-[#14274E]',
      valColor: 'text-[#14274E]',
    },
    {
      type: 'thisWeek',
      id: 'summary-card-thisWeek',
      label: 'This Week',
      value: val(stats.thisWeek),
      sub: 'Mon – Sun',
      icon: Clock,
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
      valColor: 'text-amber-700',
    },
    {
      type: 'ongoing',
      id: 'summary-card-ongoing',
      label: 'Ongoing',
      value: val(stats.ongoing),
      sub: 'happening now',
      icon: Flame,
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      valColor: 'text-emerald-600',
    },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3 shrink-0">
      {cards.map((card) => {
        const Icon = card.icon
        const isActive = activeCard === card.type

        return (
          <button
            key={card.label}
            id={card.id}
            type="button"
            onClick={() => onCardClick?.(card.type)}
            title={`View ${card.label.toLowerCase()} list`}
            className={[
              'text-left p-3 sm:p-3.5 rounded-2xl border shadow-2xs space-y-1 transition-all cursor-pointer select-none relative group',
              isActive
                ? 'bg-[#14274E]/[0.03] border-[#14274E] ring-2 ring-[#14274E]/15 shadow-xs'
                : 'bg-white border-slate-200/80 hover:border-slate-300 hover:shadow-xs hover:bg-slate-50/50',
            ].join(' ')}
          >
            <div className="flex items-center justify-between">
              <span
                className={[
                  'text-[10px] font-black uppercase tracking-wider transition-colors',
                  isActive ? 'text-[#14274E]' : 'text-slate-400 group-hover:text-slate-600',
                ].join(' ')}
              >
                {card.label}
              </span>
              <div
                className={[
                  'w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover:scale-105',
                  card.iconBg,
                ].join(' ')}
              >
                <Icon className={`w-3.5 h-3.5 ${card.iconColor}`} />
              </div>
            </div>

            <div className="flex items-baseline justify-between gap-1.5">
              <span className={`text-xl sm:text-2xl font-black ${card.valColor}`}>{card.value}</span>
              {isActive && (
                <span className="inline-flex items-center gap-0.5 text-[9px] font-black text-[#14274E] bg-[#14274E]/10 px-1.5 py-0.5 rounded-md shrink-0">
                  <Check className="w-2.5 h-2.5" />
                  <span>Viewing</span>
                </span>
              )}
            </div>

            <div className="text-[10px] sm:text-[11px] font-medium text-slate-400 truncate">{card.sub}</div>
          </button>
        )
      })}
    </div>
  )
}
