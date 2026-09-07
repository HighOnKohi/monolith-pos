import { supabase } from '@/lib/supabase'

export type DateRangePreset =
  | 'today'
  | 'yesterday'
  | 'last7days'
  | 'last30days'
  | 'thisMonth'
  | 'lastMonth'
  | 'custom'

export interface DateRange {
  preset: DateRangePreset
  startDate: Date
  endDate: Date
  label: string
}

export interface TimeSeriesPoint {
  key: string // e.g. "14:00" or "Sep 07"
  timestamp: string
  revenue: number
  orderCount: number
  customerCount: number | null
}

export interface TopItemStat {
  itemId: number
  itemName: string
  categoryName: string
  quantity: number
  revenue: number
  percentageOfSales: number
}

export interface CategoryStat {
  categoryId: number
  categoryName: string
  itemsSold: number
  revenue: number
  percentageOfRevenue: number
}

export interface StatusStat {
  status: string
  count: number
  percentage: number
}

export interface BreakdownStat {
  label: string
  count: number
  percentage: number
  revenue?: number
}

export interface ServingTimeBreakdown {
  under15Min: number
  between15And30Min: number
  over30Min: number
  totalSampled: number
  under15MinPct: number
  between15And30MinPct: number
  over30MinPct: number
}

export interface AnalyticsSummary {
  // Primary KPIs
  revenue: number
  subtotalRevenue: number
  totalDiscounts: number
  completedOrders: number
  customersServed: number | null // null = unavailable in DB
  averageOrderValue: number
  averageSpendPerCustomer: number | null // null = unavailable in DB
  averageServingTimeMinutes: number | null // null = unavailable in DB
  averagePrepTimeMinutes: number | null
  averageDeliveryTimeMinutes: number | null
  averageTurnaroundTimeMinutes: number | null
  fastestServingTimeMinutes: number | null
  slowestServingTimeMinutes: number | null
  servingTimeBreakdown: ServingTimeBreakdown | null
  topItem: TopItemStat | null
  itemsSold: number
  cancelledOrders: number

  // Period comparisons (% change vs previous equivalent period)
  revenueChangePercent: number | null
  ordersChangePercent: number | null
  customersChangePercent: number | null

  // Customer insights
  customerToOrderRatio: number | null
  peakCustomerPeriod: { period: string; count: number } | null

  // Peak sales periods
  peakHour: string | null
  peakDay: string | null

  // Aggregated series & breakdowns
  timeSeries: TimeSeriesPoint[]
  topItems: TopItemStat[]
  categoryStats: CategoryStat[]
  statusBreakdown: StatusStat[]
  orderTypeBreakdown: BreakdownStat[] // DINE-IN vs TAKEOUT
  channelBreakdown: BreakdownStat[]   // Cashier vs Customer

  // Range metadata
  dateRange: DateRange
}

/**
 * Parses a database timestamp string into a Date object.
 * Because orderService.ts persists timestamps using `new Date().toISOString()`,
 * timestamps in PostgreSQL (which is timestamp without time zone) represent UTC.
 * If the string lacks timezone metadata, we append 'Z' so it correctly renders in local time.
 */
export function parseDbTimestamp(timeVal: unknown): Date | null {
  if (!timeVal) return null
  const s = String(timeVal).trim()
  if (!s) return null
  const hasTz = s.endsWith('Z') || s.includes('+') || (s.length > 10 && s[10] === 'T' && s.slice(10).includes('-'))
  const iso = hasTz ? s : s.replace(' ', 'T') + 'Z'
  const d = new Date(iso)
  return isNaN(d.getTime()) ? new Date(s) : d
}

/**
 * Calculates start and end Date objects for preset date ranges.
 */
