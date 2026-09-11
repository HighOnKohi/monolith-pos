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
    .in('ORDER_STATUS', ['REQUESTED', 'VERIFIED', 'PREPARING', 'READY', 'SERVED', 'COMPLETED'])
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
    .order('ORDER_ITEM_ID', { ascending: true })

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
    .eq('ORDER_STATUS', 'PREPARING')
    .order('ORDER_ID', { ascending: true })

  if (ordersError) throw ordersError
  if (!ordersData || ordersData.length === 0) return []

  const orderIds = ordersData.map((o: any) => o.ORDER_ID)

  // Step 2: fetch only active (non-cancelled, non-done) items
  const { data: itemsData, error: itemsError } = await supabase
    .from('Order_Items')
    .select('ORDER_ID, ITEM_ID, ORDER_ITEM_STATUS')
    .in('ORDER_ID', orderIds)
    .in('ORDER_ITEM_STATUS', ['PENDING', 'COOKING'])
    .order('ORDER_ITEM_ID', { ascending: true })

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

  return ordersData.flatMap((o: any) => {
    const grp = resolveTableGroupByList(Number(o.TABLE_ID), allTables)
    const itemMap = itemsByOrder.get(o.ORDER_ID) ?? new Map()
    if (itemMap.size === 0) return []
    return [{
      orderId: Number(o.ORDER_ID),
      tableDisplay: grp.displayLabel,
      items: Array.from(itemMap.entries()).map(([name, quantity]) => ({ name, quantity }))
    }]
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

  broadcastOrderUpdate({ type: 'tables' })
}

export async function moveOrderToReady(orderId: number): Promise<void> {
  // Step: "Mark as Done" -> ORDER_STATUS = READY (shows in Dispatcher Done tab)
  const { error: orderError } = await supabase
    .from('Restaurant_Orders')
    .update({ ORDER_STATUS: 'READY' })
    .eq('ORDER_ID', orderId)

  if (orderError) throw orderError

  logOrderEvent(orderId, {
    eventType: 'STATUS_READY',
    newStatus: 'READY',
    actor: 'Dispatcher',
    reason: 'Items cooked, order marked as done',
  })

  broadcastOrderUpdate({ type: 'tables' })
}

export async function moveOrderToCompleted(orderId: number): Promise<void> {
  // Step: "Mark as Complete" -> ORDER_STATUS = COMPLETED, ITEM_STATUS = DONE (shows in Cashier)
  const { error: itemError } = await supabase
    .from('Order_Items')
    .update({ ORDER_ITEM_STATUS: 'DONE' })
    .eq('ORDER_ID', orderId)
    .neq('ORDER_ITEM_STATUS', 'CANCELLED')

  if (itemError) console.warn('[moveOrderToCompleted] Order_Items update warning:', itemError)

  const { error: orderError } = await supabase
    .from('Restaurant_Orders')
    .update({ ORDER_STATUS: 'COMPLETED' })
    .eq('ORDER_ID', orderId)

  if (orderError) throw orderError

  logOrderEvent(orderId, {
    eventType: 'STATUS_COMPLETED',
    newStatus: 'COMPLETED',
    actor: 'Dispatcher',
    reason: 'Order marked as complete and sent to Cashier',
  })

  broadcastOrderUpdate({ type: 'tables' })
}

// Alias for backwards compatibility
export const moveOrderToDispatched = moveOrderToReady

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
      const { error: updateError } = await supabase
        .from('Order_Items')
        .update({ ORDER_ITEM_STATUS: newStatus })
        .eq('ORDER_ITEM_ID', items[i].ORDER_ITEM_ID)

      if (updateError) throw updateError
    }
  }

  broadcastOrderUpdate({ type: 'tables' })
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

  broadcastOrderUpdate({ type: 'tables' })
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

// ─── Dispatcher & Order Viewer Ticket Operations ──────────────────────────────

export interface DispatcherTicketItem {
  ticketOrderItemId: number
  ticketOrderId: number
  itemId: number | null
  itemGroupId: number | null
  name: string
  status: 'REQUESTED' | 'PREPARING' | 'COMPLETED'
  isGroup?: boolean
  groupName?: string
  includedItems?: Array<{ id: number; name: string; status: 'REQUESTED' | 'PREPARING' | 'COMPLETED' }>
}

