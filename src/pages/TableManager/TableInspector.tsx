// ─────────────────────────────────────────────────────────────────────────────
// TableInspector — Right sidebar: selected table/group details
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useEffect, useMemo, memo } from 'react'
import {
  X, Check, Trash2, QrCode, GitMerge,
  TableProperties, LayoutGrid, Minus, Plus, RotateCw,
} from 'lucide-react'
import type { TableData, TableStatus } from '@/services/tableService'
import {
  type MergeGroup,
  calculateEffectiveCapacity,
  calculateGroupCombinedCapacity,
} from '@/utils/floorPlan/adjacency'
import type { EditorTable } from './useFloorPlanState'

// ── PaxStepper (reused from existing) ────────────────────────────────────────

interface PaxStepperProps {
  value: number; min?: number; max?: number
  onChange: (v: number) => void; disabled?: boolean; id?: string
}

function PaxStepper({ value, min = 0, max = 999, onChange, disabled, id }: PaxStepperProps) {
  const [raw, setRaw] = useState(String(value))
  const isFocusedRef = useRef(false)

  useEffect(() => {
    if (!isFocusedRef.current) {
      setRaw(String(value))
    }
  }, [value])

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const text = e.target.value
    setRaw(text)
    if (text === '') return
    const n = parseInt(text, 10)
    if (!isNaN(n)) {
      if (n >= min && n <= max) {
        onChange(n)
      } else if (n > max) {
        onChange(max)
      }
    }
  }

  function handleBlur() {
    isFocusedRef.current = false
    const n = parseInt(raw, 10)
    if (isNaN(n) || n < min) {
      setRaw(String(min))
      onChange(min)
    } else if (n > max) {
      setRaw(String(max))
      onChange(max)
    } else {
      setRaw(String(n))
      onChange(n)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      const n = parseInt(raw, 10)
      if (isNaN(n) || n < min) {
        setRaw(String(min))
        onChange(min)
      } else if (n > max) {
        setRaw(String(max))
        onChange(max)
      } else {
        setRaw(String(n))
        onChange(n)
      }
      ;(e.target as HTMLInputElement).blur()
    }
  }

  return (
    <div className="fp-stepper">
      <button
        type="button"
        className="fp-stepper-btn"
        onClick={() => {
          const next = Math.max(min, value - 1)
          setRaw(String(next))
          onChange(next)
        }}
        disabled={disabled || value <= min}
      >
        <Minus className="w-3 h-3" />
      </button>
      <input
        id={id}
        type="number"
        className="fp-stepper-val"
        value={raw}
        min={min}
        max={max}
        disabled={disabled}
        onFocus={(e) => {
          isFocusedRef.current = true
          e.target.select()
        }}
        onChange={handleInputChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
      />
      <button
        type="button"
        className="fp-stepper-btn"
        onClick={() => {
          const next = Math.min(max, value + 1)
          setRaw(String(next))
          onChange(next)
        }}
        disabled={disabled || value >= max}
      >
        <Plus className="w-3 h-3" />
      </button>
    </div>
  )
}

// ── Status Helpers ───────────────────────────────────────────────────────────

function statusLabel(s: TableStatus): string {
  return { AVAILABLE: 'Available', OCCUPIED: 'Occupied', RESERVED: 'Reserved', HAS_REQUEST: 'Needs Help', UNAVAILABLE: 'Unavailable' }[s] ?? s
}

function statusClass(s: TableStatus): string {
  return `fp-inspector-status-${s.toLowerCase().replace('_', '-')}`
}

// ── Main Component ───────────────────────────────────────────────────────────

interface TableInspectorProps {
  table: TableData | null
  position: EditorTable | null
  tableSizeBlocks: number
  maxCapacity: number
  mergeGroup: MergeGroup | null
  allTables: TableData[]
  allPositions?: EditorTable[]
  onClose: () => void
  onCapacityChange: (tableId: number, capacity: number) => void
  onSeatedPaxChange?: (tableId: number, seatedPax: number) => void
  onDimensionsChange?: (tableId: number, widthBlocks: number, heightBlocks: number) => void
  onStatusChange: (tableId: number, status: TableStatus) => void
  onDelete: (tableId: number) => void
  onQrPrint: (tableId: number) => void
  onUnmerge?: (anchorId: number) => void
  onRotate?: (tableId: number) => void
  saving: boolean
  orderSummary?: { totalBill: number; activeOrderCount: number }
}

