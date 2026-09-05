import { supabase } from '@/lib/supabase'
import type { CartItem, DiningType } from '@/types/cart'
import type { Order, OrderStatus } from '@/types/order'

const DINING_TYPE_MAP: Record<DiningType, string> = {
  'dine-in': 'DINE-IN',
  'take-away': 'TAKEOUT',
}

function mapOrder(row: Record<string, unknown>): Order {
  return {
    orderId: Number(row['ORDER_ID']),
    tableId: Number(row['TABLE_ID']),
    orderStatus: row['ORDER_STATUS'] as OrderStatus,
    orderType: row['ORDER_TYPE'] as Order['orderType'],
    totalBill: Number(row['TOTAL_BILL'] ?? 0),
    createdAt: (row['TIME'] ?? row['CREATED_AT']) as string | undefined,
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
  }> = []

  for (const ci of items) {
    for (let q = 0; q < ci.quantity; q++) {
      orderItems.push({
        ORDER_ID: orderId,
        ITEM_ID: Number(ci.item.id),
        ORDER_ITEM_STATUS: 'PENDING',
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
    .select('*')
    .eq('TABLE_ID', tableId)
    .in('ORDER_STATUS', ['REQUESTED', 'VERIFIED', 'PREPARING', 'READY', 'SERVED'])
    .order('ORDER_ID', { ascending: false })

  if (error) throw error
  return (data ?? []).map((row) => mapOrder(row as Record<string, unknown>))
}
