// ─── Realtime Shared Cart ──────────────────────────────────────────────────────
//
// Replaces local-only cart with a cart shared in realtime across ALL devices
// at the same table/group via Supabase Broadcast channels.
//
// Architecture:
//   - Each merged group/table shares a broadcast channel: `shared-cart-group-{tableId}`
//   - When a new device joins, it emits `request_cart_sync` and any active peer responds
//   - LocalStorage caches the current session so single-device reloads preserve cart items
//   - Every cart mutation broadcasts the full cart state to all subscribers
//   - Lock mechanism prevents two devices from double-submitting simultaneously

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { MenuItem } from '@/types/menu'
import type { CartItem, DiningType } from '@/types/cart'

const TAX_RATE = 0.05

/** Generates a stable session identifier for this browser tab. */
function getSessionId(): string {
  let id = sessionStorage.getItem('monolith_session_id')
  if (!id) {
    id = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    sessionStorage.setItem('monolith_session_id', id)
  }
  return id
}

interface SharedCartState {
  items: CartItem[]
  lockedBy: string | null  // session ID of the device currently placing an order
  lockedAt: number | null  // timestamp of lock (ms) for stale-lock detection
}

const EMPTY_CART: SharedCartState = { items: [], lockedBy: null, lockedAt: null }
const LOCK_TIMEOUT_MS = 15_000 // 15 seconds — auto-clears stale lock

function getStoredCart(tableId: number | null): SharedCartState {
  if (!tableId) return EMPTY_CART
  try {
    const raw = localStorage.getItem(`monolith_shared_cart_table_${tableId}`)
    if (raw) {
      const parsed = JSON.parse(raw) as SharedCartState
      return { items: parsed.items || [], lockedBy: null, lockedAt: null }
    }
  } catch {
    // Ignore storage errors
  }
  return EMPTY_CART
}

function persistStoredCart(tableId: number | null, state: SharedCartState) {
  if (!tableId) return
  try {
    if (state.items.length === 0) {
      localStorage.removeItem(`monolith_shared_cart_table_${tableId}`)
    } else {
      localStorage.setItem(`monolith_shared_cart_table_${tableId}`, JSON.stringify(state))
    }
  } catch {
    // Ignore storage errors
  }
}

export interface UseSharedCartReturn {
  items: CartItem[]
  diningType: DiningType
  setDiningType: (t: DiningType) => void
  addItem: (item: MenuItem, notes?: string) => void
  removeItem: (itemId: string) => void
  increaseQty: (itemId: string) => void
  decreaseQty: (itemId: string) => void
  updateNotes: (itemId: string, notes: string) => void
  clearCart: () => void
  subtotal: number
  tax: number
  total: number
  itemCount: number
  getQuantity: (itemId: string) => number
  isInCart: (itemId: string) => boolean
  /** True while this session is placing an order (locks other sessions) */
  isLocking: boolean
  /** True if ANOTHER device is currently placing this table's order */
  isLockedByOther: boolean
  /** Acquire the order lock. Returns true if we got it, false if someone else has it. */
  acquireLock: () => boolean
  /** Release the order lock (call after success or failure). */
  releaseLock: () => void
}

