import { supabase } from '@/lib/supabase'
import type {
  AdvanceOrder,
  CreateAdvanceOrderPayload,
  PreOrderSession,
  AdvanceOrderStatus,
} from '@/types/advanceOrder'
import type { CartItem, DiningType } from '@/types/cart'
import { createOrder, cancelOrder } from '@/services/orderService'
import { fetchAllTables, fetchOrderSummariesForIds, type TableData } from '@/services/tableService'

// ─── LocalStorage Keys ────────────────────────────────────────────────────────
const STORAGE_KEY_PREORDER_SESSION_ID = 'monolith_advance_order_session_id'
const STORAGE_KEY_CUSTOMER_NAME = 'monolith_advance_order_customer_name'
const STORAGE_KEY_CART = 'monolith_advance_order_cart'
const STORAGE_KEY_DINING_TYPE = 'monolith_advance_order_dining_type'
const STORAGE_KEY_TABLE_ID = 'monolith_advance_order_table_id'
const STORAGE_KEY_TABLE_NUM = 'monolith_advance_order_table_num'
const STORAGE_KEY_ACTIVE_TOKEN = 'monolith_advance_order_active_token'
const STORAGE_KEY_DB_FALLBACK = 'monolith_advance_orders_db_fallback'

// ─── Helper Functions ─────────────────────────────────────────────────────────

