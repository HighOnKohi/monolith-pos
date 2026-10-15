import type {
  TimeSeriesPoint,
  DayOfWeekPoint,
  MonthPerformancePoint,
  DateRange,
} from '@/services/analyticsService'

export interface RevenueChartPoint {
  key: string
  sublabel?: string
  revenue: number
  orderCount: number
  customerCount?: number | null
  itemCount?: number
  isMilestone?: boolean
  milestoneLabel?: string
  milestoneShort?: string
  isPeak?: boolean
  peakBadge?: string
}

export type DiningChartPoint = RevenueChartPoint
export type TimelineGranularity = 'weeks' | 'months' | 'years'
export type TrendAnalysisType = 'weekly' | 'monthly'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const MONTH_LABELS = [
  'Jan 1', 'Feb 1', 'March 1', 'April 1', 'May 1', 'June 1',
  'July 1', 'Aug 1', 'Sept 1', 'Oct 1', 'Nov 1', 'Dec 1',
]

/**
 * Formats a Date object as "Sep 12", "Dec 12", "Aug 1", etc.
 */
function formatDateLabel(d: Date): string {
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/**
 * Builds points for Timeline mode:
 * 1. 'weeks': Individual days with 'Week' on Sundays and 'Latest' at the end:
 *    Week -> Day -> Day -> Day -> Day -> Week -> Day...
 * 2. 'months': Clean calendar months starting on the 1st (Jan 1, Feb 1, March 1...)
 * 3. 'years': Multi-year timeline with 'Year' on January and 'Month' in between:
 *    Year -> Month -> Month -> Month -> Year -> Month...
 */
export function buildTimelinePoints(
  dailySeries: TimeSeriesPoint[],
  granularity: TimelineGranularity,
  _dateRange?: DateRange,
): RevenueChartPoint[] {
  if (!dailySeries || dailySeries.length === 0) {
    return []
  }

  // 1. By Weeks: Every single day is an inspectable point on the graph!
  // Sundays / Week starts are tagged as 'Week', while the final day is 'Latest'
  if (granularity === 'weeks') {
    return dailySeries.map((d, index) => {
      const dt = new Date(d.timestamp)
      const dateLabel = isNaN(dt.getTime()) ? `Day ${index + 1}` : formatDateLabel(dt)
      const dayName = isNaN(dt.getTime())
        ? ''
        : dt.toLocaleDateString('en-US', { weekday: 'long' })

      const isSunday = !isNaN(dt.getTime()) && dt.getDay() === 0
      const isLast = index === dailySeries.length - 1

      const isWeekMilestone = isSunday && !isLast
      const milestoneTag = isLast ? 'Latest' : isWeekMilestone ? 'Week' : undefined

      return {
        key: dateLabel,
        sublabel: dayName ? `${dayName}, ${dateLabel}` : dateLabel,
        revenue: d.revenue,
        orderCount: d.orderCount,
        customerCount: d.customerCount,
        itemCount: d.itemCount,
        isMilestone: Boolean(milestoneTag),
        milestoneShort: milestoneTag,
        milestoneLabel: milestoneTag,
      }
    })
  }

  // 2. By Months: Clean calendar months starting on the 1st
  // (Jan 1, Feb 1, March 1, April 1, May 1, June 1, July 1, Aug 1, Sept 1, Oct 1...)
  if (granularity === 'months') {
    const monthMap = new Map<
      string,
      {
        monthIndex: number
        year: number
        revenue: number
        orderCount: number
        customerCount: number
        itemCount: number
        firstDate: Date
      }
    >()

    for (const d of dailySeries) {
      const dt = new Date(d.timestamp)
      if (isNaN(dt.getTime())) continue
      const mIdx = dt.getMonth()
      const yr = dt.getFullYear()
      const key = `${yr}-${String(mIdx + 1).padStart(2, '0')}`

      const cur = monthMap.get(key) || {
        monthIndex: mIdx,
        year: yr,
        revenue: 0,
        orderCount: 0,
        customerCount: 0,
        itemCount: 0,
        firstDate: dt,
      }
      cur.revenue += d.revenue
      cur.orderCount += d.orderCount
      cur.customerCount += d.customerCount ?? 0
      cur.itemCount += d.itemCount ?? 0
      monthMap.set(key, cur)
    }

    const entries = Array.from(monthMap.entries()).sort((a, b) => a[0].localeCompare(b[0]))
    const isMultiYear =
      entries.length > 0 && entries[0][1].year !== entries[entries.length - 1][1].year

    return entries.map(([_, val], index) => {
      const isLast = index === entries.length - 1
      const baseLabel = MONTH_LABELS[val.monthIndex]
      const key = isMultiYear ? `${baseLabel} '${String(val.year).slice(-2)}` : baseLabel

      return {
        key,
        sublabel: `${MONTH_NAMES[val.monthIndex]} ${val.year}`,
        revenue: val.revenue,
        orderCount: val.orderCount,
        customerCount: val.customerCount,
        itemCount: val.itemCount,
        isMilestone: isLast,
        milestoneShort: isLast ? 'Latest' : undefined,
        milestoneLabel: isLast ? 'Latest' : undefined,
      }
    })
  }

  // 3. By Years: Multi-year sequence of months where January begins each 'Year'
  // Structure: Year -> Month -> Month -> Month -> Month -> Year -> Month...
  const monthMap = new Map<
    string,
    {
      monthIndex: number
      year: number
      revenue: number
      orderCount: number
      customerCount: number
      itemCount: number
    }
  >()

  for (const d of dailySeries) {
    const dt = new Date(d.timestamp)
    if (isNaN(dt.getTime())) continue
    const mIdx = dt.getMonth()
    const yr = dt.getFullYear()
    const key = `${yr}-${String(mIdx + 1).padStart(2, '0')}`

    const cur = monthMap.get(key) || {
      monthIndex: mIdx,
      year: yr,
      revenue: 0,
      orderCount: 0,
      customerCount: 0,
      itemCount: 0,
    }
    cur.revenue += d.revenue
    cur.orderCount += d.orderCount
    cur.customerCount += d.customerCount ?? 0
    cur.itemCount += d.itemCount ?? 0
    monthMap.set(key, cur)
  }

  const entries = Array.from(monthMap.entries()).sort((a, b) => a[0].localeCompare(b[0]))

  return entries.map(([_, val], index) => {
    const isLast = index === entries.length - 1
    const isFirstOfYear = val.monthIndex === 0 && !isLast

    // For January (start of year), display Year; for other months, display month
    const key = isFirstOfYear ? `${val.year}` : MONTH_LABELS[val.monthIndex]
    const milestoneTag = isLast ? 'Latest' : isFirstOfYear ? 'Year' : undefined

    return {
      key,
      sublabel: `${MONTH_NAMES[val.monthIndex]} ${val.year}`,
      revenue: val.revenue,
      orderCount: val.orderCount,
      customerCount: val.customerCount,
      itemCount: val.itemCount,
      isMilestone: Boolean(milestoneTag),
      milestoneShort: milestoneTag,
      milestoneLabel: milestoneTag,
    }
  })
}

/**
 * Builds points for Trend Analysis mode (Revenue):
 * - 'weekly': Sunday to Saturday performance with peak day highlighted
 * - 'monthly': Month-by-month performance with peak month highlighted
 */
export function buildTrendPoints(
  trendType: TrendAnalysisType,
  dayOfWeekSeries: DayOfWeekPoint[],
  monthPerformanceSeries: MonthPerformancePoint[],
): RevenueChartPoint[] {
  if (trendType === 'weekly') {
    if (!dayOfWeekSeries || dayOfWeekSeries.length === 0) return []

    const maxRevenue = Math.max(...dayOfWeekSeries.map((d) => d.revenue), 0)

    return dayOfWeekSeries.map((d) => {
      const isPeak = d.revenue === maxRevenue && maxRevenue > 0
      return {
        key: d.shortName,
        sublabel: d.dayName,
        revenue: d.revenue,
        orderCount: d.orderCount,
        customerCount: d.customerCount,
        itemCount: d.itemCount,
        isPeak,
        peakBadge: isPeak ? 'Peak' : undefined,
      }
    })
  }

  // Monthly Performance
  if (!monthPerformanceSeries || monthPerformanceSeries.length === 0) return []

  const maxRevenue = Math.max(...monthPerformanceSeries.map((m) => m.revenue), 0)

  return monthPerformanceSeries.map((m) => {
    const isPeak = m.revenue === maxRevenue && maxRevenue > 0
    return {
      key: m.shortName,
      sublabel: m.monthName,
      revenue: m.revenue,
      orderCount: m.orderCount,
      customerCount: m.customerCount,
      itemCount: m.itemCount,
      isPeak,
      peakBadge: isPeak ? 'Peak' : undefined,
    }
  })
}

/**
 * Builds points for Dining / Peak Hour Trend Analysis mode:
 * - 'weekly': Sunday to Saturday traffic with peak day highlighted
 * - 'monthly': Month-by-month traffic with peak month highlighted
 */
export function buildDiningTrendPoints(
  trendType: TrendAnalysisType,
  dayOfWeekSeries: DayOfWeekPoint[],
  monthPerformanceSeries: MonthPerformancePoint[],
): RevenueChartPoint[] {
  if (trendType === 'weekly') {
    if (!dayOfWeekSeries || dayOfWeekSeries.length === 0) return []

    const maxTraffic = Math.max(
      ...dayOfWeekSeries.map((d) => ((d.customerCount ?? 0) + (d.itemCount ?? 0)) / 2),
      0,
    )

    return dayOfWeekSeries.map((d) => {
      const avgTraffic = ((d.customerCount ?? 0) + (d.itemCount ?? 0)) / 2
      const isPeak = avgTraffic === maxTraffic && maxTraffic > 0
      return {
        key: d.shortName,
        sublabel: d.dayName,
        revenue: d.revenue,
        orderCount: d.orderCount,
        customerCount: d.customerCount,
        itemCount: d.itemCount,
        isPeak,
        peakBadge: isPeak ? 'Peak' : undefined,
      }
    })
  }

  // Monthly Dining Performance
  if (!monthPerformanceSeries || monthPerformanceSeries.length === 0) return []

  const maxTraffic = Math.max(
    ...monthPerformanceSeries.map((m) => ((m.customerCount ?? 0) + (m.itemCount ?? 0)) / 2),
    0,
  )

  return monthPerformanceSeries.map((m) => {
    const avgTraffic = ((m.customerCount ?? 0) + (m.itemCount ?? 0)) / 2
    const isPeak = avgTraffic === maxTraffic && maxTraffic > 0
    return {
      key: m.shortName,
      sublabel: m.monthName,
      revenue: m.revenue,
      orderCount: m.orderCount,
      customerCount: m.customerCount,
      itemCount: m.itemCount,
      isPeak,
      peakBadge: isPeak ? 'Peak' : undefined,
    }
  })
}
