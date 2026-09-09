// ─── Event Service ─────────────────────────────────────────────────────────────
//
// All interactions with the Restaurant_Events table.
// Soft deletion: DELETED_AT timestamp is set instead of removing rows.
// Status (Scheduled/Ongoing/Completed) is computed at the application layer.
// Includes transparent fallback to localStorage if Supabase table is not yet migrated.

import { supabase } from '@/lib/supabase'
import type {
  RestaurantEvent,
  EventFormData,
  EventFilterParams,
  EventConflict,
  EventDateFilter,
} from '@/types/event'

const LOCAL_STORAGE_KEY = 'monolith_restaurant_events_fallback'
let isUsingFallbackStorage = false

export function isEventServiceUsingFallback(): boolean {
  return isUsingFallbackStorage
}

// ─── Seed Data for Fallback Mode ──────────────────────────────────────────────

function getInitialSeedEvents(): RestaurantEvent[] {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const dateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

  const today = new Date(now)
  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)
  const inThreeDays = new Date(now)
  inThreeDays.setDate(now.getDate() + 3)

  return [
    {
      eventId: 1001,
      title: 'Chef Special Tasting & Wine Pairing',
      description: 'Exclusive 5-course tasting menu paired with regional artisan wines.',
      category: 'Promotion',
      color: '#16a34a',
      startAt: `${dateStr(today)}T18:00:00.000Z`,
      endAt: `${dateStr(today)}T21:00:00.000Z`,
      location: 'Main Dining Room',
      organizer: 'Chef Marco',
      expectedAttendees: 24,
      contactName: 'Marco Bellini',
      contactPhone: '+1 555-0192',
      contactEmail: 'chef.marco@monolithpos.local',
      notes: 'Prepare welcome glasses of sparkling wine at arrival.',
      isCancelled: false,
      createdBy: 'admin@monolith.pos',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      updatedBy: null,
      deletedAt: null,
    },
    {
      eventId: 1002,
      title: 'Private Birthday Dinner — Smith Family',
      description: 'Milestone 40th birthday celebration with customized dessert cake.',
      category: 'Birthday',
      color: '#ec4899',
      startAt: `${dateStr(tomorrow)}T17:30:00.000Z`,
      endAt: `${dateStr(tomorrow)}T21:00:00.000Z`,
      location: 'Private Dining Suite A',
      organizer: 'Sarah Smith',
      expectedAttendees: 16,
      contactName: 'Sarah Smith',
      contactPhone: '+1 555-0144',
      contactEmail: 'sarah.smith@example.com',
      notes: 'Cake delivery scheduled for 16:30. Store in kitchen chiller.',
      isCancelled: false,
      createdBy: 'manager@monolith.pos',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      updatedBy: null,
      deletedAt: null,
    },
    {
      eventId: 1003,
      title: 'Corporate Executive Luncheon',
      description: 'Quarterly business review luncheon with pre-set three-course menu.',
      category: 'Corporate Event',
      color: '#14274E',
      startAt: `${dateStr(inThreeDays)}T12:00:00.000Z`,
      endAt: `${dateStr(inThreeDays)}T14:30:00.000Z`,
      location: 'Executive Terrace',
      organizer: 'Nexus Dynamics',
      expectedAttendees: 30,
      contactName: 'David Zhang',
      contactPhone: '+1 555-0188',
      contactEmail: 'events@nexusdyn.local',
      notes: 'Projector and AV screen setup required by 11:30 AM.',
      isCancelled: false,
      createdBy: 'admin@monolith.pos',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      updatedBy: null,
      deletedAt: null,
    },
  ]
}

function getFallbackEvents(): RestaurantEvent[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch (err) {
    console.warn('[eventService] Failed to read fallback localStorage:', err)
  }
  const initial = getInitialSeedEvents()
  saveFallbackEvents(initial)
  return initial
}

function saveFallbackEvents(events: RestaurantEvent[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(events))
  } catch (err) {
    console.warn('[eventService] Failed to write fallback localStorage:', err)
  }
}

