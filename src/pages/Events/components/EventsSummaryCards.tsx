import React from 'react'
import { CalendarDays, CheckCircle2 } from 'lucide-react'
import type { RestaurantEvent } from '@/types/event'
import { formatEventDateDuration, getCategoryColor } from '../utils/eventUtils'

interface EventsSummaryCardsProps {
  events: RestaurantEvent[]
  loading?: boolean
  onViewEvent: (event: RestaurantEvent) => void
  onToggleActive?: (event: RestaurantEvent) => void
  canManageEvents?: boolean
}

export const EventsSummaryCards: React.FC<EventsSummaryCardsProps> = ({
  events,
  loading = false,
  onViewEvent,
  onToggleActive,
  canManageEvents = true,
}) => {
  const now = Date.now()

  // a. Upcoming event (the nearest event)
  const upcomingEvents = events
    .filter((e) => !e.isCancelled && new Date(e.endAt).getTime() >= now)
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
  const nearestEvent = upcomingEvents[0] || null

  // b. Current event setup enabled
  const activeEvent = events.find((e) => e.isActive && !e.isCancelled) || null

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 shrink-0">
        <div className="h-28 rounded-2xl bg-white/70 border border-slate-200/80 animate-pulse p-4" />
        <div className="h-28 rounded-2xl bg-white/70 border border-slate-200/80 animate-pulse p-4" />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 shrink-0">
      {/* ── Summary Tab A: Upcoming Event ── */}
      <div
        onClick={() => nearestEvent && onViewEvent(nearestEvent)}
        className={`bg-white rounded-2xl border-2 p-4 shadow-2xs transition-all flex flex-col justify-between ${
          nearestEvent
            ? 'border-slate-200/90 hover:border-[#14274E] hover:border-[3px] hover:shadow-xs cursor-pointer'
            : 'border-slate-200/80'
        }`}
      >
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-[10px] font-black uppercase tracking-wider text-blue-700">
            Upcoming Event
          </span>

          {nearestEvent && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200/60">
              <CalendarDays className="w-3 h-3" />
              <span>{formatEventDateDuration(nearestEvent.startAt, nearestEvent.endAt)}</span>
            </span>
          )}
        </div>

        {nearestEvent ? (
          <div>
            <h3 className="text-lg sm:text-xl font-black text-[#14274E] truncate tracking-tight hover:underline">
              {nearestEvent.title}
            </h3>

            <p className="text-xs font-semibold text-slate-400 capitalize mt-0.5">
              {nearestEvent.category}
            </p>
          </div>
        ) : (
          <div className="py-1">
            <p className="text-xs font-bold text-slate-600">No upcoming events scheduled</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Create an event to view nearest schedule details here.
            </p>
          </div>
        )}
      </div>

      {/* ── Summary Tab B: Current Event Setup Enabled ── */}
      <div
        onClick={() => activeEvent && onViewEvent(activeEvent)}
        className={`bg-white rounded-2xl border p-4 shadow-2xs transition-all flex flex-col justify-between ${
          activeEvent
            ? 'border-emerald-200/90 hover:border-emerald-300 hover:shadow-xs cursor-pointer'
            : 'border-slate-200/80'
        }`}
      >
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5">
            {activeEvent ? (
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
            ) : (
              <span className="w-2.5 h-2.5 rounded-full bg-slate-300 shrink-0" />
            )}
            <span
              className={`text-[10px] font-black uppercase tracking-wider ${
                activeEvent ? 'text-emerald-800' : 'text-slate-500'
              }`}
            >
              Current Event Setup Enabled
            </span>
          </div>

          <span
            className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
              activeEvent
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : 'bg-slate-100 text-slate-500 border-slate-200'
            }`}
          >
            {activeEvent ? 'ACTIVE' : 'DEFAULT OPERATION'}
          </span>
        </div>

        {activeEvent ? (
          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <h3 className="text-sm sm:text-base font-black text-[#14274E] truncate hover:underline">
                {activeEvent.title}
              </h3>
              {canManageEvents && onToggleActive && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggleActive(activeEvent)
                  }}
                  className="px-2.5 py-1 text-[10px] font-black text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg cursor-pointer transition-colors shrink-0"
                  title="Deactivate event setup"
                >
                  Deactivate
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold"
                style={{
                  backgroundColor: `${getCategoryColor(activeEvent.category)}18`,
                  color: getCategoryColor(activeEvent.category),
                  border: `1px solid ${getCategoryColor(activeEvent.category)}35`,
                }}
              >
                {activeEvent.category}
              </span>

              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span>{formatEventDateDuration(activeEvent.startAt, activeEvent.endAt)}</span>
              </span>

              {activeEvent.presetId && (
                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded-md">
                  Linked Layout
                </span>
              )}
              {activeEvent.menuPresetId && (
                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md">
                  Linked Menu
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="py-1">
            <p className="text-xs font-bold text-slate-700">Standard Restaurant Setup</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Operating with default table layouts and active menu presets.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
