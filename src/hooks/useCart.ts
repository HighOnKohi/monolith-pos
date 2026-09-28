import { useState, useCallback, useMemo } from 'react'
import type { MenuItem } from '@/types/menu'
import type { CartItem, DiningType } from '@/types/cart'

const TAX_RATE = 0.05

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([])
  const [diningType, setDiningType] = useState<DiningType>('dine-in')

  // ─── Mutations ────────────────────────────────────────────────────────────────

  const addItem = useCallback((item: MenuItem, notes?: string, quantity = 1) => {
    setItems((prev) => {
      const hasLimit = typeof item.orderLimit === 'number' && item.orderLimit > 0
      const limit = hasLimit ? item.orderLimit! : Infinity
      const existing = prev.find((ci) => ci.item.id === item.id)
      const currentQty = existing?.quantity ?? 0

      if (currentQty >= limit) {
        return prev
      }

      const addAmount = Math.min(quantity, limit - currentQty)
      if (addAmount <= 0) return prev

      if (existing) {
        return prev.map((ci) =>
          ci.item.id === item.id ? { ...ci, quantity: ci.quantity + addAmount } : ci,
        )
      }
      return [...prev, { item, quantity: addAmount, notes }]
    })
  }, [])

  const removeItem = useCallback((itemId: string) => {
    setItems((prev) => prev.filter((ci) => ci.item.id !== itemId))
  }, [])

  const increaseQty = useCallback((itemId: string) => {
    setItems((prev) => {
      const existing = prev.find((ci) => ci.item.id === itemId)
      if (!existing) return prev

      const hasLimit = typeof existing.item.orderLimit === 'number' && existing.item.orderLimit > 0
      const limit = hasLimit ? existing.item.orderLimit! : Infinity
      if (existing.quantity >= limit) {
        return prev
      }

      return prev.map((ci) =>
        ci.item.id === itemId ? { ...ci, quantity: ci.quantity + 1 } : ci,
      )
    })
  }, [])

  const decreaseQty = useCallback((itemId: string) => {
    setItems((prev) =>
      prev
        .map((ci) =>
          ci.item.id === itemId ? { ...ci, quantity: ci.quantity - 1 } : ci,
        )
        .filter((ci) => ci.quantity > 0),
    )
  }, [])

  const updateNotes = useCallback((itemId: string, notes: string) => {
    setItems((prev) =>
      prev.map((ci) => (ci.item.id === itemId ? { ...ci, notes } : ci)),
    )
  }, [])

  const clearCart = useCallback(() => setItems([]), [])

  // ─── Derived state ────────────────────────────────────────────────────────────

  const total = useMemo(
    () => items.reduce((sum, ci) => sum + ci.item.price * ci.quantity, 0),
    [items],
  )
  const subtotal = useMemo(() => total / (1 + TAX_RATE), [total])
  const tax = useMemo(() => total - subtotal, [total, subtotal])
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
  }
}
