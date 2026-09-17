import { useState, useEffect, useCallback, useMemo } from 'react'
import { CalendarDays, List, AlertCircle, CalendarX, Plus } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import type { RestaurantEvent, EventFilterParams, EventFormData } from '@/types/event'
import { EVENT_FILTER_DEFAULTS } from '@/types/event'
import {
  fetchEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  cancelEvent,
  activateEvent,
  deactivateEvent,
  syncLayoutPresetsWithEvents,
  isEventServiceUsingFallback,
} from '@/services/eventService'
import { filterEvents } from './utils/eventUtils'
import { EventsFilterBar } from './components/EventsFilterBar'
import { EventsCalendar } from './components/EventsCalendar'
import { EventsListView } from './components/EventsListView'
import { EventDrawer, type EventDrawerMode } from './components/EventDrawer'
import { EventDeleteModal } from './components/EventDeleteModal'
import { EventActivateModal } from './components/EventActivateModal'

type ViewMode = 'calendar' | 'list'

export default function EventsPage() {
  const { user } = useAuth()
  const userEmail = user?.email ?? null

  // ── Permissions ──
  // Authenticated users on the Events page can manage events by default.
  // We verify Staff_Accounts for role and permissions.
  const [canManageEvents, setCanManageEvents] = useState(true)

  useEffect(() => {
    if (!userEmail) return
    supabase
      .from('Staff_Accounts')
      .select('ROLE, PERMISSIONS')
      .eq('EMAIL', userEmail)
      .maybeSingle()
      .then(
        ({ data }) => {
          if (!data) {
            setCanManageEvents(true)
            return
          }
          if (
            data.ROLE === 'ADMIN' ||
            data.ROLE === 'MANAGER' ||
            data.PERMISSIONS?.includes('manage_events')
          ) {
            setCanManageEvents(true)
          } else {
            setCanManageEvents(false)
          }
        },
        () => {
          setCanManageEvents(true)
        },
      )
  }, [userEmail])

  // ── Data ──
  const [events, setEvents] = useState<RestaurantEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ── Filters ──
  const [filters, setFilters] = useState<EventFilterParams>(EVENT_FILTER_DEFAULTS)

  // ── View Mode ──
  const [viewMode, setViewMode] = useState<ViewMode>('calendar')

  // ── Toast ──
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }, [])

  // ── Drawer ──
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerMode, setDrawerMode] = useState<EventDrawerMode>('view')
  const [selectedEvent, setSelectedEvent] = useState<RestaurantEvent | null>(null)
  const [prefillDate, setPrefillDate] = useState<Date | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // ── Delete Modal ──
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; event: RestaurantEvent | null }>({
    open: false,
    event: null,
  })
  const [deleteLoading, setDeleteLoading] = useState(false)

  // ── Activate Modal ──
  const [activateModal, setActivateModal] = useState<{ open: boolean; event: RestaurantEvent | null }>({
    open: false,
    event: null,
  })
  const [activateLoading, setActivateLoading] = useState(false)

  // ── Fallback Storage State ──
  const [isFallback, setIsFallback] = useState(false)

  // ── Load Events (Always loads all events so summary stats stay globally accurate) ──
  const loadEvents = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchEvents()
      setEvents(data)
      setIsFallback(isEventServiceUsingFallback())
      void syncLayoutPresetsWithEvents()
    } catch (err: unknown) {
      console.error('[EventsPage] Failed to load events:', err)
      setError(err instanceof Error ? err.message : 'Failed to load events.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadEvents()
  }, [loadEvents])

  // ── Realtime Subscription ──
  useEffect(() => {
    const channel = supabase
      .channel('restaurant_events_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'events', table: 'Restaurant_Events' },
        () => {
          loadEvents()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadEvents])

  // ── Filtered Events for display (Instant client-side filtering) ──
  const displayedEvents = useMemo(() => filterEvents(events, filters), [events, filters])

  // ── Filter Handlers ──
  const handleFilterChange = (f: Partial<EventFilterParams>) => {
    setFilters((prev) => ({ ...prev, ...f }))
  }

  const handleClearFilters = () => {
    setFilters(EVENT_FILTER_DEFAULTS)
  }

  const handleAddEvent = () => {
    setPrefillDate(null)
    setSelectedEvent(null)
    setDrawerMode('create')
    setDrawerOpen(true)
  }

  const handleViewEvent = (event: RestaurantEvent) => {
    setSelectedEvent(event)
    setDrawerMode('view')
    setDrawerOpen(true)
  }

  const handleEditEvent = (event: RestaurantEvent) => {
    setSelectedEvent(event)
    setDrawerMode('edit')
    setDrawerOpen(true)
  }

  const handleDateClick = (date: Date) => {
    if (!canManageEvents) return
    setPrefillDate(date)
    setSelectedEvent(null)
    setDrawerMode('create')
    setDrawerOpen(true)
  }

  const eventFromForm = (data: EventFormData, previous?: RestaurantEvent): RestaurantEvent => {
    const pax = data.maxPax
      ? parseInt(data.maxPax, 10)
      : (data.expectedAttendees ? parseInt(data.expectedAttendees, 10) : 50)
    return {
      eventId: previous?.eventId ?? -Date.now(),
      title: data.title.trim(),
      description: data.description.trim() || null,
      category: data.category,
      color: data.color || null,
      startAt: new Date(`${data.startDate}T${data.startTime}`).toISOString(),
      endAt: new Date(`${data.endDate}T${data.endTime}`).toISOString(),
      location: data.location.trim() || 'Bill Shaw Restaurant',
      organizer: data.organizer.trim() || null,
      maxPax: pax,
      expectedAttendees: pax,
      presetId: data.presetId ?? null,
      menuPresetId: data.menuPresetId ?? null,
      isActive: previous?.isActive ?? false,
      contactName: data.contactName.trim() || null,
      contactPhone: data.contactPhone.trim() || null,
      contactEmail: data.contactEmail.trim() || null,
      notes: data.notes.trim() || null,
      isCancelled: previous?.isCancelled ?? false,
      createdBy: previous?.createdBy ?? userEmail,
      createdAt: previous?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      updatedBy: userEmail,
      deletedAt: null,
    }
  }

  const handleCancelEvent = async (event: RestaurantEvent) => {
    const previous = event
    const optimistic = { ...event, isCancelled: true, updatedAt: new Date().toISOString(), updatedBy: userEmail }
    setEvents((current) => current.map((entry) => entry.eventId === event.eventId ? optimistic : entry))
    try {
      await cancelEvent(event.eventId, userEmail)
      showToast('Event cancelled successfully.')
      setDrawerOpen(false)
      loadEvents()
    } catch {
      setEvents((current) => current.map((entry) => entry.eventId === event.eventId ? previous : entry))
      showToast('Failed to cancel event.', 'error')
    }
  }

  const handleSave = async (data: EventFormData) => {
    setSubmitting(true)
    const previous = drawerMode === 'edit' ? selectedEvent : null
    const optimistic = eventFromForm(data, previous ?? undefined)
    try {
      if (drawerMode === 'create') {
        setEvents((current) => [...current, optimistic])
        await createEvent(data, userEmail)
        showToast('Event created successfully.')
      } else if (drawerMode === 'edit' && selectedEvent) {
        setEvents((current) => current.map((event) => event.eventId === selectedEvent.eventId ? optimistic : event))
        await updateEvent(selectedEvent.eventId, data, userEmail)
        showToast('Event updated successfully.')
      }
      setDrawerOpen(false)
      loadEvents()
    } catch (err: unknown) {
      setEvents((current) => drawerMode === 'create'
        ? current.filter((event) => event.eventId !== optimistic.eventId)
        : current.map((event) => event.eventId === previous?.eventId ? previous : event))
      showToast(err instanceof Error ? err.message : 'Failed to save event.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteRequest = (event: RestaurantEvent) => {
    setDeleteModal({ open: true, event })
    setDrawerOpen(false)
  }

  const handleDeleteConfirm = async () => {
    if (!deleteModal.event) return
    const previous = deleteModal.event
    setDeleteLoading(true)
    setEvents((current) => current.filter((event) => event.eventId !== previous.eventId))
    try {
      await deleteEvent(previous.eventId, userEmail)
      showToast('Event deleted successfully.')
      setDeleteModal({ open: false, event: null })
      loadEvents()
    } catch {
      setEvents((current) => [...current, previous])
      showToast('Failed to delete event.', 'error')
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleToggleActive = (event: RestaurantEvent) => {
    if (event.isActive) {
      void handleDeactivateConfirm(event)
    } else {
      setActivateModal({ open: true, event })
    }
  }

  const handleActivateConfirm = async () => {
    if (!activateModal.event) return
    const target = activateModal.event
    setActivateLoading(true)
    try {
      await activateEvent(target)
      showToast(`Event "${target.title}" activated: Layout & Menu presets applied!`)
      setActivateModal({ open: false, event: null })
      await loadEvents()
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to activate event.', 'error')
    } finally {
      setActivateLoading(false)
    }
  }

  const handleDeactivateConfirm = async (event: RestaurantEvent) => {
    try {
      await deactivateEvent(event.eventId)
      showToast(`Event "${event.title}" deactivated.`)
      await loadEvents()
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to deactivate event.', 'error')
    }
  }

  return (
    <div className="events-page events-page-container staff-page flex flex-col gap-3.5 sm:gap-4 pb-12">
      {/* ── Toast ── */}
      {toast && (
        <div
          className={[
            'fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl shadow-lg text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-3',
            toast.type === 'success'
              ? 'bg-[#14274E] text-[#E9C46A] border border-[#E9C46A]/30'
              : 'bg-rose-600 text-white',
          ].join(' ')}
        >
          {toast.message}
        </div>
      )}

      <div className="flex items-center self-start shrink-0">
        <div className={`events-view-toggle flex items-center gap-1 bg-slate-100 rounded-xl p-1 ${viewMode === 'list' ? 'events-view-toggle-list' : ''}`}>
          <span className="events-view-toggle-indicator" />
          <button
            onClick={() => setViewMode('calendar')}
            className={[
              'inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all cursor-pointer',
              viewMode === 'calendar'
                ? 'text-[#E9C46A]'
                : 'text-slate-500 hover:text-slate-700',
            ].join(' ')}
          >
            <CalendarDays className="w-4 h-4" />
            <span>Calendar</span>
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={[
              'inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all cursor-pointer',
              viewMode === 'list'
                ? 'text-[#E9C46A]'
                : 'text-slate-500 hover:text-slate-700',
            ].join(' ')}
          >
            <List className="w-4 h-4" />
            <span>Events</span>
          </button>
        </div>
      </div>

      {/* ── Fallback Storage Notice ── */}
      {isFallback && (
        <div className="p-3 bg-amber-50/90 border border-amber-200/80 rounded-2xl flex items-center justify-between gap-3 text-xs text-amber-900 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
            <span>
              <strong>Local Storage Mode:</strong> Database table <code>Restaurant_Events</code> not yet created. Events are saved locally in this browser. Run <code>Context/migrations/013_events.sql</code> in your Supabase SQL Editor to sync across devices.
            </span>
          </div>
        </div>
      )}

      {viewMode === 'list' && (
        <EventsFilterBar
          filters={filters}
          onFilterChange={handleFilterChange}
          onAddEvent={handleAddEvent}
          canManageEvents={canManageEvents}
        />
      )}

      {/* ── Error Banner ── */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between gap-3 text-xs text-rose-800 shrink-0">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => loadEvents()}
            className="px-3 py-1 bg-rose-600 text-white font-bold rounded-lg hover:bg-rose-700 cursor-pointer shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Main Content ── */}
      {!error && (
        <>
          {viewMode === 'calendar' ? (
            <div key="calendar" className="events-view-content flex-1 min-h-0 flex">
              <EventsCalendar
                events={displayedEvents}
                onEventClick={handleViewEvent}
                onDateClick={handleDateClick}
                onRefresh={loadEvents}
                canManageEvents={canManageEvents}
              />
            </div>
          ) : (
            <div key="events" className="events-view-content flex-1 min-h-0 overflow-y-auto">
              {displayedEvents.length === 0 && !loading ? (
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-12 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                      <CalendarX className="w-6 h-6 text-slate-400" strokeWidth={1.5} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-600">
                        {filters.searchQuery || filters.status !== 'All' || filters.category !== 'All' || filters.dateFilter !== 'all'
                          ? 'No events found'
                          : 'No events scheduled'}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {filters.searchQuery || filters.status !== 'All' || filters.category !== 'All' || filters.dateFilter !== 'all'
                          ? 'Try changing your search or filters.'
                          : 'Create your first event to start managing your schedule.'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      {(filters.searchQuery || filters.status !== 'All' || filters.category !== 'All' || filters.dateFilter !== 'all') && (
                        <button
                          onClick={handleClearFilters}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
                        >
                          <span>Show All Events</span>
                        </button>
                      )}
                      {canManageEvents && (
                        <button
                          onClick={handleAddEvent}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#14274E] text-white text-xs font-black shadow-xs hover:bg-[#1a3468] transition-all cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Add Event</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <EventsListView
                  events={displayedEvents}
                  onView={handleViewEvent}
                  onEdit={handleEditEvent}
                  onDelete={handleDeleteRequest}
                  onToggleActive={handleToggleActive}
                  canManageEvents={canManageEvents}
                  loading={loading}
                />
              )}
            </div>
          )}
        </>
      )}

      {/* ── Event Drawer ── */}
      <EventDrawer
        isOpen={drawerOpen}
        mode={drawerMode}
        event={selectedEvent}
        prefillDate={prefillDate}
        canManageEvents={canManageEvents}
        existingEvents={events}
        submitting={submitting}
        onClose={() => setDrawerOpen(false)}
        onSave={handleSave}
        onEdit={handleEditEvent}
        onDelete={handleDeleteRequest}
        onCancel={handleCancelEvent}
      />

      {/* ── Delete Confirmation Modal ── */}
      <EventDeleteModal
        isOpen={deleteModal.open}
        eventTitle={deleteModal.event?.title ?? ''}
        loading={deleteLoading}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteModal({ open: false, event: null })}
      />

      {/* ── Activate Confirmation Modal ── */}
      <EventActivateModal
        isOpen={activateModal.open}
        event={activateModal.event}
        loading={activateLoading}
        onConfirm={handleActivateConfirm}
        onCancel={() => setActivateModal({ open: false, event: null })}
      />
    </div>
  )
}