export interface DispatcherTicketOrder {
  ticketId: number
  registeredName: string | null
  registeredContactInfo: number | null
  registeredTimeOfArrival: string | null
  ticketStatus: 'REQUESTED' | 'PREPARING' | 'COMPLETED'
  items: DispatcherTicketItem[]
}

// ─── Realtime Cross-Component Event Bus ───────────────────────────────────────

const REALTIME_CHANNEL_NAME = 'monolith_order_events'
let broadcastChannelInstance: BroadcastChannel | null = null

function getBroadcastChannel(): BroadcastChannel | null {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    if (!broadcastChannelInstance) {
      broadcastChannelInstance = new BroadcastChannel(REALTIME_CHANNEL_NAME)
    }
    return broadcastChannelInstance
  }
  return null
}

export function broadcastOrderUpdate(detail: { type?: 'tables' | 'tickets' | 'all'; source?: string } = {}) {
  if (typeof window === 'undefined') return

  // 1. Dispatch DOM window event for same-tab listeners
  window.dispatchEvent(new CustomEvent('monolith-order-update', { detail }))

  // 2. Broadcast across browser tabs / windows with zero network overhead
  try {
    const channel = getBroadcastChannel()
    channel?.postMessage(detail)
  } catch (err) {
    console.warn('[broadcastOrderUpdate] BroadcastChannel error:', err)
  }
}

export function subscribeToOrderUpdates(callback: (detail: any) => void): () => void {
  if (typeof window === 'undefined') return () => {}

  const handleCustomEvent = (e: Event) => {
    callback((e as CustomEvent).detail ?? {})
  }

  window.addEventListener('monolith-order-update', handleCustomEvent)

  const channel = getBroadcastChannel()
  const handleBroadcastMessage = (event: MessageEvent) => {
    callback(event.data ?? {})
  }

  channel?.addEventListener('message', handleBroadcastMessage)

  return () => {
    window.removeEventListener('monolith-order-update', handleCustomEvent)
    channel?.removeEventListener('message', handleBroadcastMessage)
  }
}

