import React from 'react'
import { AlertTriangle } from 'lucide-react'
import type { EventConflict } from '@/types/event'
import { formatEventDate, formatEventTime } from '../utils/eventUtils'

interface EventConflictBannerProps {
  conflicts: EventConflict[]
}

export const EventConflictBanner: React.FC<EventConflictBannerProps> = ({ conflicts }) => {
  if (conflicts.length === 0) return null

  return (
    <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-xs">
      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
      <div className="text-amber-800">
        <p className="font-black mb-1">Time Conflict Detected</p>
        <ul className="space-y-0.5">
          {conflicts.map((c) => (
            <li key={c.eventId} className="font-medium">
              Overlaps with <span className="font-black">"{c.title}"</span>{' '}
              ({formatEventDate(c.startAt)}, {formatEventTime(c.startAt)} – {formatEventTime(c.endAt)})
            </li>
          ))}
        </ul>
        <p className="mt-1.5 text-amber-700 font-medium">
          You can still save — this is a warning, not a block.
        </p>
      </div>
    </div>
  )
}
