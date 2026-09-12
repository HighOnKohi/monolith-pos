import { supabase } from '@/lib/supabase'
import type { OrderStatus, OrderType, OrderTimelineEvent } from '@/types/order'
import { parseDbTimestamp, parseTicketOrderTimestamp } from './analyticsService'
import { getActiveStaffSession } from './staffCodeService'

export type PaymentStatusFilter = 'ALL' | 'PAID' | 'UNPAID'
export type PaymentMethodFilter = 'ALL' | 'CASH' | 'CREDIT_CARD' | 'INSTAPAY_QR'
export type OrderSourceFilter = 'ALL' | 'Cashier' | 'Customer' | 'Ticketing'
export type SortField = 'TIME' | 'ORDER_ID' | 'TOTAL_BILL' | 'ORDER_STATUS'
export type SortOrder = 'asc' | 'desc'

export interface OrderLogsFilterParams {
  search?: string
  startDate?: Date
  endDate?: Date
  orderStatus?: OrderStatus | 'ALL'
  paymentStatus?: PaymentStatusFilter
  paymentMethod?: PaymentMethodFilter
  orderSource?: OrderSourceFilter
  tableId?: number | 'ALL'
  page: number
  pageSize: number
  sortBy: SortField
  sortOrder: SortOrder
}

export interface OrderLogRow {
  orderId: number
  tableId: number
  tableNum: number
  mergedGroupLabel: string | null
  isMerged: boolean
  orderStatus: OrderStatus
  orderType: OrderType
  requestedFrom: 'Cashier' | 'Customer' | 'Ticketing'
  totalBill: number
  subtotalBill: number
  paymentStatus: 'PAID' | 'UNPAID'
  paymentMethod: string
  guestCount: number
  createdAt: string
  readyAt: string | null
  servedAt: string | null
  completedAt: string | null
  servingDurationMinutes: number | null
  prepDurationMinutes: number | null
  itemCount: number
  kitchenNote: string | null
  serverNote: string | null
}

export interface OrderLogsSummary {
  totalOrders: number
  completedOrders: number
  cancelledOrders: number
  activeOrders: number
  totalRevenue: number
  averageOrderValue: number
  averageServingTimeMinutes: number | null
  customersServed: number
  paidOrders: number
  unpaidOrders: number
}

export interface OrderLogsResponse {
  orders: OrderLogRow[]
  totalCount: number
  totalPages: number
  currentPage: number
  pageSize: number
  summary: OrderLogsSummary
}

export interface OrderLogItemDetail {
  orderItemId: number
  orderId: number
  itemId: number
  itemName: string
  categoryName: string
  price: number
  quantity: number
  itemStatus: string
  notes: string | null
}

export interface OrderLogDetails {
  order: OrderLogRow
  items: OrderLogItemDetail[]
  discounts: Array<{
    type: string
    amount: number
  }>
  billRequest?: {
    requestId: number
    paymentMethod: string
    status: string
    requestedAt: string
  } | null
  timeline: OrderTimelineEvent[]
}

/** Helper to format Date into ISO string */
function toIsoDate(d: Date): string {
  return d.toISOString()
}

/**
 * Resolves all table data and generates a map of TABLE_ID -> TableDisplayInfo
 */
async function getTableDisplayMap(): Promise<
  Map<number, { tableNum: number; displayLabel: string; isMerged: boolean }>
> {
  const { data: tables, error } = await supabase
    .from('Restaurant_Tables')
    .select('TABLE_ID, TABLE_NUM, MERGE_GROUP_ID')

  const map = new Map<number, { tableNum: number; displayLabel: string; isMerged: boolean }>()
  if (error || !tables) return map

  // Group by merge group
  const groupMembers = new Map<number, Array<{ id: number; num: number }>>()
  for (const t of tables) {
    const tId = Number(t.TABLE_ID)
    const tNum = Number(t.TABLE_NUM) || tId
    const mgId = t.MERGE_GROUP_ID != null ? Number(t.MERGE_GROUP_ID) : null

    if (mgId !== null) {
      const existing = groupMembers.get(mgId) || []
      existing.push({ id: tId, num: tNum })
      groupMembers.set(mgId, existing)
    }
  }

  // Populate anchor tables that have members
  for (const t of tables) {
    const tId = Number(t.TABLE_ID)
    const tNum = Number(t.TABLE_NUM) || tId
    const mgId = t.MERGE_GROUP_ID != null ? Number(t.MERGE_GROUP_ID) : null

    // Check if this table is an anchor for other tables
    const membersUnderThis = groupMembers.get(tId) || []
    if (membersUnderThis.length > 0) {
      map.set(tId, {
        tableNum: tNum,
        displayLabel: `Table ${tNum}`,
        isMerged: true,
      })
    } else if (mgId !== null) {
      // This is a secondary member of mgId
      const anchor = tables.find((tb) => Number(tb.TABLE_ID) === mgId)
      const anchorNum = anchor ? Number(anchor.TABLE_NUM) || mgId : mgId
      map.set(tId, {
        tableNum: tNum,
        displayLabel: `Table ${anchorNum}`,
        isMerged: true,
      })
    } else {
      map.set(tId, {
        tableNum: tNum,
        displayLabel: `Table ${tNum}`,
        isMerged: false,
      })
    }
  }

  return map
}

/**
 * Primary function to fetch filtered, sorted, paginated Order Logs with summary metrics.
 */