// ─── DB Row → Domain Object ────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(row: Record<string, any>): RestaurantEvent {
  return {
    eventId: row['EVENT_ID'],
    title: row['TITLE'],
    description: row['DESCRIPTION'] ?? null,
    category: row['CATEGORY'],
    color: row['COLOR'] ?? null,
    startAt: row['START_AT'],
    endAt: row['END_AT'],
    location: row['LOCATION'] ?? null,
    organizer: row['ORGANIZER'] ?? null,
    expectedAttendees: row['EXPECTED_ATTENDEES'] ?? null,
    contactName: row['CONTACT_NAME'] ?? null,
    contactPhone: row['CONTACT_PHONE'] ?? null,
    contactEmail: row['CONTACT_EMAIL'] ?? null,
    notes: row['NOTES'] ?? null,
    isCancelled: row['IS_CANCELLED'] ?? false,
    createdBy: row['CREATED_BY'] ?? null,
    createdAt: row['CREATED_AT'],
    updatedAt: row['UPDATED_AT'],
    updatedBy: row['UPDATED_BY'] ?? null,
    deletedAt: row['DELETED_AT'] ?? null,
  }
}

// ─── Date Filter Helper ────────────────────────────────────────────────────────

function getDateFilterRange(filter: EventDateFilter): { start: Date | null; end: Date | null } {
  const now = new Date()

  if (filter === 'today') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
    return { start, end }
  }

  if (filter === 'this_week') {
    const day = now.getDay()
    const diffToMon = (day === 0 ? -6 : 1 - day)
    const start = new Date(now)
    start.setDate(now.getDate() + diffToMon)
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    end.setHours(23, 59, 59, 999)
    return { start, end }
  }

  if (filter === 'this_month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0)
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
    return { start, end }
  }

  if (filter === 'upcoming') {
    return { start: now, end: null }
  }

  return { start: null, end: null }
}

function filterEventsList(events: RestaurantEvent[], filters?: Partial<EventFilterParams>): RestaurantEvent[] {
  let result = events.filter((e) => !e.deletedAt)

  if (filters?.dateFilter && filters.dateFilter !== 'all') {
    const { start, end } = getDateFilterRange(filters.dateFilter)
    result = result.filter((e) => {
      const eStart = new Date(e.startAt).getTime()
      if (start && eStart < start.getTime()) return false
      if (end && eStart > end.getTime()) return false
      return true
    })
  }

  if (filters?.searchQuery?.trim()) {
    const q = filters.searchQuery.toLowerCase()
    result = result.filter((e) =>
      e.title.toLowerCase().includes(q) ||
      (e.description ?? '').toLowerCase().includes(q) ||
      (e.location ?? '').toLowerCase().includes(q) ||
      (e.organizer ?? '').toLowerCase().includes(q) ||
      e.category.toLowerCase().includes(q),
    )
  }

  if (filters?.category && filters.category !== 'All') {
    result = result.filter((e) => e.category === filters.category)
  }

  return result.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
}

// ─── Fetch Events ──────────────────────────────────────────────────────────────

export async function fetchEvents(filters?: Partial<EventFilterParams>): Promise<RestaurantEvent[]> {
  try {
    let query = supabase
      .from('Restaurant_Events')
      .select('*')
      .is('DELETED_AT', null)
      .order('START_AT', { ascending: true })

    if (filters?.dateFilter && filters.dateFilter !== 'all') {
      const { start, end } = getDateFilterRange(filters.dateFilter)
      if (start) query = query.gte('START_AT', start.toISOString())
      if (end) query = query.lte('START_AT', end.toISOString())
    }

    const { data, error } = await query

    if (error) {
      throw error
    }

    isUsingFallbackStorage = false

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let events: RestaurantEvent[] = (data ?? []).map((row: any) => mapRow(row))

    if (filters?.searchQuery?.trim()) {
      const q = filters.searchQuery.toLowerCase()
      events = events.filter((e) =>
        e.title.toLowerCase().includes(q) ||
        (e.description ?? '').toLowerCase().includes(q) ||
        (e.location ?? '').toLowerCase().includes(q) ||
        (e.organizer ?? '').toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q),
      )
    }

    if (filters?.category && filters.category !== 'All') {
      events = events.filter((e) => e.category === filters.category)
    }

    return events
  } catch (err) {
    console.warn('[eventService] Supabase Restaurant_Events unavailable, using localStorage fallback:', err)
    isUsingFallbackStorage = true
    const fallbackAll = getFallbackEvents()
    return filterEventsList(fallbackAll, filters)
  }
}

// ─── Create Event ──────────────────────────────────────────────────────────────

