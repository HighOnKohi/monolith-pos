// ─── Event Utilities ───────────────────────────────────────────────────────────

import type { RestaurantEvent, EventStatus, EventCategory, EventFilterParams } from '@/types/event'

export type EventCardType = 'total' | 'upcoming' | 'today' | 'thisWeek' | 'ongoing'

// ─── Status Derivation ─────────────────────────────────────────────────────────

/**
 * Derives the display status of an event from its timestamps and cancellation flag.
 * Only 'Cancelled' is stored in the DB; the rest are computed.
 */
export function deriveEventStatus(event: RestaurantEvent): EventStatus {
  if (event.isCancelled) return 'Cancelled'
  const now = Date.now()
  const start = new Date(event.startAt).getTime()
  const end = new Date(event.endAt).getTime()
  if (now < start) return 'Scheduled'
  if (now >= start && now <= end) return 'Ongoing'
  return 'Completed'
}

// ─── Status Badge Styles ───────────────────────────────────────────────────────

export function getEventStatusBadge(status: EventStatus): {
  bg: string
  text: string
  border: string
  dot: string
} {
  switch (status) {
    case 'Scheduled':
      return { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' }
    case 'Ongoing':
      return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' }
    case 'Completed':
      return { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200', dot: 'bg-slate-400' }
    case 'Cancelled':
      return { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', dot: 'bg-rose-500' }
  }
}

// ─── Category Colors ───────────────────────────────────────────────────────────

export const CATEGORY_COLORS: Record<EventCategory, string> = {
  'Private Event':    '#6366f1', // indigo
  'Birthday':         '#ec4899', // pink
  'Corporate Event':  '#14274E', // brand primary
  'Meeting':          '#64748b', // slate
  'Reservation':      '#0891b2', // cyan
  'Catering':         '#d97706', // amber
  'Promotion':        '#16a34a', // green
  'Holiday':          '#dc2626', // red
  'Other':            '#9ca3af', // gray
}

export function getCategoryColor(category: EventCategory | string): string {
  return CATEGORY_COLORS[category as EventCategory] ?? '#9ca3af'
}

// ─── Duration Formatting ───────────────────────────────────────────────────────

export function formatEventDuration(startAt: string, endAt: string): string {
  const startMs = new Date(startAt).getTime()
  const endMs = new Date(endAt).getTime()
  const diffMs = endMs - startMs

  if (diffMs <= 0) return '—'

  const totalMinutes = Math.round(diffMs / (1000 * 60))
  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
  const minutes = totalMinutes % 60

  const parts: string[] = []
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0 && days === 0) parts.push(`${minutes}min`)

  return parts.join(' ') || '< 1min'
}

// ─── Date / Time Formatting ────────────────────────────────────────────────────

export function formatEventDate(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatEventTime(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

export function formatEventDateRange(startAt: string, endAt: string): string {
  const start = new Date(startAt)
  const end = new Date(endAt)
  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate()

  if (sameDay) {
    return `${formatEventDate(startAt)}, ${formatEventTime(startAt)} – ${formatEventTime(endAt)}`
  }
  return `${formatEventDate(startAt)} – ${formatEventDate(endAt)}`
}

// ─── ISO date/time helpers for form ───────────────────────────────────────────

export function isoToDateInput(isoString: string): string {
  // Returns 'YYYY-MM-DD' in local time
  const d = new Date(isoString)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function isoToTimeInput(isoString: string): string {
  // Returns 'HH:MM' in local time
  const d = new Date(isoString)
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

// ─── Summary Stats ─────────────────────────────────────────────────────────────

export interface EventSummaryStats {
  total: number
  upcoming: number
  today: number
  thisWeek: number
  ongoing: number
}

export function computeEventStats(events: RestaurantEvent[]): EventSummaryStats {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1)

  // Week bounds (Mon–Sun)
  const dayOfWeek = now.getDay()
  const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() + diffToMon)
  weekStart.setHours(0, 0, 0, 0)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  weekEnd.setHours(23, 59, 59, 999)

  let upcoming = 0
  let today = 0
  let thisWeek = 0
  let ongoing = 0

  for (const event of events) {
    if (event.isCancelled) continue
    const status = deriveEventStatus(event)
    const startMs = new Date(event.startAt).getTime()
    const endMs = new Date(event.endAt).getTime()

    if (status === 'Ongoing') ongoing++
    if (status === 'Scheduled') upcoming++
    if (startMs >= todayStart.getTime() && startMs <= todayEnd.getTime()) today++
    if (startMs >= weekStart.getTime() && startMs <= weekEnd.getTime()) thisWeek++
    // Multi-day events that are ongoing but started before today still count as today
    if (status === 'Ongoing' && endMs >= todayStart.getTime()) today = Math.max(today, 0)
  }

  return {
    total: events.length,
    upcoming,
    today,
    thisWeek,
    ongoing,
  }
}

// ─── Calendar Helpers ──────────────────────────────────────────────────────────

/**
 * Returns all events that occur on a specific calendar date (local time).
 * An event appears on a date if its start or end day falls on it,
 * or if it spans across that date.
 */
export function getEventsForDate(events: RestaurantEvent[], date: Date): RestaurantEvent[] {
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  const dayEnd = dayStart + 24 * 60 * 60 * 1000 - 1

  return events.filter((e) => {
    const startMs = new Date(e.startAt).getTime()
    const endMs = new Date(e.endAt).getTime()
    // Overlaps with the day
    return startMs <= dayEnd && endMs >= dayStart
  })
}

/**
 * Returns the grid cells for a calendar month view.
 * Each cell is a Date object (may include padding days from prev/next months).
 */
export function getCalendarGrid(year: number, month: number): Date[] {
  // month is 0-indexed
  const firstOfMonth = new Date(year, month, 1)
  const lastOfMonth = new Date(year, month + 1, 0)

  // Start grid from Monday
  const startDayOfWeek = firstOfMonth.getDay() // 0=Sun
  const startOffset = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1

  const cells: Date[] = []

  // Pad from previous month
  for (let i = startOffset; i > 0; i--) {
    cells.push(new Date(year, month, 1 - i))
  }

  // Current month
  for (let d = 1; d <= lastOfMonth.getDate(); d++) {
    cells.push(new Date(year, month, d))
  }

  // Pad to complete the last row (total cells must be multiple of 7)
  let nextMonthDay = 1
  while (cells.length % 7 !== 0) {
    cells.push(new Date(year, month + 1, nextMonthDay++))
  }

  return cells
}

/**
 * Filters events based on user-selected filter parameters.
 * Aligns strictly with computeEventStats so summary card counts match filtered lists 1:1.
 */
export function filterEvents(
  events: RestaurantEvent[],
  filters: EventFilterParams,
): RestaurantEvent[] {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const todayEnd = todayStart + 24 * 60 * 60 * 1000 - 1

  const dayOfWeek = now.getDay()
  const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() + diffToMon)
  weekStart.setHours(0, 0, 0, 0)
  const weekStartMs = weekStart.getTime()
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  weekEnd.setHours(23, 59, 59, 999)
  const weekEndMs = weekEnd.getTime()

  const monthStartMs = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0).getTime()
  const monthEndMs = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).getTime()

  return events.filter((event) => {
    // 1. Status Filter
    if (filters.status !== 'All') {
      if (deriveEventStatus(event) !== filters.status) return false
    }

    // 2. Category Filter
    if (filters.category !== 'All') {
      if (event.category !== filters.category) return false
    }

    // 3. Search Query Filter
    if (filters.searchQuery.trim()) {
      const q = filters.searchQuery.toLowerCase()
      const matches =
        event.title.toLowerCase().includes(q) ||
        (event.description ?? '').toLowerCase().includes(q) ||
        (event.location ?? '').toLowerCase().includes(q) ||
        (event.organizer ?? '').toLowerCase().includes(q) ||
        event.category.toLowerCase().includes(q)
      if (!matches) return false
    }

    // 4. Date Filter
    if (filters.dateFilter !== 'all') {
      const startMs = new Date(event.startAt).getTime()
      const endMs = new Date(event.endAt).getTime()

      if (filters.dateFilter === 'today') {
        const isToday =
          (startMs >= todayStart && startMs <= todayEnd) ||
          (startMs <= todayEnd && endMs >= todayStart)
        if (!isToday) return false
      } else if (filters.dateFilter === 'this_week') {
        const isThisWeek =
          (startMs >= weekStartMs && startMs <= weekEndMs) ||
          (startMs <= weekEndMs && endMs >= weekStartMs)
        if (!isThisWeek) return false
      } else if (filters.dateFilter === 'this_month') {
        const isThisMonth =
          (startMs >= monthStartMs && startMs <= monthEndMs) ||
          (startMs <= monthEndMs && endMs >= monthStartMs)
        if (!isThisMonth) return false
      } else if (filters.dateFilter === 'upcoming') {
        const isUpcoming = endMs >= now.getTime() && !event.isCancelled
        if (!isUpcoming) return false
      }
    }

    return true
  })
}