export async function fetchOrderLogs(params: OrderLogsFilterParams): Promise<OrderLogsResponse> {
  const {
    search,
    startDate,
    endDate,
    orderStatus,
    paymentStatus,
    paymentMethod,
    orderSource,
    tableId,
    page,
    pageSize,
    sortBy,
    sortOrder,
  } = params

  // 1. Resolve table metadata map
  const tableMap = await getTableDisplayMap()

  // 2. Fetch Completed_Orders and Restaurant_Orders (unless filtered strictly to Ticketing)
  let tableRows: OrderLogRow[] = []
  if (orderSource !== 'Ticketing') {
    let compQuery = supabase.from('Completed_Orders').select('*')
    let restQuery = supabase.from('Restaurant_Orders').select('*')

    if (startDate) {
      compQuery = compQuery.gte('TIME', toIsoDate(startDate))
      restQuery = restQuery.gte('TIME', toIsoDate(startDate))
    }
    if (endDate) {
      compQuery = compQuery.lte('TIME', toIsoDate(endDate))
      restQuery = restQuery.lte('TIME', toIsoDate(endDate))
    }
    if (orderStatus && orderStatus !== 'ALL') {
      compQuery = compQuery.eq('ORDER_STATUS', orderStatus)
      restQuery = restQuery.eq('ORDER_STATUS', orderStatus)
    }
    if (orderSource && orderSource !== 'ALL') {
      compQuery = compQuery.eq('REQUESTED_FROM', orderSource)
      restQuery = restQuery.eq('REQUESTED_FROM', orderSource)
    }
    if (tableId && tableId !== 'ALL') {
      compQuery = compQuery.eq('TABLE_ID', tableId)
      restQuery = restQuery.eq('TABLE_ID', tableId)
    }

    const [{ data: rawCompleted }, { data: rawOrders }] = await Promise.all([
      compQuery,
      restQuery,
    ])

    const completedArchivedIds = new Set(
      (rawCompleted ?? [])
        .map((co) => Number(co['ORIGINAL_ORDER_ID'] ?? co['ORDER_ID']))
        .filter(Boolean),
    )

    const mergedRawOrders: Array<Record<string, unknown>> = [
      ...(rawCompleted ?? []),
      ...(rawOrders ?? []).filter((ro) => !completedArchivedIds.has(Number(ro['ORDER_ID']))),
    ]

    tableRows = mergedRawOrders.map((o) => {
      const oId = Number(o['ORDER_ID'])
      const tId = Number(o['TABLE_ID'])
      const tInfo = tableMap.get(tId) || { tableNum: Number(o['TABLE_NUM']) || tId, displayLabel: `Table ${Number(o['TABLE_NUM']) || tId}`, isMerged: false }
      const st = String(o['ORDER_STATUS'] || 'REQUESTED') as OrderStatus
      const reqFrom = String(o['REQUESTED_FROM'] || 'Cashier') === 'Customer' ? 'Customer' : 'Cashier'
      const ordType = String(o['ORDER_TYPE'] || 'DINE-IN').toUpperCase().includes('TAKEOUT')
        ? 'TAKEOUT'
        : 'DINE-IN'
      const total = Number(o['TOTAL_BILL']) || 0
      const subtotal = Number(o['SUBTOTAL_BILL']) || total
      const guests = Math.max(Number(o['GUEST_COUNT']) || 1, 1)

      const timeStr = String(o['TIME'] || '')
      const readyStr = o['READY_AT'] ? String(o['READY_AT']) : null
      const servedStr = o['SERVED_AT'] ? String(o['SERVED_AT']) : null
      const compStr = o['COMPLETED_AT'] ? String(o['COMPLETED_AT']) : null

      let servingDurationMinutes: number | null = null
      const timeDate = parseDbTimestamp(timeStr)
      const servedDate = parseDbTimestamp(servedStr)
      const readyDate = parseDbTimestamp(readyStr)

      if (timeDate && servedDate) {
        const diff = (servedDate.getTime() - timeDate.getTime()) / 60000
        if (diff >= 0 && diff < 1440) {
          servingDurationMinutes = Math.round(diff * 10) / 10
        }
      }

      let prepDurationMinutes: number | null = null
      if (timeDate && readyDate) {
        const diff = (readyDate.getTime() - timeDate.getTime()) / 60000
        if (diff >= 0 && diff < 1440) {
          prepDurationMinutes = Math.round(diff * 10) / 10
        }
      }

      let calcItemCount = 0
      if (o['ITEM_COUNT'] != null && Number(o['ITEM_COUNT']) > 0) {
        calcItemCount = Number(o['ITEM_COUNT'])
      } else if (Array.isArray(o['ORDER_ITEMS'])) {
        calcItemCount = (o['ORDER_ITEMS'] as any[]).reduce(
          (sum: number, it: any) => sum + (Number(it.quantity) || 1),
          0,
        )
      }

      const isPaid = st === 'COMPLETED'
      const pMethod = String(o['PAYMENT_METHOD'] || 'CASH').toUpperCase()

      return {
        orderId: oId,
        tableId: tId,
        tableNum: tInfo.tableNum,
        mergedGroupLabel: tInfo.isMerged ? tInfo.displayLabel : null,
        isMerged: tInfo.isMerged,
        orderStatus: st,
        orderType: ordType,
        requestedFrom: reqFrom,
        totalBill: total,
        subtotalBill: subtotal,
        paymentStatus: isPaid ? 'PAID' : 'UNPAID',
        paymentMethod: pMethod,
        guestCount: guests,
        createdAt: timeStr,
        readyAt: readyStr,
        servedAt: servedStr,
        completedAt: compStr,
        servingDurationMinutes,
        prepDurationMinutes,
        itemCount: calcItemCount,
        kitchenNote: o['KITCHEN_NOTE'] ? String(o['KITCHEN_NOTE']) : null,
        serverNote: o['SERVER_NOTE'] ? String(o['SERVER_NOTE']) : null,
      }
    })
  }

  // 2b. Fetch Ticket_Orders (when not filtering by a specific table or strictly Cashier/Customer)
  let ticketRows: OrderLogRow[] = []
  if ((tableId === 'ALL' || tableId === undefined) && orderSource !== 'Cashier' && orderSource !== 'Customer') {
    const { data: rawTickets, error: ticketsErr } = await supabase
      .from('Ticket_Orders')
      .select(`
        TICKET_ID,
        REGISTERED_NAME,
        REGISTERED_CONTACT_INFO,
        REGISTERED_TIME_OF_ARRIVAL,
        TICKET_STATUS,
        CREATED_AT,
        COMPLETED_AT,
        Ticket_Order_Items (
          TICKET_ORDER_ITEM_ID,
          ITEM_ID,
          ITEM_GROUP_ID,
          Menu_Items (
            ITEM_PRICE
          ),
          Menu_Item_Groups (
            GROUP_PRICE
          )
        )
      `)

    if (ticketsErr) {
      console.warn('[orderLogsService] Error fetching ticket orders:', ticketsErr)
    } else {
      ticketRows = (rawTickets ?? [])
        .map((t: any) => {
          const tId = Number(t['TICKET_ID'])
          const rawItems = (t['Ticket_Order_Items'] as Array<Record<string, unknown>> | undefined) ?? []
          let total = 0
          rawItems.forEach((oi) => {
            const isGroup = Boolean(oi['ITEM_GROUP_ID'])
            const grp = oi['Menu_Item_Groups'] as Record<string, unknown> | undefined
            const itm = oi['Menu_Items'] as Record<string, unknown> | undefined
            if (isGroup && grp) {
              total += Number(grp['GROUP_PRICE'] ?? 0)
            } else if (itm) {
              total += Number(itm['ITEM_PRICE'] ?? 0)
            }
          })
          const subtotal = total > 0 ? total / 1.05 : 0

          const date = parseTicketOrderTimestamp(t) ?? new Date()
          const timeStr = (t['CREATED_AT'] as string) || date.toISOString()
          const compStr = (t['COMPLETED_AT'] as string | null) ?? null

          // Apply date filter
          if (startDate && date < startDate) return null
          if (endDate && date > endDate) return null

          const rawStatus = String(t['TICKET_STATUS'] || 'REQUESTED').toUpperCase().trim()
          const st: OrderStatus =
            rawStatus === 'COMPLETED'
              ? 'COMPLETED'
              : rawStatus === 'PREPARING'
                ? 'PREPARING'
                : rawStatus === 'CANCELLED'
                  ? 'CANCELLED'
                  : 'REQUESTED'

          // Apply status filter
          if (orderStatus && orderStatus !== 'ALL' && st !== orderStatus) return null

          const isPaid = Boolean(compStr)
          const regName = (t['REGISTERED_NAME'] as string | null)?.trim() || null
          const contactInfo = t['REGISTERED_CONTACT_INFO'] ? String(t['REGISTERED_CONTACT_INFO']) : null

          let servingDurationMinutes: number | null = null
          const timeDate = parseDbTimestamp(timeStr)
          const compDate = parseDbTimestamp(compStr)
          if (timeDate && compDate) {
            const diff = (compDate.getTime() - timeDate.getTime()) / 60000
            if (diff >= 0 && diff < 1440) {
              servingDurationMinutes = Math.round(diff * 10) / 10
            }
          }

          const row: OrderLogRow = {
            orderId: tId,
            tableId: 0,
            tableNum: tId,
            mergedGroupLabel: null,
            isMerged: false,
            orderStatus: st,
            orderType: 'TICKET',
            requestedFrom: 'Ticketing',
            totalBill: total,
            subtotalBill: subtotal,
            paymentStatus: isPaid ? 'PAID' : 'UNPAID',
            paymentMethod: 'CASH',
            guestCount: 1,
            createdAt: timeStr,
            readyAt: st === 'COMPLETED' ? (compStr || timeStr) : null,
            servedAt: st === 'COMPLETED' ? (compStr || timeStr) : null,
            completedAt: compStr,
            servingDurationMinutes,
            prepDurationMinutes: servingDurationMinutes,
            itemCount: rawItems.length,
            kitchenNote: null,
            serverNote: regName ? `Customer: ${regName}${contactInfo ? ` (${contactInfo})` : ''}` : null,
          }
          return row
        })
        .filter((r): r is OrderLogRow => r !== null)
    }
  }

  // 3. Merge table orders and ticket orders
  const processedRows: OrderLogRow[] = [...tableRows, ...ticketRows]

  // 4. Apply client-side filters for search, paymentStatus, and paymentMethod
  let filteredRows = processedRows

  if (paymentStatus && paymentStatus !== 'ALL') {
    filteredRows = filteredRows.filter((r) => r.paymentStatus === paymentStatus)
  }

  if (paymentMethod && paymentMethod !== 'ALL') {
    filteredRows = filteredRows.filter((r) => r.paymentMethod === paymentMethod)
  }

  if (search && search.trim().length > 0) {
    const q = search.trim().toLowerCase()
    filteredRows = filteredRows.filter((r) => {
      const matchId = String(r.orderId).includes(q) || `#${r.orderId}`.includes(q)
      const matchTable =
        r.orderType === 'TICKET'
          ? `ticket #${r.orderId}`.includes(q) || `ticket ${r.orderId}`.includes(q) || 'ticket'.includes(q)
          : String(r.tableNum).includes(q) ||
            `table ${r.tableNum}`.includes(q) ||
            (r.mergedGroupLabel && r.mergedGroupLabel.toLowerCase().includes(q))
      const matchSource = r.requestedFrom.toLowerCase().includes(q)
      const matchNotes =
        (r.kitchenNote && r.kitchenNote.toLowerCase().includes(q)) ||
        (r.serverNote && r.serverNote.toLowerCase().includes(q))
      const matchStatus = r.orderStatus.toLowerCase().includes(q)
      return Boolean(matchId || matchTable || matchSource || matchNotes || matchStatus)
    })
  }

  // Sort merged rows
  filteredRows.sort((a, b) => {
    let cmp = 0
    if (sortBy === 'TIME') {
      const aTime = new Date(a.createdAt).getTime() || 0
      const bTime = new Date(b.createdAt).getTime() || 0
      cmp = aTime - bTime
    } else if (sortBy === 'ORDER_ID') {
      cmp = a.orderId - b.orderId
    } else if (sortBy === 'TOTAL_BILL') {
      cmp = a.totalBill - b.totalBill
    } else if (sortBy === 'ORDER_STATUS') {
      cmp = a.orderStatus.localeCompare(b.orderStatus)
    }
    return sortOrder === 'asc' ? cmp : -cmp
  })

  // 5. Compute summary metrics over ENTIRE filtered result set
  const totalOrders = filteredRows.length
  const completedOrders = filteredRows.filter((r) => r.orderStatus === 'COMPLETED').length
  const cancelledOrders = filteredRows.filter((r) => r.orderStatus === 'CANCELLED').length
  const activeOrders = totalOrders - completedOrders - cancelledOrders

  const totalRevenue = filteredRows
    .filter((r) => r.orderStatus === 'COMPLETED')
    .reduce((sum, r) => sum + r.totalBill, 0)

  const averageOrderValue =
    completedOrders > 0 ? Math.round((totalRevenue / completedOrders) * 100) / 100 : 0

  const servingTimes = filteredRows
    .map((r) => r.servingDurationMinutes)
    .filter((d): d is number => d !== null && d >= 0)

  const averageServingTimeMinutes =
    servingTimes.length > 0
      ? Math.round((servingTimes.reduce((a, b) => a + b, 0) / servingTimes.length) * 10) / 10
      : null

  const customersServed = filteredRows
    .filter((r) => r.orderStatus === 'COMPLETED')
    .reduce((sum, r) => sum + r.guestCount, 0)

  const paidOrders = filteredRows.filter((r) => r.paymentStatus === 'PAID').length
  const unpaidOrders = filteredRows.filter((r) => r.paymentStatus === 'UNPAID').length

  const summary: OrderLogsSummary = {
    totalOrders,
    completedOrders,
    cancelledOrders,
    activeOrders,
    totalRevenue,
    averageOrderValue,
    averageServingTimeMinutes,
    customersServed,
    paidOrders,
    unpaidOrders,
  }

  // 6. Pagination
  const totalCount = filteredRows.length
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const currentPage = Math.min(Math.max(1, page), totalPages)
  const startIndex = (currentPage - 1) * pageSize
  const pageRows = filteredRows.slice(startIndex, startIndex + pageSize)

  // 7. Efficiently fetch item counts for table orders on the visible page (tickets already have itemCount)
  const tableOrderIds = pageRows.filter((r) => r.orderType !== 'TICKET').map((r) => r.orderId)
  if (tableOrderIds.length > 0) {
    const { data: itemCounts, error: countErr } = await supabase
      .from('Order_Items')
      .select('ORDER_ID')
      .in('ORDER_ID', tableOrderIds)

    if (!countErr && itemCounts) {
      const countMap = new Map<number, number>()
      for (const it of itemCounts) {
        const oid = Number(it.ORDER_ID)
        countMap.set(oid, (countMap.get(oid) || 0) + 1)
      }
      for (const row of pageRows) {
        if (row.orderType !== 'TICKET') {
          row.itemCount = countMap.get(row.orderId) || 0
        }
      }
    }
  }

  return {
    orders: pageRows,
    totalCount,
    totalPages,
    currentPage,
    pageSize,
    summary,
  }
}

