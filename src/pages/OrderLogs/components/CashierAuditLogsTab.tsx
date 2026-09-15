import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Search,
  User,
  Clock,
  Filter,
  ShieldCheck,
  RefreshCw,
  Download,
  Info,
  ChevronRight,
  X,
  CreditCard,
  LogOut,
  LogIn,
  ShoppingBag,
  Trash2,
  Calendar,
  Store,
  AlertTriangle,
} from 'lucide-react'
import type { CashierAuditLog, CashierAuditAction } from '@/types/cashierShift'
import {
  fetchCashierAuditLogs,
  type CashierAuditFilterParams,
} from '@/services/cashierAuditService'
import { fetchStaffCodes } from '@/services/staffCodeService'
import type { StaffCodeItem } from '@/types/account'

const ACTION_COLOR_MAP: Record<string, { bg: string; text: string; border: string; icon: typeof Info }> = {
  BUSINESS_DAY_STARTED: { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-300', icon: Store },
  BUSINESS_DAY_END_ATTEMPTED: { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200', icon: Info },
  BUSINESS_DAY_END_BLOCKED: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-300', icon: AlertTriangle },
  BUSINESS_DAY_ENDED: { bg: 'bg-rose-50', text: 'text-rose-800', border: 'border-rose-300', icon: Store },
  SHIFT_STARTED: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', icon: LogIn },
  SHIFT_ENDED: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', icon: LogOut },
  SERVICE_SHIFT_STARTED: { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200', icon: LogIn },
  SERVICE_SHIFT_ENDED: { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200', icon: LogOut },
  PAYMENT_COMPLETED: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: CreditCard },
  PAYMENT_CREATED: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: CreditCard },
  PAYMENT_FAILED: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', icon: Info },
  PAYMENT_VOIDED: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', icon: Trash2 },
  ORDER_CREATED: { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200', icon: ShoppingBag },
  ORDER_UPDATED: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', icon: Info },
  ORDER_CANCELLED: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', icon: Trash2 },
  ORDER_DELETED: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', icon: Trash2 },
  TABLE_ASSIGNED: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', icon: Info },
  TABLE_MERGED: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', icon: Info },
  TABLE_UNMERGED: { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200', icon: Info },
  TABLE_CLEARED: { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200', icon: Info },
  TABLE_ASSISTANCE_CLEARED: { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200', icon: Info },
  TABLE_BILL_CLEARED: { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200', icon: Info },
  DISCOUNT_APPLIED: { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200', icon: Info },
  DISCOUNT_REMOVED: { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200', icon: Info },
  PRICE_ADJUSTED: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', icon: Info },
}

function getActionStyle(action: string) {
  return (
    ACTION_COLOR_MAP[action] || {
      bg: 'bg-slate-50',
      text: 'text-slate-700',
      border: 'border-slate-200',
      icon: Info,
    }
  )
}

function formatAuditTimestamp(isoString: string): { time: string; date: string } {
  try {
    const d = new Date(isoString)
    return {
      time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      date: d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }),
    }
  } catch {
    return { time: isoString, date: '' }
  }
}

export function CashierAuditLogsTab() {
  const [logs, setLogs] = useState<CashierAuditLog[]>([])
  const [staffList, setStaffList] = useState<StaffCodeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const pageSize = 20

  // Filters
  const [search, setSearch] = useState('')
  const [staffFilter, setStaffFilter] = useState<number | 'ALL'>('ALL')
  const [actionFilter, setActionFilter] = useState<CashierAuditAction | 'ALL'>('ALL')
  const [datePreset, setDatePreset] = useState<'all' | 'today' | 'last7days'>('all')

  // Selected Log Drawer
  const [selectedLog, setSelectedLog] = useState<CashierAuditLog | null>(null)

  // Load available staff codes
  useEffect(() => {
    void fetchStaffCodes({}, 1, 100).then((res) => {
      setStaffList(res.codes)
    })
  }, [])

  const dateRange = useMemo<{ startDate?: Date; endDate?: Date }>(() => {
    const now = new Date()
    if (datePreset === 'today') {
      const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
      const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
      return { startDate, endDate }
    }
    if (datePreset === 'last7days') {
      const startDate = new Date(now)
      startDate.setDate(startDate.getDate() - 6)
      startDate.setHours(0, 0, 0, 0)
      return { startDate, endDate: now }
    }
    return {}
  }, [datePreset])

  const loadLogs = useCallback(async () => {
    setLoading(true)
    try {
      const filters: CashierAuditFilterParams = {
        staffId: staffFilter,
        action: actionFilter,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        search,
      }
      const res = await fetchCashierAuditLogs(filters, page, pageSize)
      setLogs(res.logs)
      setTotalCount(res.totalCount)
      setTotalPages(res.totalPages)
    } catch (err) {
      console.error('[CashierAuditLogsTab] Failed to load audit logs:', err)
    } finally {
      setLoading(false)
    }
  }, [staffFilter, actionFilter, dateRange, search, page, pageSize])

  useEffect(() => {
    void loadLogs()
  }, [loadLogs])

  const handleExportCsv = () => {
    if (logs.length === 0) return
    const headers = ['Log ID', 'Timestamp', 'Staff ID', 'Staff Name', 'Shift ID', 'Auth User', 'Action', 'Entity', 'Description']
    const rows = logs.map((l) => [
      l.logId,
      l.createdAt,
      l.staffId ?? '',
      l.staffName ?? '',
      l.shiftId ?? '',
      l.authUserId ?? '',
      l.action,
      `${l.entityType || ''} ${l.entityId || ''}`.trim(),
      `"${(l.description || '').replace(/"/g, '""')}"`,
    ])
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `cashier-audit-logs-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const hasActiveFilters = search.trim().length > 0 || staffFilter !== 'ALL' || actionFilter !== 'ALL' || datePreset !== 'all'

  const handleClearFilters = () => {
    setSearch('')
    setStaffFilter('ALL')
    setActionFilter('ALL')
    setDatePreset('all')
    setPage(1)
  }

  return (
    <div className="space-y-4">
      {/* Header & Controls Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-50 text-[#14274E] border border-blue-100">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-black text-[#14274E]">Staff Operational Audit Trail</h2>
            <p className="text-xs text-slate-400 font-semibold">
              Immutable historical attribution of shifts (Cashier &amp; Service), payments, table actions, and orders.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void loadLogs()}
            disabled={loading}
            className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={logs.length === 0}
            className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              placeholder="Search audit trail..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 placeholder:text-slate-400 focus:bg-white focus:border-[#14274E] outline-hidden transition-all"
            />
          </div>

          {/* Staff Member Filter */}
          <div className="relative">
            <select
              value={String(staffFilter)}
              onChange={(e) => {
                setStaffFilter(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))
                setPage(1)
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:bg-white focus:border-[#14274E] outline-hidden transition-all cursor-pointer"
            >
              <option value="ALL">All Staff Members</option>
              {staffList.map((s) => (
                <option key={s.codeId} value={s.codeId}>
                  {s.codeId} — {s.staffName} ({s.staffRole})
                </option>
              ))}
            </select>
          </div>

          {/* Action Filter */}
          <div className="relative">
            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value as CashierAuditAction | 'ALL')
                setPage(1)
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:bg-white focus:border-[#14274E] outline-hidden transition-all cursor-pointer"
            >
              <option value="ALL">All Operations</option>
              <option value="BUSINESS_DAY_STARTED">Business Day Started</option>
              <option value="BUSINESS_DAY_ENDED">Business Day Ended</option>
              <option value="BUSINESS_DAY_END_BLOCKED">Business Day End Blocked</option>
              <option value="SHIFT_STARTED">Cashier Shift Started</option>
              <option value="SHIFT_ENDED">Cashier Shift Ended</option>
              <option value="SERVICE_SHIFT_STARTED">Service Shift Started</option>
              <option value="SERVICE_SHIFT_ENDED">Service Shift Ended</option>
              <option value="PAYMENT_COMPLETED">Payment Completed</option>
              <option value="ORDER_CREATED">Order Created</option>
              <option value="ORDER_CANCELLED">Order Cancelled</option>
              <option value="ORDER_DELETED">Order Deleted</option>
              <option value="TABLE_ASSISTANCE_CLEARED">Assistance Cleared</option>
              <option value="TABLE_BILL_CLEARED">Bill Request Cleared</option>
            </select>
          </div>

          {/* Date Filter */}
          <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200">
            {(['all', 'today', 'last7days'] as const).map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  setDatePreset(preset)
                  setPage(1)
                }}
                className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                  datePreset === preset ? 'bg-white text-[#14274E] shadow-2xs font-extrabold' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {preset === 'all' ? 'All Time' : preset === 'today' ? 'Today' : 'Last 7 Days'}
              </button>
            ))}
          </div>
        </div>

        {hasActiveFilters && (
          <div className="flex items-center justify-between pt-1 text-xs">
            <span className="text-slate-400 font-semibold">
              Showing filtered audit records ({totalCount} total)
            </span>
            <button
              type="button"
              onClick={handleClearFilters}
              className="text-xs font-bold text-rose-600 hover:text-rose-700 cursor-pointer"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>

      {/* Audit Logs Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-black uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Time &amp; Date</th>
                <th className="py-3 px-4">Cashier Staff</th>
                <th className="py-3 px-4">Shift ID</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Target Entity</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400 font-bold">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-500" />
                    <span>Loading audit records...</span>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400 font-semibold">
                    No cashier audit records found matching the active filters.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const style = getActionStyle(log.action)
                  const ActionIcon = style.icon
                  const ts = formatAuditTimestamp(log.createdAt)
                  return (
                    <tr
                      key={log.logId}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                      onClick={() => setSelectedLog(log)}
                    >
                      {/* Timestamp */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-extrabold text-[#14274E]">{ts.time}</div>
                        <div className="text-[10px] text-slate-400 font-medium">{ts.date}</div>
                      </td>

                      {/* Cashier Staff */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 font-black text-[10px]">
                            <User className="w-3 h-3" />
                          </div>
                          <div>
                            <div className="font-extrabold text-slate-800">
                              {log.staffName || (log.staffId ? `Staff #${log.staffId}` : 'System')}
                            </div>
                            {log.staffId && (
                              <div className="text-[10px] text-slate-400 font-semibold">
                                ID: {log.staffId} {log.staffRole ? `• ${log.staffRole}` : ''}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Shift ID */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {log.shiftId ? (
                          <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                            #{log.shiftId}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      {/* Action Badge */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black border ${style.bg} ${style.text} ${style.border}`}
                        >
                          <ActionIcon className="w-3 h-3" />
                          <span>{log.action}</span>
                        </span>
                      </td>

                      {/* Target Entity */}
                      <td className="py-3 px-4 whitespace-nowrap font-medium text-slate-600">
                        {log.entityType ? (
                          <span className="font-semibold text-slate-700">
                            {log.entityType} {log.entityId ? `#${log.entityId}` : ''}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      {/* Description */}
                      <td className="py-3 px-4 max-w-xs truncate text-slate-600 font-medium" title={log.description || ''}>
                        {log.description || '—'}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedLog(log)
                          }}
                          className="px-2.5 py-1 text-[11px] font-bold text-[#14274E] hover:bg-slate-100 rounded-lg transition-colors inline-flex items-center gap-1 cursor-pointer"
                        >
                          <span>Inspect</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-400 font-semibold">
              Page {page} of {totalPages} ({totalCount} records)
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg font-bold text-slate-700 disabled:opacity-40 cursor-pointer"
              >
                Prev
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg font-bold text-slate-700 disabled:opacity-40 cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Slide-over Inspection Drawer */}
      {selectedLog && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs animate-fade-in"
          onClick={() => setSelectedLog(null)}
        >
          <div
            className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-slide-left"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="p-6 bg-[#14274E] text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-white/10 border border-white/15">
                  <ShieldCheck className="w-5 h-5 text-[#E9C46A]" />
                </div>
                <div>
                  <h3 className="text-sm font-black tracking-tight">Audit Record #{selectedLog.logId}</h3>
                  <p className="text-[11px] text-slate-300 font-semibold">{selectedLog.action}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold">Timestamp:</span>
                  <span className="font-extrabold text-[#14274E]">{new Date(selectedLog.createdAt).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold">Cashier Staff:</span>
                  <span className="font-extrabold text-slate-800">
                    {selectedLog.staffName || 'N/A'} (ID: {selectedLog.staffId ?? '—'})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold">Staff Role:</span>
                  <span className="font-extrabold text-slate-800">{selectedLog.staffRole || 'CASHIER'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold">Cashier Shift ID:</span>
                  <span className="font-mono font-bold text-indigo-700">#{selectedLog.shiftId ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold">App Auth Account:</span>
                  <span className="font-mono text-[11px] text-slate-600 truncate max-w-[200px]">
                    {selectedLog.authUserId || 'Anonymous / Local'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold">Target:</span>
                  <span className="font-bold text-slate-800">
                    {selectedLog.entityType || '—'} {selectedLog.entityId ? `#${selectedLog.entityId}` : ''}
                  </span>
                </div>
              </div>

              {selectedLog.description && (
                <div>
                  <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-1.5">Description</h4>
                  <p className="text-xs font-bold text-[#14274E] bg-slate-50 p-3 rounded-xl border border-slate-200 leading-relaxed">
                    {selectedLog.description}
                  </p>
                </div>
              )}

              <div>
                <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-1.5">Context Metadata</h4>
                {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 ? (
                  <pre className="text-[11px] font-mono bg-slate-900 text-emerald-400 p-4 rounded-2xl overflow-x-auto border border-slate-800 shadow-inner">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                ) : (
                  <p className="text-xs text-slate-400 italic">No additional metadata attached.</p>
                )}
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-[#14274E] text-white rounded-xl text-xs font-black transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
