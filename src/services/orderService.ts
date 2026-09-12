import { supabase } from '@/lib/supabase'
import type { CartItem, DiningType } from '@/types/cart'
import type { Order, OrderStatus } from '@/types/order'
import { logOrderEvent } from '@/services/orderLogsService'

const DINING_TYPE_MAP: Record<DiningType, string> = {
  'dine-in': 'DINE-IN',
  'take-away': 'TAKEOUT',
}

function mapOrder(row: Record<string, unknown>): Order {
  const rawItems = (row['Order_Items'] as Array<Record<string, unknown>> | undefined) ?? []
  const items = rawItems.map((oi) => {
    const menuItem = oi['Menu_Items'] as Record<string, unknown> | undefined
    return {
      orderItemId: Number(oi['ORDER_ITEM_ID']),
      orderId: Number(row['ORDER_ID']),
      itemId: String(oi['ITEM_ID']),
      status: String(oi['ORDER_ITEM_STATUS'] ?? 'PENDING'),
      rejectionReason: Array.isArray(oi['REJECTION_REASON'])
        ? String(oi['REJECTION_REASON'][0] ?? '') || null
        : (oi['REJECTION_REASON'] as string | null) ?? null,
      isFlagged: Boolean(oi['IS_FLAGGED']),
      pwd: Boolean(Array.isArray(oi['Discounts']) ? oi['Discounts'][0]?.['PWD'] : (oi['Discounts'] as Record<string, unknown> | undefined)?.['PWD']),
      senior: Boolean(Array.isArray(oi['Discounts']) ? oi['Discounts'][0]?.['SENIOR'] : (oi['Discounts'] as Record<string, unknown> | undefined)?.['SENIOR']),
      name: menuItem ? String(menuItem['ITEM_NAME']) : undefined,
      price: menuItem ? Number(menuItem['ITEM_PRICE']) : undefined,
      imageUrl: menuItem ? (menuItem['ITEM_IMAGE_URL'] as string | undefined) : undefined,
    }
  })

  return {
    orderId: Number(row['ORDER_ID']),
    tableId: Number(row['TABLE_ID']),
    orderStatus: row['ORDER_STATUS'] as OrderStatus,
    orderType: row['ORDER_TYPE'] as Order['orderType'],
    totalBill: Number(row['TOTAL_BILL'] ?? 0),
    createdAt: (row['TIME'] ?? row['CREATED_AT']) as string | undefined,
    kitchenNote: (row['KITCHEN_NOTE'] as string | null) ?? undefined,
    serverNote: (row['SERVER_NOTE'] as string | null) ?? undefined,
    guestCount: row['GUEST_COUNT'] ? Number(row['GUEST_COUNT']) : undefined,
    readyAt: (row['READY_AT'] as string | null) ?? undefined,
    servedAt: (row['SERVED_AT'] as string | null) ?? undefined,
    completedAt: (row['COMPLETED_AT'] as string | null) ?? undefined,
    items,
  }
}

