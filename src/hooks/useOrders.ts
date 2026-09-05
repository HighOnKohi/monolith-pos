import { useState, useCallback, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { CartItem, DiningType } from '@/types/cart'
import type { Order, OrderStatus } from '@/types/order'
import { createOrder, fetchOrdersByTable } from '@/services/orderService'

interface UseOrdersResult {
  orders: Order[]
  isSubmitting: boolean
  submitError: string | null
  placeOrder: (items: CartItem[], diningType: DiningType, total: number) => Promise<boolean>
  clearError: () => void
}

export function useOrders(tableId: number | null): UseOrdersResult {
  const [orders, setOrders] = useState<Order[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Initial fetch of existing orders for this table
  useEffect(() => {
    if (!tableId) return
    fetchOrdersByTable(tableId)
      .then(setOrders)
      .catch((err) => console.error('[useOrders] fetch error', err))
  }, [tableId])

  // Realtime subscription to order status updates
  useEffect(() => {
    if (!tableId) return

    const channel = supabase
      .channel(`orders-table-${tableId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'Restaurant_Orders',
          filter: `TABLE_ID=eq.${tableId}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>
          const updatedId = Number(row['ORDER_ID'])
          const newStatus = row['ORDER_STATUS'] as OrderStatus

          setOrders((prev) =>
            prev.map((o) =>
              o.orderId === updatedId ? { ...o, orderStatus: newStatus } : o,
            ),
          )
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [tableId])

  const placeOrder = useCallback(
    async (items: CartItem[], diningType: DiningType, total: number): Promise<boolean> => {
      if (!tableId || items.length === 0) return false
      setIsSubmitting(true)
      setSubmitError(null)
      try {
        const newOrder = await createOrder(tableId, items, diningType, total)
        setOrders((prev) => [newOrder, ...prev])
        return true
      } catch (err) {
        console.error('[useOrders] placeOrder error', err)
        setSubmitError('Failed to place your order. Please try again.')
        return false
      } finally {
        setIsSubmitting(false)
      }
    },
    [tableId],
  )

  return {
    orders,
    isSubmitting,
    submitError,
    placeOrder,
    clearError: () => setSubmitError(null),
  }
}
