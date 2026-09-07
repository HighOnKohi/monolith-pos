import { supabase } from '@/lib/supabase'
import type { Order, OrderItem, OrderStatus } from '@/types/order'
import { resolveTableGroupByList } from '@/services/tableGroupService'
import type { TableData } from '@/services/tableService'
import { logOrderEvent } from '@/services/orderLogsService'

type KitchenOrderItem = Omit<OrderItem, 'quantity'>

export interface KitchenOrder extends Omit<Order, 'items'> {
  tableNum?: number
  tableDisplay?: string
  items: KitchenOrderItem[]
}

function mapKitchenOrder(row: Record<string, unknown>): KitchenOrder {
  const rawItems = (row['Order_Items'] as Array<Record<string, unknown>> | undefined) ?? []
  const items = rawItems.map((oi) => {
    const menuItem = oi['Menu_Items'] as Record<string, unknown> | undefined
    return {
      orderItemId: Number(oi['ORDER_ITEM_ID']),
      orderId: Number(row['ORDER_ID']),
      itemId: String(oi['ITEM_ID']),
      status: String(oi['ORDER_ITEM_STATUS'] ?? 'PENDING'),
      isFlagged: Boolean(oi['IS_FLAGGED']),
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
    kitchenNote: (row['KITCHEN_NOTE'] as string | null) ?? undefined,
    serverNote: (row['SERVER_NOTE'] as string | null) ?? undefined,
    items,
  }
}

export async function fetchKitchenOrders(): Promise<KitchenOrder[]> {
  const [ordersRes, tablesRes] = await Promise.all([
    supabase
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
          IS_FLAGGED,
          Menu_Items (
            ITEM_ID,
            ITEM_NAME,
            ITEM_PRICE,
            ITEM_IMAGE_URL
          )
        )
      `)
      .in('ORDER_STATUS', ['REQUESTED', 'VERIFIED', 'PREPARING', 'READY', 'SERVED'])
      .order('ORDER_ID', { ascending: false }),
    supabase.from('Restaurant_Tables').select('*'),
  ])

  if (ordersRes.error) throw ordersRes.error
  const allTables = (tablesRes.data as TableData[]) ?? []

  return (ordersRes.data ?? [])
    .map((row) => {
      const ko = mapKitchenOrder(row as Record<string, unknown>)
      const grp = resolveTableGroupByList(ko.tableId, allTables)
      ko.tableNum = grp.anchorTableNum
      ko.tableDisplay = grp.displayLabel
      return ko
    })
    .filter((order) => order.items && order.items.length > 0)
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
  const nowIso = new Date().toISOString()
  const updatePayload: Record<string, unknown> = { ORDER_STATUS: nextStatus }

  if (nextStatus === 'READY') {
    updatePayload.READY_AT = nowIso
  } else if (nextStatus === 'SERVED') {
    updatePayload.SERVED_AT = nowIso
  }

  const { error } = await supabase
    .from('Restaurant_Orders')
    .update(updatePayload)
    .eq('ORDER_ID', orderId)

  if (error) throw error

  // Log lifecycle event to Order_Events
  logOrderEvent(orderId, {
    eventType: `STATUS_${nextStatus}`,
    newStatus: nextStatus,
    actor: 'Kitchen Staff',
    reason: `Kitchen transitioned order to ${nextStatus}`,
  })

  // The database uses DONE for individual items while the order uses SERVED.
  if (nextStatus === 'SERVED') {
    const { error: itemError } = await supabase
      .from('Order_Items')
      .update({ ORDER_ITEM_STATUS: 'DONE' })
      .eq('ORDER_ID', orderId)
      .neq('ORDER_ITEM_STATUS', 'CANCELLED')

    if (itemError) throw itemError
  }
}

export async function saveKitchenOrderFlags(
  orderId: number,
  flaggedItemIds: string[],
): Promise<void> {
  const { error: clearError } = await supabase
    .from('Order_Items')
    .update({ IS_FLAGGED: false })
    .eq('ORDER_ID', orderId)

  if (clearError) throw clearError

  for (const itemId of flaggedItemIds) {
    const { error } = await supabase
      .from('Order_Items')
      .update({ IS_FLAGGED: true })
      .eq('ORDER_ID', orderId)
      .eq('ITEM_ID', Number(itemId))

    if (error) throw error
  }
}

export async function saveKitchenNote(orderId: number, note: string): Promise<void> {
  const { error } = await supabase
    .from('Restaurant_Orders')
    .update({ KITCHEN_NOTE: note.trim() || null })
    .eq('ORDER_ID', orderId)

  if (error) throw error
}

export async function markItemOutOfStock(itemId: string | number): Promise<void> {
  const { error } = await supabase
    .from('Menu_Items')
    .update({ ITEM_STATUS: 'OUT_OF_STOCK' })
    .eq('ITEM_ID', Number(itemId))

  if (error) throw error
}

export async function toggleItemAvailability(
  itemId: string | number,
  status: 'AVAILABLE' | 'OUT_OF_STOCK',
): Promise<void> {
  const { error } = await supabase
    .from('Menu_Items')
    .update({ ITEM_STATUS: status })
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
        await toggleItemAvailability(itemId, 'OUT_OF_STOCK')
      } catch (err) {
        console.error(`Failed to mark item #${itemId} out of stock:`, err)
      }
    }
  }

  // Find the table for this order to check table state cleanup
  let tableId: number | null = null
  try {
    const { data: orderData } = await supabase
      .from('Restaurant_Orders')
      .select('TABLE_ID')
      .eq('ORDER_ID', orderId)
      .maybeSingle()
    if (orderData) {
      tableId = Number(orderData.TABLE_ID)
    }
  } catch (err) {
    console.warn('[kitchenService] Could not lookup TABLE_ID for cancelled order:', err)
  }

  // 2. Try updating ORDER_STATUS to CANCELLED
  const { error: updateError } = await supabase
    .from('Restaurant_Orders')
    .update({ ORDER_STATUS: 'CANCELLED', KITCHEN_NOTE: reason.trim() || null })
    .eq('ORDER_ID', orderId)

  // Log cancellation event
  logOrderEvent(orderId, {
    eventType: 'ORDER_CANCELLED',
    newStatus: 'CANCELLED',
    actor: 'Kitchen Staff',
    reason: reason.trim() || 'Cancelled by kitchen',
  })

  if (updateError) {
    console.warn(
      'ORDER_STATUS check constraint or replica identity does not permit CANCELLED update. Deleting child items then order as fallback:',
      updateError.message,
    )
    // First delete child items in Order_Items to avoid FK constraint violations
    try {
      await supabase.from('Order_Items').delete().eq('ORDER_ID', orderId)
    } catch (oiErr) {
      console.warn('Failed to delete Order_Items before order deletion:', oiErr)
    }

    const { error: deleteError } = await supabase
      .from('Restaurant_Orders')
      .delete()
      .eq('ORDER_ID', orderId)

    if (deleteError) {
      console.warn(
        '[kitchenService] Restaurant_Orders delete restricted by publication replica identity (requires migration 005). Child items cleared successfully:',
        deleteError
      )
    }
  }

  // 3. If table has no remaining active orders with items, reset table status to AVAILABLE
  if (tableId) {
    try {
      const { data: remainingOrders } = await supabase
        .from('Restaurant_Orders')
        .select(`
          ORDER_ID,
          Order_Items ( ORDER_ITEM_ID )
        `)
        .eq('TABLE_ID', tableId)
        .in('ORDER_STATUS', ['REQUESTED', 'VERIFIED', 'PREPARING', 'READY', 'SERVED'])

      const activeWithItems = (remainingOrders ?? []).filter(
        (o) => o['Order_Items'] && (o['Order_Items'] as unknown[]).length > 0 && o['ORDER_ID'] !== orderId
      )

      if (activeWithItems.length === 0) {
        await supabase
          .from('Restaurant_Tables')
          .update({ STATUS: 'AVAILABLE', BILL_OUT_REQUESTED: false, CURRENT_GUEST_COUNT: 0 })
          .eq('TABLE_ID', tableId)
      }
    } catch (tblErr) {
      console.warn('[kitchenService] Error updating table status after cancellation:', tblErr)
    }
  }
}