export async function createEvent(
  data: EventFormData,
  userEmail?: string | null,
): Promise<RestaurantEvent> {
  const startAt = new Date(`${data.startDate}T${data.startTime}`).toISOString()
  const endAt = new Date(`${data.endDate}T${data.endTime}`).toISOString()

  try {
    const { data: row, error } = await supabase
      .from('Restaurant_Events')
      .insert({
        TITLE: data.title.trim(),
        DESCRIPTION: data.description.trim() || null,
        CATEGORY: data.category,
        COLOR: data.color || null,
        START_AT: startAt,
        END_AT: endAt,
        LOCATION: data.location.trim() || null,
        ORGANIZER: data.organizer.trim() || null,
        EXPECTED_ATTENDEES: data.expectedAttendees ? parseInt(data.expectedAttendees, 10) : null,
        CONTACT_NAME: data.contactName.trim() || null,
        CONTACT_PHONE: data.contactPhone.trim() || null,
        CONTACT_EMAIL: data.contactEmail.trim() || null,
        NOTES: data.notes.trim() || null,
        IS_CANCELLED: false,
        CREATED_BY: userEmail ?? null,
        UPDATED_BY: userEmail ?? null,
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    isUsingFallbackStorage = false
    return mapRow(row)
  } catch (err) {
    console.warn('[eventService] Supabase createEvent failed, saving to localStorage fallback:', err)
    isUsingFallbackStorage = true
    const fallbackAll = getFallbackEvents()
    const newId = Date.now()
    const newEvent: RestaurantEvent = {
      eventId: newId,
      title: data.title.trim(),
      description: data.description.trim() || null,
      category: data.category,
      color: data.color || null,
      startAt,
      endAt,
      location: data.location.trim() || null,
      organizer: data.organizer.trim() || null,
      expectedAttendees: data.expectedAttendees ? parseInt(data.expectedAttendees, 10) : null,
      contactName: data.contactName.trim() || null,
      contactPhone: data.contactPhone.trim() || null,
      contactEmail: data.contactEmail.trim() || null,
      notes: data.notes.trim() || null,
      isCancelled: false,
      createdBy: userEmail ?? 'staff@monolith.pos',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      updatedBy: userEmail ?? null,
      deletedAt: null,
    }
    fallbackAll.push(newEvent)
    saveFallbackEvents(fallbackAll)
    return newEvent
  }
}

// ─── Update Event ──────────────────────────────────────────────────────────────

export async function updateEvent(
  eventId: number,
  data: EventFormData,
  userEmail?: string | null,
): Promise<RestaurantEvent> {
  const startAt = new Date(`${data.startDate}T${data.startTime}`).toISOString()
  const endAt = new Date(`${data.endDate}T${data.endTime}`).toISOString()

  try {
    const { data: row, error } = await supabase
      .from('Restaurant_Events')
      .update({
        TITLE: data.title.trim(),
        DESCRIPTION: data.description.trim() || null,
        CATEGORY: data.category,
        COLOR: data.color || null,
        START_AT: startAt,
        END_AT: endAt,
        LOCATION: data.location.trim() || null,
        ORGANIZER: data.organizer.trim() || null,
        EXPECTED_ATTENDEES: data.expectedAttendees ? parseInt(data.expectedAttendees, 10) : null,
        CONTACT_NAME: data.contactName.trim() || null,
        CONTACT_PHONE: data.contactPhone.trim() || null,
        CONTACT_EMAIL: data.contactEmail.trim() || null,
        NOTES: data.notes.trim() || null,
        UPDATED_AT: new Date().toISOString(),
        UPDATED_BY: userEmail ?? null,
      })
      .eq('EVENT_ID', eventId)
      .select()
      .single()

    if (error) {
      throw error
    }

    isUsingFallbackStorage = false
    return mapRow(row)
  } catch (err) {
    console.warn('[eventService] Supabase updateEvent failed, updating in localStorage fallback:', err)
    isUsingFallbackStorage = true
    const fallbackAll = getFallbackEvents()
    const index = fallbackAll.findIndex((e) => e.eventId === eventId)
    if (index === -1) {
      throw new Error('Event not found in fallback storage.')
    }
    const updated: RestaurantEvent = {
      ...fallbackAll[index],
      title: data.title.trim(),
      description: data.description.trim() || null,
      category: data.category,
      color: data.color || null,
      startAt,
      endAt,
      location: data.location.trim() || null,
      organizer: data.organizer.trim() || null,
      expectedAttendees: data.expectedAttendees ? parseInt(data.expectedAttendees, 10) : null,
      contactName: data.contactName.trim() || null,
      contactPhone: data.contactPhone.trim() || null,
      contactEmail: data.contactEmail.trim() || null,
      notes: data.notes.trim() || null,
      updatedAt: new Date().toISOString(),
      updatedBy: userEmail ?? null,
    }
    fallbackAll[index] = updated
    saveFallbackEvents(fallbackAll)
    return updated
  }
}

// ─── Cancel Event ──────────────────────────────────────────────────────────────

export async function cancelEvent(eventId: number, userEmail?: string | null): Promise<void> {
  try {
    const { error } = await supabase
      .from('Restaurant_Events')
      .update({
        IS_CANCELLED: true,
        UPDATED_AT: new Date().toISOString(),
        UPDATED_BY: userEmail ?? null,
      })
      .eq('EVENT_ID', eventId)

    if (error) throw error
    isUsingFallbackStorage = false
  } catch (err) {
    console.warn('[eventService] Supabase cancelEvent failed, cancelling in localStorage fallback:', err)
    isUsingFallbackStorage = true
    const fallbackAll = getFallbackEvents()
    const index = fallbackAll.findIndex((e) => e.eventId === eventId)
    if (index !== -1) {
      fallbackAll[index].isCancelled = true
      fallbackAll[index].updatedAt = new Date().toISOString()
      fallbackAll[index].updatedBy = userEmail ?? null
      saveFallbackEvents(fallbackAll)
    }
  }
}

// ─── Soft Delete Event ─────────────────────────────────────────────────────────

export async function deleteEvent(eventId: number, userEmail?: string | null): Promise<void> {
  try {
    const { error } = await supabase
      .from('Restaurant_Events')
      .update({
        DELETED_AT: new Date().toISOString(),
        UPDATED_AT: new Date().toISOString(),
        UPDATED_BY: userEmail ?? null,
      })
      .eq('EVENT_ID', eventId)

    if (error) throw error
    isUsingFallbackStorage = false
  } catch (err) {
    console.warn('[eventService] Supabase deleteEvent failed, soft-deleting in localStorage fallback:', err)
    isUsingFallbackStorage = true
    const fallbackAll = getFallbackEvents()
    const index = fallbackAll.findIndex((e) => e.eventId === eventId)
    if (index !== -1) {
      fallbackAll[index].deletedAt = new Date().toISOString()
      fallbackAll[index].updatedAt = new Date().toISOString()
      fallbackAll[index].updatedBy = userEmail ?? null
      saveFallbackEvents(fallbackAll)
    }
  }
}

// ─── Check Conflicts ───────────────────────────────────────────────────────────

export async function checkEventConflicts(
  startAt: string,
  endAt: string,
  excludeEventId?: number,
): Promise<EventConflict[]> {
  try {
    let query = supabase
      .from('Restaurant_Events')
      .select('EVENT_ID, TITLE, START_AT, END_AT')
      .is('DELETED_AT', null)
      .eq('IS_CANCELLED', false)
      // Overlap condition: existing.start < new.end AND existing.end > new.start
      .lt('START_AT', endAt)
      .gt('END_AT', startAt)

    if (excludeEventId) {
      query = query.neq('EVENT_ID', excludeEventId)
    }

    const { data, error } = await query

    if (error) throw error

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data ?? []).map((row: any) => ({
      eventId: row['EVENT_ID'],
      title: row['TITLE'],
      startAt: row['START_AT'],
      endAt: row['END_AT'],
    }))
  } catch {
    // Check in fallback localStorage
    const fallbackAll = getFallbackEvents()
    const newStart = new Date(startAt).getTime()
    const newEnd = new Date(endAt).getTime()

    return fallbackAll
      .filter((e) => {
        if (e.deletedAt || e.isCancelled) return false
        if (excludeEventId && e.eventId === excludeEventId) return false
        const eStart = new Date(e.startAt).getTime()
        const eEnd = new Date(e.endAt).getTime()
        return eStart < newEnd && eEnd > newStart
      })
      .map((e) => ({
        eventId: e.eventId,
        title: e.title,
        startAt: e.startAt,
        endAt: e.endAt,
      }))
  }
}
