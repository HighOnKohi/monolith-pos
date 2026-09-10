import { supabase } from '@/lib/supabase'
import type { Order, OrderItem, OrderStatus } from '@/types/order'
import { resolveTableGroupByList } from '@/services/tableGroupService'
import type { TableData } from '@/services/tableService'
import { logOrderEvent } from '@/services/orderLogsService'
import { broadcastMenuItemStatus } from '@/hooks/useRealtimeMenu'

type DispatcherOrderItem = Omit<OrderItem, 'quantity'> & {
  rejectionReason?: 'only_1_left' | 'only_2_left' | 'only_3_left' | 'only_4_left' | 'only_5_left' | 'unavailable' | null
}

export interface DispatcherOrder extends Omit<Order, 'items'> {
  tableNum?: number
  tableDisplay?: string
  items: DispatcherOrderItem[]
}

export async function fetchDispatcherOrders(): Promise<DispatcherOrder[]> {
  // REQUESTED orders are the source of truth for the PREPARING queue.
  const { data: orders, error: ordersError } = await supabase
    .from('Restaurant_Orders')
    .select('ORDER_ID, TABLE_ID, ORDER_STATUS, ORDER_TYPE, TOTAL_BILL, TIME, KITCHEN_NOTE, SERVER_NOTE')
    .in('ORDER_STATUS', ['REQUESTED', 'VERIFIED', 'PREPARING'])
    .order('ORDER_ID', { ascending: false })

  if (ordersError) {
    console.error('Dispatcher Restaurant_Orders error:', ordersError)
    throw ordersError
  }
  if (!orders || orders.length === 0) return []

  const orderIds = orders.map((row: any) => Number(row.ORDER_ID))
  const { data: itemsData, error: itemsError } = await supabase
    .from('Order_Items')
    .select('ORDER_ITEM_ID, ORDER_ID, ITEM_ID, ORDER_ITEM_STATUS, IS_FLAGGED')
    .in('ORDER_ID', orderIds)

  if (itemsError) {
    console.error('Dispatcher Order_Items error:', itemsError)
    throw itemsError
  }

  const itemIds = [...new Set((itemsData ?? []).map((row: any) => Number(row.ITEM_ID)).filter(Boolean))]
  const menuMap = new Map<number, { name: string; price: number }>()

  if (itemIds.length > 0) {
    const { data: menuData, error: menuError } = await supabase
      .from('Menu_Items')
      .select('ITEM_ID, ITEM_NAME, ITEM_PRICE')
      .in('ITEM_ID', itemIds)

    if (!menuError) {
      ;(menuData ?? []).forEach((row: any) => {
        menuMap.set(Number(row.ITEM_ID), {
          name: String(row.ITEM_NAME ?? `Item #${row.ITEM_ID}`),
          price: Number(row.ITEM_PRICE ?? 0),
        })
      })
    } else {
      console.warn('Dispatcher Menu_Items lookup failed; using item IDs:', menuError)
    }
  }

  const itemsByOrder = new Map<number, DispatcherOrderItem[]>()
  ;(itemsData ?? []).forEach((row: any) => {
    const orderId = Number(row.ORDER_ID)
    const menuItem = menuMap.get(Number(row.ITEM_ID))
    const item: DispatcherOrderItem = {
      orderItemId: Number(row.ORDER_ITEM_ID),
      orderId,
      itemId: String(row.ITEM_ID),
      status: String(row.ORDER_ITEM_STATUS ?? 'PENDING').toUpperCase(),
      isFlagged: Boolean(row.IS_FLAGGED),
      rejectionReason: null,
      name: menuItem?.name ?? `Item #${row.ITEM_ID}`,
      price: menuItem?.price,
    }
    if (!itemsByOrder.has(orderId)) itemsByOrder.set(orderId, [])
    itemsByOrder.get(orderId)!.push(item)
  })

  return orders
    .map((row: any) => {
      const orderId = Number(row.ORDER_ID)
      const items = itemsByOrder.get(orderId) ?? []
      const hasActiveItems = items.some((item) => item.status !== 'CANCELLED')
      if (!hasActiveItems) return null

      const tableId = Number(row.TABLE_ID)
      return {
      orderId,
      tableId,
      tableNum: tableId,
      tableDisplay: `Table ${tableId}`,
      orderStatus: String(row.ORDER_STATUS ?? '').toUpperCase() as OrderStatus,
      orderType: row.ORDER_TYPE as Order['orderType'],
      totalBill: Number(row.TOTAL_BILL ?? 0),
      createdAt: row.TIME as string | undefined,
      kitchenNote: (row.KITCHEN_NOTE as string | null) ?? undefined,
      serverNote: (row.SERVER_NOTE as string | null) ?? undefined,
      items: itemsByOrder.get(Number(row.ORDER_ID)) ?? [],
      } as DispatcherOrder
    })
    .filter((order): order is DispatcherOrder => order !== null)
}

