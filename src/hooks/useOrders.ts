import { useState, useCallback, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { CartItem, DiningType } from '@/types/cart'
import type { Order, OrderStatus } from '@/types/order'
import { createOrder, fetchOrdersByTable } from '@/services/orderService'

export interface OrderStatusNotification {
  orderId: number
  tableId: number
  status: OrderStatus
  title: string
  message: string
  timestamp: string
}

const STATUS_MESSAGES: Record<OrderStatus, { title: string; message: string }> = {
  REQUESTED: {
    title: 'Order Placed',
    message: 'Your order was submitted and is queued for verification.',
  },
  VERIFIED: {
    title: 'Order Confirmed',
    message: 'The kitchen has accepted your order and will start prep shortly.',
  },
  PREPARING: {
    title: 'Cooking in Progress',
    message: 'The chefs are actively preparing your dishes in the kitchen.',
  },
  READY: {
    title: 'Order Ready to Serve',
    message: 'Your dishes are freshly cooked and being prepared for delivery.',
  },
  SERVED: {
    title: 'Food Has Been Served!',
    message: 'All items for this order have been delivered to your table. Enjoy!',
  },
}

interface UseOrdersResult {
  orders: Order[]
  isSubmitting: boolean
  submitError: string | null
  placeOrder: (items: CartItem[], diningType: DiningType, total: number) => Promise<boolean>
  clearError: () => void
  latestStatusUpdate: OrderStatusNotification | null
  hasUnreadStatusChange: boolean
  markStatusUpdateAsRead: () => void
  dismissLatestStatusUpdate: () => void
}

export function useOrders(tableId: number | null): UseOrdersResult {
  const [orders, setOrders] = useState<Order[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [latestStatusUpdate, setLatestStatusUpdate] = useState<OrderStatusNotification | null>(null)
  const [hasUnreadStatusChange, setHasUnreadStatusChange] = useState(false)

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
      .channel(`orders-table-realtime-${tableId}`)
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

          setOrders((prev) => {
            const existing = prev.find((o) => o.orderId === updatedId)
            // Trigger alert notification only if status has actually changed
            if (existing && existing.orderStatus !== newStatus) {
              const info = STATUS_MESSAGES[newStatus] || {
                title: 'Order Status Updated',
                message: `Order #${updatedId} is now ${newStatus}.`,
              }

              setLatestStatusUpdate({
                orderId: updatedId,
                tableId,
                status: newStatus,
                title: info.title,
                message: info.message,
                timestamp: new Date().toISOString(),
              })
              setHasUnreadStatusChange(true)
            }

            return prev.map((o) =>
              o.orderId === updatedId ? { ...o, orderStatus: newStatus } : o,
            )
          })

          // Sync full order item details
          fetchOrdersByTable(tableId)
            .then(setOrders)
            .catch(console.error)
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'Order_Items',
        },
        () => {
          // Re-sync on line item status changes
          fetchOrdersByTable(tableId)
            .then(setOrders)
            .catch(console.error)
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

  const markStatusUpdateAsRead = useCallback(() => {
    setHasUnreadStatusChange(false)
  }, [])

  const dismissLatestStatusUpdate = useCallback(() => {
    setLatestStatusUpdate(null)
  }, [])

  return {
    orders,
    isSubmitting,
    submitError,
    placeOrder,
    clearError: () => setSubmitError(null),
    latestStatusUpdate,
    hasUnreadStatusChange,
    markStatusUpdateAsRead,
    dismissLatestStatusUpdate,
  }
}
