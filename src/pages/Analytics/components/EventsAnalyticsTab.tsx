import { useState, useRef, useEffect, useMemo } from 'react'
import {
  ChevronDown,
  Check,
  HelpCircle,
  Calendar,
  Filter,
} from 'lucide-react'
import type {
  AnalyticsSummary,
  TimeSeriesPoint,
  DayOfWeekPoint,
  MonthPerformancePoint,
} from '@/services/analyticsService'
import { AreaChart } from './AreaChart'
import {
  buildTimelinePoints,
  buildTrendPoints,
  type TimelineGranularity,
  type TrendAnalysisType,
} from '../utils/revenueTimelineBuilder'

interface EventsAnalyticsTabProps {
  summary: AnalyticsSummary
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

export function EventsAnalyticsTab({ summary }: EventsAnalyticsTabProps) {
  // Mode & Granularity Controls
  const [mainMode, setMainMode] = useState<'timeline' | 'trend'>('timeline')
  const [timelineGranularity, setTimelineGranularity] = useState<TimelineGranularity>('weeks')
  const [trendType, setTrendType] = useState<TrendAnalysisType>('weekly')
  const [selectedEventId, setSelectedEventId] = useState<number | 'all'>('all')

  // Dropdown states & refs
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [eventDropdownOpen, setEventDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const eventDropdownRef = useRef<HTMLDivElement>(null)

  const events = summary.eventsList || []

  // Auto-default timeline granularities when date range preset changes
  useEffect(() => {
    const preset = summary.dateRange.preset
    if (preset === 'thisWeek' || preset === 'last3Weeks') {
      setTimelineGranularity('weeks')
    } else if (preset === 'thisMonth' || preset === 'last3Months') {
      setTimelineGranularity('months')
    } else if (preset === 'thisYear' || preset === 'last3Years') {
      setTimelineGranularity('years')
    }
  }, [summary.dateRange.preset])

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
      if (eventDropdownRef.current && !eventDropdownRef.current.contains(event.target as Node)) {
        setEventDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Build TimeSeriesPoint[] tailored to event revenue
  const eventTimeSeries: TimeSeriesPoint[] = useMemo(() => {
    const base =
      summary.dailySeries && summary.dailySeries.length > 0
        ? summary.dailySeries
        : summary.timeSeries
    if (!base || base.length === 0) return []

    // Map scheduled events by date key (YYYY-MM-DD)
    const eventRevenueByDate = new Map<string, number>()
    for (const ev of events) {
      if (selectedEventId !== 'all' && ev.eventId !== selectedEventId) continue
      if (!ev.startAt) continue
      const dt = new Date(ev.startAt)
      if (isNaN(dt.getTime())) continue
      const dStr = dt.toISOString().slice(0, 10)
      eventRevenueByDate.set(
        dStr,
        (eventRevenueByDate.get(dStr) || 0) + (ev.revenueEarned || 0),
      )
    }

    return base.map((pt) => {
      let rev = 0
      const ptDt = new Date(pt.timestamp)
      const dStr = !isNaN(ptDt.getTime()) ? ptDt.toISOString().slice(0, 10) : ''

      if (selectedEventId !== 'all') {
        const ev = events.find((e) => e.eventId === selectedEventId)
        if (ev && ev.startAt) {
          const evDt = new Date(ev.startAt)
          if (!isNaN(evDt.getTime()) && evDt.toISOString().slice(0, 10) === dStr) {
            rev = Math.max(pt.eventRevenue || 0, ev.revenueEarned || 0)
          }
        }
      } else {
        const recordedRev = dStr ? eventRevenueByDate.get(dStr) || 0 : 0
        rev = Math.max(pt.eventRevenue || 0, recordedRev)
      }

      return {
        ...pt,
        revenue: rev,
        orderCount: rev > 0 ? pt.orderCount : 0,
        customerCount: rev > 0 ? pt.customerCount : null,
        itemCount: rev > 0 ? pt.itemCount : 0,
      }
    })
  }, [summary.dailySeries, summary.timeSeries, events, selectedEventId])

  // Aggregate event series into day-of-week and month-of-year buckets for Trend Analysis
  const { eventDayOfWeekSeries, eventMonthPerformanceSeries } = useMemo(() => {
    const days: DayOfWeekPoint[] = [
      { dayIndex: 0, dayName: 'Sunday', shortName: 'Sun', key: 'Sun', timestamp: '', revenue: 0, orderCount: 0, customerCount: 0, itemCount: 0 },
      { dayIndex: 1, dayName: 'Monday', shortName: 'Mon', key: 'Mon', timestamp: '', revenue: 0, orderCount: 0, customerCount: 0, itemCount: 0 },
      { dayIndex: 2, dayName: 'Tuesday', shortName: 'Tue', key: 'Tue', timestamp: '', revenue: 0, orderCount: 0, customerCount: 0, itemCount: 0 },
      { dayIndex: 3, dayName: 'Wednesday', shortName: 'Wed', key: 'Wed', timestamp: '', revenue: 0, orderCount: 0, customerCount: 0, itemCount: 0 },
      { dayIndex: 4, dayName: 'Thursday', shortName: 'Thu', key: 'Thu', timestamp: '', revenue: 0, orderCount: 0, customerCount: 0, itemCount: 0 },
      { dayIndex: 5, dayName: 'Friday', shortName: 'Fri', key: 'Fri', timestamp: '', revenue: 0, orderCount: 0, customerCount: 0, itemCount: 0 },
      { dayIndex: 6, dayName: 'Saturday', shortName: 'Sat', key: 'Sat', timestamp: '', revenue: 0, orderCount: 0, customerCount: 0, itemCount: 0 },
    ]

    const currentYear = new Date().getFullYear()
    const months: MonthPerformancePoint[] = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ].map((shortName, idx) => ({
      monthIndex: idx,
      monthName: [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December',
      ][idx],
      shortName,
      year: currentYear,
      key: shortName,
      revenue: 0,
      orderCount: 0,
      customerCount: 0,
      itemCount: 0,
    }))

    for (const pt of eventTimeSeries) {
      const dt = new Date(pt.timestamp)
      if (isNaN(dt.getTime())) continue
      const dow = dt.getDay()
      const mIdx = dt.getMonth()

      days[dow].revenue += pt.revenue
      days[dow].orderCount += pt.orderCount
      days[dow].customerCount = (days[dow].customerCount ?? 0) + (pt.customerCount ?? 0)
      days[dow].itemCount += pt.itemCount

      months[mIdx].revenue += pt.revenue
      months[mIdx].orderCount += pt.orderCount
      months[mIdx].customerCount = (months[mIdx].customerCount ?? 0) + (pt.customerCount ?? 0)
      months[mIdx].itemCount += pt.itemCount
    }

    return {
      eventDayOfWeekSeries: days,
      eventMonthPerformanceSeries: months,
    }
  }, [eventTimeSeries])

  // Calculate chart points based on active mode
  const eventChartPoints = useMemo(() => {
    if (mainMode === 'timeline') {
      return buildTimelinePoints(
        eventTimeSeries,
        timelineGranularity,
        summary.dateRange,
      )
    }
    return buildTrendPoints(
      trendType,
      eventDayOfWeekSeries,
      eventMonthPerformanceSeries,
    )
  }, [
    mainMode,
    eventTimeSeries,
    timelineGranularity,
    summary.dateRange,
    trendType,
    eventDayOfWeekSeries,
    eventMonthPerformanceSeries,
  ])

  // Selected event title for display
  const activeEventLabel = useMemo(() => {
    if (selectedEventId === 'all') return 'All Events'
    const ev = events.find((e) => e.eventId === selectedEventId)
    return ev ? ev.title : 'All Events'
  }, [selectedEventId, events])

  return (
    <div className="flex flex-col gap-6">
      {/* ── Event Revenue Graph Section (Matching Revenue Summary Design) ── */}
      <div className="flex flex-col gap-2.5">
        {/* Title and Description outside and above the graph container */}
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-[#14274E] tracking-tight">
            Event Revenue
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Recorded event revenue timeline and trend analysis
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
                    setMainMode('timeline')
                    setDropdownOpen(false)
                  }}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    mainMode === 'timeline'
                      ? 'bg-white text-[#14274E] shadow-xs'
                      : 'hover:text-slate-900'
                  }`}
                >
                  Timeline
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMainMode('trend')
                    setDropdownOpen(false)
                  }}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    mainMode === 'trend'
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
                    desc: 'Chronological sequence of event revenues across your selected date range.',
                  },
                  {
                    label: 'Trend Analysis',
                    desc: 'Aggregates event earnings into recurring cycles (day-of-week or month-of-year) to spot top-grossing event days.',
                  },
                ]}
                align="right"
              />
            </div>

            {/* Top Right: Event Filter & Granularity Dropdown */}
            <div className="flex items-center gap-2">
              {/* Optional Event Filter Dropdown (if multiple events exist) */}
              {events.length > 0 && (
                <div className="relative" ref={eventDropdownRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setEventDropdownOpen((v) => !v)
                      setDropdownOpen(false)
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 active:scale-95 text-slate-700 text-xs font-bold rounded-xl border border-slate-200/90 shadow-2xs transition-all cursor-pointer select-none max-w-[200px]"
                  >
                    <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{activeEventLabel}</span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-200 ${
                        eventDropdownOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {eventDropdownOpen && (
                    <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 p-1.5 z-50 flex flex-col gap-0.5 max-h-72 overflow-y-auto">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedEventId('all')
                          setEventDropdownOpen(false)
                        }}
                        className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer text-left ${
                          selectedEventId === 'all'
                            ? 'bg-[#14274E] text-[#E9C46A]'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex flex-col">
                          <span className="font-bold">All Events</span>
                          <span
                            className={`text-[10px] ${
                              selectedEventId === 'all' ? 'text-slate-300' : 'text-slate-400'
                            }`}
                          >
                            Consolidated revenue ({events.length} events)
                          </span>
                        </div>
                        {selectedEventId === 'all' && (
                          <Check className="w-4 h-4 text-[#E9C46A] shrink-0" />
                        )}
                      </button>

                      {events.map((ev) => {
                        const isSelected = selectedEventId === ev.eventId
                        return (
                          <button
                            key={ev.eventId}
                            type="button"
                            onClick={() => {
                              setSelectedEventId(ev.eventId)
                              setEventDropdownOpen(false)
                            }}
                            className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer text-left ${
                              isSelected
                                ? 'bg-[#14274E] text-[#E9C46A]'
                                : 'text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex flex-col min-w-0 pr-2">
                              <span className="font-bold truncate">{ev.title}</span>
                              <span
                                className={`text-[10px] ${
                                  isSelected ? 'text-slate-300' : 'text-slate-400'
                                }`}
                              >
                                {ev.category} • ₱{ev.revenueEarned.toLocaleString('en-PH', { minimumFractionDigits: 0 })}
                              </span>
                            </div>
                            {isSelected && (
                              <Check className="w-4 h-4 text-[#E9C46A] shrink-0" />
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Tooltip to the left of Granularity dropdown */}
              {mainMode === 'timeline' ? (
                <InfoTooltip
                  title="Timeline Granularity"
                  text="Controls chronological aggregation for event revenue. Choose Weeks for daily points with weekly milestones, Months for monthly totals, or Years for multi-year tracking."
                  align="left"
                />
              ) : (
                <InfoTooltip
                  title="Trend Performance Cycles"
                  text="Evaluates recurring cycles for event revenue. Weekly aggregates by day-of-week; Monthly aggregates across calendar months to spot high-revenue periods."
                  align="left"
                />
              )}

              {/* Granularity Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => {
                    setDropdownOpen((v) => !v)
                    setEventDropdownOpen(false)
                  }}
                  className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-slate-50 hover:bg-slate-100 active:scale-95 text-slate-800 text-xs font-bold rounded-xl border border-slate-200/90 shadow-2xs transition-all cursor-pointer select-none"
                >
                  <span>
                    {mainMode === 'timeline'
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
                    {mainMode === 'timeline'
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
            {events.length === 0 && eventTimeSeries.every((p) => p.revenue === 0) ? (
              <div className="h-56 flex flex-col items-center justify-center text-slate-400 text-xs italic bg-slate-50/50 rounded-xl border border-slate-100">
                <Calendar className="w-8 h-8 text-slate-300 mb-2" />
                <span>No event revenue recorded for this period.</span>
              </div>
            ) : (
              <AreaChart data={eventChartPoints} height={260} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
