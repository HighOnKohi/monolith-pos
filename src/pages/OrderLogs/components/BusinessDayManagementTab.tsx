import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  RefreshCw,
  Search,
  Store,
  Calendar,
  Clock,
  User,
  CheckCircle2,
  XCircle,
  Receipt,
  Download,
} from 'lucide-react'
import { fetchBusinessDayHistory } from '@/services/businessDayService'
import type { BusinessDay } from '@/types/businessDay'
import * as XLSX from 'xlsx'

const money = (val: number) =>
  `₱${val.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function BusinessDayManagementTab() {
  const [businessDays, setBusinessDays] = useState<BusinessDay[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'CLOSED'>('ALL')

  const loadHistory = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchBusinessDayHistory(1, 300)
      setBusinessDays(res.days || [])
    } catch (err) {
      console.warn('[BusinessDayManagementTab] Failed to load history:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadHistory()
  }, [loadHistory])

  // Filtered business days
  const filteredDays = useMemo(() => {
    return businessDays.filter((day) => {
      if (statusFilter !== 'ALL' && day.status !== statusFilter) return false
      if (!search.trim()) return true
      const q = search.toLowerCase()
      const idMatch = String(day.businessDayId).includes(q)
      const dateMatch = (day.businessDate || '').toLowerCase().includes(q)
      const startByMatch = (day.startedBy || '').toLowerCase().includes(q)
      const endByMatch = (day.endedBy || '').toLowerCase().includes(q)
      const eventMatch = (day.eventTitle || '').toLowerCase().includes(q)
      return idMatch || dateMatch || startByMatch || endByMatch || eventMatch
    })
  }, [businessDays, search, statusFilter])

  const handleExportExcel = () => {
    const data = filteredDays.map((d) => ({
      'Business Day #': d.businessDayId,
      'Business Date': d.businessDate,
      'Status': d.status,
      'Started At': d.startedAt ? new Date(d.startedAt).toLocaleString() : '',
      'Started By': d.startedBy || '',
      'Ended At': d.endedAt ? new Date(d.endedAt).toLocaleString() : '',
      'Ended By': d.endedBy || '',
      'Transactions': d.totalTransactions || 0,
      'Revenue': d.totalRevenue || 0,
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Business Days')
    XLSX.writeFile(wb, `Business_Days_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  return (
    <div className="space-y-4">
      {/* ── Top Bar with Search & Export ── */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-100">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-[#14274E]">List of Business Days</h2>
            <p className="text-xs text-slate-400 font-medium">
              Historical record of all opened and closed restaurant operational days.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end md:self-auto">
          <button
            type="button"
            onClick={loadHistory}
            disabled={loading}
            className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={filteredDays.length === 0}
            className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      {/* ── Filters Bar ── */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search day #, date, staff..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-hidden focus:bg-white focus:border-[#14274E]"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'OPEN' | 'CLOSED')}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-hidden cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="OPEN">Open Only</option>
            <option value="CLOSED">Closed Only</option>
          </select>
        </div>

        <div className="text-xs font-bold text-slate-400">
          Showing {filteredDays.length} business day{filteredDays.length === 1 ? '' : 's'}
        </div>
      </div>

      {/* ── Business Days List Table ── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
              <tr className="text-slate-500 font-black uppercase text-[10px] tracking-wider select-none">
                <th className="py-3 px-4">Day #</th>
                <th className="py-3 px-4">Business Date</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Started</th>
                <th className="py-3 px-4">Ended</th>
                <th className="py-3 px-4 text-center">Transactions</th>
                <th className="py-3 px-4 text-right">Total Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading && businessDays.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-bold">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-emerald-500" />
                    <span>Loading business days...</span>
                  </td>
                </tr>
              ) : filteredDays.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-semibold">
                    No business days found matching your search.
                  </td>
                </tr>
              ) : (
                filteredDays.map((day) => {
                  const isOpen = day.status === 'OPEN'
                  const startFormatted = day.startedAt
                    ? new Date(day.startedAt).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '—'
                  const endFormatted = day.endedAt
                    ? new Date(day.endedAt).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '—'

                  return (
                    <tr key={day.businessDayId} className="hover:bg-slate-50 transition-colors">
                      {/* Day ID */}
                      <td className="py-3.5 px-4 font-black text-[#14274E] whitespace-nowrap">
                        <span className="font-mono px-2 py-0.5 rounded-lg bg-slate-100 text-slate-800 text-[11px]">
                          #{day.businessDayId}
                        </span>
                      </td>

                      {/* Business Date */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-extrabold text-slate-800">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            {new Date(day.businessDate).toLocaleDateString([], {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        </div>
                        {day.eventTitle && (
                          <div className="text-[10px] text-amber-700 font-bold mt-0.5">
                            Event: {day.eventTitle}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wide uppercase border ${
                            isOpen
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {isOpen ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Open</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3 text-slate-400" />
                              <span>Closed</span>
                            </>
                          )}
                        </span>
                      </td>

                      {/* Started */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-bold text-slate-700 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>{startFormatted}</span>
                        </div>
                        {day.startedBy && (
                          <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <User className="w-2.5 h-2.5" />
                            <span>{day.startedBy}</span>
                          </div>
                        )}
                      </td>

                      {/* Ended */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-bold text-slate-700 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>{endFormatted}</span>
                        </div>
                        {day.endedBy && (
                          <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <User className="w-2.5 h-2.5" />
                            <span>{day.endedBy}</span>
                          </div>
                        )}
                      </td>

                      {/* Transactions */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 font-extrabold text-slate-800">
                          <Receipt className="w-3 h-3 text-blue-500" />
                          <span>{day.totalTransactions || 0}</span>
                        </span>
                      </td>

                      {/* Total Revenue */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <span className="font-black text-[#14274E] text-sm">
                          {money(day.totalRevenue || 0)}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