export async function fetchDispatcherTicketOrders(): Promise<DispatcherTicketOrder[]> {
  try {
    // 1. Fetch all active Ticket_Orders
    const { data: tickets, error: ticketsError } = await supabase
      .from('Ticket_Orders')
      .select('TICKET_ID, REGISTERED_NAME, REGISTERED_CONTACT_INFO, REGISTERED_TIME_OF_ARRIVAL, TICKET_STATUS')
      .order('TICKET_ID', { ascending: false })

    if (ticketsError) {
      console.error('[dispatcherService] Ticket_Orders query error:', ticketsError)
      return []
    }
    if (!tickets || tickets.length === 0) return []

    const ticketIds = tickets.map((t: any) => Number(t.TICKET_ID))

    // 2. Fetch Ticket_Order_Items for these tickets
    const { data: itemsData, error: itemsError } = await supabase
      .from('Ticket_Order_Items')
      .select('TICKET_ORDER_ITEM_ID, TICKET_ORDER_ID, ITEM_ID, ITEM_GROUP_ID, TICKET_ORDER_ITEM_STATUS')
      .in('TICKET_ORDER_ID', ticketIds)
      .order('TICKET_ORDER_ITEM_ID', { ascending: true })

    if (itemsError) {
      console.error('[dispatcherService] Ticket_Order_Items query error:', itemsError)
      return []
    }

    const rawItems = itemsData ?? []

    // 3. Fetch Menu_Items for individual items
    const individualItemIds = [...new Set(rawItems.map((i: any) => Number(i.ITEM_ID)).filter(Boolean))]
    const menuItemMap = new Map<number, string>()
    if (individualItemIds.length > 0) {
      const { data: menuData } = await supabase
        .from('Menu_Items')
        .select('ITEM_ID, ITEM_NAME')
        .in('ITEM_ID', individualItemIds)

      ;(menuData ?? []).forEach((m: any) => menuItemMap.set(Number(m.ITEM_ID), String(m.ITEM_NAME)))
    }

    // 4. Fetch Group Combos & their included items
    const groupIds = [...new Set(rawItems.map((i: any) => Number(i.ITEM_GROUP_ID)).filter(Boolean))]
    const groupMap = new Map<number, { groupName: string; childItems: Array<{ id: number; name: string }> }>()
    if (groupIds.length > 0) {
      try {
        const { data: groupData } = await supabase
          .from('Menu_Item_Groups')
          .select('MENU_GROUP_ID, GROUP_NAME, Item_Groups(ITEM_ID, Menu_Items(ITEM_ID, ITEM_NAME))')
          .in('MENU_GROUP_ID', groupIds)

        ;(groupData ?? []).forEach((gRow: any) => {
          const links = (gRow['Item_Groups'] as Array<any>) ?? []
          const childItems = links.map((l: any) => ({
            id: Number(l.ITEM_ID),
            name: String(l.Menu_Items?.ITEM_NAME ?? `Item #${l.ITEM_ID}`),
          }))
          groupMap.set(Number(gRow.MENU_GROUP_ID), {
            groupName: String(gRow.GROUP_NAME ?? 'Combo'),
            childItems,
          })
        })
      } catch (grpErr) {
        console.warn('[dispatcherService] Group query failed:', grpErr)
      }
    }

    // 4b. Fetch Ticket_Order_Group_Items for all group ticket items
    const groupOrderItemIds = rawItems.filter((oi: any) => oi.ITEM_GROUP_ID).map((oi: any) => Number(oi.TICKET_ORDER_ITEM_ID))
    const groupSubItemsByTicketGroupId = new Map<number, Array<{ id: number; name: string; status: 'REQUESTED' | 'PREPARING' | 'COMPLETED' }>>()

    if (groupOrderItemIds.length > 0) {
      try {
        let { data: groupSubData } = await supabase
          .from('Ticket_Order_Group_Items')
          .select('TICKET_ORDER_GROUP_ITEM_ID, TICKET_GROUP_ID, ITEM_ID, ITEM_STATUS')
          .in('TICKET_GROUP_ID', groupOrderItemIds)

        // Check if any group ticket order item is missing rows in Ticket_Order_Group_Items
        const existingTgIds = new Set((groupSubData ?? []).map((s: any) => Number(s.TICKET_GROUP_ID)))
        const missingGroupItems = rawItems.filter((oi: any) => oi.ITEM_GROUP_ID && !existingTgIds.has(Number(oi.TICKET_ORDER_ITEM_ID)))

        if (missingGroupItems.length > 0) {
          const autoInsertRows: Array<{ TICKET_GROUP_ID: number; ITEM_ID: number; ITEM_STATUS: string }> = []
          missingGroupItems.forEach((oi: any) => {
            const gId = Number(oi.ITEM_GROUP_ID)
            const tgId = Number(oi.TICKET_ORDER_ITEM_ID)
            const rawStatus = String(oi.TICKET_ORDER_ITEM_STATUS ?? 'REQUESTED').toUpperCase().trim()
            const itemStatus = (rawStatus === 'COMPLETED' || rawStatus === 'DONE') ? 'COMPLETED' : (rawStatus === 'PREPARING' || rawStatus === 'COOKING') ? 'PREPARING' : 'REQUESTED'
            const grp = groupMap.get(gId)
            if (grp && grp.childItems.length > 0) {
              grp.childItems.forEach((c) => {
                autoInsertRows.push({
                  TICKET_GROUP_ID: tgId,
                  ITEM_ID: c.id,
                  ITEM_STATUS: itemStatus,
                })
              })
            }
          })

          if (autoInsertRows.length > 0) {
            const { error: autoInsertErr } = await supabase.from('Ticket_Order_Group_Items').insert(autoInsertRows)
            if (autoInsertErr) {
              for (const row of autoInsertRows) {
                await supabase.from('Ticket_Order_Group_Items').insert(row)
              }
            }
            const { data: refetched } = await supabase
              .from('Ticket_Order_Group_Items')
              .select('TICKET_ORDER_GROUP_ITEM_ID, TICKET_GROUP_ID, ITEM_ID, ITEM_STATUS')
              .in('TICKET_GROUP_ID', groupOrderItemIds)
            groupSubData = refetched ?? groupSubData
          }
        }

        const subItemIds = [...new Set((groupSubData ?? []).map((s: any) => Number(s.ITEM_ID)).filter(Boolean))]
        const subMenuMap = new Map<number, string>(menuItemMap)
        const missingSubIds = subItemIds.filter((id) => !subMenuMap.has(id))
        if (missingSubIds.length > 0) {
          const { data: extraMenu } = await supabase
            .from('Menu_Items')
            .select('ITEM_ID, ITEM_NAME')
            .in('ITEM_ID', missingSubIds)
          ;(extraMenu ?? []).forEach((m: any) => subMenuMap.set(Number(m.ITEM_ID), String(m.ITEM_NAME)))
        }

        ;(groupSubData ?? []).forEach((sRow: any) => {
          const tgId = Number(sRow.TICKET_GROUP_ID)
          if (!groupSubItemsByTicketGroupId.has(tgId)) groupSubItemsByTicketGroupId.set(tgId, [])
          const rawSubStatus = String(sRow.ITEM_STATUS ?? 'REQUESTED').toUpperCase().trim()
          const normSubStatus: 'REQUESTED' | 'PREPARING' | 'COMPLETED' =
            (rawSubStatus === 'COMPLETED' || rawSubStatus === 'DONE') ? 'COMPLETED'
            : (rawSubStatus === 'PREPARING' || rawSubStatus === 'COOKING') ? 'PREPARING'
            : 'REQUESTED'

          groupSubItemsByTicketGroupId.get(tgId)!.push({
            id: Number(sRow.ITEM_ID),
            name: subMenuMap.get(Number(sRow.ITEM_ID)) || `Item #${sRow.ITEM_ID}`,
            status: normSubStatus,
          })
        })
      } catch (subErr) {
        console.warn('[dispatcherService] Ticket_Order_Group_Items query failed:', subErr)
      }
    }

    // 5. Group items by ticket
    const itemsByTicket = new Map<number, DispatcherTicketItem[]>()

    rawItems.forEach((oi: any) => {
      const ticketId = Number(oi.TICKET_ORDER_ID)
      if (!itemsByTicket.has(ticketId)) itemsByTicket.set(ticketId, [])
      const list = itemsByTicket.get(ticketId)!

      const rawStatus = String(oi.TICKET_ORDER_ITEM_STATUS ?? '').toUpperCase().trim()
      const normalizedStatus: 'REQUESTED' | 'PREPARING' | 'COMPLETED' =
        (rawStatus === 'COMPLETED' || rawStatus === 'DONE' || rawStatus === '3' || rawStatus === 'SERVED')
          ? 'COMPLETED'
          : (rawStatus === 'PREPARING' || rawStatus === 'COOKING' || rawStatus === '2')
          ? 'PREPARING'
          : 'REQUESTED'

      const groupId = oi.ITEM_GROUP_ID ? Number(oi.ITEM_GROUP_ID) : null
      const itemId = oi.ITEM_ID ? Number(oi.ITEM_ID) : null
      const orderItemId = Number(oi.TICKET_ORDER_ITEM_ID)

      if (groupId && groupMap.has(groupId)) {
        const grp = groupMap.get(groupId)!
        const subItemsFromDb = groupSubItemsByTicketGroupId.get(orderItemId)
        const includedItems = subItemsFromDb && subItemsFromDb.length > 0
          ? subItemsFromDb
          : grp.childItems.map((c) => ({ id: c.id, name: c.name, status: normalizedStatus }))

        list.push({
          ticketOrderItemId: orderItemId,
          ticketOrderId: ticketId,
          itemId: null,
          itemGroupId: groupId,
          name: grp.groupName,
          status: normalizedStatus,
          isGroup: true,
          groupName: grp.groupName,
          includedItems,
        })
      } else if (itemId) {
        list.push({
          ticketOrderItemId: orderItemId,
          ticketOrderId: ticketId,
          itemId,
          itemGroupId: null,
          name: menuItemMap.get(itemId) || `Item #${itemId}`,
          status: normalizedStatus,
        })
      } else {
        list.push({
          ticketOrderItemId: orderItemId,
          ticketOrderId: ticketId,
          itemId: null,
          itemGroupId: null,
          name: `Ticket Item #${orderItemId}`,
          status: normalizedStatus,
        })
      }
    })

    return tickets.map((tRow: any) => {
      const rawTicketStatus = String(tRow.TICKET_STATUS ?? 'REQUESTED').toUpperCase().trim()
      const ticketStatus: 'REQUESTED' | 'PREPARING' | 'COMPLETED' =
        rawTicketStatus === 'COMPLETED' || rawTicketStatus === 'SERVED' || rawTicketStatus === 'DONE'
          ? 'COMPLETED'
          : rawTicketStatus === 'PREPARING' || rawTicketStatus === 'COOKING'
          ? 'PREPARING'
          : 'REQUESTED'

      return {
        ticketId: Number(tRow.TICKET_ID),
        registeredName: (tRow.REGISTERED_NAME as string | null) ?? null,
        registeredContactInfo: tRow.REGISTERED_CONTACT_INFO ? Number(tRow.REGISTERED_CONTACT_INFO) : null,
        registeredTimeOfArrival: (tRow.REGISTERED_TIME_OF_ARRIVAL as string | null) ?? null,
        ticketStatus,
        items: itemsByTicket.get(Number(tRow.TICKET_ID)) ?? [],
      }
    })
  } catch (err) {
    console.error('[dispatcherService] fetchDispatcherTicketOrders fatal error:', err)
    return []
  }
}