/** Generates a stable session ID for temporary checkout state. */
export function getOrCreatePreOrderSessionId(): string {
  let id = localStorage.getItem(STORAGE_KEY_PREORDER_SESSION_ID)
  if (!id) {
    id = `adv_sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
    localStorage.setItem(STORAGE_KEY_PREORDER_SESSION_ID, id)
  }
  return id
}

/** Generates a human-friendly order reference (e.g. "AO-8F42K"). */
function generateOrderNumber(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ' // omit easily confused chars (0, 1, I, O)
  let code = ''
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return `AO-${code}`
}

/** Generates a secure, unpredictable 32-character session token. */
function generateSessionToken(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `adv_tok_${crypto.randomUUID().replace(/-/g, '')}${Math.random().toString(36).slice(2, 10)}`
  }
  return `adv_tok_${Date.now()}_${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`
}

// ─── Pre-Order Session Management ─────────────────────────────────────────────

export function getPreOrderSession(): PreOrderSession {
  const sessionId = getOrCreatePreOrderSessionId()
  const customerName = localStorage.getItem(STORAGE_KEY_CUSTOMER_NAME) || ''
  const diningType = (localStorage.getItem(STORAGE_KEY_DINING_TYPE) as DiningType) || 'dine-in'
  const rawTableId = localStorage.getItem(STORAGE_KEY_TABLE_ID)
  const rawTableNum = localStorage.getItem(STORAGE_KEY_TABLE_NUM)
  const rawGuestCount = localStorage.getItem('advance_order_guest_count')
  const tableId = rawTableId ? Number(rawTableId) : null
  const tableNum = rawTableNum ? Number(rawTableNum) : null
  const guestCount = rawGuestCount ? Number(rawGuestCount) : undefined

  let cart: CartItem[] = []
  try {
    const rawCart = localStorage.getItem(STORAGE_KEY_CART)
    if (rawCart) {
      cart = JSON.parse(rawCart) as CartItem[]
    }
  } catch {
    cart = []
  }

  return {
    sessionId,
    customerName,
    diningType,
    tableId,
    tableNum,
    guestCount,
    cart,
  }
}

export function saveCustomerName(name: string): string {
  const trimmed = name.trim().slice(0, 50)
  localStorage.setItem(STORAGE_KEY_CUSTOMER_NAME, trimmed)
  return trimmed
}

/** Marks a table as RESERVED in Restaurant_Tables, syncing across merged groups if applicable. */
export async function markTableAsReserved(
  tableId: number,
  customerName: string,
  note?: string,
  guestCount?: number,
): Promise<void> {
  try {
    // Check if this table has a MERGE_GROUP_ID
    const { data: targetTable } = await supabase
      .from('Restaurant_Tables')
      .select('TABLE_ID, MERGE_GROUP_ID')
      .eq('TABLE_ID', tableId)
      .single()

    let targetIds = [tableId]
    if (targetTable?.MERGE_GROUP_ID != null) {
      const { data: groupTables } = await supabase
        .from('Restaurant_Tables')
        .select('TABLE_ID')
        .eq('MERGE_GROUP_ID', targetTable.MERGE_GROUP_ID)
      if (groupTables && groupTables.length > 0) {
        targetIds = groupTables.map((t) => t.TABLE_ID)
      }
    }

    const { error } = await supabase
      .from('Restaurant_Tables')
      .update({
        STATUS: 'RESERVED',
        RESERVED_SINCE: new Date().toISOString(),
        RESERVATION_NAME: customerName.trim(),
        RESERVATION_NOTES: note || 'Advance Order',
        CURRENT_GUEST_COUNT: guestCount ?? 1,
        RESERVATION_PAX: guestCount ?? 1,
      })
      .in('TABLE_ID', targetIds)

    if (error) {
      console.warn('[advanceOrderService] Could not update table status to RESERVED:', error)
    }
  } catch (err) {
    console.warn('[advanceOrderService] Exception marking table as RESERVED:', err)
  }
}

/** Releases a table reservation back to AVAILABLE, syncing across merged groups. */
export async function releaseTableReservation(tableId: number): Promise<void> {
  try {
    const { data: targetTable } = await supabase
      .from('Restaurant_Tables')
      .select('TABLE_ID, MERGE_GROUP_ID')
      .eq('TABLE_ID', tableId)
      .single()

    let targetIds = [tableId]
    if (targetTable?.MERGE_GROUP_ID != null) {
      const { data: groupTables } = await supabase
        .from('Restaurant_Tables')
        .select('TABLE_ID')
        .eq('MERGE_GROUP_ID', targetTable.MERGE_GROUP_ID)
      if (groupTables && groupTables.length > 0) {
        targetIds = groupTables.map((t) => t.TABLE_ID)
      }
    }

    const { error } = await supabase
      .from('Restaurant_Tables')
      .update({
        STATUS: 'AVAILABLE',
        RESERVED_SINCE: null,
        RESERVATION_NAME: null,
        RESERVATION_NOTES: null,
        RESERVATION_PAX: null,
        CURRENT_GUEST_COUNT: 0,
      })
      .in('TABLE_ID', targetIds)

    if (error) {
      console.warn('[advanceOrderService] Could not release table to AVAILABLE:', error)
    }
  } catch (err) {
    console.warn('[advanceOrderService] Exception releasing table:', err)
  }
}

export async function savePreOrderTable(
  tableId: number | null,
  tableNum: number | null,
  previousTableId?: number | null,
  customerName?: string,
  guestCount?: number,
) {
  // If user held a previous table that changed, release it
  if (previousTableId && previousTableId !== tableId) {
    await releaseTableReservation(previousTableId)
  }

  if (tableId != null) {
    localStorage.setItem(STORAGE_KEY_TABLE_ID, String(tableId))
    if (guestCount) {
      localStorage.setItem('advance_order_guest_count', String(guestCount))
    }
    // Mark chosen table as RESERVED with shared guest count
    await markTableAsReserved(tableId, customerName || 'Advance Order Guest', 'Advance Order Seating', guestCount)
  } else {
    localStorage.removeItem(STORAGE_KEY_TABLE_ID)
    localStorage.removeItem('advance_order_guest_count')
  }

  if (tableNum != null) {
    localStorage.setItem(STORAGE_KEY_TABLE_NUM, String(tableNum))
  } else {
    localStorage.removeItem(STORAGE_KEY_TABLE_NUM)
  }
}

export function savePreOrderCart(cart: CartItem[], diningType: DiningType) {
  try {
    localStorage.setItem(STORAGE_KEY_CART, JSON.stringify(cart))
    localStorage.setItem(STORAGE_KEY_DINING_TYPE, diningType)
  } catch {
    // Ignore storage quota errors
  }
}

export function clearPreOrderCart() {
  localStorage.removeItem(STORAGE_KEY_CART)
}

// ─── Active Order Session Token ───────────────────────────────────────────────

export function getActiveSessionToken(): string | null {
  return localStorage.getItem(STORAGE_KEY_ACTIVE_TOKEN)
}

export function setActiveSessionToken(token: string) {
  localStorage.setItem(STORAGE_KEY_ACTIVE_TOKEN, token)
}

export function clearActiveAdvanceOrder() {
  localStorage.removeItem(STORAGE_KEY_ACTIVE_TOKEN)
  localStorage.removeItem(STORAGE_KEY_CART)
  localStorage.removeItem(STORAGE_KEY_TABLE_ID)
  localStorage.removeItem(STORAGE_KEY_TABLE_NUM)
}

/**
 * Resets the entire advance order session for debugging/fresh start:
 * releases any reserved table held by this session and wipes local storage cache.
 */
export async function resetAdvanceOrderSession(): Promise<void> {
  const token = getActiveSessionToken()
  if (token) {
    const active = await getActiveAdvanceOrder(token)
    if (active?.tableId) {
      await releaseTableReservation(active.tableId)
    }
  }

  const rawTableId = localStorage.getItem(STORAGE_KEY_TABLE_ID)
  if (rawTableId) {
    await releaseTableReservation(Number(rawTableId))
  }

  localStorage.removeItem(STORAGE_KEY_PREORDER_SESSION_ID)
  localStorage.removeItem(STORAGE_KEY_CUSTOMER_NAME)
  localStorage.removeItem(STORAGE_KEY_CART)
  localStorage.removeItem(STORAGE_KEY_DINING_TYPE)
  localStorage.removeItem(STORAGE_KEY_TABLE_ID)
  localStorage.removeItem(STORAGE_KEY_TABLE_NUM)
  localStorage.removeItem(STORAGE_KEY_ACTIVE_TOKEN)
  localStorage.removeItem(STORAGE_KEY_DB_FALLBACK)
}

// ─── Local Storage Fallback Cache ─────────────────────────────────────────────

function getFallbackOrders(): AdvanceOrder[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DB_FALLBACK)
    return raw ? (JSON.parse(raw) as AdvanceOrder[]) : []
  } catch {
    return []
  }
}

function saveFallbackOrder(order: AdvanceOrder) {
  try {
    const orders = getFallbackOrders()
    const index = orders.findIndex((o) => o.sessionToken === order.sessionToken)
    if (index >= 0) {
      orders[index] = order
    } else {
      orders.unshift(order)
    }
    localStorage.setItem(STORAGE_KEY_DB_FALLBACK, JSON.stringify(orders.slice(0, 50)))
  } catch {
    // Ignore storage quota errors
  }
}

// ─── Order Creation & Submission ──────────────────────────────────────────────

export async function createAdvanceOrder(
  payload: CreateAdvanceOrderPayload,
): Promise<AdvanceOrder> {
  const cleanName = payload.customerName.trim().slice(0, 50)
  if (!cleanName) {
    throw new Error('Customer name is required before placing an advance order.')
  }

  if (!payload.cartItems || payload.cartItems.length === 0) {
    throw new Error('Your cart is empty. Please add items before placing an order.')
  }

  // Calculate totals
  const subtotal = payload.cartItems.reduce(
    (sum, c) => sum + (c.item.price || 0) * c.quantity,
    0,
  )
  const totalAmount = subtotal // Adjust if additional taxes or service charges apply

  const orderNumber = generateOrderNumber()
  const sessionToken = generateSessionToken()
  const createdAt = new Date().toISOString()
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()

  // Format notes to include table number & guest count if dining in
  let formattedNotes = payload.notes?.trim() || ''
  if (payload.diningType === 'dine-in' && payload.tableNum) {
    const paxStr = payload.guestCount ? ` (${payload.guestCount} guests)` : ''
    const tablePrefix = `[Table #${payload.tableNum}${paxStr}]`
    formattedNotes = formattedNotes ? `${tablePrefix} ${formattedNotes}` : tablePrefix
  }

  if (payload.diningType === 'dine-in' && payload.tableId) {
    await markTableAsReserved(
      payload.tableId,
      cleanName,
      'Advance Order Confirmed',
      payload.guestCount,
    )
  }

  let createdOrder: AdvanceOrder | null = null

  // 1. Attempt database insert into Supabase
  try {
    const { data: orderRow, error: orderErr } = await supabase
      .from('Advance_Orders')
      .insert({
        ORDER_NUMBER: orderNumber,
        SESSION_TOKEN: sessionToken,
        CUSTOMER_NAME: cleanName,
        DINING_TYPE: payload.diningType,
        STATUS: 'PENDING',
        SUBTOTAL: subtotal,
        TOTAL_AMOUNT: totalAmount,
        NOTES: formattedNotes || null,
        CREATED_AT: createdAt,
        EXPIRES_AT: expiresAt,
      })
      .select()
      .single()

    if (!orderErr && orderRow) {
      const orderId = orderRow.ADVANCE_ORDER_ID

      // Insert associated Advance_Order_Items
      const itemsPayload = payload.cartItems.map((c) => ({
        ADVANCE_ORDER_ID: orderId,
        ITEM_ID: Number(c.item.id),
        ITEM_NAME: c.item.name,
        QUANTITY: c.quantity,
        UNIT_PRICE: c.item.price,
        TOTAL_PRICE: c.item.price * c.quantity,
        NOTES: c.notes || null,
        CREATED_AT: createdAt,
      }))

      const { data: itemsRows, error: itemsErr } = await supabase
        .from('Advance_Order_Items')
        .insert(itemsPayload)
        .select()

      if (!itemsErr && itemsRows) {
        createdOrder = {
          advanceOrderId: orderId,
          orderNumber: orderRow.ORDER_NUMBER,
          sessionToken: orderRow.SESSION_TOKEN,
          customerName: orderRow.CUSTOMER_NAME,
          diningType: (orderRow.DINING_TYPE as DiningType) || 'dine-in',
          tableId: payload.tableId ?? null,
          tableNum: payload.tableNum ?? null,
          guestCount: payload.guestCount,
          status: (orderRow.STATUS as AdvanceOrderStatus) || 'PENDING',
          subtotal: Number(orderRow.SUBTOTAL) || subtotal,
          totalAmount: Number(orderRow.TOTAL_AMOUNT) || totalAmount,
          notes: orderRow.NOTES || undefined,
          createdAt: orderRow.CREATED_AT,
          expiresAt: orderRow.EXPIRES_AT,
          items: itemsRows.map((r) => ({
            advanceItemId: r.ADVANCE_ITEM_ID,
            advanceOrderId: r.ADVANCE_ORDER_ID,
            itemId: Number(r.ITEM_ID || r.MENU_ID),
            menuId: Number(r.ITEM_ID || r.MENU_ID),
            itemName: r.ITEM_NAME,
            quantity: r.QUANTITY,
            unitPrice: Number(r.UNIT_PRICE),
            totalPrice: Number(r.TOTAL_PRICE),
            notes: r.NOTES || undefined,
            createdAt: r.CREATED_AT,
          })),
        }
      }
    }
  } catch (dbErr) {
    console.warn(
      '[advanceOrderService] Supabase insert failed, using transparent localStorage fallback:',
      dbErr,
    )
  }

  // 2. Fallback if Supabase table is not yet migrated
  if (!createdOrder) {
    const fallbackId = Date.now()
    createdOrder = {
      advanceOrderId: fallbackId,
      orderNumber,
      sessionToken,
      customerName: cleanName,
      diningType: payload.diningType,
      tableId: payload.tableId ?? null,
      tableNum: payload.tableNum ?? null,
      guestCount: payload.guestCount,
      status: 'PENDING',
      subtotal,
      totalAmount,
      notes: formattedNotes || undefined,
      createdAt,
      expiresAt,
      items: payload.cartItems.map((c, idx) => ({
        advanceItemId: fallbackId + idx + 1,
        advanceOrderId: fallbackId,
        itemId: Number(c.item.id),
        menuId: Number(c.item.id),
        itemName: c.item.name,
        quantity: c.quantity,
        unitPrice: c.item.price,
        totalPrice: c.item.price * c.quantity,
        notes: c.notes,
        imageUrl: c.item.imageUrl,
        createdAt,
      })),
    }
  }

  // Save to local storage cache and register active session token
  saveFallbackOrder(createdOrder)
  setActiveSessionToken(sessionToken)
  clearPreOrderCart()

  // Ensure chosen table is marked as RESERVED in Restaurant_Tables
  if (payload.diningType === 'dine-in' && payload.tableId) {
    await markTableAsReserved(
      payload.tableId,
      cleanName,
      `Advance Order: ${orderNumber}`,
      payload.guestCount,
    )

    // Synchronize order with Customer Interface via Restaurant_Orders
    try {
      await createOrder(
        payload.tableId,
        payload.cartItems,
        payload.diningType,
        totalAmount,
        'Customer',
        `[Advance Order: ${orderNumber}] ${formattedNotes}`.trim(),
        payload.guestCount,
        undefined,
        { preserveTableStatus: true },
      )
    } catch (syncErr) {
      console.warn('[advanceOrderService] Failed to sync advance order into Restaurant_Orders:', syncErr)
    }
  }

  return createdOrder
}

// ─── Fetch Active Order ───────────────────────────────────────────────────────

export async function getActiveAdvanceOrder(
  token?: string,
): Promise<AdvanceOrder | null> {
  const sessionToken = token || getActiveSessionToken()
  if (!sessionToken) return null

  // 1. Try Supabase
  try {
    const { data: orderRow, error } = await supabase
      .from('Advance_Orders')
      .select('*, Advance_Order_Items(*)')
      .eq('SESSION_TOKEN', sessionToken)
      .maybeSingle()

    if (!error && orderRow) {
      const items = (orderRow.Advance_Order_Items || []).map((r: Record<string, unknown>) => ({
        advanceItemId: Number(r.ADVANCE_ITEM_ID),
        advanceOrderId: Number(r.ADVANCE_ORDER_ID),
        itemId: Number(r.ITEM_ID || r.MENU_ID),
        menuId: Number(r.ITEM_ID || r.MENU_ID),
        itemName: String(r.ITEM_NAME || ''),
        quantity: Number(r.QUANTITY || 1),
        unitPrice: Number(r.UNIT_PRICE || 0),
        totalPrice: Number(r.TOTAL_PRICE || 0),
        notes: r.NOTES ? String(r.NOTES) : undefined,
        createdAt: String(r.CREATED_AT || ''),
      }))

      // Parse table number from NOTES or column if available
      let parsedTableNum: number | null = null
      if (orderRow.TABLE_NUM != null) {
        parsedTableNum = Number(orderRow.TABLE_NUM)
      } else if (orderRow.NOTES) {
        const match = String(orderRow.NOTES).match(/\[Table #(\d+)\]/)
        if (match) {
          parsedTableNum = Number(match[1])
        }
      }

      const parsedTableId: number | null =
        orderRow.TABLE_ID != null ? Number(orderRow.TABLE_ID) : parsedTableNum

      const parsed: AdvanceOrder = {
        advanceOrderId: Number(orderRow.ADVANCE_ORDER_ID),
        orderNumber: String(orderRow.ORDER_NUMBER),
        sessionToken: String(orderRow.SESSION_TOKEN),
        customerName: String(orderRow.CUSTOMER_NAME),
        diningType: (orderRow.DINING_TYPE as DiningType) || 'dine-in',
        tableId: parsedTableId,
        tableNum: parsedTableNum,
        status: (orderRow.STATUS as AdvanceOrderStatus) || 'PENDING',
        subtotal: Number(orderRow.SUBTOTAL) || 0,
        totalAmount: Number(orderRow.TOTAL_AMOUNT) || 0,
        notes: orderRow.NOTES ? String(orderRow.NOTES) : undefined,
        createdAt: String(orderRow.CREATED_AT),
        expiresAt: String(orderRow.EXPIRES_AT),
        confirmedAt: orderRow.CONFIRMED_AT ? String(orderRow.CONFIRMED_AT) : null,
        completedAt: orderRow.COMPLETED_AT ? String(orderRow.COMPLETED_AT) : null,
        cancelledAt: orderRow.CANCELLED_AT ? String(orderRow.CANCELLED_AT) : null,
        items,
      }

      // Update local cache
      saveFallbackOrder(parsed)
      return parsed
    }
  } catch (err) {
    console.warn('[advanceOrderService] Supabase fetch failed, falling back to local storage:', err)
  }

  // 2. Check local storage fallback
  const fallbacks = getFallbackOrders()
  const match = fallbacks.find((o) => o.sessionToken === sessionToken)
  return match || null
}

// ─── Cancel Advance Order ─────────────────────────────────────────────────────

async function cancelAssociatedRestaurantOrder(
  orderNumber: string,
  tableId?: number | null,
  reason?: string,
): Promise<void> {
  try {
    let query = supabase
      .from('Restaurant_Orders')
      .select('ORDER_ID, SERVER_NOTE')
      .in('ORDER_STATUS', ['REQUESTED', 'VERIFIED'])

    if (tableId) {
      query = query.eq('TABLE_ID', tableId)
    }

    const { data: matched } = await query
    if (matched && matched.length > 0) {
      for (const ord of matched) {
        if (ord.SERVER_NOTE && ord.SERVER_NOTE.includes(orderNumber)) {
          await cancelOrder(ord.ORDER_ID, reason || 'Advance order cancelled')
        }
      }
    }
  } catch (err) {
    console.warn('[advanceOrderService] Could not cancel associated Restaurant_Orders:', err)
  }
}

export async function cancelAdvanceOrder(
  sessionToken: string,
  reason?: string,
): Promise<AdvanceOrder | null> {
  const now = new Date().toISOString()

  // 1. Try Supabase update
  try {
    const { data: existing } = await supabase
      .from('Advance_Orders')
      .select('ORDER_NUMBER, TABLE_ID, NOTES')
      .eq('SESSION_TOKEN', sessionToken)
      .maybeSingle()

    let updatedNotes = existing?.NOTES || ''
    if (reason?.trim()) {
      const cancelTag = `[Cancelled: ${reason.trim()}]`
      updatedNotes = updatedNotes ? `${updatedNotes} ${cancelTag}` : cancelTag
    }

    const { error } = await supabase
      .from('Advance_Orders')
      .update({
        STATUS: 'CANCELLED',
        CANCELLED_AT: now,
        NOTES: updatedNotes || null,
      })
      .eq('SESSION_TOKEN', sessionToken)

    if (!error) {
      const active = await getActiveAdvanceOrder(sessionToken)
      if (active) {
        active.status = 'CANCELLED'
        active.cancelledAt = now
        if (updatedNotes) active.notes = updatedNotes
        saveFallbackOrder(active)

        // Cancel associated Restaurant_Orders
        await cancelAssociatedRestaurantOrder(active.orderNumber, active.tableId, reason)

        // Release reserved table
        if (active.tableId) {
          await releaseTableReservation(active.tableId)
        }

        return active
      }
    }
  } catch (err) {
    console.warn('[advanceOrderService] Supabase cancel failed, updating local storage:', err)
  }

  // 2. Fallback update local storage
  const fallbacks = getFallbackOrders()
  const order = fallbacks.find((o) => o.sessionToken === sessionToken)
  if (order) {
    order.status = 'CANCELLED'
    order.cancelledAt = now
    if (reason?.trim()) {
      const cancelTag = `[Cancelled: ${reason.trim()}]`
      order.notes = order.notes ? `${order.notes} ${cancelTag}` : cancelTag
    }
    saveFallbackOrder(order)

    // Cancel associated Restaurant_Orders
    await cancelAssociatedRestaurantOrder(order.orderNumber, order.tableId, reason)

    // Release reserved table
    if (order.tableId) {
      await releaseTableReservation(order.tableId)
    }

    return order
  }

  return null
}

/**
 * Confirms an advance order and converts it into a permanent regular order.
 * Called when the receptionist seats the guests and changes the table status to OCCUPIED.
 * Disarms the 30-minute expiration countdown and ensures the order is never auto-cleared.
 */
export async function confirmAdvanceOrderToRegular(
  tableId: number,
  orderNumber?: string,
): Promise<void> {
  const now = new Date().toISOString()

  // 1. Update Advance_Orders to CONFIRMED
  try {
    let query = supabase
      .from('Advance_Orders')
      .update({
        STATUS: 'CONFIRMED',
        CONFIRMED_AT: now,
      })
      .eq('STATUS', 'PENDING')

    if (orderNumber) {
      query = query.eq('ORDER_NUMBER', orderNumber)
    }

    const { error } = await query
    if (error) {
      console.warn('[advanceOrderService] Could not update Advance_Orders to CONFIRMED:', error)
    }
  } catch (err) {
    console.warn('[advanceOrderService] Exception confirming Advance_Orders:', err)
  }

  // 2. In Restaurant_Orders, update SERVER_NOTE to mark as confirmed regular order
  try {
    const { data: orders } = await supabase
      .from('Restaurant_Orders')
      .select('ORDER_ID, SERVER_NOTE')
      .eq('TABLE_ID', tableId)
      .in('ORDER_STATUS', ['REQUESTED', 'VERIFIED', 'PREPARING'])

    if (orders && orders.length > 0) {
      for (const ord of orders) {
        if (
          ord.SERVER_NOTE &&
          (ord.SERVER_NOTE.includes('[Advance Order') ||
            (orderNumber && ord.SERVER_NOTE.includes(orderNumber)))
        ) {
          const updatedNote = ord.SERVER_NOTE.replace(
            /\[Advance Order:[^\]]+\]/g,
            `[Regular Order: ${orderNumber || 'Seated'}] (Confirmed by Reception)`,
          )
          await supabase
            .from('Restaurant_Orders')
            .update({ SERVER_NOTE: updatedNote })
            .eq('ORDER_ID', ord.ORDER_ID)
        }
      }
    }
  } catch (err) {
    console.warn('[advanceOrderService] Exception updating Restaurant_Orders server note:', err)
  }

  // 3. Update local storage fallback orders
  try {
    const fallbacks = getFallbackOrders()
    let changed = false
    fallbacks.forEach((o) => {
      if (
        (o.tableId === tableId || (orderNumber && o.orderNumber === orderNumber)) &&
        o.status === 'PENDING'
      ) {
        o.status = 'CONFIRMED'
        o.confirmedAt = now
        changed = true
      }
    })
    if (changed) {
      localStorage.setItem(STORAGE_KEY_DB_FALLBACK, JSON.stringify(fallbacks))
    }
  } catch {
    // Ignore storage quota
  }
}

/**
 * Fetches the active advance order (PENDING or CONFIRMED) associated with a table.
 * Used by the receptionist interface to inspect advance orders for reserved tables.
 */
export async function getActiveAdvanceOrderByTable(
  tableId: number,
  tableNum?: number,
): Promise<AdvanceOrder | null> {
  const effectiveNum = tableNum ?? tableId

  // 1. Try querying Supabase
  try {
    const { data, error } = await supabase
      .from('Advance_Orders')
      .select('*, Advance_Order_Items(*)')
      .in('STATUS', ['PENDING', 'CONFIRMED'])
      .order('ADVANCE_ORDER_ID', { ascending: false })

    if (!error && data && data.length > 0) {
      for (const row of data) {
        let rowTableNum: number | null = null
        if (row.TABLE_NUM != null) {
          rowTableNum = Number(row.TABLE_NUM)
        } else if (row.NOTES) {
          const match = String(row.NOTES).match(/\[Table #(\d+)\]/)
          if (match) rowTableNum = Number(match[1])
        }

        const rowTableId: number | null =
          row.TABLE_ID != null ? Number(row.TABLE_ID) : rowTableNum

        if (
          rowTableId === tableId ||
          rowTableNum === effectiveNum ||
          (row.NOTES && row.NOTES.includes(`Table #${effectiveNum}`))
        ) {
          const items = (row.Advance_Order_Items || []).map((r: Record<string, unknown>) => ({
            advanceItemId: Number(r.ADVANCE_ITEM_ID),
            advanceOrderId: Number(r.ADVANCE_ORDER_ID),
            itemId: Number(r.ITEM_ID || r.MENU_ID),
            menuId: Number(r.ITEM_ID || r.MENU_ID),
            itemName: String(r.ITEM_NAME || ''),
            quantity: Number(r.QUANTITY || 1),
            unitPrice: Number(r.UNIT_PRICE || 0),
            totalPrice: Number(r.TOTAL_PRICE || 0),
            notes: r.NOTES ? String(r.NOTES) : undefined,
            createdAt: String(r.CREATED_AT || ''),
          }))

          return {
            advanceOrderId: Number(row.ADVANCE_ORDER_ID),
            orderNumber: String(row.ORDER_NUMBER),
            sessionToken: String(row.SESSION_TOKEN),
            customerName: String(row.CUSTOMER_NAME),
            diningType: (row.DINING_TYPE as DiningType) || 'dine-in',
            tableId: rowTableId,
            tableNum: rowTableNum,
            status: (row.STATUS as AdvanceOrderStatus) || 'PENDING',
            subtotal: Number(row.SUBTOTAL) || 0,
            totalAmount: Number(row.TOTAL_AMOUNT) || 0,
            notes: row.NOTES ? String(row.NOTES) : undefined,
            createdAt: String(row.CREATED_AT),
            expiresAt: String(row.EXPIRES_AT),
            confirmedAt: row.CONFIRMED_AT ? String(row.CONFIRMED_AT) : null,
            completedAt: row.COMPLETED_AT ? String(row.COMPLETED_AT) : null,
            cancelledAt: row.CANCELLED_AT ? String(row.CANCELLED_AT) : null,
            items,
          }
        }
      }
    }
  } catch (err) {
    console.warn('[advanceOrderService] Error fetching table advance order from Supabase:', err)
  }

  // 2. Check local fallback
  const fallbacks = getFallbackOrders()
  const found = fallbacks.find(
    (o) =>
      (o.tableId === tableId || o.tableNum === effectiveNum) &&
      (o.status === 'PENDING' || o.status === 'CONFIRMED'),
  )
  return found || null
}

/**
 * Discards/cancels an advance order for a table if the receptionist decides not to keep it.
 */
export async function discardAdvanceOrderForTable(
  tableId: number,
  reason: string = 'Discarded by receptionist',
): Promise<void> {
  const active = await getActiveAdvanceOrderByTable(tableId)
  if (active) {
    await cancelAdvanceOrder(active.sessionToken, reason)
  }
}

/**
 * Fetches all tables that are strictly eligible for advance order placement.
 * Disqualifies:
 * 1. Merged tables (IS_MERGE_MEMBER, IS_MERGE_CAPTAIN, or MERGE_GROUP_ID != null)
 * 2. Occupied tables (STATUS === 'OCCUPIED' or any non-AVAILABLE status unless held by current session)
 * 3. Tables with active orders in Restaurant_Orders (activeOrderCount > 0)
 * 4. Tables with an active pending Advance_Order (unless matching the current session's tableId)
 */
export async function fetchEligibleAdvanceOrderTables(
  currentTableId?: number | null,
): Promise<TableData[]> {
  const [allTables, activeAdvanceOrders] = await Promise.all([
    fetchAllTables(),
    (async () => {
      try {
        const { data } = await supabase
          .from('Advance_Orders')
          .select('TABLE_ID, TABLE_NUM, STATUS, NOTES')
          .eq('STATUS', 'PENDING')
        return data || []
      } catch {
        return []
      }
    })(),
  ])

  if (!allTables || allTables.length === 0) return []

  const tableIds = allTables.map((t) => t.TABLE_ID)
  const orderSummaries = await fetchOrderSummariesForIds(tableIds)

  // Set of table IDs that have pending advance orders from other sessions
  const tablesWithPendingAdvance = new Set<number>()
  for (const ao of activeAdvanceOrders) {
    let tId = ao.TABLE_ID ? Number(ao.TABLE_ID) : null
    if (!tId && ao.NOTES) {
      const match = String(ao.NOTES).match(/\[Table #(\d+)\]/)
      if (match) tId = Number(match[1])
    }
    if (tId && tId !== currentTableId) {
      tablesWithPendingAdvance.add(tId)
    }
  }

  // Also check local storage fallbacks for pending advance orders
  const fallbacks = getFallbackOrders()
  for (const fb of fallbacks) {
    if (fb.status === 'PENDING' && fb.tableId && fb.tableId !== currentTableId) {
      tablesWithPendingAdvance.add(fb.tableId)
    }
  }

  return allTables.filter((t) => {
    // 1. Exclude merged tables (cannot be merge captain, merge member, or have MERGE_GROUP_ID)
    const isMerged =
      t.MERGE_GROUP_ID != null ||
      Boolean(t.IS_MERGE_MEMBER) ||
      Boolean(t.IS_MERGE_CAPTAIN)
    if (isMerged) return false

    // 2. Exclude occupied or non-available tables (unless held by current session)
    const isCurrentlyHeld = currentTableId != null && t.TABLE_ID === currentTableId
    const isAvailableStatus = t.STATUS === 'AVAILABLE' || isCurrentlyHeld
    if (!isAvailableStatus) return false

    // 3. Exclude tables that have active orders in Restaurant_Orders
    const summary = orderSummaries.get(t.TABLE_ID)
    if (summary && summary.activeOrderCount > 0) return false

    // 4. Exclude tables with active advance orders held by someone else
    if (tablesWithPendingAdvance.has(t.TABLE_ID)) return false

    return true
  })
}

// ─── Countdown & Time Utilities ───────────────────────────────────────────────

/** Returns remaining seconds until expiration, strictly bounded to >= 0. */
export function getRemainingSeconds(expiresAt: string): number {
  const expiry = new Date(expiresAt).getTime()
  const now = Date.now()
  return Math.max(0, Math.floor((expiry - now) / 1000))
}

/** Formats remaining seconds as "MM:SS" (e.g. 29:45 or 00:32). */
export function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
