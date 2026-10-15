import React, { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react'
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
  onRefresh?: () => void
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
  canManageEvents = true,
}) => {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [activeDayPopover, setActiveDayPopover] = useState<{
    date: Date
    events: RestaurantEvent[]
  } | null>(null)

  const grid = useMemo(() => getCalendarGrid(year, month), [year, month])
  const totalWeeks = Math.max(1, Math.ceil(grid.length / 7))

  const prevMonth = () => {
    if (month === 0) {
      setMonth(11)
      setYear((y) => y - 1)
    } else {
      setMonth((m) => m - 1)
    }
    setActiveDayPopover(null)
  }

  const nextMonth = () => {
    if (month === 11) {
      setMonth(0)
      setYear((y) => y + 1)
    } else {
      setMonth((m) => m + 1)
    }
    setActiveDayPopover(null)
  }

  const goToday = () => {
    setYear(today.getFullYear())
    setMonth(today.getMonth())
    setActiveDayPopover(null)
  }

  const isToday = (d: Date) =>
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()

  const isCurrentMonth = (d: Date) =>
    d.getMonth() === month && d.getFullYear() === year

  const cellKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`

  // Count events this month
  const monthEventsCount = useMemo(() => {
    return events.filter((e) => {
      const s = new Date(e.startAt)
      return s.getMonth() === month && s.getFullYear() === year && !e.isCancelled
    }).length
  }, [events, month, year])

  return (
    <div className="w-full h-full min-h-0 bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden flex flex-col select-none">
      {/* ── Calendar Header Bar ── */}
      <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-2.5 border-b border-slate-100 bg-white shrink-0">
        {/* Month & Year Title */}
        <div className="flex items-center gap-2.5">
          <h2 className="text-base sm:text-lg font-black text-[#14274E] tracking-tight">
            {MONTH_NAMES[month]} {year}
          </h2>
          <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
            {monthEventsCount} {monthEventsCount === 1 ? 'event' : 'events'}
          </span>
        </div>

        {/* Month Navigation with "Today" in the center */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/60">
          <button
            type="button"
            onClick={prevMonth}
            className="p-1 rounded-lg text-slate-600 hover:bg-white hover:text-[#14274E] hover:shadow-2xs transition-all cursor-pointer"
            aria-label="Previous month"
            title="Previous Month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={goToday}
            className="px-2.5 py-1 text-xs font-black text-slate-700 hover:text-[#14274E] hover:bg-white hover:shadow-2xs rounded-lg transition-all cursor-pointer"
            title="Return to current month"
          >
            Today
          </button>
          <button
            type="button"
            onClick={nextMonth}
            className="p-1 rounded-lg text-slate-600 hover:bg-white hover:text-[#14274E] hover:shadow-2xs transition-all cursor-pointer"
            aria-label="Next month"
            title="Next Month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Weekday Headers ── */}
      <div
        className="w-full border-b border-slate-200/80 bg-slate-50/80 shrink-0"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
        }}
      >
        {WEEKDAY_HEADERS.map((d, i) => (
          <div
            key={d}
            className={[
              'py-1.5 text-center text-[10px] sm:text-[11px] font-black uppercase tracking-wider',
              i === 5 || i === 6 ? 'text-amber-600/80' : 'text-slate-400',
            ].join(' ')}
          >
            {d}
          </div>
        ))}
      </div>

      {/* ── Calendar Dates Grid (Fills 100% height without scrolling) ── */}
      <div
        className="w-full flex-1 min-h-0 bg-slate-200/70 overflow-hidden"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
          gridTemplateRows: `repeat(${totalWeeks}, minmax(0, 1fr))`,
          gap: '1px',
        }}
      >
        {grid.map((date) => {
          const key = cellKey(date)
          const dayEvents = getEventsForDate(events, date)
          const isCurrent = isCurrentMonth(date)
          const isTodayCell = isToday(date)
          const MAX_VISIBLE = 3
          const visibleEvents = dayEvents.slice(0, MAX_VISIBLE)
          const overflowCount = dayEvents.length - MAX_VISIBLE

          return (
            <div
              key={key}
              onClick={() => {
                if (dayEvents.length > 0) {
                  setActiveDayPopover({ date, events: dayEvents })
                } else {
                  onDateClick(date)
                }
              }}
              className={[
                'group relative h-full min-h-0 p-1 sm:p-1.5 flex flex-row items-start gap-1 sm:gap-1.5 cursor-pointer transition-colors overflow-hidden',
                isCurrent
                  ? 'bg-white hover:bg-slate-50/90'
                  : 'bg-slate-50/50 hover:bg-slate-100/60',
              ].join(' ')}
            >
              {/* Left Column: Day Number + Quick Add Icon */}
              <div className="flex flex-col items-center gap-1 shrink-0">
                <span
                  className={[
                    'w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center rounded-full text-[10px] sm:text-xs font-black transition-all shrink-0',
                    isTodayCell
                      ? 'bg-[#14274E] text-[#E9C46A] shadow-xs ring-2 ring-[#E9C46A]/40'
                      : isCurrent
                        ? 'text-slate-700'
                        : 'text-slate-300',
                  ].join(' ')}
                >
                  {date.getDate()}
                </span>

                {canManageEvents && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDateClick(date)
                    }}
                    title={`Add event for ${date.toLocaleDateString()}`}
                    className="opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 rounded-md hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  </button>
                )}
              </div>

              {/* Right Column: Events List (Color + Time only) */}
              <div className="flex-1 min-w-0 flex flex-col gap-1 overflow-hidden h-full">
                {visibleEvents.map((event) => {
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
                      title={`${event.title} (${event.category}) • ${formatEventTime(event.startAt)} – ${formatEventTime(event.endAt)}`}
                      className={`w-full flex items-center gap-1 px-1.5 py-0.5 sm:py-1 rounded-md text-left transition-all cursor-pointer border shadow-2xs hover:shadow-xs hover:brightness-95 shrink-0 ${
                        event.isActive
                          ? 'bg-[#14274E] text-[#E9C46A] border-[#14274E] shadow-xs hover:bg-[#1a3468]'
                          : isInactive
                            ? 'bg-slate-100/70 text-slate-400 border-slate-200/80 hover:bg-slate-200/60'
                            : 'hover:brightness-98'
                      }`}
                      style={{
                        backgroundColor: event.isActive ? undefined : (isInactive ? undefined : `${color}18`),
                        borderColor: event.isActive ? undefined : (isInactive ? undefined : `${color}45`),
                        borderLeft: `3px solid ${color}`,
                      }}
                    >
                      {event.isActive ? (
                        <span className="relative flex h-1.5 w-1.5 shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400"></span>
                        </span>
                      ) : (
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0 shadow-xs"
                          style={{ backgroundColor: color }}
                        />
                      )}
                      <span
                        className={`truncate text-[10px] sm:text-[11px] font-black leading-tight ${
                          event.isActive ? 'text-[#E9C46A]' : isInactive ? 'line-through text-slate-400' : 'text-slate-900'
                        }`}
                      >
                        {formatEventTime(event.startAt)}
                      </span>
                    </button>
                  )
                })}

                {/* Clean +N more pill */}
                {overflowCount > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setActiveDayPopover({ date, events: dayEvents })
                    }}
                    className="text-[9px] font-black text-slate-500 hover:text-[#14274E] bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5 transition-colors cursor-pointer self-start shrink-0"
                  >
                    <span>+{overflowCount} more</span>
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Day Details Popover Modal ── */}
      {activeDayPopover && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-2xs animate-in fade-in duration-150"
          onClick={() => setActiveDayPopover(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-4 sm:p-5 space-y-3 animate-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm sm:text-base font-black text-[#14274E]">
                  {activeDayPopover.date.toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </h3>
                <p className="text-xs text-slate-400 font-semibold">
                  {activeDayPopover.events.length}{' '}
                  {activeDayPopover.events.length === 1 ? 'event scheduled' : 'events scheduled'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveDayPopover(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {activeDayPopover.events.map((ev) => {
                const color = ev.color || getCategoryColor(ev.category)
                return (
                  <div
                    key={ev.eventId}
                    onClick={() => {
                      setActiveDayPopover(null)
                      onEventClick(ev)
                    }}
                    className="p-3 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all cursor-pointer flex items-center justify-between gap-3 shadow-2xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <div className="min-w-0">
                        <p className="text-xs font-black text-[#14274E] truncate hover:underline">
                          {ev.title}
                        </p>
                        <p className="text-[10px] text-slate-400 font-semibold">
                          {formatEventTime(ev.startAt)} – {formatEventTime(ev.endAt)} • {ev.category}
                        </p>
                      </div>
                    </div>
                    {ev.isActive && (
                      <span className="text-[9px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full shrink-0">
                        ACTIVE
                      </span>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              {canManageEvents && (
                <button
                  type="button"
                  onClick={() => {
                    const d = activeDayPopover.date
                    setActiveDayPopover(null)
                    onDateClick(d)
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#14274E] text-[#E9C46A] text-xs font-black hover:bg-[#1a3468] cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Add Event for this Day</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setActiveDayPopover(null)}
                className="ml-auto px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
