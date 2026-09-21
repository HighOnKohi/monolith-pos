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
  // Read PRESET_ID from column or fallback tag in NOTES: "[PRESET_ID:123]"
  let presetId: number | null = row['PRESET_ID'] != null ? Number(row['PRESET_ID']) : null
  let menuPresetId: number | null = row['MENU_PRESET_ID'] != null ? Number(row['MENU_PRESET_ID']) : null
  let isActive = Boolean(row['IS_ACTIVE'])

  const notes = row['NOTES'] ?? null
  if (typeof notes === 'string') {
    if (presetId == null) {
      const matchP = notes.match(/\[PRESET_ID:(\d+)\]/)
      if (matchP) presetId = Number(matchP[1])
    }
    if (menuPresetId == null) {
      const matchM = notes.match(/\[MENU_PRESET_ID:(\d+)\]/)
      if (matchM) menuPresetId = Number(matchM[1])
    }
    if (!isActive && notes.includes('[IS_ACTIVE:true]')) {
      isActive = true
    }
  }

  // Also check local storage active event ID
  if (typeof window !== 'undefined') {
    const activeStoredId = localStorage.getItem('monolith_active_event_id')
    if (activeStoredId && String(row['EVENT_ID']) === activeStoredId) {
      isActive = true
    }
  }

  const pax = row['EXPECTED_ATTENDEES'] != null ? Number(row['EXPECTED_ATTENDEES']) : null

  return {
    eventId: row['EVENT_ID'],
    title: row['TITLE'],
    description: row['DESCRIPTION'] ?? null,
    category: row['CATEGORY'],
    color: row['COLOR'] ?? null,
    startAt: row['START_AT'],
    endAt: row['END_AT'],
    location: row['LOCATION'] ?? 'Bill Shaw Restaurant',
    organizer: row['ORGANIZER'] ?? null,
    maxPax: pax,
    expectedAttendees: pax,
    presetId,
    menuPresetId,
    isActive,
    contactName: row['CONTACT_NAME'] ?? null,
    contactPhone: row['CONTACT_PHONE'] ?? null,
    contactEmail: row['CONTACT_EMAIL'] ?? null,
    notes,
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

// ─── Duplicate Title Check ────────────────────────────────────────────────────

export async function checkDuplicateEventTitle(
  title: string,
  startDateStr: string,
  excludeEventId?: number,
): Promise<RestaurantEvent | null> {
  const normTitle = title.trim().toLowerCase()
  if (!normTitle || !startDateStr) return null

  try {
    let query = supabase
      .from('Restaurant_Events')
      .select('*')
      .is('DELETED_AT', null)
      .eq('IS_CANCELLED', false)
      .gte('START_AT', `${startDateStr}T00:00:00`)
      .lte('START_AT', `${startDateStr}T23:59:59.999Z`)

    if (excludeEventId) {
      query = query.neq('EVENT_ID', excludeEventId)
    }

    const { data } = await query
    const match = (data ?? []).find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (r: any) => String(r['TITLE'] || '').trim().toLowerCase() === normTitle,
    )
    if (match) return mapRow(match)
  } catch {
    // Check in fallback
  }

  const fallbackAll = getFallbackEvents()
  const matchFallback = fallbackAll.find((e) => {
    if (e.deletedAt || e.isCancelled) return false
    if (excludeEventId && e.eventId === excludeEventId) return false
    const eDate = e.startAt.slice(0, 10)
    return eDate === startDateStr && e.title.trim().toLowerCase() === normTitle
  })

  return matchFallback ?? null
}

// ─── Create Event ──────────────────────────────────────────────────────────────

