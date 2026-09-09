import React from 'react'
import { Eye, Pencil, Trash2, MapPin, User2, Users, Clock } from 'lucide-react'
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
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="p-4 border-b border-slate-100 animate-pulse">
            <div className="flex items-center gap-4">
              <div className="w-2 h-10 rounded-full bg-slate-200 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-slate-200 rounded w-48" />
                <div className="h-2.5 bg-slate-100 rounded w-64" />
              </div>
              <div className="h-5 w-16 bg-slate-200 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
      {/* ── Desktop Table ── */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/70">
              <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-400">Event</th>
              <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-400">Date &amp; Time</th>
              <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-400">Location</th>
              <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-400">Category</th>
              <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-400">Status</th>
              <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-400">Created By</th>
              <th className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => {
              const status = deriveEventStatus(event)
              const badge = getEventStatusBadge(status)
              const catColor = event.color || getCategoryColor(event.category)

              return (
                <tr
                  key={event.eventId}
                  className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors"
                >
                  {/* Event Name */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5 max-w-[220px]">
                      <div
                        className="w-2 rounded-full shrink-0 self-stretch min-h-[32px]"
                        style={{ backgroundColor: catColor }}
                      />
                      <div>
                        <p
                          className="font-black text-[#14274E] truncate cursor-pointer hover:underline"
                          onClick={() => onView(event)}
                        >
                          {event.title}
                        </p>
                        {event.organizer && (
                          <p className="text-[10px] text-slate-400 flex items-center gap-0.5 mt-0.5">
                            <User2 className="w-3 h-3" />
                            {event.organizer}
                          </p>
                        )}
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
                    {event.expectedAttendees != null && (
                      <div className="flex items-center gap-1">
                        <Users className="w-3 h-3 shrink-0" />
                        <span>{event.expectedAttendees} expected</span>
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
