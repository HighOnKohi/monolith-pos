import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  AlertTriangle,
  RefreshCw,
  Download,
  Printer,
  CreditCard,
  Banknote,
  Smartphone,
  Users,
  Search,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Percent,
  Receipt,
  X,
  Loader2,
  Store,
  FileDown,
} from 'lucide-react'
import { exportBusinessDayPdf } from '../utils/businessDayPdf'
import { useBusinessDay } from '@/hooks/useBusinessDay'
import { useAuthContext } from '@/contexts/AuthContext'
import type {
  DailySummary,
  ActiveOrdersCheckResult,
  ActiveShiftsCheckResult,
} from '@/types/businessDay'

const money = (val: number) =>
  `₱${val.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function BusinessDayManagementTab() {
  const {
    activeBusinessDay,
    isOpen,
    loading: dayLoading,
    checkActiveOrders,
    checkActiveShifts,
    startDay,
    endDay,
    getSummary,
    refresh,
  } = useBusinessDay()
  const { user } = useAuthContext()

  const [summary, setSummary] = useState<DailySummary | null>(null)
  const [loadingSummary, setLoadingSummary] = useState(false)

  // Modals state
  const [showStartModal, setShowStartModal] = useState(false)
  const [showEndModal, setShowEndModal] = useState(false)
  const [isActionSubmitting, setIsActionSubmitting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  // Pre-flight checks state
  const [activeOrdersCheck, setActiveOrdersCheck] = useState<ActiveOrdersCheckResult | null>(null)
  const [activeShiftsCheck, setActiveShiftsCheck] = useState<ActiveShiftsCheckResult | null>(null)
  const [checkingPreflight, setCheckingPreflight] = useState(false)

  // Drill-down transaction filters
  const [search, setSearch] = useState('')
  const [staffFilter, setStaffFilter] = useState<string>('ALL')
  const [methodFilter, setMethodFilter] = useState<string>('ALL')

  // Load summary for active or latest day
  const loadSummary = useCallback(async () => {
    if (!activeBusinessDay) {
      setSummary(null)
      return
    }
    setLoadingSummary(true)
    try {
      const res = await getSummary(activeBusinessDay.businessDayId)
      setSummary(res)
    } catch (err) {
      console.warn('[BusinessDayManagementTab] Failed to load summary:', err)
    } finally {
      setLoadingSummary(false)
    }
  }, [activeBusinessDay, getSummary])

  useEffect(() => {
    void loadSummary()
  }, [loadSummary])

  // Open Start Day Modal & run preflight check
  const handleOpenStartModal = async () => {
    setActionError(null)
    setShowStartModal(true)
    setCheckingPreflight(true)
    try {
      const ordersRes = await checkActiveOrders()
      setActiveOrdersCheck(ordersRes)
    } catch {
      setActiveOrdersCheck(null)
    } finally {
      setCheckingPreflight(false)
    }
  }

  // Open End Day Modal & run preflight checks
  const handleOpenEndModal = async () => {
    setActionError(null)
    setShowEndModal(true)
    setCheckingPreflight(true)
    try {
      const [ordersRes, shiftsRes] = await Promise.all([
        checkActiveOrders(),
        checkActiveShifts(),
      ])
      setActiveOrdersCheck(ordersRes)
      setActiveShiftsCheck(shiftsRes)
    } catch {
      setActiveOrdersCheck(null)
      setActiveShiftsCheck(null)
    } finally {
      setCheckingPreflight(false)
    }
  }

  // Confirm Start Day
  const handleConfirmStartDay = async () => {
    setIsActionSubmitting(true)
    setActionError(null)
    try {
      const adminIdentity = user?.email || 'Administrator'
      await startDay(adminIdentity)
      setShowStartModal(false)
      await refresh()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start business day.'
      setActionError(msg)
    } finally {
      setIsActionSubmitting(false)
    }
  }

  // Confirm End Day
  const handleConfirmEndDay = async () => {
    setIsActionSubmitting(true)
    setActionError(null)
    try {
      const adminIdentity = user?.email || 'Administrator'
      await endDay(adminIdentity)
      setShowEndModal(false)
      await refresh()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to end business day.'
      setActionError(msg)
    } finally {
      setIsActionSubmitting(false)
    }
  }

  // Filtered transactions drill-down
  const filteredTransactions = useMemo(() => {
    if (!summary?.transactionsList) return []
    return summary.transactionsList.filter((tx) => {
      const matchSearch =
        search.trim().length === 0 ||
        tx.tableLabel.toLowerCase().includes(search.toLowerCase()) ||
        tx.cashierName.toLowerCase().includes(search.toLowerCase()) ||
        String(tx.orderId).includes(search)
      const matchStaff =
        staffFilter === 'ALL' || String(tx.staffId) === staffFilter
      const matchMethod =
        methodFilter === 'ALL' || tx.paymentMethod.toUpperCase() === methodFilter.toUpperCase()
      return matchSearch && matchStaff && matchMethod
    })
  }, [summary?.transactionsList, search, staffFilter, methodFilter])

  // Export Daily Summary CSV
  const handleExportCsv = () => {
    if (!summary) return
    const headers = ['Order ID', 'Time', 'Table', 'Staff ID', 'Cashier', 'Shift ID', 'Payment Method', 'Discount', 'Total Amount']
    const rows = (summary.transactionsList || []).map((t) => [
      t.orderId,
      t.time,
      t.tableLabel,
      t.staffId ?? '',
      `"${t.cashierName}"`,
      t.shiftId ?? '',
      t.paymentMethod,
      t.discount,
      t.amount,
    ])
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `daily-summary-${summary.businessDay.businessDate}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  // Export Daily Summary PDF
  const handleExportPdf = () => {
    if (!summary) return
    exportBusinessDayPdf(summary)
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="space-y-6">
      {/* ── 1. Operational Controls Banner ── */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-start sm:items-center gap-4">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white shrink-0 shadow-sm ${
                isOpen ? 'bg-emerald-600' : 'bg-slate-700'
              }`}
            >
              <Store className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black tracking-wide uppercase ${
                    isOpen
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-slate-100 text-slate-700 border border-slate-200'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isOpen ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                    }`}
                  />
                  <span>{isOpen ? 'Business Day Open' : 'Business Day Closed'}</span>
                </span>

                {activeBusinessDay && (
                  <span className="text-xs font-bold text-slate-400">
                    Day #{activeBusinessDay.businessDayId} •{' '}
                    {new Date(activeBusinessDay.businessDate).toLocaleDateString([], {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-500 font-semibold leading-relaxed max-w-xl">
                {isOpen
                  ? `Active operational day started on ${new Date(
                      activeBusinessDay?.startedAt || '',
                    ).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} by ${
                      activeBusinessDay?.startedBy || 'Admin'
                    }. POS terminals are currently authorized to process transactions.`
                  : 'The operational day is closed. POS counter registers and customer ordering are locked from accepting new transactions.'}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-start lg:self-auto">
            <button
              type="button"
              onClick={() => void loadSummary()}
              disabled={loadingSummary || dayLoading}
              className="px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingSummary ? 'animate-spin text-blue-600' : ''}`} />
              <span>Refresh</span>
            </button>

            {summary && (
              <>
                <button
                  type="button"
                  onClick={handleExportPdf}
                  title="Export structured PDF report"
                  className="px-3.5 py-2 bg-[#14274E] hover:bg-[#1f3b73] active:bg-[#0f1d3b] text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <FileDown className="w-3.5 h-3.5 text-[#E9C46A]" />
                  <span>Save as PDF</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-600" />
                  <span>CSV</span>
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-blue-600" />
                  <span>Print Report</span>
                </button>
              </>
            )}

            {isOpen ? (
              <button
                type="button"
                onClick={() => void handleOpenEndModal()}
                disabled={dayLoading}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl text-xs font-black tracking-wide transition-all shadow-md shadow-rose-600/20 flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <XCircle className="w-4 h-4" />
                <span>End Business Day</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handleOpenStartModal()}
                disabled={dayLoading}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-black tracking-wide transition-all shadow-md shadow-emerald-600/20 flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Start Business Day</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── 2. Daily Summary KPIs ── */}
      {summary ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Gross Revenue */}
            <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">
                  Total Gross Revenue
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
                  Transactions
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

            {/* Customers Served */}
            <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">
                  Customers Served
                </span>
                <div className="p-2 rounded-xl bg-purple-50 text-purple-700 border border-purple-100">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <p className="text-xl sm:text-2xl font-black text-[#14274E] mt-2">
                {summary.customersServed}
              </p>
              <div className="text-[11px] font-bold text-slate-400 mt-1">
                Avg: {money(summary.averageSpendPerCustomer)} / guest
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

          {/* ── 3. Payment Methods Breakdown ── */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <h3 className="text-sm font-black text-[#14274E]">Daily Payment Methods Breakdown</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {summary.paymentBreakdown.length === 0 ? (
                <div className="col-span-3 text-center py-6 text-xs text-slate-400 font-semibold">
                  No payment transactions recorded for this business day yet.
                </div>
              ) : (
                summary.paymentBreakdown.map((pm) => {
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
                        {pm.percentage.toFixed(1)}% of sales
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* ── 4. Per-Cashier Performance Breakdown ── */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-[#14274E]">Cashier Performance Breakdown</h3>
                <p className="text-xs text-slate-400 font-semibold">
                  Attribution of orders, customer covers, and settled sales per cashier staff member.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-black uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4">Cashier</th>
                    <th className="py-3 px-4">Staff ID</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Transactions</th>
                    <th className="py-3 px-4">Guests</th>
                    <th className="py-3 px-4">Discounts</th>
                    <th className="py-3 px-4">Voids</th>
                    <th className="py-3 px-4 text-right">Total Sales</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {summary.cashierPerformance.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400 font-semibold">
                        No cashier shifts recorded for this day yet.
                      </td>
                    </tr>
                  ) : (
                    summary.cashierPerformance.map((c) => (
                      <tr key={c.staffId} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 font-black text-[#14274E]">{c.staffName}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 font-bold text-slate-700">
                            #{c.staffId}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 uppercase">
                            {c.staffRole}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-800">{c.transactionsCount}</td>
                        <td className="py-3 px-4 font-bold text-slate-600">{c.customersServed}</td>
                        <td className="py-3 px-4 text-amber-800 font-semibold">{money(c.discountsTotal)}</td>
                        <td className="py-3 px-4">
                          {c.voidsCount > 0 ? (
                            <span className="text-rose-600 font-bold">{c.voidsCount}</span>
                          ) : (
                            <span className="text-slate-300">0</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-black text-emerald-700 text-sm">
                          {money(c.totalSales)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── 5. Drill-Down Transactions List ── */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-[#14274E]">Day Transactions Drill-Down</h3>
                <p className="text-xs text-slate-400 font-semibold">
                  Individual settled orders tagged with cashier, shift, and payment details.
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
                  value={staffFilter}
                  onChange={(e) => setStaffFilter(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-hidden cursor-pointer"
                >
                  <option value="ALL">All Cashiers</option>
                  {summary.cashierPerformance.map((c) => (
                    <option key={c.staffId} value={String(c.staffId)}>
                      {c.staffName} (#{c.staffId})
                    </option>
                  ))}
                </select>

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
                    <th className="py-3 px-4">Order ID</th>
                    <th className="py-3 px-4">Table</th>
                    <th className="py-3 px-4">Cashier</th>
                    <th className="py-3 px-4">Payment Method</th>
                    <th className="py-3 px-4">Discount</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400 font-semibold">
                        No transactions found matching the filters.
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((tx) => (
                      <tr key={tx.orderId} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-500 whitespace-nowrap">
                          {new Date(tx.time).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="py-3 px-4 font-bold text-[#14274E]">#{tx.orderId}</td>
                        <td className="py-3 px-4 font-semibold text-slate-700">{tx.tableLabel}</td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-800">{tx.cashierName}</span>
                          {tx.staffId && (
                            <span className="text-[10px] text-slate-400 ml-1">
                              (ID: {tx.staffId})
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 font-bold text-slate-700">
                            {tx.paymentMethod}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-amber-800 font-semibold">
                          {tx.discount > 0 ? money(tx.discount) : '—'}
                        </td>
                        <td className="py-3 px-4 text-right font-black text-slate-900">
                          {money(tx.amount)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-12 border border-slate-200 text-center space-y-3">
          <Store className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-base font-black text-[#14274E]">No Active Business Day Data</h3>
          <p className="text-xs text-slate-500 font-semibold max-w-sm mx-auto">
            Please start a business day using the action button above to allow POS operations and view the daily summary.
          </p>
        </div>
      )}

      {/* ── Start Business Day Modal ── */}
      {showStartModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fade-in"
          onClick={() => !isActionSubmitting && setShowStartModal(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 bg-[#14274E] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-white/10">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-sm font-black tracking-tight">Start Business Day</h3>
                  <p className="text-[11px] text-slate-300 font-semibold">Authorize POS Operations</p>
                </div>
              </div>
              <button
                type="button"
                disabled={isActionSubmitting}
                onClick={() => setShowStartModal(false)}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {actionError && (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold leading-snug">
                  {actionError}
                </div>
              )}

              {/* Preflight Checking */}
              {checkingPreflight ? (
                <div className="py-6 text-center text-slate-400 text-xs font-bold flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  <span>Checking database for unresolved active orders...</span>
                </div>
              ) : activeOrdersCheck?.hasActiveOrders ? (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 space-y-2">
                  <div className="flex items-center gap-2 text-rose-700 font-black text-xs">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Cannot Start Business Day: Active Orders Exist</span>
                  </div>
                  <p className="text-[11px] font-semibold text-rose-800 leading-snug">
                    There are <strong>{activeOrdersCheck.count} active orders</strong> currently in the restaurant queue. All active orders must be completed or cancelled before opening a new business day.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 text-xs text-slate-600 font-medium">
                  <p>
                    Are you sure you want to open the business day for{' '}
                    <strong className="text-[#14274E] font-black">
                      {new Date().toLocaleDateString([], {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </strong>
                    ?
                  </p>
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-bold">Authorized By:</span>
                      <span className="font-extrabold text-slate-800">{user?.email || 'Administrator'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-bold">POS Interface:</span>
                      <span className="font-extrabold text-emerald-700">Will be unlocked immediately</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isActionSubmitting}
                onClick={() => setShowStartModal(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isActionSubmitting || checkingPreflight || Boolean(activeOrdersCheck?.hasActiveOrders)}
                onClick={() => void handleConfirmStartDay()}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-black transition-all flex items-center gap-2 shadow-sm shadow-emerald-600/30 cursor-pointer disabled:opacity-50"
              >
                {isActionSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Opening Day...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Confirm Start Day</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── End Business Day Modal ── */}
      {showEndModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fade-in"
          onClick={() => !isActionSubmitting && setShowEndModal(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 bg-[#14274E] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-rose-500/20 text-rose-300">
                  <XCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black tracking-tight">End Business Day</h3>
                  <p className="text-[11px] text-slate-300 font-semibold">Reconcile &amp; Lock Operations</p>
                </div>
              </div>
              <button
                type="button"
                disabled={isActionSubmitting}
                onClick={() => setShowEndModal(false)}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {actionError && (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold leading-snug">
                  {actionError}
                </div>
              )}

              {/* Preflight Checks */}
              {checkingPreflight ? (
                <div className="py-6 text-center text-slate-400 text-xs font-bold flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-rose-600" />
                  <span>Verifying active orders and staff shifts...</span>
                </div>
              ) : activeOrdersCheck?.hasActiveOrders ? (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 space-y-2">
                  <div className="flex items-center gap-2 text-rose-700 font-black text-xs">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Cannot End Day: Active Orders Exist</span>
                  </div>
                  <p className="text-[11px] font-semibold text-rose-800 leading-snug">
                    There are <strong>{activeOrdersCheck.count} active order(s)</strong> still in progress. Please complete or cancel all orders before concluding the day.
                  </p>
                </div>
              ) : activeShiftsCheck?.hasActiveShifts ? (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-2">
                  <div className="flex items-center gap-2 text-amber-800 font-black text-xs">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Cannot End Day: Active Staff Shifts</span>
                  </div>
                  <p className="text-[11px] font-semibold text-amber-900 leading-snug">
                    The following staff shifts are still active:
                  </p>
                  <ul className="text-[11px] font-bold text-amber-800 list-disc list-inside space-y-0.5">
                    {activeShiftsCheck.cashierShifts.map((cs) => (
                      <li key={cs.shiftId}>
                        Cashier: {cs.staffName || `Staff #${cs.staffId}`} (Shift #{cs.shiftId})
                      </li>
                    ))}
                    {activeShiftsCheck.serviceShifts.map((ss) => (
                      <li key={ss.shiftId}>
                        Floor Staff: {ss.staffName || `Staff #${ss.staffId}`} (Shift #{ss.shiftId})
                      </li>
                    ))}
                  </ul>
                  <p className="text-[10px] text-amber-700 italic">
                    All staff shifts must be concluded first to reconcile individual cash drawers.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 text-xs text-slate-600 font-medium">
                  <p>
                    Are you sure you want to conclude Business Day #{activeBusinessDay?.businessDayId}?
                  </p>
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-bold">Total Sales:</span>
                      <span className="font-extrabold text-[#14274E]">{money(summary?.grossRevenue || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-bold">Total Transactions:</span>
                      <span className="font-extrabold text-slate-800">{summary?.completedOrdersCount || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-bold">Customers Served:</span>
                      <span className="font-extrabold text-slate-800">{summary?.customersServed || 0}</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-amber-800 font-semibold bg-amber-50 p-3 rounded-xl border border-amber-200/70">
                    Notice: Ending the business day locks POS terminals from taking new transactions. The daily summary will remain viewable in historical reports.
                  </p>
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isActionSubmitting}
                onClick={() => setShowEndModal(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  isActionSubmitting ||
                  checkingPreflight ||
                  Boolean(activeOrdersCheck?.hasActiveOrders) ||
                  Boolean(activeShiftsCheck?.hasActiveShifts)
                }
                onClick={() => void handleConfirmEndDay()}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-black transition-all flex items-center gap-2 shadow-sm shadow-rose-600/30 cursor-pointer disabled:opacity-50"
              >
                {isActionSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Concluding Day...</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Confirm End Day</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
