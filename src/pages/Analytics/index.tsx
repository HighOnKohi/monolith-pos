import { useState, useEffect, useCallback, useTransition } from 'react'
import {
  DollarSign,
  ShoppingBag,
  Users,
  Clock,
  Award,
  Package,
  XCircle,
  RefreshCw,
  Printer,
  Download,
  Trash2,
  AlertCircle,
  TrendingUp,
  Info,
  Calendar,
  ChefHat,
  Truck,
  RotateCcw,
} from 'lucide-react'

import {
  fetchAnalyticsData,
  getDateRangeFromPreset,
  type AnalyticsSummary,
  type DateRange,
  type DateRangePreset,
} from '@/services/analyticsService'
import { exportAnalyticsPdf } from './utils/analyticsPdf'
import { DateRangePicker } from './components/DateRangePicker'
import { KpiCard } from './components/KpiCard'
import { AreaChart } from './components/AreaChart'
import { BarChart } from './components/BarChart'
import { TopItemsChart } from './components/TopItemsChart'
import { CategoryBreakdown } from './components/CategoryBreakdown'
import { OrderStatusBreakdown } from './components/OrderStatusBreakdown'
import { ClearDataModal } from './components/ClearDataModal'

export default function AnalyticsPage() {
  const [dateRange, setDateRange] = useState<DateRange>(() =>
    getDateRangeFromPreset('last7days'),
  )
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [clearModalOpen, setClearModalOpen] = useState(false)
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMsg({ text, type })
    setTimeout(() => setToastMsg(null), 4000)
  }

  // Load analytics data
  const loadData = useCallback(async (range: DateRange) => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchAnalyticsData(range)
      setSummary(data)
    } catch (err: unknown) {
      console.error('[AnalyticsPage] Failed to fetch analytics data:', err)
      const msg = err instanceof Error ? err.message : 'Failed to load analytics.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData(dateRange)
  }, [dateRange, loadData])

  // Preset or custom change
  const handleRangeChange = (preset: DateRangePreset, customStart?: Date, customEnd?: Date) => {
    const newRange = getDateRangeFromPreset(preset, customStart, customEnd)
    startTransition(() => {
      setDateRange(newRange)
    })
  }

  // Action handlers
  const handleRefresh = () => {
    loadData(dateRange)
  }

  const handlePrint = () => {
    window.print()
  }

  const handleExportPdf = () => {
    if (!summary) return
    try {
      exportAnalyticsPdf(summary)
      showToast('Analytics PDF downloaded successfully.', 'success')
    } catch (pdfErr) {
      console.error('[AnalyticsPage] PDF export failed:', pdfErr)
      showToast('Failed to generate PDF.', 'error')
    }
  }

  const handleClearSuccess = (deletedCount: number) => {
    showToast(`Successfully cleared ${deletedCount} historical order records.`, 'success')
    loadData(dateRange)
  }

  return (
    <div className="analytics-page-container flex flex-col gap-5 pb-12">
      {/* Toast Notification */}
      {toastMsg && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl shadow-lg text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-3 ${
            toastMsg.type === 'success'
              ? 'bg-[#14274E] text-[#E9C46A] border border-[#E9C46A]/30'
              : 'bg-rose-600 text-white'
          }`}
        >
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* ── Top Header & Actions ── */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#14274E] text-[#E9C46A] flex items-center justify-center font-black shadow-xs">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-[#14274E] tracking-tight">Analytics</h1>
              <p className="text-xs text-slate-500 font-medium">
                Sales overview, order volume, category performance & customer insights
              </p>
            </div>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center gap-2 no-print">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading || isPending}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 active:scale-95 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-all cursor-pointer"
            title="Refresh analytics data"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            disabled={loading || !summary}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 active:scale-95 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-all cursor-pointer"
            title="Print report"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>Print</span>
          </button>

          <button
            type="button"
            onClick={handleExportPdf}
            disabled={loading || !summary}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#14274E] hover:bg-[#1E3A8A] active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
            title="Export complete report to PDF"
          >
            <Download className="w-3.5 h-3.5 text-[#E9C46A]" />
            <span>Save as PDF</span>
          </button>
        </div>
      </div>

      {/* ── Date Range Selector ── */}
      <div className="no-print">
        <DateRangePicker currentRange={dateRange} onRangeChange={handleRangeChange} />
      </div>

      {/* ── Print Only Header ── */}
      <div className="hidden print:block mb-4 p-4 border-b border-slate-300">
        <h1 className="text-2xl font-black text-[#14274E]">Monolith POS — Analytics Report</h1>
        <p className="text-sm font-semibold text-slate-600">Selected Range: {dateRange.label}</p>
        <p className="text-xs text-slate-400">Generated on {new Date().toLocaleString()}</p>
      </div>

      {/* ── Error Banner ── */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between gap-3 text-xs text-rose-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            className="px-3 py-1 bg-rose-600 text-white font-bold rounded-lg hover:bg-rose-700 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Loading Skeleton ── */}
      {loading && !summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-4 border border-slate-200 animate-pulse h-28" />
          ))}
        </div>
      )}

      {/* ── Main Dashboard Content ── */}
      {summary && (
        <div className="flex flex-col gap-5">
          {/* Section 2: Summary KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <KpiCard
              title="Revenue"
              value={`₱${summary.revenue.toLocaleString('en-PH', { minimumFractionDigits: 0 })}`}
              icon={DollarSign}
              changePercent={summary.revenueChangePercent}
              accentColor="#14274E"
            />

            <KpiCard
              title="Completed Orders"
              value={summary.completedOrders}
              icon={ShoppingBag}
              changePercent={summary.ordersChangePercent}
              accentColor="#2A9D8F"
            />

            <KpiCard
              title="Customers Served"
              value={summary.customersServed !== null ? summary.customersServed.toLocaleString() : '—'}
              icon={Users}
              isUnavailable={summary.customersServed === null}
              changePercent={summary.customersChangePercent}
              tooltipText={
                summary.customersServed !== null
                  ? `Total diners served across completed orders (${summary.customerToOrderRatio ?? 1} diners/order)`
                  : 'Historical customer count data is not recorded on order rows in the database schema.'
              }
              subtitle={
                summary.customersServed !== null
                  ? `${summary.customerToOrderRatio ?? 1} diners / order`
                  : 'Count not recorded'
              }
              accentColor="#E76F51"
            />

            <KpiCard
              title="Avg. Order Value"
              value={`₱${summary.averageOrderValue.toFixed(0)}`}
              icon={TrendingUp}
              subtitle={`${summary.completedOrders} orders calculated`}
              accentColor="#E9C46A"
            />

            <KpiCard
              title="Spend / Customer"
              value={
                summary.averageSpendPerCustomer !== null
                  ? `₱${summary.averageSpendPerCustomer.toFixed(0)}`
                  : '—'
              }
              icon={Users}
              isUnavailable={summary.averageSpendPerCustomer === null}
              tooltipText={
                summary.averageSpendPerCustomer !== null
                  ? `Total Revenue (₱${summary.revenue.toLocaleString('en-PH', { minimumFractionDigits: 0 })}) / ${summary.customersServed} customers`
                  : 'Requires recorded customer count per order.'
              }
              subtitle={
                summary.averageSpendPerCustomer !== null
                  ? 'Revenue per customer'
                  : 'Data unavailable'
              }
              accentColor="#394867"
            />

            <KpiCard
              title="Avg. Serving Time"
              value={summary.averageServingTimeMinutes !== null ? `${summary.averageServingTimeMinutes}m` : '—'}
              icon={Clock}
              isUnavailable={summary.averageServingTimeMinutes === null}
              tooltipText={
                summary.averageServingTimeMinutes !== null
                  ? `Prep: ${summary.averagePrepTimeMinutes ?? '—'}m | Delivery: ${summary.averageDeliveryTimeMinutes ?? '—'}m | Turnaround: ${summary.averageTurnaroundTimeMinutes ?? '—'}m`
                  : 'Preparation and serving timestamps are not persisted in the database.'
              }
              subtitle={
                summary.averageServingTimeMinutes !== null
                  ? `Prep: ~${summary.averagePrepTimeMinutes ?? '—'}m · Ready`
                  : 'Timestamps not recorded'
              }
              accentColor="#6366F1"
            />

            <KpiCard
              title="Top Selling Item"
              value={summary.topItem ? summary.topItem.itemName : '—'}
              icon={Award}
              subtitle={
                summary.topItem
                  ? `${summary.topItem.quantity} units sold (₱${summary.topItem.revenue.toLocaleString('en-PH', { minimumFractionDigits: 0 })})`
                  : 'No sales'
              }
              accentColor="#F59E0B"
            />

            <KpiCard
              title="Items Sold"
              value={summary.itemsSold}
              icon={Package}
              subtitle={`${summary.categoryStats.length} active categories`}
              accentColor="#10B981"
            />
          </div>

          {/* Section 3: Customer Insights */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#14274E]" />
                <h2 className="text-sm font-black text-[#14274E] uppercase tracking-wider">
                  Customer Insights
                </h2>
              </div>
              <span className="text-[11px] font-bold text-slate-400">Diner Traffic & Spend</span>
            </div>

            {/* Graceful Fallback Notice only when customer data is truly absent */}
            {summary.customersServed === null ? (
              <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-800 mb-4">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-bold text-amber-900">Customer count data unavailable</p>
                  <p className="text-[11px] text-amber-800/90 leading-relaxed">
                    The POS records live seating counts on active tables (via <code className="font-mono bg-amber-100 px-1 py-0.5 rounded">CURRENT_GUEST_COUNT</code>),
                    but completed historical orders do not record diner counts. Add a <code className="font-mono bg-amber-100 px-1 py-0.5 rounded">GUEST_COUNT</code> column
                    to <code className="font-mono bg-amber-100 px-1 py-0.5 rounded">Restaurant_Orders</code> to track diner metrics historically.
                  </p>
                </div>
              </div>
            ) : null}

            {/* Metric widgets */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/70">
                <span className="text-[11px] font-bold text-slate-500 uppercase">Customer-to-Order Ratio</span>
                <p className="text-lg font-extrabold text-[#14274E] mt-1">
                  {summary.customerToOrderRatio !== null ? `${summary.customerToOrderRatio} diners / order` : 'Unavailable'}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {summary.customersServed !== null ? `${summary.customersServed} diners across ${summary.completedOrders} orders` : 'Requires order diner counts'}
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/70">
                <span className="text-[11px] font-bold text-slate-500 uppercase">Average Spend per Customer</span>
                <p className="text-lg font-extrabold text-[#14274E] mt-1">
                  {summary.averageSpendPerCustomer !== null ? `₱${summary.averageSpendPerCustomer.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : 'Unavailable'}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {summary.averageSpendPerCustomer !== null ? 'Total Revenue / Customers Served' : 'Revenue / Customers served'}
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/70">
                <span className="text-[11px] font-bold text-slate-500 uppercase">Peak Ordering & Seating</span>
                <p className="text-lg font-extrabold text-[#14274E] mt-1">
                  {summary.peakHour || 'No orders'}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Peak day: {summary.peakDay || 'N/A'} {summary.peakCustomerPeriod ? `· Busiest: ${summary.peakCustomerPeriod.period} (${summary.peakCustomerPeriod.count} diners)` : ''}
                </p>
              </div>
            </div>
          </div>

          {/* Section 4 & 5: Sales Insights & Order Volume Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Revenue Over Time */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between relative overflow-visible">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-sm font-black text-[#14274E] uppercase tracking-wider">
                    Revenue Over Time
                  </h2>
                  <span className="text-xs font-black text-[#14274E]">
                    ₱{summary.revenue.toLocaleString('en-PH', { minimumFractionDigits: 0 })}
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-medium mb-3">
                  {dateRange.preset === 'today' || dateRange.preset === 'yesterday'
                    ? 'Hourly revenue aggregation'
                    : 'Daily revenue aggregation'}
                </p>
              </div>

              <AreaChart data={summary.timeSeries} height={220} />
            </div>

            {/* Order Volume */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between relative overflow-visible">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-sm font-black text-[#14274E] uppercase tracking-wider">
                    Order Volume
                  </h2>
                  <span className="text-xs font-black text-[#14274E]">
                    {summary.completedOrders} completed orders
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-medium mb-3">
                  Completed order volume trend
                </p>
              </div>

              <BarChart data={summary.timeSeries} height={220} />
            </div>
          </div>

          {/* Section 8: Kitchen & Serving Performance Metrics */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#14274E]" />
                <h2 className="text-sm font-black text-[#14274E] uppercase tracking-wider">
                  Kitchen & Serving Metrics
                </h2>
              </div>
              <span className="text-[11px] font-bold text-slate-400">
                {summary.averageServingTimeMinutes !== null
                  ? `Live Lifecycle Metrics · ${summary.servingTimeBreakdown?.totalSampled ?? summary.completedOrders} orders measured`
                  : 'Timestamps Not Recorded'}
              </span>
            </div>

            {summary.averageServingTimeMinutes === null ? (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-slate-700">
                    Serving time data is unavailable because the required order timestamps are not recorded.
                  </p>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    The current database records the order placement timestamp (<code className="font-mono bg-slate-200/60 px-1 py-0.5 rounded">TIME</code>),
                    but kitchen preparation start, food ready, and served timestamps are not stored. Adding transition timestamps to the order lifecycle will enable accurate preparation and serving analytics.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* 4 Key Milestone Timing Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* Avg Serving Time */}
                  <div className="p-3.5 bg-indigo-50/50 rounded-xl border border-indigo-100 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-indigo-900 uppercase">Avg. Serving Time</span>
                        <Clock className="w-3.5 h-3.5 text-indigo-500" />
                      </div>
                      <p className="text-2xl font-black text-[#14274E] mt-1.5">
                        {summary.averageServingTimeMinutes}m
                      </p>
                    </div>
                    <div className="mt-2 pt-2 border-t border-indigo-100/80 flex items-center justify-between text-[10px] text-indigo-700/80 font-medium">
                      <span>Order Placed → Food Served</span>
                      <span>Range: {summary.fastestServingTimeMinutes}m - {summary.slowestServingTimeMinutes}m</span>
                    </div>
                  </div>

                  {/* Avg Kitchen Prep Time */}
                  <div className="p-3.5 bg-amber-50/50 rounded-xl border border-amber-100 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-amber-900 uppercase">Avg. Kitchen Prep</span>
                        <ChefHat className="w-3.5 h-3.5 text-amber-500" />
                      </div>
                      <p className="text-2xl font-black text-[#14274E] mt-1.5">
                        {summary.averagePrepTimeMinutes !== null ? `${summary.averagePrepTimeMinutes}m` : '—'}
                      </p>
                    </div>
                    <div className="mt-2 pt-2 border-t border-amber-100/80 flex items-center justify-between text-[10px] text-amber-700/80 font-medium">
                      <span>Order Placed → Food Ready</span>
                      <span>Kitchen Speed</span>
                    </div>
                  </div>

                  {/* Avg Delivery / Expediting Time */}
                  <div className="p-3.5 bg-emerald-50/50 rounded-xl border border-emerald-100 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-emerald-900 uppercase">Delivery & Hand-off</span>
                        <Truck className="w-3.5 h-3.5 text-emerald-500" />
                      </div>
                      <p className="text-2xl font-black text-[#14274E] mt-1.5">
                        {summary.averageDeliveryTimeMinutes !== null ? `${summary.averageDeliveryTimeMinutes}m` : '—'}
                      </p>
                    </div>
                    <div className="mt-2 pt-2 border-t border-emerald-100/80 flex items-center justify-between text-[10px] text-emerald-700/80 font-medium">
                      <span>Food Ready → Delivered</span>
                      <span>Floor Speed</span>
                    </div>
                  </div>

                  {/* Avg Table Turnaround Time */}
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-700 uppercase">Table Turnaround</span>
                        <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                      </div>
                      <p className="text-2xl font-black text-[#14274E] mt-1.5">
                        {summary.averageTurnaroundTimeMinutes !== null ? `${summary.averageTurnaroundTimeMinutes}m` : '—'}
                      </p>
                    </div>
                    <div className="mt-2 pt-2 border-t border-slate-200/80 flex items-center justify-between text-[10px] text-slate-500 font-medium">
                      <span>Order Placed → Completed</span>
                      <span>Table Cycle</span>
                    </div>
                  </div>
                </div>

                {/* Service Speed Distribution */}
                {summary.servingTimeBreakdown && (
                  <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/80">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-[#14274E]">Serving Speed Distribution</span>
                        <span className="text-[10px] font-medium text-slate-400">
                          ({summary.servingTimeBreakdown.totalSampled} completed orders evaluated)
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span className="text-slate-600 font-medium text-[11px]">
                            &lt;15m: <strong className="text-slate-800">{summary.servingTimeBreakdown.under15Min}</strong> ({summary.servingTimeBreakdown.under15MinPct}%)
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-sky-500" />
                          <span className="text-slate-600 font-medium text-[11px]">
                            15-30m: <strong className="text-slate-800">{summary.servingTimeBreakdown.between15And30Min}</strong> ({summary.servingTimeBreakdown.between15And30MinPct}%)
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-amber-500" />
                          <span className="text-slate-600 font-medium text-[11px]">
                            &gt;30m: <strong className="text-slate-800">{summary.servingTimeBreakdown.over30Min}</strong> ({summary.servingTimeBreakdown.over30MinPct}%)
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-200/80 h-2.5 rounded-full overflow-hidden flex">
                      {summary.servingTimeBreakdown.under15MinPct > 0 && (
                        <div
                          style={{ width: `${summary.servingTimeBreakdown.under15MinPct}%` }}
                          className="bg-emerald-500 h-full"
                          title={`<15 min: ${summary.servingTimeBreakdown.under15MinPct}%`}
                        />
                      )}
                      {summary.servingTimeBreakdown.between15And30MinPct > 0 && (
                        <div
                          style={{ width: `${summary.servingTimeBreakdown.between15And30MinPct}%` }}
                          className="bg-sky-500 h-full"
                          title={`15-30 min: ${summary.servingTimeBreakdown.between15And30MinPct}%`}
                        />
                      )}
                      {summary.servingTimeBreakdown.over30MinPct > 0 && (
                        <div
                          style={{ width: `${summary.servingTimeBreakdown.over30MinPct}%` }}
                          className="bg-amber-500 h-full"
                          title={`>30 min: ${summary.servingTimeBreakdown.over30MinPct}%`}
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section 9 & 10: Top Selling Items & Category Performance */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Top Items */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-[#14274E]" />
                  <h2 className="text-sm font-black text-[#14274E] uppercase tracking-wider">
                    Top-Selling Menu Items
                  </h2>
                </div>
                <span className="text-[11px] font-bold text-slate-400">Top {summary.topItems.length} items</span>
              </div>
              <TopItemsChart items={summary.topItems} />
            </div>

            {/* Category Performance */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-[#14274E]" />
                  <h2 className="text-sm font-black text-[#14274E] uppercase tracking-wider">
                    Sales by Category
                  </h2>
                </div>
                <span className="text-[11px] font-bold text-slate-400">
                  {summary.categoryStats.length} Categories
                </span>
              </div>
              <CategoryBreakdown categories={summary.categoryStats} />
            </div>
          </div>

          {/* Order Status, Dining Type & Channel Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Status Breakdown (2 cols on lg) */}
            <div className="lg:col-span-2 bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#14274E]" />
                  <h2 className="text-sm font-black text-[#14274E] uppercase tracking-wider">
                    Order Status Breakdown
                  </h2>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500 font-bold">
                    {summary.cancelledOrders} Cancelled
                  </span>
                </div>
              </div>
              <OrderStatusBreakdown statuses={summary.statusBreakdown} />
            </div>

            {/* Channels & Dining Type (1 col on lg) */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between gap-4">
              {/* Dining Type */}
              <div>
                <h3 className="text-xs font-black text-[#14274E] uppercase tracking-wider mb-2">
                  Dining Type
                </h3>
                <div className="space-y-2">
                  {summary.orderTypeBreakdown.map((t) => (
                    <div key={t.label} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/70 text-xs">
                      <div className="flex justify-between font-bold text-slate-800">
                        <span>{t.label}</span>
                        <span>{t.count} orders ({t.percentage}%)</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-200 rounded-full mt-1.5 overflow-hidden">
                        <div className="h-full bg-[#14274E] rounded-full" style={{ width: `${t.percentage}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Order Channel */}
              <div>
                <h3 className="text-xs font-black text-[#14274E] uppercase tracking-wider mb-2">
                  Order Source Channel
                </h3>
                <div className="space-y-2">
                  {summary.channelBreakdown.map((c) => (
                    <div key={c.label} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/70 text-xs">
                      <div className="flex justify-between font-bold text-slate-800">
                        <span>{c.label}</span>
                        <span>{c.count} orders ({c.percentage}%)</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-200 rounded-full mt-1.5 overflow-hidden">
                        <div className="h-full bg-[#2A9D8F] rounded-full" style={{ width: `${c.percentage}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Section 17: Administrative Zone — Clear Analytics Data */}
          <div className="no-print mt-4 p-4 sm:p-5 rounded-2xl border border-rose-200 bg-rose-50/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 text-rose-800 font-extrabold text-xs tracking-tight">
                <XCircle className="w-4 h-4 text-rose-600" />
                <span>Administrative Actions</span>
              </div>
              <p className="text-xs text-rose-700/80">
                Purge historical completed and cancelled orders. Requires admin password and explicit verification.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setClearModalOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Analytics Data</span>
            </button>
          </div>
        </div>
      )}

      {/* Clear Data Modal */}
      <ClearDataModal
        isOpen={clearModalOpen}
        onClose={() => setClearModalOpen(false)}
        onSuccess={handleClearSuccess}
      />
    </div>
  )
}