export function getDateRangeFromPreset(preset: DateRangePreset, customStart?: Date, customEnd?: Date): DateRange {
  const now = new Date()

  switch (preset) {
    case 'today': {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
      return { preset, startDate: start, endDate: end, label: 'Today' }
    }
    case 'yesterday': {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0)
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999)
      return { preset, startDate: start, endDate: end, label: 'Yesterday' }
    }
    case 'last7days': {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0)
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
      return { preset, startDate: start, endDate: end, label: 'Last 7 Days' }
    }
    case 'last30days': {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29, 0, 0, 0, 0)
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
      return { preset, startDate: start, endDate: end, label: 'Last 30 Days' }
    }
    case 'thisMonth': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
      return { preset, startDate: start, endDate: end, label: 'This Month' }
    }
    case 'lastMonth': {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0)
      const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)
      return { preset, startDate: start, endDate: end, label: 'Last Month' }
    }
    case 'custom': {
      const start = customStart ? new Date(customStart) : new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7, 0, 0, 0, 0)
      const end = customEnd ? new Date(customEnd) : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
      return {
        preset,
        startDate: start,
        endDate: end,
        label: `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
      }
    }
  }
}

/**
 * Calculates previous equivalent date range for comparisons.
 */
function getPreviousPeriod(startDate: Date, endDate: Date): { prevStart: Date; prevEnd: Date } {
  const durationMs = endDate.getTime() - startDate.getTime()
  const prevEnd = new Date(startDate.getTime() - 1)
  const prevStart = new Date(prevEnd.getTime() - durationMs)
  return { prevStart, prevEnd }
}

/**
 * Formats a Date object to ISO string matching Supabase timestamp filtering.
 */
function toIsoDate(d: Date): string {
  return d.toISOString()
}

/**
 * Main service function to fetch and aggregate analytics for the given date range.
 */
export async function fetchAnalyticsData(range: DateRange): Promise<AnalyticsSummary> {
  const { startDate, endDate } = range
  const { prevStart, prevEnd } = getPreviousPeriod(startDate, endDate)

  // 1. Fetch orders in the selected period
  const { data: currentOrders, error: ordersError } = await supabase
    .from('Restaurant_Orders')
    .select('*')
    .gte('TIME', toIsoDate(startDate))
    .lte('TIME', toIsoDate(endDate))
    .order('TIME', { ascending: true })

  if (ordersError) {
    console.error('[analyticsService] Error fetching current orders:', ordersError)
    throw ordersError
  }

  // 2. Fetch orders in the previous equivalent period for % comparison
  const { data: previousOrders, error: prevOrdersError } = await supabase
    .from('Restaurant_Orders')
    .select('ORDER_STATUS, TOTAL_BILL, GUEST_COUNT')
    .gte('TIME', toIsoDate(prevStart))
    .lte('TIME', toIsoDate(prevEnd))

  if (prevOrdersError) {
    console.warn('[analyticsService] Error fetching previous period orders:', prevOrdersError)
  }

  const allOrders = currentOrders ?? []
  const prevOrders = previousOrders ?? []

  // Filter completed and cancelled orders
  const completedOrdersList = allOrders.filter((o) => o['ORDER_STATUS'] === 'COMPLETED')
  const cancelledOrdersList = allOrders.filter((o) => o['ORDER_STATUS'] === 'CANCELLED')
  const completedOrderIds = completedOrdersList.map((o) => Number(o['ORDER_ID']))

  // 3. Fetch Order_Items joined with Menu_Items and Menu_Categories for completed orders
  let orderItemsData: Array<Record<string, unknown>> = []
  if (completedOrderIds.length > 0) {
    const { data: itemsData, error: itemsError } = await supabase
      .from('Order_Items')
      .select(`
        ORDER_ITEM_ID,
        ORDER_ID,
        ITEM_ID,
        ORDER_ITEM_STATUS,
        Menu_Items (
          ITEM_ID,
          ITEM_NAME,
          ITEM_PRICE,
          CATEGORY_ID,
          Menu_Categories (
            CATEGORY_ID,
            CATEGORY_NAME
          )
        )
      `)
      .in('ORDER_ID', completedOrderIds)

    if (itemsError) {
      console.error('[analyticsService] Error fetching order items:', itemsError)
      throw itemsError
    }
    orderItemsData = (itemsData ?? []) as Array<Record<string, unknown>>
  }

  // 4. Calculate Core KPIs using TOTAL_BILL and SUBTOTAL_BILL from Restaurant_Orders
  const totalRevenue = completedOrdersList.reduce((sum, o) => sum + (Number(o['TOTAL_BILL']) || 0), 0)
  const subtotalRevenue = completedOrdersList.reduce(
    (sum, o) => sum + (Number(o['SUBTOTAL_BILL']) || Number(o['TOTAL_BILL']) || 0),
    0,
  )
  const totalDiscounts = Math.max(subtotalRevenue - totalRevenue, 0)
  const completedCount = completedOrdersList.length
  const aov = completedCount > 0 ? totalRevenue / completedCount : 0
  const itemsSoldCount = orderItemsData.length

  // Previous period KPIs for % delta
  const prevCompletedOrders = prevOrders.filter((o) => o['ORDER_STATUS'] === 'COMPLETED')
  const prevRevenue = prevCompletedOrders.reduce((sum, o) => sum + (Number(o['TOTAL_BILL']) || 0), 0)
  const prevCompletedCount = prevCompletedOrders.length

  const revenueChangePercent =
    prevRevenue > 0
      ? Math.round(((totalRevenue - prevRevenue) / prevRevenue) * 1000) / 10
      : prevRevenue === 0 && totalRevenue > 0
        ? 100
        : null

  const ordersChangePercent =
    prevCompletedCount > 0
      ? Math.round(((completedCount - prevCompletedCount) / prevCompletedCount) * 1000) / 10
      : prevCompletedCount === 0 && completedCount > 0
        ? 100
        : null

  // Customer metrics calculation (using GUEST_COUNT)
  const ordersWithGuests = completedOrdersList.filter(
    (o) => o['GUEST_COUNT'] !== null && o['GUEST_COUNT'] !== undefined && Number(o['GUEST_COUNT']) > 0,
  )
  const hasCustomerData = ordersWithGuests.length > 0
  const customersServed = hasCustomerData
    ? ordersWithGuests.reduce((sum, o) => sum + Number(o['GUEST_COUNT']), 0)
    : null

  const averageSpendPerCustomer =
    customersServed !== null && customersServed > 0
      ? Math.round((totalRevenue / customersServed) * 100) / 100
      : null

  const customerToOrderRatio =
    customersServed !== null && completedCount > 0
      ? Math.round((customersServed / completedCount) * 10) / 10
      : null

  const prevOrdersWithGuests = prevCompletedOrders.filter(
    (o) => o['GUEST_COUNT'] !== null && o['GUEST_COUNT'] !== undefined && Number(o['GUEST_COUNT']) > 0,
  )
  const prevCustomersServed =
    prevOrdersWithGuests.length > 0
      ? prevOrdersWithGuests.reduce((sum, o) => sum + Number(o['GUEST_COUNT']), 0)
      : null

  const customersChangePercent =
    prevCustomersServed !== null && customersServed !== null && prevCustomersServed > 0
      ? Math.round(((customersServed - prevCustomersServed) / prevCustomersServed) * 1000) / 10
      : prevCustomersServed === 0 && customersServed !== null && customersServed > 0
        ? 100
        : null

  // Kitchen & Serving times analysis (using TIME, READY_AT, SERVED_AT, COMPLETED_AT)
  const prepDurations: number[] = []
  const deliveryDurations: number[] = []
  const servingDurations: number[] = []
  const turnaroundDurations: number[] = []

  for (const o of completedOrdersList) {
    const timeDate = parseDbTimestamp(o['TIME'])
    const readyDate = parseDbTimestamp(o['READY_AT'])
    const servedDate = parseDbTimestamp(o['SERVED_AT'])
    const completedDate = parseDbTimestamp(o['COMPLETED_AT'])

    if (timeDate && readyDate) {
      const prepMins = (readyDate.getTime() - timeDate.getTime()) / 60000
      if (prepMins >= 0 && prepMins < 1440) {
        prepDurations.push(prepMins)
      }
    }

    if (readyDate && servedDate) {
      const delMins = (servedDate.getTime() - readyDate.getTime()) / 60000
      if (delMins >= 0 && delMins < 1440) {
        deliveryDurations.push(delMins)
      }
    }

    if (timeDate && servedDate) {
      const servMins = (servedDate.getTime() - timeDate.getTime()) / 60000
      if (servMins >= 0 && servMins < 1440) {
        servingDurations.push(servMins)
      }
    }

    if (timeDate && completedDate) {
      const turnMins = (completedDate.getTime() - timeDate.getTime()) / 60000
      if (turnMins >= 0 && turnMins < 1440) {
        turnaroundDurations.push(turnMins)
      }
    }
  }

  const averageServingTimeMinutes =
    servingDurations.length > 0
      ? Math.round((servingDurations.reduce((a, b) => a + b, 0) / servingDurations.length) * 10) / 10
      : null

  const fastestServingTimeMinutes =
    servingDurations.length > 0
      ? Math.round(Math.min(...servingDurations) * 10) / 10
      : null

  const slowestServingTimeMinutes =
    servingDurations.length > 0
      ? Math.round(Math.max(...servingDurations) * 10) / 10
      : null

  const averagePrepTimeMinutes =
    prepDurations.length > 0
      ? Math.round((prepDurations.reduce((a, b) => a + b, 0) / prepDurations.length) * 10) / 10
      : null

  const averageDeliveryTimeMinutes =
    deliveryDurations.length > 0
      ? Math.round((deliveryDurations.reduce((a, b) => a + b, 0) / deliveryDurations.length) * 10) / 10
      : null

  const averageTurnaroundTimeMinutes =
    turnaroundDurations.length > 0
      ? Math.round((turnaroundDurations.reduce((a, b) => a + b, 0) / turnaroundDurations.length) * 10) / 10
      : null

  let servingTimeBreakdown: ServingTimeBreakdown | null = null
  if (servingDurations.length > 0) {
    const totalSampled = servingDurations.length
    const under15 = servingDurations.filter((d) => d < 15).length
    const between15And30 = servingDurations.filter((d) => d >= 15 && d <= 30).length
    const over30 = servingDurations.filter((d) => d > 30).length

    servingTimeBreakdown = {
      under15Min: under15,
      between15And30Min: between15And30,
      over30Min: over30,
      totalSampled,
      under15MinPct: Math.round((under15 / totalSampled) * 1000) / 10,
      between15And30MinPct: Math.round((between15And30 / totalSampled) * 1000) / 10,
      over30MinPct: Math.round((over30 / totalSampled) * 1000) / 10,
    }
  }

  // 5. Aggregate Top Selling Items
  const itemMap = new Map<number, { name: string; category: string; qty: number; revenue: number }>()

  for (const oi of orderItemsData) {
    const menuItem = oi['Menu_Items'] as Record<string, unknown> | null
    if (!menuItem) continue
    const itemId = Number(menuItem['ITEM_ID'])
    const itemName = String(menuItem['ITEM_NAME'] || 'Unknown Item')
    const itemPrice = Number(menuItem['ITEM_PRICE'] || 0)
    const categoryObj = menuItem['Menu_Categories'] as Record<string, unknown> | null
    const categoryName = categoryObj ? String(categoryObj['CATEGORY_NAME']) : 'Uncategorized'

    const existing = itemMap.get(itemId) ?? { name: itemName, category: categoryName, qty: 0, revenue: 0 }
    existing.qty += 1
    existing.revenue += itemPrice
    itemMap.set(itemId, existing)
  }

  const topItems: TopItemStat[] = Array.from(itemMap.entries())
    .map(([id, val]) => ({
      itemId: id,
      itemName: val.name,
      categoryName: val.category,
      quantity: val.qty,
      revenue: val.revenue,
      percentageOfSales: itemsSoldCount > 0 ? Math.round((val.qty / itemsSoldCount) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
    .slice(0, 10)

  const topItem = topItems.length > 0 ? topItems[0] : null

  // 6. Aggregate Category Performance
  const categoryMap = new Map<string, { id: number; qty: number; revenue: number }>()

  for (const oi of orderItemsData) {
    const menuItem = oi['Menu_Items'] as Record<string, unknown> | null
    if (!menuItem) continue
    const itemPrice = Number(menuItem['ITEM_PRICE'] || 0)
    const categoryObj = menuItem['Menu_Categories'] as Record<string, unknown> | null
    const categoryName = categoryObj ? String(categoryObj['CATEGORY_NAME']) : 'Uncategorized'
    const categoryId = categoryObj ? Number(categoryObj['CATEGORY_ID']) : 0

    const current = categoryMap.get(categoryName) ?? { id: categoryId, qty: 0, revenue: 0 }
    current.qty += 1
    current.revenue += itemPrice
    categoryMap.set(categoryName, current)
  }

  const categoryStats: CategoryStat[] = Array.from(categoryMap.entries())
    .map(([catName, val]) => ({
      categoryId: val.id,
      categoryName: catName,
      itemsSold: val.qty,
      revenue: val.revenue,
      percentageOfRevenue: totalRevenue > 0 ? Math.round((val.revenue / totalRevenue) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)

  // 7. Order Status Breakdown
  const statusCounts = new Map<string, number>()
  const validStatuses = ['COMPLETED', 'CANCELLED', 'SERVED', 'READY', 'PREPARING', 'VERIFIED', 'REQUESTED']
  validStatuses.forEach((st) => statusCounts.set(st, 0))

  for (const o of allOrders) {
    const st = String(o['ORDER_STATUS'] || 'REQUESTED')
    statusCounts.set(st, (statusCounts.get(st) || 0) + 1)
  }

  const totalAllOrders = allOrders.length
  const statusBreakdown: StatusStat[] = Array.from(statusCounts.entries())
    .map(([status, count]) => ({
      status,
      count,
      percentage: totalAllOrders > 0 ? Math.round((count / totalAllOrders) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count)

  // 8. Order Type Breakdown (DINE-IN vs TAKEOUT from Restaurant_Orders)
  const orderTypeMap = new Map<string, { count: number; revenue: number }>()
  for (const o of completedOrdersList) {
    const rawType = String(o['ORDER_TYPE'] || 'DINE-IN').toUpperCase()
    const typeLabel = rawType.includes('TAKEOUT') ? 'Takeout' : 'Dine-in'
    const cur = orderTypeMap.get(typeLabel) ?? { count: 0, revenue: 0 }
    cur.count += 1
    cur.revenue += Number(o['TOTAL_BILL']) || 0
    orderTypeMap.set(typeLabel, cur)
  }

  const orderTypeBreakdown: BreakdownStat[] = Array.from(orderTypeMap.entries()).map(([label, data]) => ({
    label,
    count: data.count,
    revenue: data.revenue,
    percentage: completedCount > 0 ? Math.round((data.count / completedCount) * 1000) / 10 : 0,
  }))

  // 9. Channel Breakdown (Cashier vs Customer from REQUESTED_FROM)
  const channelMap = new Map<string, { count: number; revenue: number }>()
  for (const o of completedOrdersList) {
    const rawChan = String(o['REQUESTED_FROM'] || 'Cashier').toLowerCase()
    const channelLabel = rawChan.includes('customer') ? 'Customer App' : 'Cashier Station'
    const cur = channelMap.get(channelLabel) ?? { count: 0, revenue: 0 }
    cur.count += 1
    cur.revenue += Number(o['TOTAL_BILL']) || 0
    channelMap.set(channelLabel, cur)
  }

  const channelBreakdown: BreakdownStat[] = Array.from(channelMap.entries()).map(([label, data]) => ({
    label,
    count: data.count,
    revenue: data.revenue,
    percentage: completedCount > 0 ? Math.round((data.count / completedCount) * 1000) / 10 : 0,
  }))

  // 10. Time Series Aggregation (Hourly if single day, Daily if multi-day)
  const isSingleDay =
    startDate.getFullYear() === endDate.getFullYear() &&
    startDate.getMonth() === endDate.getMonth() &&
    startDate.getDate() === endDate.getDate()

  const timeSeriesMap = new Map<string, TimeSeriesPoint>()

  if (isSingleDay) {
    // Generate buckets for all 24 hours
    for (let hour = 0; hour < 24; hour++) {
      const hStr = `${hour.toString().padStart(2, '0')}:00`
      timeSeriesMap.set(hStr, {
        key: hStr,
        timestamp: `${toIsoDate(startDate).slice(0, 10)}T${hStr}:00`,
        revenue: 0,
        orderCount: 0,
        customerCount: hasCustomerData ? 0 : null,
      })
    }

    for (const o of completedOrdersList) {
      const orderDate = parseDbTimestamp(o['TIME'])
      if (!orderDate) continue
      const hStr = `${orderDate.getHours().toString().padStart(2, '0')}:00`
      const point = timeSeriesMap.get(hStr)
      if (point) {
        point.revenue += Number(o['TOTAL_BILL']) || 0
        point.orderCount += 1
        if (hasCustomerData) {
          point.customerCount = (point.customerCount || 0) + (Number(o['GUEST_COUNT']) || 1)
        }
      }
    }
  } else {
    // Generate day buckets across the range
    const cursor = new Date(startDate)
    cursor.setHours(0, 0, 0, 0)
    const endMidnight = new Date(endDate)
    endMidnight.setHours(23, 59, 59, 999)

    while (cursor <= endMidnight) {
      const key = cursor.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      const isoStr = cursor.toISOString()
      if (!timeSeriesMap.has(key)) {
        timeSeriesMap.set(key, {
          key,
          timestamp: isoStr,
          revenue: 0,
          orderCount: 0,
          customerCount: hasCustomerData ? 0 : null,
        })
      }
      cursor.setDate(cursor.getDate() + 1)
    }

    for (const o of completedOrdersList) {
      const orderDate = parseDbTimestamp(o['TIME'])
      if (!orderDate) continue
      const key = orderDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      const point = timeSeriesMap.get(key)
      if (point) {
        point.revenue += Number(o['TOTAL_BILL']) || 0
        point.orderCount += 1
        if (hasCustomerData) {
          point.customerCount = (point.customerCount || 0) + (Number(o['GUEST_COUNT']) || 1)
        }
      }
    }
  }

  const timeSeries = Array.from(timeSeriesMap.values())

  // Calculate Peak Customer Seating Period
  let peakCustomerPeriod: { period: string; count: number } | null = null
  if (hasCustomerData) {
    let maxGuests = 0
    for (const pt of timeSeries) {
      if (pt.customerCount && pt.customerCount > maxGuests) {
        maxGuests = pt.customerCount
        peakCustomerPeriod = { period: pt.key, count: pt.customerCount }
      }
    }
  }

  // Calculate Peak Ordering Hour and Peak Day in local time
  let peakHour: string | null = null
  let maxHourOrders = 0
  const hourlyCount = new Map<string, number>()

  for (const o of completedOrdersList) {
    const d = parseDbTimestamp(o['TIME'])
    if (!d) continue
    const hr = d.getHours()
    const label = `${hr === 0 ? '12 AM' : hr < 12 ? `${hr} AM` : hr === 12 ? '12 PM' : `${hr - 12} PM`}`
    const c = (hourlyCount.get(label) || 0) + 1
    hourlyCount.set(label, c)
    if (c > maxHourOrders) {
      maxHourOrders = c
      peakHour = label
    }
  }

  let peakDay: string | null = null
  let maxDayOrders = 0
  const dailyCount = new Map<string, number>()

  for (const o of completedOrdersList) {
    const d = parseDbTimestamp(o['TIME'])
    if (!d) continue
    const dayLabel = d.toLocaleDateString('en-US', { weekday: 'long' })
    const c = (dailyCount.get(dayLabel) || 0) + 1
    dailyCount.set(dayLabel, c)
    if (c > maxDayOrders) {
      maxDayOrders = c
      peakDay = dayLabel
    }
  }

  return {
    revenue: totalRevenue,
    subtotalRevenue,
    totalDiscounts,
    completedOrders: completedCount,
    customersServed,
    averageOrderValue: Math.round(aov * 100) / 100,
    averageSpendPerCustomer,
    averageServingTimeMinutes,
    averagePrepTimeMinutes,
    averageDeliveryTimeMinutes,
    averageTurnaroundTimeMinutes,
    fastestServingTimeMinutes,
    slowestServingTimeMinutes,
    servingTimeBreakdown,
    topItem,
    itemsSold: itemsSoldCount,
    cancelledOrders: cancelledOrdersList.length,

    revenueChangePercent,
    ordersChangePercent,
    customersChangePercent,

    customerToOrderRatio,
    peakCustomerPeriod,

    peakHour: peakHour ? `${peakHour} (${maxHourOrders} orders)` : null,
    peakDay: peakDay ? `${peakDay} (${maxDayOrders} orders)` : null,

    timeSeries,
    topItems,
    categoryStats,
    statusBreakdown,
    orderTypeBreakdown,
    channelBreakdown,
    dateRange: range,
  }
}

/**
 * Administrative action to purge completed and cancelled orders.
 * Strictly verifies admin credentials using Supabase auth before deletion.
 */
export async function clearAnalyticsData(adminEmail: string, adminPassword: string): Promise<{ success: boolean; deletedOrdersCount: number }> {
  // 1. Authenticate admin credentials with Supabase
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: adminEmail.trim(),
    password: adminPassword,
  })

  if (authError || !authData.user) {
    throw new Error(authError?.message || 'Invalid administrator email or password.')
  }

  // 2. Fetch IDs of COMPLETED and CANCELLED orders to purge
  const { data: targetOrders, error: fetchErr } = await supabase
    .from('Restaurant_Orders')
    .select('ORDER_ID')
    .in('ORDER_STATUS', ['COMPLETED', 'CANCELLED'])

  if (fetchErr) {
    console.error('[analyticsService] Error fetching orders to delete:', fetchErr)
    throw fetchErr
  }

  if (!targetOrders || targetOrders.length === 0) {
    return { success: true, deletedOrdersCount: 0 }
  }

  const orderIds = targetOrders.map((o) => Number(o['ORDER_ID']))

  // 3. Delete child Order_Items first to prevent FK constraints
  const { error: itemsDelErr } = await supabase
    .from('Order_Items')
    .delete()
    .in('ORDER_ID', orderIds)

  if (itemsDelErr) {
    console.error('[analyticsService] Failed to delete child Order_Items:', itemsDelErr)
    throw itemsDelErr
  }

  // 4. Delete Restaurant_Orders
  const { error: ordersDelErr } = await supabase
    .from('Restaurant_Orders')
    .delete()
    .in('ORDER_ID', orderIds)

  if (ordersDelErr) {
    console.error('[analyticsService] Failed to delete Restaurant_Orders:', ordersDelErr)
    throw ordersDelErr
  }

  return { success: true, deletedOrdersCount: orderIds.length }
}
