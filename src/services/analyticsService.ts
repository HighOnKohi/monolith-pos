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
  itemCount: number
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
  topItems: ItemSalesStat[]
  leastItems: ItemSalesStat[]
  allItems: ItemSalesStat[]
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

  // 1. Fetch completed orders from Completed_Orders table (dedicated archive for completed orders)
  const { data: rawCompletedOrders, error: completedOrdersErr } = await supabase
    .from('Completed_Orders')
    .select('*')
    .gte('TIME', toIsoDate(startDate))
    .lte('TIME', toIsoDate(endDate))
    .order('TIME', { ascending: true })

  if (completedOrdersErr) {
    console.warn('[analyticsService] Note on Completed_Orders table:', completedOrdersErr.message)
  }

  // Also query Restaurant_Orders for active/legacy orders in period
  const { data: currentOrders, error: ordersError } = await supabase
    .from('Restaurant_Orders')
    .select('*')
    .gte('TIME', toIsoDate(startDate))
    .lte('TIME', toIsoDate(endDate))
    .order('TIME', { ascending: true })

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
        ),
        Menu_Item_Groups (
          MENU_GROUP_ID,
          GROUP_NAME,
          GROUP_PRICE,
          GROUP_IMAGE_URL,
          GROUP_DESCRIPTION,
          CATEGORY_ID,
          Menu_Categories (
            CATEGORY_ID,
            CATEGORY_NAME
          ),
          Item_Groups (
            ITEM_ID,
            Menu_Items (
              ITEM_ID,
              ITEM_NAME,
              ITEM_PRICE,
              CATEGORY_ID
            )
          )
        )
      )
    `)

  if (ticketOrdersError) {
    console.warn('[analyticsService] Error fetching ticket orders:', ticketOrdersError)
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
      const groupItem = oi['Menu_Item_Groups'] as Record<string, unknown> | undefined
      const isGroup = Boolean(oi['ITEM_GROUP_ID'])

      let name = 'Unknown Item'
      let price = 0
      let categoryName = 'Uncategorized'
      let categoryId = 0

      if (isGroup && groupItem) {
        name = String(groupItem['GROUP_NAME'] ?? 'Group Combo')
        price = Number(groupItem['GROUP_PRICE'] ?? 0)
        const catObj = groupItem['Menu_Categories'] as Record<string, unknown> | undefined
        categoryName = catObj ? String(catObj['CATEGORY_NAME']) : 'Meal Packages'
        categoryId = Number(groupItem['CATEGORY_ID'] ?? 0)
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
    .from('Completed_Orders')
    .select('ORDER_STATUS, TOTAL_BILL, GUEST_COUNT')
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
      .in('ORDER_ID', legacyCompletedOrderIds)

    if (!itemsError && legacyItemsData) {
      orderItemsData.push(...(legacyItemsData as Array<Record<string, unknown>>))
    }
  }

  // 3b. Fetch full menu catalog (items + groups) to track zero-sales and underperforming items
  const { data: catalogItemsData, error: catalogError } = await supabase
    .from('Menu_Items')
    .select(`
      ITEM_ID,
      ITEM_NAME,
      ITEM_PRICE,
      CATEGORY_ID,
      IS_AVAILABLE,
      Menu_Categories (
        CATEGORY_ID,
        CATEGORY_NAME
      )
    `)

  if (catalogError) {
    console.warn('[analyticsService] Warning fetching menu items catalog:', catalogError)
  }

  const { data: catalogGroupsData, error: catalogGroupsError } = await supabase
    .from('Menu_Item_Groups')
    .select(`
      MENU_GROUP_ID,
      GROUP_NAME,
      GROUP_PRICE,
      CATEGORY_ID,
      GROUP_STATUS,
      Menu_Categories (
        CATEGORY_ID,
        CATEGORY_NAME
      )
    `)

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
  const prevCompletedOrders = prevOrders.filter((o) => o['ORDER_STATUS'] === 'COMPLETED')
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
  for (const o of completedOrdersList) {
    const oId = Number(o['ORDER_ID'])
    const rawType = String(o['ORDER_TYPE'] || 'DINE-IN').toUpperCase()
    const isDineIn = !rawType.includes('TAKEOUT')
    const rawChan = String(o['REQUESTED_FROM'] || 'Cashier').toLowerCase()
    const isCustomerApp = rawChan.includes('customer')
    orderMetaMap.set(oId, { isDineIn, isCustomerApp })
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

  const itemAggMap = new Map<number, ItemAgg>()

  // 5a. Seed with standalone catalog items
  if (catalogItemsData && catalogItemsData.length > 0) {
    for (const raw of catalogItemsData as Array<Record<string, unknown>>) {
      const id = Number(raw['ITEM_ID'])
      const name = String(raw['ITEM_NAME'] || 'Unknown Item')
      const price = Number(raw['ITEM_PRICE'] || 0)
      const isAvail = raw['IS_AVAILABLE'] !== false
      const catObj = raw['Menu_Categories'] as Record<string, unknown> | null
      const catName = catObj ? String(catObj['CATEGORY_NAME']) : 'Uncategorized'

      itemAggMap.set(id, {
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
      })
    }
  }

  // 5b. Seed with menu group packages/combos (offset ID by 100000 to prevent collisions)
  if (catalogGroupsData && catalogGroupsData.length > 0) {
    for (const raw of catalogGroupsData as Array<Record<string, unknown>>) {
      const gid = Number(raw['MENU_GROUP_ID'])
      const id = 100000 + gid
      const name = String(raw['GROUP_NAME'] || 'Group Combo')
      const price = Number(raw['GROUP_PRICE'] || 0)
      const isAvail = raw['GROUP_STATUS'] !== 'UNAVAILABLE'
      const catObj = raw['Menu_Categories'] as Record<string, unknown> | null
      const catName = catObj ? String(catObj['CATEGORY_NAME']) : 'Meal Packages'

      itemAggMap.set(id, {
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
      })
    }
  }

  // 5c. Accumulate sold items from table orders
  for (const oi of orderItemsData) {
    const menuItem = oi['Menu_Items'] as Record<string, unknown> | null
    const itemId = Number(oi['ITEM_ID'] || (menuItem ? menuItem['ITEM_ID'] : 0))
    if (!itemId) continue

    const orderId = Number(oi['ORDER_ID'] || 0)
    const orderMeta = orderMetaMap.get(orderId) ?? { isDineIn: true, isCustomerApp: false }

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

    existing.qty += 1
    existing.revenue += existing.unitPrice || (menuItem ? Number(menuItem['ITEM_PRICE'] || 0) : 0)
    if (orderId) existing.orderIds.add(orderId)
    if (orderMeta.isDineIn) existing.dineInCount += 1
    else existing.takeoutCount += 1
    if (orderMeta.isCustomerApp) existing.customerAppCount += 1
    else existing.cashierCount += 1
  }

  // 5d. Accumulate sold items and packages from completed ticket orders
  for (const t of completedTicketsList) {
    for (const item of t.items) {
      const isGroup = item.isGroup
      const aggId = isGroup ? 100000 + (item.itemGroupId || 0) : (item.itemId || 0)
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

  // 9. Channel Breakdown (Cashier vs Customer from REQUESTED_FROM + Ticketing Interface)
  const channelMap = new Map<string, { count: number; revenue: number }>()
  for (const o of completedOrdersList) {
    const rawChan = String(o['REQUESTED_FROM'] || 'Cashier').toLowerCase()
    const channelLabel = rawChan.includes('customer') ? 'Customer App' : 'Cashier Station'
    const cur = channelMap.get(channelLabel) ?? { count: 0, revenue: 0 }
    cur.count += 1
    cur.revenue += Number(o['TOTAL_BILL']) || 0
    channelMap.set(channelLabel, cur)
  }

  if (completedTicketsList.length > 0) {
    const tRev = completedTicketsList.reduce((sum, t) => sum + t.totalBill, 0)
    channelMap.set('Ticketing Interface', { count: completedTicketsList.length, revenue: tRev })
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
        itemCount: 0,
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
        point.orderCount += 1
        if (hasCustomerData) {
          point.customerCount = (point.customerCount || 0) + 1
        }
        point.itemCount += t.items.length
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
          itemCount: 0,
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
        point.orderCount += 1
        if (hasCustomerData) {
          point.customerCount = (point.customerCount || 0) + 1
        }
        point.itemCount += t.items.length
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
    topItems,
    leastItems,
    allItems,
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

  // 2. Purge dedicated Completed_Orders table
  let deletedCompletedCount = 0
  try {
    const { data: targetCompleted } = await supabase
      .from('Completed_Orders')
      .select('ORDER_ID')

    if (targetCompleted && targetCompleted.length > 0) {
      const completedIds = targetCompleted.map((c) => Number(c['ORDER_ID']))
      await supabase.from('Completed_Orders').delete().in('ORDER_ID', completedIds)
      deletedCompletedCount = completedIds.length
    }
  } catch (cErr) {
    console.warn('[analyticsService] Warning purging Completed_Orders:', cErr)
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
