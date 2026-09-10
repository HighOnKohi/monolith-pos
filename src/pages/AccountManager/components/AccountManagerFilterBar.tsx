import React, { useState, useEffect } from 'react'
import { Search, X, RotateCcw, Plus, Filter } from 'lucide-react'
import type { StaffRole, StaffStatus, StaffCodeFilterParams } from '@/types/account'
import { ROLE_DEFINITIONS } from '@/types/account'

interface AccountManagerFilterBarProps {
  filters: StaffCodeFilterParams
  onFilterChange: (newFilters: Partial<StaffCodeFilterParams>) => void
  onClearFilters: () => void
  onAddCode: () => void
}

export const AccountManagerFilterBar: React.FC<AccountManagerFilterBarProps> = ({
  filters,
  onFilterChange,
  onClearFilters,
  onAddCode,
}) => {
  const [localSearch, setLocalSearch] = useState(filters.searchQuery || '')

  // Debounce search input by 250ms
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== (filters.searchQuery || '')) {
        onFilterChange({ searchQuery: localSearch })
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [localSearch, filters.searchQuery, onFilterChange])

  // Sync back if parent clears filters
  useEffect(() => {
    setLocalSearch(filters.searchQuery || '')
  }, [filters.searchQuery])

  const hasActiveFilters = Boolean(
    (filters.searchQuery && filters.searchQuery.trim().length > 0) ||
      (filters.role && filters.role !== 'ALL') ||
      (filters.status && filters.status !== 'ALL'),
  )

  return (
    <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-3">
      {/* ── Top Row: Search & Add Code Button ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search Bar */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Search by staff name, code (e.g. 1001), or role..."
            className="w-full pl-10 pr-9 py-2 rounded-xl border border-slate-200 bg-slate-50/50 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#14274E] focus:bg-white transition-all font-medium"
          />
          {localSearch && (
            <button
              onClick={() => {
                setLocalSearch('')
                onFilterChange({ searchQuery: '' })
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Action Button: Add Staff Code */}
        <button
          type="button"
          onClick={onAddCode}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#14274E] hover:bg-[#1a3468] text-white text-xs font-black shadow-xs active:scale-98 transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Staff Code</span>
        </button>
      </div>

      {/* ── Bottom Row: Filters & Reset ── */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
            <Filter className="w-3 h-3" />
            <span>Filters:</span>
          </span>

          {/* Role Filter */}
          <select
            value={filters.role || 'ALL'}
            onChange={(e) =>
              onFilterChange({ role: e.target.value as StaffRole | 'ALL' })
            }
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 hover:bg-white focus:outline-none focus:border-[#14274E] cursor-pointer"
          >
            <option value="ALL">All Roles</option>
            <option value="ADMIN">{ROLE_DEFINITIONS.ADMIN.label}</option>
            <option value="MANAGER">{ROLE_DEFINITIONS.MANAGER.label}</option>
            <option value="CASHIER">{ROLE_DEFINITIONS.CASHIER.label}</option>
            <option value="KITCHEN">{ROLE_DEFINITIONS.KITCHEN.label}</option>
            <option value="STAFF">{ROLE_DEFINITIONS.STAFF.label}</option>
          </select>

          {/* Status Filter */}
          <select
            value={filters.status || 'ALL'}
            onChange={(e) =>
              onFilterChange({ status: e.target.value as StaffStatus | 'ALL' })
            }
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 hover:bg-white focus:outline-none focus:border-[#14274E] cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active Only</option>
            <option value="INACTIVE">Inactive Only</option>
          </select>
        </div>

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Filters</span>
          </button>
        )}
      </div>
    </div>
  )
}
