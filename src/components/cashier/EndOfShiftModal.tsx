import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  X,
  FileDown,
  Download,
  Printer,
  TrendingUp,
  Receipt,
  Users,
  Percent,
  Banknote,
  CreditCard,
  Smartphone,
  Search,
  LogOut,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Clock,
  User,
  ShieldCheck,
} from 'lucide-react'
import { useCashierSession } from '@/hooks/useCashierSession'
import type { CashierShiftSummary, ShiftPaymentBreakdown, ShiftTransactionRow } from '@/types/cashierShift'
import { exportCashierShiftPdf } from './cashierShiftPdf'

const money = (val: number) =>
  `PHP ${val.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function formatTime(isoString?: string | null): string {
  if (!isoString) return '—'
  try {
    const d = new Date(isoString)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return '—'
  }
}

export interface EndOfShiftModalProps {
  isOpen: boolean
  onClose: () => void
  /** If true, the modal opens directly in confirmation mode to end the shift */
  isEndShiftFlow?: boolean
  onShiftEnded?: () => void
}

export function EndOfShiftModal({
  isOpen,
  onClose,
  isEndShiftFlow = false,
  onShiftEnded,
}: EndOfShiftModalProps) {
  const { shift, staff, finalizeShift, clearSession, getShiftSummary } = useCashierSession()

  const [summary, setSummary] = useState<CashierShiftSummary | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [isEnding, setIsEnding] = useState<boolean>(false)
  const [isConcluded, setIsConcluded] = useState<boolean>(false)

  // Table filtering
  const [search, setSearch] = useState<string>('')
  const [methodFilter, setMethodFilter] = useState<string>('ALL')

  // Load live shift summary
  const loadSummary = useCallback(async () => {
    if (!shift) return
    setLoading(true)
    setError(null)
    try {
      const res = await getShiftSummary()
      if (res) {
        setSummary(res)
        if (res.shift.status === 'ENDED') {
          setIsConcluded(true)
        }
      }
    } catch (err) {
      console.error('[EndOfShiftModal] Failed to load shift summary:', err)
      setError('Could not calculate the shift summary. Please try refreshing.')
    } finally {
      setLoading(false)
    }
  }, [shift, getShiftSummary])

  useEffect(() => {
    if (isOpen) {
      setIsConcluded(shift?.status === 'ENDED')
      void loadSummary()
    } else {
      setSearch('')
      setMethodFilter('ALL')
      setError(null)
    }
  }, [isOpen, shift?.status, loadSummary])

  // Filtered transactions drill-down
  const filteredTransactions = useMemo(() => {
    if (!summary?.transactionsList) return []
    return summary.transactionsList.filter((tx: ShiftTransactionRow) => {
      const q = search.toLowerCase().trim()
      const matchSearch =
        !q ||
        String(tx.orderId).includes(q) ||
        (tx.tableLabel && tx.tableLabel.toLowerCase().includes(q))
      const matchMethod =
        methodFilter === 'ALL' ||
        tx.paymentMethod.toUpperCase().includes(methodFilter.toUpperCase())
      return matchSearch && matchMethod
    })
  }, [summary?.transactionsList, search, methodFilter])

  if (!isOpen || !shift) return null

  const cashierName = staff?.staffName || shift.staffName || `Staff #${shift.staffId}`
  const cashierRole = staff?.staffRole || shift.staffRole || 'CASHIER'
  const startTime = formatTime(shift.startedAt)
  const endTime = isConcluded ? formatTime(shift.endedAt || new Date().toISOString()) : 'In Progress'

  // Handle End Shift Confirmation
  const handleConfirmEndShift = async () => {
    if (!summary) return
    setIsEnding(true)
    try {
      await finalizeShift({
        totalEarning: summary.grossRevenue,
        totalTablesHandled: summary.tablesHandled,
      })
      setIsConcluded(true)
      // Re-fetch to get updated shift snapshot
      await loadSummary()
      onShiftEnded?.()
    } catch (err) {
      console.error('[EndOfShiftModal] Error finalizing shift:', err)
      setError('Failed to finalize shift. Please try again.')
    } finally {
      setIsEnding(false)
    }
  }

  // Handle Complete & Log Out
  const handleDoneAndLogout = () => {
    clearSession()
    onClose()
  }

  // PDF Export
  const handleExportPdf = () => {
    if (!summary) return
    exportCashierShiftPdf(summary)
  }

  // CSV Export
  const handleExportCsv = () => {
    if (!summary) return
    const headers = ['Order ID', 'Time', 'Table', 'Staff ID', 'Cashier', 'Payment Method', 'Discount', 'Total Amount']
    const rows = (summary.transactionsList || []).map((t) => [
      t.orderId,
      t.time,
      `"${t.tableLabel || ''}"`,
      t.staffId ?? '',
      `"${t.cashierName || cashierName}"`,
      t.paymentMethod,
      t.discount,
      t.amount,
    ])
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `cashier-shift-${shift.shiftId}-summary.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-5 animate-fade-in"
      onClick={() => !isEnding && !isConcluded && onClose()}
    >
      <div
        className="w-full max-w-5xl max-h-[92vh] flex flex-col bg-slate-50 rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Top Header Bar ── */}
        <div className="px-6 py-4 bg-[#14274E] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center text-[#E9C46A] shrink-0 font-black">
              {isConcluded ? <ShieldCheck className="w-5 h-5 text-emerald-400" /> : <Clock className="w-5 h-5 text-[#E9C46A]" />}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-black tracking-tight text-white">
                  {isConcluded ? 'Cashier Shift Concluded Summary' : 'End of Shift Summary'}
                </h2>
                <span className="px-2 py-0.5 rounded-md bg-[#E9C46A]/20 text-[#E9C46A] text-[10px] font-black tracking-wider uppercase border border-[#E9C46A]/30">
                  Shift #{shift.shiftId}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-black tracking-wider uppercase ${
                    isConcluded
                      ? 'bg-slate-700 text-slate-300 border border-slate-600'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}
                >
                  {isConcluded ? 'Shift Ended' : 'Shift Active'}
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-300 font-semibold mt-0.5 flex-wrap">
                <span className="flex items-center gap-1 text-white font-bold">
                  <User className="w-3.5 h-3.5 text-slate-300" />
                  {cashierName} (Staff #{shift.staffId} • {cashierRole})
                </span>
                <span className="text-slate-400">•</span>
                <span className="text-slate-300">
                  Operating Window: {startTime} – {endTime}
                </span>
                {summary?.durationMinutes != null && (
                  <span className="text-[#E9C46A] font-bold">
                    ({summary.durationMinutes} min{summary.durationMinutes !== 1 ? 's' : ''})
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            <button
              type="button"
              onClick={() => void loadSummary()}
              disabled={loading || isEnding}
              className="p-2 bg-white/10 hover:bg-white/15 text-white rounded-xl border border-white/10 transition-colors cursor-pointer disabled:opacity-50"
              title="Refresh Shift Summary"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#E9C46A]' : ''}`} />
            </button>

            {summary && (
              <>
                <button
                  type="button"
                  onClick={handleExportPdf}
                  title="Export structured PDF report"
                  className="px-3 py-1.5 bg-[#E9C46A] hover:bg-[#dfba5f] text-[#14274E] text-xs font-black rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <FileDown className="w-3.5 h-3.5 text-[#14274E]" />
                  <span className="hidden sm:inline">Save as</span> PDF
                </button>
                <button
                  type="button"
                  onClick={handleExportCsv}
                  title="Export CSV"
                  className="p-2 sm:px-3 sm:py-1.5 bg-white/10 hover:bg-white/15 text-white rounded-xl border border-white/10 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden sm:inline">CSV</span>
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  title="Print Report"
                  className="p-2 sm:px-3 sm:py-1.5 bg-white/10 hover:bg-white/15 text-white rounded-xl border border-white/10 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-sky-300" />
                  <span className="hidden sm:inline">Print</span>
                </button>
              </>
            )}

            {!isConcluded && (
              <button
                type="button"
                disabled={isEnding}
                onClick={onClose}
                className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer ml-1"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* ── Scrollable Body ── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Status Message / Notification */}
          {isConcluded ? (
            <div className="bg-emerald-50 border border-emerald-200/80 rounded-2xl p-4 flex items-start gap-3 shadow-2xs">
              <div className="p-2 rounded-xl bg-emerald-600 text-white shrink-0 mt-0.5">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-black text-emerald-950">Shift Successfully Concluded &amp; Logged</h4>
                <p className="text-xs text-emerald-800 font-semibold leading-relaxed">
                  Financial figures and order counts have been permanently reconciled to Monolith historical records.
                  You can download your structured PDF summary now, or click <strong>Done &amp; Log Out</strong> to return to the cashier staff login screen.
                </p>
              </div>
            </div>
          ) : isEndShiftFlow ? (
            <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-4 flex items-start gap-3 shadow-2xs">
              <div className="p-2 rounded-xl bg-amber-500 text-white shrink-0 mt-0.5">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-black text-amber-950">Review Shift Performance Before Ending</h4>
                <p className="text-xs text-amber-800 font-semibold leading-relaxed">
                  Please review the summary below. Clicking <strong>Confirm End Shift</strong> will finalize all earnings for{' '}
                  <strong className="text-amber-950">{cashierName}</strong>, mark this shift as concluded in the system, and prepare the final audit report.
                </p>
              </div>
            </div>
          ) : null}

          {/* Loading / Error States */}
          {loading && !summary && (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-[#14274E]" />
              <p className="text-xs font-bold text-slate-600">Reconciling shift orders and metrics...</p>
            </div>
          )}

          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-center justify-between text-xs font-bold text-rose-700">
              <span>{error}</span>
              <button
                type="button"
                onClick={() => void loadSummary()}
                className="px-3 py-1 bg-rose-600 text-white rounded-lg hover:bg-rose-700 cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}

          {summary && (
            <>
              {/* ── 1. KPI Cards (4 Cards, modeled after End of Day) ── */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {/* Gross Revenue */}
                <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">
                      Shift Gross Sales
                    </span>
                    <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                  </div>
                  <p className="text-xl sm:text-2xl font-black text-[#14274E] mt-2">
                    {money(summary.grossRevenue)}
                  </p>
                  <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 mt-1">
                    <span>Subtotal: {money(summary.subtotalRevenue)}</span>
                  </div>
                </div>

                {/* Total Transactions */}
                <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">
                      Completed Orders
                    </span>
                    <div className="p-2 rounded-xl bg-blue-50 text-blue-700 border border-blue-100">
                      <Receipt className="w-4 h-4" />
                    </div>
                  </div>
                  <p className="text-xl sm:text-2xl font-black text-[#14274E] mt-2">
                    {summary.completedOrdersCount}
                  </p>
                  <div className="text-[11px] font-bold text-slate-400 mt-1">
                    Avg: {money(summary.averageOrderValue)} / order
                  </div>
                </div>

                {/* Customers / Tables */}
                <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">
                      Customers &amp; Tables
                    </span>
                    <div className="p-2 rounded-xl bg-purple-50 text-purple-700 border border-purple-100">
                      <Users className="w-4 h-4" />
                    </div>
                  </div>
                  <p className="text-xl sm:text-2xl font-black text-[#14274E] mt-2">
                    {summary.customersServed}{' '}
                    <span className="text-xs font-bold text-slate-400">guests</span>
                  </p>
                  <div className="text-[11px] font-bold text-slate-400 mt-1">
                    {summary.tablesHandled} tables • Avg {money(summary.averageSpendPerCustomer)} / guest
                  </div>
                </div>

                {/* Adjustments & Discounts */}
                <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">
                      Discounts &amp; Voids
                    </span>
                    <div className="p-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-100">
                      <Percent className="w-4 h-4" />
                    </div>
                  </div>
                  <p className="text-xl sm:text-2xl font-black text-amber-900 mt-2">
                    {money(summary.totalDiscounts)}
                  </p>
                  <div className="text-[11px] font-bold text-slate-400 mt-1">
                    {summary.cancelledOrdersCount} voided / cancelled orders
                  </div>
                </div>
              </div>

              {/* ── 2. Payment Methods Breakdown ── */}
              <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-[#14274E]">Shift Payment Methods Breakdown</h3>
                  <span className="text-xs font-bold text-slate-400">
                    {summary.paymentBreakdown.reduce((acc, p) => acc + p.count, 0)} total payments settled
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {summary.paymentBreakdown.length === 0 ? (
                    <div className="col-span-full text-center py-6 text-xs text-slate-400 font-semibold">
                      No payment transactions recorded for this cashier shift yet.
                    </div>
                  ) : (
                    summary.paymentBreakdown.map((pm: ShiftPaymentBreakdown) => {
                      const isCash = pm.method.includes('CASH')
                      const isCard = pm.method.includes('CARD')
                      return (
                        <div
                          key={pm.method}
                          className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-2"
                        >
                          <div className="flex items-center justify-between text-xs font-black">
                            <span className="flex items-center gap-1.5 text-slate-700">
                              {isCash ? (
                                <Banknote className="w-4 h-4 text-emerald-600" />
                              ) : isCard ? (
                                <CreditCard className="w-4 h-4 text-blue-600" />
                              ) : (
                                <Smartphone className="w-4 h-4 text-purple-600" />
                              )}
                              {pm.method}
                            </span>
                            <span className="text-slate-500">{pm.count} tx</span>
                          </div>
                          <div className="text-lg font-black text-[#14274E]">{money(pm.total)}</div>
                          <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                isCash ? 'bg-emerald-500' : isCard ? 'bg-blue-500' : 'bg-purple-500'
                              }`}
                              style={{ width: `${Math.min(100, pm.percentage)}%` }}
                            />
                          </div>
                          <div className="text-[10px] font-bold text-slate-400 text-right">
                            {pm.percentage.toFixed(1)}% of shift sales
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              {/* ── 3. Shift Transactions Drill-Down ── */}
              <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-black text-[#14274E]">Shift Transactions Drill-Down</h3>
                    <p className="text-xs text-slate-400 font-semibold">
                      Settled orders processed during this shift window.
                    </p>
                  </div>

                  {/* Filters */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search table, order #..."
                        className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-hidden focus:bg-white focus:border-[#14274E]"
                      />
                    </div>

                    <select
                      value={methodFilter}
                      onChange={(e) => setMethodFilter(e.target.value)}
                      className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-hidden cursor-pointer"
                    >
                      <option value="ALL">All Methods</option>
                      <option value="CASH">Cash</option>
                      <option value="CARD">Card</option>
                      <option value="GCASH">GCash</option>
                      <option value="MAYA">Maya</option>
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-black uppercase text-[10px] tracking-wider">
                        <th className="py-3 px-4">Time</th>
                        <th className="py-3 px-4">Order #</th>
                        <th className="py-3 px-4">Table</th>
                        <th className="py-3 px-4">Cashier</th>
                        <th className="py-3 px-4">Payment Method</th>
                        <th className="py-3 px-4">Discount</th>
                        <th className="py-3 px-4 text-right">Total Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {filteredTransactions.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-400 font-semibold">
                            No shift transactions found matching the filter.
                          </td>
                        </tr>
                      ) : (
                        filteredTransactions.map((tx) => (
                          <tr key={tx.orderId} className="hover:bg-slate-50 transition-colors">
                            <td className="py-3 px-4 font-bold text-slate-500 whitespace-nowrap">
                              {formatTime(tx.time)}
                            </td>
                            <td className="py-3 px-4 font-extrabold text-[#14274E]">
                              #{tx.orderId}
                            </td>
                            <td className="py-3 px-4 font-bold text-slate-700">
                              {tx.tableLabel || 'Counter'}
                            </td>
                            <td className="py-3 px-4 text-slate-600">
                              {tx.cashierName || cashierName}
                            </td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 font-bold text-slate-700 text-[10px] border border-slate-200">
                                {tx.paymentMethod || 'CASH'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-500">
                              {tx.discount > 0 ? (
                                <span className="font-bold text-amber-700">
                                  {money(tx.discount)}
                                </span>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right font-black text-emerald-700">
                              {money(tx.amount)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Sticky Modal Footer ── */}
        <div className="px-6 py-4 bg-white border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-400 font-semibold flex items-center gap-1.5 self-start sm:self-auto">
            <Clock className="w-3.5 h-3.5" />
            <span>
              Shift active since {startTime} ({summary?.durationMinutes ?? 0} mins elapsed)
            </span>
          </div>

          <div className="flex items-center gap-2.5 self-end sm:self-auto">
            {isConcluded ? (
              <>
                <button
                  type="button"
                  onClick={handleExportPdf}
                  className="px-4 py-2.5 rounded-xl bg-[#14274E] hover:bg-[#1f3b73] text-white text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-xs active:scale-95"
                >
                  <FileDown className="w-4 h-4 text-[#E9C46A]" />
                  <span>Download Shift PDF</span>
                </button>
                <button
                  type="button"
                  onClick={handleDoneAndLogout}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-black transition-all flex items-center gap-2 shadow-sm shadow-emerald-600/30 cursor-pointer active:scale-95"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Done &amp; Log Out</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  disabled={isEnding}
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isEnding || loading || !summary}
                  onClick={() => void handleConfirmEndShift()}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-black transition-all flex items-center gap-2 shadow-sm shadow-rose-600/30 cursor-pointer disabled:opacity-50 active:scale-95"
                >
                  {isEnding ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Concluding Shift...</span>
                    </>
                  ) : (
                    <>
                      <LogOut className="w-4 h-4" />
                      <span>Confirm End Shift</span>
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
