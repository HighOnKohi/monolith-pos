import { supabase } from '@/lib/supabase'
import type { TicketOrder, TicketOrderItem, TicketCartItem, TicketCustomerInfo, TicketStatus } from '@/types/ticket'
import { broadcastOrderUpdate } from '@/services/dispatcherService'

/**
 * Generates a unique 6-digit Ticket ID number.
 */
export async function generateTicketId(): Promise<number> {
  // Generate a random 6-digit ID between 100000 and 999999
  const baseId = Math.floor(100000 + Math.random() * 900000)

  // Quick check if ID collision exists
  try {
    const { data } = await supabase
      .from('Ticket_Orders')
      .select('TICKET_ID')
      .eq('TICKET_ID', baseId)
      .maybeSingle()

    if (data) {
      // Collision occurred, fallback to timestamp suffix
      return Number(`${Date.now()}`.slice(-6))
    }
  } catch {
    // If lookup fails, use generated ID
  }

  return baseId
}

/**
 * Parses numeric contact info from input string (strips non-digits)
 */
export function sanitizeContactNumber(contact: string): number | null {
  const digits = contact.replace(/\D/g, '')
  if (!digits) return null
  const num = Number(digits)
  return isNaN(num) ? null : num
}

/**
 * Creates a new Ticket Order and its associated items in Supabase.
 */
export async function createTicketOrder(
  ticketId: number,
  customerInfo: TicketCustomerInfo,
  cartItems: TicketCartItem[],
): Promise<TicketOrder> {
  const contactNum = sanitizeContactNumber(customerInfo.contactInfo)

  // 1. Insert into Ticket_Orders
  const { data: orderData, error: orderError } = await supabase
    .from('Ticket_Orders')
    .insert({
      TICKET_ID: ticketId,
      REGISTERED_NAME: customerInfo.name.trim() || null,
      REGISTERED_CONTACT_INFO: contactNum,
      REGISTERED_TIME_OF_ARRIVAL: customerInfo.timeOfArrival.trim() || null,
      TICKET_STATUS: 'REQUESTED',
    })
    .select()
    .single()

  if (orderError || !orderData) {
    throw orderError ?? new Error('Failed to create ticket order.')
  }

  // 2. Insert items into Ticket_Order_Items
  const orderItemsToInsert = cartItems.flatMap((ci) => {
    const rawId = String(ci.id).replace(/^group-/, '')
    const idNum = Number(rawId)
    return Array.from({ length: ci.quantity }, () => ({
      TICKET_ORDER_ID: ticketId,
      ITEM_ID: ci.isGroup ? null : (isNaN(idNum) ? null : idNum),
      ITEM_GROUP_ID: ci.isGroup ? (isNaN(idNum) ? null : idNum) : null,
      TICKET_ORDER_ITEM_STATUS: 'REQUESTED',
    }))
  })

  if (orderItemsToInsert.length > 0) {
    const { data: insertedItems, error: itemsError } = await supabase
      .from('Ticket_Order_Items')
      .insert(orderItemsToInsert)
      .select('TICKET_ORDER_ITEM_ID, ITEM_GROUP_ID')

    if (itemsError) {
      console.error('[ticketService] Failed to insert ticket order items:', itemsError)
      throw itemsError
    }

    // 3. For any inserted group items (where ITEM_GROUP_ID is not null), insert their constituent items into Ticket_Order_Group_Items
    const groupRows = (insertedItems ?? []).filter((r: any) => r.ITEM_GROUP_ID)
    if (groupRows.length > 0) {
      const groupIds = [...new Set(groupRows.map((r: any) => Number(r.ITEM_GROUP_ID)))]
      const { data: itemGroupLinks, error: linksError } = await supabase
        .from('Item_Groups')
        .select('MENU_GROUP_ID, ITEM_ID')
        .in('MENU_GROUP_ID', groupIds)

      const linksByGroup = new Map<number, number[]>()
      if (!linksError && itemGroupLinks) {
        itemGroupLinks.forEach((link: any) => {
          const gid = Number(link.MENU_GROUP_ID)
          if (!linksByGroup.has(gid)) linksByGroup.set(gid, [])
          linksByGroup.get(gid)!.push(Number(link.ITEM_ID))
        })
      }

      // Fallback to cart rawGroup itemIds if Item_Groups query had no results
      cartItems.forEach((ci) => {
        if (ci.isGroup && ci.rawGroup?.itemIds) {
          const gid = Number(String(ci.id).replace(/^group-/, ''))
          if (!linksByGroup.has(gid) || linksByGroup.get(gid)!.length === 0) {
            linksByGroup.set(gid, ci.rawGroup.itemIds.map(Number).filter(Boolean))
          }
        }
      })

      const groupItemsToInsert: Array<{
        TICKET_GROUP_ID: number
        ITEM_ID: number
        ITEM_STATUS: string
      }> = []

      groupRows.forEach((r: any) => {
        const gid = Number(r.ITEM_GROUP_ID)
        const ticketGroupId = Number(r.TICKET_ORDER_ITEM_ID)
        const itemIds = linksByGroup.get(gid) ?? []
        itemIds.forEach((childItemId) => {
          groupItemsToInsert.push({
            TICKET_GROUP_ID: ticketGroupId,
            ITEM_ID: childItemId,
            ITEM_STATUS: 'REQUESTED',
          })
        })
      })

      if (groupItemsToInsert.length > 0) {
        const { error: groupItemsInsertErr } = await supabase
          .from('Ticket_Order_Group_Items')
          .insert(groupItemsToInsert)

        if (groupItemsInsertErr) {
          console.warn('[ticketService] Batch insert into Ticket_Order_Group_Items error (check unique constraint on TICKET_GROUP_ID):', groupItemsInsertErr)
          // Attempt individual row inserts in case of partial constraint conflicts
          for (const row of groupItemsToInsert) {
            await supabase.from('Ticket_Order_Group_Items').insert(row)
          }
        }
      }
    }
  }

  broadcastOrderUpdate({ type: 'tickets' })

  return {
    ticketId,
    registeredName: orderData.REGISTERED_NAME,
    registeredContactInfo: orderData.REGISTERED_CONTACT_INFO,
    registeredTimeOfArrival: orderData.REGISTERED_TIME_OF_ARRIVAL,
    ticketStatus: (orderData.TICKET_STATUS as TicketStatus) || 'REQUESTED',
  }
}