export function useSharedCart(tableId: number | null): UseSharedCartReturn {
  const sessionId = useRef(getSessionId())
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const [cartState, setCartState] = useState<SharedCartState>(() => getStoredCart(tableId))
  const [diningType, setDiningType] = useState<DiningType>('dine-in')

  // Keep a ref to the latest cartState for peer responses
  const cartStateRef = useRef<SharedCartState>(cartState)
  useEffect(() => {
    cartStateRef.current = cartState
  }, [cartState])

  // Sync state if tableId changes
  useEffect(() => {
    setCartState(getStoredCart(tableId))
  }, [tableId])

  // ── Helpers ──────────────────────────────────────────────────────────────────

  /** Broadcast new state to all subscribers on this group channel, then apply locally. */
  const broadcast = useCallback(
    (newState: SharedCartState) => {
      setCartState(newState)
      persistStoredCart(tableId, newState)
      channelRef.current?.send({
        type: 'broadcast',
        event: 'cart_update',
        payload: newState,
      })
    },
    [tableId],
  )

  // ── Realtime channel subscription ─────────────────────────────────────────────

  useEffect(() => {
    if (!tableId) return

    const channelName = `shared-cart-group-${tableId}`

    const channel = supabase
      .channel(channelName, {
        config: {
          broadcast: { self: false }, // don't receive our own broadcasts
        },
      })
      .on('broadcast', { event: 'cart_update' }, (payload) => {
        const incoming = payload.payload as SharedCartState

        // Auto-clear stale lock from a crashed session
        if (
          incoming.lockedBy &&
          incoming.lockedAt &&
          Date.now() - incoming.lockedAt > LOCK_TIMEOUT_MS
        ) {
          const cleared = { ...incoming, lockedBy: null, lockedAt: null }
          setCartState(cleared)
          persistStoredCart(tableId, cleared)
          return
        }

        setCartState(incoming)
        persistStoredCart(tableId, incoming)
      })
      .on('broadcast', { event: 'request_cart_sync' }, () => {
        // A newly joined peer is asking for the current cart state
        if (cartStateRef.current.items.length > 0) {
          channel.send({
            type: 'broadcast',
            event: 'cart_update',
            payload: cartStateRef.current,
          })
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // Announce presence and request latest state from existing peers
          channel.send({
            type: 'broadcast',
            event: 'request_cart_sync',
            payload: { requestedAt: Date.now() },
          })
        }
      })

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [tableId])

  // ── Mutations ─────────────────────────────────────────────────────────────────

  const addItem = useCallback(
    (item: MenuItem, notes?: string) => {
      setCartState((prev) => {
        const existing = prev.items.find((ci) => ci.item.id === item.id)
        const newItems = existing
          ? prev.items.map((ci) =>
              ci.item.id === item.id ? { ...ci, quantity: ci.quantity + 1 } : ci,
            )
          : [...prev.items, { item, quantity: 1, notes }]
        const next = { ...prev, items: newItems }
        persistStoredCart(tableId, next)
        channelRef.current?.send({
          type: 'broadcast',
          event: 'cart_update',
          payload: next,
        })
        return next
      })
    },
    [tableId],
  )

  const removeItem = useCallback((itemId: string) => {
    setCartState((prev) => {
      const next = { ...prev, items: prev.items.filter((ci) => ci.item.id !== itemId) }
      persistStoredCart(tableId, next)
      channelRef.current?.send({ type: 'broadcast', event: 'cart_update', payload: next })
      return next
    })
  }, [tableId])

  const increaseQty = useCallback((itemId: string) => {
    setCartState((prev) => {
      const next = {
        ...prev,
        items: prev.items.map((ci) =>
          ci.item.id === itemId ? { ...ci, quantity: ci.quantity + 1 } : ci,
        ),
      }
      persistStoredCart(tableId, next)
      channelRef.current?.send({ type: 'broadcast', event: 'cart_update', payload: next })
      return next
    })
  }, [tableId])

  const decreaseQty = useCallback((itemId: string) => {
    setCartState((prev) => {
      const next = {
        ...prev,
        items: prev.items
          .map((ci) =>
            ci.item.id === itemId ? { ...ci, quantity: ci.quantity - 1 } : ci,
          )
          .filter((ci) => ci.quantity > 0),
      }
      persistStoredCart(tableId, next)
      channelRef.current?.send({ type: 'broadcast', event: 'cart_update', payload: next })
      return next
    })
  }, [tableId])

  const updateNotes = useCallback((itemId: string, notes: string) => {
    setCartState((prev) => {
      const next = {
        ...prev,
        items: prev.items.map((ci) => (ci.item.id === itemId ? { ...ci, notes } : ci)),
      }
      persistStoredCart(tableId, next)
      channelRef.current?.send({ type: 'broadcast', event: 'cart_update', payload: next })
      return next
    })
  }, [tableId])

  const clearCart = useCallback(() => {
    broadcast(EMPTY_CART)
  }, [broadcast])

  // ── Duplication lock ──────────────────────────────────────────────────────────

  /** Returns true if we successfully acquired the lock, false if another session holds it. */
  const acquireLock = useCallback((): boolean => {
    let acquired = false
    setCartState((prev) => {
      // Check stale lock first
      const isStale =
        prev.lockedBy &&
        prev.lockedAt &&
        Date.now() - prev.lockedAt > LOCK_TIMEOUT_MS

      if (prev.lockedBy && !isStale) {
        // Another active session holds the lock — reject
        acquired = false
        return prev
      }

      acquired = true
      const next: SharedCartState = {
        ...prev,
        lockedBy: sessionId.current,
        lockedAt: Date.now(),
      }
      persistStoredCart(tableId, next)
      channelRef.current?.send({ type: 'broadcast', event: 'cart_update', payload: next })
      return next
    })
    return acquired
  }, [tableId])

  const releaseLock = useCallback(() => {
    setCartState((prev) => {
      // Only release if WE hold it
      if (prev.lockedBy !== sessionId.current) return prev
      const next: SharedCartState = { ...prev, lockedBy: null, lockedAt: null }
      persistStoredCart(tableId, next)
      channelRef.current?.send({ type: 'broadcast', event: 'cart_update', payload: next })
      return next
    })
  }, [tableId])

  // ── Derived state ─────────────────────────────────────────────────────────────

  const { items } = cartState

  const subtotal = useMemo(
    () => items.reduce((sum, ci) => sum + ci.item.price * ci.quantity, 0),
    [items],
  )
  const tax = useMemo(() => subtotal * TAX_RATE, [subtotal])
  const total = useMemo(() => subtotal + tax, [subtotal, tax])
  const itemCount = useMemo(
    () => items.reduce((sum, ci) => sum + ci.quantity, 0),
    [items],
  )

  const getQuantity = useCallback(
    (itemId: string) => items.find((ci) => ci.item.id === itemId)?.quantity ?? 0,
    [items],
  )
  const isInCart = useCallback(
    (itemId: string) => items.some((ci) => ci.item.id === itemId),
    [items],
  )

  const isLocking = cartState.lockedBy === sessionId.current
  const isLockedByOther =
    Boolean(cartState.lockedBy) &&
    cartState.lockedBy !== sessionId.current &&
    Boolean(cartState.lockedAt) &&
    Date.now() - cartState.lockedAt! < LOCK_TIMEOUT_MS

  return {
    items,
    diningType,
    setDiningType,
    addItem,
    removeItem,
    increaseQty,
    decreaseQty,
    updateNotes,
    clearCart,
    subtotal,
    tax,
    total,
    itemCount,
    getQuantity,
    isInCart,
    isLocking,
    isLockedByOther,
    acquireLock,
    releaseLock,
  }
}
