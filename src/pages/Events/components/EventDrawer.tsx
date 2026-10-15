import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  X, Save, CalendarDays, MapPin, User2, Users, Phone, Mail,
  Clock, Pencil, Trash2, Tag, Palette, BanIcon, Layout, UtensilsCrossed,
  AlertTriangle, ChevronLeft, ChevronRight, ChevronDown, Check, Plus,
} from 'lucide-react'
import type { RestaurantEvent, EventFormData, EventConflict } from '@/types/event'
import { EVENT_CATEGORIES, EVENT_FORM_DEFAULTS } from '@/types/event'
import { checkEventConflicts } from '@/services/eventService'
import {
  fetchAllLayoutPresets,
  type TableLayoutPreset,
  type TableSetupBreakdown,
} from '@/services/tableLayoutService'
import { fetchMenuPresets, type MenuPreset } from '@/services/menuService'
import {
  deriveEventStatus,
  getEventStatusBadge,
  getCategoryColor,
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
  currentTableSetup?: TableSetupBreakdown
  prefillDate?: Date | null
  canManageEvents: boolean
  existingEvents?: RestaurantEvent[]
  submitting?: boolean
  onClose: () => void
  onSave: (data: EventFormData) => Promise<void>
  onEdit: (event: RestaurantEvent) => void
  onDelete: (event: RestaurantEvent) => void
  onCancel: (event: RestaurantEvent) => void
}

// 7 preset colors so all circles + custom color picker fit on a single row
const COLOR_PALETTE = [
  '#14274E', // Navy
  '#6366f1', // Indigo
  '#ec4899', // Pink
  '#d97706', // Amber
  '#16a34a', // Green
  '#dc2626', // Red
  '#0891b2', // Cyan
]

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

interface FormErrors {
  title?: string
  startDate?: string
  startTime?: string
  endDate?: string
  endTime?: string
  maxPax?: string
  presetId?: string
  contactEmail?: string
}

const FORM_LABEL_CLASS = 'block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1'
const FORM_ERROR_CLASS = 'text-[10px] font-bold text-rose-600 mt-1'

function formatEventFullDateRange(startDate: string, endDate: string): string {
  if (!startDate || !endDate) return 'No dates selected'
  const d1 = new Date(startDate + 'T00:00:00')
  const d2 = new Date(endDate + 'T00:00:00')
  const month1 = d1.toLocaleDateString('en-US', { month: 'long' })
  const day1 = d1.getDate()
  const month2 = d2.toLocaleDateString('en-US', { month: 'long' })
  const day2 = d2.getDate()

  if (startDate === endDate) {
    return `${month1} ${day1}`
  }
  return `${month1} ${day1} - ${month2} ${day2}`
}

// ─── Custom Drawer Dropdown (Consistent with Filter & Preset Selectors) ──────

interface DrawerDropdownOption {
  value: string | number
  label: string
  sublabel?: string
  disabled?: boolean
  explanation?: string
}

interface DrawerDropdownProps {
  id: string
  value: string | number
  options: DrawerDropdownOption[]
  onChange: (value: any) => void
  error?: boolean
}