export async function startCookingTicket(ticketId: number): Promise<void> {
  const { error } = await supabase
    .from('Ticket_Orders')
    .update({ TICKET_STATUS: 'PREPARING' })
    .eq('TICKET_ID', ticketId)

  if (error) throw error

  // Update item status in Ticket_Order_Items to PREPARING
  const { data: updatedItems, error: itemErr } = await supabase
    .from('Ticket_Order_Items')
    .update({ TICKET_ORDER_ITEM_STATUS: 'PREPARING' })
    .eq('TICKET_ORDER_ID', ticketId)
    .select('TICKET_ORDER_ITEM_ID')

  if (itemErr) throw itemErr

  const updatedItemIds = (updatedItems ?? []).map((i: any) => Number(i.TICKET_ORDER_ITEM_ID))
  if (updatedItemIds.length > 0) {
    await supabase
      .from('Ticket_Order_Group_Items')
      .update({ ITEM_STATUS: 'PREPARING' })
      .in('TICKET_GROUP_ID', updatedItemIds)
  }

  broadcastOrderUpdate({ type: 'tickets' })
}

export async function cookAllRequestedTickets(): Promise<void> {
  const { error } = await supabase
    .from('Ticket_Orders')
    .update({ TICKET_STATUS: 'PREPARING' })
    .eq('TICKET_STATUS', 'REQUESTED')

  if (error) throw error

  const { data: updatedItems, error: itemErr } = await supabase
    .from('Ticket_Order_Items')
    .update({ TICKET_ORDER_ITEM_STATUS: 'PREPARING' })
    .eq('TICKET_ORDER_ITEM_STATUS', 'REQUESTED')
    .select('TICKET_ORDER_ITEM_ID')

  if (itemErr) {
    console.warn('[cookAllRequestedTickets] Item status update warning:', itemErr)
  }

  const updatedItemIds = (updatedItems ?? []).map((i: any) => Number(i.TICKET_ORDER_ITEM_ID))
  if (updatedItemIds.length > 0) {
    await supabase
      .from('Ticket_Order_Group_Items')
      .update({ ITEM_STATUS: 'PREPARING' })
      .in('TICKET_GROUP_ID', updatedItemIds)
  }

  broadcastOrderUpdate({ type: 'tickets' })
}

