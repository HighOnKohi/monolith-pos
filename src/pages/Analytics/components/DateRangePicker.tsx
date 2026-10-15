import { useState, useRef, useEffect } from 'react'
import { Calendar, ChevronDown, Check } from 'lucide-react'
import type { DateRange, DateRangePreset } from '@/services/analyticsService'

interface DateRangePickerProps {
  currentRange: DateRange
  onRangeChange: (preset: DateRangePreset, customStart?: Date, customEnd?: Date) => void
}

const PRESETS: Array<{ id: DateRangePreset; label: string }> = [
  { id: 'thisWeek', label: 'This week' },
  { id: 'last3Weeks', label: 'Last 3 weeks' },
  { id: 'thisMonth', label: 'This month' },
  { id: 'last3Months', label: 'Last 3 months' },
  { id: 'thisYear', label: 'This Year' },
  { id: 'last3Years', label: 'Last 3 Years' },
  { id: 'custom', label: 'Custom range' },
]

export function DateRangePicker({ currentRange, onRangeChange }: DateRangePickerProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [customStartDate, setCustomStartDate] = useState(
    currentRange.startDate.toISOString().slice(0, 10),
  )
  const [customEndDate, setCustomEndDate] = useState(
    currentRange.endDate.toISOString().slice(0, 10),
  )
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const activeLabel =
    PRESETS.find((p) => p.id === currentRange.preset)?.label || currentRange.label

  const handleSelectPreset = (preset: DateRangePreset) => {
    setDropdownOpen(false)
    if (preset !== 'custom') {
      onRangeChange(preset)
    } else {
      // Trigger custom
      const start = new Date(`${customStartDate}T00:00:00`)
      const end = new Date(`${customEndDate}T23:59:59.999`)
      onRangeChange('custom', start, end)
    }
  }

  const handleApplyCustom = (e: React.FormEvent) => {
    e.preventDefault()
    if (!customStartDate || !customEndDate) return
    const start = new Date(`${customStartDate}T00:00:00`)
    const end = new Date(`${customEndDate}T23:59:59.999`)
    if (start > end) {
      alert('Start date must be before end date.')
      return
    }
    onRangeChange('custom', start, end)
  }

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {/* Dropdown Button */}
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setDropdownOpen((v) => !v)}
          className="inline-flex items-center gap-2.5 px-3.5 py-2 bg-slate-50 hover:bg-slate-100 active:scale-95 text-slate-800 text-xs font-bold rounded-xl border border-slate-200 shadow-2xs transition-all cursor-pointer select-none"
        >
          <Calendar className="w-4 h-4 text-[#14274E]" />
          <span>{activeLabel}</span>
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
              dropdownOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {/* Dropdown Options */}
        {dropdownOpen && (
          <div className="absolute left-0 top-full mt-2 w-52 bg-white rounded-2xl shadow-xl border border-slate-200 p-1.5 z-50 flex flex-col gap-0.5">
            {PRESETS.map((p) => {
              const isSelected = currentRange.preset === p.id
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelectPreset(p.id)}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer text-left ${
                    isSelected
                      ? 'bg-[#14274E] text-[#E9C46A]'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span>{p.label}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-[#E9C46A]" />}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Expanded Custom Range Selector (Expands to the right) */}
      {currentRange.preset === 'custom' && (
        <form
          onSubmit={handleApplyCustom}
          className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs text-xs animate-in fade-in slide-in-from-left-2 duration-200"
        >
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-slate-800 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#14274E] cursor-pointer"
              required
            />
            <span className="text-slate-400 font-bold text-[11px]">to</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-slate-800 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#14274E] cursor-pointer"
              required
            />
          </div>

          <button
            type="submit"
            className="px-3 py-1 bg-[#14274E] hover:bg-[#1E3A8A] active:scale-95 text-[#E9C46A] font-bold rounded-lg cursor-pointer transition-all text-xs shadow-2xs"
          >
            Apply
          </button>
        </form>
      )}
    </div>
  )
}
