import { useState, useCallback, useMemo } from 'react'
import type { MenuItem } from '@/types/menu'
import type { CartItem, DiningType } from '@/types/cart'

const TAX_RATE = 0.05

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([])
  const [diningType, setDiningType] = useState<DiningType>('dine-in')

  // ─── Mutations ────────────────────────────────────────────────────────────────

  const addItem = useCallback((item: MenuItem, notes?: string) => {
    setItems((prev) => {
      const existing = prev.find((ci) => ci.item.id === item.id)
      if (existing) {
        return prev.map((ci) =>
          ci.item.id === item.id ? { ...ci, quantity: ci.quantity + 1 } : ci,
        )
      }
      return [...prev, { item, quantity: 1, notes }]
    })
  }, [])

  const removeItem = useCallback((itemId: string) => {
    setItems((prev) => prev.filter((ci) => ci.item.id !== itemId))
  }, [])

  const increaseQty = useCallback((itemId: string) => {
    setItems((prev) =>
      prev.map((ci) =>
        ci.item.id === itemId ? { ...ci, quantity: ci.quantity + 1 } : ci,
      ),
    )
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