/**
 * Fetches complete details for an order to show in the side drawer.
 */
export async function fetchOrderDetails(orderId: number): Promise<OrderLogDetails> {
  // 1. Fetch order row from Completed_Orders or Restaurant_Orders
  let orderData: Record<string, unknown> | null = null
  let isFromCompletedTable = false

  const { data: compData } = await supabase
    .from('Completed_Orders')
    .select('*')
    .eq('ORDER_ID', orderId)
    .maybeSingle()

  if (compData) {
    orderData = compData as Record<string, unknown>
    isFromCompletedTable = true
  } else {
    const { data: restData } = await supabase
      .from('Restaurant_Orders')
      .select('*')
      .eq('ORDER_ID', orderId)
      .maybeSingle()

    if (restData) {
      orderData = restData as Record<string, unknown>
    } else {
      // If not found in Completed_Orders or Restaurant_Orders, check Ticket_Orders
      return fetchTicketOrderDetails(orderId)
    }
  }

  const tableMap = await getTableDisplayMap()
  const tId = Number(orderData['TABLE_ID'])
  const tInfo = tableMap.get(tId) || {
    tableNum: Number(orderData['TABLE_NUM']) || tId,
    displayLabel: `Table ${Number(orderData['TABLE_NUM']) || tId}`,
    isMerged: false,
  }
  const st = String(orderData['ORDER_STATUS'] || 'REQUESTED') as OrderStatus
  const reqFrom = String(orderData['REQUESTED_FROM'] || 'Cashier') === 'Customer' ? 'Customer' : 'Cashier'
  const ordType = String(orderData['ORDER_TYPE'] || 'DINE-IN').toUpperCase().includes('TAKEOUT')
    ? 'TAKEOUT'
    : 'DINE-IN'
  const total = Number(orderData['TOTAL_BILL']) || 0
  const subtotal = Number(orderData['SUBTOTAL_BILL']) || total
  const guests = Math.max(Number(orderData['GUEST_COUNT']) || 1, 1)

  const timeStr = String(orderData['TIME'] || '')
  const readyStr = orderData['READY_AT'] ? String(orderData['READY_AT']) : null
  const servedStr = orderData['SERVED_AT'] ? String(orderData['SERVED_AT']) : null
  const compStr = orderData['COMPLETED_AT'] ? String(orderData['COMPLETED_AT']) : null

  let servingDurationMinutes: number | null = null
  const timeDate = parseDbTimestamp(timeStr)
  const servedDate = parseDbTimestamp(servedStr)
  const readyDate = parseDbTimestamp(readyStr)

  if (timeDate && servedDate) {
    const diff = (servedDate.getTime() - timeDate.getTime()) / 60000
    if (diff >= 0 && diff < 1440) {
      servingDurationMinutes = Math.round(diff * 10) / 10
    }
  }

  let prepDurationMinutes: number | null = null
  if (timeDate && readyDate) {
    const diff = (readyDate.getTime() - timeDate.getTime()) / 60000
    if (diff >= 0 && diff < 1440) {
      prepDurationMinutes = Math.round(diff * 10) / 10
    }
  }

  const orderRow: OrderLogRow = {
    orderId,
    tableId: tId,
    tableNum: tInfo.tableNum,
    mergedGroupLabel: tInfo.isMerged ? tInfo.displayLabel : null,
    isMerged: tInfo.isMerged,
    orderStatus: st,
    orderType: ordType,
    requestedFrom: reqFrom,
    totalBill: total,
    subtotalBill: subtotal,
    paymentStatus: st === 'COMPLETED' ? 'PAID' : 'UNPAID',
    paymentMethod: String(orderData['PAYMENT_METHOD'] || 'CASH').toUpperCase(),
    guestCount: guests,
    createdAt: timeStr,
    readyAt: readyStr,
    servedAt: servedStr,
    completedAt: compStr,
    servingDurationMinutes,
    prepDurationMinutes,
    itemCount: 0,
    kitchenNote: orderData['KITCHEN_NOTE'] ? String(orderData['KITCHEN_NOTE']) : null,
    serverNote: orderData['SERVER_NOTE'] ? String(orderData['SERVER_NOTE']) : null,
  }

  // 2. Fetch Order Items (from ORDER_ITEMS jsonb or child Order_Items table)
  const items: OrderLogItemDetail[] = []
  if (
    isFromCompletedTable &&
    Array.isArray(orderData['ORDER_ITEMS']) &&
    (orderData['ORDER_ITEMS'] as any[]).length > 0
  ) {
    for (let idx = 0; idx < (orderData['ORDER_ITEMS'] as any[]).length; idx++) {
      const it = (orderData['ORDER_ITEMS'] as any[])[idx]
      items.push({
        orderItemId: idx + 1,
        orderId,
        itemId: Number(it.item_id || it.itemId || idx + 1),
        itemName: String(it.item_name || it.itemName || 'Dish'),
        categoryName: String(it.category_name || it.categoryName || 'General'),
        price: Number(it.price || it.unitPrice || 0),
        quantity: Number(it.quantity) || 1,
        itemStatus: 'COMPLETED',
        notes: null,
      })
    }
    orderRow.itemCount = items.reduce((sum, it) => sum + it.quantity, 0)
  } else {
    const { data: rawItems, error: itemsErr } = await supabase
      .from('Order_Items')
      .select(`
        ORDER_ITEM_ID,
        ORDER_ID,
        ITEM_ID,
        ORDER_ITEM_STATUS,
        IS_FLAGGED,
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
      .eq('ORDER_ID', orderId)

    if (itemsErr) {
      console.error('[orderLogsService] Error fetching order items:', itemsErr)
    }

    // Aggregate items by ITEM_ID
    const itemMap = new Map<number, OrderLogItemDetail>()
    for (const it of (rawItems as any[]) ?? []) {
      const rawMenuItem = (it as any)['Menu_Items']
      const menuItem = (Array.isArray(rawMenuItem) ? rawMenuItem[0] : rawMenuItem) as Record<string, unknown> | null
      if (!menuItem) continue
      const itemId = Number(menuItem['ITEM_ID'])
      const itemName = String(menuItem['ITEM_NAME'] || `Item #${itemId}`)
      const price = Number(menuItem['ITEM_PRICE'] || 0)
      const rawCat = (menuItem as any)['Menu_Categories']
      const catObj = (Array.isArray(rawCat) ? rawCat[0] : rawCat) as Record<string, unknown> | null
      const categoryName = catObj ? String(catObj['CATEGORY_NAME']) : 'General'
      const status = String(it['ORDER_ITEM_STATUS'] || 'PENDING')

      const existing = itemMap.get(itemId)
      if (existing) {
        existing.quantity += 1
      } else {
        itemMap.set(itemId, {
          orderItemId: Number(it['ORDER_ITEM_ID']),
          orderId,
          itemId,
          itemName,
          categoryName,
          price,
          quantity: 1,
          itemStatus: status,
          notes: null,
        })
      }
    }

    items.push(...Array.from(itemMap.values()))
    orderRow.itemCount = (rawItems ?? []).length
  }
  const itemsSum = items.reduce((sum, it) => sum + it.price * it.quantity, 0)
  if (orderRow.subtotalBill <= 0 && itemsSum > 0) {
    orderRow.subtotalBill = itemsSum
  }

  // 3. Fetch Discounts
  const { data: rawDiscounts } = await supabase
    .from('Discounts')
    .select('*')
    .eq('ORDER_ID', orderId)

  const discounts: Array<{ type: string; amount: number }> = []
  if (rawDiscounts && rawDiscounts.length > 0) {
    for (const d of rawDiscounts) {
      if (d['PWD']) discounts.push({ type: 'PWD Discount', amount: Number(d['PWD_AMOUNT']) || 0 })
      if (d['SENIOR']) discounts.push({ type: 'Senior Citizen Discount', amount: Number(d['SENIOR_AMOUNT']) || 0 })
      if (d['CUSTOM_PERCENT']) discounts.push({ type: `Custom Discount (${d['CUSTOM_PERCENT']}%)`, amount: 0 })
      if (d['PESO_DISCOUNT']) discounts.push({ type: 'Special Discount', amount: Number(d['PESO_DISCOUNT']) || 0 })
    }
  }

  // 4. Fetch related Bill Request if any
  let billRequest = null
  const { data: billData } = await supabase
    .from('Bill_Requests')
    .select('*')
    .eq('TABLE_ID', tId)
    .order('REQUESTED_AT', { ascending: false })
    .limit(1)

  if (billData && billData[0]) {
    const b = billData[0]
    billRequest = {
      requestId: Number(b['REQUEST_ID']),
      paymentMethod: String(b['PAYMENT_METHOD'] || 'CASH'),
      status: String(b['STATUS'] || 'PAID'),
      requestedAt: String(b['REQUESTED_AT'] || ''),
    }
  }

  // 5. Fetch Timeline
  const timeline = await fetchOrderTimeline(orderId, orderRow)

  return {
    order: orderRow,
    items,
    discounts,
    billRequest,
    timeline,
  }
}