/**
 * Fetches all ticket orders with their nested items and linked menu data.
 */
export async function fetchTicketOrders(): Promise<TicketOrder[]> {
  const { data, error } = await supabase
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
          ITEM_NAME,
          ITEM_PRICE,
          ITEM_IMAGE_URL
        ),
        Menu_Item_Groups (
          GROUP_NAME,
          GROUP_PRICE,
          GROUP_IMAGE_URL,
          GROUP_DESCRIPTION,
          Item_Groups (
            ITEM_ID,
            Menu_Items (
              ITEM_NAME
            )
          )
        )
      )
    `)
    .order('TICKET_ID', { ascending: false })

  if (error) {
    console.error('[ticketService] fetchTicketOrders error:', error)
    throw error
  }

  return (data ?? []).map((row: Record<string, unknown>) => {
    const rawItems = (row['Ticket_Order_Items'] as Array<Record<string, unknown>> | undefined) ?? []
    let calculatedTotal = 0

    const items: TicketOrderItem[] = rawItems.map((oi) => {
      const menuItem = oi['Menu_Items'] as Record<string, unknown> | undefined
      const groupItem = oi['Menu_Item_Groups'] as Record<string, unknown> | undefined
      const isGroup = Boolean(oi['ITEM_GROUP_ID'])

      let name = 'Unknown Item'
      let price = 0
      let imageUrl = ''
      let includedItems: string[] = []

      if (isGroup && groupItem) {
        name = String(groupItem['GROUP_NAME'] ?? 'Group Combo')
        price = Number(groupItem['GROUP_PRICE'] ?? 0)
        imageUrl = String(groupItem['GROUP_IMAGE_URL'] ?? '')
        const itemLinks = (groupItem['Item_Groups'] as Array<Record<string, unknown>> | undefined) ?? []
        includedItems = itemLinks.map((il) => {
          const mi = il['Menu_Items'] as Record<string, unknown> | undefined
          return mi ? String(mi['ITEM_NAME']) : `Item #${il['ITEM_ID']}`
        })
      } else if (menuItem) {
        name = String(menuItem['ITEM_NAME'] ?? 'Dish')
        price = Number(menuItem['ITEM_PRICE'] ?? 0)
        imageUrl = String(menuItem['ITEM_IMAGE_URL'] ?? '')
      }

      calculatedTotal += price

      return {
        ticketOrderItemId: Number(oi['TICKET_ORDER_ITEM_ID']),
        ticketOrderId: Number(oi['TICKET_ORDER_ID']),
        itemId: oi['ITEM_ID'] ? Number(oi['ITEM_ID']) : null,
        itemGroupId: oi['ITEM_GROUP_ID'] ? Number(oi['ITEM_GROUP_ID']) : null,
        discountId: oi['DISCOUNT_ID'] ? Number(oi['DISCOUNT_ID']) : null,
        ticketOrderItemStatus: (oi['TICKET_ORDER_ITEM_STATUS'] as TicketStatus) || 'REQUESTED',
        isGroup,
        name,
        price,
        imageUrl,
        includedItems: includedItems.length > 0 ? includedItems : undefined,
        groupDescription: isGroup && groupItem ? String(groupItem['GROUP_DESCRIPTION'] ?? '') : undefined,
      }
    })

    return {
      ticketId: Number(row['TICKET_ID']),
      registeredName: (row['REGISTERED_NAME'] as string | null) ?? null,
      registeredContactInfo: row['REGISTERED_CONTACT_INFO'] ? Number(row['REGISTERED_CONTACT_INFO']) : null,
      registeredTimeOfArrival: (row['REGISTERED_TIME_OF_ARRIVAL'] as string | null) ?? null,
      ticketStatus: (row['TICKET_STATUS'] as TicketStatus) || 'REQUESTED',
      createdAt: (row['CREATED_AT'] as string | null) ?? undefined,
      completedAt: (row['COMPLETED_AT'] as string | null) ?? null,
      items,
      totalAmount: calculatedTotal,
    }
  })
}

