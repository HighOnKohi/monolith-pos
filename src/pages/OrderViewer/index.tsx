import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { fetchOrderViewerData, subscribeToOrderUpdates } from '@/services/dispatcherService'

interface ViewerOrder {
  orderId: number
  tableDisplay: string
  items: Array<{
    name: string
    quantity: number
    isGroup?: boolean
    includedItems?: Array<{ id: number; name: string; quantity: number }>
  }>
}

export default function OrderViewer() {
  const [tableOrders, setTableOrders] = useState<ViewerOrder[]>([])

  const loadData = useCallback(async () => {
    try {
      const tData = await fetchOrderViewerData()
      setTableOrders(tData)
    } catch (error) {
      console.error('Failed to load order viewer orders:', error)
    }
  }, [])

  useEffect(() => {
    // Initial load
    void loadData()

    // 1. Instant event listener for same-tab & cross-tab updates via BroadcastChannel/DOM bus
    const unsubscribeBus = subscribeToOrderUpdates(() => {
      void loadData()
    })

    // 2. Tab focus / visibility change handler
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        void loadData()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityOrFocus)
    window.addEventListener('focus', handleVisibilityOrFocus)

    // 3. Supabase Postgres Changes listeners for multi-device realtime
    const ordersChannel = supabase
      .channel('order-viewer-table-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Restaurant_Orders' }, () => void loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Order_Items' }, () => void loadData())
      .subscribe()

    return () => {
      unsubscribeBus()
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus)
      window.removeEventListener('focus', handleVisibilityOrFocus)
      void supabase.removeChannel(ordersChannel)
    }
  }, [loadData])

  return (
    <main className="order-viewer-page staff-page">
      {/* Main Content Area */}
      <section className="order-viewer-orders">
        {tableOrders.length === 0 ? (
          <p className="order-viewer-empty">
            No table orders currently need cooking.
          </p>
        ) : (
          tableOrders.map((order) => (
            <article className="order-viewer-card" key={order.orderId}>
              <div className="order-viewer-card-header flex items-center justify-between">
                <div className="flex flex-col">
                  <strong>{order.tableDisplay}</strong>
                </div>
                <span>Order #{order.orderId}</span>
              </div>
              <div className="order-viewer-items">
                {order.items.map((item) => (
                  <div className="order-viewer-item" key={item.name}>
                    <span>{item.name}</span>
                    <strong>×{item.quantity}</strong>
                  </div>
                ))}
              </div>
            </article>
          ))
        )}
      </section>
    </main>
  )
}
