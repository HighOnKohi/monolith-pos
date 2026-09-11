// ─── Restaurant Event Types & Definitions ──────────────────────────────────────

export type EventCategory =
  | 'Private Event'
  | 'Birthday'
  | 'Corporate Event'
  | 'Meeting'
  | 'Reservation'
  | 'Catering'
  | 'Promotion'
  | 'Holiday'
  | 'Other'

export const EVENT_CATEGORIES: EventCategory[] = [
  'Private Event',
  'Birthday',
  'Corporate Event',
  'Meeting',
  'Reservation',
  'Catering',
  'Promotion',
  'Holiday',
  'Other',
]

/**
 * Event status:
 * - Scheduled  → future events (not yet started)
 * - Ongoing    → currently happening
 * - Completed  → end time has passed
 * - Cancelled  → explicitly set by user (IS_CANCELLED = true)
 *
 * Scheduled / Ongoing / Completed are derived from timestamps at render time.
 * Only Cancelled is persisted in the database.
 */
export type EventStatus = 'Scheduled' | 'Ongoing' | 'Completed' | 'Cancelled'

export interface RestaurantEvent {
  eventId: number
  title: string
  description?: string | null
  category: EventCategory
  color?: string | null
  startAt: string // ISO timestamp
  endAt: string   // ISO timestamp
  location?: string | null
  organizer?: string | null
  maxPax?: number | null
  expectedAttendees?: number | null // alias for backwards compatibility
  presetId?: number | null         // linked Table_Layout_Presets ID
  contactName?: string | null
  contactPhone?: string | null
  contactEmail?: string | null
  notes?: string | null
  isCancelled: boolean
  createdBy?: string | null
  createdAt: string
  updatedAt: string
  updatedBy?: string | null
  deletedAt?: string | null
}

// ─── Form Data ─────────────────────────────────────────────────────────────────

export interface EventFormData {
  title: string
  description: string
  category: EventCategory
  color: string
  startDate: string  // 'YYYY-MM-DD'
  startTime: string  // 'HH:MM'
  endDate: string    // 'YYYY-MM-DD'
  endTime: string    // 'HH:MM'
  location: string
  organizer: string
  maxPax: string     // string for input, parsed to int on save (default: 50)
  expectedAttendees?: string // deprecated alias
  presetId?: number | null   // linked layout preset ID
  contactName: string
  contactPhone: string
  contactEmail: string
  notes: string
}

export const EVENT_FORM_DEFAULTS: EventFormData = {
  title: '',
  description: '',
  category: 'Other',
  color: '',
  startDate: '',
  startTime: '09:00',
  endDate: '',
  endTime: '17:00',
  location: 'Bill Shaw Restaurant',
  organizer: '',
  maxPax: '50',
  expectedAttendees: '50',
  presetId: null,
  contactName: '',
  contactPhone: '',
  contactEmail: '',
  notes: '',
}

// ─── Filter Params ─────────────────────────────────────────────────────────────

export type EventDateFilter = 'all' | 'today' | 'this_week' | 'this_month' | 'upcoming'

export interface EventFilterParams {
  searchQuery: string
  status: EventStatus | 'All'
  category: EventCategory | 'All'
  dateFilter: EventDateFilter
}

export const EVENT_FILTER_DEFAULTS: EventFilterParams = {
  searchQuery: '',
  status: 'All',
  category: 'All',
  dateFilter: 'all',
}

// ─── Conflict Info ─────────────────────────────────────────────────────────────

export interface EventConflict {
  eventId: number
  title: string
  startAt: string
  endAt: string
}
