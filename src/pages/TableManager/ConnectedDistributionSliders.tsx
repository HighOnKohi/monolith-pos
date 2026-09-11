// ─────────────────────────────────────────────────────────────────────────────
// ConnectedDistributionSliders — Interactive proportional snapping sliders
// ─────────────────────────────────────────────────────────────────────────────

import { memo } from 'react'
import { Check, SlidersHorizontal, Layers, Sparkles } from 'lucide-react'
import type { TableTemplate } from '@/services/templateService'

export interface ConnectedDistributionSlidersProps {
  templates: TableTemplate[]
  activeTemplateIds: string[]
  percentages: Record<string, number>
  templateCounts: Record<string, number>
  onPercentagesChange: (newPercentages: Record<string, number>) => void
  onToggleTemplate: (templateId: string) => void
}

const PALETTE_COLORS = [
  { bg: 'bg-[#14274E]', text: 'text-white', border: 'border-[#14274E]', hex: '#14274E', light: 'bg-blue-50 text-blue-900' },
  { bg: 'bg-[#059669]', text: 'text-white', border: 'border-[#059669]', hex: '#059669', light: 'bg-emerald-50 text-emerald-900' },
  { bg: 'bg-[#7C3AED]', text: 'text-white', border: 'border-[#7C3AED]', hex: '#7C3AED', light: 'bg-purple-50 text-purple-900' },
  { bg: 'bg-[#D97706]', text: 'text-white', border: 'border-[#D97706]', hex: '#D97706', light: 'bg-amber-50 text-amber-900' },
  { bg: 'bg-[#E11D48]', text: 'text-white', border: 'border-[#E11D48]', hex: '#E11D48', light: 'bg-rose-50 text-rose-900' },
  { bg: 'bg-[#0284C7]', text: 'text-white', border: 'border-[#0284C7]', hex: '#0284C7', light: 'bg-sky-50 text-sky-900' },
]

export const ConnectedDistributionSliders = memo(function ConnectedDistributionSliders({
  templates,
  activeTemplateIds,
  percentages,
  templateCounts,
  onPercentagesChange,
  onToggleTemplate,
}: ConnectedDistributionSlidersProps) {
  const activeTemplates = templates.filter((t) => activeTemplateIds.includes(t.id))

  // Handle snapping slider drag with proportional rebalancing
  function handleSliderChange(changedId: string, rawVal: number) {
    // Snap to 5% increments
    const newVal = Math.max(0, Math.min(100, Math.round(rawVal / 5) * 5))

    if (activeTemplates.length <= 1) {
      onPercentagesChange({ [changedId]: 100 })
      return
    }

    const otherIds = activeTemplates.map((t) => t.id).filter((id) => id !== changedId)
    const remaining = 100 - newVal
    const otherSum = otherIds.reduce((sum, id) => sum + (percentages[id] ?? 0), 0)

    const updated: Record<string, number> = { ...percentages, [changedId]: newVal }

    if (otherSum > 0) {
      let allocated = 0
      otherIds.forEach((id, idx) => {
        if (idx === otherIds.length - 1) {
          // Last other gets exact remainder to guarantee sum === 100
          updated[id] = Math.max(0, remaining - allocated)
        } else {
          const ratio = (percentages[id] ?? 0) / otherSum
          const share = Math.max(0, Math.round((remaining * ratio) / 5) * 5)
          updated[id] = share
          allocated += share
        }
      })
    } else {
      // Split remaining evenly in 5% steps
      const baseShare = Math.floor(remaining / otherIds.length / 5) * 5
      let allocated = 0
      otherIds.forEach((id, idx) => {
        if (idx === otherIds.length - 1) {
          updated[id] = Math.max(0, remaining - allocated)
        } else {
          updated[id] = baseShare
          allocated += baseShare
        }
      })
    }

    onPercentagesChange(updated)
  }

  return (
    <div className="space-y-3.5">
      {/* ── Template Selection Chips ── */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[0.72rem] font-bold text-slate-700 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-[#14274E]" />
            Saved Table Types to Distribute
          </label>
          <span className="text-[0.66rem] text-slate-500 font-semibold">
            {activeTemplateIds.length} of {templates.length} active
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {templates.map((tmpl) => {
            const isActive = activeTemplateIds.includes(tmpl.id)
            return (
              <button
                key={tmpl.id}
                type="button"
                onClick={() => onToggleTemplate(tmpl.id)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all border ${
                  isActive
                    ? 'bg-[#14274E] text-white border-[#14274E] shadow-xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                {isActive ? (
                  <Check className="w-3 h-3 text-emerald-400 stroke-[3]" />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                )}
                <span>{tmpl.label}</span>
                <span className={`text-[0.65rem] font-medium px-1 rounded ${isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  {tmpl.seats}p · {tmpl.widthBlocks}x{tmpl.heightBlocks}
                </span>
                {tmpl.isCustom && (
                  <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── 100% Proportional Visual Bar ── */}
      {activeTemplates.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[0.68rem] font-bold text-slate-500 flex items-center gap-1">
              <SlidersHorizontal className="w-3 h-3" />
              Proportional Mix (Total 100%)
            </span>
          </div>
          <div className="h-4 w-full rounded-full bg-slate-100 overflow-hidden flex shadow-inner border border-slate-200/80">
            {activeTemplates.map((t, idx) => {
              const p = percentages[t.id] ?? 0
              if (p <= 0) return null
              const color = PALETTE_COLORS[idx % PALETTE_COLORS.length]
              return (
                <div
                  key={t.id}
                  style={{ width: `${p}%` }}
                  className={`${color.bg} h-full transition-all duration-150 flex items-center justify-center text-[0.6rem] font-black text-white px-1 truncate`}
                  title={`${t.label}: ${p}%`}
                >
                  {p >= 15 ? `${p}%` : ''}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Connected Snapping Sliders ── */}
      <div className="space-y-2.5 bg-slate-50/80 p-3 rounded-xl border border-slate-200/80">
        {activeTemplates.map((tmpl, idx) => {
          const p = percentages[tmpl.id] ?? 0
          const count = templateCounts[tmpl.id] ?? 0
          const color = PALETTE_COLORS[idx % PALETTE_COLORS.length]

          return (
            <div key={tmpl.id} className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: color.hex }}
                  />
                  <span className="text-xs font-bold text-slate-800">
                    {tmpl.label}
                  </span>
                  <span className="text-[0.68rem] font-medium text-slate-500">
                    ({tmpl.seats} Pax)
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-black text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded">
                    {count} Table{count !== 1 ? 's' : ''} ({count * tmpl.seats} Pax)
                  </span>
                  <span
                    className={`text-xs font-black px-2 py-0.5 rounded-md ${color.light} border border-black/5 min-w-[42px] text-center`}
                  >
                    {p}%
                  </span>
                </div>
              </div>

              {/* Slider Input with 5% steps */}
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={p}
                  disabled={activeTemplates.length <= 1}
                  onChange={(e) => handleSliderChange(tmpl.id, parseInt(e.target.value, 10))}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#14274E] disabled:cursor-not-allowed"
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
})
