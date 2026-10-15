import React, { useState, useEffect, useRef } from 'react'
import { Search, X, Plus, ChevronDown, Check } from 'lucide-react'
import type { EventFilterParams, EventCategory, EventSortOrder, EventGuestCountFilter, EventDateFilter } from '@/types/event'
import { EVENT_CATEGORIES } from '@/types/event'

interface EventsFilterBarProps {
  filters: EventFilterParams
  onFilterChange: (f: Partial<EventFilterParams>) => void
  onAddEvent: () => void
  canManageEvents: boolean
}

interface CustomDropdownProps<T extends string> {
  id: string
  labelPrefix: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
  isOpen: boolean
  onToggle: () => void
  isNonDefault?: boolean
}

function CustomDropdown<T extends string>({
  id,
  labelPrefix,
  value,
  options,
  onChange,
  isOpen,
  onToggle,
  isNonDefault = false,
}: CustomDropdownProps<T>) {
  const selectedOption = options.find((opt) => opt.value === value) ?? options[0]

  return (
    <div className="relative inline-block text-left" id={id}>
      <button
        type="button"
        onClick={onToggle}
        className={`flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer border ${
          isNonDefault
            ? 'bg-blue-50/90 text-[#14274E] border-blue-300 hover:bg-blue-100/90 shadow-2xs'
            : 'bg-slate-100 text-[#14274E] border-slate-300 hover:bg-slate-200'
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0 truncate">
          <span className="text-slate-500 font-bold shrink-0">{labelPrefix}</span>
          <span className="truncate">{selectedOption?.label}</span>
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-500 shrink-0 ml-0.5 transition-transform duration-150 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 min-w-[200px] w-max max-w-[280px] bg-white rounded-2xl shadow-xl border border-slate-200 p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="space-y-1 max-h-56 overflow-y-auto">
            {options.map((option) => {
              const isSelected = option.value === value
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value)
                    onToggle()
                  }}
                  className={`w-full flex items-center justify-between p-2 rounded-xl text-xs transition-colors cursor-pointer text-left ${
                    isSelected
                      ? 'bg-[#14274E] text-[#E9C46A] font-black shadow-xs'
                      : 'hover:bg-slate-50 text-slate-700 font-bold'
                  }`}
                >
                  <span className="truncate mr-2">{option.label}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-[#E9C46A] shrink-0" />}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export const EventsFilterBar: React.FC<EventsFilterBarProps> = ({
  filters,
  onFilterChange,
  onAddEvent,
  canManageEvents,
}) => {
  const [localSearch, setLocalSearch] = useState(filters.searchQuery)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== filters.searchQuery) {
        onFilterChange({ searchQuery: localSearch })
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [localSearch, filters.searchQuery, onFilterChange])

  useEffect(() => {
    setLocalSearch(filters.searchQuery)
  }, [filters.searchQuery])

  // Click outside listener to close open dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setOpenDropdown(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const hasActiveFilters = Boolean(
    (filters.category && filters.category !== 'All') ||
    (filters.dateFilter && filters.dateFilter !== 'all') ||
    (filters.guestCount && filters.guestCount !== 'all') ||
    filters.sortOrder === 'farthest' ||
    filters.searchQuery
  )

  const toggleDropdown = (key: string) => {
    setOpenDropdown((prev) => (prev === key ? null : key))
  }

  // Sort Options
  const sortOptions: { value: EventSortOrder; label: string }[] = [
    { value: 'nearest', label: 'Nearest Date' },
    { value: 'farthest', label: 'Farthest Date' },
  ]

  // Category Options
  const categoryOptions: { value: EventCategory | 'All'; label: string }[] = [
    { value: 'All', label: 'All Categories' },
    ...EVENT_CATEGORIES.map((c) => ({ value: c, label: c })),
  ]

  // Guest Count Options: Ascending / Descending as requested
  const guestCountOptions: { value: EventGuestCountFilter; label: string }[] = [
    { value: 'all', label: 'All Guest Counts' },
    { value: 'asc', label: 'Ascending Guest Count' },
    { value: 'desc', label: 'Descending Guest Count' },
  ]

  // Date Options
  const dateOptions: { value: EventDateFilter; label: string }[] = [
    { value: 'all', label: 'All Dates' },
    { value: 'today', label: 'Today' },
    { value: 'this_week', label: 'This Week' },
    { value: 'this_month', label: 'This Month' },
    { value: 'upcoming', label: 'Upcoming' },
  ]

  return (
    <div
      ref={barRef}
      className="p-3 sm:p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-2.5 shrink-0"
    >
      {/* ── Top Row: Search + Add Event ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
        {/* Search */}
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            id="events-search-input"
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Search by event name, location, category..."
            className="w-full pl-10 pr-9 py-2 rounded-xl border border-slate-200 bg-slate-50/50 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#14274E] focus:bg-white transition-all"
          />
          {localSearch && (
            <button
              type="button"
              onClick={() => {
                setLocalSearch('')
                onFilterChange({ searchQuery: '' })
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Add Event */}
        {canManageEvents && (
          <button
            id="add-event-btn"
            type="button"
            onClick={onAddEvent}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#14274E] hover:bg-[#1a3468] text-[#E9C46A] text-xs font-black shadow-xs active:scale-98 transition-all cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Add Event</span>
          </button>
        )}
      </div>

      {/* ── Bottom Row: Custom Dropdown Filters ── */}
      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
        {/* a. Nearest or Farthest */}
        <CustomDropdown
          id="events-sort-dropdown"
          labelPrefix="Sort:"
          value={filters.sortOrder || 'nearest'}
          options={sortOptions}
          onChange={(val) => onFilterChange({ sortOrder: val })}
          isOpen={openDropdown === 'sort'}
          onToggle={() => toggleDropdown('sort')}
          isNonDefault={filters.sortOrder === 'farthest'}
        />

        {/* b. Category */}
        <CustomDropdown
          id="events-category-dropdown"
          labelPrefix="Category:"
          value={filters.category}
          options={categoryOptions}
          onChange={(val) => onFilterChange({ category: val })}
          isOpen={openDropdown === 'category'}
          onToggle={() => toggleDropdown('category')}
          isNonDefault={filters.category !== 'All'}
        />

        {/* c. Guest Count */}
        <CustomDropdown
          id="events-guest-count-dropdown"
          labelPrefix="Guests:"
          value={filters.guestCount || 'all'}
          options={guestCountOptions}
          onChange={(val) => onFilterChange({ guestCount: val })}
          isOpen={openDropdown === 'guestCount'}
          onToggle={() => toggleDropdown('guestCount')}
          isNonDefault={filters.guestCount !== 'all'}
        />

        {/* d. Dates */}
        <CustomDropdown
          id="events-date-dropdown"
          labelPrefix="Dates:"
          value={filters.dateFilter}
          options={dateOptions}
          onChange={(val) => onFilterChange({ dateFilter: val })}
          isOpen={openDropdown === 'dates'}
          onToggle={() => toggleDropdown('dates')}
          isNonDefault={filters.dateFilter !== 'all'}
        />

        {/* Reset Filter Button */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={() =>
              onFilterChange({
                category: 'All',
                dateFilter: 'all',
                guestCount: 'all',
                sortOrder: 'nearest',
                searchQuery: '',
                status: 'All',
              })
            }
            className="text-[11px] font-bold text-slate-400 hover:text-slate-700 underline cursor-pointer ml-auto"
          >
            Reset Filters
          </button>
        )}
      </div>
    </div>
  )
}
