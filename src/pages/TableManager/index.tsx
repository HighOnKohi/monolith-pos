/**
 * TableManager — Phase 3: Floor-Plan Editor
 *
 * Architecture:
 * - Three-panel layout: TablePalette (left) | FloorPlanEditor (center) | TableInspector (right)
 * - useFloorPlanState hook manages visual editor state (positions, zoom, drag, history)
 * - DB data layer preserved from Phase 2: realtime + polling, targeted patches
 * - Operational flows (status, reservations, merge, QR, billing, assistance) unchanged
 * - Layout positions stored in Restaurant_Tables.LAYOUT_X/LAYOUT_Y
 * - Layout presets stored in Table_Layout_Presets
 */

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from 'react'
import { useBlocker } from 'react-router-dom'
import {
  Plus,
  X,
  AlertTriangle,
  CheckCircle2,
  TableProperties,
  Minus,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'
import { resolveTableAssistance } from '@/services/assistanceService'
import { resolveBillOutRequest, fetchAllBillRequests } from '@/services/billService'
import type { BillRequest } from '@/types/bill'
import { TableAlertsBanner } from '@/components/alerts/TableAlertsBanner'
import { TableQrPreview } from '@/components/table-qr/TableQrPreview'
import { downloadBulkQrPdf } from '@/components/table-qr/tableQrPdf'
import {
  fetchAllTables,
  fetchOrderSummariesForIds,
  getCachedTables,
  cacheTables,
  batchCreateTables,
  updateTable,
  deleteTables,
  setTableStatus,
  syncTableMergeGroups,
  type TableData,
  type TableStatus,
} from '@/services/tableService'
import {
  fetchAllPresets,
  createPreset,
  setActivePreset,
  batchUpdateTablePositions,
  updatePreset,
  deletePreset,
  type LayoutPreset,
} from '@/services/layoutService'
import { fetchEvents } from '@/services/eventService'
import type { RestaurantEvent } from '@/types/event'
import { useFloorPlanState } from './useFloorPlanState'
import { FloorPlanEditor } from './FloorPlanEditor'
import { FloorPlanToolbar } from './FloorPlanToolbar'
import { TablePalette } from './TablePalette'
import { TableInspector } from './TableInspector'
import { GridSettingsModal } from './GridSettingsModal'
import { SavePresetModal, ConfirmLoadModal, ConfirmDeletePresetModal } from './PresetModal'
import { findGroupForTable, calculateEffectiveCapacity, disburseCapacities, calculateMergeGroups, type MergeGroup } from '@/utils/floorPlan/adjacency'
import { findFirstAvailablePosition } from '@/utils/floorPlan/collision'
import type { FloorConfig } from '@/utils/floorPlan/grid'
import { calculateCustomTemplateDistribution, type TemplateDistributionTarget } from '@/utils/floorPlan/distribution'
import { fetchAllTableTemplates, getLocalTemplates, type TableTemplate } from '@/services/templateService'
import { ConnectedDistributionSliders } from './ConnectedDistributionSliders'
import { getStoredTableDimensions, saveStoredTableDimensions, type EditorTable } from './useFloorPlanState'

// ─────────────────────────────────────────────────────────────────────────────
// Types / helpers
// ─────────────────────────────────────────────────────────────────────────────

interface ToastMsg { text: string; type: 'success' | 'error' | 'info' }
interface OrderSummary { totalBill: number; activeOrderCount: number }

const OCCUPIED_STATUSES: TableStatus[] = ['OCCUPIED', 'HAS_REQUEST']

/** Apply a list of updated rows into an existing table array (targeted patch). */
function patchTables(prev: TableData[], updated: TableData[]): TableData[] {
  const map = new Map(updated.map((t) => [t.TABLE_ID, t]))
  return prev.map((t) => map.get(t.TABLE_ID) ?? t)
}

// ─────────────────────────────────────────────────────────────────────────────
// PaxStepper
// ─────────────────────────────────────────────────────────────────────────────

interface PaxStepperProps { value: number; min?: number; max?: number; onChange: (v: number) => void; disabled?: boolean; id?: string }

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
    <div className="tm-stepper">
      <button
        type="button"
        className="tm-stepper-btn"
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
        className="tm-stepper-val"
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
        className="tm-stepper-btn"
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

// ─────────────────────────────────────────────────────────────────────────────
// ConfirmDialog (modal) — reused from Phase 2
// ─────────────────────────────────────────────────────────────────────────────

interface ConfirmDialogProps {
  title: string; description: string; confirmLabel: string
  confirmVariant?: 'danger' | 'primary'
  onConfirm: () => void; onCancel: () => void
  loading?: boolean; children?: ReactNode
}

function ConfirmDialog({ title, description, confirmLabel, confirmVariant = 'danger', onConfirm, onCancel, loading, children }: ConfirmDialogProps) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onCancel])

  return (
    <div className="tm-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}>
      <div className="tm-modal tm-modal-sm">
        <div className="tm-modal-header">
          <div>
            <div className="tm-modal-title"><AlertTriangle className="w-4 h-4 text-amber-500" />{title}</div>
            <p className="tm-modal-desc">{description}</p>
          </div>
          <button onClick={onCancel} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"><X className="w-4 h-4" /></button>
        </div>
        {children && <div className="tm-modal-body">{children}</div>}
        <div className="tm-modal-footer">
          <button onClick={onCancel} className="px-3 py-1.5 text-sm font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors">Cancel</button>
          <Button variant={confirmVariant} size="sm" loading={loading} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// AddTablesModal — batch creation with customizable distribution & saved templates
// ─────────────────────────────────────────────────────────────────────────────

interface AddTablesModalProps {
  onClose: () => void
  onCreated: (tables: TableData[], createdTemplates?: TableTemplate[]) => void
  existingNums: number[]
  maxCapacity?: number
  currentEffectivePax?: number
  effectiveMaxPax?: number
}

function AddTablesModal({
  onClose,
  onCreated,
  existingNums,
  maxCapacity = 50,
  currentEffectivePax,
  effectiveMaxPax = 50,
}: AddTablesModalProps) {
  const nextAvailableNum = Math.max(1, ...(existingNums.length > 0 ? [Math.max(...existingNums) + 1] : [1]))
  const [startNum, setStartNum] = useState(nextAvailableNum)
  const [targetPax, setTargetPax] = useState(Math.min(effectiveMaxPax, Math.max(2, maxCapacity)))
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Saved table templates (Standard + Custom)
  const [templates, setTemplates] = useState<TableTemplate[]>(() => getLocalTemplates())

  useEffect(() => {
    void fetchAllTableTemplates().then((all) => {
      if (all.length > 0) setTemplates(all)
    })
  }, [])

  // Active template IDs for distribution
  const [activeTemplateIds, setActiveTemplateIds] = useState<string[]>(() => {
    const local = getLocalTemplates()
    const has4 = local.some((t) => t.id === 'tmpl-4top')
    const has2 = local.some((t) => t.id === 'tmpl-2top')
    if (has4 && has2) return ['tmpl-4top', 'tmpl-2top']
    return local.slice(0, 2).map((t) => t.id)
  })

  // Proportional percentages (sum to 100%)
  const [percentages, setPercentages] = useState<Record<string, number>>(() => {
    return { 'tmpl-4top': 80, 'tmpl-2top': 20 }
  })

  // Toggle template inclusion
  function handleToggleTemplate(templateId: string) {
    if (activeTemplateIds.includes(templateId)) {
      if (activeTemplateIds.length <= 1) return
      const nextActive = activeTemplateIds.filter((id) => id !== templateId)
      setActiveTemplateIds(nextActive)

      const remainingSum = nextActive.reduce((s, id) => s + (percentages[id] ?? 0), 0)
      const nextPct: Record<string, number> = {}
      if (remainingSum > 0) {
        let allocated = 0
        nextActive.forEach((id, idx) => {
          if (idx === nextActive.length - 1) {
            nextPct[id] = Math.max(0, 100 - allocated)
          } else {
            const share = Math.round(((percentages[id] ?? 0) / remainingSum * 100) / 5) * 5
            nextPct[id] = share
            allocated += share
          }
        })
      } else {
        const base = Math.floor(100 / nextActive.length / 5) * 5
        let allocated = 0
        nextActive.forEach((id, idx) => {
          if (idx === nextActive.length - 1) {
            nextPct[id] = Math.max(0, 100 - allocated)
          } else {
            nextPct[id] = base
            allocated += base
          }
        })
      }
      setPercentages(nextPct)
    } else {
      const nextActive = [...activeTemplateIds, templateId]
      setActiveTemplateIds(nextActive)

      const newShare = 20
      const rem = 100 - newShare
      const prevSum = activeTemplateIds.reduce((s, id) => s + (percentages[id] ?? 0), 0)
      const nextPct: Record<string, number> = { [templateId]: newShare }

      let allocated = 0
      activeTemplateIds.forEach((id, idx) => {
        if (idx === activeTemplateIds.length - 1) {
          nextPct[id] = Math.max(0, rem - allocated)
        } else {
          const ratio = prevSum > 0 ? (percentages[id] ?? 0) / prevSum : 1 / activeTemplateIds.length
          const share = Math.round((rem * ratio) / 5) * 5
          nextPct[id] = share
          allocated += share
        }
      })
      setPercentages(nextPct)
    }
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  const activeTargets: TemplateDistributionTarget[] = useMemo(() => {
    return activeTemplateIds.map((id) => {
      const tmpl = templates.find((t) => t.id === id)
      return {
        templateId: id,
        seats: tmpl?.seats ?? 4,
        percentage: percentages[id] ?? 0,
      }
    })
  }, [activeTemplateIds, templates, percentages])

  const plan = useMemo(() => {
    return calculateCustomTemplateDistribution(targetPax, activeTargets, maxCapacity)
  }, [targetPax, activeTargets, maxCapacity])

  const preview = useMemo(() => {
    const existSet = new Set(existingNums)
    const templateMap = new Map(templates.map((t) => [t.id, t]))
    const items = plan.orderedTemplateIds.map((tmplId, i) => {
      const tmpl = templateMap.get(tmplId)
      const cap = tmpl?.seats ?? 4
      const num = startNum + i
      return { num, capacity: cap, template: tmpl, exists: existSet.has(num) }
    })
    const toCreate = items.filter((item) => !item.exists)
    const toSkip = items.filter((item) => item.exists)
    return { items, toCreate, toSkip }
  }, [startNum, plan.orderedTemplateIds, existingNums, templates])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (startNum < 1) { setError('Starting table number must be at least 1.'); return }
    if (targetPax < 2 || targetPax > maxCapacity) {
      setError(`Target pax must be between 2 and ${maxCapacity}.`)
      return
    }
    if (preview.toCreate.length === 0) {
      setError('All table numbers in this range already exist.')
      return
    }
    setLoading(true)
    try {
      const capacities = preview.toCreate.map((item) => item.capacity)
      const templatesForTables = preview.toCreate.map((item) => item.template!).filter(Boolean)
      const result = await batchCreateTables(startNum, capacities, 4, currentEffectivePax, effectiveMaxPax)
      onCreated(result.created, templatesForTables)
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create tables.')
    } finally {
      setLoading(false)
    }
  }

  const createdPax = preview.toCreate.reduce((s, item) => s + item.capacity, 0)

  return (
    <div className="tm-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <form className="tm-modal max-w-xl" onSubmit={handleSubmit} noValidate>
        <div className="tm-modal-header">
          <div>
            <div className="tm-modal-title"><Plus className="w-4 h-4" />Add Tables</div>
            <p className="tm-modal-desc">Customize automatic distribution with snapping sliders across any saved table types.</p>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="tm-modal-body space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="tm-field-label">Starting Table Number</label>
              <PaxStepper
                value={startNum}
                min={1}
                max={999}
                onChange={(v) => {
                  setStartNum(v)
                  setError('')
                }}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="tm-field-label mb-0">Target Pax</label>
                <span className="text-[0.68rem] text-slate-500 font-semibold">
                  Max {maxCapacity} Pax
                </span>
              </div>
              <PaxStepper
                value={targetPax}
                min={2}
                max={maxCapacity}
                onChange={(v) => {
                  setTargetPax(v)
                  setError('')
                }}
              />
            </div>
          </div>

          {/* Connected Snapping Sliders */}
          <ConnectedDistributionSliders
            templates={templates}
            activeTemplateIds={activeTemplateIds}
            percentages={percentages}
            templateCounts={plan.templateCounts}
            onPercentagesChange={setPercentages}
            onToggleTemplate={handleToggleTemplate}
          />

          {plan.totalPax > 0 && !plan.exact && (
            <p className="text-[0.68rem] text-amber-700 font-semibold">
              Target adjusted from {targetPax} to {plan.totalPax} Pax to fit complete tables.
            </p>
          )}

          {preview.items.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="tm-field-label mb-0">Preview ({plan.totalTables} Tables · {plan.totalPax} Pax)</p>
                <span className="text-[0.68rem] text-slate-500 font-medium">
                  {preview.toCreate.length} to create
                </span>
              </div>
              <div className="tm-preview-pills max-h-28 overflow-y-auto">
                {preview.items.map((item) => (
                  <span
                    key={item.num}
                    className={`tm-preview-pill ${item.exists ? 'skip' : 'new'}`}
                    title={`Table ${item.num} (${item.capacity} seats · ${item.template?.label ?? ''})`}
                  >
                    {item.num} <span className="text-[0.6rem] font-normal opacity-75">({item.capacity}p)</span>
                  </span>
                ))}
              </div>
              {preview.toSkip.length > 0 && (
                <p className="tm-error-text mt-1.5">
                  {preview.toSkip.length} table(s) already exist and will be skipped.
                </p>
              )}
              {preview.toCreate.length > 0 && (
                <p className="text-[0.7rem] text-emerald-700 font-semibold mt-1">
                  {preview.toCreate.length} new table(s) will be created ({createdPax} Pax).
                </p>
              )}
            </div>
          )}

          {error && <p className="tm-error-text">{error}</p>}
        </div>

        <div className="tm-modal-footer">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors">
            Cancel
          </button>
          <Button type="submit" variant="primary" size="sm" loading={loading} disabled={preview.toCreate.length === 0}>
            Add {preview.toCreate.length} Table{preview.toCreate.length !== 1 ? 's' : ''} ({createdPax} Pax)
          </Button>
        </div>
      </form>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page — Floor Plan Editor
// ─────────────────────────────────────────────────────────────────────────────

export default function TableManagerPage() {
  // ── Core data ──
  const [tables, setTables] = useState<TableData[]>(() => getCachedTables() ?? [])
  const [billRequests, setBillRequests] = useState<BillRequest[]>([])
  const [orderSummaries, setOrderSummaries] = useState<Map<number, OrderSummary>>(new Map())
  const [events, setEvents] = useState<RestaurantEvent[]>([])

  // ── Floor plan editor state ──
  const floorPlan = useFloorPlanState()

  // ── Presets ──
  const [presets, setPresets] = useState<LayoutPreset[]>([])
  const [activePresetId, setActivePresetId] = useState<number | null>(null)

  // ── Modals ──
  const [showAddModal, setShowAddModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null) // table ID to delete
  const [showRemoveAllConfirm, setShowRemoveAllConfirm] = useState(false)
  const [showGridSettings, setShowGridSettings] = useState(false)
  const [showSavePreset, setShowSavePreset] = useState(false)
  const [confirmLoadPreset, setConfirmLoadPreset] = useState<LayoutPreset | null>(null)
  const [renamePreset, setRenamePreset] = useState<LayoutPreset | null>(null)
  const [deletePresetConfirm, setDeletePresetConfirm] = useState<LayoutPreset | null>(null)
  const [qrModalTable, setQrModalTable] = useState<TableData | null>(null)

  // ── Loading states ──
  const [savingCapacity, setSavingCapacity] = useState(false)
  const [savingPreset, setSavingPreset] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [savingLayout, setSavingLayout] = useState(false)
  const navigationBlocker = useBlocker(floorPlan.isDirty)

  // ── Toast ──
  const [toast, setToast] = useState<ToastMsg | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Mutation guard ──
  const isMutatingRef = useRef(false)
  const initializedRef = useRef(false)

  function showToast(text: string, type: ToastMsg['type'] = 'success') {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast({ text, type })
    toastTimerRef.current = setTimeout(() => setToast(null), 3000)
  }

  const existingTableNums = useMemo(() => tables.map((t) => t.TABLE_NUM), [tables])

  const activePreset = useMemo(
    () => presets.find((p) => p.PRESET_ID === activePresetId) ?? null,
    [presets, activePresetId],
  )

  const activeLinkedEvent = useMemo(() => {
    if (!activePreset) return null
    return events.find((e) =>
      (activePreset.EVENT_ID && e.eventId === activePreset.EVENT_ID) ||
      (e.presetId && e.presetId === activePreset.PRESET_ID)
    ) ?? null
  }, [activePreset, events])

  const effectiveMaxPax = useMemo(() => {
    if (activeLinkedEvent && activeLinkedEvent.maxPax && activeLinkedEvent.maxPax > 0) {
      return activeLinkedEvent.maxPax
    }
    return 50
  }, [activeLinkedEvent])

  const hasActiveOrders = useMemo(() => {
    const hasOccupiedTable = tables.some(
      (t) => OCCUPIED_STATUSES.includes(t.STATUS) || (t.CURRENT_GUEST_COUNT ?? 0) > 0 || t.BILL_OUT_REQUESTED,
    )
    const hasOrdersInProgress = Array.from(orderSummaries.values()).some(
      (s) => s.activeOrderCount > 0,
    )
    const hasActiveBills = billRequests.length > 0
    return Boolean(hasOccupiedTable || hasOrdersInProgress || hasActiveBills)
  }, [tables, orderSummaries, billRequests])

  // ── Selected table for inspector ──
  const inspectorTable = useMemo(
    () => (floorPlan.selectedTableId !== null
      ? tables.find((t) => t.TABLE_ID === floorPlan.selectedTableId) ?? null
      : null),
    [tables, floorPlan.selectedTableId],
  )

  const inspectorPosition = useMemo(
    () => (floorPlan.selectedTableId !== null
      ? floorPlan.positions.find((p) => p.tableId === floorPlan.selectedTableId) ?? null
      : null),
    [floorPlan.positions, floorPlan.selectedTableId],
  )

  const inspectorMergeGroup = useMemo(
    () => (floorPlan.selectedTableId !== null
      ? findGroupForTable(floorPlan.selectedTableId, floorPlan.mergeGroups)
      : null),
    [floorPlan.selectedTableId, floorPlan.mergeGroups],
  )

  const inspectorOrderSummary = useMemo(() => {
    if (!inspectorTable) return undefined
    if (!inspectorMergeGroup || inspectorMergeGroup.memberIds.length <= 1) {
      return orderSummaries.get(inspectorTable.TABLE_ID)
    }
    return inspectorMergeGroup.memberIds.reduce(
      (acc, id) => {
        const s = orderSummaries.get(id)
        return {
          activeOrderCount: acc.activeOrderCount + (s?.activeOrderCount ?? 0),
          totalBill: acc.totalBill + (s?.totalBill ?? 0),
        }
      },
      { activeOrderCount: 0, totalBill: 0 },
    )
  }, [inspectorTable, inspectorMergeGroup, orderSummaries])

  // ── Load order summaries ──
  const loadSummariesForTables = useCallback(async (tableList: TableData[]) => {
    const occupiedIds = tableList
      .filter((t) => OCCUPIED_STATUSES.includes(t.STATUS))
      .map((t) => t.TABLE_ID)
    const summaries = await fetchOrderSummariesForIds(occupiedIds)
    setOrderSummaries((prev) => {
      if (prev.size === summaries.size) {
        let same = true
        for (const [id, s] of summaries.entries()) {
          const p = prev.get(id)
          if (!p || p.activeOrderCount !== s.activeOrderCount || p.totalBill !== s.totalBill) {
            same = false
            break
          }
        }
        if (same) return prev
      }
      return summaries
    })
  }, [])

  // ── Initial full load ──
  const loadAll = useCallback(async () => {
    try {
      const [data, bReqs, eventList] = await Promise.all([
        fetchAllTables(),
        fetchAllBillRequests(),
        fetchEvents().catch(() => [] as RestaurantEvent[]),
      ])
      setBillRequests(bReqs)
      setEvents(eventList)
      cacheTables(data)
      setTables((prev) => {
        if (prev.length === data.length) {
          const same = prev.every((oldT, i) => {
            const n = data[i]
            return (
              n &&
              oldT.TABLE_ID === n.TABLE_ID &&
              oldT.STATUS === n.STATUS &&
              oldT.GUEST_CAPACITY === n.GUEST_CAPACITY &&
              oldT.CURRENT_GUEST_COUNT === n.CURRENT_GUEST_COUNT &&
              oldT.BILL_OUT_REQUESTED === n.BILL_OUT_REQUESTED &&
              oldT.RESERVATION_NAME === n.RESERVATION_NAME
            )
          })
          if (same) return prev
        }
        return data
      })
      await loadSummariesForTables(data)

      // Initialize floor plan positions (only once)
      if (!initializedRef.current) {
        initializedRef.current = true

        // Load presets
        let activePresetForInit: LayoutPreset | null = null
        try {
          const allPresets = await fetchAllPresets()
          setPresets(allPresets)
          const active = allPresets.find((p) => p.IS_ACTIVE)
          if (active) {
            setActivePresetId(active.PRESET_ID)
            activePresetForInit = active

            // Sync active preset's merge groups to Restaurant_Tables if out of sync
            if (active.MERGE_GROUPS && active.MERGE_GROUPS.length > 0) {
              const hasUnsynced = active.MERGE_GROUPS.some((g) => {
                const anchor = data.find((t) => t.TABLE_ID === g.anchorId)
                return !anchor || !anchor.IS_MERGE_CAPTAIN
              })
              if (hasUnsynced) {
                try {
                  const synced = await syncTableMergeGroups(
                    active.MERGE_GROUPS,
                    data.map((t) => t.TABLE_ID),
                    data,
                  )
                  setTables(synced)
                  cacheTables(synced)
                } catch (syncErr) {
                  console.error('[TableManager] Failed to auto-sync active preset merge groups:', syncErr)
                }
              }
            }
          }
        } catch (err) {
          console.error('[TableManager] Failed to load presets:', err)
        }

        const initialConfig = activePresetForInit
          ? {
              widthBlocks: activePresetForInit.FLOOR_WIDTH_BLOCKS ?? 20,
              heightBlocks: activePresetForInit.FLOOR_HEIGHT_BLOCKS ?? 16,
              tableSizeBlocks: activePresetForInit.TABLE_SIZE_BLOCKS ?? 2,
              spacingBlocks: activePresetForInit.TABLE_SPACING_BLOCKS ?? 1,
              snapEnabled: activePresetForInit.SNAP_TO_GRID ?? true,
            }
          : undefined

        floorPlan.initializeFromTables(data, initialConfig)
        floorPlan.markClean()
      }
    } catch (err) {
      console.error('[TableManager] Load error:', err)
    }
  }, [loadSummariesForTables, floorPlan])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  // ── Realtime subscriptions ──
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && !isMutatingRef.current) void loadAll()
    }
    document.addEventListener('visibilitychange', handleVisibility)

    const channel = supabase
      .channel('tm-phase3-tables')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Restaurant_Tables' }, async (payload) => {
        if (payload.eventType === 'UPDATE') {
          const updated = payload.new as TableData
          setTables((prev) => {
            const next = prev.map((t) => t.TABLE_ID === updated.TABLE_ID ? updated : t)
            cacheTables(next)
            return next
          })
          const oldStatus = (payload.old as Partial<TableData>).STATUS as TableStatus | undefined
          const newStatus = updated.STATUS
          const wasOccupied = oldStatus && OCCUPIED_STATUSES.includes(oldStatus)
          const isNowOccupied = OCCUPIED_STATUSES.includes(newStatus)
          if (wasOccupied || isNowOccupied) {
            const summaries = await fetchOrderSummariesForIds([updated.TABLE_ID])
            setOrderSummaries((prev) => {
              const next = new Map(prev)
              const s = summaries.get(updated.TABLE_ID)
              if (s) next.set(updated.TABLE_ID, s)
              else next.delete(updated.TABLE_ID)
              return next
            })
          }
        } else if (payload.eventType === 'INSERT') {
          const inserted = payload.new as TableData
          setTables((prev) => {
            if (prev.some((t) => t.TABLE_ID === inserted.TABLE_ID)) return prev
            const next = [...prev, inserted].sort((a, b) => a.TABLE_NUM - b.TABLE_NUM)
            cacheTables(next)
            return next
          })
          // Auto-place new table on floor plan
          floorPlan.addTable(inserted)
        } else if (payload.eventType === 'DELETE') {
          const deletedId = (payload.old as { TABLE_ID: number }).TABLE_ID
          setTables((prev) => {
            const next = prev.filter((t) => t.TABLE_ID !== deletedId)
            cacheTables(next)
            return next
          })
          floorPlan.removeTable(deletedId)
        }
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'Restaurant_Orders' },
        async (payload) => {
          const newRow = payload.new as Record<string, unknown> | null
          const oldRow = payload.old as Record<string, unknown> | null
          const targetTableId = Number(newRow?.['TABLE_ID'] || oldRow?.['TABLE_ID'])
          if (targetTableId) {
            const summaries = await fetchOrderSummariesForIds([targetTableId])
            setOrderSummaries((prev) => {
              const next = new Map(prev)
              const s = summaries.get(targetTableId)
              if (s) next.set(targetTableId, s)
              else next.delete(targetTableId)
              return next
            })
          }
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'Bill_Requests' },
        () => {
          void fetchAllBillRequests().then(setBillRequests)
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'Restaurant_Events' },
        async () => {
          const evts = await fetchEvents().catch(() => [])
          setEvents(evts)
        },
      )
      .on('broadcast', { event: 'assistance_request' }, (payload) => {
        const { tableId, tableIds } = (payload.payload ?? {}) as { tableId?: number; tableIds?: number[] }
        const ids = tableIds && tableIds.length > 0 ? tableIds : (tableId ? [tableId] : [])
        if (ids.length > 0) {
          setTables((prev) => prev.map((t) => ids.includes(t.TABLE_ID) ? { ...t, STATUS: 'HAS_REQUEST' } : t))
        }
      })
      .on('broadcast', { event: 'assistance_resolved' }, (payload) => {
        const { tableId, tableIds } = (payload.payload ?? {}) as { tableId?: number; tableIds?: number[] }
        const ids = tableIds && tableIds.length > 0 ? tableIds : (tableId ? [tableId] : [])
        if (ids.length > 0) {
          setTables((prev) => prev.map((t) => ids.includes(t.TABLE_ID) ? { ...t, STATUS: 'OCCUPIED', BILL_OUT_REQUESTED: false } : t))
        }
      })
      .subscribe()

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      void supabase.removeChannel(channel)
    }
  }, [loadAll, floorPlan])

  // ── Table operations ──────────────────────────────────────────────────────

  async function handleAddTable(capacity: number, widthBlocks?: number, heightBlocks?: number) {
    if (totalSeats + capacity > effectiveMaxPax) {
      showToast(`Cannot add table: remaining seating budget is ${Math.max(0, effectiveMaxPax - totalSeats)} Pax.`, 'error')
      return
    }
    isMutatingRef.current = true
    try {
      const nextNum = Math.max(0, ...tables.map((t) => t.TABLE_NUM)) + 1
      const result = await batchCreateTables(nextNum, 1, capacity, totalSeats, effectiveMaxPax)
      if (result.created.length > 0) {
        const newTable = result.created[0]
        setTables((prev) => [...prev, ...result.created].sort((a, b) => a.TABLE_NUM - b.TABLE_NUM))
        floorPlan.addTable(newTable, widthBlocks, heightBlocks)
        floorPlan.setSelectedTableId(newTable.TABLE_ID)
        showToast(`Table ${newTable.TABLE_NUM} added (${capacity} Pax).`, 'success')
      }
    } catch (err: unknown) {
      showToast((err as Error).message, 'error')
    } finally {
      isMutatingRef.current = false
    }
  }

  async function handleCapacityChange(tableId: number, capacity: number): Promise<boolean> {
    setSavingCapacity(true)
    isMutatingRef.current = true
    try {
      const updated = await updateTable(tableId, { capacity })
      setTables((prev) => patchTables(prev, updated))
      showToast('Capacity updated.', 'success')
      return true
    } catch (err: unknown) {
      showToast((err as Error).message, 'error')
      return false
    } finally {
      setSavingCapacity(false)
      isMutatingRef.current = false
    }
  }

  async function handleStatusChange(tableId: number, status: TableStatus) {
    isMutatingRef.current = true
    try {
      const updated = await setTableStatus(tableId, status)
      setTables((prev) => patchTables(prev, updated))
      if (OCCUPIED_STATUSES.includes(status)) {
        const summaries = await fetchOrderSummariesForIds([tableId])
        setOrderSummaries((prev) => new Map([...prev, ...summaries]))
      }
      showToast(`Table marked as ${status.toLowerCase().replace('_', ' ')}.`, 'success')
    } catch (err: unknown) {
      showToast((err as Error).message, 'error')
    } finally {
      isMutatingRef.current = false
    }
  }

  async function handleDeleteTable(tableId: number) {
    setDeleteLoading(true)
    isMutatingRef.current = true
    try {
      const result = await deleteTables([tableId])
      if (result.deleted.length > 0) {
        setTables((prev) => prev.filter((t) => !result.deleted.includes(t.TABLE_ID)))
        setOrderSummaries((prev) => { const next = new Map(prev); result.deleted.forEach(id => next.delete(id)); return next })
        floorPlan.removeTable(tableId)
        showToast('Table deleted.', 'success')
      }
      if (result.blocked.length > 0) {
        showToast(result.blocked[0].reason, 'error')
      }
      setShowDeleteConfirm(null)
    } catch (err: unknown) {
      showToast((err as Error).message, 'error')
    } finally {
      setDeleteLoading(false)
      isMutatingRef.current = false
    }
  }

  async function handleRemoveAllTables() {
    setDeleteLoading(true)
    isMutatingRef.current = true
    try {
      const result = await deleteTables(tables.map((table) => table.TABLE_ID))
      if (result.deleted.length > 0) {
        setTables((prev) => prev.filter((table) => !result.deleted.includes(table.TABLE_ID)))
        setOrderSummaries((prev) => {
          const next = new Map(prev)
          result.deleted.forEach((id) => next.delete(id))
          return next
        })
        result.deleted.forEach((id) => floorPlan.removeTable(id))
      }
      if (result.blocked.length > 0) {
        showToast(`${result.deleted.length} removed; ${result.blocked.length} kept because they have active data.`, 'info')
      } else {
        showToast(`${result.deleted.length} table(s) removed.`, 'success')
      }
      setShowRemoveAllConfirm(false)
    } catch (err: unknown) {
      showToast((err as Error).message, 'error')
    } finally {
      setDeleteLoading(false)
      isMutatingRef.current = false
    }
  }

  // ── Assistance & Bill Out ──

  async function handleClearAssistance(tableId: number) {
    isMutatingRef.current = true
    try {
      const affectedIds = await resolveTableAssistance(tableId)
      setTables((prev) =>
        prev.map((t) =>
          affectedIds.includes(t.TABLE_ID)
            ? { ...t, STATUS: 'OCCUPIED', BILL_OUT_REQUESTED: false }
            : t,
        ),
      )
      showToast('Assistance alert cleared.', 'info')
    } finally {
      isMutatingRef.current = false
    }
  }

  async function handleClearBillOut(tableId: number) {
    isMutatingRef.current = true
    try {
      const affectedIds = await resolveBillOutRequest(tableId)
      setTables((prev) =>
        prev.map((t) =>
          affectedIds.includes(t.TABLE_ID)
            ? { ...t, BILL_OUT_REQUESTED: false }
            : t,
        ),
      )
      setBillRequests((prev) =>
        prev.filter((r) => !affectedIds.includes(r.tableId)),
      )
      showToast('Bill out request cleared.', 'info')
    } finally {
      isMutatingRef.current = false
    }
  }

  // ── Layout persistence ──

  async function handleSaveLayout(): Promise<boolean> {
    setSavingLayout(true)
    try {
      await batchUpdateTablePositions(
        floorPlan.positions.map((p) => ({ tableId: p.tableId, x: p.x, y: p.y })),
      )
      const positionsWithDims = floorPlan.positions.map((p) => ({
        tableId: p.tableId,
        x: p.x,
        y: p.y,
        widthBlocks: p.widthBlocks,
        heightBlocks: p.heightBlocks,
        rotation: p.rotation ?? 0,
        capacity: tables.find((t) => t.TABLE_ID === p.tableId)?.GUEST_CAPACITY,
      }))

      // Synchronize merge groups to Restaurant_Tables in Supabase
      const updatedTables = await syncTableMergeGroups(
        floorPlan.mergeGroups,
        tables.map((t) => t.TABLE_ID),
        tables,
      )
      setTables(updatedTables)
      cacheTables(updatedTables)

      if (activePresetId !== null) {
        const updatedPreset = await updatePreset(activePresetId, {
          config: floorPlan.config,
          positions: positionsWithDims,
          mergeGroups: floorPlan.mergeGroups,
        })
        setPresets((prev) => prev.map((preset) =>
          preset.PRESET_ID === updatedPreset.PRESET_ID ? updatedPreset : preset,
        ))
        const activeName =
          presets.find((p) => p.PRESET_ID === activePresetId)?.PRESET_NAME ||
          updatedPreset.PRESET_NAME
        showToast(`Layout "${activeName}" saved.`, 'success')
      } else {
        showToast('Layout saved.', 'success')
      }
      floorPlan.markClean()
      return true
    } catch (err: unknown) {
      showToast((err as Error).message, 'error')
      return false
    } finally {
      setSavingLayout(false)
    }
  }

  async function handleToolbarSave() {
    if (activePresetId !== null) {
      await handleSaveLayout()
    } else {
      setShowSavePreset(true)
    }
  }

  async function handleSavePreset(name: string, description: string, eventId?: number | null) {
    setSavingPreset(true)
    try {
      // Save current positions to DB first
      await batchUpdateTablePositions(
        floorPlan.positions.map((p) => ({ tableId: p.tableId, x: p.x, y: p.y })),
      )
      const positionsWithDims = floorPlan.positions.map((p) => ({
        tableId: p.tableId,
        x: p.x,
        y: p.y,
        widthBlocks: p.widthBlocks,
        heightBlocks: p.heightBlocks,
        rotation: p.rotation ?? 0,
        capacity: tables.find((t) => t.TABLE_ID === p.tableId)?.GUEST_CAPACITY,
      }))

      // Synchronize merge groups to Restaurant_Tables in Supabase
      const updatedTables = await syncTableMergeGroups(
        floorPlan.mergeGroups,
        tables.map((t) => t.TABLE_ID),
        tables,
      )
      setTables(updatedTables)
      cacheTables(updatedTables)

      const preset = await createPreset(
        name,
        description || null,
        floorPlan.config,
        positionsWithDims,
        floorPlan.mergeGroups,
        eventId ?? null,
      )
      await setActivePreset(preset.PRESET_ID)
      setActivePresetId(preset.PRESET_ID)
      setPresets((prev) => [
        { ...preset, IS_ACTIVE: true },
        ...prev.map((p) => ({ ...p, IS_ACTIVE: false })),
      ])
      setShowSavePreset(false)
      floorPlan.markClean()
      showToast(`Layout "${name}" saved.`, 'success')
    } catch (err: unknown) {
      showToast((err as Error).message, 'error')
    } finally {
      setSavingPreset(false)
    }
  }

  async function handleRenamePreset(name: string, description: string, eventId?: number | null) {
    if (!renamePreset) return
    setSavingPreset(true)
    try {
      const updated = await updatePreset(renamePreset.PRESET_ID, { name, description, eventId })
      setPresets((prev) => prev.map((preset) => preset.PRESET_ID === updated.PRESET_ID ? updated : preset))
      setRenamePreset(null)
      showToast('Layout updated.', 'success')
    } catch (err: unknown) {
      showToast((err as Error).message, 'error')
    } finally {
      setSavingPreset(false)
    }
  }

  async function handleDeletePreset() {
    if (!deletePresetConfirm) return
    setSavingPreset(true)
    try {
      await deletePreset(deletePresetConfirm.PRESET_ID)
      setPresets((prev) => prev.filter((preset) => preset.PRESET_ID !== deletePresetConfirm.PRESET_ID))
      if (activePresetId === deletePresetConfirm.PRESET_ID) setActivePresetId(null)
      setDeletePresetConfirm(null)
      showToast('Saved layout deleted. Restaurant tables were not changed.', 'success')
    } catch (err: unknown) {
      showToast((err as Error).message, 'error')
    } finally {
      setSavingPreset(false)
    }
  }

  async function handleLoadPreset(presetId: number) {
    if (hasActiveOrders) {
      showToast('Cannot switch table layout while active orders are in progress.', 'error')
      return
    }

    const preset = presets.find((p) => p.PRESET_ID === presetId)
    if (!preset) return

    // Check for unsaved changes
    if (floorPlan.isDirty) {
      setConfirmLoadPreset(preset)
      return
    }

    await doLoadPreset(preset)
  }

  async function doLoadPreset(preset: LayoutPreset) {
    if (hasActiveOrders) {
      showToast('Cannot switch table layout while active orders are in progress.', 'error')
      return
    }
    try {
      // Apply preset config
      floorPlan.setConfig({
        widthBlocks: preset.FLOOR_WIDTH_BLOCKS ?? 20,
        heightBlocks: preset.FLOOR_HEIGHT_BLOCKS ?? 16,
        tableSizeBlocks: preset.TABLE_SIZE_BLOCKS ?? 2,
        spacingBlocks: preset.TABLE_SPACING_BLOCKS ?? 1,
        snapEnabled: preset.SNAP_TO_GRID ?? true,
      })

      const presetPlacements = preset.LAYOUT_DATA ?? []
      if (presetPlacements.length === 0) {
        showToast(`Preset "${preset.PRESET_NAME}" has no table layout data.`, 'info')
        return
      }

      let currentTables = [...tables]
      const assignedPositions: EditorTable[] = []
      const usedTableIds = new Set<number>()

      // Pass 1: exact tableId match
      for (const p of presetPlacements) {
        const match = currentTables.find((t) => t.TABLE_ID === p.tableId && !usedTableIds.has(t.TABLE_ID))
        if (match) {
          usedTableIds.add(match.TABLE_ID)
          assignedPositions.push({
            tableId: match.TABLE_ID,
            x: p.x,
            y: p.y,
            widthBlocks: (p as any).widthBlocks,
            heightBlocks: (p as any).heightBlocks,
            rotation: (p as any).rotation ?? 0,
          })
        }
      }

      // Pass 2: unassigned preset placements matched to available tables
      const unassignedPreset = presetPlacements.filter(
        (p) => !assignedPositions.some((ap) => ap.x === p.x && ap.y === p.y),
      )
      const availableTables = currentTables.filter((t) => !usedTableIds.has(t.TABLE_ID))

      let availIdx = 0
      const missingToCreate: typeof presetPlacements = []

      for (const p of unassignedPreset) {
        if (availIdx < availableTables.length) {
          const t = availableTables[availIdx++]
          usedTableIds.add(t.TABLE_ID)
          assignedPositions.push({
            tableId: t.TABLE_ID,
            x: p.x,
            y: p.y,
            widthBlocks: (p as any).widthBlocks,
            heightBlocks: (p as any).heightBlocks,
            rotation: (p as any).rotation ?? 0,
          })
        } else {
          missingToCreate.push(p)
        }
      }

      // Pass 3: If preset needs more tables than exist in DB, create them
      if (missingToCreate.length > 0) {
        const startNum = Math.max(0, ...currentTables.map((t) => t.TABLE_NUM)) + 1
        const capacities = missingToCreate.map((p: any) => p.capacity ?? 4)
        const res = await batchCreateTables(startNum, capacities, 4, 0)
        if (res.created.length > 0) {
          currentTables = [...currentTables, ...res.created].sort((a, b) => a.TABLE_NUM - b.TABLE_NUM)
          setTables(currentTables)
          res.created.forEach((newT, i) => {
            const p = missingToCreate[i]
            assignedPositions.push({
              tableId: newT.TABLE_ID,
              x: p.x,
              y: p.y,
              widthBlocks: (p as any).widthBlocks,
              heightBlocks: (p as any).heightBlocks,
              rotation: (p as any).rotation ?? 0,
            })
          })
        }
      }

      floorPlan.setPositions(assignedPositions)

      // Save positions to DB
      await batchUpdateTablePositions(
        assignedPositions.map((p) => ({ tableId: p.tableId, x: p.x, y: p.y })),
      )

      // Calculate merge groups from newly assigned positions and sync to Restaurant_Tables
      const newMergeGroups = calculateMergeGroups(
        assignedPositions,
        preset.TABLE_SIZE_BLOCKS ?? floorPlan.config.tableSizeBlocks,
      )
      const updatedTables = await syncTableMergeGroups(
        newMergeGroups,
        currentTables.map((t) => t.TABLE_ID),
        currentTables,
      )
      setTables(updatedTables)
      cacheTables(updatedTables)

      // Save dimensions and rotation to localStorage
      const dims = getStoredTableDimensions()
      assignedPositions.forEach((p) => {
        dims[p.tableId] = {
          widthBlocks: p.widthBlocks ?? preset.TABLE_SIZE_BLOCKS,
          heightBlocks: p.heightBlocks ?? preset.TABLE_SIZE_BLOCKS,
          rotation: p.rotation ?? 0,
        }
      })
      saveStoredTableDimensions(dims)

      // Set as active
      await setActivePreset(preset.PRESET_ID)
      setActivePresetId(preset.PRESET_ID)
      setPresets((prev) =>
        prev.map((p) => ({ ...p, IS_ACTIVE: p.PRESET_ID === preset.PRESET_ID })),
      )

      floorPlan.markClean()
      setConfirmLoadPreset(null)
      showToast(`Layout "${preset.PRESET_NAME}" loaded successfully.`, 'success')
    } catch (err: unknown) {
      showToast((err as Error).message, 'error')
    }
  }

  // ── Grid settings ──

  function handleGridSettingsSave(config: FloorConfig) {
    floorPlan.setConfig(config)
    setShowGridSettings(false)
    showToast('Grid settings applied. Click "Save Layout" to persist.', 'info')
  }

  // ── Unmerge ──

  async function handleUnmerge(anchorId: number) {
    const group = floorPlan.mergeGroups.find(
      (g) => g.anchorId === anchorId || g.memberIds.includes(anchorId),
    )
    if (!group || group.memberIds.length <= 1) {
      showToast('This table is not merged.', 'info')
      return
    }

    // Move non-anchor tables to open spots
    const nonAnchors = group.memberIds.filter((id) => id !== group.anchorId)
    let updatedPositions = [...floorPlan.positions]

    for (const id of nonAnchors) {
      const currentPos = updatedPositions.find((p) => p.tableId === id)
      const w = currentPos?.widthBlocks ?? floorPlan.config.tableSizeBlocks
      const h = currentPos?.heightBlocks ?? floorPlan.config.tableSizeBlocks

      const pos = findFirstAvailablePosition(
        floorPlan.config.tableSizeBlocks,
        floorPlan.config.widthBlocks,
        floorPlan.config.heightBlocks,
        updatedPositions.filter((p) => p.tableId !== id),
        floorPlan.config.spacingBlocks,
        w,
        h,
      )
      if (pos) {
        updatedPositions = updatedPositions.map((p) =>
          p.tableId === id ? { ...p, x: pos.x, y: pos.y } : p,
        )
      }
    }

    floorPlan.setPositions(updatedPositions)
    showToast('Tables unmerged.', 'success')
  }

  // ── Auto-disbursement when unmerging at 50/50 capacity ──
  const prevMergeGroupsRef = useRef<MergeGroup[]>([])

  useEffect(() => {
    const prevGroups = prevMergeGroupsRef.current
    const currGroups = floorPlan.mergeGroups
    prevMergeGroupsRef.current = currGroups

    if (prevGroups.length === 0) return

    // Find tables that were grouped with 2+ members before, but separated
    const unmergedTableIds = new Set<number>()
    for (const oldGroup of prevGroups) {
      for (const id of oldGroup.memberIds) {
        const newGroup = currGroups.find((g) => g.memberIds.includes(id))
        if (!newGroup || oldGroup.memberIds.some((formerId) => !newGroup.memberIds.includes(formerId))) {
          unmergedTableIds.add(id)
        }
      }
    }

    if (unmergedTableIds.size === 0) return

    // Calculate effective seating on floor
    const floorSeats = tables.reduce((sum, t) => {
      return sum + calculateEffectiveCapacity(
        t,
        floorPlan.positions,
        floorPlan.config.tableSizeBlocks,
        floorPlan.mergeGroups,
      )
    }, 0)

    if (floorSeats > effectiveMaxPax) {
      const unmergedTablesList = tables.filter((t) => unmergedTableIds.has(t.TABLE_ID))
      const otherTablesPax = tables
        .filter((t) => !unmergedTableIds.has(t.TABLE_ID))
        .reduce((sum, t) => {
          return sum + calculateEffectiveCapacity(
            t,
            floorPlan.positions,
            floorPlan.config.tableSizeBlocks,
            floorPlan.mergeGroups,
          )
        }, 0)

      const availableBudget = Math.max(unmergedTablesList.length, effectiveMaxPax - otherTablesPax)
      const disbursements = disburseCapacities(unmergedTablesList, availableBudget)

      // Apply to React state immediately
      setTables((prev) =>
        prev.map((t) => {
          const update = disbursements.find((d) => d.tableId === t.TABLE_ID)
          return update ? { ...t, GUEST_CAPACITY: update.newCapacity } : t
        }),
      )

      // Persist to database asynchronously
      void Promise.all(
        disbursements.map((d) => updateTable(d.tableId, { capacity: d.newCapacity })),
      ).then(() => {
        showToast(`Table capacities disbursed to maintain the ${effectiveMaxPax} Pax floor limit.`, 'info')
      }).catch((e: Error) => {
        console.error('Failed to update unmerged capacities:', e)
      })
    }
  }, [floorPlan.positions, floorPlan.mergeGroups, tables, floorPlan.config.tableSizeBlocks, effectiveMaxPax])

  // ── Totals ──
  const totalSeats = useMemo(() => {
    return tables.reduce((sum, t) => {
      return sum + calculateEffectiveCapacity(
        t,
        floorPlan.positions,
        floorPlan.config.tableSizeBlocks,
        floorPlan.mergeGroups,
      )
    }, 0)
  }, [tables, floorPlan.positions, floorPlan.config.tableSizeBlocks, floorPlan.mergeGroups])

  // ── Render ────────────────────────────────────────────────────────────────





  useEffect(() => {
    if (!floorPlan.isDirty) return
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [floorPlan.isDirty])

  return (
    <div className="table-manager-page-container staff-page fp-layout-root">
      {/* Toast */}
      {toast && (
        <div className={`tm-toast tm-toast-${toast.type}`}>
          {toast.type === 'success' && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
          {toast.type === 'error' && <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
          {toast.text}
        </div>
      )}

      {/* Alerts Banner */}
      <TableAlertsBanner
        tables={tables}
        billRequests={billRequests}
        onClearAssistance={handleClearAssistance}
        onClearBillOut={handleClearBillOut}
      />

      {/* Toolbar */}
      <FloorPlanToolbar
        zoom={floorPlan.zoom}
        canUndo={floorPlan.canUndo}
        canRedo={floorPlan.canRedo}
        snapEnabled={floorPlan.config.snapEnabled}
        isDirty={floorPlan.isDirty}
        saving={savingLayout}
        activePresetName={activePreset?.PRESET_NAME}
        onUndo={floorPlan.undo}
        onRedo={floorPlan.redo}
        onRotateSelected={floorPlan.selectedTableId !== null ? () => floorPlan.rotateTable(floorPlan.selectedTableId!) : undefined}
        onZoomIn={floorPlan.zoomIn}
        onZoomOut={floorPlan.zoomOut}
        onResetZoom={floorPlan.resetZoom}
        onToggleSnap={() => floorPlan.updateConfig({ snapEnabled: !floorPlan.config.snapEnabled })}
        onOpenGridSettings={() => setShowGridSettings(true)}
        onSavePreset={handleToolbarSave}
        onPrintQr={() => {
          if (tables.length > 0) void downloadBulkQrPdf(tables)
        }}
        onRemoveAll={() => {
          if (tables.length > 0) setShowRemoveAllConfirm(true)
        }}
      />

      {/* Three-panel layout */}
      <div className="fp-three-panel">
        {/* Left — Palette */}
        <TablePalette
          onAddTable={handleAddTable}
          presets={presets}
          activePresetId={activePresetId}
          onLoadPreset={handleLoadPreset}
          onSavePreset={() => setShowSavePreset(true)}
          onRenamePreset={setRenamePreset}
          onDeletePreset={setDeletePresetConfirm}
          tableCount={floorPlan.positions.length}
          totalSeats={totalSeats}
          maxPax={effectiveMaxPax}
          activeLinkedEvent={activeLinkedEvent}
          hasActiveOrders={hasActiveOrders}
        />

        {/* Center — Floor Plan */}
        <div className="fp-center-panel">
          {tables.length === 0 ? (
            <div className="fp-empty">
              <div className="fp-empty-icon"><TableProperties className="w-7 h-7" /></div>
              <div>
                <p className="fp-empty-title">No tables yet</p>
                <p className="fp-empty-desc">Add your first table to get started.</p>
              </div>
              <Button variant="primary" size="sm" onClick={() => setShowAddModal(true)}>
                <Plus className="w-3.5 h-3.5" /> Add Tables
              </Button>
            </div>
          ) : (
            <FloorPlanEditor
              floorPlan={floorPlan}
              tables={tables}
              onSelectTable={(id) => floorPlan.setSelectedTableId(id)}
            />
          )}
        </div>

        {/* Right — Inspector */}
        <TableInspector
          table={inspectorTable}
          position={inspectorPosition}
          tableSizeBlocks={floorPlan.config.tableSizeBlocks}
          maxCapacity={inspectorTable ? Math.max(inspectorTable.GUEST_CAPACITY, effectiveMaxPax - (totalSeats - inspectorTable.GUEST_CAPACITY)) : effectiveMaxPax}
          mergeGroup={inspectorMergeGroup}
          allTables={tables}
          allPositions={floorPlan.positions}
          onClose={() => floorPlan.setSelectedTableId(null)}
          onCapacityChange={handleCapacityChange}
          onDimensionsChange={(id, w, h) => floorPlan.updateTableDimensions(id, w, h)}
          onRotate={(id) => floorPlan.rotateTable(id)}
          onStatusChange={handleStatusChange}
          onDelete={(id) => setShowDeleteConfirm(id)}
          onQrPrint={(id) => {
            const t = tables.find((t) => t.TABLE_ID === id)
            if (t) setQrModalTable(t)
          }}
          onUnmerge={handleUnmerge}
          saving={savingCapacity}
          orderSummary={inspectorOrderSummary}
        />
      </div>

      {/* ── Modals ── */}
      {showAddModal && (
        <AddTablesModal
          onClose={() => setShowAddModal(false)}
          existingNums={existingTableNums}
          maxCapacity={Math.max(0, effectiveMaxPax - totalSeats)}
          currentEffectivePax={totalSeats}
          effectiveMaxPax={effectiveMaxPax}
          onCreated={(newTables, createdTemplates) => {
            setTables((prev) => [...prev, ...newTables].sort((a, b) => a.TABLE_NUM - b.TABLE_NUM))
            newTables.forEach((t, i) => {
              const tmpl = createdTemplates?.[i]
              floorPlan.addTable(t, tmpl?.widthBlocks, tmpl?.heightBlocks)
            })
            const addedPax = newTables.reduce((s, t) => s + t.GUEST_CAPACITY, 0)
            showToast(`${newTables.length} table(s) added (${addedPax} Pax).`, 'success')
          }}
        />
      )}

      {showDeleteConfirm !== null && (
        <ConfirmDialog
          title="Delete Table?"
          description="Tables with active orders cannot be deleted."
          confirmLabel="Delete Table"
          confirmVariant="danger"
          loading={deleteLoading}
          onConfirm={() => void handleDeleteTable(showDeleteConfirm)}
          onCancel={() => setShowDeleteConfirm(null)}
        />
      )}

      {showRemoveAllConfirm && (
        <ConfirmDialog
          title="Remove all tables?"
          description="Tables with active orders are kept. This permanently removes every other table, including complete merge groups."
          confirmLabel="Remove All Tables"
          confirmVariant="danger"
          loading={deleteLoading}
          onConfirm={() => void handleRemoveAllTables()}
          onCancel={() => setShowRemoveAllConfirm(false)}
        />
      )}

      {showGridSettings && (
        <GridSettingsModal
          config={floorPlan.config}
          activePresetName={activePreset?.PRESET_NAME}
          onSave={handleGridSettingsSave}
          onClose={() => setShowGridSettings(false)}
        />
      )}

      {showSavePreset && (
        <SavePresetModal
          config={floorPlan.config}
          events={events}
          onSave={handleSavePreset}
          onClose={() => setShowSavePreset(false)}
          loading={savingPreset}
        />
      )}

      {renamePreset && (
        <SavePresetModal
          initialName={renamePreset.PRESET_NAME}
          initialDescription={renamePreset.DESCRIPTION ?? ''}
          initialEventId={renamePreset.EVENT_ID ?? null}
          events={events}
          isUpdate
          onSave={handleRenamePreset}
          onClose={() => setRenamePreset(null)}
          loading={savingPreset}
        />
      )}

      {deletePresetConfirm && (
        <ConfirmDeletePresetModal
          presetName={deletePresetConfirm.PRESET_NAME}
          onConfirm={() => void handleDeletePreset()}
          onCancel={() => setDeletePresetConfirm(null)}
          loading={savingPreset}
        />
      )}

      {confirmLoadPreset && (
        <ConfirmLoadModal
          presetName={confirmLoadPreset.PRESET_NAME}
          onConfirm={() => void doLoadPreset(confirmLoadPreset)}
          onCancel={() => setConfirmLoadPreset(null)}
          loading={false}
        />
      )}

      {navigationBlocker.state === 'blocked' && (
        <ConfirmDialog
          title="Save layout before leaving?"
          description="Your table layout changes have not been saved yet. Save them before continuing to the next page."
          confirmLabel="Save and Leave"
          confirmVariant="primary"
          loading={savingLayout}
          onConfirm={() => {
            void handleSaveLayout().then((layoutSaved) => {
              if (layoutSaved) navigationBlocker.proceed()
            })
          }}
          onCancel={() => navigationBlocker.reset()}
        />
      )}

      {qrModalTable && (
        <TableQrPreview
          tableId={qrModalTable.TABLE_ID}
          tableNum={qrModalTable.TABLE_NUM}
          guestCapacity={qrModalTable.GUEST_CAPACITY}
          onClose={() => setQrModalTable(null)}
        />
      )}
    </div>
  )
}