export async function createOrder(
  tableId: number,
  items: CartItem[],
  diningType: DiningType,
  total: number,
  requestedFrom: 'Cashier' | 'Customer' = 'Customer',
  serverNote?: string,
  guestCount?: number,
): Promise<Order> {
  // Determine party size / guest count
  let partySize = guestCount
  if (!partySize || partySize <= 0) {
    try {
      const { data: tRow } = await supabase
        .from('Restaurant_Tables')
        .select('CURRENT_GUEST_COUNT')
        .eq('TABLE_ID', tableId)
        .maybeSingle()
      partySize = Math.max(Number(tRow?.CURRENT_GUEST_COUNT) || 1, 1)
    } catch {
      partySize = 1
    }
  }

  // 1. Insert the order
  const { data: orderData, error: orderError } = await supabase
    .from('Restaurant_Orders')
    .insert({
      TABLE_ID: tableId,
      ORDER_STATUS: 'REQUESTED',
      ORDER_TYPE: DINING_TYPE_MAP[diningType],
      TOTAL_BILL: total,
      REQUESTED_FROM: requestedFrom,
      SERVER_NOTE: serverNote?.trim() || null,
      GUEST_COUNT: partySize,
      TIME: new Date().toISOString(),
    })
    .select()
    .single()

  if (orderError || !orderData) throw orderError ?? new Error('Failed to create order')

  const orderId = Number((orderData as Record<string, unknown>)['ORDER_ID'])

  // 2. Insert one database row for every ordered unit
  const orderItems = items.flatMap((ci) =>
    Array.from({ length: ci.quantity }, () => ({
      ORDER_ID: orderId,
      ITEM_ID: Number(ci.item.id),
      ORDER_ITEM_STATUS: 'PENDING',
      IS_FLAGGED: false,
    })),
  )

  const { error: itemsError } = await supabase.from('Order_Items').insert(orderItems)
  if (itemsError) throw itemsError

  // 3. Mark table as OCCUPIED if it was not already occupied/has_request
  try {
    const { data: tableData } = await supabase
      .from('Restaurant_Tables')
      .select('STATUS')
      .eq('TABLE_ID', tableId)
      .maybeSingle()

    if (tableData && tableData.STATUS !== 'OCCUPIED' && tableData.STATUS !== 'HAS_REQUEST') {
      await supabase
        .from('Restaurant_Tables')
        .update({ STATUS: 'OCCUPIED' })
        .eq('TABLE_ID', tableId)
    }
  } catch (tErr) {
    console.warn('[orderService] Failed to update table status to OCCUPIED:', tErr)
  }

  // Log lifecycle event to Order_Events
  logOrderEvent(orderId, {
    eventType: 'ORDER_PLACED',
    newStatus: 'REQUESTED',
    actor: requestedFrom === 'Customer' ? 'Customer App' : 'Cashier Station',
    reason: serverNote || 'Order placed into system',
  })

  return mapOrder(orderData as Record<string, unknown>)
}

export async function fetchOrdersByTable(
  tableId: number,
  statuses: OrderStatus[] = ['REQUESTED', 'VERIFIED', 'PREPARING', 'READY', 'SERVED', 'CANCELLED'],
  memberTableIds?: number[],
): Promise<Order[]> {
  const targetIds = memberTableIds && memberTableIds.length > 0 ? memberTableIds : [tableId]

  const { data, error } = await supabase
    .from('Restaurant_Orders')
    .select(`
      ORDER_ID,
      TABLE_ID,
      ORDER_STATUS,
      ORDER_TYPE,
      TOTAL_BILL,
      TIME,
      KITCHEN_NOTE,
      SERVER_NOTE,
      Order_Items (
        ORDER_ITEM_ID,
        ITEM_ID,
        ORDER_ITEM_STATUS,
        REJECTION_REASON,
        IS_FLAGGED,
        Discounts (
          PWD,
          SENIOR
        ),
        Menu_Items (
          ITEM_ID,
          ITEM_NAME,
          ITEM_PRICE
        )
      )
    `)
    .in('TABLE_ID', targetIds)
    .in('ORDER_STATUS', statuses)
    .order('ORDER_ID', { ascending: false })

  if (error) throw error
  return (data ?? [])
    .map((row) => mapOrder(row as Record<string, unknown>))
    .filter((order) => order.items && order.items.length > 0)
}

import type { CompressedTableOrder, CompressedOrderItem } from '@/types/order'

