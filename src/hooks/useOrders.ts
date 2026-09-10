import { useState, useCallback, useEffect, useMemo } from 'react'
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
    title: 'Cooking Your Order',
    message: 'The chefs are actively preparing your dishes.',
  },
  READY: {
    title: 'Order Ready',
    message: 'Your dishes are ready and will be served shortly.',
  },
  SERVED: {
    title: 'Food Has Been Served!',
    message: 'All items for this order have been delivered to your table. Enjoy!',
  },
  CANCELLED: {
    title: 'Order Cancelled',
    message: 'The kitchen cancelled this order. Please contact the waiter or cashier.',
  },
  COMPLETED: {
    title: 'Order Completed',
    message: 'This order has been completed.',
  },
}

interface UseOrdersResult {
  orders: Order[]
  isSubmitting: boolean
  submitError: string | null
  placeOrder: (items: CartItem[], diningType: DiningType, total: number, serverNote?: string) => Promise<boolean>
  clearError: () => void
  latestStatusUpdate: OrderStatusNotification | null
  hasUnreadStatusChange: boolean
  markStatusUpdateAsRead: () => void
  dismissLatestStatusUpdate: () => void
}

export function useOrders(
  tableId: number | null,
  memberTableIds?: number[],
): UseOrdersResult {
  const [orders, setOrders] = useState<Order[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [latestStatusUpdate, setLatestStatusUpdate] = useState<OrderStatusNotification | null>(null)
  const [hasUnreadStatusChange, setHasUnreadStatusChange] = useState(false)

  const memberIdsKey = memberTableIds ? memberTableIds.join(',') : ''
  const targetTableIds = useMemo(() => {
    if (memberTableIds && memberTableIds.length > 0) return memberTableIds
    return tableId ? [tableId] : []
  }, [tableId, memberIdsKey])

  // Shared function to update orders and detect status changes
  const applyFetchedOrders = useCallback(
    (newOrders: Order[]) => {
      setOrders((prev) => {
        let hasChanges = prev.length !== newOrders.length
        if (!hasChanges) {
          for (let i = 0; i < prev.length; i++) {
            const p = prev[i]
            const n = newOrders[i]
            if (
              !n ||
              p.orderId !== n.orderId ||
              p.orderStatus !== n.orderStatus ||
              p.totalBill !== n.totalBill ||
              (p.items?.length ?? 0) !== (n.items?.length ?? 0)
            ) {
              hasChanges = true
              break
            }
          }
        }

        if (!hasChanges) {
          return prev
        }

        // Compare previous orders with new orders to trigger live notifications
        for (const newOrder of newOrders) {
          const existing = prev.find((o) => o.orderId === newOrder.orderId)
          if (existing && existing.orderStatus !== newOrder.orderStatus) {
            const info = STATUS_MESSAGES[newOrder.orderStatus] || {
              title: 'Order Status Updated',
              message: `Order #${newOrder.orderId} is now ${newOrder.orderStatus}.`,
            }

            if (tableId) {
              setLatestStatusUpdate({
                orderId: newOrder.orderId,
                tableId,
                status: newOrder.orderStatus,
                title: info.title,
                message: info.message,
                timestamp: new Date().toISOString(),
              })
              setHasUnreadStatusChange(true)
            }
          }
        }
        return newOrders
      })
    },
    [tableId],
  )

  // Fetch function
  const refreshOrders = useCallback(async () => {
    if (!tableId || targetTableIds.length === 0) return
    try {
      const fresh = await fetchOrdersByTable(tableId, undefined, targetTableIds)
      applyFetchedOrders(fresh)
    } catch (err) {
      console.error('[useOrders] fetch error', err)
    }
  }, [tableId, targetTableIds, applyFetchedOrders])

  // Initial fetch + Visibility sync
  useEffect(() => {
    if (!tableId || targetTableIds.length === 0) return

    refreshOrders()

    // Immediate sync when tab becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshOrders()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [tableId, targetTableIds, refreshOrders])

  // Realtime subscription to order status updates
  useEffect(() => {
    if (!tableId || targetTableIds.length === 0) return

    const channelName = `orders-table-realtime-${targetTableIds.join('-')}`
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'Restaurant_Orders',
        },
        (payload) => {
          const newRow = payload.new as Record<string, any> | null
          const oldRow = payload.old as Record<string, any> | null
          const rowTableId = Number(newRow?.TABLE_ID || oldRow?.TABLE_ID)
          if (targetTableIds.includes(rowTableId)) {
            refreshOrders()
          }
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
          refreshOrders()
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [tableId, targetTableIds, refreshOrders])

  const placeOrder = useCallback(
    async (items: CartItem[], diningType: DiningType, total: number, serverNote?: string): Promise<boolean> => {
      if (!tableId || items.length === 0) return false
      setIsSubmitting(true)
      setSubmitError(null)
      try {
        const newOrder = await createOrder(tableId, items, diningType, total, 'Customer', serverNote)
        setOrders((prev) => [newOrder, ...prev.filter((o) => o.orderId !== newOrder.orderId)])
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