/**
 * Fetches complete details for a ticket order to show in the side drawer.
 */
export async function fetchTicketOrderDetails(ticketId: number): Promise<OrderLogDetails> {
  const { data: tRow, error: ticketErr } = await supabase
    .from('Ticket_Orders')
    .select(`
      TICKET_ID,
      REGISTERED_NAME,
      REGISTERED_CONTACT_INFO,
      REGISTERED_TIME_OF_ARRIVAL,
      TICKET_STATUS,
      CREATED_AT,
      COMPLETED_AT,
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
              ITEM_NAME
            )
          )
        )
      )
    `)
    .eq('TICKET_ID', ticketId)
    .maybeSingle()

  if (ticketErr || !tRow) {
    throw new Error(`Order #${ticketId} could not be found: ${ticketErr?.message || 'Not found'}`)
  }

  const date = parseTicketOrderTimestamp(tRow) ?? new Date()
  const timeStr = (tRow['CREATED_AT'] as string) || date.toISOString()
  const compStr = (tRow['COMPLETED_AT'] as string | null) ?? null

  const rawStatus = String(tRow['TICKET_STATUS'] || 'REQUESTED').toUpperCase().trim()
  const st: OrderStatus =
    rawStatus === 'COMPLETED'
      ? 'COMPLETED'
      : rawStatus === 'PREPARING'
        ? 'PREPARING'
        : rawStatus === 'CANCELLED'
          ? 'CANCELLED'
          : 'REQUESTED'

  const isPaid = Boolean(compStr)
  const regName = (tRow['REGISTERED_NAME'] as string | null)?.trim() || null
  const contactInfo = tRow['REGISTERED_CONTACT_INFO'] ? String(tRow['REGISTERED_CONTACT_INFO']) : null

  let servingDurationMinutes: number | null = null
  const timeDate = parseDbTimestamp(timeStr)
  const compDate = parseDbTimestamp(compStr)
  if (timeDate && compDate) {
    const diff = (compDate.getTime() - timeDate.getTime()) / 60000
    if (diff >= 0 && diff < 1440) {
      servingDurationMinutes = Math.round(diff * 10) / 10
    }
  }

  // Parse items
  const rawItems = (tRow['Ticket_Order_Items'] as Array<Record<string, unknown>> | undefined) ?? []
  let calculatedTotal = 0
  const itemMap = new Map<string, OrderLogItemDetail>()

  for (const oi of rawItems) {
    const isGroup = Boolean(oi['ITEM_GROUP_ID'])
    const groupItem = oi['Menu_Item_Groups'] as Record<string, unknown> | undefined
    const menuItem = oi['Menu_Items'] as Record<string, unknown> | undefined

    let name = 'Unknown Dish'
    let price = 0
    let categoryName = 'General'
    let notes: string | null = null
    let key = ''
    let itemId = 0

    if (isGroup && groupItem) {
      name = String(groupItem['GROUP_NAME'] ?? 'Group Combo')
      price = Number(groupItem['GROUP_PRICE'] ?? 0)
      const catObj = groupItem['Menu_Categories'] as Record<string, unknown> | undefined
      categoryName = catObj ? String(catObj['CATEGORY_NAME']) : 'Meal Packages'
      itemId = 100000 + Number(groupItem['MENU_GROUP_ID'] ?? 0)
      key = `group-${itemId}`

      const links = (groupItem['Item_Groups'] as Array<Record<string, unknown>> | undefined) ?? []
      const included = links.map((il) => {
        const mi = il['Menu_Items'] as Record<string, unknown> | undefined
        return mi ? String(mi['ITEM_NAME']) : `Dish #${il['ITEM_ID']}`
      })
      if (included.length > 0) {
        notes = `Includes: ${included.join(', ')}`
      }
    } else if (menuItem) {
      name = String(menuItem['ITEM_NAME'] ?? 'Dish')
      price = Number(menuItem['ITEM_PRICE'] ?? 0)
      const catObj = menuItem['Menu_Categories'] as Record<string, unknown> | undefined
      categoryName = catObj ? String(catObj['CATEGORY_NAME']) : 'General'
      itemId = Number(menuItem['ITEM_ID'] ?? 0)
      key = `item-${itemId}`
    }

    calculatedTotal += price

    const existing = itemMap.get(key)
    if (existing) {
      existing.quantity += 1
    } else {
      itemMap.set(key, {
        orderItemId: Number(oi['TICKET_ORDER_ITEM_ID']),
        orderId: ticketId,
        itemId,
        itemName: name,
        categoryName,
        price,
        quantity: 1,
        itemStatus: String(oi['TICKET_ORDER_ITEM_STATUS'] ?? 'REQUESTED'),
        notes,
      })
    }
  }

  const items = Array.from(itemMap.values())

  const orderRow: OrderLogRow = {
    orderId: ticketId,
    tableId: 0,
    tableNum: ticketId,
    mergedGroupLabel: null,
    isMerged: false,
    orderStatus: st,
    orderType: 'TICKET',
    requestedFrom: 'Ticketing',
    totalBill: calculatedTotal,
    subtotalBill: calculatedTotal > 0 ? calculatedTotal / 1.05 : 0,
    paymentStatus: isPaid ? 'PAID' : 'UNPAID',
    paymentMethod: 'CASH',
    guestCount: 1,
    createdAt: timeStr,
    readyAt: st === 'COMPLETED' ? (compStr || timeStr) : null,
    servedAt: st === 'COMPLETED' ? (compStr || timeStr) : null,
    completedAt: compStr,
    servingDurationMinutes,
    prepDurationMinutes: servingDurationMinutes,
    itemCount: rawItems.length,
    kitchenNote: null,
    serverNote: regName ? `Customer: ${regName}${contactInfo ? ` (${contactInfo})` : ''}` : null,
  }

  // Synthesize timeline for ticket order
  const timeline: OrderTimelineEvent[] = [
    {
      orderId: ticketId,
      eventType: 'ORDER_PLACED',
      newStatus: 'REQUESTED',
      timestamp: timeStr,
      actor: 'Ticketing Interface',
      reason: regName
        ? `Ticket #${ticketId} created for ${regName}${contactInfo ? ` (${contactInfo})` : ''}`
        : `Ticket #${ticketId} generated by walk-in customer`,
    },
  ]

  if (st !== 'REQUESTED') {
    timeline.push({
      orderId: ticketId,
      eventType: 'ORDER_VERIFIED',
      previousStatus: 'REQUESTED',
      newStatus: 'VERIFIED',
      timestamp: timeStr,
      actor: 'Kitchen Display System',
      reason: 'Ticket verified and scheduled for preparation',
    })

    timeline.push({
      orderId: ticketId,
      eventType: 'PREPARATION_STARTED',
      previousStatus: 'VERIFIED',
      newStatus: 'PREPARING',
      timestamp: timeStr,
      actor: 'Kitchen Line',
      reason: 'Line cooks started preparing ticket dishes',
    })
  }

  if (st === 'COMPLETED') {
    timeline.push({
      orderId: ticketId,
      eventType: 'FOOD_READY',
      previousStatus: 'PREPARING',
      newStatus: 'READY',
      timestamp: compStr || timeStr,
      actor: 'Kitchen Expediter',
      reason: 'All dishes prepared and ready for customer pickup / serving',
    })
  }

  if (compStr) {
    timeline.push({
      orderId: ticketId,
      eventType: 'ORDER_COMPLETED',
      previousStatus: 'READY',
      newStatus: 'COMPLETED',
      timestamp: compStr,
      actor: 'Cashier Station',
      reason: 'Ticket bill settled and payment processed via Cash',
    })
  }

  return {
    order: orderRow,
    items,
    discounts: [],
    billRequest: null,
    timeline,
  }
}