function DrawerDropdown({
  id,
  value,
  options,
  onChange,
  error = false,
}: DrawerDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  const selectedOption = options.find((opt) => String(opt.value) === String(value)) ?? options[0]

  return (
    <div ref={dropdownRef} className="relative w-full" id={id}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-black transition-all cursor-pointer border ${
          error
            ? 'border-rose-400 bg-rose-50/50 text-rose-900'
            : 'bg-slate-100 text-[#14274E] border-slate-300 hover:bg-slate-200 shadow-2xs'
        }`}
      >
        <div className="flex items-center justify-between flex-1 min-w-0 pr-1">
          <span className="truncate">{selectedOption?.label}</span>
          {selectedOption?.sublabel && (
            <span className="text-[10px] text-slate-400 font-bold shrink-0 ml-auto pl-2">
              {selectedOption.sublabel}
            </span>
          )}
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-500 shrink-0 ml-1 transition-transform duration-150 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-2xl shadow-xl border border-slate-200 p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="space-y-1 max-h-56 overflow-y-auto">
            {options.map((option) => {
              const isSelected = String(option.value) === String(value)
              if (option.disabled) {
                return (
                  <div
                    key={String(option.value)}
                    title={option.explanation || 'Capacity is less than required for this event'}
                    className="p-2 rounded-xl text-xs text-slate-400 opacity-40 cursor-not-allowed flex items-center justify-between hover:bg-slate-50 transition-colors"
                  >
                    <span className="truncate">{option.label}</span>
                    {option.sublabel && (
                      <span className="text-[10px] font-bold text-rose-500 shrink-0 ml-auto pl-2">
                        {option.sublabel}
                      </span>
                    )}
                  </div>
                )
              }
              return (
                <button
                  key={String(option.value)}
                  type="button"
                  onClick={() => {
                    onChange(option.value)
                    setIsOpen(false)
                  }}
                  className={`w-full flex items-center justify-between p-2 rounded-xl text-xs transition-colors cursor-pointer text-left ${
                    isSelected
                      ? 'bg-[#14274E] text-[#E9C46A] font-black shadow-xs'
                      : 'hover:bg-slate-50 text-slate-700 font-bold'
                  }`}
                >
                  <div className="flex items-center justify-between flex-1 min-w-0 pr-1">
                    <span className="truncate">{option.label}</span>
                    {option.sublabel && (
                      <span
                        className={`text-[11px] font-bold shrink-0 ml-auto pl-2 ${
                          isSelected ? 'text-[#E9C46A]' : 'text-slate-400'
                        }`}
                      >
                        {option.sublabel}
                      </span>
                    )}
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-[#E9C46A] shrink-0 ml-1.5" />}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function isDateWithinRange(cellDateStr: string, startDate: string, endDate: string): boolean {
  if (!startDate && !endDate) return true

  const cellMs = new Date(cellDateStr + 'T00:00:00').getTime()

  // Case 1: Exactly 1 date selected
  if (startDate === endDate || !startDate || !endDate) {
    const anchor = startDate || endDate
    const anchorMs = new Date(anchor + 'T00:00:00').getTime()
    const diffDays = Math.round(Math.abs(cellMs - anchorMs) / (1000 * 60 * 60 * 24))
    return diffDays <= 6
  }

  // Case 2: Multi-day range already selected
  if (cellDateStr === startDate || cellDateStr === endDate) return true

  const startMs = new Date(startDate + 'T00:00:00').getTime()
  const endMs = new Date(endDate + 'T00:00:00').getTime()

  if (cellDateStr >= startDate && cellDateStr <= endDate) return true

  if (cellDateStr < startDate) {
    const diffDays = Math.round((endMs - cellMs) / (1000 * 60 * 60 * 24))
    return diffDays <= 6
  }

  if (cellDateStr > endDate) {
    const diffDays = Math.round((cellMs - startMs) / (1000 * 60 * 60 * 24))
    return diffDays <= 6
  }

  return false
}

// ─── Mini Calendar Range Picker Component ─────────────────────────────────────

interface MiniCalendarPickerProps {
  startDate: string // 'YYYY-MM-DD'
  endDate: string   // 'YYYY-MM-DD'
  onSelectRange: (start: string, end: string) => void
}

function MiniCalendarPicker({
  startDate,
  endDate,
  onSelectRange,
}: MiniCalendarPickerProps) {
  const initialDate = startDate ? new Date(startDate + 'T00:00:00') : new Date()
  const [viewYear, setViewYear] = useState(initialDate.getFullYear())
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth())
  const [warningMsg, setWarningMsg] = useState<string | null>(null)

  useEffect(() => {
    if (startDate) {
      const d = new Date(startDate + 'T00:00:00')
      if (!isNaN(d.getTime())) {
        setViewYear(d.getFullYear())
        setViewMonth(d.getMonth())
      }
    }
  }, [startDate])

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear((y) => y - 1)
    } else {
      setViewMonth((m) => m - 1)
    }
  }

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear((y) => y + 1)
    } else {
      setViewMonth((m) => m + 1)
    }
  }

  // Generate grid dates (Sunday to Saturday)
  const firstOfMonth = new Date(viewYear, viewMonth, 1)
  const lastOfMonth = new Date(viewYear, viewMonth + 1, 0)
  const startOffset = firstOfMonth.getDay() // 0=Sun, 1=Mon, ..., 6=Sat

  const cells: { dateStr: string; dayNumber: number; isCurrentMonth: boolean }[] = []

  // Prev month padding
  for (let i = startOffset; i > 0; i--) {
    const d = new Date(viewYear, viewMonth, 1 - i)
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    cells.push({ dateStr, dayNumber: d.getDate(), isCurrentMonth: false })
  }

  // Current month
  for (let i = 1; i <= lastOfMonth.getDate(); i++) {
    const d = new Date(viewYear, viewMonth, i)
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    cells.push({ dateStr, dayNumber: i, isCurrentMonth: true })
  }

  // Next month padding
  let nextDay = 1
  while (cells.length % 7 !== 0) {
    const d = new Date(viewYear, viewMonth + 1, nextDay++)
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    cells.push({ dateStr, dayNumber: d.getDate(), isCurrentMonth: false })
  }

  /**
   * Selection State Machine:
   * 1. If no date selected: clicking D sets startDate = D, endDate = D (single day).
   * 2. If one date selected (startDate === endDate):
   *    - Clicking same date deselects it -> '' & ''.
   *    - Clicking different date sets multi-day (earlier is start, later is end, max 1 week).
   * 3. If two dates selected (startDate !== endDate):
   *    - Clicking current startDate deselects start date (only endDate remains).
   *    - Clicking current endDate deselects end date (only startDate remains).
   *    - Clicking any other date: moves the closer boundary.
   */
  const handleDayClick = (clickedDate: string) => {
    setWarningMsg(null)

    // Cannot click dates outside 1-week range
    if (!isDateWithinRange(clickedDate, startDate, endDate)) {
      return
    }

    // Case 1: No dates selected
    if (!startDate || !endDate) {
      onSelectRange(clickedDate, clickedDate)
      return
    }

    // Case 2: Exactly one date currently selected
    if (startDate === endDate) {
      if (clickedDate === startDate) {
        onSelectRange('', '')
        return
      }

      const t1 = new Date(startDate + 'T00:00:00').getTime()
      const t2 = new Date(clickedDate + 'T00:00:00').getTime()
      const diffDays = Math.round(Math.abs(t2 - t1) / (1000 * 60 * 60 * 24))

      if (diffDays > 6) {
        setWarningMsg('Maximum event duration is 1 week (7 days). Selection set to this date.')
        onSelectRange(clickedDate, clickedDate)
        return
      }

      const start = t1 <= t2 ? startDate : clickedDate
      const end = t1 <= t2 ? clickedDate : startDate
      onSelectRange(start, end)
      return
    }

    // Case 3: Two dates currently selected
    if (clickedDate === startDate) {
      onSelectRange(endDate, endDate)
      return
    }

    if (clickedDate === endDate) {
      onSelectRange(startDate, startDate)
      return
    }

    const clickTime = new Date(clickedDate + 'T00:00:00').getTime()
    const startTime = new Date(startDate + 'T00:00:00').getTime()
    const endTime = new Date(endDate + 'T00:00:00').getTime()

    const distToStart = Math.abs(clickTime - startTime)
    const distToEnd = Math.abs(clickTime - endTime)

    if (distToStart < distToEnd) {
      const newStart = clickedDate <= endDate ? clickedDate : endDate
      const newEnd = clickedDate <= endDate ? endDate : clickedDate
      const diffDays = Math.round((new Date(newEnd + 'T00:00:00').getTime() - new Date(newStart + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24))
      if (diffDays > 6) return
      onSelectRange(newStart, newEnd)
    } else {
      const newStart = clickedDate >= startDate ? startDate : clickedDate
      const newEnd = clickedDate >= startDate ? clickedDate : startDate
      const diffDays = Math.round((new Date(newEnd + 'T00:00:00').getTime() - new Date(newStart + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24))
      if (diffDays > 6) return
      onSelectRange(newStart, newEnd)
    }
  }

  const todayStr = (() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })()

  return (
    <div className="space-y-2">
      {/* Month Navigation */}
      <div className="flex items-center justify-between px-1">
        <h5 className="text-xs font-black text-[#14274E]">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </h5>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={prevMonth}
            className="p-1 rounded-lg text-slate-500 hover:text-[#14274E] hover:bg-slate-200/60 transition-colors cursor-pointer"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={nextMonth}
            className="p-1 rounded-lg text-slate-500 hover:text-[#14274E] hover:bg-slate-200/60 transition-colors cursor-pointer"
            aria-label="Next month"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Weekday labels (Sunday to Saturday) */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
          <span
            key={idx}
            className={`text-[10px] font-black ${idx === 0 || idx === 6 ? 'text-amber-600/70' : 'text-slate-400'}`}
          >
            {day}
          </span>
        ))}
      </div>

      {/* Calendar Grid with 1-Week Range Date Fading */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map(({ dateStr, dayNumber, isCurrentMonth }) => {
          const hasStart = Boolean(startDate)
          const hasEnd = Boolean(endDate)
          const isStart = hasStart && dateStr === startDate
          const isEnd = hasEnd && dateStr === endDate
          const isBetween = hasStart && hasEnd && dateStr > startDate && dateStr < endDate
          const isToday = dateStr === todayStr
          const isAllowed = isDateWithinRange(dateStr, startDate, endDate)

          return (
            <button
              key={dateStr}
              type="button"
              disabled={!isAllowed}
              onClick={() => {
                if (isAllowed) handleDayClick(dateStr)
              }}
              title={!isAllowed ? 'Date outside 1-week range' : dateStr}
              className={`h-7 w-full flex items-center justify-center rounded-lg text-xs font-bold transition-all relative ${
                !isAllowed
                  ? 'opacity-20 cursor-not-allowed pointer-events-none text-slate-300'
                  : isStart || isEnd
                    ? 'bg-[#14274E] text-[#E9C46A] font-black shadow-xs z-10 cursor-pointer'
                    : isBetween
                      ? 'bg-blue-100/90 text-blue-900 rounded-none font-black cursor-pointer'
                      : isCurrentMonth
                        ? 'text-slate-700 hover:bg-slate-100 cursor-pointer'
                        : 'text-slate-300 hover:bg-slate-50 cursor-pointer'
              } ${isStart && isBetween ? 'rounded-l-lg' : ''} ${isEnd && isBetween ? 'rounded-r-lg' : ''}`}
            >
              <span>{dayNumber}</span>
              {isToday && !isStart && !isEnd && (
                <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-blue-500" />
              )}
            </button>
          )
        })}
      </div>

      {/* Warning Alert */}
      {warningMsg && (
        <div className="p-2 bg-amber-50 border border-amber-200 rounded-xl text-[10px] text-amber-800 font-semibold animate-in fade-in duration-150">
          {warningMsg}
        </div>
      )}
    </div>
  )
}

// ─── Main Event Drawer Component ──────────────────────────────────────────────

export const EventDrawer: React.FC<EventDrawerProps> = ({
  isOpen,
  mode,
  event,
  prefillDate,
  canManageEvents,
  existingEvents = [],
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
  const [conflictChecked, setConflictChecked] = useState(false)
  const [presets, setPresets] = useState<TableLayoutPreset[]>([])
  const [menuPresets, setMenuPresets] = useState<MenuPreset[]>([])

  // Load presets
  useEffect(() => {
    if (!isOpen) return
    fetchAllLayoutPresets().then(setPresets).catch(() => {})
    fetchMenuPresets().then(setMenuPresets).catch(() => {})
  }, [isOpen])

  // Compute event capacity vs layout preset capacity
  const eventGuestCapacity = form.maxPax && /^\d+$/.test(form.maxPax) ? parseInt(form.maxPax, 10) : 0
  const selectedPreset = presets.find((p) => p.LAYOUT_PRESET_ID === form.presetId)
  const selectedPresetCapacity = selectedPreset?.MAX_PAX != null ? Number(selectedPreset.MAX_PAX) : 50
  // An event cannot select a layout with capacity less than the event pax
  const isPresetUnderCapacity = Boolean(form.presetId && eventGuestCapacity > 0 && selectedPresetCapacity < eventGuestCapacity)
  const isTimeInvalid = Boolean(form.startTime && form.endTime && form.startTime >= form.endTime)

  // ESC key listener
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
      const prefillStr = prefillDate
        ? `${prefillDate.getFullYear()}-${String(prefillDate.getMonth() + 1).padStart(2, '0')}-${String(prefillDate.getDate()).padStart(2, '0')}`
        : ''

      setForm({
        ...EVENT_FORM_DEFAULTS,
        startDate: prefillStr,
        endDate: prefillStr,
        location: 'Bill Shaw Restaurant',
        maxPax: '50',
        menuPresetId: null,
        generatesRevenue: true,
      })
    } else if ((mode === 'edit' || mode === 'view') && event) {
      const pax = event.maxPax ?? event.expectedAttendees
      setForm({
        title: event.title,
        description: event.description ?? '',
        category: event.category,
        color: event.color ?? '',
        startDate: isoToDateInput(event.startAt),
        startTime: isoToTimeInput(event.startAt),
        endDate: isoToDateInput(event.endAt),
        endTime: isoToTimeInput(event.endAt),
        location: event.location || 'Bill Shaw Restaurant',
        organizer: event.organizer ?? '',
        maxPax: pax != null ? String(pax) : '50',
        expectedAttendees: pax != null ? String(pax) : '50',
        presetId: event.presetId ?? null,
        menuPresetId: event.menuPresetId ?? null,
        isActive: event.isActive ?? false,
        generatesRevenue: event.generatesRevenue !== false,
        contactName: event.contactName ?? '',
        contactPhone: event.contactPhone ?? '',
        contactEmail: event.contactEmail ?? '',
        notes: event.notes ?? '',
      })
    }
  }, [isOpen, mode, event, prefillDate])

  const setField = <K extends keyof EventFormData>(key: K, value: EventFormData[K]) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value }
      if ((key === 'startTime' || key === 'endTime') && next.startTime && next.endTime) {
        if (next.startTime >= next.endTime) {
          setErrors((errs) => ({
            ...errs,
            endTime: 'End time must be after start time (e.g. 9:00 AM to 9:00 PM)',
          }))
        } else {
          setErrors((errs) => {
            const copy = { ...errs }
            delete copy.endTime
            return copy
          })
        }
      }
      return next
    })

    if (key !== 'startTime' && key !== 'endTime') {
      setErrors((prev) => ({ ...prev, [key]: undefined }))
    }

    if (key === 'startDate' || key === 'startTime' || key === 'endDate' || key === 'endTime') {
      setConflicts([])
      setConflictChecked(false)
    }
  }

  // Conflict check debounced silently (no loading spinner shown to user)
  const runConflictCheck = useCallback(async () => {
    if (!form.startDate || !form.startTime || !form.endDate || !form.endTime) return
    if (form.startTime >= form.endTime) return
    const startAt = new Date(`${form.startDate}T${form.startTime}`).toISOString()
    const endAt = new Date(`${form.endDate}T${form.endTime}`).toISOString()
    if (isNaN(Date.parse(startAt)) || isNaN(Date.parse(endAt))) return
    const found = await checkEventConflicts(startAt, endAt, event?.eventId)
    setConflicts(found)
    setConflictChecked(true)
  }, [form.startDate, form.startTime, form.endDate, form.endTime, event?.eventId])

  useEffect(() => {
    if (mode === 'view') return
    if (!form.startDate || !form.endDate) return
    const timer = setTimeout(runConflictCheck, 600)
    return () => clearTimeout(timer)
  }, [form.startDate, form.startTime, form.endDate, form.endTime, mode, runConflictCheck])

  const validate = (): boolean => {
    const errs: FormErrors = {}
    if (!form.title.trim()) errs.title = 'Event name is required'
    if (!form.startDate || !form.endDate) {
      errs.startDate = 'Please select event schedule dates on the calendar'
    }
    if (!form.startTime) errs.startTime = 'Start time is required'
    if (!form.endTime) errs.endTime = 'End time is required'

    // Daily operating hours check: endTime must be strictly after startTime
    if (form.startTime && form.endTime && form.startTime >= form.endTime) {
      errs.endTime = 'End time must be after start time (e.g. 9:00 AM to 9:00 PM)'
    }

    // Maximum length validation: 1 week (7 days)
    if (form.startDate && form.endDate) {
      const d1 = new Date(form.startDate + 'T00:00:00')
      const d2 = new Date(form.endDate + 'T00:00:00')
      const diffDays = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24))
      if (diffDays > 6) {
        errs.endDate = 'Maximum event length is 1 week (7 days).'
      }
    }

    if (conflicts.length > 0) {
      const bufferConflict = conflicts.find((c) => c.conflictType === 'buffer')
      if (bufferConflict) {
        errs.startTime = `3-hour buffer required: ${bufferConflict.bufferReason || 'must be at least 3 hours apart'}`
      } else {
        errs.startTime = 'Overlaps with another scheduled event. Simultaneous events are not permitted.'
      }
    }

    if (form.title.trim() && form.startDate) {
      const normTitle = form.title.trim().toLowerCase()
      const hasDup = existingEvents.some((e) => {
        if (e.deletedAt || e.isCancelled) return false
        if (event && e.eventId === event.eventId) return false
        const eDate = e.startAt.slice(0, 10)
        return eDate === form.startDate && e.title.trim().toLowerCase() === normTitle
      })
      if (hasDup) {
        errs.title = `An event titled "${form.title.trim()}" already exists on this date.`
      }
    }

    if (!form.maxPax) {
      errs.maxPax = 'Max pax is required'
    } else {
      const parsed = parseInt(form.maxPax, 10)
      if (isNaN(parsed) || parsed < 1 || parsed > 50) {
        errs.maxPax = 'Max pax cannot exceed 50'
      }
    }

    if (isPresetUnderCapacity) {
      errs.presetId = `Layout preset capacity (${selectedPresetCapacity} Pax) cannot accommodate event guest count (${eventGuestCapacity} Pax).`
    }

    if (form.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail)) {
      errs.contactEmail = 'Invalid email address'
    }

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    if (!conflictChecked && form.startDate && form.startTime && form.endDate && form.endTime) {
      const startAt = new Date(`${form.startDate}T${form.startTime}`).toISOString()
      const endAt = new Date(`${form.endDate}T${form.endTime}`).toISOString()
      const found = await checkEventConflicts(startAt, endAt, event?.eventId)
      if (found.length > 0) {
        setConflicts(found)
        setConflictChecked(true)
        const bufferConflict = found.find((c) => c.conflictType === 'buffer')
        setErrors((prev) => ({
          ...prev,
          startTime: bufferConflict
            ? `3-hour buffer required: ${bufferConflict.bufferReason || 'must be at least 3 hours apart'}`
            : 'Overlaps with another scheduled event. Simultaneous events are not permitted.',
        }))
        return
      }
    }

    const sanitizedPax = Math.min(50, Math.max(1, parseInt(form.maxPax || '50', 10)))
    await onSave({
      ...form,
      maxPax: String(sanitizedPax),
      expectedAttendees: String(sanitizedPax),
    })
  }

  if (!isOpen) return null

  const isView = mode === 'view'
  const isFormMode = mode === 'create' || mode === 'edit'
  const eventStatus = event ? deriveEventStatus(event) : null
  const statusBadge = eventStatus ? getEventStatusBadge(eventStatus) : null
  const catColor = event ? (event.color || getCategoryColor(event.category)) : (form.color || '#14274E')

  // Calculate duration in days
  const durationDays = (() => {
    if (!form.startDate || !form.endDate) return 0
    const d1 = new Date(form.startDate + 'T00:00:00')
    const d2 = new Date(form.endDate + 'T00:00:00')
    const diff = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24))
    return Math.max(1, diff + 1)
  })()

  // Category dropdown options
  const categoryDropdownOptions: DrawerDropdownOption[] = EVENT_CATEGORIES.map((c) => ({
    value: c,
    label: c,
  }))

  // Table Presets Dropdown:
  // - "Regular Operation" with sublabel "50 Pax" (NO "Default" text)
  // - Presets with capacity < event pax appear at the BOTTOM, faded, disabled, with hover explanation
  // - Sublabel with Pax is aligned to the right
  const validPresetOptions: DrawerDropdownOption[] = []
  const invalidPresetOptions: DrawerDropdownOption[] = []

  if (eventGuestCapacity <= 50) {
    validPresetOptions.push({
      value: '',
      label: 'Regular Operation',
      sublabel: '50 Pax',
    })
  } else {
    invalidPresetOptions.push({
      value: '',
      label: 'Regular Operation',
      sublabel: `50 Pax < ${eventGuestCapacity} Pax`,
      disabled: true,
      explanation: `Regular Operation accommodates 50 Pax, which is less than the ${eventGuestCapacity} Pax set for this event.`,
    })
  }

  presets.forEach((p) => {
    const presetCap = p.MAX_PAX != null ? Number(p.MAX_PAX) : 50
    const isUnder = eventGuestCapacity > 0 && presetCap < eventGuestCapacity
    const optionItem: DrawerDropdownOption = {
      value: p.LAYOUT_PRESET_ID,
      label: p.PRESET_NAME,
      sublabel: `${presetCap} Pax`,
      disabled: isUnder,
      explanation: isUnder
        ? `Cannot select: this layout accommodates ${presetCap} Pax, which is less than the ${eventGuestCapacity} Pax set for this event.`
        : undefined,
    }

    if (isUnder) {
      invalidPresetOptions.push(optionItem)
    } else {
      validPresetOptions.push(optionItem)
    }
  })

  // Valid presets first, invalid presets at the bottom
  const presetDropdownOptions = [...validPresetOptions, ...invalidPresetOptions]

  // Menu Preset Dropdown: "None (Standard)" renamed to just "Default"
  const menuPresetDropdownOptions: DrawerDropdownOption[] = [
    { value: '', label: 'Default' },
    ...menuPresets.map((m) => ({
      value: m.PRESET_ID,
      label: m.PRESET_NAME,
    })),
  ]

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={submitting ? undefined : onClose}
      />

      {/* Main Container Wrapper */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 pointer-events-none overflow-y-auto">
        <div
          className={`pointer-events-auto flex flex-col lg:flex-row items-start gap-4 w-full ${
            isFormMode ? 'max-w-5xl' : 'max-w-xl'
          } max-h-[calc(100vh-2.5rem)] animate-in fade-in zoom-in-95 duration-250`}
        >
          {/* ── CARD 1: Event Form / Details Modal Container ── */}
          <div className="flex-1 bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden min-h-0 w-full">
            {/* Drawer Header */}
            <div
              className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between shrink-0"
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
                      ? 'Fill in event details and select dates in the schedule panel.'
                      : mode === 'edit'
                        ? 'Update event details and adjust schedule dates.'
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

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5">
              {/* ── VIEW MODE ── */}
              {isView && event && (
                <div className="space-y-4">
                  {/* Status + Category with Assigned Color */}
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
                        border: `1px solid ${catColor}35`,
                      }}
                    >
                      {event.category}
                    </span>
                    {event.color && (
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-white shadow-xs"
                        style={{ backgroundColor: event.color }}
                        title={`Assigned color: ${event.color}`}
                      />
                    )}
                  </div>

                  {/* Core Info Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <DetailRow
                      icon={<CalendarDays className="w-3.5 h-3.5" />}
                      label="Date Duration"
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
                    <DetailRow
                      icon={<Users className="w-3.5 h-3.5" />}
                      label="Guest Count"
                      value={`${event.maxPax ?? event.expectedAttendees ?? 50} Pax`}
                    />
                    {event.presetId && (
                      <DetailRow
                        icon={<Layout className="w-3.5 h-3.5" />}
                        label="Linked Table Layout"
                        value={`${presets.find((p) => p.LAYOUT_PRESET_ID === event.presetId)?.PRESET_NAME ?? `Preset #${event.presetId}`} (${presets.find((p) => p.LAYOUT_PRESET_ID === event.presetId)?.MAX_PAX ?? 50} Pax)`}
                      />
                    )}
                    {event.menuPresetId && (
                      <DetailRow
                        icon={<UtensilsCrossed className="w-3.5 h-3.5" />}
                        label="Linked Menu Preset"
                        value={menuPresets.find((m) => m.PRESET_ID === event.menuPresetId)?.PRESET_NAME ?? 'Default'}
                      />
                    )}
                    <DetailRow
                      icon={<Check className="w-3.5 h-3.5" />}
                      label="Revenue Generation"
                      value={event.generatesRevenue !== false ? 'Revenue Generating' : 'Zero Revenue (₱0.00 / Complimentary)'}
                    />
                  </div>

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
                      <p className="text-xs text-slate-600 bg-slate-50 rounded-xl p-3 border border-slate-100">{event.notes}</p>
                    </div>
                  )}
                </div>
              )}

              {/* ── FORM MODE ── */}
              {isFormMode && (
                <div className="space-y-4">
                  {/* Event Name */}
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

                  {/* Category & Color */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                    {/* Category with Redesigned Custom Dropdown */}
                    <div className="space-y-1.5">
                      <label className={FORM_LABEL_CLASS}>
                        <Tag className="w-3 h-3 inline mr-1" />Category
                      </label>
                      <DrawerDropdown
                        id="event-category-select"
                        value={form.category}
                        options={categoryDropdownOptions}
                        onChange={(val) => setField('category', val as typeof form.category)}
                      />
                    </div>

                    {/* Color Selector with Presets in ONE single row + Custom Color Picker */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className={FORM_LABEL_CLASS}>
                          <Palette className="w-3 h-3 inline mr-1" />Color
                        </label>
                        {form.color && (
                          <span className="text-[10px] font-mono font-bold text-slate-500 uppercase">
                            {form.color}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-nowrap pt-0.5">
                        {COLOR_PALETTE.map((color) => {
                          const isSelected = form.color === color
                          return (
                            <button
                              key={color}
                              type="button"
                              onClick={() => setField('color', color)}
                              className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full border-2 transition-all cursor-pointer flex items-center justify-center shrink-0 ${
                                isSelected
                                  ? 'border-slate-800 ring-2 ring-[#14274E]/30 scale-110 shadow-xs'
                                  : 'border-slate-200 hover:scale-105'
                              }`}
                              style={{ backgroundColor: color }}
                              title={`Preset: ${color}`}
                            >
                              {isSelected && <Check className="w-3.5 h-3.5 text-white drop-shadow-xs" />}
                            </button>
                          )
                        })}

                        {/* Custom Color Selector Picker */}
                        <label
                          className={`relative w-6 h-6 sm:w-7 sm:h-7 rounded-full border-2 cursor-pointer flex items-center justify-center transition-all shrink-0 ${
                            form.color && !COLOR_PALETTE.includes(form.color)
                              ? 'border-slate-800 ring-2 ring-[#14274E]/30 scale-110 shadow-xs'
                              : 'border-slate-300 hover:scale-105'
                          }`}
                          style={{
                            background:
                              form.color && !COLOR_PALETTE.includes(form.color)
                                ? form.color
                                : 'conic-gradient(from 180deg at 50% 50%, #dc2626, #d97706, #16a34a, #0891b2, #6366f1, #ec4899, #dc2626)',
                          }}
                          title="Choose custom color"
                        >
                          <input
                            type="color"
                            value={form.color || '#14274E'}
                            onChange={(e) => setField('color', e.target.value)}
                            className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                          />
                          {form.color && !COLOR_PALETTE.includes(form.color) ? (
                            <Check className="w-3.5 h-3.5 text-white drop-shadow-xs" />
                          ) : (
                            <Plus className="w-3.5 h-3.5 text-white drop-shadow-xs stroke-[3]" />
                          )}
                        </label>
                      </div>
                    </div>
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
                        placeholder="Bill Shaw Restaurant"
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

                  {/* Max Pax (Shorter) & Table Layout Preset (Longer) & Menu Preset */}
                  <div className="flex flex-col sm:flex-row items-start gap-3">
                    {/* Max Pax - Shorter field */}
                    <div className="w-full sm:w-28 shrink-0 space-y-1.5">
                      <label htmlFor="event-max-pax" className={FORM_LABEL_CLASS}>
                        <Users className="w-3 h-3 inline mr-1" />Max Pax <span className="text-rose-500">*</span>
                      </label>
                      <input
                        id="event-max-pax"
                        type="number"
                        min={1}
                        max={50}
                        value={form.maxPax}
                        onChange={(e) => {
                          const raw = e.target.value
                          if (raw === '') {
                            setField('maxPax', '')
                            return
                          }
                          const val = parseInt(raw, 10)
                          if (isNaN(val)) return
                          if (val > 50) {
                            setField('maxPax', '50')
                          } else if (val < 1) {
                            setField('maxPax', '1')
                          } else {
                            setField('maxPax', String(val))
                          }
                        }}
                        placeholder="50"
                        className={formInputClass(!!errors.maxPax)}
                      />
                      {errors.maxPax && <p className={FORM_ERROR_CLASS}>{errors.maxPax}</p>}
                    </div>

                    {/* Table Layout Preset - Longer field with right-aligned pax */}
                    <div className="w-full sm:flex-1 min-w-0 space-y-1.5">
                      <label className={FORM_LABEL_CLASS}>
                        <Layout className="w-3 h-3 inline mr-1" />Table Layout
                      </label>
                      <DrawerDropdown
                        id="event-table-preset-select"
                        value={form.presetId ? String(form.presetId) : ''}
                        options={presetDropdownOptions}
                        onChange={(val) => setField('presetId', val ? Number(val) : null)}
                        error={!!errors.presetId || isPresetUnderCapacity}
                      />
                      {errors.presetId && <p className={FORM_ERROR_CLASS}>{errors.presetId}</p>}
                    </div>

                    {/* Menu Preset - "Default" */}
                    <div className="w-full sm:w-44 md:w-48 shrink-0 space-y-1.5">
                      <label className={FORM_LABEL_CLASS}>
                        <UtensilsCrossed className="w-3 h-3 inline mr-1" />Menu Preset
                      </label>
                      <DrawerDropdown
                        id="event-menu-preset-select"
                        value={form.menuPresetId ? String(form.menuPresetId) : ''}
                        options={menuPresetDropdownOptions}
                        onChange={(val) => setField('menuPresetId', val ? Number(val) : null)}
                      />
                    </div>
                  </div>

                  {/* Insufficient Capacity Alert */}
                  {isPresetUnderCapacity && (
                    <div className="p-2.5 bg-rose-50 border border-rose-300 rounded-xl flex items-start gap-2 text-[11px] text-rose-900 animate-in fade-in duration-150">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">Capacity Too Small: </span>
                        Layout preset <span className="font-black">"{selectedPreset?.PRESET_NAME}"</span> accommodates only <span className="font-black">{selectedPresetCapacity} Pax</span>, which cannot seat the <span className="font-black">{eventGuestCapacity} guests</span> set for this event.
                      </div>
                    </div>
                  )}

                  {/* Generates Revenue Checkbox */}
                  <div className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-100/70 transition-colors">
                    <input
                      id="event-generates-revenue"
                      type="checkbox"
                      checked={form.generatesRevenue}
                      onChange={(e) => setField('generatesRevenue', e.target.checked)}
                      className="w-4 h-4 rounded text-[#14274E] focus:ring-[#14274E] cursor-pointer"
                    />
                    <label htmlFor="event-generates-revenue" className="text-xs font-bold text-slate-800 cursor-pointer select-none flex-1">
                      <div className="flex items-center justify-between">
                        <span>Generate's Revenue?</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${form.generatesRevenue ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                          {form.generatesRevenue ? 'Revenue Generating' : 'Zero Revenue (₱0.00)'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 font-normal mt-0.5">
                        {form.generatesRevenue
                          ? 'Orders placed on this event will be billed normally and reported to event revenue.'
                          : 'Starting a business day on this event will make all price calculations ₱0.00 (no revenue earned).'}
                      </p>
                    </label>
                  </div>

                  {/* Contact Person Card */}
                  <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2.5">
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
                      rows={2}
                      className={`${formInputClass(false)} resize-none`}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Drawer Footer */}
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
                    disabled={submitting || conflicts.length > 0 || isPresetUnderCapacity || isTimeInvalid}
                    onClick={handleSubmit}
                    title={
                      isPresetUnderCapacity
                        ? 'Cannot save: Selected layout preset capacity is less than event pax'
                        : isTimeInvalid
                          ? 'Cannot save: End time must be after start time'
                          : undefined
                    }
                    className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#14274E] hover:bg-[#1a3468] text-white text-xs font-black shadow-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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

          {/* ── CARD 2 Column: Separate Event Schedule Modal + Floating Conflict Error ── */}
          {isFormMode && (
            <div className="w-full lg:w-80 xl:w-88 flex flex-col gap-3 shrink-0 self-start">
              {/* Event Schedule Modal Container */}
              <div className="w-full bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                      <CalendarDays className="w-4 h-4" />
                    </div>
                    <h3 className="text-xs font-black text-[#14274E] uppercase tracking-wider">
                      Event Schedule
                    </h3>
                  </div>
                </div>

                {/* Body */}
                <div className="p-4 space-y-3 flex-1 overflow-y-auto">
                  {/* Duration Display Box: Full dates + faded duration subtext */}
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 shadow-2xs">
                    <p className="text-xs font-black text-[#14274E]">
                      {form.startDate && form.endDate
                        ? formatEventFullDateRange(form.startDate, form.endDate)
                        : 'No dates selected'}
                    </p>
                    <p className="text-[11px] font-semibold text-slate-400 mt-0.5">
                      {form.startDate && form.endDate
                        ? `${durationDays} ${durationDays === 1 ? 'Day' : 'Days'}`
                        : 'Click a date on the calendar'}
                    </p>
                  </div>

                  {/* Mini Calendar Range Picker */}
                  <MiniCalendarPicker
                    startDate={form.startDate}
                    endDate={form.endDate}
                    onSelectRange={(start, end) => {
                      setField('startDate', start)
                      setField('endDate', end)
                    }}
                  />

                  {/* Start Time & End Time moved below the calendar */}
                  <div className="pt-3 border-t border-slate-100">
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <label htmlFor="event-start-time" className="block text-[10px] font-black uppercase tracking-wider text-slate-500">
                          <Clock className="w-3 h-3 inline mr-1 text-slate-400" />Start Time <span className="text-rose-500">*</span>
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
                      <div className="space-y-1">
                        <label htmlFor="event-end-time" className="block text-[10px] font-black uppercase tracking-wider text-slate-500">
                          <Clock className="w-3 h-3 inline mr-1 text-slate-400" />End Time <span className="text-rose-500">*</span>
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
                  </div>

                  {errors.startDate && <p className={FORM_ERROR_CLASS}>{errors.startDate}</p>}
                  {errors.endDate && <p className={FORM_ERROR_CLASS}>{errors.endDate}</p>}
                </div>
              </div>

              {/* Floating Red Conflict Error Message below the Schedule Modal */}
              {conflicts.length > 0 && (
                <EventConflictBanner conflicts={conflicts} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

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