export async function startCookingTicketDish(
  ticketItemIds: number[],
  ticketIds: number[],
): Promise<void> {
  const uniqueItemIds = [...new Set(ticketItemIds)]
  const uniqueTicketIds = [...new Set(ticketIds)]

  if (uniqueItemIds.length > 0) {
    const { error: itemErr } = await supabase
      .from('Ticket_Order_Items')
      .update({ TICKET_ORDER_ITEM_STATUS: 'PREPARING' })
      .in('TICKET_ORDER_ITEM_ID', uniqueItemIds)

    if (itemErr) {
      console.warn('[startCookingTicketDish] Failed to update item status to PREPARING:', itemErr)
    }

    // Also update any linked rows in Ticket_Order_Group_Items to PREPARING
    await supabase
      .from('Ticket_Order_Group_Items')
      .update({ ITEM_STATUS: 'PREPARING' })
      .in('TICKET_GROUP_ID', uniqueItemIds)
  }

  if (uniqueTicketIds.length > 0) {
    await supabase
      .from('Ticket_Orders')
      .update({ TICKET_STATUS: 'PREPARING' })
      .in('TICKET_ID', uniqueTicketIds)
      .eq('TICKET_STATUS', 'REQUESTED')
  }

  broadcastOrderUpdate({ type: 'tickets' })
}