export async function fetchOrderViewerData(): Promise<Array<{
  orderId: number
  tableDisplay: string
  items: Array<{ name: string; quantity: number }>
}>> {
  // Step 1: fetch orders with items that have PENDING or COOKING status
  const { data: ordersData, error: ordersError } = await supabase
    .from('Restaurant_Orders')
    .select('ORDER_ID, TABLE_ID')
    .in('ORDER_STATUS', ['REQUESTED', 'VERIFIED', 'PREPARING'])
    .order('ORDER_ID', { ascending: true })

  if (ordersError) throw ordersError
  if (!ordersData || ordersData.length === 0) return []

  const orderIds = ordersData.map((o: any) => o.ORDER_ID)

  // Step 2: fetch only active (non-cancelled, non-done) items
  const { data: itemsData, error: itemsError } = await supabase
    .from('Order_Items')
    .select('ORDER_ID, ITEM_ID, ORDER_ITEM_STATUS')
    .in('ORDER_ID', orderIds)
    .in('ORDER_ITEM_STATUS', ['PENDING', 'COOKING', 'DONE'])

  if (itemsError) throw itemsError

  // Step 3: fetch menu item names
  const itemIdSet = [...new Set((itemsData ?? []).map((i: any) => i.ITEM_ID).filter(Boolean))]
  const { data: menuData } = await supabase
    .from('Menu_Items')
    .select('ITEM_ID, ITEM_NAME')
    .in('ITEM_ID', itemIdSet)

  const nameMap = new Map<number, string>()
  ;(menuData ?? []).forEach((m: any) => nameMap.set(m.ITEM_ID, m.ITEM_NAME))

  // Step 4: fetch tables for display labels
  const { data: tablesData } = await supabase.from('Restaurant_Tables').select('*')
  const allTables = (tablesData as TableData[]) ?? []

  // Group items by order
  const itemsByOrder = new Map<number, Map<string, number>>()
  ;(itemsData ?? []).forEach((row: any) => {
    const oid = row.ORDER_ID
    const name = nameMap.get(row.ITEM_ID) || `Item #${row.ITEM_ID}`
    if (!itemsByOrder.has(oid)) itemsByOrder.set(oid, new Map())
    const map = itemsByOrder.get(oid)!
    map.set(name, (map.get(name) || 0) + 1)
  })

  return ordersData.map((o: any) => {
    const grp = resolveTableGroupByList(Number(o.TABLE_ID), allTables)
    const itemMap = itemsByOrder.get(o.ORDER_ID) ?? new Map()
    return {
      orderId: Number(o.ORDER_ID),
      tableDisplay: grp.displayLabel,
      items: Array.from(itemMap.entries()).map(([name, quantity]) => ({ name, quantity }))
    }
  })
}

export async function moveOrderToCooking(orderId: number): Promise<void> {
  // Ensure ORDER_STATUS is PREPARING
  const { error } = await supabase
    .from('Restaurant_Orders')
    .update({ ORDER_STATUS: 'PREPARING' })
    .eq('ORDER_ID', orderId)
    .in('ORDER_STATUS', ['REQUESTED', 'VERIFIED'])

  if (error) throw error

  // Set all PENDING items to COOKING
  const { error: itemError } = await supabase
    .from('Order_Items')
    .update({ ORDER_ITEM_STATUS: 'COOKING' })
    .eq('ORDER_ID', orderId)
    .eq('ORDER_ITEM_STATUS', 'PENDING')

  if (itemError) throw itemError

  logOrderEvent(orderId, {
    eventType: 'STATUS_COOKING',
    newStatus: 'PREPARING',
    actor: 'Dispatcher',
    reason: 'Order moved to cooking',
  })
}

