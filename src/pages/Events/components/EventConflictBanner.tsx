import React from 'react'
import { AlertCircle, Ban } from 'lucide-react'
import type { EventConflict } from '@/types/event'
import { formatEventDate, formatEventTime } from '../utils/eventUtils'

interface EventConflictBannerProps {
  conflicts: EventConflict[]
}

export const EventConflictBanner: React.FC<EventConflictBannerProps> = ({ conflicts }) => {
  if (conflicts.length === 0) return null

  return (
    <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs animate-in fade-in duration-200">
      <Ban className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
      <div className="text-rose-900 space-y-1">
        <p className="font-black text-rose-700 flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 inline" />
          Simultaneous Events Not Permitted
        </p>
        <p className="text-[11px] text-rose-800">
          Another event is already scheduled at this time. Multiple events cannot occur simultaneously:
        </p>
        <ul className="space-y-1 pt-1">
          {conflicts.map((c) => (
            <li key={c.eventId} className="font-semibold text-rose-950 bg-white/80 px-2.5 py-1 rounded-lg border border-rose-200">
              <span className="font-black text-rose-700">"{c.title}"</span> ·{' '}
              {formatEventDate(c.startAt)} ({formatEventTime(c.startAt)} – {formatEventTime(c.endAt)})
            </li>
          ))}
        </ul>
        <p className="text-[11px] text-rose-700 font-bold pt-1">
          Please adjust the event start or end time to resolve this conflict before saving.
        </p>
      </div>
    </div>
  )
}