export async function updateTicketDishCookingCount(
  ticketItemIds: number[],
  completedCount: number,
): Promise<void> {
  const uniqueIds = [...new Set(ticketItemIds)]
  for (let i = 0; i < uniqueIds.length; i++) {
    const isDone = i < completedCount
    const textStatus = isDone ? 'COMPLETED' : 'PREPARING'

    // Only update standalone items (where ITEM_GROUP_ID is null)
    const { error } = await supabase
      .from('Ticket_Order_Items')
      .update({ TICKET_ORDER_ITEM_STATUS: textStatus })
      .eq('TICKET_ORDER_ITEM_ID', uniqueIds[i])
      .is('ITEM_GROUP_ID', null)

    if (error) {
      console.warn('[updateTicketDishCookingCount] Item update error:', error)
    }
  }

  broadcastOrderUpdate({ type: 'tickets' })
}

export async function updateTicketGroupSubItemCookingCount(
  ticketItemIds: number[],
  subItemId: number,
  remainingCookingCount: number,
): Promise<void> {
  const uniqueItemIds = [...new Set(ticketItemIds)]
  if (uniqueItemIds.length === 0) return

  // Fetch all Ticket_Order_Group_Items for these group items and this subItemId
  const { data: subRows, error } = await supabase
    .from('Ticket_Order_Group_Items')
    .select('TICKET_ORDER_GROUP_ITEM_ID, ITEM_STATUS')
    .in('TICKET_GROUP_ID', uniqueItemIds)
    .eq('ITEM_ID', subItemId)

  if (error || !subRows) {
    console.error('[updateTicketGroupSubItemCookingCount] fetch error:', error)
    return
  }

  const totalSubCount = subRows.length
  const completedCount = Math.max(0, totalSubCount - remainingCookingCount)

  for (let i = 0; i < subRows.length; i++) {
    const isDone = i < completedCount
    const newStatus = isDone ? 'COMPLETED' : 'PREPARING'
    await supabase
      .from('Ticket_Order_Group_Items')
      .update({ ITEM_STATUS: newStatus })
      .eq('TICKET_ORDER_GROUP_ITEM_ID', subRows[i].TICKET_ORDER_GROUP_ITEM_ID)
  }

  broadcastOrderUpdate({ type: 'all' })
}

export async function markTicketDishDone(
  ticketItemIds: number[],
  ticketIds: number[],
): Promise<void> {
  const uniqueItemIds = [...new Set(ticketItemIds)]
  const uniqueTicketIds = [...new Set(ticketIds)]

  if (uniqueItemIds.length > 0) {
    const { error: itemErr } = await supabase
      .from('Ticket_Order_Items')
      .update({ TICKET_ORDER_ITEM_STATUS: 'COMPLETED' })
      .in('TICKET_ORDER_ITEM_ID', uniqueItemIds)

    if (itemErr) {
      console.warn('[markTicketDishDone] Item update error:', itemErr)
    }

    // Also update any linked rows in Ticket_Order_Group_Items to COMPLETED
    await supabase
      .from('Ticket_Order_Group_Items')
      .update({ ITEM_STATUS: 'COMPLETED' })
      .in('TICKET_GROUP_ID', uniqueItemIds)
  }

  // Check if any tickets have all their items COMPLETED now
  for (const tid of uniqueTicketIds) {
    const { data: ticketItems } = await supabase
      .from('Ticket_Order_Items')
      .select('TICKET_ORDER_ITEM_STATUS')
      .eq('TICKET_ORDER_ID', tid)

    if (ticketItems && ticketItems.length > 0) {
      const allDone = ticketItems.every((it: any) => {
        const s = String(it.TICKET_ORDER_ITEM_STATUS ?? '').toUpperCase().trim()
        return s === 'COMPLETED' || s === 'DONE' || s === '3'
      })
      if (allDone) {
        await supabase
          .from('Ticket_Orders')
          .update({ TICKET_STATUS: 'COMPLETED' })
          .eq('TICKET_ID', tid)
      }
    }
  }

  broadcastOrderUpdate({ type: 'all' })
}

