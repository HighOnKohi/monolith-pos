import React from 'react'
import { Pencil, Trash2, MapPin, Users, CalendarDays } from 'lucide-react'
import type { RestaurantEvent } from '@/types/event'
import {
  deriveEventStatus,
  getEventStatusBadge,
  getCategoryColor,
  formatEventDateDuration,
} from '../utils/eventUtils'

interface EventsListViewProps {
  events: RestaurantEvent[]
  onView: (event: RestaurantEvent) => void
  onEdit: (event: RestaurantEvent) => void
  onDelete: (event: RestaurantEvent) => void
  onToggleActive?: (event: RestaurantEvent) => void
  canManageEvents: boolean
  loading?: boolean
}

export const EventsListView: React.FC<EventsListViewProps> = ({
  events,
  onView,
  onEdit,
  onDelete,
  onToggleActive,
  canManageEvents,
  loading = false,
}) => {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 rounded-full border-3 border-slate-200 border-t-[#14274E] animate-spin" />
        <p className="text-xs text-slate-400 font-medium">Loading events...</p>
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
        <p className="text-sm font-bold text-slate-600">No events found</p>
        <p className="text-xs text-slate-400 mt-1">Try changing your filters or create a new event.</p>
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col h-full">
      {/* ── Desktop Table ── */}
      <div className="hidden sm:flex flex-col flex-1 min-h-0 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="flex-1 min-h-0 overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-500 shadow-2xs">
              <tr>
                <th className="px-4 py-3 text-center bg-slate-50">Event Name</th>
                <th className="px-4 py-3 text-center bg-slate-50">Date Duration</th>
                <th className="px-4 py-3 text-center bg-slate-50">Location</th>
                <th className="px-4 py-3 text-center bg-slate-50">Category</th>
                <th className="px-4 py-3 text-center bg-slate-50">Guest Count</th>
                <th className="px-4 py-3 text-center bg-slate-50">Active</th>
                <th className="px-4 py-3 text-right bg-slate-50"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
            {events.map((event) => {
              const pax = event.maxPax ?? event.expectedAttendees ?? 50
              const eventColor = event.color || getCategoryColor(event.category)

              return (
                <tr
                  key={event.eventId}
                  onClick={() => onView(event)}
                  className="hover:bg-slate-50/70 transition-colors cursor-pointer border-l-4"
                  style={{ borderLeftColor: eventColor }}
                >
                  {/* Event Name - with assigned color pip */}
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs ring-1 ring-black/5"
                        style={{ backgroundColor: eventColor }}
                        title={`Event color: ${eventColor}`}
                      />
                      <p
                        className="font-bold text-[#14274E] truncate cursor-pointer hover:underline"
                        onClick={() => onView(event)}
                      >
                        {event.title}
                      </p>
                    </div>
                  </td>

                  {/* Date Duration */}
                  <td className="px-4 py-3 text-center">
                    <div className="font-bold text-slate-600 whitespace-nowrap">
                      {formatEventDateDuration(event.startAt, event.endAt)}
                    </div>
                  </td>

                  {/* Location */}
                  <td className="px-4 py-3 text-center max-w-[140px]">
                    <div className="font-bold text-slate-600 truncate">
                      {event.location || '—'}
                    </div>
                  </td>

                  {/* Category - styled with assigned event color */}
                  <td className="px-4 py-3 text-center">
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold"
                      style={{
                        backgroundColor: `${eventColor}18`,
                        color: eventColor,
                        border: `1px solid ${eventColor}35`,
                      }}
                    >
                      {event.category}
                    </span>
                  </td>

                  {/* Guest Count */}
                  <td className="px-4 py-3 text-center">
                    <div className="font-bold text-slate-600 whitespace-nowrap">
                      {pax}
                    </div>
                  </td>

                  {/* Active Toggle */}
                  <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                    {canManageEvents ? (
                      <button
                        type="button"
                        role="switch"
                        aria-checked={Boolean(event.isActive)}
                        onClick={() => onToggleActive?.(event)}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                          event.isActive ? 'bg-[#14274E]' : 'bg-slate-200 hover:bg-slate-300'
                        }`}
                        title={event.isActive ? 'Active event (Click to deactivate)' : 'Inactive (Click to activate)'}
                      >
                        <span
                          aria-hidden="true"
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                            event.isActive ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    ) : (
                      <span className={`inline-block w-2.5 h-2.5 rounded-full ${event.isActive ? 'bg-emerald-500 ring-4 ring-emerald-100' : 'bg-slate-300'}`} />
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {canManageEvents && (
                        <>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              onEdit(event)
                            }}
                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors cursor-pointer"
                            title="Edit event"
                            aria-label="Edit event"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              onDelete(event)
                            }}
                            className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                            title="Delete event"
                            aria-label="Delete event"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>
      </div>

      {/* ── Mobile Card List ── */}
      <div className="sm:hidden flex-1 min-h-0 overflow-y-auto divide-y divide-slate-100 bg-white rounded-2xl border border-slate-200 shadow-xs">
        {events.map((event) => {
          const status = deriveEventStatus(event)
          const badge = getEventStatusBadge(status)
          const catColor = event.color || getCategoryColor(event.category)

          return (
            <div key={event.eventId} className="p-4 space-y-2">
              <div className="flex items-start gap-2.5">
                <div
                  className="w-1.5 rounded-full shrink-0 mt-1"
                  style={{ backgroundColor: catColor, minHeight: '44px' }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p
                      className="font-black text-[#14274E] text-sm cursor-pointer"
                      onClick={() => onView(event)}
                    >
                      {event.title}
                    </p>
                    <span
                      className={[
                        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0',
                        badge.bg, badge.text, badge.border,
                      ].join(' ')}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                      {status}
                    </span>
                  </div>

                  <div className="mt-1 space-y-0.5 text-xs text-slate-500">
                    <div className="flex items-center gap-1 font-semibold text-slate-600">
                      <CalendarDays className="w-3 h-3 shrink-0 text-slate-400" />
                      <span>{formatEventDateDuration(event.startAt, event.endAt)}</span>
                    </div>
                    {event.location && (
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 shrink-0 text-slate-400" />
                        <span>{event.location}</span>
                      </div>
                    )}
                    {(event.maxPax != null || event.expectedAttendees != null) && (
                      <div className="flex items-center gap-1">
                        <Users className="w-3 h-3 shrink-0 text-slate-400" />
                        <span>{event.maxPax ?? event.expectedAttendees} Guests</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold"
                        style={{
                          backgroundColor: `${catColor}18`,
                          color: catColor,
                          border: `1px solid ${catColor}30`,
                        }}
                      >
                        {event.category}
                      </span>
                      {canManageEvents && (
                        <button
                          type="button"
                          role="switch"
                          aria-checked={Boolean(event.isActive)}
                          onClick={() => onToggleActive?.(event)}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                            event.isActive ? 'bg-[#14274E]' : 'bg-slate-200'
                          }`}
                          title={event.isActive ? 'Active event' : 'Inactive'}
                        >
                          <span
                            aria-hidden="true"
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                              event.isActive ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {canManageEvents && (
                        <>
                          <button
                            type="button"
                            onClick={() => onEdit(event)}
                            className="p-2 rounded-xl bg-slate-100 text-slate-600 cursor-pointer"
                            aria-label="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDelete(event)}
                            className="p-2 rounded-xl bg-rose-50 text-rose-600 cursor-pointer"
                            aria-label="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
