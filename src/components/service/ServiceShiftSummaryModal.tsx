import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  ShoppingBag,
  Layers,
  DollarSign,
  Clock,
  Search,
  ChevronDown,
  ChevronRight,
  X,
  Loader2,
} from 'lucide-react'
import type {
  ServiceShift,
  ServiceShiftDetailedSummary,
  ServiceShiftPunchedOrder,
  ServiceShiftPunchedTable,
} from '@/types/serviceShift'
import { getServiceShiftDetailedSummary } from '@/services/serviceShiftService'

interface ServiceShiftSummaryModalProps {
  isOpen: boolean
  onClose: () => void
  shift: ServiceShift | null
}

type ViewMode = 'orders' | 'tables'

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

export function ServiceShiftSummaryModal({
  isOpen,
  onClose,
  shift,
}: ServiceShiftSummaryModalProps) {
  const [mounted, setMounted] = useState(false)
  const [mode, setMode] = useState<ViewMode>('orders')
  const [searchQuery, setSearchQuery] = useState('')
  const [details, setDetails] = useState<ServiceShiftDetailedSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [expandedTables, setExpandedTables] = useState<Set<number>>(new Set())

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!isOpen || !shift) return
    let active = true
    setLoading(true)

    getServiceShiftDetailedSummary(shift.staffId, shift.startedAt)
      .then((data) => {
        if (active) setDetails(data)
      })
      .catch((err) => {
        console.warn('[ServiceShiftSummaryModal] Failed to load shift details:', err)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [isOpen, shift?.staffId, shift?.startedAt])

  const filteredOrders = useMemo(() => {
    if (!details?.orders) return []
    const q = searchQuery.trim().toLowerCase()
    if (!q) return details.orders

    return details.orders.filter((ord: ServiceShiftPunchedOrder) => {
      if (String(ord.orderId).includes(q)) return true
      if (ord.tableDisplay.toLowerCase().includes(q)) return true
      return ord.items.some((it: { name: string; quantity: number }) =>
        it.name.toLowerCase().includes(q),
      )
    })
  }, [details?.orders, searchQuery])

  const filteredTables = useMemo(() => {
    if (!details?.tables) return []
    const q = searchQuery.trim().toLowerCase()
    if (!q) return details.tables

    return details.tables
      .map((tbl: ServiceShiftPunchedTable) => {
        const matchesTable =
          tbl.tableDisplay.toLowerCase().includes(q) || String(tbl.tableNum).includes(q)
        if (matchesTable) return tbl

        const matchingOrders = tbl.orders.filter(
          (o: ServiceShiftPunchedOrder) =>
            String(o.orderId).includes(q) ||
            o.items.some((it: { name: string; quantity: number }) =>
              it.name.toLowerCase().includes(q),
            ),
        )
        return {
          ...tbl,
          orders: matchingOrders,
          ordersCount: matchingOrders.length,
        }
      })
      .filter((tbl) => tbl.ordersCount > 0)
  }, [details?.tables, searchQuery])

  useEffect(() => {
    if (searchQuery.trim().length > 0 && details?.tables) {
      const allIds = new Set(details.tables.map((t: ServiceShiftPunchedTable) => t.tableNum || t.tableId))
      setExpandedTables(allIds)
    }
  }, [searchQuery, details?.tables])

  if (!isOpen || !shift) return null

  const toggleTableExpand = (key: number) => {
    setExpandedTables((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const durationText = getDurationText(shift.startedAt, shift.endedAt)
  const totalValuePunched = details?.metrics?.totalValuePunched ?? 0
  const ordersPunchedCount = details?.metrics?.ordersPunched ?? shift.totalOrdersPunched ?? 0
  const tablesServedCount = details?.metrics?.tablesServed ?? shift.totalTablesServed ?? 0

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
          {/* 1. Summary Cards (Staff-Manager Style: 3 cards) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Orders Punched */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 shadow-2xs space-y-1 transition-all">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Orders Punched
                </span>
                <div className="w-6 h-6 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700">
                  <ShoppingBag className="w-3.5 h-3.5" />
                </div>
              </div>
              <div>
                <span className="text-2xl font-black text-[#14274E]">
                  {loading ? '—' : ordersPunchedCount}
                </span>
              </div>
            </div>

            {/* Tables Served */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 shadow-2xs space-y-1 transition-all">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Tables Served
                </span>
                <div className="w-6 h-6 rounded-lg bg-purple-100 flex items-center justify-center text-purple-700">
                  <Layers className="w-3.5 h-3.5" />
                </div>
              </div>
              <div>
                <span className="text-2xl font-black text-[#14274E]">
                  {loading ? '—' : tablesServedCount}
                </span>
              </div>
            </div>

            {/* Total Value Punched */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 shadow-2xs space-y-1 transition-all">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Total Value Punched
                </span>
                <div className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
                  <DollarSign className="w-3.5 h-3.5" />
                </div>
              </div>
              <div>
                <span className="text-2xl font-black text-emerald-700">
                  {loading ? '—' : money(totalValuePunched)}
                </span>
              </div>
            </div>
          </div>

          {/* 2. Controls Row: Mode Selector Tabs (Orders / Tables) + Search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200/80 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setMode('orders')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                  mode === 'orders'
                    ? 'bg-[#14274E] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Orders</span>
                <span
                  className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                    mode === 'orders' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {details?.orders.length ?? 0}
                </span>
              </button>

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
                <span>Tables</span>
                <span
                  className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                    mode === 'tables' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {details?.tables.length ?? 0}
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
                  mode === 'orders'
                    ? 'Search order #, table, dish...'
                    : 'Search table #, dish...'
                }
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 placeholder:text-slate-400 outline-hidden focus:bg-white focus:border-[#14274E]"
              />
            </div>
          </div>

          {/* 3. List Content: Mode 'orders' (Default) */}
          {mode === 'orders' && (
            <div className="space-y-2.5">
              {loading && !details ? (
                <div className="py-12 flex items-center justify-center text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin text-[#14274E]" />
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="py-10 text-center text-slate-400 bg-slate-50/70 rounded-xl border border-dashed border-slate-200 p-6 space-y-1">
                  <ShoppingBag className="w-6 h-6 mx-auto text-slate-300" />
                  <p className="text-xs font-bold text-slate-600">No punched orders found</p>
                  <p className="text-[11px] text-slate-400">
                    Orders submitted by this server will appear here.
                  </p>
                </div>
              ) : (
                filteredOrders.map((ord: ServiceShiftPunchedOrder) => (
                  <div
                    key={ord.orderId}
                    className="p-3 bg-white rounded-xl border border-slate-200/90 shadow-2xs hover:border-slate-300 transition-all space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-black text-xs text-[#14274E] px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200">
                          #{ord.orderId}
                        </span>
                        <span className="font-extrabold text-xs text-slate-700">
                          {ord.tableDisplay}
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {formatShiftTime(ord.time)}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-slate-100 text-slate-600 border border-slate-200">
                          {ord.status}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="text-sm font-black text-emerald-700">
                          {money(ord.totalBill)}
                        </span>
                      </div>
                    </div>

                    {/* Order Items Preview */}
                    {ord.items.length > 0 && (
                      <div className="pt-1.5 border-t border-slate-100 flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
                        {ord.items.map((it: { name: string; quantity: number }, idx: number) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200 text-[11px] font-semibold text-slate-700"
                          >
                            <span className="font-black text-[#14274E]">{it.quantity}x</span>
                            <span>{it.name}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

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
                  <p className="text-xs font-bold text-slate-600">No tables served yet</p>
                  <p className="text-[11px] text-slate-400">
                    Tables will appear here once orders are punched for them.
                  </p>
                </div>
              ) : (
                filteredTables.map((tbl: ServiceShiftPunchedTable) => {
                  const key = tbl.tableNum || tbl.tableId
                  const isExpanded = expandedTables.has(key)
                  return (
                    <div
                      key={key}
                      className="rounded-xl border border-slate-200/90 bg-white overflow-hidden shadow-2xs transition-all"
                    >
                      {/* Table Card Header (Clickable Accordion) */}
                      <div
                        onClick={() => toggleTableExpand(key)}
                        className="px-4 py-3 bg-slate-50/80 hover:bg-slate-100/80 flex items-center justify-between gap-3 cursor-pointer select-none transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <h4 className="font-black text-sm text-[#14274E]">
                            {tbl.tableDisplay}
                          </h4>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-50 text-purple-700 border border-purple-200">
                            {tbl.ordersCount} order{tbl.ordersCount !== 1 ? 's' : ''} punched
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-sm font-black text-emerald-700">
                            {money(tbl.totalValue)}
                          </span>
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-slate-600" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                      </div>

                      {/* Nested Orders under this Table */}
                      {isExpanded && (
                        <div className="p-3 space-y-2 bg-slate-50/30 border-t border-slate-100">
                          {tbl.orders.map((ord: ServiceShiftPunchedOrder) => (
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
                                    {formatShiftTime(ord.time)}
                                  </span>
                                  <span className="px-1.5 py-0.2 rounded text-[10px] font-black uppercase bg-slate-100 text-slate-600 border border-slate-200">
                                    {ord.status}
                                  </span>
                                </div>

                                <div className="text-right">
                                  <span className="text-xs font-black text-emerald-700">
                                    {money(ord.totalBill)}
                                  </span>
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
        </div>

        {/* ── Footer ── */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end shrink-0">
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

  const portalTarget = mounted ? document.getElementById('service-interface-root') : null
  return portalTarget ? createPortal(modalContent, portalTarget) : modalContent
}