export async function createEvent(
  data: EventFormData,
  userEmail?: string | null,
): Promise<RestaurantEvent> {
  const startAt = new Date(`${data.startDate}T${data.startTime}`).toISOString()
  const endAt = new Date(`${data.endDate}T${data.endTime}`).toISOString()

  // 1. Prevention of multiple events at the same time
  const conflicts = await checkEventConflicts(startAt, endAt)
  if (conflicts.length > 0) {
    throw new Error(
      `Cannot create event: time overlaps with "${conflicts[0].title}". Simultaneous events are not permitted.`,
    )
  }

  // 2. Duplication prevention: check for duplicate title on the same start date
  const duplicate = await checkDuplicateEventTitle(data.title, data.startDate)
  if (duplicate) {
    throw new Error(
      `An event titled "${data.title.trim()}" is already scheduled on this date. Please use a unique title.`,
    )
  }

  const maxPaxVal = data.maxPax
    ? parseInt(data.maxPax, 10)
    : (data.expectedAttendees ? parseInt(data.expectedAttendees, 10) : 50)

  let notesVal = data.notes.trim() || null
  const tags: string[] = []
  if (data.presetId) tags.push(`[PRESET_ID:${data.presetId}]`)
  if (data.menuPresetId) tags.push(`[MENU_PRESET_ID:${data.menuPresetId}]`)
  if (data.isActive) tags.push('[IS_ACTIVE:true]')

  if (tags.length > 0) {
    const cleanNotes = (notesVal || '').replace(/\[(PRESET_ID|MENU_PRESET_ID|IS_ACTIVE):[^\]]+\]/g, '').trim()
    notesVal = cleanNotes ? `${cleanNotes}\n${tags.join('\n')}` : tags.join('\n')
  }

  try {
    const insertObj: Record<string, unknown> = {
      TITLE: data.title.trim(),
      DESCRIPTION: data.description.trim() || null,
      CATEGORY: data.category,
      COLOR: data.color || null,
      START_AT: startAt,
      END_AT: endAt,
      LOCATION: data.location.trim() || 'Bill Shaw Restaurant',
      ORGANIZER: data.organizer.trim() || null,
      EXPECTED_ATTENDEES: maxPaxVal,
      CONTACT_NAME: data.contactName.trim() || null,
      CONTACT_PHONE: data.contactPhone.trim() || null,
      CONTACT_EMAIL: data.contactEmail.trim() || null,
      NOTES: notesVal,
      IS_CANCELLED: false,
      CREATED_BY: userEmail ?? null,
      UPDATED_BY: userEmail ?? null,
    }

    if (data.presetId != null) insertObj['PRESET_ID'] = data.presetId
    if (data.menuPresetId != null) insertObj['MENU_PRESET_ID'] = data.menuPresetId
    if (data.isActive != null) insertObj['IS_ACTIVE'] = data.isActive

    let res = await supabase.from('Restaurant_Events').insert(insertObj).select().single()

    if (res.error) {
      // Remove optional columns if not present in schema
      delete insertObj['PRESET_ID']
      delete insertObj['MENU_PRESET_ID']
      delete insertObj['IS_ACTIVE']
      res = await supabase.from('Restaurant_Events').insert(insertObj).select().single()
    }

    if (res.error) throw res.error

    isUsingFallbackStorage = false
    const mapped = mapRow(res.data)

    return mapped
  } catch (err) {
    console.warn('[eventService] Supabase createEvent fallback:', err)
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
      location: data.location.trim() || 'Bill Shaw Restaurant',
      organizer: data.organizer.trim() || null,
      maxPax: maxPaxVal,
      expectedAttendees: maxPaxVal,
      presetId: data.presetId ?? null,
      menuPresetId: data.menuPresetId ?? null,
      isActive: Boolean(data.isActive),
      contactName: data.contactName.trim() || null,
      contactPhone: data.contactPhone.trim() || null,
      contactEmail: data.contactEmail.trim() || null,
      notes: notesVal,
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

  // 1. Prevention of multiple events at the same time
  const conflicts = await checkEventConflicts(startAt, endAt, eventId)
  if (conflicts.length > 0) {
    throw new Error(
      `Cannot update event: time overlaps with "${conflicts[0].title}". Simultaneous events are not permitted.`,
    )
  }

  // 2. Duplication prevention: check for duplicate title on the same start date
  const duplicate = await checkDuplicateEventTitle(data.title, data.startDate, eventId)
  if (duplicate) {
    throw new Error(
      `An event titled "${data.title.trim()}" is already scheduled on this date. Please use a unique title.`,
    )
  }

  const maxPaxVal = data.maxPax
    ? parseInt(data.maxPax, 10)
    : (data.expectedAttendees ? parseInt(data.expectedAttendees, 10) : 50)

  let notesVal = data.notes.trim() || null
  const tags: string[] = []
  if (data.presetId) tags.push(`[PRESET_ID:${data.presetId}]`)
  if (data.menuPresetId) tags.push(`[MENU_PRESET_ID:${data.menuPresetId}]`)
  if (data.isActive) tags.push('[IS_ACTIVE:true]')

  const cleanNotes = (notesVal || '').replace(/\[(PRESET_ID|MENU_PRESET_ID|IS_ACTIVE):[^\]]+\]/g, '').trim()
  notesVal = tags.length > 0 ? (cleanNotes ? `${cleanNotes}\n${tags.join('\n')}` : tags.join('\n')) : (cleanNotes || null)

  try {
    const updateObj: Record<string, unknown> = {
      TITLE: data.title.trim(),
      DESCRIPTION: data.description.trim() || null,
      CATEGORY: data.category,
      COLOR: data.color || null,
      START_AT: startAt,
      END_AT: endAt,
      LOCATION: data.location.trim() || 'Bill Shaw Restaurant',
      ORGANIZER: data.organizer.trim() || null,
      EXPECTED_ATTENDEES: maxPaxVal,
      CONTACT_NAME: data.contactName.trim() || null,
      CONTACT_PHONE: data.contactPhone.trim() || null,
      CONTACT_EMAIL: data.contactEmail.trim() || null,
      NOTES: notesVal,
      UPDATED_AT: new Date().toISOString(),
      UPDATED_BY: userEmail ?? null,
    }

    if (data.presetId !== undefined) updateObj['PRESET_ID'] = data.presetId
    if (data.menuPresetId !== undefined) updateObj['MENU_PRESET_ID'] = data.menuPresetId
    if (data.isActive !== undefined) updateObj['IS_ACTIVE'] = data.isActive

    let res = await supabase
      .from('Restaurant_Events')
      .update(updateObj)
      .eq('EVENT_ID', eventId)
      .select()
      .single()

    if (res.error) {
      delete updateObj['PRESET_ID']
      delete updateObj['MENU_PRESET_ID']
      delete updateObj['IS_ACTIVE']
      res = await supabase
        .from('Restaurant_Events')
        .update(updateObj)
        .eq('EVENT_ID', eventId)
        .select()
        .single()
    }

    if (res.error) throw res.error

    isUsingFallbackStorage = false
    const mapped = mapRow(res.data)

    return mapped
  } catch (err) {
    console.warn('[eventService] Supabase updateEvent fallback:', err)
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
      location: data.location.trim() || 'Bill Shaw Restaurant',
      organizer: data.organizer.trim() || null,
      maxPax: maxPaxVal,
      expectedAttendees: maxPaxVal,
      presetId: data.presetId ?? null,
      menuPresetId: data.menuPresetId ?? null,
      isActive: data.isActive !== undefined ? Boolean(data.isActive) : fallbackAll[index].isActive,
      contactName: data.contactName.trim() || null,
      contactPhone: data.contactPhone.trim() || null,
      contactEmail: data.contactEmail.trim() || null,
      notes: notesVal,
      updatedAt: new Date().toISOString(),
      updatedBy: userEmail ?? null,
    }
    fallbackAll[index] = updated
    saveFallbackEvents(fallbackAll)

    return updated
  }
}

