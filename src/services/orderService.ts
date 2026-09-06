import { supabase } from '@/lib/supabase'
import type { CartItem, DiningType } from '@/types/cart'
import type { Order, OrderStatus } from '@/types/order'

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
      quantity: Number(oi['QUANTITY'] ?? 1),
      status: String(oi['ORDER_ITEM_STATUS'] ?? 'PENDING'),
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
    items,
  }
}

export async function createOrder(
  tableId: number,
  items: CartItem[],
  diningType: DiningType,
  total: number,
  requestedFrom: 'Cashier' | 'Customer' = 'Customer',
): Promise<Order> {
  // 1. Insert the order
  const { data: orderData, error: orderError } = await supabase
    .from('Restaurant_Orders')
    .insert({
      TABLE_ID: tableId,
      ORDER_STATUS: 'REQUESTED',
      ORDER_TYPE: DINING_TYPE_MAP[diningType],
      TOTAL_BILL: total,
      REQUESTED_FROM: requestedFrom,
      TIME: new Date().toISOString(),
    })
    .select()
    .single()

  if (orderError || !orderData) throw orderError ?? new Error('Failed to create order')

  const orderId = Number((orderData as Record<string, unknown>)['ORDER_ID'])

  // 2. Insert order items — one row per distinct item with its quantity
  const orderItems = items.map((ci) => ({
    ORDER_ID: orderId,
    ITEM_ID: Number(ci.item.id),
    ORDER_ITEM_STATUS: 'PENDING',
    QUANTITY: ci.quantity,
  }))

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

  return mapOrder(orderData as Record<string, unknown>)
}

export async function fetchOrdersByTable(tableId: number): Promise<Order[]> {
  const { data, error } = await supabase
    .from('Restaurant_Orders')
    .select(`
      ORDER_ID,
      TABLE_ID,
      ORDER_STATUS,
      ORDER_TYPE,
      TOTAL_BILL,
      TIME,
      Order_Items (
        ORDER_ITEM_ID,
        ITEM_ID,
        QUANTITY,
        ORDER_ITEM_STATUS,
        Menu_Items (
          ITEM_ID,
          ITEM_NAME,
          ITEM_PRICE
        )
      )
    `)
    .eq('TABLE_ID', tableId)
    .in('ORDER_STATUS', ['REQUESTED', 'VERIFIED', 'PREPARING', 'READY', 'SERVED'])
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
      const qty = item.quantity || 1
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

      itemMap[id].quantity += qty
      itemMap[id].total += price * qty

      if (st === 'SERVED') {
        itemMap[id].servedCount += qty
      } else if (st === 'PREPARING' || order.orderStatus === 'PREPARING') {
        itemMap[id].preparingCount += qty
      } else {
        itemMap[id].pendingCount += qty
      }
    }
  }

  const items = Object.values(itemMap)
  const totalItemCount = items.reduce((sum, it) => sum + it.quantity, 0)

  // Determine overall table status:
  // If all orders are SERVED -> SERVED
  // If any is READY -> READY
  // If any is PREPARING -> PREPARING
  // If any is VERIFIED -> VERIFIED
  // Else -> REQUESTED
  let overallStatus: OrderStatus = 'REQUESTED'
  if (orders.every((o) => o.orderStatus === 'SERVED')) {
    overallStatus = 'SERVED'
  } else if (orders.some((o) => o.orderStatus === 'READY')) {
    overallStatus = 'READY'
  } else if (orders.some((o) => o.orderStatus === 'PREPARING')) {
    overallStatus = 'PREPARING'
  } else if (orders.some((o) => o.orderStatus === 'VERIFIED')) {
    overallStatus = 'VERIFIED'
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
export async function settleTableOrders(tableId: number): Promise<void> {
  const { data: activeOrders, error: fetchErr } = await supabase
    .from('Restaurant_Orders')
    .select('ORDER_ID')
    .eq('TABLE_ID', tableId)
    .in('ORDER_STATUS', ['REQUESTED', 'VERIFIED', 'PREPARING', 'READY', 'SERVED'])

  if (fetchErr) {
    console.error('[orderService] Failed to fetch active orders for settlement:', fetchErr)
    throw fetchErr
  }
  if (!activeOrders || activeOrders.length === 0) return

  const orderIds = activeOrders.map((o) => Number(o['ORDER_ID']))

  // Attempt to transition ORDER_STATUS to 'COMPLETED'
  const { error: updateErr } = await supabase
    .from('Restaurant_Orders')
    .update({ ORDER_STATUS: 'COMPLETED' })
    .in('ORDER_ID', orderIds)

  if (updateErr) {
    console.warn(
      '[orderService] Failed to set ORDER_STATUS to COMPLETED (schema constraint or replica identity), applying fallback delete:',
      updateErr
    )
    // Fallback: delete child items first so order items are completely settled
    const { error: childDelErr } = await supabase.from('Order_Items').delete().in('ORDER_ID', orderIds)
    if (childDelErr) {
      console.error('[orderService] Failed to delete child Order_Items during settlement fallback:', childDelErr)
      throw childDelErr
    }

    // Try deleting Restaurant_Orders as well. If Postgres replica identity disallows deletes without migration 005,
    // log a warning rather than failing the transaction, because child Order_Items are deleted and fetchOrdersByTable
    // filters out orders with 0 items.
    const { error: delErr } = await supabase.from('Restaurant_Orders').delete().in('ORDER_ID', orderIds)
    if (delErr) {
      console.warn(
        '[orderService] Restaurant_Orders delete restricted by publication replica identity (requires migration 005). Child items cleared successfully:',
        delErr
      )
    }
  }
}

