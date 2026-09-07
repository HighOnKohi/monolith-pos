import { useState } from 'react'
import { Calendar } from 'lucide-react'
import type { DateRange, DateRangePreset } from '@/services/analyticsService'

interface DateRangePickerProps {
  currentRange: DateRange
  onRangeChange: (preset: DateRangePreset, customStart?: Date, customEnd?: Date) => void
}

const PRESETS: Array<{ id: DateRangePreset; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'last7days', label: 'Last 7 Days' },
  { id: 'last30days', label: 'Last 30 Days' },
  { id: 'thisMonth', label: 'This Month' },
  { id: 'lastMonth', label: 'Last Month' },
  { id: 'custom', label: 'Custom Range' },
]

export function DateRangePicker({ currentRange, onRangeChange }: DateRangePickerProps) {
  const [showCustomInputs, setShowCustomInputs] = useState(currentRange.preset === 'custom')
  const [customStartDate, setCustomStartDate] = useState(
    currentRange.startDate.toISOString().slice(0, 10),
  )
  const [customEndDate, setCustomEndDate] = useState(
    currentRange.endDate.toISOString().slice(0, 10),
  )

  const handlePresetClick = (preset: DateRangePreset) => {
    if (preset === 'custom') {
      setShowCustomInputs(true)
    } else {
      setShowCustomInputs(false)
      onRangeChange(preset)
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
    <div className="flex flex-col gap-2.5">
      {/* Preset pills row */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
        {PRESETS.map((p) => {
          const isActive = currentRange.preset === p.id
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => handlePresetClick(p.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                isActive
                  ? 'bg-[#14274E] text-[#E9C46A] shadow-xs scale-102 ring-1 ring-[#14274E]/20'
                  : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
              }`}
            >
              {p.label}
            </button>
          )
        })}
      </div>

      {/* Inline custom date picker when "Custom Range" is active */}
      {showCustomInputs && (
        <form
          onSubmit={handleApplyCustom}
          className="flex flex-wrap items-center gap-2 bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs text-xs"
        >
          <div className="flex items-center gap-1.5 text-slate-500 font-semibold">
            <Calendar className="w-3.5 h-3.5 text-[#14274E]" />
            <span>Range:</span>
          </div>

          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#14274E]"
              required
            />
            <span className="text-slate-400 font-bold">to</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#14274E]"
              required
            />
          </div>

          <button
            type="submit"
            className="px-3 py-1 bg-[#14274E] hover:bg-[#1E3A8A] text-white font-bold rounded-lg cursor-pointer transition-colors"
          >
            Apply
          </button>
        </form>
      )}
    </div>
  )
}
