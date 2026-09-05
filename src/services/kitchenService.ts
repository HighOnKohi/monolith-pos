import { supabase } from '@/lib/supabase'
import type { Order, OrderStatus } from '@/types/order'

export interface KitchenOrder extends Order {
  tableNum?: number
}

function mapKitchenOrder(row: Record<string, unknown>): KitchenOrder {
  const rawItems = (row['Order_Items'] as Array<Record<string, unknown>> | undefined) ?? []
  const items = rawItems.map((oi) => {
    const menuItem = oi['Menu_Items'] as Record<string, unknown> | undefined
    return {
      orderItemId: Number(oi['ORDER_ITEM_ID']),
      orderId: Number(row['ORDER_ID']),
      itemId: String(oi['ITEM_ID']),
      quantity: Number(oi['QUANTITY'] ?? 1),
      status: String(oi['ORDER_ITEM_STATUS'] ?? 'PENDING'),
      name: menuItem ? String(menuItem['ITEM_NAME']) : `Item #${oi['ITEM_ID']}`,
      price: menuItem ? Number(menuItem['ITEM_PRICE']) : undefined,
      imageUrl: menuItem ? (menuItem['ITEM_IMAGE_URL'] as string | undefined) : undefined,
    }
  })

  return {
    orderId: Number(row['ORDER_ID']),
    tableId: Number(row['TABLE_ID']),
    tableNum: Number(row['TABLE_ID']),
    orderStatus: row['ORDER_STATUS'] as OrderStatus,
    orderType: row['ORDER_TYPE'] as Order['orderType'],
    totalBill: Number(row['TOTAL_BILL'] ?? 0),
    createdAt: (row['TIME'] ?? row['CREATED_AT']) as string | undefined,
    items,
  }
}

export async function fetchKitchenOrders(): Promise<KitchenOrder[]> {
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
          ITEM_PRICE,
          ITEM_IMAGE_URL
        )
      )
    `)
    .in('ORDER_STATUS', ['REQUESTED', 'VERIFIED', 'PREPARING', 'READY', 'SERVED'])
    .order('ORDER_ID', { ascending: false })

  if (error) throw error
  return (data ?? []).map((row) => mapKitchenOrder(row as Record<string, unknown>))
}

export async function acceptKitchenOrder(orderId: number): Promise<void> {
  const { error } = await supabase
    .from('Restaurant_Orders')
    .update({ ORDER_STATUS: 'VERIFIED' })
    .eq('ORDER_ID', orderId)

  if (error) throw error
}

export async function advanceKitchenOrderStatus(
  orderId: number,
  nextStatus: OrderStatus,
): Promise<void> {
  const { error } = await supabase
    .from('Restaurant_Orders')
    .update({ ORDER_STATUS: nextStatus })
    .eq('ORDER_ID', orderId)

  if (error) throw error

  // If marking SERVED, also update line items status to SERVED
  if (nextStatus === 'SERVED') {
    try {
      await supabase
        .from('Order_Items')
        .update({ ORDER_ITEM_STATUS: 'SERVED' })
        .eq('ORDER_ID', orderId)
    } catch (err) {
      console.warn('Failed to update line items to SERVED:', err)
    }
  }
}

export async function markItemOutOfStock(itemId: string | number): Promise<void> {
  const { error } = await supabase
    .from('Menu_Items')
    .update({ ITEM_STATUS: 'OUT_OF_STOCK' })
    .eq('ITEM_ID', Number(itemId))

  if (error) throw error
}

export async function cancelKitchenOrder(
  orderId: number,
  reason: string,
  outOfStockItemIds?: string[],
): Promise<void> {
  console.info(`[kitchenService] Cancelling order #${orderId} - Reason: ${reason}`)
  // 1. Mark selected items out of stock globally if specified
  if (outOfStockItemIds && outOfStockItemIds.length > 0) {
    for (const itemId of outOfStockItemIds) {
      try {
        await markItemOutOfStock(itemId)
      } catch (err) {
        console.error(`Failed to mark item #${itemId} out of stock:`, err)
      }
    }
  }

  // 2. Try updating ORDER_STATUS to CANCELLED; if check constraint prevents it, delete the order
  const { error: updateError } = await supabase
    .from('Restaurant_Orders')
    .update({ ORDER_STATUS: 'CANCELLED' })
    .eq('ORDER_ID', orderId)

  if (updateError) {
    console.warn(
      'ORDER_STATUS check constraint does not permit CANCELLED yet. Deleting order as fallback:',
      updateError.message,
    )
    const { error: deleteError } = await supabase
      .from('Restaurant_Orders')
      .delete()
      .eq('ORDER_ID', orderId)

    if (deleteError) throw deleteError
  }
}
