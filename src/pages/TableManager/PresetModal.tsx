// ─────────────────────────────────────────────────────────────────────────────
// PresetModal — Save / Rename / Confirm Load / Delete presets
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, memo } from 'react'
import { X, Save, AlertTriangle, Grid3X3, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { FloorConfig } from '@/utils/floorPlan/grid'
import type { RestaurantEvent } from '@/types/event'

// ── Save Preset Modal ────────────────────────────────────────────────────────

interface SavePresetModalProps {
  onSave: (name: string, description: string, eventId?: number | null) => void
  onClose: () => void
  loading: boolean
  initialName?: string
  initialDescription?: string
  initialEventId?: number | null
  events?: RestaurantEvent[]
  isUpdate?: boolean
  config?: FloorConfig
}

export const SavePresetModal = memo(function SavePresetModal({
  onSave,
  onClose,
  loading,
  initialName = '',
  initialDescription = '',
  initialEventId = null,
  events = [],
  isUpdate = false,
  config,
}: SavePresetModalProps) {
  const [name, setName] = useState(initialName)
  const [description, setDescription] = useState(initialDescription)
  const [selectedEventId, setSelectedEventId] = useState<number | null>(initialEventId)
  const [error, setError] = useState('')

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Layout name is required.'); return }
    onSave(name.trim(), description.trim(), selectedEventId)
  }

  return (
    <div className="fp-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <form className="fp-modal" onSubmit={handleSubmit} noValidate>
        <div className="fp-modal-header">
          <div>
            <div className="fp-modal-title">
              <Save className="w-4 h-4" />
              {isUpdate ? 'Update Layout' : 'Save Layout'}
            </div>
            <p className="fp-modal-desc">
              {isUpdate
                ? 'Update the existing layout preset with current table positions.'
                : 'Save the current table arrangement as a reusable layout preset.'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="fp-modal-close-btn">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="fp-modal-body space-y-3">
          {config && (
            <div className="p-2.5 bg-slate-50 border border-slate-200/90 rounded-lg text-xs flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-slate-700 font-semibold">
                <Grid3X3 className="w-3.5 h-3.5 text-slate-500" />
                <span>Grid Settings:</span>
              </div>
              <span className="font-medium text-[#14274E]">
                {config.widthBlocks}×{config.heightBlocks} blocks · Spacing: {config.spacingBlocks} · Snap: {config.snapEnabled ? 'ON' : 'OFF'}
              </span>
            </div>
          )}
          <div className="fp-grid-field">
            <label className="fp-grid-label">Name *</label>
            <input
              type="text"
              className="fp-input"
              value={name}
              onChange={(e) => { setName(e.target.value); setError('') }}
              placeholder="e.g. Evening Service"
              autoFocus
            />
          </div>
          <div className="fp-grid-field">
            <label className="fp-grid-label">Description</label>
            <textarea
              className="fp-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Standard dining arrangement"
              rows={2}
            />
          </div>

          {events && events.length > 0 && (
            <div className="fp-grid-field">
              <label className="fp-grid-label flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-500" />
                <span>Link to Event (Optional)</span>
              </label>
              <select
                className="fp-input"
                value={selectedEventId ? String(selectedEventId) : ''}
                onChange={(e) => setSelectedEventId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">None (Standard 50 Pax Layout)</option>
                {events
                  .filter((ev) => !ev.deletedAt && !ev.isCancelled)
                  .map((ev) => (
                    <option key={ev.eventId} value={ev.eventId}>
                      {ev.title} · Max {ev.maxPax ?? ev.expectedAttendees ?? 50} Pax
                    </option>
                  ))}
              </select>
              <p className="text-[10px] text-slate-400 mt-0.5">
                If linked, that event's Max Pax will be the capacity limit for this layout.
              </p>
            </div>
          )}

          {error && <p className="fp-error-text">{error}</p>}
        </div>

        <div className="fp-modal-footer">
          <button type="button" onClick={onClose} className="fp-modal-cancel-btn">Cancel</button>
          <Button type="submit" variant="primary" size="sm" loading={loading}>
            {isUpdate ? 'Update Preset' : 'Save Preset'}
          </Button>
        </div>
      </form>
    </div>
  )
})

// ── Confirm Load Modal ───────────────────────────────────────────────────────

interface ConfirmLoadModalProps {
  presetName: string
  onConfirm: () => void
  onCancel: () => void
  loading: boolean
}

export const ConfirmLoadModal = memo(function ConfirmLoadModal({
  presetName,
  onConfirm,
  onCancel,
  loading,
}: ConfirmLoadModalProps) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onCancel])

  return (
    <div className="fp-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}>
      <div className="fp-modal fp-modal-sm">
        <div className="fp-modal-header">
          <div>
            <div className="fp-modal-title">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Load Layout
            </div>
            <p className="fp-modal-desc">
              You have unsaved layout changes. Load &ldquo;{presetName}&rdquo; anyway?
            </p>
          </div>
          <button onClick={onCancel} className="fp-modal-close-btn">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="fp-modal-footer">
          <button onClick={onCancel} className="fp-modal-cancel-btn">Cancel</button>
          <Button variant="primary" size="sm" loading={loading} onClick={onConfirm}>
            Load Layout
          </Button>
        </div>
      </div>
    </div>
  )
})

// ── Confirm Delete Modal ─────────────────────────────────────────────────────

interface ConfirmDeletePresetModalProps {
  presetName: string
  onConfirm: () => void
  onCancel: () => void
  loading: boolean
}

export const ConfirmDeletePresetModal = memo(function ConfirmDeletePresetModal({
  presetName,
  onConfirm,
  onCancel,
  loading,
}: ConfirmDeletePresetModalProps) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onCancel])

  return (
    <div className="fp-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}>
      <div className="fp-modal fp-modal-sm">
        <div className="fp-modal-header">
          <div>
            <div className="fp-modal-title">
              <AlertTriangle className="w-4 h-4 text-rose-500" />
              Delete Layout
            </div>
            <p className="fp-modal-desc">
              Delete &ldquo;{presetName}&rdquo;? This only removes the saved layout — your restaurant tables are not affected.
            </p>
          </div>
        </div>
        <div className="fp-modal-footer">
          <button onClick={onCancel} className="fp-modal-cancel-btn">Cancel</button>
          <Button variant="danger" size="sm" loading={loading} onClick={onConfirm}>
            Delete Preset
          </Button>
        </div>
      </div>
    </div>
  )
})

export default SavePresetModal
