import React, { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, Clock } from 'lucide-react'
import type { RestaurantEvent } from '@/types/event'
import {
  getCalendarGrid,
  getEventsForDate,
  deriveEventStatus,
  getCategoryColor,
  formatEventTime,
} from '../utils/eventUtils'

interface EventsCalendarProps {
  events: RestaurantEvent[]
  onEventClick: (event: RestaurantEvent) => void
  onDateClick: (date: Date) => void
  onAddEvent?: () => void
  canManageEvents?: boolean
}

const WEEKDAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export const EventsCalendar: React.FC<EventsCalendarProps> = ({
  events,
  onEventClick,
  onDateClick,
  onAddEvent,
  canManageEvents = true,
}) => {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  // Track which cells are expanded to show all events
  const [expandedCells, setExpandedCells] = useState<Set<string>>(new Set())

  const grid = useMemo(() => getCalendarGrid(year, month), [year, month])

  const prevMonth = () => {
    if (month === 0) {
      setMonth(11)
      setYear((y) => y - 1)
    } else {
      setMonth((m) => m - 1)
    }
    setExpandedCells(new Set())
  }

  const nextMonth = () => {
    if (month === 11) {
      setMonth(0)
      setYear((y) => y + 1)
    } else {
      setMonth((m) => m + 1)
    }
    setExpandedCells(new Set())
  }

  const goToday = () => {
    setYear(today.getFullYear())
    setMonth(today.getMonth())
    setExpandedCells(new Set())
  }

  const isToday = (d: Date) =>
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()

  const isCurrentMonth = (d: Date) =>
    d.getMonth() === month && d.getFullYear() === year

  const cellKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`

  const toggleExpand = (key: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedCells((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className="w-full bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden flex flex-col shrink-0">
      {/* ── Calendar Header Bar ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-slate-100 bg-white">
        {/* Month & Year Title */}
        <div className="flex items-center gap-2.5">
          <h2 className="text-base sm:text-lg font-black text-[#14274E] tracking-tight">
            {MONTH_NAMES[month]} {year}
          </h2>
          <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
            {events.filter((e) => {
              const d = new Date(e.startAt)
              return d.getMonth() === month && d.getFullYear() === year && !e.isCancelled
            }).length} active events
          </span>
        </div>

        {/* Navigation Controls + Quick Add Button */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {canManageEvents && onAddEvent && (
            <button
              onClick={onAddEvent}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#14274E] hover:bg-[#1a3468] text-white text-xs font-bold shadow-2xs active:scale-98 transition-all cursor-pointer mr-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Event</span>
            </button>
          )}

          <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200/80">
            <button
              onClick={prevMonth}
              className="p-1.5 rounded-lg hover:bg-white hover:shadow-2xs text-slate-600 transition-all cursor-pointer"
              aria-label="Previous month"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={goToday}
              className="px-2.5 py-1 rounded-lg text-xs font-black text-slate-700 hover:bg-white hover:shadow-2xs transition-all cursor-pointer"
            >
              Today
            </button>
            <button
              onClick={nextMonth}
              className="p-1.5 rounded-lg hover:bg-white hover:shadow-2xs text-slate-600 transition-all cursor-pointer"
              aria-label="Next month"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Weekday Headers (Strict 7-column grid layout via inline style) ── */}
      <div
        className="w-full border-b border-slate-200/80 bg-slate-50/70"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
        }}
      >
        {WEEKDAY_HEADERS.map((d, i) => (
          <div
            key={d}
            className={[
              'py-2 text-center text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-400',
              i === 5 || i === 6 ? 'text-amber-600/70' : '',
            ].join(' ')}
          >
            {d}
          </div>
        ))}
      </div>

      {/* ── Calendar Dates Grid (Strict 7-column grid with 1px border gap) ── */}
      <div
        className="w-full bg-slate-200/70"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
          gap: '1px',
        }}
      >
        {grid.map((date) => {
          const key = cellKey(date)
          const dayEvents = getEventsForDate(events, date)
          const isCurrent = isCurrentMonth(date)
          const isTodayCell = isToday(date)
          const isExpanded = expandedCells.has(key)
          const MAX_VISIBLE = 2
          const visible = isExpanded ? dayEvents : dayEvents.slice(0, MAX_VISIBLE)

          return (
            <div
              key={key}
              onClick={() => onDateClick(date)}
              className={[
                'group relative min-h-[72px] sm:min-h-[82px] lg:min-h-[92px] xl:min-h-[100px] p-1.5 sm:p-2 flex flex-col justify-between cursor-pointer transition-colors select-none',
                isCurrent
                  ? 'bg-white hover:bg-slate-50/90'
                  : 'bg-slate-50/50 hover:bg-slate-100/70',
              ].join(' ')}
            >
              {/* Cell Header: Quick Add Icon + Day Number */}
              <div className="flex items-center justify-between mb-1">
                {/* Plus button visible on hover to clearly invite adding events */}
                {canManageEvents ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDateClick(date)
                    }}
                    title={`Add event for ${date.toLocaleDateString()}`}
                    className="opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 rounded-md hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <span />
                )}

                {/* Day Badge */}
                <span
                  className={[
                    'w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center rounded-full text-[11px] sm:text-xs font-black transition-all',
                    isTodayCell
                      ? 'bg-[#14274E] text-[#E9C46A] shadow-xs'
                      : isCurrent
                        ? 'text-slate-700'
                        : 'text-slate-300',
                  ].join(' ')}
                >
                  {date.getDate()}
                </span>
              </div>

              {/* Event Chips List */}
              <div className="space-y-1 flex-1 overflow-hidden">
                {visible.map((event) => {
                  const status = deriveEventStatus(event)
                  const color = event.color || getCategoryColor(event.category)
                  const isInactive = status === 'Completed' || status === 'Cancelled'

                  return (
                    <button
                      key={event.eventId}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onEventClick(event)
                      }}
                      title={`${event.title} (${event.category}) - ${formatEventTime(event.startAt)}`}
                      className={[
                        'w-full flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md text-[10px] sm:text-[11px] font-bold truncate text-left transition-all hover:scale-101 hover:shadow-2xs cursor-pointer',
                        isInactive ? 'opacity-55' : '',
                      ].join(' ')}
                      style={{
                        backgroundColor: `${color}14`,
                        borderLeft: `3px solid ${color}`,
                        color: isInactive ? '#64748b' : color,
                      }}
                    >
                      <span className="truncate flex-1 font-semibold">
                        {event.title}
                      </span>
                      <span className="text-[9px] opacity-75 font-mono shrink-0 hidden md:inline">
                        {formatEventTime(event.startAt)}
                      </span>
                    </button>
                  )
                })}

                {/* Overflow toggle if more than MAX_VISIBLE */}
                {dayEvents.length > MAX_VISIBLE && (
                  <button
                    type="button"
                    onClick={(e) => toggleExpand(key, e)}
                    className="w-full text-[9px] sm:text-[10px] font-black text-slate-500 hover:text-slate-800 text-left px-1 py-0.5 rounded hover:bg-slate-100 transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <Clock className="w-2.5 h-2.5" />
                    <span>
                      {isExpanded ? 'Show less' : `+${dayEvents.length - MAX_VISIBLE} more`}
                    </span>
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