/**
 * Updates a ticket order's status (REQUESTED | PREPARING | COMPLETED)
 */
export async function updateTicketOrderStatus(ticketId: number, status: TicketStatus): Promise<void> {
  const { error } = await supabase
    .from('Ticket_Orders')
    .update({ TICKET_STATUS: status })
    .eq('TICKET_ID', ticketId)

  if (error) {
    console.error('[ticketService] Failed to update ticket status:', error)
    throw error
  }

  broadcastOrderUpdate({ type: 'tickets' })
}

/**
 * Settles/Bills out a ticket order at the cashier station.
 * Marks the ticket COMPLETED and records COMPLETED_AT timestamp so it
 * clears from the Cashier's pending billing list and persists into logs & analytics.
 */
export async function settleTicketOrder(ticketId: number): Promise<void> {
  const { error } = await supabase
    .from('Ticket_Orders')
    .update({
      TICKET_STATUS: 'COMPLETED',
      COMPLETED_AT: new Date().toISOString(),
    })
    .eq('TICKET_ID', ticketId)

  if (error) {
    console.error('[ticketService] Failed to settle ticket order:', error)
    throw error
  }

  // Also ensure child item statuses are marked COMPLETED
  await supabase
    .from('Ticket_Order_Items')
    .update({ TICKET_ORDER_ITEM_STATUS: 'COMPLETED' })
    .eq('TICKET_ORDER_ID', ticketId)

  broadcastOrderUpdate({ type: 'tickets' })
}

/**
 * Deletes/Cancels a ticket order and its items safely without foreign key conflicts.
 */
export async function deleteTicketOrder(ticketId: number): Promise<void> {
  // 1. Fetch child item IDs to clear linked group items first
  const { data: childItems } = await supabase
    .from('Ticket_Order_Items')
    .select('TICKET_ORDER_ITEM_ID')
    .eq('TICKET_ORDER_ID', ticketId)

  const itemIds = (childItems ?? []).map((i: any) => Number(i.TICKET_ORDER_ITEM_ID))
  if (itemIds.length > 0) {
    const { error: groupItemsErr } = await supabase
      .from('Ticket_Order_Group_Items')
      .delete()
      .in('TICKET_GROUP_ID', itemIds)
    if (groupItemsErr) {
      console.warn('[ticketService] Warning deleting Ticket_Order_Group_Items:', groupItemsErr)
    }
  }

  // 2. Delete child items
  const { error: itemsErr } = await supabase
    .from('Ticket_Order_Items')
    .delete()
    .eq('TICKET_ORDER_ID', ticketId)

  if (itemsErr) {
    console.error('[ticketService] Failed to delete ticket order items:', itemsErr)
    throw itemsErr
  }

  // 3. Delete order
  const { error } = await supabase.from('Ticket_Orders').delete().eq('TICKET_ID', ticketId)
  if (error) {
    console.error('[ticketService] Failed to delete ticket order:', error)
    throw error
  }

  broadcastOrderUpdate({ type: 'tickets' })
}
