/**
 * TableManager — Phase 2
 *
 * Architecture:
 * - mode: 'normal' | 'multi'
 *   · normal: clicking a card opens the right sidebar for that table
 *   · multi: clicking cards toggles checkbox selection; sidebar shows bulk panel
 * - Refresh loop fix: realtime events do targeted setTables patches (no full reload).
 *   loadOrderSummaries is called ONCE on initial load, then per-table on status changes.
 *   mergeTables/unmergeTables return updated rows → direct state patch, no loadTables().
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
  BellRing,
  Plus,
  Trash2,
  GitMerge,
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
  Unlink,
  LayoutGrid,
  Pencil,
  Calendar,
  Clock,
  CheckCheck,
  BookMarked,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'
import { resolveTableAssistance } from '@/services/assistanceService'
import { resolveBillOutRequest, fetchAllBillRequests } from '@/services/billService'
import type { BillRequest } from '@/types/bill'
import { TableAlertsBanner } from '@/components/alerts/TableAlertsBanner'
import { TableQrPreview } from '@/components/table-qr/TableQrPreview'
import { downloadBulkQrPdf } from '@/components/table-qr/tableQrPdf'
import { printBulkQrPdf } from '@/components/table-qr/tableQrPrinter'
import { resolveTableGroupByList } from '@/services/tableGroupService'
import {
  fetchAllTables,
  fetchTablesByIds,
  fetchOrderSummariesForIds,
  createTable,
  batchCreateTables,
  updateTable,
  deleteTables,
  bulkEditTables,
  mergeTables,
  previewMerge,
  unmergeTables,
  reserveTable,
  cancelReservation,
  setTableStatus,
  type TableData,
  type TableStatus,
  type MergePreview,
  type ReservationData,
} from '@/services/tableService'

// ─────────────────────────────────────────────────────────────────────────────
// Types / helpers
// ─────────────────────────────────────────────────────────────────────────────

type PageMode = 'normal' | 'multi'

interface ToastMsg { text: string; type: 'success' | 'error' | 'info' }

interface OrderSummary { totalBill: number; activeOrderCount: number }

const OCCUPIED_STATUSES: TableStatus[] = ['OCCUPIED', 'HAS_REQUEST']

function fmt(val: number) {
  return '₱' + val.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

function statusLabel(s: TableStatus): string {
  return { AVAILABLE: 'Available', OCCUPIED: 'Occupied', RESERVED: 'Reserved', HAS_REQUEST: 'Needs Help', UNAVAILABLE: 'Unavailable' }[s] ?? s
}

function statusClass(s: TableStatus): string {
  return { AVAILABLE: 'tm-status-available', OCCUPIED: 'tm-status-occupied', RESERVED: 'tm-status-reserved', HAS_REQUEST: 'tm-status-has_request', UNAVAILABLE: 'tm-status-unavailable' }[s] ?? ''
}

function fmtReservationTime(iso: string | null): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch { return iso }
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
// MergeModal
// ─────────────────────────────────────────────────────────────────────────────

interface MergeModalProps {
  selectedIds: number[]; allTables: TableData[]
  onClose: () => void; onMerged: (updatedRows: TableData[]) => void
  showToast: (t: string, type?: ToastMsg['type']) => void
  onStartMutating?: () => void
}

function MergeModal({ selectedIds, onClose, onMerged, showToast, onStartMutating }: MergeModalProps) {
  const [preview, setPreview] = useState<MergePreview | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  useEffect(() => {
    let cancelled = false
    setLoadingPreview(true)
    previewMerge(selectedIds)
      .then((p) => { if (!cancelled) setPreview(p) })
      .catch((err) => { if (!cancelled) setError((err as Error).message) })
      .finally(() => { if (!cancelled) setLoadingPreview(false) })
    return () => { cancelled = true }
  }, [selectedIds])

  async function handleMerge() {
    setError(''); setLoading(true)
    onStartMutating?.()
    try {
      const updatedRows = await mergeTables(selectedIds)
      const names = preview?.allMembers.map((t) => `T${t.TABLE_NUM}`).join('+')
      showToast(`Merged: ${names}`, 'success')
      onMerged(updatedRows)
      onClose()
    } catch (err: unknown) {
      setError((err as Error).message); setLoading(false)
    }
  }

  return (
    <div className="tm-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="tm-modal">
        <div className="tm-modal-header">
          <div>
            <div className="tm-modal-title"><GitMerge className="w-4 h-4" />Merge Tables</div>
            <p className="tm-modal-desc">Selected tables will share one order and one bill.</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="tm-modal-body">
          {loadingPreview ? (
            <div className="flex items-center justify-center py-6 text-slate-400 text-sm gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Calculating…
            </div>
          ) : preview ? (
            <>
              <p className="text-sm text-slate-600 mb-3">
                <strong className="text-[#14274E]">Table {preview.primaryTable.TABLE_NUM}</strong> will be the primary.
                {preview.allMembers.filter(t => t.TABLE_ID !== preview.primaryTable.TABLE_ID).map(t => ` Table ${t.TABLE_NUM}`).join(',')} will be absorbed.
              </p>
              <div className="tm-merge-info-box space-y-1.5">
                <div className="tm-info-row"><span>Tables in group</span><strong>{preview.allMembers.length}</strong></div>
                <div className="tm-info-row"><span>Combined capacity</span><strong>{preview.totalCapacity} pax</strong></div>
                <div className="tm-info-row"><span>Total seated pax</span><strong>{preview.totalSeatedPax} pax</strong></div>
              </div>
              {preview.occupiedTables.length > 0 && (
                <div className="tm-warning-box mt-3">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-amber-800 text-[0.74rem]">Active orders detected</p>
                    <p className="text-[0.7rem]">Orders from {preview.occupiedTables.map(t => `Table ${t.TABLE_NUM}`).join(', ')} will be reassigned to Table {preview.primaryTable.TABLE_NUM}. No data is lost.</p>
                  </div>
                </div>
              )}
            </>
          ) : null}
          {error && <p className="tm-error-text mt-2">{error}</p>}
        </div>
        <div className="tm-modal-footer">
          <button onClick={onClose} className="px-3 py-1.5 text-sm font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors">Cancel</button>
          <Button variant="primary" size="sm" loading={loading} disabled={loadingPreview || !preview?.canMerge} onClick={() => void handleMerge()}>
            <GitMerge className="w-3.5 h-3.5" /> Merge
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// UnmergeModal
// ─────────────────────────────────────────────────────────────────────────────

interface UnmergeModalProps {
  primaryTable: TableData; allTables: TableData[]
  onClose: () => void; onUnmerged: (updatedRows: TableData[]) => void
  showToast: (t: string, type?: ToastMsg['type']) => void
  onStartMutating?: () => void
}

function UnmergeModal({ primaryTable, allTables, onClose, onUnmerged, showToast, onStartMutating }: UnmergeModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const secondaries = allTables.filter(t => t.MERGE_GROUP_ID === primaryTable.TABLE_ID)

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  async function handleUnmerge() {
    setError(''); setLoading(true)
    onStartMutating?.()
    try {
      const updatedRows = await unmergeTables(primaryTable.TABLE_ID)
      showToast(`Table ${primaryTable.TABLE_NUM} unmerged.`, 'success')
      onUnmerged(updatedRows)
      onClose()
    } catch (err: unknown) {
      setError((err as Error).message); setLoading(false)
    }
  }

  return (
    <div className="tm-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="tm-modal">
        <div className="tm-modal-header">
          <div>
            <div className="tm-modal-title"><Unlink className="w-4 h-4" />Unmerge Group</div>
            <p className="tm-modal-desc">Split the merged group back into individual tables.</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="tm-modal-body">
          <div className="tm-selected-list">
            {secondaries.map(t => (
              <div key={t.TABLE_ID} className="tm-selected-list-item">
                <span className="font-bold text-[#14274E]">Table {t.TABLE_NUM}</span>
                <span className="text-slate-400 text-xs">→ Available</span>
              </div>
            ))}
          </div>
          <div className="tm-warning-box mt-3">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-[0.74rem]">Orders stay on Table {primaryTable.TABLE_NUM}</p>
              <p className="text-[0.7rem]">Released tables reset to Available with 0 seated guests.</p>
            </div>
          </div>
          {error && <p className="tm-error-text mt-2">{error}</p>}
        </div>
        <div className="tm-modal-footer">
          <button onClick={onClose} className="px-3 py-1.5 text-sm font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors">Cancel</button>
          <Button variant="danger" size="sm" loading={loading} onClick={() => void handleUnmerge()}>
            <Unlink className="w-3.5 h-3.5" /> Unmerge
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TableCard
// ─────────────────────────────────────────────────────────────────────────────

interface TableCardProps {
  table: TableData
  allTables: TableData[]
  mode: PageMode
  isActive: boolean        // sidebar is showing this table (normal mode)
  isSelected: boolean      // checked in multi mode
  isMergedPrimary: boolean
  isMergedSecondary: boolean
  mergedWithNums: number[]
  summary?: OrderSummary
  onClick: () => void
  onQrClick: () => void
}

const TableCard = memo(function TableCard({
  table, allTables, mode, isActive, isSelected, isMergedPrimary, isMergedSecondary,
  mergedWithNums, summary, onClick, onQrClick,
}: TableCardProps) {
  const hasRequest = table.STATUS === 'HAS_REQUEST'
  const isOccupied = OCCUPIED_STATUSES.includes(table.STATUS)
  const isUnavailable = table.STATUS === 'UNAVAILABLE'
  const isReserved = table.STATUS === 'RESERVED'

  const anchorTable = isMergedSecondary
    ? allTables.find((t) => t.TABLE_ID === table.MERGE_GROUP_ID)
    : null
  const displayGuestCount = isMergedSecondary && anchorTable
    ? anchorTable.CURRENT_GUEST_COUNT
    : table.CURRENT_GUEST_COUNT
  const displayCapacity = isMergedSecondary && anchorTable
    ? anchorTable.GUEST_CAPACITY
    : table.GUEST_CAPACITY

  const paxFull = displayGuestCount >= displayCapacity && displayCapacity > 0
  const isMerged = isMergedPrimary || isMergedSecondary

  const cardClass = [
    'tm-table-card',
    mode === 'normal' && isActive ? 'is-active' : '',
    mode === 'multi' && isSelected ? 'is-selected-multi' : '',
    isMergedPrimary ? 'is-merged-primary' : '',
    isMergedSecondary ? 'is-merged-secondary' : '',
    isUnavailable ? 'is-unavailable' : '',
    hasRequest ? 'has-request' : '',
  ].filter(Boolean).join(' ')

  return (
    <div
      className={cardClass}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick() }}
      aria-pressed={mode === 'multi' ? isSelected : isActive}
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

      {/* Multi-select checkbox */}
      {mode === 'multi' && (
        <div className="tm-checkbox-wrap" onClick={(e) => e.stopPropagation()}>
          <div className={`tm-checkbox ${isSelected ? 'checked' : ''}`} onClick={onClick}>
            {isSelected && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
          </div>
        </div>
      )}

      {/* QR button */}
      <button type="button" className="tm-qr-btn" onClick={(e) => { e.stopPropagation(); onQrClick() }} title={`QR for Table ${table.TABLE_NUM}`}>
        <QrCode className="w-3 h-3" />
      </button>

      {/* Table number */}
      <div className={mode === 'multi' ? 'pt-5' : 'pt-1'}>
        <div className="tm-table-num">Table {table.TABLE_NUM}</div>
      </div>

      {/* Status badges */}
      <div className="mt-1.5 flex items-center gap-1 flex-wrap">
        <span className={`tm-status-badge ${statusClass(table.STATUS)}`}>{statusLabel(table.STATUS)}</span>
        {isMerged && (
          <span className="tm-status-badge tm-status-merged">
            <GitMerge className="w-2 h-2" />
            {isMergedPrimary ? 'Merged' : 'Group'}
          </span>
        )}
      </div>

      {/* Pax */}
      <div className={`tm-pax-row ${paxFull ? 'tm-pax-full' : ''}`}>
        <Users className="w-3 h-3 shrink-0" />
        <span>{displayGuestCount}/{displayCapacity}</span>
      </div>

      {/* Order info */}
      {isOccupied && summary && summary.activeOrderCount > 0 && (
        <div className="tm-order-row">
          <span className="tm-bill-amount">{fmt(summary.totalBill)}</span>
          <span>· {summary.activeOrderCount} order{summary.activeOrderCount !== 1 ? 's' : ''}</span>
        </div>
      )}

      {/* Reservation snippet */}
      {isReserved && table.RESERVATION_NAME && (
        <div className="tm-reservation-snippet">
          <span>{table.RESERVATION_NAME}</span>
          {table.RESERVED_SINCE && <span>{fmtReservationTime(table.RESERVED_SINCE)}</span>}
          {table.RESERVATION_PAX && <span>{table.RESERVATION_PAX} pax</span>}
        </div>
      )}

      {/* Merge detail */}
      {isMergedPrimary && mergedWithNums.length > 0 && (
        <div className="tm-merge-snippet">+ T{mergedWithNums.join(', T')}</div>
      )}
      {isMergedSecondary && anchorTable && (
        <div className="tm-merge-snippet">with T{anchorTable.TABLE_NUM}</div>
      )}
    </div>
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// TableSidebar — persistent right panel
// ─────────────────────────────────────────────────────────────────────────────

interface SidebarDraft {
  tableNum: string
  capacity: number
  seatedPax: number
  // Reservation
  reservationName: string
  reservationPax: number
  reservationDate: string
  reservationTime: string
  reservationNotes: string
}

function tableToDraft(t: TableData, allTables: TableData[]): SidebarDraft {
  const group = resolveTableGroupByList(t.TABLE_ID, allTables)
  const isMerged = group.isMerged
  const capacity = isMerged ? group.capacity : t.GUEST_CAPACITY
  const seatedPax = isMerged ? group.currentGuestCount : t.CURRENT_GUEST_COUNT

  let date = '', time = ''
  if (t.RESERVED_SINCE) {
    try {
      const d = new Date(t.RESERVED_SINCE)
      date = d.toISOString().split('T')[0]
      time = d.toTimeString().slice(0, 5)
    } catch { /* ignore */ }
  }
  return {
    tableNum: String(t.TABLE_NUM),
    capacity,
    seatedPax,
    reservationName: t.RESERVATION_NAME ?? '',
    reservationPax: t.RESERVATION_PAX ?? capacity,
    reservationDate: date,
    reservationTime: time,
    reservationNotes: t.RESERVATION_NOTES ?? '',
  }
}

interface TableSidebarProps {
  mode: PageMode
  table: TableData | null        // currently-open single table
  selectedIds: Set<number>
  allTables: TableData[]
  orderSummaries: Map<number, OrderSummary>
  mergeGroupMap: Map<number, number[]>
  onClose: () => void
  onEnterMultiMode: () => void
  onExitMultiMode: () => void
  onMergeSelected: () => void
  onDeleteSelected: () => void
  onUnmerge: (table: TableData) => void
  onTableUpdated: (row: TableData) => void
  onTablesPatched: (rows: TableData[]) => void
  showToast: (t: string, type?: ToastMsg['type']) => void
}

function TableSidebar({
  mode, table, selectedIds, allTables, orderSummaries, mergeGroupMap,
  onClose, onExitMultiMode, onMergeSelected, onDeleteSelected,
  onUnmerge, onTableUpdated, onTablesPatched, showToast,
}: TableSidebarProps) {

  // ── Draft state (reset when the selected table ID changes) ──
  const [draft, setDraft] = useState<SidebarDraft | null>(null)
  const [showReservationForm, setShowReservationForm] = useState(false)
  const [sidebarError, setSidebarError] = useState('')
  const [saving, setSaving] = useState(false)
  const [reserving, setReserving] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  const groupInfo = useMemo(() => {
    if (!table) return null
    return resolveTableGroupByList(table.TABLE_ID, allTables)
  }, [table, allTables])
  const isMerged = Boolean(groupInfo?.isMerged)

  // Use a ref to track the previous table ID to know when to reset draft
  const prevTableIdRef = useRef<number | null>(null)

  useEffect(() => {
    if (table?.TABLE_ID !== prevTableIdRef.current) {
      prevTableIdRef.current = table?.TABLE_ID ?? null
      setDraft(table ? tableToDraft(table, allTables) : null)
      setShowReservationForm(false)
      setSidebarError('')
    }
  }, [table, allTables])

  // Check if draft differs from current table data (unsaved changes)
  const isDirty = useMemo(() => {
    if (!draft || !table || !groupInfo) return false
    const baselineCapacity = groupInfo.isMerged ? groupInfo.capacity : table.GUEST_CAPACITY
    const baselineSeatedPax = groupInfo.isMerged ? groupInfo.currentGuestCount : table.CURRENT_GUEST_COUNT
    return (
      draft.tableNum !== String(table.TABLE_NUM) ||
      (!groupInfo.isMerged && draft.capacity !== baselineCapacity) ||
      draft.seatedPax !== baselineSeatedPax
    )
  }, [draft, table, groupInfo])

  // ── Save changes ──
  async function handleSave() {
    if (!table || !draft || !groupInfo) return
    setSidebarError(''); setSaving(true)
    try {
      const numVal = parseInt(draft.tableNum, 10)
      if (isNaN(numVal) || numVal < 1) throw new Error('Table number must be a positive integer.')
      const effectiveCap = groupInfo.isMerged ? groupInfo.capacity : draft.capacity
      if (draft.seatedPax > effectiveCap) throw new Error(`Seated pax cannot exceed capacity (${effectiveCap}).`)

      const baselineCapacity = groupInfo.isMerged ? groupInfo.capacity : table.GUEST_CAPACITY
      const baselineSeatedPax = groupInfo.isMerged ? groupInfo.currentGuestCount : table.CURRENT_GUEST_COUNT

      const updatedRows = await updateTable(table.TABLE_ID, {
        tableNum: numVal !== table.TABLE_NUM ? numVal : undefined,
        capacity: !groupInfo.isMerged && draft.capacity !== baselineCapacity ? draft.capacity : undefined,
        seatedPax: draft.seatedPax !== baselineSeatedPax ? draft.seatedPax : undefined,
      })

      onTablesPatched(updatedRows)
      const primaryUpdated = updatedRows.find(r => r.TABLE_ID === (table.MERGE_GROUP_ID ?? table.TABLE_ID)) ?? updatedRows[0]
      if (primaryUpdated) {
        onTableUpdated(primaryUpdated)
      }
      showToast(`Table ${table.TABLE_NUM}${groupInfo.isMerged ? ' (merged group)' : ''} saved.`, 'success')
    } catch (err: unknown) {
      setSidebarError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  // ── Table Status ──
  const [statusSaving, setStatusSaving] = useState(false)

  async function handleStatusChange(newStatus: TableStatus) {
    if (!table) return
    if (newStatus === table.STATUS) return
    setSidebarError(''); setStatusSaving(true)
    try {
      const updatedRows = await setTableStatus(table.TABLE_ID, newStatus)
      onTablesPatched(updatedRows)
      const isGroup = mergeGroupMap.has(table.TABLE_ID) || (table.MERGE_GROUP_ID !== null && table.MERGE_GROUP_ID !== undefined)
      const groupSuffix = isGroup ? ' (and merged group)' : ''
      showToast(`Table ${table.TABLE_NUM}${groupSuffix} updated to ${statusLabel(newStatus)}.`, 'success')
    } catch (err: unknown) {
      setSidebarError((err as Error).message)
    } finally {
      setStatusSaving(false)
    }
  }

  // ── Reservation ──
  async function handleReserve() {
    if (!table || !draft) return
    setSidebarError(''); setReserving(true)
    try {
      if (!draft.reservationName.trim()) throw new Error('Guest name is required.')
      if (!draft.reservationDate || !draft.reservationTime) throw new Error('Reservation date and time are required.')
      const iso = new Date(`${draft.reservationDate}T${draft.reservationTime}`).toISOString()
      const resData: ReservationData = {
        name: draft.reservationName,
        pax: draft.reservationPax,
        reservedSince: iso,
        notes: draft.reservationNotes || undefined,
      }
      const updated = await reserveTable(table.TABLE_ID, resData)
      onTableUpdated(updated)
      setShowReservationForm(false)
      showToast(`Table ${table.TABLE_NUM} reserved for ${draft.reservationName}.`, 'success')
    } catch (err: unknown) {
      setSidebarError((err as Error).message)
    } finally {
      setReserving(false)
    }
  }

  async function handleCancelReservation() {
    if (!table) return
    setCancelling(true)
    try {
      const updated = await cancelReservation(table.TABLE_ID)
      onTableUpdated(updated)
      showToast(`Reservation on Table ${table.TABLE_NUM} cancelled.`, 'info')
    } catch (err: unknown) {
      setSidebarError((err as Error).message)
    } finally {
      setCancelling(false)
    }
  }

  // ── Bulk edit state ──
  const [bulkCapacity, setBulkCapacity] = useState(4)
  const [bulkStatus, setBulkStatus] = useState<TableStatus | ''>('')
  const [bulkError, setBulkError] = useState('')
  const [bulkSaving, setBulkSaving] = useState(false)

  async function handleBulkApply() {
    setBulkError(''); setBulkSaving(true)
    try {
      const fields: { capacity?: number; status?: TableStatus } = {}
      if (bulkCapacity > 0) fields.capacity = bulkCapacity
      if (bulkStatus) fields.status = bulkStatus
      if (!fields.capacity && !fields.status) throw new Error('Choose at least one field to change.')
      const result = await bulkEditTables([...selectedIds], fields)
      if (result.updated.length > 0) {
        onTablesPatched(result.updated)
        showToast(`${result.updated.length} table(s) updated.`, 'success')
      }
      if (result.blocked.length > 0) {
        const names = result.blocked.map(b => `T${b.num}`).join(', ')
        showToast(`${names} could not be updated.`, 'error')
      }
      setBulkCapacity(4); setBulkStatus('')
    } catch (err: unknown) {
      setBulkError((err as Error).message)
    } finally {
      setBulkSaving(false)
    }
  }

  // ─── RENDER ───────────────────────────────────────────────────────────────

  // MULTI mode: show bulk panel
  if (mode === 'multi') {
    const selectedList = allTables.filter(t => selectedIds.has(t.TABLE_ID))
    const canMerge = selectedIds.size >= 2

    return (
      <aside className="tm-sidebar">
        <div className="tm-sidebar-header">
          <div>
            <div className="tm-sidebar-title"><CheckCheck className="w-4 h-4" />Multi-Select</div>
            <div className="tm-sidebar-subtitle">{selectedIds.size} table{selectedIds.size !== 1 ? 's' : ''} selected</div>
          </div>
          <button className="tm-sidebar-close" onClick={onExitMultiMode} title="Exit multi-select mode"><X className="w-4 h-4" /></button>
        </div>

        <div className="tm-sidebar-body">
          {selectedIds.size === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">Click tables to select them.</p>
          ) : (
            <>
              <div className="tm-sidebar-section">
                <span className="tm-sidebar-section-title">Selected Tables</span>
                <div className="tm-selected-list">
                  {selectedList.map(t => (
                    <div key={t.TABLE_ID} className="tm-selected-list-item">
                      <span className="font-bold text-[#14274E]">Table {t.TABLE_NUM}</span>
                      <span className={`tm-status-badge ${statusClass(t.STATUS)}`}>{statusLabel(t.STATUS)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="tm-divider" />

              <div className="tm-sidebar-section">
                <span className="tm-sidebar-section-title">Bulk Edit</span>
                <div>
                  <label className="tm-field-label">Set Capacity for All</label>
                  <PaxStepper value={bulkCapacity} min={1} max={99} onChange={setBulkCapacity} />
                  <p className="text-[0.68rem] text-slate-400 mt-1">Tables where seated pax &gt; new capacity will be skipped.</p>
                </div>
                <div>
                  <label className="tm-field-label">Set Status for All</label>
                  <select className="tm-select" value={bulkStatus} onChange={e => setBulkStatus(e.target.value as TableStatus | '')}>
                    <option value="">— No change —</option>
                    <option value="AVAILABLE">Available</option>
                    <option value="OCCUPIED">Occupied</option>
                    <option value="RESERVED">Reserved</option>
                    <option value="HAS_REQUEST">Needs Help</option>
                    <option value="UNAVAILABLE">Unavailable</option>
                  </select>
                  <p className="text-[0.68rem] text-slate-400 mt-1">If any selected table is merged, all merged members will update.</p>
                </div>
                {bulkError && <p className="tm-error-text">{bulkError}</p>}
                <button className="tm-sidebar-btn primary" onClick={() => void handleBulkApply()} disabled={bulkSaving}>
                  {bulkSaving ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <CheckCheck className="w-3.5 h-3.5" />}
                  Apply to {selectedIds.size} Table{selectedIds.size !== 1 ? 's' : ''}
                </button>
              </div>

              <div className="tm-divider" />

              <div className="tm-sidebar-section">
                <span className="tm-sidebar-section-title">Bulk Actions</span>
                {canMerge && (
                  <button className="tm-sidebar-btn accent" onClick={onMergeSelected}>
                    <GitMerge className="w-3.5 h-3.5" /> Merge {selectedIds.size} Tables
                  </button>
                )}
                <button className="tm-sidebar-btn danger" onClick={onDeleteSelected}>
                  <Trash2 className="w-3.5 h-3.5" /> Delete Selected
                </button>
              </div>
            </>
          )}
        </div>

        <div className="tm-sidebar-footer">
          <button className="tm-sidebar-btn ghost" onClick={onExitMultiMode}>
            <X className="w-3.5 h-3.5" /> Cancel Selection
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
  const isReserved = table.STATUS === 'RESERVED'
  const summary = orderSummaries.get(table.TABLE_ID)
  const isMergedPrimary = mergeGroupMap.has(table.TABLE_ID)
  const isMergedSecondary = table.MERGE_GROUP_ID !== null && table.MERGE_GROUP_ID !== undefined
  const mergedWithNums = mergeGroupMap.get(table.TABLE_ID) ?? []
  const secondaryMergedWithTable = isMergedSecondary
    ? allTables.find((t) => t.TABLE_ID === table.MERGE_GROUP_ID)
    : null

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
            <label className="tm-field-label">Table Number</label>
            <input
              type="number" min={1} className="tm-input"
              value={draft.tableNum}
              onChange={e => setDraft(d => d ? { ...d, tableNum: e.target.value } : d)}
            />
          </div>
          <div>
            <label className="tm-field-label">
              Maximum Pax (Capacity)
              {isMerged && <span className="ml-1 text-slate-400 font-normal normal-case">(Group Combined)</span>}
            </label>
            <PaxStepper
              value={draft.capacity} min={Math.max(1, draft.seatedPax)} max={99}
              disabled={isMerged}
              onChange={v => setDraft(d => d ? { ...d, capacity: v } : d)}
            />
            {isMerged && groupInfo && (
              <p className="text-[0.68rem] text-slate-400 mt-1">
                Combined capacity of {groupInfo.memberTableNums.map(n => `Table ${n}`).join(' + ')}.
              </p>
            )}
          </div>
          {table.STATUS !== 'UNAVAILABLE' && (
            <div>
              <label className="tm-field-label">
                {isMerged ? 'Seated Pax (Group Total)' : 'Seated Pax'}
                {draft.seatedPax >= draft.capacity && <span className="ml-1 text-amber-600 normal-case"> (Full)</span>}
              </label>
              <PaxStepper
                value={draft.seatedPax} min={0} max={draft.capacity}
                onChange={v => setDraft(d => d ? { ...d, seatedPax: v } : d)}
              />
              {isMerged && groupInfo && (
                <p className="text-[0.68rem] text-slate-400 mt-1">
                  Applies to the entire merged group ({groupInfo.memberTableNums.map(n => `T${n}`).join('+')}).
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── Order info ── */}
        {isOccupied && summary && (
          <>
            <div className="tm-divider" />
            <div className="tm-sidebar-section">
              <span className="tm-sidebar-section-title">Active Orders</span>
              <div className="tm-info-row"><span>Orders</span><strong>{summary.activeOrderCount}</strong></div>
              <div className="tm-info-row"><span>Total Bill</span><strong>{fmt(summary.totalBill)}</strong></div>
            </div>
          </>
        )}

        {/* ── Table Status ── */}
        <div className="tm-divider" />
        <div className="tm-sidebar-section">
          <span className="tm-sidebar-section-title">Table Status</span>
          {isMerged && (
            <div className="text-[0.72rem] text-slate-500 mb-2 flex items-center gap-1.5 bg-slate-50 p-2 rounded-lg border border-slate-200">
              <GitMerge className="w-3.5 h-3.5 text-[#14274E] shrink-0" />
              <span>
                {isMergedPrimary
                  ? `Merged with Table ${mergedWithNums.join(', Table ')}.`
                  : `Merged with Table ${secondaryMergedWithTable?.TABLE_NUM ?? table.MERGE_GROUP_ID}.`}{' '}
                Changing status will also update all tables in this group.
              </span>
            </div>
          )}
          <div>
            <label className="tm-field-label">Current Status</label>
            <select
              className="tm-select"
              value={table.STATUS}
              onChange={(e) => void handleStatusChange(e.target.value as TableStatus)}
              disabled={statusSaving || saving}
            >
              <option value="AVAILABLE">Available</option>
              <option value="OCCUPIED">Occupied</option>
              <option value="RESERVED">Reserved</option>
              <option value="HAS_REQUEST">Needs Help</option>
              <option value="UNAVAILABLE">Unavailable</option>
            </select>
            {statusSaving && (
              <p className="text-[0.68rem] text-slate-400 mt-1 flex items-center gap-1">
                <span className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent inline-block" />
                Updating status...
              </p>
            )}
          </div>
        </div>

        {/* ── Reservation ── */}
        {!isOccupied && (
          <>
            <div className="tm-divider" />
            <div className="tm-sidebar-section">
              <span className="tm-sidebar-section-title">Reservation</span>

              {isReserved ? (
                /* Existing reservation details */
                <div className="tm-reservation-section">
                  <div className="tm-info-row"><span>Guest</span><strong>{table.RESERVATION_NAME}</strong></div>
                  {table.RESERVATION_PAX && <div className="tm-info-row"><span>Pax</span><strong>{table.RESERVATION_PAX}</strong></div>}
                  {table.RESERVED_SINCE && (
                    <div className="tm-info-row">
                      <span>When</span>
                      <strong className="text-xs">{fmtReservationTime(table.RESERVED_SINCE)}</strong>
                    </div>
                  )}
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
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="tm-field-label"><Calendar className="w-3 h-3 inline" /> Date *</label>
                      <input type="date" className="tm-input" value={draft.reservationDate}
                        onChange={e => setDraft(d => d ? { ...d, reservationDate: e.target.value } : d)} />
                    </div>
                    <div className="flex-1">
                      <label className="tm-field-label"><Clock className="w-3 h-3 inline" /> Time *</label>
                      <input type="time" className="tm-input" value={draft.reservationTime}
                        onChange={e => setDraft(d => d ? { ...d, reservationTime: e.target.value } : d)} />
                    </div>
                  </div>
                  <div>
                    <label className="tm-field-label">Notes (optional)</label>
                    <textarea className="tm-textarea" placeholder="Birthday dinner, requires highchair…"
                      value={draft.reservationNotes}
                      onChange={e => setDraft(d => d ? { ...d, reservationNotes: e.target.value } : d)} />
                  </div>
                  <div className="flex gap-2">
                    <button className="tm-sidebar-btn ghost flex-1" onClick={() => setShowReservationForm(false)}>Cancel</button>
                    <button className="tm-sidebar-btn accent flex-1" onClick={() => void handleReserve()} disabled={reserving}>
                      {reserving
                        ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        : <BookMarked className="w-3.5 h-3.5" />}
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <button className="tm-sidebar-btn secondary" onClick={() => setShowReservationForm(true)}>
                  <BookMarked className="w-3.5 h-3.5" /> Reserve Table
                </button>
              )}
            </div>
          </>
        )}

        {/* ── Merge status ── */}
        {(isMergedPrimary || isMergedSecondary) && (
          <>
            <div className="tm-divider" />
            <div className="tm-sidebar-section">
              <span className="tm-sidebar-section-title">Merge Group</span>
              {isMergedPrimary && (
                <>
                  <div className="tm-merge-info-box">
                    <div className="tm-info-row"><span>Role</span><strong>Primary</strong></div>
                    {mergedWithNums.length > 0 && (
                      <div className="tm-info-row"><span>Absorbed</span><strong>T{mergedWithNums.join(', T')}</strong></div>
                    )}
                    <div className="tm-info-row"><span>Total capacity</span><strong>{table.GUEST_CAPACITY} pax</strong></div>
                  </div>
                  <button className="tm-sidebar-btn ghost" onClick={() => onUnmerge(table)}>
                    <Unlink className="w-3.5 h-3.5" /> Unmerge Group
                  </button>
                </>
              )}
              {isMergedSecondary && (
                <div className="tm-merge-info-box">
                  <div className="tm-info-row"><span>Role</span><strong>Absorbed into group</strong></div>
                  <p className="text-[0.7rem] text-slate-400 mt-0.5">Orders managed by primary table.</p>
                </div>
              )}
            </div>
          </>
        )}

        {sidebarError && <p className="tm-error-text">{sidebarError}</p>}
      </div>

      {/* Footer actions */}
      <div className="tm-sidebar-footer">
        <button
          className="tm-sidebar-btn primary"
          onClick={() => void handleSave()}
          disabled={saving || !isDirty}
        >
          {saving
            ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            : <Check className="w-3.5 h-3.5" />}
          {isDirty ? 'Save Changes' : 'No Changes'}
        </button>
        <button className="tm-sidebar-btn danger" onClick={onDeleteSelected}>
          <Trash2 className="w-3.5 h-3.5" /> Delete Table
        </button>
      </div>
    </aside>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export default function TableManagerPage() {
  // ── Core data ──
  const [tables, setTables] = useState<TableData[]>([])
  const [billRequests, setBillRequests] = useState<BillRequest[]>([])
  const [orderSummaries, setOrderSummaries] = useState<Map<number, OrderSummary>>(new Map())
  const [isLoading, setIsLoading] = useState(true)

  // ── Selection / mode ──
  const [mode, setMode] = useState<PageMode>('normal')
  const [sidebarTableId, setSidebarTableId] = useState<number | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  // ── Modals ──
  const [showAddModal, setShowAddModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showMergeModal, setShowMergeModal] = useState(false)
  const [unmergeTarget, setUnmergeTarget] = useState<TableData | null>(null)
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

  const mergeGroupMap = useMemo(() => {
    const map = new Map<number, number[]>()
    for (const t of tables) {
      if (t.MERGE_GROUP_ID !== null && t.MERGE_GROUP_ID !== undefined) {
        const primaryId = t.MERGE_GROUP_ID
        const existing = map.get(primaryId) ?? []
        map.set(primaryId, [...existing, t.TABLE_NUM])
      }
    }
    return map
  }, [tables])

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
  const loadAll = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true)
    try {
      const [data, bReqs] = await Promise.all([
        fetchAllTables(),
        fetchAllBillRequests(),
      ])
      setBillRequests(bReqs)
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
              oldT.MERGE_GROUP_ID === n.MERGE_GROUP_ID &&
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
    } finally {
      if (!silent) setIsLoading(false)
    }
  }, [loadSummariesForTables])

  useEffect(() => {
    void loadAll(false)
  }, [loadAll])

  // ── Background polling (5s, guarded against mutation in-flight) ──
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isMutatingRef.current && document.visibilityState === 'visible') void loadAll(true)
    }, 5000)

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && !isMutatingRef.current) void loadAll(true)
    }
    document.addEventListener('visibilitychange', handleVisibility)

    // ── Realtime subscription (targeted updates only) ──
    const channel = supabase
      .channel('tm-phase2-tables')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Restaurant_Tables' }, async (payload) => {
        if (payload.eventType === 'UPDATE') {
          const updated = payload.new as TableData
          setTables((prev) => prev.map((t) => t.TABLE_ID === updated.TABLE_ID ? updated : t))
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
            return [...prev, inserted].sort((a, b) => a.TABLE_NUM - b.TABLE_NUM)
          })
        } else if (payload.eventType === 'DELETE') {
          const deletedId = (payload.old as { TABLE_ID: number }).TABLE_ID
          setTables((prev) => prev.filter((t) => t.TABLE_ID !== deletedId))
          setSelectedIds((prev) => { const next = new Set(prev); next.delete(deletedId); return next })
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
    if (mode === 'multi') {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        if (next.has(table.TABLE_ID)) next.delete(table.TABLE_ID)
        else next.add(table.TABLE_ID)
        return next
      })
    } else {
      setSidebarTableId(table.TABLE_ID)
    }
  }

  function enterMultiMode() { setMode('multi'); setSidebarTableId(null) }
  function exitMultiMode() { setMode('normal'); setSelectedIds(new Set()) }

  // ── Delete ──
  async function handleDelete() {
    const ids = mode === 'multi' ? [...selectedIds] : (sidebarTableId ? [sidebarTableId] : [])
    if (ids.length === 0) return
    setDeleteLoading(true); isMutatingRef.current = true
    try {
      const result = await deleteTables(ids)
      if (result.deleted.length > 0) {
        setTables((prev) => prev.filter((t) => !result.deleted.includes(t.TABLE_ID)))
        setOrderSummaries((prev) => { const next = new Map(prev); result.deleted.forEach(id => next.delete(id)); return next })
        setSelectedIds((prev) => { const next = new Set(prev); result.deleted.forEach(id => next.delete(id)); return next })
        if (sidebarTableId && result.deleted.includes(sidebarTableId)) setSidebarTableId(null)
        showToast(`${result.deleted.length} table(s) deleted.`, 'success')
      }
      if (result.blocked.length > 0) {
        showToast(`${result.blocked.length} table(s) could not be deleted.`, 'error')
      }
      if (result.deleted.length > 0 && mode === 'multi') exitMultiMode()
      setShowDeleteConfirm(false)
    } catch (err: unknown) {
      showToast((err as Error).message, 'error')
    } finally {
      setDeleteLoading(false); isMutatingRef.current = false
    }
  }

  // ── After merge/unmerge: targeted patch ──
  function handleMergeComplete(updatedRows: TableData[]) {
    isMutatingRef.current = true
    setTables((prev) => patchTables(prev, updatedRows))
    exitMultiMode()
    // Refresh summaries for the primary table (which might now have orders)
    const occupiedFromUpdate = updatedRows.filter(t => OCCUPIED_STATUSES.includes(t.STATUS))
    if (occupiedFromUpdate.length > 0) {
      void fetchOrderSummariesForIds(occupiedFromUpdate.map(t => t.TABLE_ID)).then(summaries => {
        setOrderSummaries(prev => new Map([...prev, ...summaries]))
      })
    }
    setTimeout(() => {
      isMutatingRef.current = false
    }, 2000)
  }

  function handleUnmergeComplete(updatedRows: TableData[]) {
    isMutatingRef.current = true
    setTables((prev) => patchTables(prev, updatedRows))
    setTimeout(() => {
      isMutatingRef.current = false
    }, 2000)
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
  async function handleDownloadPdf() {
    setIsGeneratingPdf(true)
    try { await downloadBulkQrPdf(tables) }
    catch { showToast('Failed to generate PDF.', 'error') }
    finally { setIsGeneratingPdf(false) }
  }

  async function handlePrint() {
    setIsPrinting(true)
    try { await printBulkQrPdf(tables) }
    catch { showToast('Failed to print.', 'error') }
    finally { setIsPrinting(false) }
  }

  // ── Delete target IDs for confirm dialog ──
  const deleteTargetIds = mode === 'multi' ? [...selectedIds] : (sidebarTableId ? [sidebarTableId] : [])
  const deleteTargetTables = tables.filter(t => deleteTargetIds.includes(t.TABLE_ID))

  // ─── RENDER ──────────────────────────────────────────────────────────────

  return (
    <div className="table-manager-page-container">
      {/* Toast */}
      {toast && (
        <div className={`tm-toast tm-toast-${toast.type}`}>
          {toast.type === 'success' && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
          {toast.type === 'error' && <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
          {toast.text}
        </div>
      )}

      {/* Page header area */}
      <div className="tm-page-header-area">
        <PageHeader
          title="Table Manager"
          description="Manage the floor plan — click a table to edit, or use Select Multiple for bulk actions."
          action={
            <div className="flex items-center gap-2 flex-wrap">
              <Button size="sm" variant="secondary" onClick={() => void handleDownloadPdf()} disabled={isGeneratingPdf || tables.length === 0} className="flex items-center gap-1.5">
                <FileDown className="w-3.5 h-3.5" />{isGeneratingPdf ? 'Generating…' : 'QR PDF'}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => void handlePrint()} disabled={isPrinting || tables.length === 0} className="flex items-center gap-1.5">
                <Printer className="w-3.5 h-3.5" />{isPrinting ? 'Preparing…' : 'Print QRs'}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => void loadAll()} className="flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5" />Refresh
              </Button>
              {mode === 'normal' ? (
                <Button size="sm" variant="secondary" onClick={enterMultiMode} className="flex items-center gap-1.5">
                  <CheckCheck className="w-3.5 h-3.5" />Select Multiple
                </Button>
              ) : null}
              <Button size="sm" variant="primary" onClick={() => setShowAddModal(true)} className="flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" />Add Tables
              </Button>
            </div>
          }
        />

        {/* Table Alerts (Assistance & Bill Out) */}
        <TableAlertsBanner
          tables={tables}
          billRequests={billRequests}
          onClearAssistance={handleClearAssistance}
          onClearBillOut={handleClearBillOut}
        />
      </div>

      {/* Split layout */}
      <div className="tm-layout">
        {/* Grid area */}
        <div className="tm-grid-area">
          {/* Multi-select toolbar */}
          {mode === 'multi' && (
            <div className="tm-multiselect-bar">
              <span className="tm-multiselect-label">
                {selectedIds.size} table{selectedIds.size !== 1 ? 's' : ''} selected
              </span>
              {selectedIds.size >= 2 && (
                <button className="tm-multiselect-btn tm-msbtn-merge" onClick={() => setShowMergeModal(true)}>
                  <GitMerge className="w-3 h-3" /> Merge
                </button>
              )}
              {selectedIds.size > 0 && (
                <button className="tm-multiselect-btn tm-msbtn-delete" onClick={() => setShowDeleteConfirm(true)}>
                  <Trash2 className="w-3 h-3" /> Delete
                </button>
              )}
              <button className="tm-multiselect-btn tm-msbtn-cancel" onClick={exitMultiMode}>
                <X className="w-3 h-3" /> Cancel
              </button>
            </div>
          )}

          {/* Floor plan */}
          {isLoading ? (
            <div className="tm-floor-grid">
              {Array.from({ length: 8 }).map((_, i) => <div key={i} className="tm-skeleton-card" />)}
            </div>
          ) : tables.length === 0 ? (
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
              {tables.map((table) => (
                <TableCard
                  key={table.TABLE_ID}
                  table={table}
                  allTables={tables}
                  mode={mode}
                  isActive={sidebarTableId === table.TABLE_ID}
                  isSelected={selectedIds.has(table.TABLE_ID)}
                  isMergedPrimary={mergeGroupMap.has(table.TABLE_ID)}
                  isMergedSecondary={table.MERGE_GROUP_ID !== null && table.MERGE_GROUP_ID !== undefined}
                  mergedWithNums={mergeGroupMap.get(table.TABLE_ID) ?? []}
                  summary={orderSummaries.get(table.TABLE_ID)}
                  onClick={() => handleCardClick(table)}
                  onQrClick={() => setQrModalTable(table)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <TableSidebar
          mode={mode}
          table={sidebarTable}
          selectedIds={selectedIds}
          allTables={tables}
          orderSummaries={orderSummaries}
          mergeGroupMap={mergeGroupMap}
          onClose={() => setSidebarTableId(null)}
          onEnterMultiMode={enterMultiMode}
          onExitMultiMode={exitMultiMode}
          onMergeSelected={() => setShowMergeModal(true)}
          onDeleteSelected={() => setShowDeleteConfirm(true)}
          onUnmerge={setUnmergeTarget}
          onTableUpdated={(row) => {
            setTables((prev) => prev.map((t) => t.TABLE_ID === row.TABLE_ID ? row : t))
            // If status changed, refresh summary
            if (OCCUPIED_STATUSES.includes(row.STATUS)) {
              void fetchOrderSummariesForIds([row.TABLE_ID]).then(s => {
                setOrderSummaries(prev => new Map([...prev, ...s]))
              })
            }
          }}
          onTablesPatched={(rows) => setTables((prev) => patchTables(prev, rows))}
          showToast={showToast}
        />
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

      {showMergeModal && (
        <MergeModal
          selectedIds={[...selectedIds]}
          allTables={tables}
          onClose={() => setShowMergeModal(false)}
          onMerged={handleMergeComplete}
          showToast={showToast}
          onStartMutating={() => { isMutatingRef.current = true }}
        />
      )}

      {unmergeTarget && (
        <UnmergeModal
          primaryTable={unmergeTarget}
          allTables={tables}
          onClose={() => setUnmergeTarget(null)}
          onUnmerged={handleUnmergeComplete}
          showToast={showToast}
          onStartMutating={() => { isMutatingRef.current = true }}
        />
      )}

      {showDeleteConfirm && (
        <ConfirmDialog
          title="Delete Tables?"
          description="Tables with active orders or in a merge group cannot be deleted."
          confirmLabel={`Delete ${deleteTargetIds.length} Table${deleteTargetIds.length !== 1 ? 's' : ''}`}
          confirmVariant="danger"
          loading={deleteLoading}
          onConfirm={() => void handleDelete()}
          onCancel={() => setShowDeleteConfirm(false)}
        >
          <div className="space-y-1">
            {deleteTargetTables.map((t) => {
              const summary = orderSummaries.get(t.TABLE_ID)
              const blocked = (summary?.activeOrderCount ?? 0) > 0 || t.MERGE_GROUP_ID !== null || mergeGroupMap.has(t.TABLE_ID)
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
