import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { fetchOrderViewerData, subscribeToOrderUpdates, type ViewerOrderData } from '@/services/dispatcherService'
import { TableLabelBadge } from '@/components/common/TableLabelBadge'

interface ViewerOrder extends ViewerOrderData {
  items: Array<{
    name: string
    quantity: number
    categoryName?: string
    isGroup?: boolean
    includedItems?: Array<{ id: number; name: string; quantity: number }>
  }>
}

export default function OrderViewer() {
  const [tableOrders, setTableOrders] = useState<ViewerOrder[]>([])

  const loadData = useCallback(async () => {
    try {
      const tData = await fetchOrderViewerData()
      const sorted = [...tData].sort((a, b) => {
        const aPrio = a.labelPriority != null ? a.labelPriority : 999999
        const bPrio = b.labelPriority != null ? b.labelPriority : 999999
        if (aPrio !== bPrio) return aPrio - bPrio
        return a.orderId - b.orderId
      })
      setTableOrders(sorted)
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
      .on('postgres_changes', { event: '*', schema: 'orders', table: 'Restaurant_Orders' }, () => void loadData())
      .on('postgres_changes', { event: '*', schema: 'orders', table: 'Order_Items' }, () => void loadData())
      .on('postgres_changes', { event: '*', schema: 'tables', table: 'Restaurant_Tables' }, () => void loadData())
      .on('postgres_changes', { event: '*', schema: 'tables', table: 'Table_Labels' }, () => void loadData())
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
          tableOrders.map((order) => {
            // Group items by categoryName for clear type separation
            const categoryGroups = new Map<string, typeof order.items>()
            order.items.forEach((item) => {
              const cat = item.categoryName || 'Other'
              if (!categoryGroups.has(cat)) categoryGroups.set(cat, [])
              categoryGroups.get(cat)!.push(item)
            })

            return (
              <article
                className="order-viewer-card"
                key={order.orderId}
                style={{
                  border: order.labelColor ? `2.5px solid ${order.labelColor}` : '1px solid #e2e8f0',
                  boxShadow: order.labelColor
                    ? `0 4px 16px ${order.labelColor}25, 0 0 0 1px ${order.labelColor}30`
                    : undefined,
                }}
              >
                {/* Top Color Accent Strip */}
                {order.labelColor && (
                  <div
                    className="h-1.5 w-full shrink-0"
                    style={{ backgroundColor: order.labelColor }}
                  />
                )}
                <div
                  className="order-viewer-card-header flex items-center justify-between"
                  style={{
                    backgroundColor: order.labelColor ? `${order.labelColor}0d` : undefined,
                  }}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <strong>{order.tableDisplay}</strong>
                    {order.labelName && order.labelColor && (
                      <TableLabelBadge
                        name={order.labelName}
                        color={order.labelColor}
                        size="sm"
                        showDot
                      />
                    )}
                  </div>
                  <span>Order #{order.orderId}</span>
                </div>
                <div className="order-viewer-items">
                  {Array.from(categoryGroups.entries()).map(([category, items]) => {
                    const totalCatQty = items.reduce((sum, it) => sum + it.quantity, 0)
                    return (
                      <div className="order-viewer-category-container" key={category}>
                        <div className="order-viewer-category-header">
                          <span className="order-viewer-category-badge">{category}</span>
                          <span className="order-viewer-category-count">
                            {totalCatQty} total
                          </span>
                        </div>
                        <div className="order-viewer-category-items">
                          {items.map((item, idx) => (
                            <div
                              className={`order-viewer-item ${idx % 2 === 0 ? 'item-even' : 'item-odd'}`}
                              key={item.name}
                            >
                              <span className="order-viewer-item-name">{item.name}</span>
                              <strong className="order-viewer-item-qty">×{item.quantity}</strong>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </article>
            )
          })
        )}
      </section>
    </main>
  )
}
