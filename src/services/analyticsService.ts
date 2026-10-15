import { supabase } from '@/lib/supabase'

export type DateRangePreset =
  | 'thisWeek'
  | 'last3Weeks'
  | 'thisMonth'
  | 'last3Months'
  | 'thisYear'
  | 'last3Years'
  | 'custom'
  // legacy fallbacks
  | 'today'
  | 'yesterday'
  | 'last7days'
  | 'last30days'
  | 'lastMonth'

export interface DateRange {
  preset: DateRangePreset
  startDate: Date
  endDate: Date
  label: string
}

export interface TimeSeriesPoint {
  key: string // e.g. "14:00" or "Sep 07" or "Mon"
  timestamp: string
  revenue: number
  standardRevenue?: number
  eventRevenue?: number
  orderCount: number
  customerCount: number | null
  itemCount: number
}

export interface EventAnalyticsItem {
  eventId: number
  title: string
  category: string
  color: string | null
  startAt: string
  endAt: string
  maxPax: number
  generatesRevenue: boolean
  revenueEarned: number
  revenuePerGuest: number
  performanceTier: 'good' | 'poor' | 'neutral'
  performanceLabel: string
}

export interface MonthPerformancePoint {
  monthIndex: number
  monthName: string
  shortName: string
  year: number
  key: string
  revenue: number
  orderCount: number
  customerCount: number | null
  itemCount: number
}

export interface DayOfWeekPoint extends TimeSeriesPoint {
  dayIndex: number
  dayName: string
  shortName: string
}

export interface DayOfWeekItemStats {
  dayName: string
  shortName: string
  topItems: ItemSalesStat[]
  leastItems: ItemSalesStat[]
  allItems: ItemSalesStat[]
}

export interface MonthItemStats {
  monthIndex: number
  monthName: string
  shortName: string
  topItems: ItemSalesStat[]
  leastItems: ItemSalesStat[]
  allItems: ItemSalesStat[]
}

export interface ItemSalesStat {
  itemId: number
  itemName: string
  categoryName: string
  unitPrice: number
  quantity: number
  revenue: number
  percentageOfSales: number // % of all items sold
  percentageOfRevenue: number // % of total revenue
  orderCount: number // distinct orders containing this item
  dineInCount: number // units sold via Dine-In
  takeoutCount: number // units sold via Takeout
  customerAppCount: number // units ordered via Customer app
  cashierCount: number // units ordered via Cashier station 
  ticketCount?: number // units ordered via Ticketing
  isAvailable?: boolean
}

export type TopItemStat = ItemSalesStat

export interface CategoryStat {
  categoryId: number
  categoryName: string
  itemsSold: number
  revenue: number
  percentageOfRevenue: number
}

export interface PresetPerformanceStat {
  presetId: number
  presetName: string
  itemsSold: number
  percentageOfSales: number
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
  dailySeries: TimeSeriesPoint[]
  dayOfWeekSeries: DayOfWeekPoint[]
  monthPerformanceSeries: MonthPerformancePoint[]
  dayOfWeekItemStats: Record<string, DayOfWeekItemStats>
  monthItemStats: Record<string, MonthItemStats>
  topItems: ItemSalesStat[]
  leastItems: ItemSalesStat[]
  allItems: ItemSalesStat[]
  categoryStats: CategoryStat[]
  presetStats: PresetPerformanceStat[]
  statusBreakdown: StatusStat[]
  orderTypeBreakdown: BreakdownStat[] // DINE-IN vs TAKEOUT
  channelBreakdown: BreakdownStat[]   // Service vs Customer

  // Order Source Comparison (Pie Chart: Service Staff vs Customer Interface)
  orderSourceComparison: {
    service: { count: number; percentage: number; revenue: number }
    customer: { count: number; percentage: number; revenue: number }
    totalCount: number
    totalRevenue: number
  }

  // Events Analytics
  eventsList: EventAnalyticsItem[]
  totalEventRevenue: number
  totalStandardRevenue: number

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
 * Resolves timestamp for a Ticket_Orders record.
 * Uses CREATED_AT, created_at, or TIME if available.
 * Otherwise maps REGISTERED_TIME_OF_ARRIVAL to the current calendar date.
 */
export function parseTicketOrderTimestamp(ticket: Record<string, unknown>): Date | null {
  const explicit = ticket['CREATED_AT'] || ticket['created_at'] || ticket['TIME'] || ticket['COMPLETED_AT']
  if (explicit) {
    const d = parseDbTimestamp(explicit)
    if (d) return d
  }

  const arrival = ticket['REGISTERED_TIME_OF_ARRIVAL']
  if (typeof arrival === 'string' && arrival.includes(':')) {
    const parts = arrival.split(':').map((p) => parseInt(p, 10))
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), parts[0] || 0, parts[1] || 0, parts[2] || 0)
  }

  return null
}

/**
 * Calculates start and end Date objects for preset date ranges.
 */
