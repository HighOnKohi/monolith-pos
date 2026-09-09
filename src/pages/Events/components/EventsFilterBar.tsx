import React, { useState, useEffect } from 'react'
import { Search, X, Plus, Filter, RotateCcw } from 'lucide-react'
import type { EventFilterParams, EventStatus, EventCategory } from '@/types/event'
import { EVENT_CATEGORIES } from '@/types/event'

interface EventsFilterBarProps {
  filters: EventFilterParams
  onFilterChange: (f: Partial<EventFilterParams>) => void
  onClearFilters: () => void
  onAddEvent: () => void
  canManageEvents: boolean
}

const STATUS_OPTIONS: Array<EventStatus | 'All'> = ['All', 'Scheduled', 'Ongoing', 'Completed', 'Cancelled']

const DATE_FILTER_LABELS: Record<EventFilterParams['dateFilter'], string> = {
  all: 'All Dates',
  today: 'Today',
  this_week: 'This Week',
  this_month: 'This Month',
  upcoming: 'Upcoming',
}

export const EventsFilterBar: React.FC<EventsFilterBarProps> = ({
  filters,
  onFilterChange,
  onClearFilters,
  onAddEvent,
  canManageEvents,
}) => {
  const [localSearch, setLocalSearch] = useState(filters.searchQuery)

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

  const hasActiveFilters =
    filters.searchQuery.trim().length > 0 ||
    filters.status !== 'All' ||
    filters.category !== 'All' ||
    filters.dateFilter !== 'all'

  return (
    <div className="p-3 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-2 shrink-0">
      {/* ── Top Row: Search + Add ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            id="events-search-input"
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Search by name, location, organizer, category..."
            className="w-full pl-10 pr-9 py-1.5 rounded-xl border border-slate-200 bg-slate-50/50 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#14274E] focus:bg-white transition-all font-medium"
          />
          {localSearch && (
            <button
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
            onClick={onAddEvent}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#14274E] hover:bg-[#1a3468] text-white text-xs font-black shadow-xs active:scale-98 transition-all cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Event</span>
          </button>
        )}
      </div>

      {/* ── Bottom Row: Filters ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-100">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1">
            <Filter className="w-3 h-3" />
            Filters
          </span>

          {/* Status Filter */}
          <div className="flex items-center gap-1 flex-wrap">
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s}
                onClick={() => onFilterChange({ status: s })}
                className={[
                  'px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer',
                  filters.status === s
                    ? 'bg-[#14274E] text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                ].join(' ')}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Category Select */}
          <select
            id="events-category-filter"
            value={filters.category}
            onChange={(e) => onFilterChange({ category: e.target.value as EventCategory | 'All' })}
            className="px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-700 focus:outline-none focus:border-[#14274E] cursor-pointer"
          >
            <option value="All">All Categories</option>
            {EVENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {/* Date Filter */}
          <select
            id="events-date-filter"
            value={filters.dateFilter}
            onChange={(e) => onFilterChange({ dateFilter: e.target.value as EventFilterParams['dateFilter'] })}
            className="px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-700 focus:outline-none focus:border-[#14274E] cursor-pointer"
          >
            {(Object.keys(DATE_FILTER_LABELS) as EventFilterParams['dateFilter'][]).map((k) => (
              <option key={k} value={k}>{DATE_FILTER_LABELS[k]}</option>
            ))}
          </select>
        </div>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <button
            onClick={() => {
              setLocalSearch('')
              onClearFilters()
            }}
            className="inline-flex items-center gap-1 px-3 py-1 rounded-lg border border-slate-200 text-[11px] font-bold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            Clear
          </button>
        )}
      </div>
    </div>
  )
}
