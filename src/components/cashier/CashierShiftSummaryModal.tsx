import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  Layers,
  Receipt,
  DollarSign,
  CheckCircle2,
  Percent,
  Clock,
  Search,
  ChevronDown,
  ChevronRight,
  Printer,
  Download,
  X,
  Loader2,
} from 'lucide-react'
import type { CashierShift } from '@/types/cashierShift'
import {
  getCashierRevampedShiftSummary,
  type CashierShiftRevampedSummary,
  type CashierShiftTableItem,
  type CashierShiftPaymentItem,
  type CashierShiftBilledOrder,
} from '@/services/cashierShiftService'

interface CashierShiftSummaryModalProps {
  isOpen: boolean
  onClose: () => void
  shift: CashierShift | null
}

type ViewMode = 'tables' | 'payments'

function money(amount: number): string {
  return `₱${amount.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function formatShiftTime(dateStr?: string): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function getDurationText(startedAt?: string, endedAt?: string | null, fallbackDuration?: string): string {
  if (fallbackDuration) return fallbackDuration
  if (!startedAt) return '—'
  const startMs = new Date(startedAt).getTime()
  if (isNaN(startMs)) return '—'
  const endMs = endedAt ? new Date(endedAt).getTime() : Date.now()
  const diffSec = Math.max(0, Math.floor((endMs - startMs) / 1000))
  const hrs = Math.floor(diffSec / 3600)
  const mins = Math.floor((diffSec % 3600) / 60)
  if (hrs === 0 && mins === 0) return 'Just started'
  if (hrs === 0) return `${mins}m`
  return `${hrs}h ${mins}m`
}

export function CashierShiftSummaryModal({
  isOpen,
  onClose,
  shift,
}: CashierShiftSummaryModalProps) {
  const [mounted, setMounted] = useState(false)
  const [mode, setMode] = useState<ViewMode>('tables')
  const [searchQuery, setSearchQuery] = useState('')
  const [details, setDetails] = useState<CashierShiftRevampedSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set())

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!isOpen || !shift) return
    let active = true
    setLoading(true)

    getCashierRevampedShiftSummary(shift)
      .then((data) => {
        if (active) setDetails(data)
      })
      .catch((err) => {
        console.warn('[CashierShiftSummaryModal] Failed to load shift summary:', err)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [isOpen, shift])

  const filteredTables = useMemo(() => {
    if (!details?.tables) return []
    const q = searchQuery.trim().toLowerCase()
    if (!q) return details.tables

    return details.tables.filter((tbl: CashierShiftTableItem) => {
      if (tbl.tableDisplay.toLowerCase().includes(q)) return true
      if (tbl.invoiceIds.some((id: number) => String(id).includes(q))) return true
      if (tbl.receiptIds.some((id: number) => String(id).includes(q))) return true
      if (tbl.orders.some((o: CashierShiftBilledOrder) => String(o.orderId).includes(q))) return true
      return tbl.orders.some((o: CashierShiftBilledOrder) =>
        o.items.some((it: { name: string; quantity: number }) => it.name.toLowerCase().includes(q)),
      )
    })
  }, [details?.tables, searchQuery])

  const filteredPayments = useMemo(() => {
    if (!details?.payments) return []
    const q = searchQuery.trim().toLowerCase()
    if (!q) return details.payments

    return details.payments.filter((pm: CashierShiftPaymentItem) => {
      if (String(pm.receiptId).includes(q)) return true
      if (String(pm.invoiceId).includes(q)) return true
      if (pm.tableDisplay.toLowerCase().includes(q)) return true
      if (pm.paymentType.toLowerCase().includes(q)) return true
      return false
    })
  }, [details?.payments, searchQuery])

  useEffect(() => {
    if (searchQuery.trim().length > 0 && details?.tables) {
      const allIds = new Set<string>(details.tables.map((t: CashierShiftTableItem) => t.tableKey))
      setExpandedTables(allIds)
    }
  }, [searchQuery, details?.tables])

  if (!isOpen || !shift) return null

  const toggleTableExpand = (tableKey: string) => {
    setExpandedTables((prev) => {
      const next = new Set(prev)
      if (next.has(tableKey)) next.delete(tableKey)
      else next.add(tableKey)
      return next
    })
  }

  const durationText = getDurationText(shift.startedAt, shift.endedAt)

  const handlePrintSummary = () => {
    window.print()
  }

  const handleExportPDF = async () => {
    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF()

      doc.setFontSize(16)
      doc.text('Shift Summary (Cashier)', 14, 20)
      doc.setFontSize(10)
      doc.text(`Duration: ${durationText}`, 14, 28)
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 34)

      doc.line(14, 38, 196, 38)
      doc.setFontSize(12)
      doc.text('Summary Metrics:', 14, 46)
      doc.setFontSize(10)

      const gross = details?.metrics.grossRevenue ?? shift.totalEarning ?? 0
      const settled = details?.metrics.completedOrdersCount ?? 0
      const tablesHandled = details?.tables.length ?? 0
      const discounts = details?.metrics.totalDiscounts ?? 0

      doc.text(`Gross Sales: ${money(gross)}`, 14, 54)
      doc.text(`Orders Settled: ${settled}`, 14, 60)
      doc.text(`Tables Handled: ${tablesHandled}`, 14, 66)
      doc.text(`Discounts Applied: ${money(discounts)}`, 14, 72)

      doc.line(14, 78, 196, 78)
      doc.setFontSize(12)
      doc.text('Issued Payments (Chronological):', 14, 86)
      doc.setFontSize(9)

      let yPos = 94
      ;(details?.payments || []).slice(0, 30).forEach((pm: CashierShiftPaymentItem) => {
        if (yPos > 270) {
          doc.addPage()
          yPos = 20
        }
        doc.text(
          `${pm.timeFormatted} | REC #${pm.receiptId} / INV #${pm.invoiceId} | ${pm.tableDisplay} | ${pm.paymentType} | ${money(pm.netTotal)}`,
          14,
          yPos,
        )
        yPos += 6
      })

      doc.save(`cashier-shift-summary-${shift.shiftId || shift.staffId}.pdf`)
    } catch (err) {
      console.warn('[CashierShiftSummaryModal] PDF export warning:', err)
      window.print()
    }
  }

  const grossSalesAmount = details?.metrics.grossRevenue ?? shift.totalEarning ?? 0
  const ordersSettledCount = details?.metrics.completedOrdersCount ?? 0
  const tablesHandledCount = details?.tables.length ?? 0
  const discountsAppliedAmount = details?.metrics.totalDiscounts ?? 0

  const modalContent = (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-5"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[92%] flex flex-col bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Top Header Bar ── */}
        <div className="px-6 py-4.5 bg-[#14274E] text-white flex items-center justify-between gap-3 shrink-0">
          <div>
            <h2 className="text-lg sm:text-xl font-black tracking-tight text-white">Shift Summary</h2>
            <p className="text-xs text-slate-300 font-medium mt-0.5">
              Duration: {durationText}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Scrollable Body ── */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* 1. Summary Cards (Staff-Manager Style: 4 cards) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Gross Sales */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 shadow-2xs space-y-1 transition-all">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Gross Sales
                </span>
                <div className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
                  <DollarSign className="w-3.5 h-3.5" />
                </div>
              </div>
              <div>
                <span className="text-2xl font-black text-emerald-700">
                  {loading ? '—' : money(grossSalesAmount)}
                </span>
              </div>
            </div>

            {/* Orders Settled */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 shadow-2xs space-y-1 transition-all">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Orders Settled
                </span>
                <div className="w-6 h-6 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
              </div>
              <div>
                <span className="text-2xl font-black text-[#14274E]">
                  {loading ? '—' : ordersSettledCount}
                </span>
              </div>
            </div>

            {/* Tables Handled */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 shadow-2xs space-y-1 transition-all">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Tables Handled
                </span>
                <div className="w-6 h-6 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700">
                  <Layers className="w-3.5 h-3.5" />
                </div>
              </div>
              <div>
                <span className="text-2xl font-black text-[#14274E]">
                  {loading ? '—' : tablesHandledCount}
                </span>
              </div>
            </div>

            {/* Discounts Applied */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 shadow-2xs space-y-1 transition-all">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Discounts Applied
                </span>
                <div className="w-6 h-6 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700">
                  <Percent className="w-3.5 h-3.5" />
                </div>
              </div>
              <div>
                <span className="text-2xl font-black text-amber-700">
                  {loading ? '—' : money(discountsAppliedAmount)}
                </span>
              </div>
            </div>
          </div>

          {/* 2. Controls Row: Mode Selector Tabs (Table / Payments) + Search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200/80 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setMode('tables')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                  mode === 'tables'
                    ? 'bg-[#14274E] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Table</span>
                <span
                  className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                    mode === 'tables' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {details?.tables.length ?? 0}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setMode('payments')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                  mode === 'payments'
                    ? 'bg-[#14274E] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>Payments</span>
                <span
                  className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                    mode === 'payments' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {details?.payments.length ?? 0}
                </span>
              </button>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  mode === 'tables'
                    ? 'Search table, order, invoice...'
                    : 'Search receipt, invoice, table...'
                }
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 placeholder:text-slate-400 outline-hidden focus:bg-white focus:border-[#14274E]"
              />
            </div>
          </div>

          {/* 3. List Content: Mode 'tables' */}
          {mode === 'tables' && (
            <div className="space-y-2.5">
              {loading && !details ? (
                <div className="py-12 flex items-center justify-center text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin text-[#14274E]" />
                </div>
              ) : filteredTables.length === 0 ? (
                <div className="py-10 text-center text-slate-400 bg-slate-50/70 rounded-xl border border-dashed border-slate-200 p-6 space-y-1">
                  <Layers className="w-6 h-6 mx-auto text-slate-300" />
                  <p className="text-xs font-bold text-slate-600">No tables billed out yet</p>
                  <p className="text-[11px] text-slate-400">
                    Tables will appear here once orders are billed out.
                  </p>
                </div>
              ) : (
                filteredTables.map((tbl: CashierShiftTableItem) => {
                  const isExpanded = expandedTables.has(tbl.tableKey)
                  return (
                    <div
                      key={tbl.tableKey}
                      className="rounded-xl border border-slate-200/90 bg-white overflow-hidden shadow-2xs transition-all"
                    >
                      {/* Table Card Header (Clickable Accordion) */}
                      <div
                        onClick={() => toggleTableExpand(tbl.tableKey)}
                        className="px-4 py-3 bg-slate-50/80 hover:bg-slate-100/80 flex items-center justify-between gap-3 cursor-pointer select-none transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-black text-sm text-[#14274E]">
                                {tbl.tableDisplay}
                              </h4>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                                {tbl.ordersCount} order{tbl.ordersCount !== 1 ? 's' : ''} billed
                              </span>
                              {tbl.paymentMethods.map((m: string) => (
                                <span
                                  key={m}
                                  className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200"
                                >
                                  {m}
                                </span>
                              ))}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-400 font-semibold mt-0.5 flex-wrap">
                              {tbl.invoiceIds.length > 0 && (
                                <span>
                                  Invoice: {tbl.invoiceIds.map((id: number) => `INV-${id}`).join(', ')}
                                </span>
                              )}
                              {tbl.receiptIds.length > 0 && (
                                <>
                                  <span>•</span>
                                  <span>
                                    Receipt: {tbl.receiptIds.map((id: number) => `REC-${id}`).join(', ')}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <span className="text-sm font-black text-emerald-700 block">
                              {money(tbl.totalBilled)}
                            </span>
                            {tbl.totalDiscounts > 0 && (
                              <span className="text-[10px] font-bold text-amber-700">
                                Disc: -{money(tbl.totalDiscounts)}
                              </span>
                            )}
                          </div>
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-slate-600" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                      </div>

                      {/* Expanded Orders under this Table */}
                      {isExpanded && (
                        <div className="p-3 space-y-2 bg-slate-50/30 border-t border-slate-100">
                          {tbl.orders.map((ord: CashierShiftBilledOrder) => (
                            <div
                              key={ord.orderId}
                              className="p-2.5 bg-white rounded-lg border border-slate-200/80 space-y-1.5 shadow-2xs"
                            >
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-black text-xs text-[#14274E] px-2 py-0.5 rounded-md bg-slate-100">
                                    #{ord.orderId}
                                  </span>
                                  <span className="text-xs text-slate-400 flex items-center gap-1 font-semibold">
                                    <Clock className="w-3 h-3" />
                                    {formatShiftTime(ord.completedAt)}
                                  </span>
                                  <span className="px-1.5 py-0.2 rounded text-[10px] font-black uppercase bg-slate-100 text-slate-600 border border-slate-200">
                                    {ord.paymentMethod}
                                  </span>
                                </div>

                                <div className="text-right">
                                  <span className="text-xs font-black text-emerald-700">
                                    {money(ord.totalBill)}
                                  </span>
                                  {ord.discountAmount > 0 && (
                                    <span className="text-[10px] font-bold text-amber-700 block">
                                      Disc: -{money(ord.discountAmount)}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Items list */}
                              {ord.items.length > 0 && (
                                <div className="pt-1 border-t border-slate-100 flex flex-wrap items-center gap-1 text-xs text-slate-600">
                                  {ord.items.map((it: { name: string; quantity: number }, idx: number) => (
                                    <span
                                      key={idx}
                                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-50 border border-slate-200 text-[11px] font-semibold text-slate-700"
                                    >
                                      <span className="font-black text-[#14274E]">{it.quantity}x</span>
                                      <span>{it.name}</span>
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          )}

          {/* 3. List Content: Mode 'payments' (Hierarchied by time issued) */}
          {mode === 'payments' && (
            <div className="space-y-2.5">
              {loading && !details ? (
                <div className="py-12 flex items-center justify-center text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin text-[#14274E]" />
                </div>
              ) : filteredPayments.length === 0 ? (
                <div className="py-10 text-center text-slate-400 bg-slate-50/70 rounded-xl border border-dashed border-slate-200 p-6 space-y-1">
                  <Receipt className="w-6 h-6 mx-auto text-slate-300" />
                  <p className="text-xs font-bold text-slate-600">No payment receipts found</p>
                  <p className="text-[11px] text-slate-400">
                    Settled payments and receipts will appear here in chronological order.
                  </p>
                </div>
              ) : (
                filteredPayments.map((pm: CashierShiftPaymentItem) => (
                  <div
                    key={`${pm.receiptId}_${pm.invoiceId}`}
                    className="p-3 bg-white rounded-xl border border-slate-200/90 shadow-2xs hover:border-slate-300 transition-all space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Time issued hierarchy badge */}
                        <span className="font-mono font-bold text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {pm.timeFormatted}
                        </span>

                        <span className="font-black text-xs text-[#14274E]">
                          REC #{pm.receiptId}
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="font-semibold text-xs text-slate-500">
                          INV #{pm.invoiceId}
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="font-extrabold text-xs text-slate-700">
                          {pm.tableDisplay}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-slate-100 font-bold text-slate-600 text-[10px] border border-slate-200">
                          {pm.paymentType}
                        </span>
                        <span className="text-sm font-black text-emerald-700">
                          {money(pm.netTotal)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportPDF}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 active:scale-98 transition-all cursor-pointer shadow-2xs"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Export PDF</span>
            </button>
            <button
              type="button"
              onClick={handlePrintSummary}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 active:scale-98 transition-all cursor-pointer shadow-2xs"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span>Print</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-black bg-[#14274E] text-white hover:bg-[#1a3264] active:scale-98 transition-all cursor-pointer shadow-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )

  const portalTarget = mounted ? document.getElementById('cashier-interface-root') : null
  return portalTarget ? createPortal(modalContent, portalTarget) : modalContent
}
