// ─────────────────────────────────────────────────────────────────────────────
// GridSettingsModal — Floor plan configuration
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, memo } from 'react'
import { X, Settings, Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { FloorConfig } from '@/utils/floorPlan/grid'

// ── PaxStepper ──

interface StepperProps {
  value: number; min?: number; max?: number; label: string; suffix?: string
  onChange: (v: number) => void
}

function Stepper({ value, min = 1, max = 999, label, suffix = 'blocks', onChange }: StepperProps) {
  return (
    <div className="fp-grid-field">
      <label className="fp-grid-label">{label}</label>
      <div className="fp-stepper">
        <button type="button" className="fp-stepper-btn" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min}>
          <Minus className="w-3 h-3" />
        </button>
        <div className="fp-stepper-display">
          <span className="fp-stepper-value">{value}</span>
          <span className="fp-stepper-suffix">{suffix}</span>
        </div>
        <button type="button" className="fp-stepper-btn" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max}>
          <Plus className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}

// ── Modal ──

interface GridSettingsModalProps {
  config: FloorConfig
  activePresetName?: string | null
  onSave: (config: FloorConfig) => void
  onClose: () => void
}

export const GridSettingsModal = memo(function GridSettingsModal({
  config,
  activePresetName,
  onSave,
  onClose,
}: GridSettingsModalProps) {
  const [draft, setDraft] = useState<FloorConfig>({ ...config })

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  function handleSave() {
    onSave(draft)
    onClose()
  }

  return (
    <div className="fp-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="fp-modal">
        <div className="fp-modal-header">
          <div>
            <div className="fp-modal-title">
              <Settings className="w-4 h-4" />
              Grid Settings
            </div>
            <p className="fp-modal-desc">Configure the floor plan grid. All values are in logical blocks.</p>
          </div>
          <button onClick={onClose} className="fp-modal-close-btn">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="fp-modal-body">
          <Stepper
            label="Floor Width"
            value={draft.widthBlocks}
            min={5}
            max={100}
            onChange={(v) => setDraft((d) => ({ ...d, widthBlocks: v }))}
          />
          <Stepper
            label="Floor Height"
            value={draft.heightBlocks}
            min={5}
            max={100}
            onChange={(v) => setDraft((d) => ({ ...d, heightBlocks: v }))}
          />

          <div className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-lg text-xs text-slate-600 flex items-center justify-between">
            {activePresetName ? (
              <span className="font-semibold text-slate-700">
                Active Layout: <strong className="text-[#14274E]">{activePresetName}</strong>
              </span>
            ) : (
              <span className="text-slate-500">No layout active</span>
            )}
            <span className="text-[11px] text-slate-500">Use &ldquo;Save Layout&rdquo; to persist changes</span>
          </div>
        </div>

        <div className="fp-modal-footer">
          <button onClick={onClose} className="fp-modal-cancel-btn">Cancel</button>
          <Button variant="primary" size="sm" onClick={handleSave}>
            Apply Settings
          </Button>
        </div>
      </div>
    </div>
  )
})

export default GridSettingsModal
