import { supabase } from '@/lib/supabase'
import type {
  AdvanceOrder,
  AdvanceOrderItem,
  CreateAdvanceOrderPayload,
  PreOrderSession,
  AdvanceOrderStatus,
} from '@/types/advanceOrder'
import type { CartItem, DiningType } from '@/types/cart'

// ─── LocalStorage Keys ────────────────────────────────────────────────────────
const STORAGE_KEY_PREORDER_SESSION_ID = 'monolith_advance_order_session_id'
const STORAGE_KEY_CUSTOMER_NAME = 'monolith_advance_order_customer_name'
const STORAGE_KEY_CART = 'monolith_advance_order_cart'
const STORAGE_KEY_DINING_TYPE = 'monolith_advance_order_dining_type'
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
    cart,
  }
}

export function saveCustomerName(name: string): string {
  const trimmed = name.trim().slice(0, 50)
  localStorage.setItem(STORAGE_KEY_CUSTOMER_NAME, trimmed)
  return trimmed
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
        NOTES: payload.notes || null,
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
      status: 'PENDING',
      subtotal,
      totalAmount,
      notes: payload.notes,
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

      const parsed: AdvanceOrder = {
        advanceOrderId: Number(orderRow.ADVANCE_ORDER_ID),
        orderNumber: String(orderRow.ORDER_NUMBER),
        sessionToken: String(orderRow.SESSION_TOKEN),
        customerName: String(orderRow.CUSTOMER_NAME),
        diningType: (orderRow.DINING_TYPE as DiningType) || 'dine-in',
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
