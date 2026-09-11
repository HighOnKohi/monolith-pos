import React from 'react'
import { Eye, Pencil, Trash2, MapPin, User2, Users, Clock, Layout } from 'lucide-react'
import type { RestaurantEvent } from '@/types/event'
import {
  deriveEventStatus,
  getEventStatusBadge,
  getCategoryColor,
  formatEventDate,
  formatEventTime,
} from '../utils/eventUtils'

interface EventsListViewProps {
  events: RestaurantEvent[]
  onView: (event: RestaurantEvent) => void
  onEdit: (event: RestaurantEvent) => void
  onDelete: (event: RestaurantEvent) => void
  canManageEvents: boolean
  loading?: boolean
}

export const EventsListView: React.FC<EventsListViewProps> = ({
  events,
  onView,
  onEdit,
  onDelete,
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
    <div className="space-y-3">
      {/* ── Desktop Table ── */}
      <div className="hidden sm:block bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-black uppercase tracking-wider text-slate-400">
              <th className="px-4 py-3">Event</th>
              <th className="px-4 py-3">Date &amp; Time</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Created By</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {events.map((event) => {
              const status = deriveEventStatus(event)
              const badge = getEventStatusBadge(status)
              const catColor = event.color || getCategoryColor(event.category)
              const pax = event.maxPax ?? event.expectedAttendees ?? 50

              return (
                <tr key={event.eventId} className="hover:bg-slate-50/60 transition-colors">
                  {/* Event Name & Category Dot */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: catColor }}
                      />
                      <div>
                        <p
                          className="font-black text-[#14274E] truncate cursor-pointer hover:underline"
                          onClick={() => onView(event)}
                        >
                          {event.title}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {event.organizer && (
                            <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                              <User2 className="w-3 h-3" />
                              {event.organizer}
                            </span>
                          )}
                          <span className="text-[10px] font-semibold text-slate-500 flex items-center gap-0.5">
                            <Users className="w-3 h-3 text-slate-400" />
                            {pax} Max Pax
                          </span>
                          {event.presetId && (
                            <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                              <Layout className="w-2.5 h-2.5" /> Linked Layout
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Date & Time */}
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                    <div className="font-bold">{formatEventDate(event.startAt)}</div>
                    <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                      <Clock className="w-2.5 h-2.5" />
                      {formatEventTime(event.startAt)} – {formatEventTime(event.endAt)}
                    </div>
                  </td>

                  {/* Location */}
                  <td className="px-4 py-3 text-slate-500 max-w-[140px]">
                    {event.location ? (
                      <span className="flex items-center gap-1 truncate">
                        <MapPin className="w-3 h-3 shrink-0" />
                        <span className="truncate">{event.location}</span>
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>

                  {/* Category */}
                  <td className="px-4 py-3">
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
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <span
                      className={[
                        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border',
                        badge.bg, badge.text, badge.border,
                      ].join(' ')}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                      {status}
                    </span>
                  </td>

                  {/* Created By */}
                  <td className="px-4 py-3 text-slate-400 text-[10px]">
                    {event.createdBy || '—'}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => onView(event)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors cursor-pointer"
                        title="View event"
                        aria-label="View event"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      {canManageEvents && (
                        <>
                          <button
                            onClick={() => onEdit(event)}
                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors cursor-pointer"
                            title="Edit event"
                            aria-label="Edit event"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDelete(event)}
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

      {/* ── Mobile Card List ── */}
      <div className="md:hidden divide-y divide-slate-100">
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
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3 shrink-0" />
                      <span>{formatEventDate(event.startAt)}, {formatEventTime(event.startAt)} – {formatEventTime(event.endAt)}</span>
                    </div>
                    {event.location && (
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 shrink-0" />
                        <span>{event.location}</span>
                      </div>
                    )}
                    {(event.maxPax != null || event.expectedAttendees != null) && (
                      <div className="flex items-center gap-1">
                        <Users className="w-3 h-3 shrink-0" />
                        <span>{event.maxPax ?? event.expectedAttendees} Max Pax</span>
                      </div>
                    )}
                    {event.presetId && (
                      <div className="flex items-center gap-1 text-indigo-700 font-bold">
                        <Layout className="w-3 h-3 shrink-0" />
                        <span>Linked Table Layout</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-2">
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
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onView(event)}
                        className="p-2 rounded-xl bg-slate-100 text-slate-600 cursor-pointer"
                        aria-label="View"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      {canManageEvents && (
                        <>
                          <button
                            onClick={() => onEdit(event)}
                            className="p-2 rounded-xl bg-slate-100 text-slate-600 cursor-pointer"
                            aria-label="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
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
