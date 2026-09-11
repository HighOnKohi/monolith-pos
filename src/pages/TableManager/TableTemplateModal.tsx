// ─────────────────────────────────────────────────────────────────────────────
// TableTemplateModal — Add / Edit custom table types with seat rules
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useMemo } from 'react'
import { X, Plus, Check, AlertCircle, RotateCw } from 'lucide-react'
import {
  getMaxSeatsForDimensions,
  distributeSeatsToSides,
  type TableSide,
} from '@/utils/floorPlan/adjacency'

export interface TableTemplate {
  id: string
  label: string
  seats: number
  widthBlocks: number
  heightBlocks: number
  isCustom?: boolean
}

interface TableTemplateModalProps {
  isOpen: boolean
  initialTemplate?: TableTemplate | null
  onSave: (template: TableTemplate) => void
  onClose: () => void
}

export function TableTemplateModal({
  isOpen,
  initialTemplate,
  onSave,
  onClose,
}: TableTemplateModalProps) {
  const isEditing = Boolean(initialTemplate)

  const [label, setLabel] = useState(initialTemplate?.label ?? '')
  const [widthBlocks, setWidthBlocks] = useState(initialTemplate?.widthBlocks ?? 2)
  const [heightBlocks, setHeightBlocks] = useState(initialTemplate?.heightBlocks ?? 2)
  const [seats, setSeats] = useState(initialTemplate?.seats ?? 4)
  const [error, setError] = useState('')

  const maxSeats = useMemo(() => {
    return getMaxSeatsForDimensions(widthBlocks, heightBlocks)
  }, [widthBlocks, heightBlocks])

  // Clamp seats whenever width/height changes
  useEffect(() => {
    if (seats > maxSeats) {
      setSeats(maxSeats)
    }
  }, [maxSeats, seats])

  useEffect(() => {
    if (initialTemplate) {
      setLabel(initialTemplate.label)
      setWidthBlocks(initialTemplate.widthBlocks)
      setHeightBlocks(initialTemplate.heightBlocks)
      setSeats(initialTemplate.seats)
    } else {
      setLabel('')
      setWidthBlocks(2)
      setHeightBlocks(2)
      setSeats(4)
    }
    setError('')
  }, [initialTemplate, isOpen])

  if (!isOpen) return null

  // Calculate side seats distribution for live preview
  const sideCounts = distributeSeatsToSides(seats, widthBlocks, heightBlocks)
  const sides: TableSide[] = ['top', 'bottom', 'left', 'right']

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmedLabel = label.trim()
    if (!trimmedLabel) {
      setError('Please provide a name or label for this table type.')
      return
    }
    if (seats < 1 || seats > maxSeats) {
      setError(`Seats must be between 1 and ${maxSeats} for this size.`)
      return
    }

    const template: TableTemplate = {
      id: initialTemplate?.id ?? `tmpl-${Date.now()}`,
      label: trimmedLabel,
      seats,
      widthBlocks,
      heightBlocks,
      isCustom: true,
    }

    onSave(template)
    onClose()
  }

  return (
    <div
      className="tm-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <form className="tm-modal" onSubmit={handleSubmit} noValidate style={{ maxWidth: 480 }}>
        <div className="tm-modal-header">
          <div>
            <div className="tm-modal-title">
              {isEditing ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {isEditing ? 'Edit Table Type' : 'Create New Table Type'}
            </div>
            <p className="tm-modal-desc">
              Customize grid size and seat capacity (max 1 seat per side for every 2 blocks).
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="tm-modal-body space-y-4">
          {error && (
            <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs font-semibold text-red-600 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Table Type Label */}
          <div>
            <label className="tm-field-label">Type Name / Label</label>
            <input
              type="text"
              className="tm-field-input"
              placeholder="e.g. 6-TOP Long, Booth 4P, Bar Table"
              value={label}
              onChange={(e) => {
                setLabel(e.target.value)
                setError('')
              }}
              autoFocus
            />
          </div>

          {/* Dimensions: Width and Height in blocks */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="tm-field-label mb-0">Dimensions (Grid Blocks)</label>
              <button
                type="button"
                className="px-2.5 py-1 text-xs font-bold text-[#14274E] bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-md shadow-sm flex items-center gap-1.5 transition-all active:scale-[0.98]"
                onClick={() => {
                  setWidthBlocks(heightBlocks)
                  setHeightBlocks(widthBlocks)
                }}
                title="Swap width and height"
              >
                <RotateCw className="w-3.5 h-3.5 text-[#14274E]" />
                <span>Swap Orientation</span>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">Width</label>
                <select
                  className="tm-field-input"
                  value={widthBlocks}
                  onChange={(e) => setWidthBlocks(Number(e.target.value))}
                >
                  {[2, 4, 6, 8].map((w) => (
                    <option key={w} value={w}>
                      {w} blocks ({Math.floor(w / 2)} seat/side max)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">Height</label>
                <select
                  className="tm-field-input"
                  value={heightBlocks}
                  onChange={(e) => setHeightBlocks(Number(e.target.value))}
                >
                  {[2, 4, 6, 8].map((h) => (
                    <option key={h} value={h}>
                      {h} blocks ({Math.floor(h / 2)} seat/side max)
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Seats Count */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="tm-field-label">Seats Count</label>
              <span className="text-xs text-slate-500 font-medium">
                Max {maxSeats} seats (1 per side / 2 blocks)
              </span>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={maxSeats}
                value={seats}
                onChange={(e) => setSeats(Number(e.target.value))}
                className="flex-1 cursor-pointer accent-[#14274E]"
              />
              <span className="inline-flex items-center justify-center w-10 h-8 rounded-lg bg-slate-100 font-bold text-slate-800 text-sm border border-slate-200">
                {seats}
              </span>
            </div>
          </div>

          {/* Live Preview */}
          <div>
            <label className="tm-field-label mb-2 block">Live Preview</label>
            <div
              className="w-full flex items-center justify-center p-6 bg-slate-50 rounded-xl border border-slate-200"
              style={{ minHeight: 160 }}
            >
              <div
                style={{
                  position: 'relative',
                  width: `${widthBlocks * 28}px`,
                  height: `${heightBlocks * 28}px`,
                  background: '#FFFFFF',
                  border: '2px solid #14274E',
                  borderRadius: '10px',
                  boxShadow: '0 4px 12px rgba(20, 39, 78, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s ease',
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 700, color: '#14274E' }}>
                  {seats}p
                </span>

                {/* Seats around preview */}
                {sides.map((side) => {
                  const count = sideCounts[side]
                  if (count === 0) return null

                  return Array.from({ length: count }, (_, i) => {
                    const frac = count > 1 ? (i + 0.5) / count : 0.5
                    let style: React.CSSProperties = {
                      position: 'absolute',
                      background: '#394867',
                      border: '1px solid rgba(20, 39, 78, 0.25)',
                      borderRadius: '3px',
                      boxShadow: '0 1px 3px rgba(20, 39, 78, 0.2)',
                    }

                    if (side === 'top') {
                      style = {
                        ...style,
                        top: -7,
                        left: `${frac * 100}%`,
                        transform: 'translateX(-50%)',
                        width: count > 1 ? `${Math.floor(70 / count)}%` : '42%',
                        height: 7,
                      }
                    } else if (side === 'bottom') {
                      style = {
                        ...style,
                        bottom: -7,
                        left: `${frac * 100}%`,
                        transform: 'translateX(-50%)',
                        width: count > 1 ? `${Math.floor(70 / count)}%` : '42%',
                        height: 7,
                      }
                    } else if (side === 'left') {
                      style = {
                        ...style,
                        left: -7,
                        top: `${frac * 100}%`,
                        transform: 'translateY(-50%)',
                        width: 7,
                        height: count > 1 ? `${Math.floor(70 / count)}%` : '42%',
                      }
                    } else if (side === 'right') {
                      style = {
                        ...style,
                        right: -7,
                        top: `${frac * 100}%`,
                        transform: 'translateY(-50%)',
                        width: 7,
                        height: count > 1 ? `${Math.floor(70 / count)}%` : '42%',
                      }
                    }

                    return <div key={`${side}-${i}`} style={style} />
                  })
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="tm-modal-footer">
          <button
            type="button"
            onClick={onClose}
            className="tm-btn tm-btn-secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="tm-btn tm-btn-primary"
          >
            {isEditing ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            <span>{isEditing ? 'Save Changes' : 'Create Table Type'}</span>
          </button>
        </div>
      </form>
    </div>
  )
}
