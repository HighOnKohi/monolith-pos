import React from 'react'
import { AlertCircle } from 'lucide-react'
import type { EventConflict } from '@/types/event'
import { formatEventDate, formatEventTime } from '../utils/eventUtils'

interface EventConflictBannerProps {
  conflicts: EventConflict[]
}

export const EventConflictBanner: React.FC<EventConflictBannerProps> = ({ conflicts }) => {
  if (conflicts.length === 0) return null

  return (
    <div className="w-full bg-rose-50 border border-rose-300 rounded-2xl shadow-xl p-3.5 flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0 space-y-2">
        {conflicts.map((c) => {
          const isBuffer = c.conflictType === 'buffer'
          const conflictTitle = isBuffer ? '3-Hour Buffer Required' : 'Event Conflict'
          const description = isBuffer && c.bufferReason
            ? `${formatEventDate(c.startAt)} · ${c.bufferReason}`
            : `${formatEventDate(c.startAt)} · ${formatEventTime(c.startAt)} – ${formatEventTime(c.endAt)}`

          return (
            <div key={c.eventId} className="space-y-0.5">
              <p className="text-xs font-black uppercase tracking-wider text-rose-700">
                {conflictTitle}
              </p>
              <p className="text-[11px] font-semibold text-rose-700 leading-snug">
                {description}
              </p>
              <p className="text-xs font-black text-rose-950 truncate">
                {c.title}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