export function compressTableOrders(orders: Order[]): CompressedTableOrder | null {
  if (!orders || orders.length === 0) return null

  const tableId = orders[0].tableId
  const totalBill = orders.reduce((sum, o) => sum + (o.totalBill || 0), 0)

  // Aggregate items across all orders for this table
  const itemMap: Record<string, CompressedOrderItem> = {}

  for (const order of orders) {
    for (const item of order.items ?? []) {
      const id = item.itemId
      const name = item.name || `Item #${id}`
      const price = item.price || 0
      const st = (item.status || 'PENDING').toUpperCase()

      if (!itemMap[id]) {
        itemMap[id] = {
          itemId: id,
          name,
          price,
          quantity: 0,
          total: 0,
          pendingCount: 0,
          preparingCount: 0,
          servedCount: 0,
        }
      }

      itemMap[id].quantity += 1
      itemMap[id].total += price

      if (st === 'SERVED' || st === 'DONE') {
        itemMap[id].servedCount += 1
      } else if (st === 'PREPARING' || order.orderStatus === 'PREPARING') {
        itemMap[id].preparingCount += 1
      } else if (st !== 'CANCELLED') {
        itemMap[id].pendingCount += 1
      }
    }
  }

  const items = Object.values(itemMap)
  const totalItemCount = items.reduce((sum, it) => sum + it.quantity, 0)

  // Determine overall table status:
  // Precedence from least complete to most complete (Prompt 2 §5 & §29):
  // REQUESTED -> VERIFIED -> PREPARING -> READY -> SERVED -> COMPLETED
  let overallStatus: OrderStatus = 'REQUESTED'
  const activeOrders = orders.filter((o) => o.orderStatus !== 'CANCELLED')
  if (activeOrders.length === 0) {
    overallStatus = 'REQUESTED'
  } else if (activeOrders.every((o) => o.orderStatus === 'SERVED')) {
    overallStatus = 'SERVED'
  } else if (activeOrders.some((o) => o.orderStatus === 'REQUESTED')) {
    overallStatus = 'REQUESTED'
  } else if (activeOrders.some((o) => o.orderStatus === 'VERIFIED')) {
    overallStatus = 'VERIFIED'
  } else if (activeOrders.some((o) => o.orderStatus === 'PREPARING')) {
    overallStatus = 'PREPARING'
  } else if (activeOrders.some((o) => o.orderStatus === 'READY')) {
    overallStatus = 'READY'
  }

  // Bill out is only enabled once ALL table orders are completed/marked as SERVED
  const canBillOut = orders.length > 0 && orders.every((o) => o.orderStatus === 'SERVED')

  return {
    tableId,
    totalBill,
    totalItemCount,
    orderCount: orders.length,
    overallStatus,
    items,
    rawOrders: orders,
    canBillOut,
  }
}

/**
 * Settles all active orders for a given table upon bill payment.
 * 1. Queries all active orders for the table (REQUESTED, VERIFIED, PREPARING, READY, SERVED).
 * 2. Attempts to update their ORDER_STATUS to 'COMPLETED'.
 * 3. If a check constraint or replica identity issue prevents the update, cascades deletion
 *    of child Order_Items first and then Restaurant_Orders to ensure the table and active queue
 *    are reliably cleared without throwing foreign key or database constraint errors.
 */
export async function createOrderFromExisting(order: Order): Promise<void> {
  let partySize = order.guestCount
  if (!partySize || partySize <= 0) {
    try {
      const { data: tRow } = await supabase
        .from('Restaurant_Tables')
        .select('CURRENT_GUEST_COUNT')
        .eq('TABLE_ID', order.tableId)
        .maybeSingle()
      partySize = Math.max(Number(tRow?.CURRENT_GUEST_COUNT) || 1, 1)
    } catch {
      partySize = 1
    }
  }

  const { data: orderData, error: orderError } = await supabase
    .from('Restaurant_Orders')
    .insert({
      TABLE_ID: order.tableId,
      ORDER_STATUS: 'REQUESTED',
      ORDER_TYPE: order.orderType,
      TOTAL_BILL: order.totalBill,
      REQUESTED_FROM: 'Cashier',
      SERVER_NOTE: order.serverNote ?? null,
      GUEST_COUNT: partySize,
      TIME: new Date().toISOString(),
    })
    .select()
    .single()

  if (orderError || !orderData) throw orderError ?? new Error('Failed to re-order')

  const orderId = Number((orderData as Record<string, unknown>)['ORDER_ID'])
  const { error: itemsError } = await supabase.from('Order_Items').insert(
    (order.items ?? []).map((item) => ({
      ORDER_ID: orderId,
      ITEM_ID: Number(item.itemId),
      ORDER_ITEM_STATUS: 'PENDING',
      IS_FLAGGED: false,
    })),
  )

  if (itemsError) throw itemsError

  logOrderEvent(orderId, {
    eventType: 'ORDER_PLACED',
    newStatus: 'REQUESTED',
    actor: 'Cashier Station',
    reason: 'Re-ordered items from previous order',
  })
}

