import { useState, useEffect, useCallback, useTransition } from 'react'
import {
  TrendingUp,
  Package,
  Calendar,
  RefreshCw,
  Printer,
  Download,
  FileSpreadsheet,
  Trash2,
  AlertCircle,
  XCircle,
} from 'lucide-react'

import {
  fetchAnalyticsData,
  getDateRangeFromPreset,
  type AnalyticsSummary,
  type DateRange,
  type DateRangePreset,
} from '@/services/analyticsService'
import { exportAnalyticsPdf } from './utils/analyticsPdf'
import { exportAnalyticsExcel } from './utils/analyticsExcel'
import { DateRangePicker } from './components/DateRangePicker'
import { OverallSummaryTab } from './components/OverallSummaryTab'
import { ItemsCategoriesTab } from './components/ItemsCategoriesTab'
import { EventsAnalyticsTab } from './components/EventsAnalyticsTab'
import { ClearDataModal } from './components/ClearDataModal'
import { MetricDetailModal, type KpiMetricType } from './components/MetricDetailModal'
import { CustomerInsightsModal, type CustomerInsightTab } from './components/CustomerInsightsModal'

export type AnalyticsTab = 'summary' | 'items' | 'events'

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('summary')
  const [dateRange, setDateRange] = useState<DateRange>(() =>
    getDateRangeFromPreset('thisWeek'),
  )
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [clearModalOpen, setClearModalOpen] = useState(false)
  const [activeKpiMetric, setActiveKpiMetric] = useState<KpiMetricType | null>(null)
  const [activeCustomerInsightTab, setActiveCustomerInsightTab] = useState<CustomerInsightTab | null>(null)

  const showToast = (_text: string, _type: 'success' | 'error' = 'success') => {
    // Popup notifications disabled
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

  const handleExportExcel = () => {
    if (!summary) return
    try {
      exportAnalyticsExcel(summary)
      showToast('Analytics Excel spreadsheet downloaded.', 'success')
    } catch (excelErr) {
      console.error('[AnalyticsPage] Excel export failed:', excelErr)
      showToast('Failed to generate Excel file.', 'error')
    }
  }

  const handleClearSuccess = (deletedCount: number) => {
    showToast(`Successfully cleared ${deletedCount} historical order records.`, 'success')
    loadData(dateRange)
  }

  // Tab index calculation for sliding indicator
  const tabIndex = activeTab === 'summary' ? 0 : activeTab === 'items' ? 1 : 2

  return (
    <div className="analytics-page-container flex flex-col gap-4 pb-12">
      {/* ── Top Header: Date Filter moved here & Action Toolbar ── */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        {/* Left: Date Range Filter with Custom Range expanding to the right */}
        <div className="flex-1 min-w-0">
          <DateRangePicker currentRange={dateRange} onRangeChange={handleRangeChange} />
        </div>

        {/* Right: Action Toolbar */}
        <div className="flex flex-wrap items-center gap-2 no-print shrink-0">
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

          {/* Save as Excel */}
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={loading || !summary}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-700 hover:bg-emerald-800 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
            title="Export complete report to Excel spreadsheet"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-200" />
            <span>Save as Excel</span>
          </button>

          {/* Save as PDF */}
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

      {/* ── 3 Tabs with Smooth Sliding Pill Animation & Gold Text when Selected ── */}
      <div className="no-print flex items-center justify-start">
        <div className="relative grid grid-cols-3 items-center p-1.5 rounded-full bg-slate-200/80 border border-slate-300/60 shadow-inner w-full sm:w-auto">
          {/* Animated Sliding Pill Indicator */}
          <div
            className="absolute top-1.5 bottom-1.5 rounded-full bg-[#14274E] shadow-sm transition-all duration-300 ease-out pointer-events-none"
            style={{
              width: 'calc((100% - 12px) / 3)',
              left: '6px',
              transform: `translateX(${tabIndex * 100}%)`,
            }}
          />

          {/* Tab 1: Overall Summary */}
          <button
            type="button"
            onClick={() => setActiveTab('summary')}
            className={`relative z-10 w-full inline-flex items-center justify-center gap-2 px-5 py-2 rounded-full text-xs font-bold transition-colors duration-200 cursor-pointer select-none ${
              activeTab === 'summary'
                ? 'text-[#E9C46A]'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <TrendingUp className={`w-3.5 h-3.5 ${activeTab === 'summary' ? 'text-[#E9C46A]' : 'text-slate-500'}`} />
            <span>Overall Summary</span>
          </button>

          {/* Tab 2: Items & Categories */}
          <button
            type="button"
            onClick={() => setActiveTab('items')}
            className={`relative z-10 w-full inline-flex items-center justify-center gap-2 px-5 py-2 rounded-full text-xs font-bold transition-colors duration-200 cursor-pointer select-none ${
              activeTab === 'items'
                ? 'text-[#E9C46A]'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Package className={`w-3.5 h-3.5 ${activeTab === 'items' ? 'text-[#E9C46A]' : 'text-slate-500'}`} />
            <span>Items & Categories</span>
          </button>

          {/* Tab 3: Events */}
          <button
            type="button"
            onClick={() => setActiveTab('events')}
            className={`relative z-10 w-full inline-flex items-center justify-center gap-2 px-5 py-2 rounded-full text-xs font-bold transition-colors duration-200 cursor-pointer select-none ${
              activeTab === 'events'
                ? 'text-[#E9C46A]'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Calendar className={`w-3.5 h-3.5 ${activeTab === 'events' ? 'text-[#E9C46A]' : 'text-slate-500'}`} />
            <span>Events</span>
            {summary && summary.eventsList.length > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono transition-colors ${
                activeTab === 'events' ? 'bg-white/20 text-[#E9C46A]' : 'bg-slate-300 text-slate-700'
              }`}>
                {summary.eventsList.length}
              </span>
            )}
          </button>
        </div>
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

      {/* ── Main Tab Contents with Smooth Transition ── */}
      {summary && (
        <div key={activeTab} className="animate-in fade-in slide-in-from-bottom-1 duration-200">
          {activeTab === 'summary' && (
            <OverallSummaryTab
              summary={summary}
              onSelectKpiMetric={(key) => setActiveKpiMetric(key)}
            />
          )}

          {activeTab === 'items' && (
            <ItemsCategoriesTab summary={summary} />
          )}

          {activeTab === 'events' && (
            <EventsAnalyticsTab summary={summary} />
          )}

          {/* Administrative Zone — Clear Analytics Data */}
          <div className="no-print mt-6 p-4 sm:p-5 rounded-2xl border border-rose-200 bg-rose-50/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
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

      {/* KPI Metric Detail Modal */}
      {summary && (
        <MetricDetailModal
          isOpen={activeKpiMetric !== null}
          onClose={() => setActiveKpiMetric(null)}
          metricKey={activeKpiMetric}
          summary={summary}
          onSelectMetric={(key) => setActiveKpiMetric(key)}
          onOpenCustomerInsights={(tab) => {
            setActiveKpiMetric(null)
            setActiveCustomerInsightTab(tab)
          }}
        />
      )}

      {/* Customer Insights Action Playbook Modal */}
      {summary && (
        <CustomerInsightsModal
          isOpen={activeCustomerInsightTab !== null}
          onClose={() => setActiveCustomerInsightTab(null)}
          initialTab={activeCustomerInsightTab || 'ratio'}
          summary={summary}
        />
      )}
    </div>
  )
}