// ─── Active Event Queries & Lifecycle ─────────────────────────────────────────

export async function getActiveEvent(): Promise<RestaurantEvent | null> {
  try {
    const events = await fetchEvents()
    const active = events.find((e) => e.isActive && !e.isCancelled && !e.deletedAt)
    if (active) return active
  } catch (err) {
    console.warn('[eventService] Failed to fetch events for active event check:', err)
  }

  // Fallback: check localStorage active ID or fallback storage
  if (typeof window !== 'undefined') {
    const activeStoredId = localStorage.getItem('monolith_active_event_id')
    if (activeStoredId) {
      const fallbackAll = getFallbackEvents()
      const found = fallbackAll.find((e) => String(e.eventId) === activeStoredId && !e.isCancelled && !e.deletedAt)
      if (found) return found
    }
  }
  return null
}

// ─── Activate Event (Switches Linked Table Layout & Menu Preset) ───────────────

export async function activateEvent(event: RestaurantEvent): Promise<void> {
  // 1. Mark this event as active and clear other active events in storage
  if (typeof window !== 'undefined') {
    localStorage.setItem('monolith_active_event_id', String(event.eventId))
  }

  // Sync fallback events in localStorage
  try {
    const fallbackAll = getFallbackEvents()
    const updatedFallback = fallbackAll.map((e) => ({
      ...e,
      isActive: e.eventId === event.eventId,
    }))
    saveFallbackEvents(updatedFallback)
  } catch {
    // Ignore fallback write errors
  }

  // 2. If event has linked Table Layout Preset, apply & toggle IS_DEFAULT in Table_Layout_Presets
  if (event.presetId) {
    try {
      const { setDefaultLayoutPreset } = await import('@/services/tableLayoutService')
      await setDefaultLayoutPreset(event.presetId)
      const { logTableAction } = await import('@/services/tableAuditService')
      void logTableAction('EVENT_LAYOUT_APPLIED', `Event "${event.title}" activated: layout preset #${event.presetId} applied.`, {
        targetEntity: 'EVENT',
        targetId: String(event.eventId),
        metadata: { presetId: event.presetId },
      })
    } catch (err) {
      console.warn('[eventService] Failed to set default layout preset on event activate:', err)
    }
  }

  // 3. If event has linked Menu Preset, toggle IS_DEFAULT in Menu_Presets
  if (event.menuPresetId) {
    try {
      const { setDefaultMenuPreset } = await import('@/services/menuService')
      await setDefaultMenuPreset(event.menuPresetId)
    } catch (err) {
      console.warn('[eventService] Failed to set default menu preset on event activate:', err)
    }
  }

  // 4. Update database state for Restaurant_Events
  try {
    await supabase
      .from('Restaurant_Events')
      .update({ IS_ACTIVE: false })
      .neq('EVENT_ID', event.eventId)

    await supabase
      .from('Restaurant_Events')
      .update({ IS_ACTIVE: true })
      .eq('EVENT_ID', event.eventId)
  } catch {
    // Ignore db column absence
  }

  // 5. Broadcast realtime notification across all interfaces
  if (typeof window !== 'undefined') {
    const detail = {
      type: 'event_activated',
      eventId: event.eventId,
      presetId: event.presetId,
      menuPresetId: event.menuPresetId,
    }
    window.dispatchEvent(new CustomEvent('monolith-order-update', { detail }))
    try {
      const bc = new BroadcastChannel('monolith_order_events')
      bc.postMessage(detail)
      bc.close()
    } catch {
      // Ignore
    }
  }
}