export async function deleteOrder(orderId: number): Promise<void> {
  const { error: itemsError } = await supabase
    .from('Order_Items')
    .delete()
    .eq('ORDER_ID', orderId)

  if (itemsError) throw itemsError

  const { error: orderError } = await supabase
    .from('Restaurant_Orders')
    .delete()
    .eq('ORDER_ID', orderId)

  if (orderError) throw orderError
}

export async function settleTableOrders(tableId: number, memberTableIds?: number[]): Promise<void> {
  const targetIds = memberTableIds && memberTableIds.length > 0 ? memberTableIds : [tableId]
  const { data: activeOrders, error: fetchErr } = await supabase
    .from('Restaurant_Orders')
    .select('*')
    .in('TABLE_ID', targetIds)
    .in('ORDER_STATUS', ['REQUESTED', 'VERIFIED', 'PREPARING', 'READY', 'SERVED', 'COMPLETED'])

  if (fetchErr) {
    console.error('[orderService] Failed to fetch active orders for settlement:', fetchErr)
    throw fetchErr
  }
  if (!activeOrders || activeOrders.length === 0) return

  const orderIds = activeOrders.map((o) => Number(o['ORDER_ID']))

  // Log settlement event for audit trail
  for (const id of orderIds) {
    logOrderEvent(id, {
      eventType: 'SETTLED',
      previousStatus: 'COMPLETED',
      newStatus: 'SETTLED',
      actor: 'Cashier',
      reason: 'Table bill settled and payment processed',
    }).catch(() => {})
  }

  // 1. Fetch table numbers and active guest counts for tables
  const tableNumMap = new Map<number, number>()
  const tableGuestMap = new Map<number, number>()
  try {
    const { data: tablesData } = await supabase
      .from('Restaurant_Tables')
      .select('TABLE_ID, TABLE_NUM, CURRENT_GUEST_COUNT')
      .in('TABLE_ID', targetIds)
    for (const t of tablesData ?? []) {
      const tId = Number(t.TABLE_ID)
      tableNumMap.set(tId, Number(t.TABLE_NUM) || tId)
      tableGuestMap.set(tId, Number(t.CURRENT_GUEST_COUNT) || 1)
    }
  } catch (tErr) {
    console.warn('[orderService] Failed to fetch table details for settlement:', tErr)
  }

  // 2. Fetch all child Order_Items joined with Menu_Items & Categories to snapshot items
  const itemsByOrder = new Map<
    number,
    Array<{
      item_id: number
      item_name: string
      category_id: number
      category_name: string
      price: number
      quantity: number
    }>
  >()

  try {
    const { data: childItems, error: itemsErr } = await supabase
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
      .in('ORDER_ID', orderIds)

    if (itemsErr) {
      console.warn('[orderService] Warning fetching order items for archiving:', itemsErr)
    } else {
      for (const item of childItems ?? []) {
        const oId = Number(item.ORDER_ID)
        const mItem = (item as Record<string, unknown>)['Menu_Items'] as Record<string, unknown> | undefined
        const mCat = mItem ? (mItem['Menu_Categories'] as Record<string, unknown> | undefined) : undefined
        const list = itemsByOrder.get(oId) || []
        list.push({
          item_id: Number(item.ITEM_ID),
          item_name: String(mItem?.['ITEM_NAME'] || 'Unknown Item'),
          category_id: Number(mItem?.['CATEGORY_ID'] || 0),
          category_name: String(mCat?.['CATEGORY_NAME'] || 'Uncategorized'),
          price: Number(mItem?.['ITEM_PRICE'] || 0),
          quantity: 1,
        })
        itemsByOrder.set(oId, list)
      }
    }
  } catch (err) {
    console.warn('[orderService] Error processing items for archive:', err)
  }

  // Helper to aggregate duplicate portions into quantities
  const compressItems = (
    raw: Array<{
      item_id: number
      item_name: string
      category_id: number
      category_name: string
      price: number
      quantity: number
    }>,
  ) => {
    const map = new Map<number, (typeof raw)[0]>()
    for (const it of raw) {
      if (!map.has(it.item_id)) {
        map.set(it.item_id, { ...it })
      } else {
        const existing = map.get(it.item_id)!
        existing.quantity += 1
      }
    }
    return Array.from(map.values())
  }

  // 3. Save completed orders into Completed_Orders log table
  const completedRows = activeOrders.map((o) => {
    const oId = Number(o['ORDER_ID'])
    const tId = Number(o['TABLE_ID'])
    const rawList = itemsByOrder.get(oId) || []
    const compressed = compressItems(rawList)
    const totalItemCount = rawList.length
    const subtotal = Number(o['SUBTOTAL_BILL']) || Number(o['TOTAL_BILL']) || 0
    const total = Number(o['TOTAL_BILL']) || subtotal
    const discount = Math.max(subtotal - total, 0)

    return {
      ORIGINAL_ORDER_ID: oId,
      TABLE_ID: tId,
      TABLE_NUM: tableNumMap.get(tId) ?? tId,
      ORDER_TYPE: String(o['ORDER_TYPE'] || 'DINE-IN'),
      REQUESTED_FROM: String(o['REQUESTED_FROM'] || 'Cashier'),
      ORDER_STATUS: 'COMPLETED',
      GUEST_COUNT: Math.max(Number(o['GUEST_COUNT']) || tableGuestMap.get(tId) || 1, 1),
      ITEM_COUNT: totalItemCount,
      SUBTOTAL_BILL: subtotal,
      TOTAL_BILL: total,
      DISCOUNT_AMOUNT: discount,
      PAYMENT_METHOD: String(o['PAYMENT_METHOD'] || 'CASH'),
      TIME: String(o['TIME'] || new Date().toISOString()),
      READY_AT: o['READY_AT'] ? String(o['READY_AT']) : null,
      SERVED_AT: o['SERVED_AT'] ? String(o['SERVED_AT']) : null,
      COMPLETED_AT: new Date().toISOString(),
      KITCHEN_NOTE: o['KITCHEN_NOTE'] ? String(o['KITCHEN_NOTE']) : null,
      SERVER_NOTE: o['SERVER_NOTE'] ? String(o['SERVER_NOTE']) : null,
      ORDER_ITEMS: compressed,
    }
  })

  if (completedRows.length > 0) {
    try {
      const { error: insertErr } = await supabase.from('Completed_Orders').insert(completedRows)
      if (insertErr) {
        console.error('[orderService] Failed to archive orders into Completed_Orders:', insertErr)
      }
    } catch (insertEx) {
      console.warn('[orderService] Archive exception:', insertEx)
    }
  }

  // 4. Delete child Order_Items first to avoid FK constraint issues
  const { error: childDelErr } = await supabase.from('Order_Items').delete().in('ORDER_ID', orderIds)
  if (childDelErr) {
    console.warn('[orderService] Order_Items deletion warning:', childDelErr)
  }

  // 5. Delete active Restaurant_Orders so order completely disappears from active queue
  const { error: orderDelErr } = await supabase.from('Restaurant_Orders').delete().in('ORDER_ID', orderIds)
  if (orderDelErr) {
    console.warn('[orderService] Restaurant_Orders deletion warning:', orderDelErr)
  }

  // Reset table status to AVAILABLE and clear guest count & bill request
  try {
    await supabase
      .from('Restaurant_Tables')
      .update({
        STATUS: 'AVAILABLE',
        BILL_OUT_REQUESTED: false,
        CURRENT_GUEST_COUNT: 0,
        RESERVED_SINCE: null,
      })
      .in('TABLE_ID', targetIds)
  } catch (tableErr) {
    console.warn('[orderService] Table reset warning:', tableErr)
  }
}