/**
 * Fetches order events or synthesizes the order lifecycle timeline.
 */
export async function fetchOrderTimeline(
  orderId: number,
  orderSnapshot: OrderLogRow,
): Promise<OrderTimelineEvent[]> {
  try {
    const { data: dbEvents, error } = await supabase
      .from('Order_Events')
      .select('*')
      .eq('ORDER_ID', orderId)
      .order('TIMESTAMP', { ascending: true })

    if (!error && dbEvents && dbEvents.length > 0) {
      return dbEvents.map((e) => ({
        eventId: Number(e['EVENT_ID']),
        orderId: Number(e['ORDER_ID']),
        eventType: String(e['EVENT_TYPE']),
        previousStatus: e['PREVIOUS_STATUS'] ? String(e['PREVIOUS_STATUS']) : null,
        newStatus: String(e['NEW_STATUS']),
        timestamp: String(e['TIMESTAMP']),
        actor: e['ACTOR'] ? String(e['ACTOR']) : null,
        reason: e['REASON'] ? String(e['REASON']) : null,
        metadata: e['METADATA'] as Record<string, unknown> | null,
      }))
    }
  } catch (err) {
    // Order_Events table not yet migrated or empty: gracefully fallback
    console.debug('[orderLogsService] Using synthesized timeline for order:', orderId, err)
  }

  // Synthesize events from order lifecycle timestamps
  const events: OrderTimelineEvent[] = []

  // 1. Order Placed
  events.push({
    orderId,
    eventType: 'ORDER_PLACED',
    newStatus: 'REQUESTED',
    timestamp: orderSnapshot.createdAt,
    actor: orderSnapshot.requestedFrom === 'Customer' ? 'Customer App' : 'Cashier Station',
    reason: orderSnapshot.serverNote || 'Order placed into system',
  })

  // 2. Order Cancelled
  if (orderSnapshot.orderStatus === 'CANCELLED') {
    events.push({
      orderId,
      eventType: 'ORDER_CANCELLED',
      previousStatus: 'REQUESTED',
      newStatus: 'CANCELLED',
      timestamp: orderSnapshot.completedAt || orderSnapshot.createdAt,
      actor: 'Staff / Kitchen',
      reason:
        orderSnapshot.kitchenNote ||
        orderSnapshot.serverNote ||
        'Order was cancelled by restaurant staff',
    })
    return events
  }

  // 3. Confirmed & Verified
  if (orderSnapshot.orderStatus !== 'REQUESTED') {
    events.push({
      orderId,
      eventType: 'ORDER_VERIFIED',
      previousStatus: 'REQUESTED',
      newStatus: 'VERIFIED',
      timestamp: orderSnapshot.createdAt,
      actor: 'Kitchen Display System',
      reason: 'Order verified by kitchen staff',
    })
  }

  // 4. Kitchen Preparing
  if (['PREPARING', 'READY', 'SERVED', 'COMPLETED'].includes(orderSnapshot.orderStatus)) {
    events.push({
      orderId,
      eventType: 'PREPARATION_STARTED',
      previousStatus: 'VERIFIED',
      newStatus: 'PREPARING',
      timestamp: orderSnapshot.createdAt,
      actor: 'Kitchen Line',
      reason: 'Cook started preparation',
    })
  }

  // 5. Food Ready
  if (orderSnapshot.readyAt) {
    events.push({
      orderId,
      eventType: 'FOOD_READY',
      previousStatus: 'PREPARING',
      newStatus: 'READY',
      timestamp: orderSnapshot.readyAt,
      actor: 'Kitchen Expediter',
      reason: `All items prepared in ${orderSnapshot.prepDurationMinutes ?? 15} mins`,
    })
  }

  // 6. Food Served
  if (orderSnapshot.servedAt) {
    events.push({
      orderId,
      eventType: 'FOOD_SERVED',
      previousStatus: 'READY',
      newStatus: 'SERVED',
      timestamp: orderSnapshot.servedAt,
      actor: 'Floor Server',
      reason: `Food served to table (Total serving time: ${orderSnapshot.servingDurationMinutes ?? 25} mins)`,
    })
  }

  // 7. Order Completed / Bill Settled
  if (orderSnapshot.orderStatus === 'COMPLETED') {
    events.push({
      orderId,
      eventType: 'ORDER_COMPLETED',
      previousStatus: 'SERVED',
      newStatus: 'COMPLETED',
      timestamp: orderSnapshot.completedAt || orderSnapshot.servedAt || orderSnapshot.createdAt,
      actor: 'Cashier Station',
      reason: `Payment received via ${orderSnapshot.paymentMethod || 'CASH'}. Bill settled.`,
    })
  }

  return events
}

