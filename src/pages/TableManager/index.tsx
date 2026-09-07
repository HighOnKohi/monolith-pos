/**
 * TableManager — Phase 2
 *
 * Architecture:
 * - mode: 'normal' | 'multi'
 *   · normal: clicking a card opens the right sidebar for that table
 *   · multi: clicking cards toggles checkbox selection; sidebar shows bulk panel
 * - Refresh loop fix: realtime events do targeted setTables patches (no full reload).
 *   loadOrderSummaries is called ONCE on initial load, then per-table on status changes.
 * - Sidebar is always-visible (persistent right panel, not a modal).
 */

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  memo,
  type ReactNode,
} from 'react'
import {
  Users,
  Plus,
  Trash2,
  X,
  QrCode,
  FileDown,
  Printer,
  RefreshCw,
  Check,
  AlertTriangle,
  TableProperties,
  Minus,
  CheckCircle2,
  LayoutGrid,
  CheckCheck,
  GitMerge,
  BookMarked,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'
import { resolveTableAssistance } from '@/services/assistanceService'
import { resolveBillOutRequest, fetchAllBillRequests } from '@/services/billService'
import type { BillRequest } from '@/types/bill'
import { TableAlertsBanner } from '@/components/alerts/TableAlertsBanner'
import { TableQrPreview } from '@/components/table-qr/TableQrPreview'
import { downloadBulkQrPdf } from '@/components/table-qr/tableQrPdf'
import { printBulkQrPdf } from '@/components/table-qr/tableQrPrinter'
import {
  fetchAllTables,
  fetchOrderSummariesForIds,
  getCachedTables,
  cacheTables,
  batchCreateTables,
  updateTable,
  deleteTables,
  bulkEditTables,
  reserveTable,
  cancelReservation,
  setTableStatus,
  saveTableMerge,
  type TableData,
  type TableStatus,
  type ReservationData,
} from '@/services/tableService'

// ─────────────────────────────────────────────────────────────────────────────
// Types / helpers
// ─────────────────────────────────────────────────────────────────────────────

type PageMode = 'normal' | 'multi' | 'merge'

interface ToastMsg { text: string; type: 'success' | 'error' | 'info' }

interface OrderSummary { totalBill: number; activeOrderCount: number }

const OCCUPIED_STATUSES: TableStatus[] = ['OCCUPIED', 'HAS_REQUEST']

function statusLabel(s: TableStatus): string {
  return { AVAILABLE: 'Available', OCCUPIED: 'Occupied', RESERVED: 'Reserved', HAS_REQUEST: 'Needs Help', UNAVAILABLE: 'Unavailable' }[s] ?? s
}

function statusClass(s: TableStatus): string {
  return { AVAILABLE: 'tm-status-available', OCCUPIED: 'tm-status-occupied', RESERVED: 'tm-status-reserved', HAS_REQUEST: 'tm-status-has_request', UNAVAILABLE: 'tm-status-unavailable' }[s] ?? ''
}

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
  useEffect(() => { setRaw(String(value)) }, [value])

  function commit(v: string) {
    const n = parseInt(v, 10)
    if (isNaN(n)) { setRaw(String(value)); return }
    const c = Math.max(min, Math.min(max, n))
    setRaw(String(c)); onChange(c)
  }

  return (
    <div className="tm-stepper">
      <button type="button" className="tm-stepper-btn" onClick={() => onChange(Math.max(min, value - 1))} disabled={disabled || value <= min}>
        <Minus className="w-3 h-3" />
      </button>
      <input id={id} type="number" className="tm-stepper-val" value={raw} min={min} max={max} disabled={disabled}
        onChange={(e) => setRaw(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') commit((e.target as HTMLInputElement).value) }} />
      <button type="button" className="tm-stepper-btn" onClick={() => onChange(Math.min(max, value + 1))} disabled={disabled || value >= max}>
        <Plus className="w-3 h-3" />
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ConfirmDialog (modal)
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
// AddTablesModal — batch creation
// ─────────────────────────────────────────────────────────────────────────────

interface AddTablesModalProps { onClose: () => void; onCreated: (tables: TableData[]) => void; existingNums: number[] }

function AddTablesModal({ onClose, onCreated, existingNums }: AddTablesModalProps) {
  const [startNum, setStartNum] = useState(Math.max(1, ...(existingNums.length > 0 ? [Math.max(...existingNums) + 1] : [1])))
  const [count, setCount] = useState(1)
  const [capacity, setCapacity] = useState(4)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  const preview = useMemo(() => {
    const nums = Array.from({ length: count }, (_, i) => startNum + i)
    const existSet = new Set(existingNums)
    return { toCreate: nums.filter(n => !existSet.has(n)), toSkip: nums.filter(n => existSet.has(n)) }
  }, [startNum, count, existingNums])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (startNum < 1) { setError('Starting number must be at least 1.'); return }
    if (count < 1 || count > 50) { setError('Count must be between 1 and 50.'); return }
    if (capacity < 1) { setError('Capacity must be at least 1.'); return }
    if (preview.toCreate.length === 0) { setError('All table numbers in this range already exist.'); return }
    setLoading(true)
    try {
      const result = await batchCreateTables(startNum, count, capacity)
      onCreated(result.created)
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create tables.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="tm-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <form className="tm-modal" onSubmit={handleSubmit} noValidate>
        <div className="tm-modal-header">
          <div>
            <div className="tm-modal-title"><Plus className="w-4 h-4" />Add Tables</div>
            <p className="tm-modal-desc">Create one or multiple tables in a single operation.</p>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"><X className="w-4 h-4" /></button>
        </div>

        <div className="tm-modal-body space-y-4">
          <div>
            <label className="tm-field-label">Starting Table Number</label>
            <PaxStepper value={startNum} min={1} max={999} onChange={(v) => { setStartNum(v); setError('') }} />
          </div>
          <div>
            <label className="tm-field-label">Number of Tables</label>
            <PaxStepper value={count} min={1} max={50} onChange={(v) => { setCount(v); setError('') }} />
          </div>
          <div>
            <label className="tm-field-label">Capacity per Table</label>
            <PaxStepper value={capacity} min={1} max={99} onChange={(v) => { setCapacity(v); setError('') }} />
          </div>

          {/* Preview */}
          {count > 0 && (
            <div>
              <p className="tm-field-label mb-1.5">Preview</p>
              <div className="tm-preview-pills">
                {Array.from({ length: count }, (_, i) => startNum + i).map((n) => (
                  <span key={n} className={`tm-preview-pill ${new Set(existingNums).has(n) ? 'skip' : 'new'}`}>
                    {n}
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
                  {preview.toCreate.length} new table(s) will be created.
                </p>
              )}
            </div>
          )}

          {error && <p className="tm-error-text">{error}</p>}
        </div>

        <div className="tm-modal-footer">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors">Cancel</button>
          <Button type="submit" variant="primary" size="sm" loading={loading} disabled={preview.toCreate.length === 0}>
            Add {preview.toCreate.length > 0 ? preview.toCreate.length : ''} Table{preview.toCreate.length !== 1 ? 's' : ''}
          </Button>
        </div>
      </form>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TableCard
// ─────────────────────────────────────────────────────────────────────────────

interface TableCardProps {
  table: TableData
  mode: PageMode
  isQrSelectionMode: boolean
  isQrSelected: boolean
  isActive: boolean        // sidebar is showing this table (normal mode)
  summary?: OrderSummary
  onClick: () => void
  onQrClick: () => void
  mergeRole: 'core' | 'node' | 'removed-node' | null
  mergeLabelRole: 'core' | 'node' | 'removed-node' | null
  isMergeDisabled: boolean
}

const TableCard = memo(function TableCard({
  table, mode, isQrSelectionMode, isQrSelected, isActive, onClick, onQrClick, mergeRole, mergeLabelRole, isMergeDisabled,
}: TableCardProps) {
  const hasRequest = table.STATUS === 'HAS_REQUEST'
  const isUnavailable = table.STATUS === 'UNAVAILABLE'
  const displayGuestCount = table.CURRENT_GUEST_COUNT
  const displayCapacity = table.GUEST_CAPACITY
  const paxFull = displayGuestCount >= displayCapacity && displayCapacity > 0

  const cardClass = [
    'tm-table-card',
    mode === 'merge' && isMergeDisabled ? 'tm-merge-disabled' : '',
    mode === 'normal' && isActive ? 'is-active' : '',
    isQrSelectionMode && isQrSelected ? 'is-selected-qr' : '',
    mode === 'merge' && mergeRole === 'core' ? 'tm-merge-core' : '',
    mode === 'merge' && mergeRole === 'node' ? 'tm-merge-node' : '',
    mode === 'merge' && mergeRole === 'removed-node' ? 'tm-merge-removed-node-card' : '',
    mode !== 'merge' && isUnavailable ? 'is-unavailable' : '',
    mode !== 'merge' && hasRequest ? 'has-request' : '',
  ].filter(Boolean).join(' ')

  if (mode === 'merge' || mode === 'multi') {
    return (
      <div
        className={cardClass}
        onClick={mode === 'merge' && !isMergeDisabled ? onClick : undefined}
        role="button"
        aria-disabled={isMergeDisabled}
        tabIndex={isMergeDisabled ? -1 : 0}
        onKeyDown={(e) => { if (!isMergeDisabled && (e.key === 'Enter' || e.key === ' ')) onClick() }}
      >
        {mode === 'merge' && mergeLabelRole && (
          <span className={`tm-merge-role-label tm-merge-role-${mergeLabelRole}`}>
            {mergeLabelRole === 'core' ? 'Core' : mergeLabelRole === 'removed-node' ? 'Member node' : 'Node'}
          </span>
        )}
        <div className="tm-merge-table-number">{table.TABLE_NUM}</div>
        {mode === 'multi' && (
          <div className={`tm-pax-row ${paxFull ? 'tm-pax-full' : ''}`}>
            <Users className="w-3 h-3 shrink-0" />
            <span>{displayGuestCount}/{displayCapacity}</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      className={cardClass}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick() }}
      aria-pressed={isActive}
    >
      {/* Assistance ping */}
      {hasRequest && (
        <div className="tm-ping-dot">
          <span className="flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-rose-600" />
          </span>
        </div>
      )}

      <header className="tm-table-card-header">
        <div className={`tm-pax-row ${paxFull ? 'tm-pax-full' : ''}`}>
          <Users className="w-3 h-3 shrink-0" />
          <span>{displayGuestCount}/{displayCapacity}</span>
        </div>
        {isQrSelectionMode ? (
          <label className="tm-qr-checkbox" onClick={(e) => e.stopPropagation()} title={`Select Table ${table.TABLE_NUM} QR code`}>
            <input
              type="checkbox"
              checked={isQrSelected}
              onChange={onClick}
              aria-label={`Select Table ${table.TABLE_NUM} QR code`}
            />
            <span className={`tm-checkbox ${isQrSelected ? 'checked' : ''}`}>
              {isQrSelected && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
            </span>
          </label>
        ) : (
          <button type="button" className="tm-qr-btn" onClick={(e) => { e.stopPropagation(); onQrClick() }} title={`QR for Table ${table.TABLE_NUM}`}>
            <QrCode className="w-3 h-3" />
          </button>
        )}
      </header>

      <div className="tm-table-card-body">
        <div className="tm-table-num">{table.TABLE_NUM}</div>
      </div>

      <footer className="tm-table-card-footer">
        <span className={`tm-status-badge ${statusClass(table.STATUS)}`}>
          {statusLabel(table.STATUS)}
        </span>
      </footer>
    </div>
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// TableSidebar — persistent right panel
// ─────────────────────────────────────────────────────────────────────────────

interface SidebarDraft {
  capacity: number
  seatedPax: number
  // Reservation
  reservationName: string
  reservationPax: number
  reservationHours: number
  reservationMinutes: number
  reservationNotes: string
}

function tableToDraft(t: TableData): SidebarDraft {
  const capacity = t.GUEST_CAPACITY
  const seatedPax = t.CURRENT_GUEST_COUNT

  return {
    capacity,
    seatedPax,
    reservationName: t.RESERVATION_NAME ?? '',
    reservationPax: t.RESERVATION_PAX ?? capacity,
    reservationHours: 1,
    reservationMinutes: 0,
    reservationNotes: t.RESERVATION_NOTES ?? '',
  }
}

interface TableSidebarProps {
  mode: PageMode
  table: TableData | null        // currently-open single table
  allTables: TableData[]
  onClose: () => void
  onExitMultiMode: () => void
  onApplyTableSetup: (count: number, capacity: number) => Promise<void>
  onTableUpdated: (row: TableData) => void
  onTablesPatched: (rows: TableData[]) => void
  showToast: (t: string, type?: ToastMsg['type']) => void
  mergeCaptainId: number | null
  mergeMemberIds: Set<number>
  isEditingSavedMerge: boolean
  onSelectNewMergeCaptain: () => void
  onDeselectMergeMembers: () => void
}

function TableSidebar({
  mode, table, allTables,
  onClose, onExitMultiMode, onApplyTableSetup,
  onTableUpdated, onTablesPatched, showToast,
  mergeCaptainId, mergeMemberIds, isEditingSavedMerge, onSelectNewMergeCaptain, onDeselectMergeMembers,
}: TableSidebarProps) {

  // ── Draft state (reset when the selected table ID changes) ──
  const [draft, setDraft] = useState<SidebarDraft | null>(null)
  const [showReservationForm, setShowReservationForm] = useState(false)
  const [sidebarError, setSidebarError] = useState('')
  const [saving, setSaving] = useState(false)
  const [reserving, setReserving] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const pendingReservationRowsRef = useRef<TableData[] | null>(null)

  // Use a ref to track the previous table ID to know when to reset draft
  const prevTableIdRef = useRef<number | null>(null)

  useEffect(() => {
    if (table?.TABLE_ID !== prevTableIdRef.current) {
      prevTableIdRef.current = table?.TABLE_ID ?? null
      setDraft(table ? tableToDraft(table) : null)
      setShowReservationForm(false)
      setSidebarError('')
    }
  }, [table])

  // Check if draft differs from current table data (unsaved changes)
  const isDirty = useMemo(() => {
    if (!draft || !table) return false
    return (
      draft.capacity !== table.GUEST_CAPACITY ||
      draft.seatedPax !== table.CURRENT_GUEST_COUNT
    )
  }, [draft, table])

  // ── Save changes ──
  async function handleSave() {
    if (!table || !draft) return
    setSidebarError(''); setSaving(true)
    try {
      if (draft.seatedPax > draft.capacity) throw new Error(`Seated pax cannot exceed capacity (${draft.capacity}).`)

      const updatedRows = await updateTable(table.TABLE_ID, {
        capacity: draft.capacity !== table.GUEST_CAPACITY ? draft.capacity : undefined,
        seatedPax: draft.seatedPax !== table.CURRENT_GUEST_COUNT ? draft.seatedPax : undefined,
      })

      onTablesPatched(updatedRows)
      const updated = updatedRows.find(r => r.TABLE_ID === table.TABLE_ID) ?? updatedRows[0]
      if (updated) {
        onTableUpdated(updated)
      }
      showToast(`Table ${table.TABLE_NUM} saved.`, 'success')
    } catch (err: unknown) {
      setSidebarError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  // ── Reservation and status ──
  function getMergeGroupRows() {
    if (!table) return []
    const anchorId = table.MERGE_GROUP_ID ?? table.TABLE_ID
    return allTables.filter((candidate) =>
      candidate.TABLE_ID === anchorId || candidate.MERGE_GROUP_ID === anchorId,
    )
  }

  async function handleStatusToggle(status: TableStatus) {
    if (!table || table.STATUS === status) return
    setSidebarError('')

    const affectedRows = getMergeGroupRows()
    const optimisticRows = affectedRows.map((row) => ({ ...row, STATUS: status }))
    if (status === 'RESERVED') {
      pendingReservationRowsRef.current = affectedRows
    }
    onTablesPatched(optimisticRows)

    if (status === 'RESERVED') {
      setShowReservationForm(true)
      return
    }

    setShowReservationForm(false)
    try {
      const updatedRows = await setTableStatus(table.TABLE_ID, status)
      onTablesPatched(updatedRows)
      showToast('Saved', 'success')
    } catch (err: unknown) {
      onTablesPatched(affectedRows)
      setSidebarError((err as Error).message)
    }
  }

  async function handleMarkOccupied() {
    await handleStatusToggle('OCCUPIED')
  }

  async function handleReserve() {
    if (!table || !draft) return
    setSidebarError(''); setReserving(true)
    try {
      if (!draft.reservationName.trim()) throw new Error('Guest name is required.')
      const timeLimit = `${String(draft.reservationHours).padStart(2, '0')}:${String(draft.reservationMinutes).padStart(2, '0')}:00`
      const resData: ReservationData = {
        name: draft.reservationName,
        pax: draft.reservationPax,
        timeLimit,
        notes: draft.reservationNotes || undefined,
      }
      const updatedRows = await reserveTable(table.TABLE_ID, resData)
      onTablesPatched(updatedRows)
      setShowReservationForm(false)
      showToast('Saved', 'success')
    } catch (err: unknown) {
      setSidebarError((err as Error).message)
    } finally {
      setReserving(false)
    }
  }

  function handleCancelReservationForm() {
    const pendingRows = pendingReservationRowsRef.current
    if (pendingRows) {
      onTablesPatched(pendingRows)
      pendingReservationRowsRef.current = null
    }
    setShowReservationForm(false)
  }

  async function handleCancelReservation() {
    if (!table) return
    setCancelling(true)
    try {
      const updatedRows = await cancelReservation(table.TABLE_ID)
      onTablesPatched(updatedRows)
      setShowReservationForm(false)
      showToast('Saved', 'success')
    } catch (err: unknown) {
      setSidebarError((err as Error).message)
    } finally {
      setCancelling(false)
    }
  }

  // ── Bulk edit state ──
  const [bulkCount, setBulkCount] = useState(allTables.length)
  useEffect(() => setBulkCount(allTables.length), [allTables.length])
  const [bulkCapacity, setBulkCapacity] = useState(() => allTables[0]?.GUEST_CAPACITY ?? 4)
  const [bulkError, setBulkError] = useState('')
  const [bulkSaving, setBulkSaving] = useState(false)

  async function handleBulkApply() {
    setBulkError(''); setBulkSaving(true)
    try {
      if (bulkCount !== allTables.length) {
        await onApplyTableSetup(bulkCount, bulkCapacity)
      } else {
        const result = await bulkEditTables(allTables.map((candidate) => candidate.TABLE_ID), { capacity: bulkCapacity })
        if (result.updated.length > 0) onTablesPatched(result.updated)
        if (result.blocked.length > 0) showToast(`${result.blocked.length} table(s) could not be updated.`, 'error')
        showToast('Table capacity updated.', 'success')
      }
    } catch (err: unknown) {
      setBulkError((err as Error).message)
    } finally {
      setBulkSaving(false)
    }
  }

  // ─── RENDER ───────────────────────────────────────────────────────────────

  if (mode === 'merge') {
    const captain = allTables.find((candidate) => candidate.TABLE_ID === mergeCaptainId) ?? null
    const members = allTables.filter((candidate) => mergeMemberIds.has(candidate.TABLE_ID))
    const removedMembers = isEditingSavedMerge
      ? allTables.filter((candidate) => candidate.MERGE_GROUP_ID === mergeCaptainId && !mergeMemberIds.has(candidate.TABLE_ID))
      : []
    const displayedMembers = [...members, ...removedMembers].sort((a, b) => a.TABLE_NUM - b.TABLE_NUM)

    return (
      <aside className="tm-sidebar">
        <div className="tm-sidebar-header">
          <div>
            <div className="tm-sidebar-title"><GitMerge className="w-4 h-4" />Merge Tables</div>
            <div className="tm-sidebar-subtitle">Core and Node selection</div>
          </div>
        </div>

        <div className="tm-sidebar-body">
          {!captain ? (
            <div className="tm-sidebar-empty">
              <div className="tm-sidebar-empty-icon"><GitMerge className="w-6 h-6" /></div>
              <div>
                <p className="text-sm font-bold text-[#14274E]">Select a Core first</p>
                <p className="text-xs text-slate-400 mt-0.5">Choose a table from the grid to use as the Core.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="tm-sidebar-section">
                <span className="tm-sidebar-section-title">Current Core</span>
                <div className="tm-merge-sidebar-core">Table {captain.TABLE_NUM}</div>
              </div>

              <div className="tm-divider" />

              <div className="tm-sidebar-section">
                <span className="tm-sidebar-section-title">Nodes</span>
                {displayedMembers.length === 0 ? (
                  <p className="text-xs text-slate-400">Select at least one Node from the grid.</p>
                ) : (
                  <div className="tm-selected-list">
                    {displayedMembers.map((member) => {
                      const isRemoved = removedMembers.some((removed) => removed.TABLE_ID === member.TABLE_ID)
                      return (
                        <div key={member.TABLE_ID} className={`tm-selected-list-item tm-merge-node-list-item${isRemoved ? ' tm-merge-removed-node' : ''}`}>
                          <span className="font-bold text-[#14274E]">Table {member.TABLE_NUM}</span>
                          <span className="text-xs">{isRemoved ? 'Member node' : 'Node'}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="tm-sidebar-footer">
          <button className="tm-sidebar-btn secondary" onClick={onSelectNewMergeCaptain} disabled={!captain}>
            <RefreshCw className="w-3.5 h-3.5" /> Change Core
          </button>
          <button className="tm-sidebar-btn ghost" onClick={onDeselectMergeMembers} disabled={!captain || members.length === 0}>
            <X className="w-3.5 h-3.5" /> Deselect Nodes
          </button>
        </div>
      </aside>
    )
  }

  // EDIT mode: manage the total number of tables and shared capacity
  if (mode === 'multi') {
    return (
      <aside className="tm-sidebar">
        <div className="tm-sidebar-body tm-edit-tables-sidebar">
          <div className="tm-sidebar-section">
            <span className="tm-sidebar-section-title">Edit Tables</span>
            <p className="text-xs text-slate-400">Set the total number of tables and the maximum capacity for every table.</p>
          </div>
          <div className="tm-divider" />
          <div className="tm-sidebar-section">
            <label className="tm-field-label">Number of Tables</label>
            <PaxStepper value={bulkCount} min={0} max={999} onChange={setBulkCount} />
          </div>
          <div className="tm-sidebar-section">
            <label className="tm-field-label">Maximum Capacity</label>
            <PaxStepper value={bulkCapacity} min={1} max={99} onChange={setBulkCapacity} />
          </div>
          {bulkError && <p className="tm-error-text">{bulkError}</p>}
          <button className="tm-sidebar-btn primary" onClick={() => void handleBulkApply()} disabled={bulkSaving}>
            {bulkSaving ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <CheckCheck className="w-3.5 h-3.5" />}
            Save Table Settings
          </button>
        </div>
        <div className="tm-sidebar-footer">
          <button className="tm-sidebar-btn ghost" onClick={onExitMultiMode}>
            <X className="w-3.5 h-3.5" /> Exit Edit Tables
          </button>
        </div>
      </aside>
    )
  }

  // NORMAL mode — no table selected
  if (!table || !draft) {
    return (
      <aside className="tm-sidebar">
        <div className="tm-sidebar-header">
          <div className="tm-sidebar-title"><TableProperties className="w-4 h-4" />Table Details</div>
        </div>
        <div className="tm-sidebar-body">
          <div className="tm-sidebar-empty">
            <div className="tm-sidebar-empty-icon"><LayoutGrid className="w-6 h-6" /></div>
            <div>
              <p className="text-sm font-bold text-[#14274E]">Select a table</p>
              <p className="text-xs text-slate-400 mt-0.5">Click any table to view and edit its details.</p>
            </div>
          </div>
        </div>
      </aside>
    )
  }

  // NORMAL mode — single table selected
  const isOccupied = OCCUPIED_STATUSES.includes(table.STATUS)
  const isReserved = table.STATUS === 'RESERVED' || showReservationForm

  return (
    <aside className="tm-sidebar">
      <div className="tm-sidebar-header">
        <div>
          <div className="tm-sidebar-title">
            Table {table.TABLE_NUM}
            {isDirty && <span className="tm-dirty-dot" title="Unsaved changes" />}
          </div>
          <div className="tm-sidebar-subtitle">
            <span className={`tm-status-badge ${statusClass(table.STATUS)}`}>{statusLabel(table.STATUS)}</span>
          </div>
        </div>
        <button className="tm-sidebar-close" onClick={onClose}><X className="w-4 h-4" /></button>
      </div>

      {/* Scrollable body — key resets form when table changes */}
      <div className="tm-sidebar-body" key={table.TABLE_ID}>

        {/* ── Table Info ── */}
        <div className="tm-sidebar-section">
          <span className="tm-sidebar-section-title">Table Info</span>
          <div>
            <label className="tm-field-label">Maximum Pax (Capacity)</label>
            <PaxStepper
              value={draft.capacity} min={Math.max(1, draft.seatedPax)} max={99}
              onChange={v => setDraft(d => d ? { ...d, capacity: v } : d)}
            />
          </div>
          {table.STATUS !== 'UNAVAILABLE' && (
            <div>
              <label className="tm-field-label">
                Seated Pax
                {draft.seatedPax >= draft.capacity && <span className="ml-1 text-amber-600 normal-case"> (Full)</span>}
              </label>
              <PaxStepper
                value={draft.seatedPax} min={0} max={draft.capacity}
                onChange={v => setDraft(d => d ? { ...d, seatedPax: v } : d)}
              />
              <button
                className="tm-sidebar-btn primary mt-2"
                onClick={() => void handleSave()}
                disabled={saving || !isDirty}
              >
                {saving ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <Check className="w-3.5 h-3.5" />}
                Save Changes
              </button>
            </div>
          )}
        </div>

        {/* ── Status ── */}
        <div className="tm-divider" />
        <div className="tm-sidebar-section">
          <span className="tm-sidebar-section-title">Table Status</span>
          <div className="tm-status-toggle" role="group" aria-label="Table status">
            <button
              className={table.STATUS === 'AVAILABLE' && !showReservationForm ? 'is-active' : ''}
              onClick={() => void handleStatusToggle('AVAILABLE')}
            >Available</button>
            <button
              className={isReserved ? 'is-active' : ''}
              onClick={() => setShowReservationForm(true)}
              disabled={isOccupied}
            >Reserved</button>
            <button
              className={isOccupied ? 'is-active' : ''}
              onClick={() => void handleMarkOccupied()}
            >Occupied</button>
          </div>
        </div>

        {/* ── Reservation ── */}
        {(isReserved || showReservationForm) && (
          <>
            <div className="tm-divider" />
            <div className="tm-sidebar-section">
              <span className="tm-sidebar-section-title">Reservation</span>

              {table.STATUS === 'RESERVED' && !showReservationForm ? (
                /* Existing reservation details */
                <div className="tm-reservation-section">
                  <div className="tm-info-row"><span>Guest</span><strong>{table.RESERVATION_NAME}</strong></div>
                  {table.RESERVATION_PAX && <div className="tm-info-row"><span>Pax</span><strong>{table.RESERVATION_PAX}</strong></div>}

                  {table.RESERVATION_NOTES && (
                    <p className="text-[0.7rem] text-slate-500 mt-0.5">{table.RESERVATION_NOTES}</p>
                  )}
                  <button className="tm-sidebar-btn danger" onClick={() => void handleCancelReservation()} disabled={cancelling}>
                    {cancelling
                      ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      : <X className="w-3.5 h-3.5" />}
                    Cancel Reservation
                  </button>
                </div>
              ) : showReservationForm ? (
                /* New reservation form */
                <div className="tm-reservation-section">
                  <div>
                    <label className="tm-field-label">Guest Name *</label>
                    <input type="text" className="tm-input" placeholder="e.g. Juan Dela Cruz"
                      value={draft.reservationName}
                      onChange={e => setDraft(d => d ? { ...d, reservationName: e.target.value } : d)} />
                  </div>
                  <div>
                    <label className="tm-field-label">Reservation Pax</label>
                    <PaxStepper value={draft.reservationPax} min={1} max={draft.capacity}
                      onChange={v => setDraft(d => d ? { ...d, reservationPax: v } : d)} />
                    <p className="text-[0.68rem] text-slate-400 mt-0.5">Max {draft.capacity} pax for this table.</p>
                  </div>
                  <div>
                    <label className="tm-field-label">Reservation Limit</label>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <input type="number" min={0} className="tm-input" value={draft.reservationHours}
                          onChange={e => setDraft(d => d ? { ...d, reservationHours: Math.max(0, Number(e.target.value)) } : d)} />
                        <span className="text-[0.68rem] text-slate-400">Hours</span>
                      </div>
                      <div className="flex-1">
                        <input type="number" min={0} max={59} className="tm-input" value={draft.reservationMinutes}
                          onChange={e => setDraft(d => d ? { ...d, reservationMinutes: Math.max(0, Math.min(59, Number(e.target.value))) } : d)} />
                        <span className="text-[0.68rem] text-slate-400">Minutes</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="tm-field-label">Notes (optional)</label>
                    <textarea className="tm-textarea" placeholder="Birthday dinner, requires highchair…"
                      value={draft.reservationNotes}
                      onChange={e => setDraft(d => d ? { ...d, reservationNotes: e.target.value } : d)} />
                  </div>
                  <div className="flex gap-2">
                    <button className="tm-sidebar-btn ghost flex-1" onClick={handleCancelReservationForm}>Cancel</button>
                    <button className="tm-sidebar-btn accent flex-1" onClick={() => void handleReserve()} disabled={reserving}>
                      {reserving
                        ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        : <BookMarked className="w-3.5 h-3.5" />}
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <button className="tm-sidebar-btn secondary" onClick={() => setShowReservationForm(true)}>
                    <BookMarked className="w-3.5 h-3.5" /> Reserve Table
                  </button>
                  <button className="tm-sidebar-btn primary" onClick={() => void handleMarkOccupied()}>
                    <Users className="w-3.5 h-3.5" /> Mark as Occupied
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {sidebarError && <p className="tm-error-text">{sidebarError}</p>}
      </div>

      <div className="tm-sidebar-footer" />
    </aside>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export default function TableManagerPage() {
  // ── Core data ──
  const [tables, setTables] = useState<TableData[]>(() => getCachedTables() ?? [])
  const [billRequests, setBillRequests] = useState<BillRequest[]>([])
  const [orderSummaries, setOrderSummaries] = useState<Map<number, OrderSummary>>(new Map())

  // ── Selection / mode ──
  const [mode, setMode] = useState<PageMode>('normal')
  const [sidebarTableId, setSidebarTableId] = useState<number | null>(null)
  const [mergeCaptainId, setMergeCaptainId] = useState<number | null>(null)
  const [mergeMemberIds, setMergeMemberIds] = useState<Set<number>>(new Set())
  const [isEditingSavedMerge, setIsEditingSavedMerge] = useState(false)
  const [isSavingMerge, setIsSavingMerge] = useState(false)
  const [isQrSelectionMode, setIsQrSelectionMode] = useState(false)
  const [qrSelectedIds, setQrSelectedIds] = useState<Set<number>>(new Set())

  // ── Modals ──
  const [showAddModal, setShowAddModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [qrModalTable, setQrModalTable] = useState<TableData | null>(null)

  // ── Delete state ──
  const [deleteLoading, setDeleteLoading] = useState(false)

  // ── QR state ──
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)
  const [isPrinting, setIsPrinting] = useState(false)

  // ── Toast ──
  const [toast, setToast] = useState<ToastMsg | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Mutation guard (prevents polling from firing during a write) ──
  const isMutatingRef = useRef(false)

  const sidebarTableIdRef = useRef(sidebarTableId)
  useEffect(() => {
    sidebarTableIdRef.current = sidebarTableId
  }, [sidebarTableId])

  function showToast(text: string, type: ToastMsg['type'] = 'success') {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast({ text, type })
    toastTimerRef.current = setTimeout(() => setToast(null), 3000)
  }

  // ── Derived state ──
  const sidebarTable = useMemo(
    () => (sidebarTableId !== null ? tables.find((t) => t.TABLE_ID === sidebarTableId) ?? null : null),
    [tables, sidebarTableId],
  )

  const existingTableNums = useMemo(() => tables.map((t) => t.TABLE_NUM), [tables])

  // ── Load order summaries (targeted — only for occupied tables) ──
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
      const [data, bReqs] = await Promise.all([
        fetchAllTables(),
        fetchAllBillRequests(),
      ])
      setBillRequests(bReqs)
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
      // Load summaries ONCE here — not via a tables-dependency effect
      await loadSummariesForTables(data)
    } catch (err) {
      console.error('[TableManager] Load error:', err)
    }
  }, [loadSummariesForTables])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  // ── Background polling (5s, guarded against mutation in-flight) ──
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isMutatingRef.current && document.visibilityState === 'visible') void loadAll()
    }, 5000)

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && !isMutatingRef.current) void loadAll()
    }
    document.addEventListener('visibilitychange', handleVisibility)

    // ── Realtime subscription (targeted updates only) ──
    const channel = supabase
      .channel('tm-phase2-tables')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Restaurant_Tables' }, async (payload) => {
        if (payload.eventType === 'UPDATE') {
          const updated = payload.new as TableData
          setTables((prev) => {
            const next = prev.map((t) => t.TABLE_ID === updated.TABLE_ID ? updated : t)
            cacheTables(next)
            return next
          })
          // Targeted summary refresh only if occupancy status changed
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
        } else if (payload.eventType === 'DELETE') {
          const deletedId = (payload.old as { TABLE_ID: number }).TABLE_ID
          setTables((prev) => {
            const next = prev.filter((t) => t.TABLE_ID !== deletedId)
            cacheTables(next)
            return next
          })
          setQrSelectedIds((prev) => { const next = new Set(prev); next.delete(deletedId); return next })
          if (sidebarTableIdRef.current === deletedId) setSidebarTableId(null)
        }
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'Bill_Requests' },
        () => {
          void fetchAllBillRequests().then(setBillRequests)
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
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibility)
      void supabase.removeChannel(channel)
    }
  }, [loadAll])

  // ── Card click ──
  function handleCardClick(table: TableData) {
    if (mode === 'merge') {
      if (mergeCaptainId === null) {
        const existingCoreId = table.IS_MERGE_CAPTAIN ? table.TABLE_ID : table.MERGE_GROUP_ID
        setMergeCaptainId(existingCoreId ?? table.TABLE_ID)
        setIsEditingSavedMerge(existingCoreId !== null)
        setMergeMemberIds(
          existingCoreId
            ? new Set(tables.filter((candidate) => candidate.MERGE_GROUP_ID === existingCoreId).map((candidate) => candidate.TABLE_ID))
            : new Set(),
        )
      } else if (table.TABLE_ID === mergeCaptainId) {
        setMergeCaptainId(null)
        setMergeMemberIds(new Set())
        setIsEditingSavedMerge(false)
      } else if (table.IS_MERGE_CAPTAIN) {
        const existingCoreId = table.TABLE_ID
        setMergeCaptainId(existingCoreId)
        setIsEditingSavedMerge(true)
        setMergeMemberIds(
          new Set(tables.filter((candidate) => candidate.MERGE_GROUP_ID === existingCoreId).map((candidate) => candidate.TABLE_ID)),
        )
      } else {
        setMergeMemberIds((prev) => {
          const next = new Set(prev)
          if (next.has(table.TABLE_ID)) next.delete(table.TABLE_ID)
          else next.add(table.TABLE_ID)
          return next
        })
      }
      return
    }

    if (isQrSelectionMode) {
      setQrSelectedIds((prev) => {
        const next = new Set(prev)
        if (next.has(table.TABLE_ID)) next.delete(table.TABLE_ID)
        else next.add(table.TABLE_ID)
        return next
      })
      return
    }

    setSidebarTableId(table.TABLE_ID)
  }

  async function enterMultiMode() {
    const freshTables = await fetchAllTables()
    setTables(freshTables)
    cacheTables(freshTables)
    setMode('multi')
    setSidebarTableId(null)
  }

  function exitMultiMode() {
    setMode('normal')
  }

  async function applyTableSetup(count: number, capacity: number) {
    if (count < 0 || count > 999) throw new Error('Number of tables must be between 0 and 999.')
    if (capacity < 1) throw new Error('Maximum capacity must be at least 1.')

    let currentTables = await fetchAllTables()
    const existingNumbers = new Set(currentTables.map((table) => table.TABLE_NUM))
    const missingNumbers = Array.from({ length: count }, (_, index) => index + 1)
      .filter((tableNumber) => !existingNumbers.has(tableNumber))

    if (missingNumbers.length > 0) {
      const result = await batchCreateTables(missingNumbers[0], missingNumbers.length, capacity)
      if (result.created.length > 0) showToast(`${result.created.length} table(s) added.`, 'success')
    }

    currentTables = await fetchAllTables()
    const tablesToDelete = currentTables.filter((table) => table.TABLE_NUM > count)
    if (tablesToDelete.length > 0) {
      const result = await deleteTables(tablesToDelete.map((table) => table.TABLE_ID))
      if (result.deleted.length > 0) {
        setOrderSummaries((prev) => {
          const next = new Map(prev)
          result.deleted.forEach((id) => next.delete(id))
          return next
        })
        showToast(`${result.deleted.length} table(s) removed.`, 'success')
      }
      if (result.blocked.length > 0) {
        throw new Error(`${result.blocked.length} table(s) could not be removed because they have active data.`)
      }
    }

    const resultingTables = (await fetchAllTables()).sort((a, b) => a.TABLE_NUM - b.TABLE_NUM)
    const result = await bulkEditTables(resultingTables.map((table) => table.TABLE_ID), { capacity })
    const finalTables = patchTables(resultingTables, result.updated)
    setTables(finalTables)
    cacheTables(finalTables)
    if (result.blocked.length > 0) showToast(`${result.blocked.length} table(s) could not be updated.`, 'error')
    showToast('Table settings updated.', 'success')
  }

  function enterMergeMode() {
    setMode('merge')
    setSidebarTableId(null)
    setIsQrSelectionMode(false)
    setQrSelectedIds(new Set())
    setMergeCaptainId(null)
    setMergeMemberIds(new Set())
    setIsEditingSavedMerge(false)
  }

  function exitMergeMode() {
    setMode('normal')
    setMergeCaptainId(null)
    setMergeMemberIds(new Set())
    setIsEditingSavedMerge(false)
  }

  function selectNewMergeCaptain() {
    setMergeCaptainId(null)
    setMergeMemberIds(new Set())
    setIsEditingSavedMerge(false)
  }

  function deselectMergeMembers() {
    setMergeMemberIds(new Set())
  }

  async function deleteMergeGroup() {
    if (mergeCaptainId === null) return

    setIsSavingMerge(true)
    isMutatingRef.current = true
    try {
      const updated = await saveTableMerge(mergeCaptainId, [])
      const patchedTables = patchTables(tables, updated)
      setTables(patchedTables)
      cacheTables(patchedTables)
      showToast('Merge group deleted.', 'success')
      exitMergeMode()
    } catch (err: unknown) {
      showToast((err as Error).message, 'error')
    } finally {
      setIsSavingMerge(false)
      isMutatingRef.current = false
    }
  }

  async function completeMerge() {
    if (mergeCaptainId === null || (!isEditingSavedMerge && mergeMemberIds.size === 0)) {
      showToast('Select one Core and at least one Node.', 'error')
      return
    }

    setIsSavingMerge(true)
    isMutatingRef.current = true
    try {
      const updated = await saveTableMerge(mergeCaptainId, [...mergeMemberIds])
      const patchedTables = patchTables(tables, updated)
      setTables(patchedTables)
      cacheTables(patchedTables)
      showToast('Merge saved.', 'success')
    } catch (err: unknown) {
      showToast((err as Error).message, 'error')
    } finally {
      setIsSavingMerge(false)
      isMutatingRef.current = false
    }
  }

  // ── Delete ──
  async function handleDelete() {
    const ids = sidebarTableId ? [sidebarTableId] : []
    if (ids.length === 0) return
    setDeleteLoading(true); isMutatingRef.current = true
    try {
      const result = await deleteTables(ids)
      if (result.deleted.length > 0) {
        setTables((prev) => prev.filter((t) => !result.deleted.includes(t.TABLE_ID)))
        setOrderSummaries((prev) => { const next = new Map(prev); result.deleted.forEach(id => next.delete(id)); return next })
        if (sidebarTableId && result.deleted.includes(sidebarTableId)) setSidebarTableId(null)
        showToast(`${result.deleted.length} table(s) deleted.`, 'success')
      }
      if (result.blocked.length > 0) {
        showToast(`${result.blocked.length} table(s) could not be deleted.`, 'error')
      }
      setShowDeleteConfirm(false)
    } catch (err: unknown) {
      showToast((err as Error).message, 'error')
    } finally {
      setDeleteLoading(false); isMutatingRef.current = false
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

  // ── QR ──
  const selectedQrTables = tables.filter((table) => qrSelectedIds.has(table.TABLE_ID))

  async function handleDownloadPdf() {
    if (selectedQrTables.length === 0) {
      showToast('Select at least one table.', 'error')
      return
    }
    setIsGeneratingPdf(true)
    try { await downloadBulkQrPdf(selectedQrTables) }
    catch { showToast('Failed to generate PDF.', 'error') }
    finally { setIsGeneratingPdf(false) }
  }

  async function handlePrint() {
    if (selectedQrTables.length === 0) {
      showToast('Select at least one table.', 'error')
      return
    }
    setIsPrinting(true)
    try { await printBulkQrPdf(selectedQrTables) }
    catch { showToast('Failed to print.', 'error') }
    finally { setIsPrinting(false) }
  }

  function toggleQrSelectionMode() {
    setIsQrSelectionMode((active) => {
      if (active) {
        setQrSelectedIds(new Set())
      } else {
        setQrSelectedIds(new Set(tables.map((table) => table.TABLE_ID)))
      }
      return !active
    })
  }

  function toggleAllQrTables() {
    setQrSelectedIds((prev) =>
      prev.size === tables.length
        ? new Set()
        : new Set(tables.map((table) => table.TABLE_ID)),
    )
  }

  // ── Delete target IDs for confirm dialog ──
  const deleteTargetIds = sidebarTableId ? [sidebarTableId] : []
  const deleteTargetTables = tables.filter(t => deleteTargetIds.includes(t.TABLE_ID))

  // ─── RENDER ──────────────────────────────────────────────────────────────

  return (
    <div className="table-manager-page-container staff-page">
      {/* Toast */}
      {toast && (
        <div className={`tm-toast tm-toast-${toast.type}`}>
          {toast.type === 'success' && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
          {toast.type === 'error' && <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
          {toast.text}
        </div>
      )}

      <div className="tm-layout">
        <div className="inner-table-manager-container">
          <header className="tm-inner-header">
            <div className="tm-inner-actions">
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={mode === 'multi' ? exitMultiMode : enterMultiMode}
                  disabled={mode === 'merge'}
                  className={`tm-edit-tables-btn flex items-center gap-1.5 ${mode === 'multi' ? 'is-active' : ''}`}
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  {mode === 'multi' ? 'Exit Edit Tables' : 'Edit Tables'}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={mode === 'merge' ? exitMergeMode : enterMergeMode}
                  className={`tm-merge-header-btn flex items-center gap-1.5 ${mode === 'merge' ? 'is-active' : ''}`}
                >
                  <GitMerge className="w-3.5 h-3.5" />
                  {mode === 'merge' ? 'Exit Merge' : 'Merge'}
                </Button>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={toggleQrSelectionMode}
                disabled={tables.length === 0 || mode === 'merge'}
                className={`tm-qr-mode-btn ml-auto flex items-center gap-1.5 ${isQrSelectionMode ? 'is-enabled' : ''}`}
              >
                <Printer className="w-3.5 h-3.5" />
                {isQrSelectionMode ? 'Exit QR Selection' : 'Print QR Codes'}
              </Button>
            </div>
            <TableAlertsBanner
              tables={tables}
              billRequests={billRequests}
              onClearAssistance={handleClearAssistance}
              onClearBillOut={handleClearBillOut}
            />
          </header>

          <div className="tm-inner-body">


            {tables.length === 0 ? (
              <div className="tm-empty">
                <div className="tm-empty-icon"><TableProperties className="w-7 h-7" /></div>
                <div>
                  <p className="text-sm font-bold text-[#14274E]">No tables yet</p>
                  <p className="text-xs text-slate-400 mt-0.5">Add your first table to get started.</p>
                </div>
                <Button variant="primary" size="sm" onClick={() => setShowAddModal(true)}>
                  <Plus className="w-3.5 h-3.5" /> Add Tables
                </Button>
              </div>
            ) : (
              <div className="tm-floor-grid">
                {tables.map((table) => {
                  const belongsToSelectedGroup = mergeCaptainId !== null && (
                    table.TABLE_ID === mergeCaptainId || table.MERGE_GROUP_ID === mergeCaptainId
                  )
                  const isMergeDisabled = mode === 'merge' && mergeCaptainId !== null && !belongsToSelectedGroup && table.IS_MERGE_MEMBER
                  const isRemovedSavedNode = isEditingSavedMerge &&
                    table.MERGE_GROUP_ID === mergeCaptainId &&
                    !mergeMemberIds.has(table.TABLE_ID)
                  const mergeRole = mergeCaptainId === table.TABLE_ID
                    ? 'core'
                    : mergeMemberIds.has(table.TABLE_ID)
                      ? 'node'
                      : isRemovedSavedNode
                        ? 'removed-node'
                        : null
                  const mergeLabelRole = mode === 'merge' && mergeRole === null
                    ? table.IS_MERGE_CAPTAIN
                      ? 'core'
                      : table.IS_MERGE_MEMBER
                        ? 'node'
                        : null
                    : null

                  return (
                  <TableCard
                    key={table.TABLE_ID}
                    table={table}
                    mode={mode}
                    isQrSelectionMode={isQrSelectionMode}
                    isQrSelected={qrSelectedIds.has(table.TABLE_ID)}
                    mergeRole={mergeRole}
                    mergeLabelRole={mergeLabelRole}
                    isActive={sidebarTableId === table.TABLE_ID}
                    summary={orderSummaries.get(table.TABLE_ID)}
                    onClick={() => handleCardClick(table)}
                    onQrClick={() => setQrModalTable(table)}
                    isMergeDisabled={isMergeDisabled}
                  />
                )
                })}
              </div>
            )}
          </div>

          {mode === 'merge' ? (
            <footer className="tm-inner-footer tm-merge-footer">
              <Button
                size="sm"
                variant="secondary"
                onClick={selectNewMergeCaptain}
                disabled={mergeCaptainId === null}
                className="flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Select New Core
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={deselectMergeMembers}
                disabled={mergeCaptainId === null || mergeMemberIds.size === 0}
                className="flex items-center gap-1.5"
              >
                <X className="w-3.5 h-3.5" />
                Deselect All Nodes
              </Button>
              {isEditingSavedMerge && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void deleteMergeGroup()}
                  disabled={isSavingMerge || mergeCaptainId === null}
                  className="tm-merge-delete-btn flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Merge Group
                </Button>
              )}
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void completeMerge()}
                disabled={isSavingMerge || mergeCaptainId === null || (!isEditingSavedMerge && mergeMemberIds.size === 0)}
                className="tm-merge-complete-btn flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                {isSavingMerge ? 'Saving…' : 'Complete Merge'}
              </Button>
            </footer>
          ) : isQrSelectionMode && (
            <footer className="tm-inner-footer">
              <Button
                size="sm"
                variant="secondary"
                onClick={toggleAllQrTables}
                disabled={tables.length === 0}
                className={`tm-qr-select-all-btn flex items-center gap-1.5 ${qrSelectedIds.size === tables.length ? 'is-selected' : ''}`}
              >
                <CheckCheck className="w-3.5 h-3.5" />
                {qrSelectedIds.size === tables.length ? 'Deselect All' : 'Select All'}
              </Button>
              <div className="tm-inner-footer-pdf-actions">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void handleDownloadPdf()}
                  disabled={isGeneratingPdf || selectedQrTables.length === 0}
                  className="flex items-center gap-1.5"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  {isGeneratingPdf ? 'Generating…' : 'Download PDF'}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void handlePrint()}
                  disabled={isPrinting || selectedQrTables.length === 0}
                  className="flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  {isPrinting ? 'Preparing…' : 'Print PDF'}
                </Button>
              </div>
            </footer>
          )}
        </div>

        <aside className="table-manager-sidebar">
          <div className="tm-sidebar-shell-header">Table Manager</div>
          <div className="tm-sidebar-shell-body">
            <TableSidebar
              mode={mode}
              table={sidebarTable}
              allTables={tables}
              onClose={() => setSidebarTableId(null)}
              onExitMultiMode={exitMultiMode}
              onApplyTableSetup={applyTableSetup}
              onTableUpdated={(row) => {
                setTables((prev) => prev.map((t) => t.TABLE_ID === row.TABLE_ID ? row : t))
                if (OCCUPIED_STATUSES.includes(row.STATUS)) {
                  void fetchOrderSummariesForIds([row.TABLE_ID]).then(s => {
                    setOrderSummaries(prev => new Map([...prev, ...s]))
                  })
                }
              }}
              onTablesPatched={(rows) => setTables((prev) => patchTables(prev, rows))}
              showToast={showToast}
              mergeCaptainId={mergeCaptainId}
              mergeMemberIds={mergeMemberIds}
              isEditingSavedMerge={isEditingSavedMerge}
              onSelectNewMergeCaptain={selectNewMergeCaptain}
              onDeselectMergeMembers={deselectMergeMembers}
            />
          </div>
        </aside>
      </div>

      {/* ── Modals ── */}
      {showAddModal && (
        <AddTablesModal
          onClose={() => setShowAddModal(false)}
          existingNums={existingTableNums}
          onCreated={(newTables) => {
            setTables((prev) => [...prev, ...newTables].sort((a, b) => a.TABLE_NUM - b.TABLE_NUM))
            showToast(`${newTables.length} table(s) added.`, 'success')
          }}
        />
      )}

      {showDeleteConfirm && (
        <ConfirmDialog
          title="Delete Tables?"
          description="Tables with active orders cannot be deleted."
          confirmLabel={`Delete ${deleteTargetIds.length} Table${deleteTargetIds.length !== 1 ? 's' : ''}`}
          confirmVariant="danger"
          loading={deleteLoading}
          onConfirm={() => void handleDelete()}
          onCancel={() => setShowDeleteConfirm(false)}
        >
          <div className="space-y-1">
            {deleteTargetTables.map((t) => {
              const summary = orderSummaries.get(t.TABLE_ID)
              const blocked = (summary?.activeOrderCount ?? 0) > 0
              return (
                <div key={t.TABLE_ID} className={`tm-selected-list-item ${blocked ? 'bg-rose-50' : ''}`}>
                  <span className="font-bold text-[#14274E]">Table {t.TABLE_NUM}</span>
                  {blocked
                    ? <span className="text-rose-600 text-xs font-semibold">Blocked</span>
                    : <span className="text-emerald-600 text-xs font-semibold">Will delete</span>}
                </div>
              )
            })}
          </div>
        </ConfirmDialog>
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