export async function deactivateEvent(eventId: number): Promise<void> {
  if (typeof window !== 'undefined') {
    if (localStorage.getItem('monolith_active_event_id') === String(eventId)) {
      localStorage.removeItem('monolith_active_event_id')
    }
  }

  // Sync fallback events in localStorage
  try {
    const fallbackAll = getFallbackEvents()
    const updatedFallback = fallbackAll.map((e) => ({
      ...e,
      isActive: e.eventId === eventId ? false : e.isActive,
    }))
    saveFallbackEvents(updatedFallback)
  } catch {
    // Ignore fallback write errors
  }

  // 1. Revert Table_Layout_Presets IS_DEFAULT to standard default layout (prioritizing protected preset)
  try {
    const { fetchAllLayoutPresets, setDefaultLayoutPreset } = await import('@/services/tableLayoutService')
    const presets = await fetchAllLayoutPresets()
    const basePreset =
      presets.find((p) => p.IS_PROTECTED) ||
      presets.find(
        (p) =>
          p.LAYOUT_PRESET_ID === 1 ||
          p.LAYOUT_PRESET_ID === 2 ||
          p.PRESET_NAME.toLowerCase().includes('main') ||
          p.PRESET_NAME.toLowerCase().includes('default'),
      ) || presets[0]
    if (basePreset) {
      await setDefaultLayoutPreset(basePreset.LAYOUT_PRESET_ID)
      const { logTableAction } = await import('@/services/tableAuditService')
      void logTableAction('EVENT_LAYOUT_RESET', `Event #${eventId} deactivated: floor layout reverted to default preset "${basePreset.PRESET_NAME}".`, {
        targetEntity: 'EVENT',
        targetId: String(eventId),
        metadata: { presetId: basePreset.LAYOUT_PRESET_ID },
      })
    }
  } catch (err) {
    console.warn('[eventService] Failed to revert default layout preset on event deactivate:', err)
  }

  // 2. Revert Menu_Presets IS_DEFAULT to standard default menu
  try {
    const { fetchMenuPresets, setDefaultMenuPreset } = await import('@/services/menuService')
    const menuPresets = await fetchMenuPresets()
    const baseMenuPreset =
      menuPresets.find(
        (p) =>
          p.PRESET_ID === 1 ||
          p.PRESET_NAME.toLowerCase().includes('default') ||
          p.PRESET_NAME.toLowerCase().includes('main'),
      ) || menuPresets[0]
    if (baseMenuPreset) {
      await setDefaultMenuPreset(baseMenuPreset.PRESET_ID)
    }
  } catch (err) {
    console.warn('[eventService] Failed to revert default menu preset on event deactivate:', err)
  }

  // 3. Update database state
  try {
    await supabase
      .from('Restaurant_Events')
      .update({ IS_ACTIVE: false })
      .eq('EVENT_ID', eventId)
  } catch {
    // Ignore
  }

  if (typeof window !== 'undefined') {
    const detail = { type: 'event_deactivated', eventId }
    window.dispatchEvent(new CustomEvent('monolith-order-update', { detail }))
    try {
      const bc = new BroadcastChannel('monolith_order_events')
      bc.postMessage(detail)
      bc.close()
    } catch {
      // Ignore
    }
  }
}