/**
 * Log a new lifecycle event into Order_Events table if available.
 * Attaches the active staff code and name for operational accountability.
 */
export async function logOrderEvent(
  orderId: number,
  event: {
    eventType: string
    previousStatus?: string | null
    newStatus: string
    actor?: string | null
    reason?: string | null
    metadata?: Record<string, unknown> | null
  },
): Promise<void> {
  try {
    const activeStaff = getActiveStaffSession()
    const resolvedActor =
      event.actor ||
      (activeStaff
        ? `#${activeStaff.codeId} ${activeStaff.staffName} (${activeStaff.staffRole})`
        : 'Store Terminal')

    const mergedMetadata = {
      ...(activeStaff
        ? {
            staff_code_id: activeStaff.codeId,
            staff_name: activeStaff.staffName,
            staff_role: activeStaff.staffRole,
          }
        : {}),
      ...(event.metadata || {}),
    }

    await supabase.from('Order_Events').insert({
      ORDER_ID: orderId,
      EVENT_TYPE: event.eventType,
      PREVIOUS_STATUS: event.previousStatus || null,
      NEW_STATUS: event.newStatus,
      ACTOR: resolvedActor,
      REASON: event.reason || null,
      METADATA: Object.keys(mergedMetadata).length > 0 ? mergedMetadata : null,
      TIMESTAMP: new Date().toISOString(),
    })
  } catch (err) {
    console.debug('[orderLogsService] Could not log event to Order_Events:', err)
  }
}
