import { useState, useRef, useEffect } from 'react'
import {
  DollarSign,
  ShoppingBag,
  Users,
  TrendingUp,
  ChevronDown,
  Check,
  HelpCircle,
} from 'lucide-react'
import type { AnalyticsSummary } from '@/services/analyticsService'
import { AreaChart } from './AreaChart'
import { CustomerDiningItemChart } from './CustomerDiningItemChart'
import { OrderSourcePieChart } from './OrderSourcePieChart'
import type { KpiMetricType } from './MetricDetailModal'
import {
  buildTimelinePoints,
  buildTrendPoints,
  buildDiningTrendPoints,
  type TimelineGranularity,
  type TrendAnalysisType,
} from '../utils/revenueTimelineBuilder'

interface OverallSummaryTabProps {
  summary: AnalyticsSummary
  onSelectKpiMetric?: (metric: KpiMetricType) => void
}

const TIMELINE_OPTIONS: Array<{ id: TimelineGranularity; label: string; description: string }> = [
  { id: 'weeks', label: 'Weeks', description: 'Daily dates with weekly milestones' },
  { id: 'months', label: 'Months', description: 'Monthly dates (Jan 1, Feb 1...)' },
  { id: 'years', label: 'Years', description: 'Multi-year and monthly distribution' },
]

const TREND_OPTIONS: Array<{ id: TrendAnalysisType; label: string; description: string }> = [
  { id: 'weekly', label: 'Weekly Performance', description: 'Sunday to Saturday distribution' },
  { id: 'monthly', label: 'Monthly Performance', description: 'Month by month distribution' },
]

/**
 * Reusable sleek tooltip helper for graph mode explanation and dropdown info
 */
