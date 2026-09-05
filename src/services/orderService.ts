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
): Promise<Order> {
  // 1. Insert the order
  const { data: orderData, error: orderError } = await supabase
    .from('Restaurant_Orders')
    .insert({
      TABLE_ID: tableId,
      ORDER_ITEMS_ID: Date.now(), // Satisfy DB schema constraint
      ORDER_STATUS: 'REQUESTED',
      ORDER_TYPE: DINING_TYPE_MAP[diningType],
      TOTAL_BILL: total,
      REQUESTED_FROM: 'Customer',
      TIME: new Date().toISOString(),
    })
    .select()
    .single()

  if (orderError || !orderData) throw orderError ?? new Error('Failed to create order')

  const orderId = Number((orderData as Record<string, unknown>)['ORDER_ID'])

  // 2. Insert order items
  // Unroll items by quantity to match original DBSchema (1 row per ordered item)
  const orderItems: Array<{
    ORDER_ID: number
    ITEM_ID: number
    ORDER_ITEM_STATUS: string
    QUANTITY: number
  }> = []

  for (const ci of items) {
    for (let q = 0; q < ci.quantity; q++) {
      orderItems.push({
        ORDER_ID: orderId,
        ITEM_ID: Number(ci.item.id),
        ORDER_ITEM_STATUS: 'PENDING',
        QUANTITY: 1,
      })
    }
  }

  const { error: itemsError } = await supabase.from('Order_Items').insert(orderItems)
  if (itemsError) throw itemsError

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
  return (data ?? []).map((row) => mapOrder(row as Record<string, unknown>))
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