export const TableInspector = memo(function TableInspector({
  table,
  position,
  tableSizeBlocks,
  maxCapacity,
  mergeGroup,
  allTables,
  allPositions,
  onClose,
  onCapacityChange,
  onSeatedPaxChange,
  onStatusChange,
  onDelete,
  onQrPrint,
  onRotate,
  saving,
  orderSummary,
}: TableInspectorProps) {
  const [draftCapacity, setDraftCapacity] = useState(table?.GUEST_CAPACITY ?? 4)
  const [draftSeated, setDraftSeated] = useState(table?.CURRENT_GUEST_COUNT ?? 0)

  useEffect(() => {
    if (table) {
      setDraftCapacity(table.GUEST_CAPACITY)
      setDraftSeated(table.CURRENT_GUEST_COUNT)
    }
  }, [table?.TABLE_ID, table?.GUEST_CAPACITY, table?.CURRENT_GUEST_COUNT])

  const isCapacityDirty = table && draftCapacity !== table.GUEST_CAPACITY
  const isSeatedDirty = table && draftSeated !== table.CURRENT_GUEST_COUNT
  const isDirty = isCapacityDirty || isSeatedDirty
  const isOccupied = table && (table.STATUS === 'OCCUPIED' || table.STATUS === 'HAS_REQUEST')
  const isMerged = mergeGroup && mergeGroup.memberIds.length > 1

  const curWidth = position?.widthBlocks ?? tableSizeBlocks
  const curHeight = position?.heightBlocks ?? tableSizeBlocks
  const maxAllowedByDimensions = 2 * (Math.floor(curWidth / 2) + Math.floor(curHeight / 2))
  const effectiveMaxCapacity = Math.min(maxCapacity, maxAllowedByDimensions)

  const combinedCapacity = useMemo(() => {
    if (!mergeGroup || mergeGroup.memberIds.length <= 1) return table?.GUEST_CAPACITY ?? 0
    if (allPositions && allPositions.length > 0) {
      return calculateGroupCombinedCapacity(mergeGroup, allTables, allPositions, tableSizeBlocks)
    }
    return mergeGroup.memberIds.reduce((sum, id) => {
      const t = allTables.find((at) => at.TABLE_ID === id)
      return sum + (t?.GUEST_CAPACITY ?? 0)
    }, 0)
  }, [mergeGroup, allTables, allPositions, tableSizeBlocks, table])

  const tableEffectiveCapacity = useMemo(() => {
    if (!table) return 0
    if (!isMerged || !allPositions) return table.GUEST_CAPACITY
    return calculateEffectiveCapacity(table, allPositions, tableSizeBlocks, mergeGroup ? [mergeGroup] : undefined)
  }, [table, isMerged, allPositions, tableSizeBlocks, mergeGroup])

  function handleSaveCapacityAndSeated() {
    if (!table) return
    if (isCapacityDirty) {
      onCapacityChange(table.TABLE_ID, draftCapacity)
    }
    if (isSeatedDirty && onSeatedPaxChange) {
      onSeatedPaxChange(table.TABLE_ID, draftSeated)
    }
  }

  // ── No table selected ──────────────────────────────────────────────────────

  if (!table || !position) {
    return (
      <aside className="fp-inspector">
        <div className="fp-inspector-header">
          <div className="fp-inspector-title">
            <TableProperties className="w-4 h-4" />
            Table Inspector
          </div>
        </div>
        <div className="fp-inspector-body">
          <div className="fp-inspector-empty">
            <div className="fp-inspector-empty-icon">
              <LayoutGrid className="w-6 h-6" />
            </div>
            <div>
              <p className="fp-inspector-empty-title">Select a table</p>
              <p className="fp-inspector-empty-desc">Click any table on the floor plan to view and edit its details.</p>
            </div>
          </div>
        </div>
      </aside>
    )
  }

  // ── Table selected ─────────────────────────────────────────────────────────

  return (
    <aside className="fp-inspector">
      <div className="fp-inspector-header">
        <div>
          <div className="fp-inspector-title">
            Table {table.TABLE_NUM}
            {isDirty && <span className="fp-dirty-dot" title="Unsaved changes" />}
          </div>
          <div className="fp-inspector-subtitle">
            <span className={`fp-inspector-status-badge ${statusClass(table.STATUS)}`}>
              {statusLabel(table.STATUS)}
            </span>
          </div>
        </div>
        <button className="fp-inspector-close" onClick={onClose}>
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="fp-inspector-body">
        {/* ── Table Info ── */}
        <div className="fp-inspector-section">
          <span className="fp-inspector-section-title">Table Info</span>

          <div className="fp-inspector-row">
            <span className="fp-inspector-label">Table Number</span>
            <span className="fp-inspector-value font-bold text-[#14274E]">{table.TABLE_NUM}</span>
          </div>

          {onRotate && (
            <button
              type="button"
              className="fp-inspector-btn secondary flex items-center justify-center gap-1.5 w-full mt-2 text-xs font-semibold"
              onClick={() => onRotate(table.TABLE_ID)}
              title="Rotate table 90° (R)"
            >
              <RotateCw className="w-3.5 h-3.5 text-[#14274E]" />
              <span>Rotate 90° (R)</span>
            </button>
          )}
        </div>

        <div className="fp-inspector-divider" />

        {/* ── Capacity & Seating ── */}
        <div className="fp-inspector-section">
          <span className="fp-inspector-section-title">Capacity & Seating</span>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="fp-inspector-label mb-0">Maximum Capacity</label>
              <span className="text-[10px] text-slate-400">Max {maxAllowedByDimensions} Pax</span>
            </div>
            <PaxStepper
              value={draftCapacity}
              min={1}
              max={effectiveMaxCapacity}
              onChange={setDraftCapacity}
            />
          </div>

          <div className="mt-3">
            <div className="flex justify-between items-center mb-1">
              <label className="fp-inspector-label mb-0">Currently Seated</label>
              {draftSeated >= (isMerged ? tableEffectiveCapacity : draftCapacity) && (isMerged ? tableEffectiveCapacity : draftCapacity) > 0 && (
                <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                  Full
                </span>
              )}
            </div>
            <PaxStepper
              value={draftSeated}
              min={0}
              max={isMerged ? tableEffectiveCapacity : draftCapacity}
              onChange={setDraftSeated}
            />
          </div>

          {isMerged && (
            <div className="fp-inspector-row mt-2">
              <span className="fp-inspector-label">Effective Seats</span>
              <span className="fp-inspector-value font-bold text-amber-700">
                {tableEffectiveCapacity} Pax (merged sides deducted)
              </span>
            </div>
          )}

          {orderSummary && (
            <div className="fp-inspector-row mt-2">
              <span className="fp-inspector-label">Active Orders</span>
              <span className="fp-inspector-value">
                {orderSummary.activeOrderCount} order{orderSummary.activeOrderCount !== 1 ? 's' : ''}{isMerged ? ' (shared)' : ''} · ₱{orderSummary.totalBill.toFixed(2)}
              </span>
            </div>
          )}

          {isDirty && (
            <button
              className="fp-inspector-btn primary mt-3 w-full"
              onClick={handleSaveCapacityAndSeated}
              disabled={saving}
            >
              {saving
                ? <span className="fp-spinner" />
                : <Check className="w-3.5 h-3.5" />}
              {isCapacityDirty && isSeatedDirty
                ? 'Save Changes'
                : isCapacityDirty
                ? 'Save Capacity'
                : 'Save Seated Pax'}
            </button>
          )}
        </div>

        <div className="fp-inspector-divider" />

        {/* ── Status ── */}
        <div className="fp-inspector-section">
          <span className="fp-inspector-section-title">Table Status</span>
          <div className="fp-inspector-status-toggle" role="group">
            {(['AVAILABLE', 'RESERVED', 'OCCUPIED'] as TableStatus[]).map((s) => (
              <button
                key={s}
                className={table.STATUS === s ? 'is-active' : ''}
                onClick={() => onStatusChange(table.TABLE_ID, s)}
                disabled={s === 'OCCUPIED' && !isOccupied && table.STATUS !== 'AVAILABLE'}
              >
                {statusLabel(s)}
              </button>
            ))}
          </div>
        </div>

        <div className="fp-inspector-divider" />

        {/* ── Merge Status ── */}
        <div className="fp-inspector-section">
          <span className="fp-inspector-section-title">
            <GitMerge className="w-3.5 h-3.5" />
            Merge Status
          </span>
          {isMerged ? (
            <div className="fp-inspector-merge-info">
              <div className="fp-inspector-row">
                <span className="fp-inspector-label">Group</span>
                <span className="fp-inspector-value fp-merge-group-label">
                  {mergeGroup!.memberIds.map((id) => {
                    const t = allTables.find((at) => at.TABLE_ID === id)
                    return t ? `T${t.TABLE_NUM}` : `T${id}`
                  }).join(' + ')}
                </span>
              </div>
              <div className="fp-inspector-row">
                <span className="fp-inspector-label">Combined Capacity</span>
                <span className="fp-inspector-value font-black text-[#14274E]">{combinedCapacity} Pax</span>
              </div>
            </div>
          ) : (
            <p className="fp-inspector-muted">Standalone — not part of a merge group.</p>
          )}
        </div>

        <div className="fp-inspector-divider" />

        {/* ── Actions ── */}
        <div className="fp-inspector-section">
          <span className="fp-inspector-section-title">Actions</span>
          <div className="fp-inspector-actions">
            <button className="fp-inspector-btn secondary" onClick={() => onQrPrint(table.TABLE_ID)}>
              <QrCode className="w-3.5 h-3.5" />
              Print QR Code
            </button>
            <button className="fp-inspector-btn danger" onClick={() => onDelete(table.TABLE_ID)}>
              <Trash2 className="w-3.5 h-3.5" />
              Delete Table
            </button>
          </div>
        </div>
      </div>
    </aside>
  )
})

export default TableInspector