// ─── Cancel Event ──────────────────────────────────────────────────────────────

export async function cancelEvent(eventId: number, userEmail?: string | null): Promise<void> {
  // If active, deactivate first to restore base presets
  if (typeof window !== 'undefined' && localStorage.getItem('monolith_active_event_id') === String(eventId)) {
    try {
      await deactivateEvent(eventId)
    } catch {
      // Ignore
    }
  }

  try {
    const { error } = await supabase
      .from('Restaurant_Events')
      .update({
        IS_CANCELLED: true,
        IS_ACTIVE: false,
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
      fallbackAll[index].isActive = false
      fallbackAll[index].updatedAt = new Date().toISOString()
      fallbackAll[index].updatedBy = userEmail ?? null
      saveFallbackEvents(fallbackAll)
    }
  }
}

// ─── Soft Delete Event ─────────────────────────────────────────────────────────

export async function deleteEvent(eventId: number, userEmail?: string | null): Promise<void> {
  // If active, deactivate first to restore base presets
  if (typeof window !== 'undefined' && localStorage.getItem('monolith_active_event_id') === String(eventId)) {
    try {
      await deactivateEvent(eventId)
    } catch {
      // Ignore
    }
  }

  try {
    const { error } = await supabase
      .from('Restaurant_Events')
      .update({
        DELETED_AT: new Date().toISOString(),
        IS_ACTIVE: false,
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
      fallbackAll[index].isActive = false
      fallbackAll[index].updatedAt = new Date().toISOString()
      fallbackAll[index].updatedBy = userEmail ?? null
      saveFallbackEvents(fallbackAll)
    }
  }
}

/**
 * Deprecated: Layout presets maintain their own configured max pax in Table Manager.
 */
export async function syncLayoutPresetsWithEvents(): Promise<void> {
  // No-op
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