export async function updateTicketItemCookingCount(
  ticketId: number,
  ticketOrderItemIds: number[],
  completedCount: number,
): Promise<void> {
  const uniqueIds = [...new Set(ticketOrderItemIds)]
  for (let i = 0; i < uniqueIds.length; i++) {
    const isDone = i < completedCount
    const textStatus = isDone ? 'COMPLETED' : 'PREPARING'

    const { error } = await supabase
      .from('Ticket_Order_Items')
      .update({ TICKET_ORDER_ITEM_STATUS: textStatus })
      .eq('TICKET_ORDER_ITEM_ID', uniqueIds[i])

    if (error) {
      console.warn('[updateTicketItemCookingCount] update error:', error)
    }
  }

  broadcastOrderUpdate({ type: 'tickets' })
}

export async function completeTicketOrder(ticketId: number): Promise<void> {
  const { error } = await supabase
    .from('Ticket_Orders')
    .update({ TICKET_STATUS: 'COMPLETED' })
    .eq('TICKET_ID', ticketId)

  if (error) throw error

  const { error: itemErr } = await supabase
    .from('Ticket_Order_Items')
    .update({ TICKET_ORDER_ITEM_STATUS: 'COMPLETED' })
    .eq('TICKET_ORDER_ID', ticketId)

  if (itemErr) console.warn('[completeTicketOrder] error:', itemErr)

  // Also complete all sub items
  const { data: items } = await supabase
    .from('Ticket_Order_Items')
    .select('TICKET_ORDER_ITEM_ID')
    .eq('TICKET_ORDER_ID', ticketId)

  const itemIds = (items ?? []).map((i: any) => Number(i.TICKET_ORDER_ITEM_ID))
  if (itemIds.length > 0) {
    await supabase
      .from('Ticket_Order_Group_Items')
      .update({ ITEM_STATUS: 'COMPLETED' })
      .in('TICKET_GROUP_ID', itemIds)
  }

  broadcastOrderUpdate({ type: 'all' })
}

export async function fetchTicketOrderViewerData(): Promise<Array<{
  orderId: number
  tableDisplay: string
  registeredName?: string | null
  items: Array<{
    name: string
    quantity: number
    isGroup?: boolean
    includedItems?: Array<{ id: number; name: string; quantity: number }>
  }>
}>> {
  const tickets = await fetchDispatcherTicketOrders()
  const activeTickets = tickets.filter((t) => t.ticketStatus !== 'COMPLETED')

  return activeTickets.flatMap((ticket) => {
    const itemMap = new Map<
      string,
      {
        quantity: number
        isGroup?: boolean
        includedSubItemMap: Map<number, { id: number; name: string; quantity: number }>
      }
    >()

    // Only include items that are currently PREPARING
    ticket.items.forEach((item) => {
      if (item.status === 'PREPARING') {
        if (!itemMap.has(item.name)) {
          itemMap.set(item.name, {
            quantity: 0,
            isGroup: item.isGroup,
            includedSubItemMap: new Map(),
          })
        }
        const entry = itemMap.get(item.name)!
        entry.quantity += 1

        if (item.isGroup && item.includedItems) {
          item.includedItems.forEach((sub) => {
            if (!entry.includedSubItemMap.has(sub.id)) {
              entry.includedSubItemMap.set(sub.id, {
                id: sub.id,
                name: sub.name,
                quantity: 0,
              })
            }
            // Count active preparing amount for each constituent sub-item
            if (sub.status === 'PREPARING') {
              entry.includedSubItemMap.get(sub.id)!.quantity += 1
            }
          })
        }
      }
    })

    if (itemMap.size === 0) return []

    return [{
      orderId: ticket.ticketId,
      tableDisplay: `Ticket #${ticket.ticketId}`,
      registeredName: ticket.registeredName,
      items: Array.from(itemMap.entries()).map(([name, data]) => ({
        name,
        quantity: data.quantity,
        isGroup: data.isGroup,
        includedItems: data.isGroup
          ? Array.from(data.includedSubItemMap.values())
          : undefined,
      })),
    }]
  })
}
