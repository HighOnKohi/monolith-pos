import { useState } from 'react'
import { Search, SlidersHorizontal } from 'lucide-react'
import { FilterSheet } from './FilterSheet'
import type { DietaryFilter } from './FilterSheet'

interface SearchBarProps {
  value: string
  onChange: (query: string) => void
  dietaryFilter: DietaryFilter
  onDietaryChange: (filter: DietaryFilter) => void
}

export function SearchBar({ value, onChange, dietaryFilter, onDietaryChange }: SearchBarProps) {
  const [filterOpen, setFilterOpen] = useState(false)
  const hasActiveFilter = dietaryFilter !== 'all'

  return (
    <div className="flex items-center gap-2.5 px-4 pb-2">
      {/* Search input */}
      <div className="relative flex-1">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#9BA4B4]">
          <Search className="w-5 h-5" />
        </div>
        <input
          type="search"
          placeholder="Search food, drinks, codes..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-12 bg-white border border-[#9BA4B4]/30 rounded-2xl py-0 pl-11 pr-4 text-sm text-[#14274E] placeholder-[#9BA4B4] font-medium focus:outline-none focus:ring-2 focus:ring-[#14274E]/20 focus:border-[#14274E]/30 transition-all"
          aria-label="Search menu items"
        />
      </div>

      {/* Filter button */}
      <div className="relative">
        <button
          onClick={() => setFilterOpen(true)}
          aria-label="Filter options"
          aria-expanded={filterOpen}
          className={[
            'h-12 w-12 bg-white border rounded-2xl flex items-center justify-center transition-all active:scale-95 shadow-xs relative',
            hasActiveFilter ? 'border-[#14274E] text-[#14274E]' : 'border-[#9BA4B4]/30 text-[#14274E]',
          ].join(' ')}
        >
          <SlidersHorizontal className="w-5 h-5" />
          {hasActiveFilter && (
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-[#E9C46A] rounded-full border-2 border-[#F1F6F9]" />
          )}
        </button>
      </div>

      {filterOpen && (
        <FilterSheet
          value={dietaryFilter}
          onChange={onDietaryChange}
          onClose={() => setFilterOpen(false)}
        />
      )}
    </div>
  )
}
