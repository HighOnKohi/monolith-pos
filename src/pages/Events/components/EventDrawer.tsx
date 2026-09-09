import React, { useState, useEffect, useCallback } from 'react'
import {
  X, Save, CalendarDays, MapPin, User2, Users, Phone, Mail,
  Clock, FileText, Pencil, Trash2, Tag, Palette, BanIcon,
} from 'lucide-react'
import type { RestaurantEvent, EventFormData, EventConflict } from '@/types/event'
import { EVENT_CATEGORIES, EVENT_FORM_DEFAULTS } from '@/types/event'
import { checkEventConflicts } from '@/services/eventService'
import {
  deriveEventStatus,
  getEventStatusBadge,
  getCategoryColor,
  formatEventDate,
  formatEventDuration,
  formatEventDateRange,
  isoToDateInput,
  isoToTimeInput,
} from '../utils/eventUtils'
import { EventConflictBanner } from './EventConflictBanner'

export type EventDrawerMode = 'view' | 'create' | 'edit'

interface EventDrawerProps {
  isOpen: boolean
  mode: EventDrawerMode
  event: RestaurantEvent | null
  prefillDate?: Date | null
  canManageEvents: boolean
  submitting?: boolean
  onClose: () => void
  onSave: (data: EventFormData) => Promise<void>
  onEdit: (event: RestaurantEvent) => void
  onDelete: (event: RestaurantEvent) => void
  onCancel: (event: RestaurantEvent) => void
}

const COLOR_PALETTE = [
  '#14274E', // brand primary
  '#6366f1', // indigo
  '#ec4899', // pink
  '#d97706', // amber
  '#16a34a', // green
  '#dc2626', // red
  '#0891b2', // cyan
  '#7c3aed', // violet
  '',        // none (use category default)
]

interface FormErrors {
  title?: string
  startDate?: string
  startTime?: string
  endDate?: string
  endTime?: string
  expectedAttendees?: string
  contactEmail?: string
}

const FORM_LABEL_CLASS = 'block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1'
const FORM_ERROR_CLASS = 'text-[10px] font-bold text-rose-600 mt-1'