export function getDateRangeFromPreset(preset: DateRangePreset, customStart?: Date, customEnd?: Date): DateRange {
  const now = new Date()

  switch (preset) {
    case 'thisWeek': {
      const start = new Date(now)
      const day = start.getDay() // 0 = Sunday, 1 = Monday, ...
      start.setDate(start.getDate() - day)
      start.setHours(0, 0, 0, 0)
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
      return { preset, startDate: start, endDate: end, label: 'This Week' }
    }
    case 'last3Weeks': {
      const start = new Date(now)
      start.setDate(start.getDate() - 20)
      start.setHours(0, 0, 0, 0)
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
      return { preset, startDate: start, endDate: end, label: 'Last 3 Weeks' }
    }
    case 'thisMonth': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
      return { preset, startDate: start, endDate: end, label: 'This Month' }
    }
    case 'last3Months': {
      const start = new Date(now.getFullYear(), now.getMonth() - 2, 1, 0, 0, 0, 0)
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
      return { preset, startDate: start, endDate: end, label: 'Last 3 Months' }
    }
    case 'thisYear': {
      const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0)
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
      return { preset, startDate: start, endDate: end, label: 'This Year' }
    }
    case 'last3Years': {
      const start = new Date(now.getFullYear() - 2, 0, 1, 0, 0, 0, 0)
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
      return { preset, startDate: start, endDate: end, label: 'Last 3 Years' }
    }
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

  // 1. Fetch completed orders from system_history.Order_History
  const { data: rawCompletedOrders, error: completedOrdersErr } = await supabase
    .schema('system_history')
    .from('Order_History')
    .select('*')
    .gte('TIME', toIsoDate(startDate))
    .lte('TIME', toIsoDate(endDate))
    .order('TIME', { ascending: true })

  if (completedOrdersErr) {
    console.warn('[analyticsService] Note on Order_History table:', completedOrdersErr.message)
  }

  // Also query Restaurant_Orders for active/legacy orders in period
  const { data: currentOrders, error: ordersError } = await supabase
    .from('Restaurant_Orders')
    .select('*')
    .gte('TIME', toIsoDate(startDate))
    .lte('TIME', toIsoDate(endDate))
    .order('TIME', { ascending: true })
    .limit(10000)

  if (ordersError) {
    console.error('[analyticsService] Error fetching restaurant orders:', ordersError)
  }

  // 1b. Fetch ticket orders with items, menu items, and meal packages
  const { data: rawTicketOrders, error: ticketOrdersError } = await supabase
    .from('Ticket_Orders')
    .select(`
      *,
      Ticket_Order_Items (
        TICKET_ORDER_ITEM_ID,
        TICKET_ORDER_ID,
        ITEM_ID,
        ITEM_GROUP_ID,
        DISCOUNT_ID,
        TICKET_ORDER_ITEM_STATUS,
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
      )
    `)

  if (ticketOrdersError) {
    console.warn('[analyticsService] Error fetching ticket orders:', ticketOrdersError)
  }

  // 1c. Fetch Business_Days and Restaurant_Events for Event analytics & Revenue separation
  const { data: rawBusinessDays } = await supabase
    .schema('staff')
    .from('Business_Days')
    .select('BUSINESS_DAY_ID, BUSINESS_DATE, TOTAL_REVENUE, EVENT_ID, MENU_PRESET_USED_ID')
    .gte('BUSINESS_DATE', toIsoDate(startDate))
    .lte('BUSINESS_DATE', toIsoDate(endDate))

  let rawEventsList: any[] = []
  try {
    const { data: evs } = await supabase
      .schema('events' as any)
      .from('Restaurant_Events')
      .select('*')
      .is('DELETED_AT', null)
      .order('START_AT', { ascending: false })
    if (evs && evs.length > 0) rawEventsList = evs
  } catch {
    // fallback
  }

  if (rawEventsList.length === 0) {
    try {
      const { data: pubEvs } = await supabase
        .from('Restaurant_Events')
        .select('*')
        .is('DELETED_AT', null)
        .order('START_AT', { ascending: false })
      if (pubEvs) rawEventsList = pubEvs
    } catch {
      // fallback
    }
  }

  // Process Events Analytics with performance categorization
  const eventsList: EventAnalyticsItem[] = rawEventsList.map((row: any) => {
    const generatesRevenue = row['GENERATES_REVENUE'] !== false
    let revenueEarned = Number(row['REVENUE_EARNED'] || 0)
    if (revenueEarned === 0 && typeof row['NOTES'] === 'string') {
      const matchRev = row['NOTES'].match(/\[REVENUE:(\d+(?:\.\d+)?)\]/)
      if (matchRev) revenueEarned = Number(matchRev[1])
    }
    const maxPax = Math.max(Number(row['EXPECTED_ATTENDEES']) || 50, 1)
    const revenuePerGuest = maxPax > 0 ? revenueEarned / maxPax : 0

    let performanceTier: 'good' | 'poor' | 'neutral' = 'neutral'
    let performanceLabel = 'Standard'

    if (!generatesRevenue) {
      performanceTier = 'neutral'
      performanceLabel = 'Complimentary (Zero-Revenue)'
    } else {
      const isHighPax = maxPax >= 30
      const isHighRevenue = revenueEarned >= 10000 || revenuePerGuest >= 300
      const isLowRevenue = revenueEarned < 5000 || revenuePerGuest < 150

      if (isHighPax && isLowRevenue) {
        performanceTier = 'poor'
        performanceLabel = 'Poor (High Guests, Low Revenue)'
      } else if (!isHighPax && isHighRevenue) {
        performanceTier = 'good'
        performanceLabel = 'Good (VIP / High Margin)'
      } else if (isHighPax && isHighRevenue) {
        performanceTier = 'good'
        performanceLabel = 'Good (High Scale & Revenue)'
      } else if (revenueEarned > 0) {
        performanceTier = 'neutral'
        performanceLabel = 'Moderate / Balanced'
      } else {
        performanceTier = 'poor'
        performanceLabel = 'No Revenue Recorded'
      }
    }

    return {
      eventId: Number(row['EVENT_ID']),
      title: String(row['TITLE'] || 'Untitled Event'),
      category: String(row['CATEGORY'] || 'Other'),
      color: row['COLOR'] ? String(row['COLOR']) : null,
      startAt: String(row['START_AT']),
      endAt: String(row['END_AT']),
      maxPax,
      generatesRevenue,
      revenueEarned,
      revenuePerGuest: Math.round(revenuePerGuest * 100) / 100,
      performanceTier,
      performanceLabel,
    }
  })

  // Set of business days tied to revenue-generating events
  const presetIds = Array.from(new Set((rawBusinessDays ?? []).map((bd) => Number(bd['MENU_PRESET_USED_ID'])).filter(Boolean)))
  let presetNames = new Map<number, string>()
  if (presetIds.length > 0) {
    const { data: presetRows } = await supabase
      .schema('menu')
      .from('Menu_Presets')
      .select('PRESET_ID, PRESET_NAME')
      .in('PRESET_ID', presetIds)
    presetNames = new Map((presetRows ?? []).map((row) => [Number(row['PRESET_ID']), String(row['PRESET_NAME'] || `Preset ${row['PRESET_ID']}`)]))
  }

  const eventDayIds = new Set<number>()
  for (const bd of rawBusinessDays ?? []) {
    if (bd['EVENT_ID'] != null) {
      const linkedEvent = eventsList.find((e) => e.eventId === Number(bd['EVENT_ID']))
      if (linkedEvent && linkedEvent.generatesRevenue) {
        eventDayIds.add(Number(bd['BUSINESS_DAY_ID']))
      }
    }
  }

  // Process ticket orders into normalized items and calculate untaxed order totals
  interface ProcessedTicketItem {
    ticketOrderItemId: number
    ticketOrderId: number
    itemId: number | null
    itemGroupId: number | null
    name: string
    price: number
    categoryName: string
    categoryId: number
    status: string
    isGroup: boolean
  }

  interface ProcessedTicketOrder {
    ticketId: number
    status: string
    date: Date
    registeredName: string | null
    registeredContactInfo: number | null
    totalBill: number
    items: ProcessedTicketItem[]
  }

  const allProcessedTickets: ProcessedTicketOrder[] = (rawTicketOrders ?? []).map((tRow: any) => {
    const rawItems = (tRow['Ticket_Order_Items'] as Array<Record<string, unknown>> | undefined) ?? []
    let totalBill = 0
    const items: ProcessedTicketItem[] = rawItems.map((oi) => {
      const menuItem = oi['Menu_Items'] as Record<string, unknown> | undefined
      const isGroup = menuItem?.['IS_ITEM_GROUP'] === true || Boolean(oi['ITEM_GROUP_ID'])

      let name = 'Unknown Item'
      let price = 0
      let categoryName = 'Uncategorized'
      let categoryId = 0

      if (isGroup && menuItem) {
        name = String(menuItem['ITEM_NAME'] ?? 'Group Combo')
        price = Number(menuItem['ITEM_PRICE'] ?? 0)
        const catObj = menuItem['Menu_Categories'] as Record<string, unknown> | undefined
        categoryName = catObj ? String(catObj['CATEGORY_NAME']) : 'Meal Packages'
        categoryId = Number(menuItem['CATEGORY_ID'] ?? 0)
      } else if (menuItem) {
        name = String(menuItem['ITEM_NAME'] ?? 'Dish')
        price = Number(menuItem['ITEM_PRICE'] ?? 0)
        const catObj = menuItem['Menu_Categories'] as Record<string, unknown> | undefined
        categoryName = catObj ? String(catObj['CATEGORY_NAME']) : 'Uncategorized'
        categoryId = Number(menuItem['CATEGORY_ID'] ?? 0)
      }

      totalBill += price

      return {
        ticketOrderItemId: Number(oi['TICKET_ORDER_ITEM_ID']),
        ticketOrderId: Number(oi['TICKET_ORDER_ID']),
        itemId: oi['ITEM_ID'] ? Number(oi['ITEM_ID']) : null,
        itemGroupId: oi['ITEM_GROUP_ID'] ? Number(oi['ITEM_GROUP_ID']) : null,
        name,
        price,
        categoryName,
        categoryId,
        status: String(oi['TICKET_ORDER_ITEM_STATUS'] ?? 'REQUESTED'),
        isGroup,
      }
    })

    const date = parseTicketOrderTimestamp(tRow) ?? new Date()
    const rawStatus = String(tRow['TICKET_STATUS'] ?? 'REQUESTED').toUpperCase().trim()
    const status = (rawStatus === 'COMPLETED' || rawStatus === 'DONE' || rawStatus === 'SERVED')
      ? 'COMPLETED'
      : (rawStatus === 'PREPARING' || rawStatus === 'COOKING')
        ? 'PREPARING'
        : (rawStatus === 'CANCELLED')
          ? 'CANCELLED'
          : 'REQUESTED'

    return {
      ticketId: Number(tRow['TICKET_ID']),
      status,
      date,
      registeredName: (tRow['REGISTERED_NAME'] as string | null) ?? null,
      registeredContactInfo: tRow['REGISTERED_CONTACT_INFO'] ? Number(tRow['REGISTERED_CONTACT_INFO']) : null,
      totalBill,
      items,
    }
  })

  // Filter current vs previous period tickets
  const currentTickets = allProcessedTickets.filter((t) => t.date >= startDate && t.date <= endDate)
  const prevTickets = allProcessedTickets.filter((t) => t.date >= prevStart && t.date <= prevEnd)

  const completedTicketsList = currentTickets.filter((t) => t.status === 'COMPLETED')
  const prevCompletedTicketsList = prevTickets.filter((t) => t.status === 'COMPLETED')
  const completedTicketItems = completedTicketsList.flatMap((t) => t.items)

  // 2. Fetch table orders in the previous equivalent period for % comparison
  const { data: previousCompletedOrders } = await supabase
    .schema('system_history')
    .from('Order_History')
    .select('ORDER_ID, TOTAL_BILL, GUEST_COUNT')
    .gte('TIME', toIsoDate(prevStart))
    .lte('TIME', toIsoDate(prevEnd))

  const { data: previousRestaurantOrders, error: prevOrdersError } = await supabase
    .from('Restaurant_Orders')
    .select('ORDER_STATUS, TOTAL_BILL, GUEST_COUNT')
    .gte('TIME', toIsoDate(prevStart))
    .lte('TIME', toIsoDate(prevEnd))

  if (prevOrdersError) {
    console.warn('[analyticsService] Error fetching previous period orders:', prevOrdersError)
  }

  const prevOrders = [
    ...(previousCompletedOrders ?? []),
    ...(previousRestaurantOrders ?? []),
  ]

  const allOrders = [
    ...(rawCompletedOrders ?? []),
    ...(currentOrders ?? []),
  ]

  // Combine completed and cancelled orders
  const completedOrdersList: Array<Record<string, unknown>> = []
  const cancelledOrdersList: Array<Record<string, unknown>> = []
  const legacyCompletedOrderIds: number[] = []

  // Add all orders from dedicated Completed_Orders log table
  for (const co of rawCompletedOrders ?? []) {
    completedOrdersList.push(co)
  }

  const archivedOriginalIds = new Set(
    (rawCompletedOrders ?? [])
      .map((co) => Number(co['ORIGINAL_ORDER_ID'] ?? co['ORDER_ID']))
      .filter(Boolean),
  )

  // Add any legacy or active orders from Restaurant_Orders not already archived
  for (const ro of currentOrders ?? []) {
    const roId = Number(ro['ORDER_ID'])
    const st = String(ro['ORDER_STATUS'] || '')
    if (st === 'CANCELLED') {
      cancelledOrdersList.push(ro)
    } else if (st === 'COMPLETED') {
      if (!archivedOriginalIds.has(roId)) {
        completedOrdersList.push(ro)
        legacyCompletedOrderIds.push(roId)
      }
    }
  }

  // 3. Unpack items from Completed_Orders (ORDER_ITEMS jsonb)
  let orderItemsData: Array<Record<string, unknown>> = []
  for (const co of rawCompletedOrders ?? []) {
    const rawJson = co['ORDER_ITEMS']
    const itemsList = Array.isArray(rawJson) ? rawJson : []
    const oId = Number(co['ORDER_ID'])
    const ordType = String(co['ORDER_TYPE'] || 'DINE-IN')
    const reqFrom = String(co['REQUESTED_FROM'] || 'Cashier')

    for (const it of itemsList) {
      const itId = Number(it.item_id || it.itemId || 0)
      const itName = String(it.item_name || it.itemName || 'Dish')
      const itPrice = Number(it.price || it.unitPrice || 0)
      const catId = Number(it.category_id || it.categoryId || 0)
      const catName = String(it.category_name || it.categoryName || 'Uncategorized')
      const qty = Math.max(Number(it.quantity) || 1, 1)

      for (let q = 0; q < qty; q++) {
        orderItemsData.push({
          ORDER_ITEM_ID: itId,
          ORDER_ID: oId,
          ITEM_ID: itId,
          ORDER_ITEM_STATUS: 'COMPLETED',
          ORDER_TYPE: ordType,
          REQUESTED_FROM: reqFrom,
          Menu_Items: {
            ITEM_ID: itId,
            ITEM_NAME: itName,
            ITEM_PRICE: itPrice,
            CATEGORY_ID: catId,
            Menu_Categories: {
              CATEGORY_ID: catId,
              CATEGORY_NAME: catName,
            },
          },
        })
      }
    }
  }

  // Fetch Order_Items only for legacy orders that do not have ORDER_ITEMS jsonb
  if (legacyCompletedOrderIds.length > 0) {
    const CHUNK_SIZE = 200
    for (let i = 0; i < legacyCompletedOrderIds.length; i += CHUNK_SIZE) {
      const chunk = legacyCompletedOrderIds.slice(i, i + CHUNK_SIZE)
      const { data: legacyItemsData, error: itemsError } = await supabase
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
        .in('ORDER_ID', chunk)
        .limit(10000)

      if (!itemsError && legacyItemsData) {
        orderItemsData.push(...(legacyItemsData as Array<Record<string, unknown>>))
      }
    }
  }

  const presetByBusinessDay = new Map<number, number>()
  for (const bd of rawBusinessDays ?? []) {
    const businessDayId = Number(bd['BUSINESS_DAY_ID'])
    const presetId = Number(bd['MENU_PRESET_USED_ID'])
    if (businessDayId && presetId) presetByBusinessDay.set(businessDayId, presetId)
  }
  const presetSales = new Map<number, number>()
  for (const oi of orderItemsData) {
    const orderId = Number(oi['ORDER_ID'])
    const order = completedOrdersList.find((entry) => Number(entry['ORDER_ID']) === orderId)
    const presetId = order ? presetByBusinessDay.get(Number(order['BUSINESS_DAY_ID'])) : undefined
    if (presetId) presetSales.set(presetId, (presetSales.get(presetId) || 0) + 1)
  }
  const presetStats: PresetPerformanceStat[] = Array.from(presetNames.entries())
    .map(([presetId, presetName]) => ({
      presetId,
      presetName,
      itemsSold: presetSales.get(presetId) || 0,
      percentageOfSales: orderItemsData.length > 0 ? Math.round(((presetSales.get(presetId) || 0) / orderItemsData.length) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.itemsSold - a.itemsSold || a.presetName.localeCompare(b.presetName))

  // 3b. Fetch full menu catalog (items + groups) to track zero-sales and underperforming items
  const { data: catalogItemsData, error: catalogError } = await supabase
    .schema('menu')
    .from('Menu_Items')
    .select(`
      ITEM_ID,
      ITEM_NAME,
      ITEM_PRICE,
      CATEGORY_ID,
      ITEM_STATUS,
      IS_ITEM_GROUP,
      Menu_Categories (
        CATEGORY_ID,
        CATEGORY_NAME
      )
    `)

  if (catalogError) {
    console.warn('[analyticsService] Warning fetching menu items catalog:', catalogError)
  }

  const { data: catalogGroupsData, error: catalogGroupsError } = await supabase
    .schema('menu')
    .from('Menu_Items')
    .select(`
      ITEM_ID,
      ITEM_NAME,
      ITEM_PRICE,
      CATEGORY_ID,
      ITEM_STATUS,
      IS_ITEM_GROUP,
      Menu_Categories (
        CATEGORY_ID,
        CATEGORY_NAME
      )
    `)
    .eq('IS_ITEM_GROUP', true)

  if (catalogGroupsError) {
    console.warn('[analyticsService] Warning fetching menu item groups catalog:', catalogGroupsError)
  }

  // 4. Calculate Core KPIs combining table orders and ticket sales
  const restaurantRevenue = completedOrdersList.reduce((sum, o) => sum + (Number(o['TOTAL_BILL']) || 0), 0)
  const ticketRevenue = completedTicketsList.reduce((sum, t) => sum + t.totalBill, 0)
  const totalRevenue = restaurantRevenue + ticketRevenue

  const restaurantSubtotal = completedOrdersList.reduce(
    (sum, o) => sum + (Number(o['SUBTOTAL_BILL']) || Number(o['TOTAL_BILL']) || 0),
    0,
  )
  // Ticket sales are untaxed; subtotal equals item total
  const subtotalRevenue = restaurantSubtotal + ticketRevenue
  const totalDiscounts = Math.max(subtotalRevenue - totalRevenue, 0)

  const completedCount = completedOrdersList.length + completedTicketsList.length
  const aov = completedCount > 0 ? totalRevenue / completedCount : 0
  const itemsSoldCount = orderItemsData.length + completedTicketItems.length

  // Previous period KPIs for % delta
  const prevCompletedOrders = (prevOrders as Array<Record<string, unknown>>).filter(
    (o) => !o['ORDER_STATUS'] || o['ORDER_STATUS'] === 'COMPLETED',
  )
  const prevRestaurantRevenue = prevCompletedOrders.reduce((sum, o) => sum + (Number(o['TOTAL_BILL']) || 0), 0)
  const prevTicketRevenue = prevCompletedTicketsList.reduce((sum, t) => sum + t.totalBill, 0)
  const prevRevenue = prevRestaurantRevenue + prevTicketRevenue
  const prevCompletedCount = prevCompletedOrders.length + prevCompletedTicketsList.length

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

  // Customer metrics calculation (using table GUEST_COUNT + 1 diner per completed ticket)
  const ordersWithGuests = completedOrdersList.filter(
    (o) => o['GUEST_COUNT'] !== null && o['GUEST_COUNT'] !== undefined && Number(o['GUEST_COUNT']) > 0,
  )
  const restaurantGuests = ordersWithGuests.length > 0
    ? ordersWithGuests.reduce((sum, o) => sum + Number(o['GUEST_COUNT']), 0)
    : null
  const ticketGuests = completedTicketsList.length
  const hasCustomerData = restaurantGuests !== null || ticketGuests > 0
  const customersServed = hasCustomerData ? (restaurantGuests || 0) + ticketGuests : null

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
  const prevRestaurantGuests =
    prevOrdersWithGuests.length > 0
      ? prevOrdersWithGuests.reduce((sum, o) => sum + Number(o['GUEST_COUNT']), 0)
      : null
  const prevTicketGuests = prevCompletedTicketsList.length
  const prevCustomersServed =
    (prevRestaurantGuests !== null || prevTicketGuests > 0)
      ? (prevRestaurantGuests || 0) + prevTicketGuests
      : null

  const customersChangePercent =
    prevCustomersServed !== null && customersServed !== null && prevCustomersServed > 0
      ? Math.round(((customersServed - prevCustomersServed) / prevCustomersServed) * 1000) / 10
      : prevCustomersServed === 0 && customersServed !== null && customersServed > 0
        ? 100
        : null

  // Kitchen & Serving times analysis (using TIME, READY_AT, SERVED_AT, COMPLETED_AT from table orders)
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

  // 5. Aggregate Menu Item Sales Performance (Top, Least, and Full Catalog)
  const orderMetaMap = new Map<number, { isDineIn: boolean; isCustomerApp: boolean }>()
  const orderDateMap = new Map<number, Date>()
  for (const o of completedOrdersList) {
    const oId = Number(o['ORDER_ID'])
    const rawType = String(o['ORDER_TYPE'] || 'DINE-IN').toUpperCase()
    const isDineIn = !rawType.includes('TAKEOUT')
    const rawChan = String(o['REQUESTED_FROM'] || 'Cashier').toLowerCase()
    const isCustomerApp = rawChan.includes('customer')
    orderMetaMap.set(oId, { isDineIn, isCustomerApp })
    const d = parseDbTimestamp(o['TIME'])
    if (d) orderDateMap.set(oId, d)
  }

  interface ItemAgg {
    id: number
    name: string
    category: string
    unitPrice: number
    isAvailable: boolean
    qty: number
    revenue: number
    orderIds: Set<number>
    dineInCount: number
    takeoutCount: number
    customerAppCount: number
    cashierCount: number
    ticketCount: number
  }

  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ]
  const MONTH_SHORTS = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ]

  const DAYS_OF_WEEK_CONFIG = [
    { key: 'Sunday', dayIndex: 0, dayName: 'Sunday', shortName: 'Sun' },
    { key: 'Monday', dayIndex: 1, dayName: 'Monday', shortName: 'Mon' },
    { key: 'Tuesday', dayIndex: 2, dayName: 'Tuesday', shortName: 'Tue' },
    { key: 'Wednesday', dayIndex: 3, dayName: 'Wednesday', shortName: 'Wed' },
    { key: 'Thursday', dayIndex: 4, dayName: 'Thursday', shortName: 'Thu' },
    { key: 'Friday', dayIndex: 5, dayName: 'Friday', shortName: 'Fri' },
    { key: 'Saturday', dayIndex: 6, dayName: 'Saturday', shortName: 'Sat' },
  ]

  const itemAggMap = new Map<number, ItemAgg>()
  const dayItemAggMaps = new Map<string, Map<number, ItemAgg>>()
  for (const day of DAYS_OF_WEEK_CONFIG) {
    dayItemAggMaps.set(day.dayName, new Map<number, ItemAgg>())
  }
  const monthItemAggMaps = new Map<string, Map<number, ItemAgg>>()
  for (const m of MONTH_NAMES) {
    monthItemAggMaps.set(m, new Map<number, ItemAgg>())
  }

  // 5a. Seed with standalone catalog items
  if (catalogItemsData && catalogItemsData.length > 0) {
    for (const raw of catalogItemsData as Array<Record<string, unknown>>) {
      const id = Number(raw['ITEM_ID'])
      const name = String(raw['ITEM_NAME'] || 'Unknown Item')
      const price = Number(raw['ITEM_PRICE'] || 0)
      const isAvail = raw['ITEM_STATUS'] !== 'OUT_OF_STOCK'
      const catObj = raw['Menu_Categories'] as Record<string, unknown> | null
      const catName = catObj ? String(catObj['CATEGORY_NAME']) : 'Uncategorized'

      const baseItem: ItemAgg = {
        id,
        name,
        category: catName,
        unitPrice: price,
        isAvailable: isAvail,
        qty: 0,
        revenue: 0,
        orderIds: new Set<number>(),
        dineInCount: 0,
        takeoutCount: 0,
        customerAppCount: 0,
        cashierCount: 0,
        ticketCount: 0,
      }
      itemAggMap.set(id, { ...baseItem, orderIds: new Set<number>() })
      for (const day of DAYS_OF_WEEK_CONFIG) {
        dayItemAggMaps.get(day.dayName)!.set(id, { ...baseItem, orderIds: new Set<number>() })
      }
      for (const m of MONTH_NAMES) {
        monthItemAggMaps.get(m)!.set(id, { ...baseItem, orderIds: new Set<number>() })
      }
    }
  }

  // 5b. Seed with menu group packages/combos
  if (catalogGroupsData && catalogGroupsData.length > 0) {
    for (const raw of catalogGroupsData as Array<Record<string, unknown>>) {
      const gid = Number(raw['ITEM_ID'])
      const id = gid
      const name = String(raw['ITEM_NAME'] || 'Group Combo')
      const price = Number(raw['ITEM_PRICE'] || 0)
      const isAvail = raw['ITEM_STATUS'] !== 'OUT_OF_STOCK'
      const catObj = raw['Menu_Categories'] as Record<string, unknown> | null
      const catName = catObj ? String(catObj['CATEGORY_NAME']) : 'Meal Packages'

      const baseItem: ItemAgg = {
        id,
        name,
        category: catName,
        unitPrice: price,
        isAvailable: isAvail,
        qty: 0,
        revenue: 0,
        orderIds: new Set<number>(),
        dineInCount: 0,
        takeoutCount: 0,
        customerAppCount: 0,
        cashierCount: 0,
        ticketCount: 0,
      }
      itemAggMap.set(id, { ...baseItem, orderIds: new Set<number>() })
      for (const day of DAYS_OF_WEEK_CONFIG) {
        dayItemAggMaps.get(day.dayName)!.set(id, { ...baseItem, orderIds: new Set<number>() })
      }
      for (const m of MONTH_NAMES) {
        monthItemAggMaps.get(m)!.set(id, { ...baseItem, orderIds: new Set<number>() })
      }
    }
  }

  // 5c. Accumulate sold items from table orders
  for (const oi of orderItemsData) {
    const menuItem = oi['Menu_Items'] as Record<string, unknown> | null
    const itemId = Number(oi['ITEM_ID'] || (menuItem ? menuItem['ITEM_ID'] : 0))
    if (!itemId) continue

    const orderId = Number(oi['ORDER_ID'] || 0)
    const orderMeta = orderMetaMap.get(orderId) ?? { isDineIn: true, isCustomerApp: false }
    const orderDate = orderDateMap.get(orderId)
    const dayName = orderDate ? orderDate.toLocaleDateString('en-US', { weekday: 'long' }) : undefined

    let existing = itemAggMap.get(itemId)
    if (!existing) {
      const itemName = menuItem ? String(menuItem['ITEM_NAME'] || 'Unknown Item') : 'Unknown Item'
      const itemPrice = menuItem ? Number(menuItem['ITEM_PRICE'] || 0) : 0
      const categoryObj = menuItem ? (menuItem['Menu_Categories'] as Record<string, unknown> | null) : null
      const categoryName = categoryObj ? String(categoryObj['CATEGORY_NAME']) : 'Uncategorized'

      existing = {
        id: itemId,
        name: itemName,
        category: categoryName,
        unitPrice: itemPrice,
        isAvailable: true,
        qty: 0,
        revenue: 0,
        orderIds: new Set<number>(),
        dineInCount: 0,
        takeoutCount: 0,
        customerAppCount: 0,
        cashierCount: 0,
        ticketCount: 0,
      }
      itemAggMap.set(itemId, existing)
    }

    const priceToAdd = existing.unitPrice || (menuItem ? Number(menuItem['ITEM_PRICE'] || 0) : 0)
    existing.qty += 1
    existing.revenue += priceToAdd
    if (orderId) existing.orderIds.add(orderId)
    if (orderMeta.isDineIn) existing.dineInCount += 1
    else existing.takeoutCount += 1
    if (orderMeta.isCustomerApp) existing.customerAppCount += 1
    else existing.cashierCount += 1

    // Day of week item accumulation
    if (dayName && dayItemAggMaps.has(dayName)) {
      const dayMap = dayItemAggMaps.get(dayName)!
      let dayItem = dayMap.get(itemId)
      if (!dayItem) {
        dayItem = {
          id: itemId,
          name: existing.name,
          category: existing.category,
          unitPrice: existing.unitPrice,
          isAvailable: true,
          qty: 0,
          revenue: 0,
          orderIds: new Set<number>(),
          dineInCount: 0,
          takeoutCount: 0,
          customerAppCount: 0,
          cashierCount: 0,
          ticketCount: 0,
        }
        dayMap.set(itemId, dayItem)
      }
      dayItem.qty += 1
      dayItem.revenue += priceToAdd
      if (orderId) dayItem.orderIds.add(orderId)
      if (orderMeta.isDineIn) dayItem.dineInCount += 1
      else dayItem.takeoutCount += 1
      if (orderMeta.isCustomerApp) dayItem.customerAppCount += 1
      else dayItem.cashierCount += 1
    }

    // Month item accumulation
    const monthName = orderDate ? MONTH_NAMES[orderDate.getMonth()] : undefined
    if (monthName && monthItemAggMaps.has(monthName)) {
      const monthMap = monthItemAggMaps.get(monthName)!
      let monthItem = monthMap.get(itemId)
      if (!monthItem) {
        monthItem = {
          id: itemId,
          name: existing.name,
          category: existing.category,
          unitPrice: existing.unitPrice,
          isAvailable: true,
          qty: 0,
          revenue: 0,
          orderIds: new Set<number>(),
          dineInCount: 0,
          takeoutCount: 0,
          customerAppCount: 0,
          cashierCount: 0,
          ticketCount: 0,
        }
        monthMap.set(itemId, monthItem)
      }
      monthItem.qty += 1
      monthItem.revenue += priceToAdd
      if (orderId) monthItem.orderIds.add(orderId)
      if (orderMeta.isDineIn) monthItem.dineInCount += 1
      else monthItem.takeoutCount += 1
      if (orderMeta.isCustomerApp) monthItem.customerAppCount += 1
      else monthItem.cashierCount += 1
    }
  }

  // 5d. Accumulate sold items and packages from completed ticket orders
  for (const t of completedTicketsList) {
    const dayName = t.date.toLocaleDateString('en-US', { weekday: 'long' })
    const dayMap = dayItemAggMaps.get(dayName)

    for (const item of t.items) {
      const isGroup = item.isGroup
      const aggId = isGroup ? (item.itemId || item.itemGroupId || 0) : (item.itemId || 0)
      if (!aggId) continue

      let existing = itemAggMap.get(aggId)
      if (!existing) {
        existing = {
          id: aggId,
          name: item.name,
          category: item.categoryName,
          unitPrice: item.price,
          isAvailable: true,
          qty: 0,
          revenue: 0,
          orderIds: new Set<number>(),
          dineInCount: 0,
          takeoutCount: 0,
          customerAppCount: 0,
          cashierCount: 0,
          ticketCount: 0,
        }
        itemAggMap.set(aggId, existing)
      }

      existing.qty += 1
      existing.revenue += item.price
      if (t.ticketId) existing.orderIds.add(t.ticketId)
      existing.ticketCount += 1

      if (dayMap) {
        let dayItem = dayMap.get(aggId)
        if (!dayItem) {
          dayItem = {
            id: aggId,
            name: item.name,
            category: item.categoryName,
            unitPrice: item.price,
            isAvailable: true,
            qty: 0,
            revenue: 0,
            orderIds: new Set<number>(),
            dineInCount: 0,
            takeoutCount: 0,
            customerAppCount: 0,
            cashierCount: 0,
            ticketCount: 0,
          }
          dayMap.set(aggId, dayItem)
        }
        dayItem.qty += 1
        dayItem.revenue += item.price
        if (t.ticketId) dayItem.orderIds.add(t.ticketId)
        dayItem.ticketCount += 1
      }

      const tMonthName = MONTH_NAMES[t.date.getMonth()]
      const monthMap = monthItemAggMaps.get(tMonthName)
      if (monthMap) {
        let mItem = monthMap.get(aggId)
        if (!mItem) {
          mItem = {
            id: aggId,
            name: item.name,
            category: item.categoryName,
            unitPrice: item.price,
            isAvailable: true,
            qty: 0,
            revenue: 0,
            orderIds: new Set<number>(),
            dineInCount: 0,
            takeoutCount: 0,
            customerAppCount: 0,
            cashierCount: 0,
            ticketCount: 0,
          }
          monthMap.set(aggId, mItem)
        }
        mItem.qty += 1
        mItem.revenue += item.price
        if (t.ticketId) mItem.orderIds.add(t.ticketId)
        mItem.ticketCount += 1
      }
    }
  }

  const allRankedItems: ItemSalesStat[] = Array.from(itemAggMap.values()).map((val) => ({
    itemId: val.id,
    itemName: val.name,
    categoryName: val.category,
    unitPrice: val.unitPrice,
    quantity: val.qty,
    revenue: val.revenue,
    percentageOfSales: itemsSoldCount > 0 ? Math.round((val.qty / itemsSoldCount) * 1000) / 10 : 0,
    percentageOfRevenue: totalRevenue > 0 ? Math.round((val.revenue / totalRevenue) * 1000) / 10 : 0,
    orderCount: val.orderIds.size,
    dineInCount: val.dineInCount,
    takeoutCount: val.takeoutCount,
    customerAppCount: val.customerAppCount,
    cashierCount: val.cashierCount,
    ticketCount: val.ticketCount,
    isAvailable: val.isAvailable,
  }))

  // Top Items: items with sales > 0 sorted descending by quantity, then revenue
  const topItems: ItemSalesStat[] = allRankedItems
    .filter((item) => item.quantity > 0)
    .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)

  // Least Items: items sorted ascending by quantity, then revenue (0 sales first, then 1, 2, etc.)
  const leastItems: ItemSalesStat[] = [...allRankedItems]
    .sort((a, b) => a.quantity - b.quantity || a.revenue - b.revenue)

  // All Items: sorted descending by sales
  const allItems: ItemSalesStat[] = [...allRankedItems]
    .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)

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

  for (const t of completedTicketsList) {
    for (const item of t.items) {
      const current = categoryMap.get(item.categoryName) ?? { id: item.categoryId, qty: 0, revenue: 0 }
      current.qty += 1
      current.revenue += item.price
      categoryMap.set(item.categoryName, current)
    }
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
    const st = String(o['ORDER_STATUS'] || 'REQUESTED').toUpperCase()
    statusCounts.set(st, (statusCounts.get(st) || 0) + 1)
  }

  for (const t of currentTickets) {
    const st = t.status
    statusCounts.set(st, (statusCounts.get(st) || 0) + 1)
  }

  const totalAllOrders = allOrders.length + currentTickets.length
  const statusBreakdown: StatusStat[] = Array.from(statusCounts.entries())
    .map(([status, count]) => ({
      status,
      count,
      percentage: totalAllOrders > 0 ? Math.round((count / totalAllOrders) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count)

  // 8. Order Type Breakdown (DINE-IN vs TAKEOUT from Restaurant_Orders + TICKET from Ticket_Orders)
  const orderTypeMap = new Map<string, { count: number; revenue: number }>()
  for (const o of completedOrdersList) {
    const rawType = String(o['ORDER_TYPE'] || 'DINE-IN').toUpperCase()
    const typeLabel = rawType.includes('TAKEOUT') ? 'Takeout' : 'Dine-in'
    const cur = orderTypeMap.get(typeLabel) ?? { count: 0, revenue: 0 }
    cur.count += 1
    cur.revenue += Number(o['TOTAL_BILL']) || 0
    orderTypeMap.set(typeLabel, cur)
  }

  if (completedTicketsList.length > 0) {
    const tRev = completedTicketsList.reduce((sum, t) => sum + t.totalBill, 0)
    orderTypeMap.set('Ticket', { count: completedTicketsList.length, revenue: tRev })
  }

  const orderTypeBreakdown: BreakdownStat[] = Array.from(orderTypeMap.entries()).map(([label, data]) => ({
    label,
    count: data.count,
    revenue: data.revenue,
    percentage: completedCount > 0 ? Math.round((data.count / completedCount) * 1000) / 10 : 0,
  }))

  // 9. Channel Breakdown (Service Staff vs Customer Interface from REQUESTED_FROM)
  let serviceCount = 0
  let serviceRevenue = 0
  let customerCount = 0
  let customerRevenue = 0

  for (const o of completedOrdersList) {
    const rawChan = String(o['REQUESTED_FROM'] || '').toLowerCase()
    const bill = Number(o['TOTAL_BILL']) || 0
    if (rawChan.includes('customer')) {
      customerCount += 1
      customerRevenue += bill
    } else {
      serviceCount += 1
      serviceRevenue += bill
    }
  }

  const totalSourceOrders = serviceCount + customerCount
  const servicePct = totalSourceOrders > 0 ? Math.round((serviceCount / totalSourceOrders) * 1000) / 10 : 0
  const customerPct = totalSourceOrders > 0 ? Math.round((customerCount / totalSourceOrders) * 1000) / 10 : 0

  const orderSourceComparison = {
    service: { count: serviceCount, percentage: servicePct, revenue: serviceRevenue },
    customer: { count: customerCount, percentage: customerPct, revenue: customerRevenue },
    totalCount: totalSourceOrders,
    totalRevenue: serviceRevenue + customerRevenue,
  }

  const channelBreakdown: BreakdownStat[] = [
    {
      label: 'Service Staff',
      count: serviceCount,
      revenue: serviceRevenue,
      percentage: servicePct,
    },
    {
      label: 'Customer Interface',
      count: customerCount,
      revenue: customerRevenue,
      percentage: customerPct,
    },
  ]

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
        standardRevenue: 0,
        eventRevenue: 0,
        orderCount: 0,
        customerCount: hasCustomerData ? 0 : null,
        itemCount: 0,
      })
    }

    for (const o of completedOrdersList) {
      const orderDate = parseDbTimestamp(o['TIME'])
      if (!orderDate) continue
      const hStr = `${orderDate.getHours().toString().padStart(2, '0')}:00`
      const point = timeSeriesMap.get(hStr)
      if (point) {
        const bill = Number(o['TOTAL_BILL']) || 0
        point.revenue += bill
        point.orderCount += 1

        const oDayId = Number(o['BUSINESS_DAY_ID'])
        const matchingEvent = eventsList.find((ev) => {
          if (!ev.startAt) return false
          const s = new Date(ev.startAt)
          const e = ev.endAt ? new Date(ev.endAt) : new Date(s.getTime() + 8 * 3600000)
          return orderDate >= s && orderDate <= e
        })
        const isEventOrder = (oDayId && eventDayIds.has(oDayId)) || Boolean(matchingEvent)
        if (isEventOrder) {
          point.eventRevenue = (point.eventRevenue || 0) + bill
          if (matchingEvent && !matchingEvent.revenueEarned) {
            matchingEvent.revenueEarned = (matchingEvent.revenueEarned || 0) + bill
          }
        } else {
          point.standardRevenue = (point.standardRevenue || 0) + bill
        }

        if (hasCustomerData) {
          point.customerCount = (point.customerCount || 0) + (Number(o['GUEST_COUNT']) || 1)
        }
        let orderItemCount = 0
        if (o['ITEM_COUNT'] != null && Number(o['ITEM_COUNT']) > 0) {
          orderItemCount = Number(o['ITEM_COUNT'])
        } else if (Array.isArray(o['ORDER_ITEMS']) && o['ORDER_ITEMS'].length > 0) {
          orderItemCount = (o['ORDER_ITEMS'] as any[]).reduce(
            (sum: number, it: any) => sum + (Number(it.quantity) || 1),
            0,
          )
        } else {
          const oId = Number(o['ORDER_ID'])
          orderItemCount = orderItemsData.filter((oi) => Number(oi['ORDER_ID']) === oId).length
        }
        point.itemCount += orderItemCount
      }
    }

    for (const t of completedTicketsList) {
      const hStr = `${t.date.getHours().toString().padStart(2, '0')}:00`
      const point = timeSeriesMap.get(hStr)
      if (point) {
        point.revenue += t.totalBill
        point.standardRevenue = (point.standardRevenue || 0) + t.totalBill
        point.orderCount += 1
        if (hasCustomerData) {
          point.customerCount = (point.customerCount || 0) + 1
        }
        point.itemCount += t.items.length
      }
    }
  } else {
    const diffDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    const isMonthlyGrouping = diffDays > 90

    // Generate buckets across the range
    const cursor = new Date(startDate)
    cursor.setHours(0, 0, 0, 0)
    if (isMonthlyGrouping) {
      cursor.setDate(1)
    }
    const endMidnight = new Date(endDate)
    endMidnight.setHours(23, 59, 59, 999)

    const getKey = (d: Date) => {
      if (isMonthlyGrouping) {
        return d.toLocaleDateString('en-US', {
          month: 'short',
          year: diffDays > 365 ? '2-digit' : undefined,
        })
      }
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }

    while (cursor <= endMidnight) {
      const key = getKey(cursor)
      const isoStr = cursor.toISOString()
      if (!timeSeriesMap.has(key)) {
        timeSeriesMap.set(key, {
          key,
          timestamp: isoStr,
          revenue: 0,
          standardRevenue: 0,
          eventRevenue: 0,
          orderCount: 0,
          customerCount: hasCustomerData ? 0 : null,
          itemCount: 0,
        })
      }
      if (isMonthlyGrouping) {
        cursor.setMonth(cursor.getMonth() + 1)
      } else {
        cursor.setDate(cursor.getDate() + 1)
      }
    }

    for (const o of completedOrdersList) {
      const orderDate = parseDbTimestamp(o['TIME'])
      if (!orderDate) continue
      const key = getKey(orderDate)
      const point = timeSeriesMap.get(key)
      if (point) {
        const bill = Number(o['TOTAL_BILL']) || 0
        point.revenue += bill
        point.orderCount += 1

        const oDayId = Number(o['BUSINESS_DAY_ID'])
        const matchingEvent = eventsList.find((ev) => {
          if (!ev.startAt) return false
          const s = new Date(ev.startAt)
          const e = ev.endAt ? new Date(ev.endAt) : new Date(s.getTime() + 8 * 3600000)
          return orderDate >= s && orderDate <= e
        })
        const isEventOrder = (oDayId && eventDayIds.has(oDayId)) || Boolean(matchingEvent)
        if (isEventOrder) {
          point.eventRevenue = (point.eventRevenue || 0) + bill
          if (matchingEvent && !matchingEvent.revenueEarned) {
            matchingEvent.revenueEarned = (matchingEvent.revenueEarned || 0) + bill
          }
        } else {
          point.standardRevenue = (point.standardRevenue || 0) + bill
        }

        if (hasCustomerData) {
          point.customerCount = (point.customerCount || 0) + (Number(o['GUEST_COUNT']) || 1)
        }
        let orderItemCount = 0
        if (o['ITEM_COUNT'] != null && Number(o['ITEM_COUNT']) > 0) {
          orderItemCount = Number(o['ITEM_COUNT'])
        } else if (Array.isArray(o['ORDER_ITEMS']) && o['ORDER_ITEMS'].length > 0) {
          orderItemCount = (o['ORDER_ITEMS'] as any[]).reduce(
            (sum: number, it: any) => sum + (Number(it.quantity) || 1),
            0,
          )
        } else {
          const oId = Number(o['ORDER_ID'])
          orderItemCount = orderItemsData.filter((oi) => Number(oi['ORDER_ID']) === oId).length
        }
        point.itemCount += orderItemCount
      }
    }

    for (const t of completedTicketsList) {
      const key = t.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      const point = timeSeriesMap.get(key)
      if (point) {
        point.revenue += t.totalBill
        point.standardRevenue = (point.standardRevenue || 0) + t.totalBill
        point.orderCount += 1
        if (hasCustomerData) {
          point.customerCount = (point.customerCount || 0) + 1
        }
        point.itemCount += t.items.length
      }
    }
  }

  const timeSeries = Array.from(timeSeriesMap.values())

  const itemsCountByOrderId = new Map<number, number>()
  for (const oi of orderItemsData) {
    const oId = Number(oi['ORDER_ID'])
    if (oId) {
      itemsCountByOrderId.set(oId, (itemsCountByOrderId.get(oId) || 0) + 1)
    }
  }

  // Build Day of Week Series (Monday to Sunday) across the selected range
  const dayOfWeekMap = new Map<string, DayOfWeekPoint>()
  for (const day of DAYS_OF_WEEK_CONFIG) {
    dayOfWeekMap.set(day.dayName, {
      key: day.shortName,
      timestamp: day.dayName,
      dayIndex: day.dayIndex,
      dayName: day.dayName,
      shortName: day.shortName,
      revenue: 0,
      standardRevenue: 0,
      eventRevenue: 0,
      orderCount: 0,
      customerCount: hasCustomerData ? 0 : null,
      itemCount: 0,
    })
  }

  for (const o of completedOrdersList) {
    const orderDate = parseDbTimestamp(o['TIME'])
    if (!orderDate) continue
    const dayName = orderDate.toLocaleDateString('en-US', { weekday: 'long' })
    const point = dayOfWeekMap.get(dayName)
    if (point) {
      const bill = Number(o['TOTAL_BILL']) || 0
      point.revenue += bill
      point.orderCount += 1

      const oDayId = Number(o['BUSINESS_DAY_ID'])
      if (oDayId && eventDayIds.has(oDayId)) {
        point.eventRevenue = (point.eventRevenue || 0) + bill
      } else {
        point.standardRevenue = (point.standardRevenue || 0) + bill
      }

      if (hasCustomerData) {
        point.customerCount = (point.customerCount || 0) + (Number(o['GUEST_COUNT']) || 1)
      }
      let orderItemCount = 0
      if (o['ITEM_COUNT'] != null && Number(o['ITEM_COUNT']) > 0) {
        orderItemCount = Number(o['ITEM_COUNT'])
      } else if (Array.isArray(o['ORDER_ITEMS']) && o['ORDER_ITEMS'].length > 0) {
        orderItemCount = (o['ORDER_ITEMS'] as any[]).reduce(
          (sum: number, it: any) => sum + (Number(it.quantity) || 1),
          0,
        )
      } else {
        const oId = Number(o['ORDER_ID'])
        orderItemCount = itemsCountByOrderId.get(oId) || 0
      }
      point.itemCount += orderItemCount
    }
  }

  for (const t of completedTicketsList) {
    const dayName = t.date.toLocaleDateString('en-US', { weekday: 'long' })
    const point = dayOfWeekMap.get(dayName)
    if (point) {
      point.revenue += t.totalBill
      point.orderCount += 1
      if (hasCustomerData) {
        point.customerCount = (point.customerCount || 0) + 1
      }
      point.itemCount += t.items.length
    }
  }

  const dayOfWeekSeries: DayOfWeekPoint[] = DAYS_OF_WEEK_CONFIG.map((d) => dayOfWeekMap.get(d.dayName)!)

  // Build Daily Series across the entire date range (every calendar day)
  const dailyMap = new Map<string, TimeSeriesPoint>()
  const dayCursor = new Date(startDate)
  dayCursor.setHours(0, 0, 0, 0)
  const dayEndLimit = new Date(endDate)
  dayEndLimit.setHours(23, 59, 59, 999)

  while (dayCursor <= dayEndLimit) {
    const y = dayCursor.getFullYear()
    const m = String(dayCursor.getMonth() + 1).padStart(2, '0')
    const d = String(dayCursor.getDate()).padStart(2, '0')
    const dateKey = `${y}-${m}-${d}`
    dailyMap.set(dateKey, {
      key: dateKey,
      timestamp: dayCursor.toISOString(),
      revenue: 0,
      standardRevenue: 0,
      eventRevenue: 0,
      orderCount: 0,
      customerCount: hasCustomerData ? 0 : null,
      itemCount: 0,
    })
    dayCursor.setDate(dayCursor.getDate() + 1)
  }

  for (const o of completedOrdersList) {
    const orderDate = parseDbTimestamp(o['TIME'])
    if (!orderDate) continue
    const y = orderDate.getFullYear()
    const m = String(orderDate.getMonth() + 1).padStart(2, '0')
    const d = String(orderDate.getDate()).padStart(2, '0')
    const dateKey = `${y}-${m}-${d}`
    const pt = dailyMap.get(dateKey)
    if (pt) {
      const bill = Number(o['TOTAL_BILL']) || 0
      pt.revenue += bill
      pt.orderCount += 1
      const oDayId = Number(o['BUSINESS_DAY_ID'])
      if (oDayId && eventDayIds.has(oDayId)) {
        pt.eventRevenue = (pt.eventRevenue || 0) + bill
      } else {
        pt.standardRevenue = (pt.standardRevenue || 0) + bill
      }
      if (hasCustomerData) {
        pt.customerCount = (pt.customerCount || 0) + (Number(o['GUEST_COUNT']) || 1)
      }
      let orderItemCount = 0
      if (o['ITEM_COUNT'] != null && Number(o['ITEM_COUNT']) > 0) {
        orderItemCount = Number(o['ITEM_COUNT'])
      } else if (Array.isArray(o['ORDER_ITEMS']) && o['ORDER_ITEMS'].length > 0) {
        orderItemCount = (o['ORDER_ITEMS'] as any[]).reduce(
          (sum: number, it: any) => sum + (Number(it.quantity) || 1),
          0,
        )
      } else {
        const oId = Number(o['ORDER_ID'])
        orderItemCount = itemsCountByOrderId.get(oId) || 0
      }
      pt.itemCount += orderItemCount
    }
  }

  for (const t of completedTicketsList) {
    const y = t.date.getFullYear()
    const m = String(t.date.getMonth() + 1).padStart(2, '0')
    const d = String(t.date.getDate()).padStart(2, '0')
    const dateKey = `${y}-${m}-${d}`
    const pt = dailyMap.get(dateKey)
    if (pt) {
      pt.revenue += t.totalBill
      pt.standardRevenue = (pt.standardRevenue || 0) + t.totalBill
      pt.orderCount += 1
      if (hasCustomerData) {
        pt.customerCount = (pt.customerCount || 0) + 1
      }
      pt.itemCount += t.items.length
    }
  }

  const dailySeries = Array.from(dailyMap.values())

  // Build Month Performance Series (January to December) across the entire date range
  const monthPerformanceMap = new Map<number, MonthPerformancePoint>()
  for (let m = 0; m < 12; m++) {
    monthPerformanceMap.set(m, {
      monthIndex: m,
      monthName: MONTH_NAMES[m],
      shortName: MONTH_SHORTS[m],
      year: endDate.getFullYear(),
      key: MONTH_SHORTS[m],
      revenue: 0,
      orderCount: 0,
      customerCount: hasCustomerData ? 0 : null,
      itemCount: 0,
    })
  }

  for (const o of completedOrdersList) {
    const od = parseDbTimestamp(o['TIME'])
    if (!od) continue
    const mIdx = od.getMonth()
    const pt = monthPerformanceMap.get(mIdx)
    if (pt) {
      pt.revenue += Number(o['TOTAL_BILL']) || 0
      pt.orderCount += 1
      if (hasCustomerData) {
        pt.customerCount = (pt.customerCount || 0) + (Number(o['GUEST_COUNT']) || 1)
      }
      let orderItemCount = 0
      if (o['ITEM_COUNT'] != null && Number(o['ITEM_COUNT']) > 0) {
        orderItemCount = Number(o['ITEM_COUNT'])
      } else if (Array.isArray(o['ORDER_ITEMS']) && o['ORDER_ITEMS'].length > 0) {
        orderItemCount = (o['ORDER_ITEMS'] as any[]).reduce(
          (sum: number, it: any) => sum + (Number(it.quantity) || 1),
          0,
        )
      } else {
        const oId = Number(o['ORDER_ID'])
        orderItemCount = itemsCountByOrderId.get(oId) || 0
      }
      pt.itemCount += orderItemCount
    }
  }

  for (const t of completedTicketsList) {
    const mIdx = t.date.getMonth()
    const pt = monthPerformanceMap.get(mIdx)
    if (pt) {
      pt.revenue += t.totalBill
      pt.orderCount += 1
      if (hasCustomerData) {
        pt.customerCount = (pt.customerCount || 0) + 1
      }
      pt.itemCount += t.items.length
    }
  }

  const monthPerformanceSeries = Array.from(monthPerformanceMap.values())

  // Build Day of Week Item Stats
  const dayOfWeekItemStats: Record<string, DayOfWeekItemStats> = {}
  for (const day of DAYS_OF_WEEK_CONFIG) {
    const dayMap = dayItemAggMaps.get(day.dayName)
    const dayPoint = dayOfWeekMap.get(day.dayName)
    const dayRev = dayPoint?.revenue || 0
    const daySold = dayPoint?.itemCount || 0

    const dayRanked: ItemSalesStat[] = Array.from(dayMap?.values() ?? []).map((val) => ({
      itemId: val.id,
      itemName: val.name,
      categoryName: val.category,
      unitPrice: val.unitPrice,
      quantity: val.qty,
      revenue: val.revenue,
      percentageOfSales: daySold > 0 ? Math.round((val.qty / daySold) * 1000) / 10 : 0,
      percentageOfRevenue: dayRev > 0 ? Math.round((val.revenue / dayRev) * 1000) / 10 : 0,
      orderCount: val.orderIds.size,
      dineInCount: val.dineInCount,
      takeoutCount: val.takeoutCount,
      customerAppCount: val.customerAppCount,
      cashierCount: val.cashierCount,
      ticketCount: val.ticketCount,
      isAvailable: val.isAvailable,
    }))

    const topItemsForDay = dayRanked
      .filter((i) => i.quantity > 0)
      .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
    const leastItemsForDay = [...dayRanked].sort((a, b) => a.quantity - b.quantity || a.revenue - b.revenue)
    const allItemsForDay = [...dayRanked].sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)

    dayOfWeekItemStats[day.dayName] = {
      dayName: day.dayName,
      shortName: day.shortName,
      topItems: topItemsForDay,
      leastItems: leastItemsForDay,
      allItems: allItemsForDay,
    }
  }

  // Build Month Item Stats (January to December)
  const monthItemStats: Record<string, MonthItemStats> = {}
  for (let m = 0; m < 12; m++) {
    const mName = MONTH_NAMES[m]
    const mShort = MONTH_SHORTS[m]
    const mMap = monthItemAggMaps.get(mName)

    const monthRanked: ItemSalesStat[] = Array.from(mMap?.values() ?? []).map((val) => ({
      itemId: val.id,
      itemName: val.name,
      categoryName: val.category,
      unitPrice: val.unitPrice,
      quantity: val.qty,
      revenue: val.revenue,
      percentageOfSales: 0,
      percentageOfRevenue: 0,
      orderCount: val.orderIds.size,
      dineInCount: val.dineInCount,
      takeoutCount: val.takeoutCount,
      customerAppCount: val.customerAppCount,
      cashierCount: val.cashierCount,
      ticketCount: val.ticketCount,
      isAvailable: val.isAvailable,
    }))

    const topItemsForMonth = monthRanked
      .filter((i) => i.quantity > 0)
      .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
    const leastItemsForMonth = [...monthRanked].sort((a, b) => a.quantity - b.quantity || a.revenue - b.revenue)
    const allItemsForMonth = [...monthRanked].sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)

    monthItemStats[mName] = {
      monthIndex: m,
      monthName: mName,
      shortName: mShort,
      topItems: topItemsForMonth,
      leastItems: leastItemsForMonth,
      allItems: allItemsForMonth,
    }
  }

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

  for (const t of completedTicketsList) {
    const hr = t.date.getHours()
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

  for (const t of completedTicketsList) {
    const dayLabel = t.date.toLocaleDateString('en-US', { weekday: 'long' })
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
    dailySeries,
    dayOfWeekSeries,
    monthPerformanceSeries,
    dayOfWeekItemStats,
    monthItemStats,
    topItems,
    leastItems,
    allItems,
    categoryStats,
    presetStats,
    statusBreakdown,
    orderTypeBreakdown,
    channelBreakdown,
    orderSourceComparison,
    eventsList,
    totalEventRevenue: eventsList.reduce((sum, e) => sum + e.revenueEarned, 0),
    totalStandardRevenue: Math.max(totalRevenue - eventsList.reduce((sum, e) => sum + e.revenueEarned, 0), 0),
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

  // 2. Purge system_history.Order_History table
  let deletedCompletedCount = 0
  try {
    const { data: targetCompleted } = await supabase
      .schema('system_history')
      .from('Order_History')
      .select('ORDER_ID')

    if (targetCompleted && targetCompleted.length > 0) {
      const completedIds = targetCompleted.map((c) => Number(c['ORDER_ID']))
      await supabase.schema('system_history').from('Order_History').delete().in('ORDER_ID', completedIds)
      deletedCompletedCount = completedIds.length
    }
  } catch (cErr) {
    console.warn('[analyticsService] Warning purging Order_History:', cErr)
  }

  // 3. Fetch IDs of COMPLETED and CANCELLED orders in Restaurant_Orders to purge
  const { data: targetOrders, error: fetchErr } = await supabase
    .from('Restaurant_Orders')
    .select('ORDER_ID')
    .in('ORDER_STATUS', ['COMPLETED', 'CANCELLED'])

  if (fetchErr) {
    console.error('[analyticsService] Error fetching orders to delete:', fetchErr)
    throw fetchErr
  }

  const orderIds = (targetOrders ?? []).map((o) => Number(o['ORDER_ID']))

  if (orderIds.length > 0) {
    // Delete child Order_Items first to prevent FK constraints
    const { error: itemsDelErr } = await supabase
      .from('Order_Items')
      .delete()
      .in('ORDER_ID', orderIds)

    if (itemsDelErr) {
      console.error('[analyticsService] Failed to delete child Order_Items:', itemsDelErr)
      throw itemsDelErr
    }

    // Delete Restaurant_Orders
    const { error: ordersDelErr } = await supabase
      .from('Restaurant_Orders')
      .delete()
      .in('ORDER_ID', orderIds)

    if (ordersDelErr) {
      console.error('[analyticsService] Failed to delete Restaurant_Orders:', ordersDelErr)
      throw ordersDelErr
    }
  }

  // 4. Also purge completed and cancelled Ticket_Orders and their items
  const { data: targetTickets } = await supabase
    .from('Ticket_Orders')
    .select('TICKET_ID')
    .in('TICKET_STATUS', ['COMPLETED', 'CANCELLED'])

  let deletedTicketsCount = 0
  if (targetTickets && targetTickets.length > 0) {
    const ticketIds = targetTickets.map((t) => Number(t['TICKET_ID']))

    // First fetch child item IDs to clear linked group items safely
    const { data: childItems } = await supabase
      .from('Ticket_Order_Items')
      .select('TICKET_ORDER_ITEM_ID')
      .in('TICKET_ORDER_ID', ticketIds)

    const itemIds = (childItems ?? []).map((i: any) => Number(i.TICKET_ORDER_ITEM_ID))
    if (itemIds.length > 0) {
      await supabase.from('Ticket_Order_Group_Items').delete().in('TICKET_GROUP_ID', itemIds)
    }

    await supabase.from('Ticket_Order_Items').delete().in('TICKET_ORDER_ID', ticketIds)
    await supabase.from('Ticket_Orders').delete().in('TICKET_ID', ticketIds)
    deletedTicketsCount = ticketIds.length
  }

  return {
    success: true,
    deletedOrdersCount: deletedCompletedCount + orderIds.length + deletedTicketsCount,
  }
}