export async function moveOrderToDispatched(orderId: number): Promise<void> {
  // Set ORDER_STATUS to READY — removes from dispatcher, notifies cashier
  const { error } = await supabase
    .from('Restaurant_Orders')
    .update({ ORDER_STATUS: 'READY' })
    .eq('ORDER_ID', orderId)

  if (error) throw error

  logOrderEvent(orderId, {
    eventType: 'STATUS_READY',
    newStatus: 'READY',
    actor: 'Dispatcher',
    reason: 'All items cooked and ready for serving',
  })
}

export async function updateItemCookingCount(
  orderId: number,
  itemId: string,
  completedCount: number
): Promise<void> {
  // Get all order items for this menu item in this order
  const { data: items, error: fetchError } = await supabase
    .from('Order_Items')
    .select('ORDER_ITEM_ID, ORDER_ITEM_STATUS')
    .eq('ORDER_ID', orderId)
    .eq('ITEM_ID', Number(itemId))
    .order('ORDER_ITEM_ID', { ascending: true })

  if (fetchError) throw fetchError
  if (!items || items.length === 0) return

  // Mark the first 'completedCount' items as DONE, rest stay COOKING
  for (let i = 0; i < items.length; i++) {
    const newStatus = i < completedCount ? 'DONE' : 'COOKING'
    if (items[i].ORDER_ITEM_STATUS !== newStatus) {
      await supabase
        .from('Order_Items')
        .update({ ORDER_ITEM_STATUS: newStatus })
        .eq('ORDER_ITEM_ID', items[i].ORDER_ITEM_ID)
    }
  }
}

export async function rejectOrderItems(
  orderId: number,
  itemRejections: Array<{ orderItemId: number; itemId: string; reason: string }>
): Promise<void> {
  // Update each rejected item with its rejection reason
  for (const rejection of itemRejections) {
    const { error } = await supabase
      .from('Order_Items')
      .update({ 
        ORDER_ITEM_STATUS: 'CANCELLED',
        REJECTION_REASON: [rejection.reason]  // Store as array
      })
      .eq('ORDER_ITEM_ID', rejection.orderItemId)

    if (error) throw error

    // Unavailable items are cancelled in every pending order and removed from the menu.
    if (rejection.reason === 'unavailable') {
      const itemId = Number(rejection.itemId)
      const { error: pendingItemsError } = await supabase
        .from('Order_Items')
        .update({
          ORDER_ITEM_STATUS: 'CANCELLED',
          REJECTION_REASON: ['unavailable'],
        })
        .eq('ITEM_ID', itemId)
        .eq('ORDER_ITEM_STATUS', 'PENDING')

      if (pendingItemsError) throw pendingItemsError

      const { error: menuError } = await supabase
        .from('Menu_Items')
        .update({ ITEM_STATUS: 'OUT_OF_STOCK' })
        .eq('ITEM_ID', itemId)

      if (menuError) throw menuError
      broadcastMenuItemStatus(itemId, true)
    }
  }

  // Check if all items are rejected
  const { data: orderItems } = await supabase
    .from('Order_Items')
    .select('ORDER_ITEM_STATUS')
    .eq('ORDER_ID', orderId)

  const allRejected = orderItems?.every(item => item.ORDER_ITEM_STATUS === 'CANCELLED')

  if (allRejected) {
    // If all items rejected, cancel the entire order
    await supabase
      .from('Restaurant_Orders')
      .update({ ORDER_STATUS: 'CANCELLED' })
      .eq('ORDER_ID', orderId)

    logOrderEvent(orderId, {
      eventType: 'ORDER_CANCELLED',
      newStatus: 'CANCELLED',
      actor: 'Dispatcher',
      reason: 'All items rejected',
    })
  } else {
    logOrderEvent(orderId, {
      eventType: 'ITEMS_REJECTED',
      newStatus: 'PREPARING',
      actor: 'Dispatcher',
      reason: `${itemRejections.length} item(s) rejected`,
    })
  }
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

export async function saveDispatcherNote(orderId: number, note: string): Promise<void> {
  const { error } = await supabase
    .from('Restaurant_Orders')
    .update({ KITCHEN_NOTE: note.trim() || null })
    .eq('ORDER_ID', orderId)

  if (error) throw error
}