export const EventDrawer: React.FC<EventDrawerProps> = ({
  isOpen,
  mode,
  event,
  prefillDate,
  canManageEvents,
  submitting = false,
  onClose,
  onSave,
  onEdit,
  onDelete,
  onCancel,
}) => {
  const [form, setForm] = useState<EventFormData>(EVENT_FORM_DEFAULTS)
  const [errors, setErrors] = useState<FormErrors>({})
  const [conflicts, setConflicts] = useState<EventConflict[]>([])
  const [conflictLoading, setConflictLoading] = useState(false)
  const [conflictChecked, setConflictChecked] = useState(false)

  // ESC key
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  // Populate form
  useEffect(() => {
    if (!isOpen) return
    setErrors({})
    setConflicts([])
    setConflictChecked(false)

    if (mode === 'create') {
      const d = prefillDate || new Date()
      const defaultDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      setForm({ ...EVENT_FORM_DEFAULTS, startDate: defaultDate, endDate: defaultDate })
    } else if ((mode === 'edit' || mode === 'view') && event) {
      setForm({
        title: event.title,
        description: event.description ?? '',
        category: event.category,
        color: event.color ?? '',
        startDate: isoToDateInput(event.startAt),
        startTime: isoToTimeInput(event.startAt),
        endDate: isoToDateInput(event.endAt),
        endTime: isoToTimeInput(event.endAt),
        location: event.location ?? '',
        organizer: event.organizer ?? '',
        expectedAttendees: event.expectedAttendees != null ? String(event.expectedAttendees) : '',
        contactName: event.contactName ?? '',
        contactPhone: event.contactPhone ?? '',
        contactEmail: event.contactEmail ?? '',
        notes: event.notes ?? '',
      })
    }
  }, [isOpen, mode, event, prefillDate])

  const setField = <K extends keyof EventFormData>(key: K, value: EventFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
    // Reset conflict check when dates change
    if (key === 'startDate' || key === 'startTime' || key === 'endDate' || key === 'endTime') {
      setConflicts([])
      setConflictChecked(false)
    }
  }

  // Conflict check (debounced when both start+end are set)
  const runConflictCheck = useCallback(async () => {
    if (!form.startDate || !form.startTime || !form.endDate || !form.endTime) return
    const startAt = new Date(`${form.startDate}T${form.startTime}`).toISOString()
    const endAt = new Date(`${form.endDate}T${form.endTime}`).toISOString()
    if (isNaN(Date.parse(startAt)) || isNaN(Date.parse(endAt))) return
    setConflictLoading(true)
    const found = await checkEventConflicts(startAt, endAt, event?.eventId)
    setConflicts(found)
    setConflictChecked(true)
    setConflictLoading(false)
  }, [form.startDate, form.startTime, form.endDate, form.endTime, event?.eventId])

  // Run conflict check after 600ms debounce when dates change
  useEffect(() => {
    if (mode === 'view') return
    if (!form.startDate || !form.endDate) return
    const timer = setTimeout(runConflictCheck, 600)
    return () => clearTimeout(timer)
  }, [form.startDate, form.startTime, form.endDate, form.endTime, mode, runConflictCheck])

  const validate = (): boolean => {
    const errs: FormErrors = {}
    if (!form.title.trim()) errs.title = 'Event name is required'
    if (!form.startDate) errs.startDate = 'Start date is required'
    if (!form.startTime) errs.startTime = 'Start time is required'
    if (!form.endDate) errs.endDate = 'End date is required'
    if (!form.endTime) errs.endTime = 'End time is required'

    if (form.startDate && form.endDate && form.startTime && form.endTime) {
      const start = new Date(`${form.startDate}T${form.startTime}`)
      const end = new Date(`${form.endDate}T${form.endTime}`)
      if (end < start) errs.endDate = 'End must be after start date/time'
    }

    if (form.expectedAttendees && !/^\d+$/.test(form.expectedAttendees)) {
      errs.expectedAttendees = 'Must be a whole number'
    }
    if (form.expectedAttendees && parseInt(form.expectedAttendees, 10) < 0) {
      errs.expectedAttendees = 'Cannot be negative'
    }

    if (form.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail)) {
      errs.contactEmail = 'Invalid email format'
    }

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    await onSave(form)
  }

  if (!isOpen) return null

  const isView = mode === 'view'
  const isFormMode = mode === 'create' || mode === 'edit'
  const eventStatus = event ? deriveEventStatus(event) : null
  const statusBadge = eventStatus ? getEventStatusBadge(eventStatus) : null
  const catColor = event ? (event.color || getCategoryColor(event.category)) : '#14274E'

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={submitting ? undefined : onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 w-full max-w-xl bg-white shadow-2xl flex flex-col z-50 animate-in slide-in-from-right duration-250 border-l border-slate-200">
        {/* ── Drawer Header ── */}
        <div
          className="p-5 border-b border-slate-100 flex items-center justify-between shrink-0"
          style={{ background: isView && catColor ? `${catColor}08` : undefined }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm shadow-xs shrink-0"
              style={{ backgroundColor: catColor, color: '#fff' }}
            >
              <CalendarDays className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-black text-[#14274E] truncate">
                {mode === 'create'
                  ? 'Add New Event'
                  : mode === 'edit'
                    ? `Edit: ${event?.title ?? ''}`
                    : (event?.title ?? 'Event Details')}
              </h2>
              <p className="text-xs text-slate-400">
                {mode === 'create'
                  ? 'Fill in the details for the new event.'
                  : mode === 'edit'
                    ? 'Update event details. Changes are saved immediately.'
                    : event
                      ? `Event #${event.eventId} · ${event.category}`
                      : ''}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={submitting}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer shrink-0 ml-2"
            aria-label="Close drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Drawer Body ── */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* ── VIEW MODE ── */}
          {isView && event && (
            <div className="space-y-5">
              {/* Status + Category */}
              <div className="flex items-center gap-2 flex-wrap">
                {statusBadge && eventStatus && (
                  <span
                    className={[
                      'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border',
                      statusBadge.bg, statusBadge.text, statusBadge.border,
                    ].join(' ')}
                  >
                    <span className={`w-2 h-2 rounded-full ${statusBadge.dot}`} />
                    {eventStatus}
                  </span>
                )}
                <span
                  className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold"
                  style={{
                    backgroundColor: `${catColor}18`,
                    color: catColor,
                    border: `1px solid ${catColor}30`,
                  }}
                >
                  {event.category}
                </span>
              </div>

              {/* Core Info Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <DetailRow
                  icon={<CalendarDays className="w-3.5 h-3.5" />}
                  label="Date & Time"
                  value={formatEventDateRange(event.startAt, event.endAt)}
                />
                <DetailRow
                  icon={<Clock className="w-3.5 h-3.5" />}
                  label="Duration"
                  value={formatEventDuration(event.startAt, event.endAt)}
                />
                {event.location && (
                  <DetailRow
                    icon={<MapPin className="w-3.5 h-3.5" />}
                    label="Location"
                    value={event.location}
                  />
                )}
                {event.organizer && (
                  <DetailRow
                    icon={<User2 className="w-3.5 h-3.5" />}
                    label="Organizer"
                    value={event.organizer}
                  />
                )}
                {event.expectedAttendees != null && (
                  <DetailRow
                    icon={<Users className="w-3.5 h-3.5" />}
                    label="Expected Attendees"
                    value={`${event.expectedAttendees} people`}
                  />
                )}
              </div>

              {/* Description */}
              {event.description && (
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <FileText className="w-3 h-3" /> Description
                  </p>
                  <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 rounded-xl p-3 border border-slate-100">
                    {event.description}
                  </p>
                </div>
              )}

              {/* Contact Info */}
              {(event.contactName || event.contactPhone || event.contactEmail) && (
                <div className="space-y-2 p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Contact</p>
                  {event.contactName && <InfoChip icon={<User2 className="w-3.5 h-3.5" />} value={event.contactName} />}
                  {event.contactPhone && <InfoChip icon={<Phone className="w-3.5 h-3.5" />} value={event.contactPhone} />}
                  {event.contactEmail && <InfoChip icon={<Mail className="w-3.5 h-3.5" />} value={event.contactEmail} />}
                </div>
              )}

              {/* Notes */}
              {event.notes && (
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Notes</p>
                  <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{event.notes}</p>
                </div>
              )}

              {/* Metadata */}
              <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-3 text-xs text-slate-400">
                <div>
                  <p className="text-[10px] uppercase font-black tracking-wider">Created By</p>
                  <p className="font-medium text-slate-600 mt-0.5">{event.createdBy || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-black tracking-wider">Created At</p>
                  <p className="font-medium text-slate-600 mt-0.5">{formatEventDate(event.createdAt)}</p>
                </div>
                {event.updatedBy && (
                  <div>
                    <p className="text-[10px] uppercase font-black tracking-wider">Last Updated By</p>
                    <p className="font-medium text-slate-600 mt-0.5">{event.updatedBy}</p>
                  </div>
                )}
                <div>
                  <p className="text-[10px] uppercase font-black tracking-wider">Last Updated</p>
                  <p className="font-medium text-slate-600 mt-0.5">{formatEventDate(event.updatedAt)}</p>
                </div>
              </div>
            </div>
          )}

          {/* ── FORM MODE ── */}
          {isFormMode && (
            <div className="space-y-5">
              {/* Conflict Banner */}
              {conflictLoading && (
                <div className="text-xs text-slate-400 italic animate-pulse flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full border-2 border-slate-300 border-t-transparent animate-spin" />
                  Checking for conflicts...
                </div>
              )}
              {!conflictLoading && conflictChecked && (
                <EventConflictBanner conflicts={conflicts} />
              )}

              {/* Title */}
              <div className="space-y-1.5">
                <label htmlFor="event-title" className={FORM_LABEL_CLASS}>
                  Event Name <span className="text-rose-500">*</span>
                </label>
                <input
                  id="event-title"
                  type="text"
                  value={form.title}
                  onChange={(e) => setField('title', e.target.value)}
                  placeholder="e.g. Annual Company Dinner"
                  className={formInputClass(!!errors.title)}
                />
                {errors.title && <p className={FORM_ERROR_CLASS}>{errors.title}</p>}
              </div>

              {/* Start Date + Time */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label htmlFor="event-start-date" className={FORM_LABEL_CLASS}>
                    Start Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="event-start-date"
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setField('startDate', e.target.value)}
                    className={formInputClass(!!errors.startDate)}
                  />
                  {errors.startDate && <p className={FORM_ERROR_CLASS}>{errors.startDate}</p>}
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="event-start-time" className={FORM_LABEL_CLASS}>
                    Start Time <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="event-start-time"
                    type="time"
                    value={form.startTime}
                    onChange={(e) => setField('startTime', e.target.value)}
                    className={formInputClass(!!errors.startTime)}
                  />
                  {errors.startTime && <p className={FORM_ERROR_CLASS}>{errors.startTime}</p>}
                </div>
              </div>

              {/* End Date + Time */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label htmlFor="event-end-date" className={FORM_LABEL_CLASS}>
                    End Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="event-end-date"
                    type="date"
                    value={form.endDate}
                    min={form.startDate || undefined}
                    onChange={(e) => setField('endDate', e.target.value)}
                    className={formInputClass(!!errors.endDate)}
                  />
                  {errors.endDate && <p className={FORM_ERROR_CLASS}>{errors.endDate}</p>}
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="event-end-time" className={FORM_LABEL_CLASS}>
                    End Time <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="event-end-time"
                    type="time"
                    value={form.endTime}
                    onChange={(e) => setField('endTime', e.target.value)}
                    className={formInputClass(!!errors.endTime)}
                  />
                  {errors.endTime && <p className={FORM_ERROR_CLASS}>{errors.endTime}</p>}
                </div>
              </div>

              {/* Category + Color */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label htmlFor="event-category" className={FORM_LABEL_CLASS}>
                    <Tag className="w-3 h-3 inline mr-1" />Category
                  </label>
                  <select
                    id="event-category"
                    value={form.category}
                    onChange={(e) => setField('category', e.target.value as typeof form.category)}
                    className={formInputClass(false)}
                  >
                    {EVENT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className={FORM_LABEL_CLASS}>
                    <Palette className="w-3 h-3 inline mr-1" />Color
                  </label>
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    {COLOR_PALETTE.map((color, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setField('color', color)}
                        title={color || 'Default (category color)'}
                        className={[
                          'w-6 h-6 rounded-full border-2 transition-all cursor-pointer',
                          form.color === color
                            ? 'border-[#14274E] scale-110 ring-2 ring-[#14274E]/20'
                            : 'border-slate-200 hover:scale-105',
                        ].join(' ')}
                        style={{ backgroundColor: color || '#e2e8f0' }}
                        aria-label={color ? `Color ${color}` : 'Default color'}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label htmlFor="event-description" className={FORM_LABEL_CLASS}>
                  <FileText className="w-3 h-3 inline mr-1" />Description
                </label>
                <textarea
                  id="event-description"
                  value={form.description}
                  onChange={(e) => setField('description', e.target.value)}
                  placeholder="Optional event description..."
                  rows={3}
                  className={`${formInputClass(false)} resize-none`}
                />
              </div>

              {/* Location + Organizer */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label htmlFor="event-location" className={FORM_LABEL_CLASS}>
                    <MapPin className="w-3 h-3 inline mr-1" />Location
                  </label>
                  <input
                    id="event-location"
                    type="text"
                    value={form.location}
                    onChange={(e) => setField('location', e.target.value)}
                    placeholder="e.g. Function Hall A"
                    className={formInputClass(false)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="event-organizer" className={FORM_LABEL_CLASS}>
                    <User2 className="w-3 h-3 inline mr-1" />Organizer
                  </label>
                  <input
                    id="event-organizer"
                    type="text"
                    value={form.organizer}
                    onChange={(e) => setField('organizer', e.target.value)}
                    placeholder="e.g. HR Department"
                    className={formInputClass(false)}
                  />
                </div>
              </div>

              {/* Attendees */}
              <div className="space-y-1.5">
                <label htmlFor="event-attendees" className={FORM_LABEL_CLASS}>
                  <Users className="w-3 h-3 inline mr-1" />Expected Attendees
                </label>
                <input
                  id="event-attendees"
                  type="number"
                  min={0}
                  value={form.expectedAttendees}
                  onChange={(e) => setField('expectedAttendees', e.target.value)}
                  placeholder="e.g. 50"
                  className={formInputClass(!!errors.expectedAttendees)}
                />
                {errors.expectedAttendees && <p className={FORM_ERROR_CLASS}>{errors.expectedAttendees}</p>}
              </div>

              {/* Contact */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Contact Person</p>
                <div className="space-y-1.5">
                  <input
                    id="event-contact-name"
                    type="text"
                    value={form.contactName}
                    onChange={(e) => setField('contactName', e.target.value)}
                    placeholder="Contact name"
                    className={formInputClass(false)}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    id="event-contact-phone"
                    type="tel"
                    value={form.contactPhone}
                    onChange={(e) => setField('contactPhone', e.target.value)}
                    placeholder="Phone number"
                    className={formInputClass(false)}
                  />
                  <div>
                    <input
                      id="event-contact-email"
                      type="email"
                      value={form.contactEmail}
                      onChange={(e) => setField('contactEmail', e.target.value)}
                      placeholder="Email address"
                      className={formInputClass(!!errors.contactEmail)}
                    />
                    {errors.contactEmail && <p className={`${FORM_ERROR_CLASS} mt-1`}>{errors.contactEmail}</p>}
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label htmlFor="event-notes" className={FORM_LABEL_CLASS}>Notes</label>
                <textarea
                  id="event-notes"
                  value={form.notes}
                  onChange={(e) => setField('notes', e.target.value)}
                  placeholder="Additional notes or instructions..."
                  rows={3}
                  className={`${formInputClass(false)} resize-none`}
                />
              </div>
            </div>
          )}
        </div>

        {/* ── Drawer Footer ── */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/60 shrink-0">
          {isView && event && canManageEvents ? (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {!event.isCancelled && deriveEventStatus(event) === 'Scheduled' && (
                  <button
                    onClick={() => onCancel(event)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 text-xs font-bold hover:bg-amber-100 transition-colors cursor-pointer"
                  >
                    <BanIcon className="w-3.5 h-3.5" />
                    Cancel Event
                  </button>
                )}
                <button
                  onClick={() => onDelete(event)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs font-bold hover:bg-rose-100 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
              </div>
              <button
                onClick={() => onEdit(event)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#14274E] hover:bg-[#1a3468] text-white text-xs font-black shadow-xs transition-all cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5" />
                Edit Event
              </button>
            </div>
          ) : isView ? (
            <button
              onClick={onClose}
              className="w-full px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-xs font-bold text-slate-700 transition-colors cursor-pointer"
            >
              Close
            </button>
          ) : (
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleSubmit}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#14274E] hover:bg-[#1a3468] text-white text-xs font-black shadow-xs transition-all cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    {mode === 'create' ? 'Create Event' : 'Save Changes'}
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Small helper sub-components ──────────────────────────────────────────────

function formInputClass(hasError: boolean) {
  return [
    'w-full px-3 py-2 rounded-xl border text-xs text-slate-800 bg-white',
    'focus:outline-none focus:border-[#14274E] transition-all font-medium',
    hasError ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200 bg-slate-50/50',
  ].join(' ')
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
        {icon}{label}
      </p>
      <p className="text-sm font-semibold text-slate-700 leading-snug">{value}</p>
    </div>
  )
}

function InfoChip({ icon, value }: { icon: React.ReactNode; value: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-slate-600">
      <span className="text-slate-400">{icon}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}