function InfoTooltip({
  title,
  text,
  bullets,
  align = 'right',
}: {
  title: string
  text?: string
  bullets?: Array<{ label: string; desc: string }>
  align?: 'left' | 'right'
}) {
  const [open, setOpen] = useState(false)

  return (
    <div
      className="relative inline-flex items-center"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-5 h-5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors cursor-help select-none no-print"
        aria-label="Info tooltip"
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>

      {open && (
        <div
          className={`absolute top-full mt-2 w-72 bg-[#14274E] text-white p-3 rounded-xl shadow-xl border border-slate-700/80 text-xs z-50 pointer-events-none transition-all duration-150 ${
            align === 'left' ? 'right-0' : 'left-0'
          }`}
        >
          <div className="font-bold text-[#E9C46A] mb-1.5 flex items-center gap-1.5 text-[11px] uppercase tracking-wide">
            <HelpCircle className="w-3 h-3 text-[#E9C46A]" />
            <span>{title}</span>
          </div>
          {text && <p className="text-slate-200 leading-relaxed text-[11px] mb-1.5">{text}</p>}
          {bullets && (
            <div className="space-y-1.5 pt-0.5">
              {bullets.map((b, idx) => (
                <div key={idx} className="leading-snug text-[11px]">
                  <span className="font-extrabold text-amber-300">{b.label}: </span>
                  <span className="text-slate-200">{b.desc}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function OverallSummaryTab({
  summary,
  onSelectKpiMetric,
}: OverallSummaryTabProps) {
  // ── Revenue Summary Controls ──
  const [revenueMainMode, setRevenueMainMode] = useState<'timeline' | 'trend'>('timeline')
  const [timelineGranularity, setTimelineGranularity] = useState<TimelineGranularity>('weeks')
  const [trendType, setTrendType] = useState<TrendAnalysisType>('weekly')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // ── Peak Hour Controls (Synced with same filter capabilities) ──
  const [diningMainMode, setDiningMainMode] = useState<'timeline' | 'trend'>('timeline')
  const [diningTimelineGranularity, setDiningTimelineGranularity] = useState<TimelineGranularity>('weeks')
  const [diningTrendType, setDiningTrendType] = useState<TrendAnalysisType>('weekly')
  const [diningDropdownOpen, setDiningDropdownOpen] = useState(false)
  const diningDropdownRef = useRef<HTMLDivElement>(null)

  // Auto-default timeline granularities when date range preset changes
  useEffect(() => {
    const preset = summary.dateRange.preset
    if (preset === 'thisWeek' || preset === 'last3Weeks') {
      setTimelineGranularity('weeks')
      setDiningTimelineGranularity('weeks')
    } else if (preset === 'thisMonth' || preset === 'last3Months') {
      setTimelineGranularity('months')
      setDiningTimelineGranularity('months')
    } else if (preset === 'thisYear' || preset === 'last3Years') {
      setTimelineGranularity('years')
      setDiningTimelineGranularity('years')
    }
  }, [summary.dateRange.preset])

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
      if (diningDropdownRef.current && !diningDropdownRef.current.contains(event.target as Node)) {
        setDiningDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Calculate revenue chart points
  const revenueChartPoints =
    revenueMainMode === 'timeline'
      ? buildTimelinePoints(
          summary.dailySeries && summary.dailySeries.length > 0
            ? summary.dailySeries
            : summary.timeSeries,
          timelineGranularity,
          summary.dateRange,
        )
      : buildTrendPoints(trendType, summary.dayOfWeekSeries, summary.monthPerformanceSeries || [])

  // Calculate dining / peak hour chart points
  const diningChartPoints =
    diningMainMode === 'timeline'
      ? buildTimelinePoints(
          summary.dailySeries && summary.dailySeries.length > 0
            ? summary.dailySeries
            : summary.timeSeries,
          diningTimelineGranularity,
          summary.dateRange,
        )
      : buildDiningTrendPoints(
          diningTrendType,
          summary.dayOfWeekSeries,
          summary.monthPerformanceSeries || [],
        )

  return (
    <div className="flex flex-col gap-6">
      {/* ── Section 1: Simple Summary Cards (Staff Code Summary Card Design) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Total Revenue */}
        <div
          onClick={() => onSelectKpiMetric?.('revenue')}
          className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80 shadow-2xs space-y-1 transition-all hover:border-slate-300 cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
              Total Revenue
            </span>
            <div className="w-6 h-6 rounded-lg bg-slate-200/70 flex items-center justify-center text-slate-600">
              <DollarSign className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <span className="text-2xl font-black text-[#14274E]">
              ₱{summary.revenue.toLocaleString('en-PH', { minimumFractionDigits: 0 })}
            </span>
          </div>
        </div>

        {/* Completed Orders */}
        <div
          onClick={() => onSelectKpiMetric?.('orders')}
          className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80 shadow-2xs space-y-1 transition-all hover:border-slate-300 cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
              Completed Orders
            </span>
            <div className="w-6 h-6 rounded-lg bg-slate-200/70 flex items-center justify-center text-slate-600">
              <ShoppingBag className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <span className="text-2xl font-black text-[#14274E]">
              {summary.completedOrders}
            </span>
          </div>
        </div>

        {/* Guests Served */}
        <div
          onClick={() => onSelectKpiMetric?.('tables')}
          className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80 shadow-2xs space-y-1 transition-all hover:border-slate-300 cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
              Guests Served
            </span>
            <div className="w-6 h-6 rounded-lg bg-slate-200/70 flex items-center justify-center text-slate-600">
              <Users className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <span className="text-2xl font-black text-[#14274E]">
              {summary.customersServed !== null ? summary.customersServed.toLocaleString() : '—'}
            </span>
          </div>
        </div>

        {/* Avg. Order Value */}
        <div
          onClick={() => onSelectKpiMetric?.('aov')}
          className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80 shadow-2xs space-y-1 transition-all hover:border-slate-300 cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
              Avg. Order Value
            </span>
            <div className="w-6 h-6 rounded-lg bg-slate-200/70 flex items-center justify-center text-slate-600">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <span className="text-2xl font-black text-[#14274E]">
              ₱{summary.averageOrderValue.toFixed(0)}
            </span>
          </div>
        </div>
      </div>

      {/* ── Section 2: Revenue Summary ── */}
      <div className="flex flex-col gap-2.5">
        {/* Title and Description outside and above the graph container */}
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-[#14274E] tracking-tight">
            Revenue Summary
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Consolidated revenue trend and performance breakdown
          </p>
        </div>

        {/* White Card Container */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs flex flex-col gap-4 w-full">
          {/* Card Top Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            {/* Top Left: 2 Modes Switcher + Tooltip to the right */}
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 text-xs font-bold text-slate-600 no-print">
                <button
                  type="button"
                  onClick={() => {
                    setRevenueMainMode('timeline')
                    setDropdownOpen(false)
                  }}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    revenueMainMode === 'timeline'
                      ? 'bg-white text-[#14274E] shadow-xs'
                      : 'hover:text-slate-900'
                  }`}
                >
                  Timeline
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRevenueMainMode('trend')
                    setDropdownOpen(false)
                  }}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    revenueMainMode === 'trend'
                      ? 'bg-white text-[#14274E] shadow-xs'
                      : 'hover:text-slate-900'
                  }`}
                >
                  Trend Analysis
                </button>
              </div>

              {/* Tooltip to the right of Timeline & Trend Analysis */}
              <InfoTooltip
                title="Timeline vs. Trend Analysis"
                bullets={[
                  {
                    label: 'Timeline',
                    desc: 'Chronological sequence across your date range to track progress day by day or month by month.',
                  },
                  {
                    label: 'Trend Analysis',
                    desc: 'Aggregates data into recurring cycles (day-of-week or month-of-year) to highlight peak earnings.',
                  },
                ]}
                align="right"
              />
            </div>

            {/* Top Right: Tooltip to the left of dropdown + Dropdown Selector */}
            <div className="flex items-center gap-2">
              {/* Tooltip to the left of dropdown */}
              {revenueMainMode === 'timeline' ? (
                <InfoTooltip
                  title="Timeline Granularity"
                  text="Controls time grouping across the timeline. Choose Weeks for daily dates with weekly milestones, Months for monthly totals (Jan 1, Feb 1...), or Years for multi-year tracking."
                  align="left"
                />
              ) : (
                <InfoTooltip
                  title="Trend Performance Cycles"
                  text="Evaluates cyclical patterns across the entire date range. Weekly aggregates all Mondays–Sundays; Monthly aggregates all Jan–Dec cycles to spot recurring peak times."
                  align="left"
                />
              )}

              {/* Dropdown Selector */}
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setDropdownOpen((v) => !v)}
                  className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-slate-50 hover:bg-slate-100 active:scale-95 text-slate-800 text-xs font-bold rounded-xl border border-slate-200/90 shadow-2xs transition-all cursor-pointer select-none"
                >
                  <span>
                    {revenueMainMode === 'timeline'
                      ? TIMELINE_OPTIONS.find((o) => o.id === timelineGranularity)?.label
                      : TREND_OPTIONS.find((o) => o.id === trendType)?.label}
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                      dropdownOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {/* Dropdown Menu */}
                {dropdownOpen && (
                  <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 p-1.5 z-50 flex flex-col gap-0.5">
                    {revenueMainMode === 'timeline'
                      ? TIMELINE_OPTIONS.map((opt) => {
                          const isSelected = timelineGranularity === opt.id
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => {
                                setTimelineGranularity(opt.id)
                                setDropdownOpen(false)
                              }}
                              className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer text-left ${
                                isSelected
                                  ? 'bg-[#14274E] text-[#E9C46A]'
                                  : 'text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <div className="flex flex-col">
                                <span className="font-bold">{opt.label}</span>
                                <span
                                  className={`text-[10px] ${
                                    isSelected ? 'text-slate-300' : 'text-slate-400'
                                  }`}
                                >
                                  {opt.description}
                                </span>
                              </div>
                              {isSelected && <Check className="w-4 h-4 text-[#E9C46A] shrink-0" />}
                            </button>
                          )
                        })
                      : TREND_OPTIONS.map((opt) => {
                          const isSelected = trendType === opt.id
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => {
                                setTrendType(opt.id)
                                setDropdownOpen(false)
                              }}
                              className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer text-left ${
                                isSelected
                                  ? 'bg-[#14274E] text-[#E9C46A]'
                                  : 'text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <div className="flex flex-col">
                                <span className="font-bold">{opt.label}</span>
                                <span
                                  className={`text-[10px] ${
                                    isSelected ? 'text-slate-300' : 'text-slate-400'
                                  }`}
                                >
                                  {opt.description}
                                </span>
                              </div>
                              {isSelected && <Check className="w-4 h-4 text-[#E9C46A] shrink-0" />}
                            </button>
                          )
                        })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Clean Line Graph with Minimum Spacing and Horizontal Scroll */}
          <div className="w-full pt-1">
            <AreaChart data={revenueChartPoints} height={250} />
          </div>
        </div>
      </div>

      {/* ── Section 3: Peak Hour (Same Filter Revamps as Revenue Summary) ── */}
      <div className="flex flex-col gap-2.5">
        {/* Title and Description outside and above the graph container */}
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-[#14274E] tracking-tight">
            Peak Hour
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Seated guests and items ordered distribution
          </p>
        </div>

        {/* White Card Container Spanning Full Width */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs flex flex-col gap-4 w-full">
          {/* Card Top Bar with Modes Switcher & Dropdown (Identical to Revenue Summary) */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            {/* Top Left: 2 Modes Switcher + Tooltip to the right */}
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 text-xs font-bold text-slate-600 no-print">
                <button
                  type="button"
                  onClick={() => {
                    setDiningMainMode('timeline')
                    setDiningDropdownOpen(false)
                  }}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    diningMainMode === 'timeline'
                      ? 'bg-white text-[#14274E] shadow-xs'
                      : 'hover:text-slate-900'
                  }`}
                >
                  Timeline
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDiningMainMode('trend')
                    setDiningDropdownOpen(false)
                  }}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    diningMainMode === 'trend'
                      ? 'bg-white text-[#14274E] shadow-xs'
                      : 'hover:text-slate-900'
                  }`}
                >
                  Trend Analysis
                </button>
              </div>

              {/* Tooltip to the right of Timeline & Trend Analysis */}
              <InfoTooltip
                title="Dining Traffic: Timeline vs. Trend Analysis"
                bullets={[
                  {
                    label: 'Timeline',
                    desc: 'Chronological guest seating and order volumes across your selected date range.',
                  },
                  {
                    label: 'Trend Analysis',
                    desc: 'Recurring dining patterns (by day of week or month of year) highlighting rush periods.',
                  },
                ]}
                align="right"
              />
            </div>

            {/* Top Right: Tooltip to the left of dropdown + Dropdown Selector */}
            <div className="flex items-center gap-2">
              {/* Tooltip to the left of dropdown */}
              {diningMainMode === 'timeline' ? (
                <InfoTooltip
                  title="Dining Timeline Granularity"
                  text="Controls time grouping across the dining timeline. Choose Weeks for daily points with weekly milestones, Months for monthly dining totals, or Years for multi-year tracking."
                  align="left"
                />
              ) : (
                <InfoTooltip
                  title="Dining Trend Cycles"
                  text="Evaluates cyclical dining traffic across the entire range. Weekly Summary compares Sunday–Saturday; Monthly Performance compares Jan–Dec to pinpoint peak rush days/months."
                  align="left"
                />
              )}

              {/* Dropdown Selector */}
              <div className="relative" ref={diningDropdownRef}>
                <button
                  type="button"
                  onClick={() => setDiningDropdownOpen((v) => !v)}
                  className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-slate-50 hover:bg-slate-100 active:scale-95 text-slate-800 text-xs font-bold rounded-xl border border-slate-200/90 shadow-2xs transition-all cursor-pointer select-none"
                >
                  <span>
                    {diningMainMode === 'timeline'
                      ? TIMELINE_OPTIONS.find((o) => o.id === diningTimelineGranularity)?.label
                      : TREND_OPTIONS.find((o) => o.id === diningTrendType)?.label}
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                      diningDropdownOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {/* Dropdown Menu */}
                {diningDropdownOpen && (
                  <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 p-1.5 z-50 flex flex-col gap-0.5">
                    {diningMainMode === 'timeline'
                      ? TIMELINE_OPTIONS.map((opt) => {
                          const isSelected = diningTimelineGranularity === opt.id
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => {
                                setDiningTimelineGranularity(opt.id)
                                setDiningDropdownOpen(false)
                              }}
                              className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer text-left ${
                                isSelected
                                  ? 'bg-[#14274E] text-[#E9C46A]'
                                  : 'text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <div className="flex flex-col">
                                <span className="font-bold">{opt.label}</span>
                                <span
                                  className={`text-[10px] ${
                                    isSelected ? 'text-slate-300' : 'text-slate-400'
                                  }`}
                                >
                                  {opt.description}
                                </span>
                              </div>
                              {isSelected && <Check className="w-4 h-4 text-[#E9C46A] shrink-0" />}
                            </button>
                          )
                        })
                      : TREND_OPTIONS.map((opt) => {
                          const isSelected = diningTrendType === opt.id
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => {
                                setDiningTrendType(opt.id)
                                setDiningDropdownOpen(false)
                              }}
                              className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer text-left ${
                                isSelected
                                  ? 'bg-[#14274E] text-[#E9C46A]'
                                  : 'text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <div className="flex flex-col">
                                <span className="font-bold">{opt.label}</span>
                                <span
                                  className={`text-[10px] ${
                                    isSelected ? 'text-slate-300' : 'text-slate-400'
                                  }`}
                                >
                                  {opt.description}
                                </span>
                              </div>
                              {isSelected && <Check className="w-4 h-4 text-[#E9C46A] shrink-0" />}
                            </button>
                          )
                        })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Full-width scrollable Peak Hour Chart with view toggles & cross-fade */}
          <div className="w-full pt-1">
            <CustomerDiningItemChart
              data={diningChartPoints}
              height={250}
            />
          </div>
        </div>
      </div>

      {/* ── Section 4: Order Source Channel (Below Peak Hour, Middle Aligned) ── */}
      <div className="flex justify-center w-full pt-2">
        <div className="w-full max-w-2xl bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs">
          <OrderSourcePieChart comparison={summary.orderSourceComparison} />
        </div>
      </div>
    </div>
  )
}
