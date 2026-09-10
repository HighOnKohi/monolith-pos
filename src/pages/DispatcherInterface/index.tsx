import { useState, useEffect, useCallback, useRef } from 'react'
import { Clock, ChefHat, Truck, RefreshCw, ArrowRight, XCircle, Eye, Plus, Minus, CheckCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  fetchDispatcherOrders,
  fetchOrderViewerData,
  moveOrderToCooking,
  moveOrderToDispatched,
  rejectOrderItems,
  updateItemCookingCount,
  type DispatcherOrder,
} from '@/services/dispatcherService'

type FilterStage = 'preparing' | 'cooking' | 'dispatched'

type RejectionReason = 'only_1_left' | 'only_2_left' | 'only_3_left' | 'only_4_left' | 'only_5_left' | 'unavailable'

interface GroupedItem {
  itemId: string
  name: string
  totalQuantity: number
  cookingCount: number
  doneCount: number
  orderItemIds: number[]
}

export default function DispatcherInterface() {
  const isMounted = useRef(true)
  useEffect(() => { return () => { isMounted.current = false } }, [])

  const [orders, setOrders] = useState<DispatcherOrder[]>([])
  const [viewerOrders, setViewerOrders] = useState<Array<{
    orderId: number
    tableDisplay: string
    items: Array<{ name: string; quantity: number }>
  }>>([])
  const [isLoading, setIsLoading] = useState(false)
  const [activeStage, setActiveStage] = useState<FilterStage>('preparing')
  const [itemRejections, setItemRejections] = useState<Map<string, RejectionReason>>(new Map())
  const [showOrderViewer, setShowOrderViewer] = useState(false)
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null)

  const loadOrders = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true)
    try {
      const data = await fetchDispatcherOrders()
      if (isMounted.current) setOrders(data)
    } catch (err) {
      console.error('Failed to load dispatcher orders:', err)
      if (isMounted.current) showToast('Failed to load orders', 'error')
    } finally {
      if (isMounted.current && !silent) setIsLoading(false)
    }
  }, [])

  const loadViewerData = useCallback(async () => {
    try {
      const viewerData = await fetchOrderViewerData()
      setViewerOrders(viewerData)
    } catch (err) {
      console.error('Failed to load order viewer:', err)
    }
  }, [])

  useEffect(() => {
    loadOrders(false)

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadOrders(true)
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    const channel = supabase
      .channel('dispatcher-orders-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'Restaurant_Orders' },
        () => {
          loadOrders(true)
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'Order_Items' },
        () => {
          loadOrders(true)
        }
      )
      .subscribe()

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      supabase.removeChannel(channel)
    }
  }, [loadOrders])

  function showToast(text: string, type: 'success' | 'error' | 'info' = 'success') {
    setToastMessage({ text, type })
    setTimeout(() => setToastMessage(null), 3000)
  }

  function groupOrderItems(order: DispatcherOrder): GroupedItem[] {
    const grouped = new Map<string, GroupedItem>()
    
    order.items.forEach(item => {
      if (!grouped.has(item.itemId)) {
        grouped.set(item.itemId, {
          itemId: item.itemId,
          name: item.name || `Item #${item.itemId}`,
          totalQuantity: 0,
          cookingCount: 0,
          doneCount: 0,
          orderItemIds: []
        })
      }
      
      const group = grouped.get(item.itemId)!
      group.totalQuantity++
      group.orderItemIds.push(item.orderItemId)
      
      if (item.status === 'COOKING') {
        group.cookingCount++
      } else if (item.status === 'DONE') {
        group.doneCount++
      }
    })
    
    return Array.from(grouped.values())
  }

  const filteredOrders = orders.filter((order) => {
    const activeItems = order.items.filter(i => i.status !== 'CANCELLED')
    if (activeItems.length === 0) return false

    const hasPending  = activeItems.some(i => i.status === 'PENDING')
    const hasCooking  = activeItems.some(i => i.status === 'COOKING')
    const allDone     = activeItems.every(i => i.status === 'DONE')

    if (activeStage === 'preparing') return hasPending && !hasCooking && !allDone
    if (activeStage === 'cooking')   return hasCooking
    if (activeStage === 'dispatched') return allDone && order.orderStatus !== 'READY'
    return false
  })

  async function handleMoveToCooking(orderId: number) {
    try {
      await moveOrderToCooking(orderId)
      showToast('Order moved to cooking', 'success')
      loadOrders(true)
    } catch (err) {
      showToast('Failed to move order', 'error')
    }
  }

  async function handleMoveToDispatched(orderId: number) {
    try {
      await moveOrderToDispatched(orderId)
      showToast('Order marked as completed', 'success')
      loadOrders(true)
    } catch (err) {
      showToast('Failed to complete order', 'error')
    }
  }

  async function handleRejectItems(orderId: number) {
    const order = orders.find(o => o.orderId === orderId)
    if (!order) return

    const rejections = Array.from(itemRejections.entries()).flatMap(([itemId, reason]) => {
      // Get all order items for this menu item
      const items = order.items.filter(i => i.itemId === itemId)
      return items.map(item => ({
        orderItemId: item.orderItemId,
        itemId: item.itemId,
        reason
      }))
    })

    if (rejections.length === 0) {
      showToast('No items selected for rejection', 'info')
      return
    }

    try {
      await rejectOrderItems(orderId, rejections)
      showToast(`${rejections.length} item(s) rejected`, 'success')
      setItemRejections(new Map())
      loadOrders(true)
    } catch (err) {
      showToast('Failed to reject items', 'error')
    }
  }

  function toggleRejection(itemId: string, reason: RejectionReason) {
    setItemRejections(prev => {
      const next = new Map(prev)
      if (next.get(itemId) === reason) {
        next.delete(itemId)
      } else {
        next.set(itemId, reason)
      }
      return next
    })
  }

  async function handleUpdateCookingCount(orderId: number, itemId: string, change: number, currentDone: number) {
    const newDoneCount = Math.max(0, currentDone + change)
    try {
      await updateItemCookingCount(orderId, itemId, newDoneCount)
      loadOrders(true)
    } catch (err) {
      showToast('Failed to update cooking status', 'error')
    }
  }

  function isOrderFullyCooked(order: DispatcherOrder): boolean {
    const activeItems = order.items.filter(i => i.status !== 'CANCELLED')
    return activeItems.length > 0 && activeItems.every(i => i.status === 'DONE')
  }

  const stageLabels: Record<FilterStage, string> = {
    preparing: 'PREPARING',
    cooking: 'COOKING',
    dispatched: 'DISPATCHED',
  }

  const stageIcons: Record<FilterStage, typeof Clock> = {
    preparing: Clock,
    cooking: ChefHat,
    dispatched: Truck,
  }

  return (
    <div className="dispatcher-interface-container">
      <div className="dispatcher-header">
        <h1 className="dispatcher-title">Dispatcher Interface</h1>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="dispatcher-refresh-btn" onClick={() => {
            const next = !showOrderViewer
            setShowOrderViewer(next)
            if (next) loadViewerData()
          }}>
            <Eye className="dispatcher-icon" />
            {showOrderViewer ? 'Hide' : 'View All Orders'}
          </button>
          <button className="dispatcher-refresh-btn" onClick={() => loadOrders(false)}>
            <RefreshCw className="dispatcher-icon" />
            Refresh
          </button>
        </div>
      </div>

      {showOrderViewer && (
        <div className="dispatcher-order-viewer">
          <h2 className="dispatcher-viewer-title">All Active Orders</h2>
          <div className="dispatcher-viewer-content">
            {viewerOrders.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: '0.875rem' }}>No active orders</p>
            ) : (
              viewerOrders.map(order => (
                <div key={order.orderId} className="dispatcher-viewer-card">
                  <div className="dispatcher-viewer-header">
                    <span className="dispatcher-viewer-table">{order.tableDisplay}</span>
                    <span className="dispatcher-viewer-order">Order #{order.orderId}</span>
                  </div>
                  <div className="dispatcher-viewer-items">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="dispatcher-viewer-item">
                        <span className="dispatcher-viewer-item-name">{item.name}</span>
                        <span className="dispatcher-viewer-item-qty">×{item.quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <div className="dispatcher-tabs">
        {(['preparing', 'cooking', 'dispatched'] as FilterStage[]).map((stage) => {
          const Icon = stageIcons[stage]
          const count = orders.filter(o => {
            const activeItems = o.items.filter(item => item.status !== 'CANCELLED')
            if (activeItems.length === 0) return false
            const hasPending = activeItems.some(item => item.status === 'PENDING')
            const hasCooking = activeItems.some(item => item.status === 'COOKING')
            const allDone = activeItems.every(item => item.status === 'DONE')
            if (stage === 'preparing') {
              return ['REQUESTED', 'VERIFIED', 'PREPARING'].includes(o.orderStatus) && hasPending
            }
            if (stage === 'cooking') return hasCooking
            if (stage === 'dispatched') return allDone && o.orderStatus !== 'READY'
            return false
          }).length

          return (
            <button
              key={stage}
              className={`dispatcher-tab ${activeStage === stage ? 'active' : ''}`}
              onClick={() => setActiveStage(stage)}
            >
              <Icon className="dispatcher-tab-icon" />
              <span className="dispatcher-tab-label">{stageLabels[stage]}</span>
              {count > 0 && <span className="dispatcher-tab-badge">{count}</span>}
            </button>
          )
        })}
      </div>

      <div className="dispatcher-content">
        {isLoading ? (
          <div className="dispatcher-loading">Loading orders...</div>
        ) : filteredOrders.length === 0 ? (
          <div className="dispatcher-empty">
            <p>No orders in {stageLabels[activeStage]}</p>
          </div>
        ) : (
          <div className="dispatcher-orders-grid">
            {filteredOrders.map((order) => {
              const grouped = groupOrderItems(order)
              const fullyCooked = isOrderFullyCooked(order)
              
              return (
                <div key={order.orderId} className="dispatcher-order-card">
                  <div className="dispatcher-order-header">
                    <div className="dispatcher-order-meta">
                      <span className="dispatcher-order-table">{order.tableDisplay}</span>
                      <span className="dispatcher-order-id">Order #{order.orderId}</span>
                    </div>
                    <span className="dispatcher-order-type">{order.orderType}</span>
                  </div>

                  <div className="dispatcher-order-items">
                    {grouped.map((item) => {
                      const activeRejection = itemRejections.get(item.itemId)
                      return (
                        <div key={item.itemId} className="dispatcher-item">
                          <div className="dispatcher-item-info">
                            <span className="dispatcher-item-name">{item.name}</span>
                            <span className="dispatcher-item-qty">×{item.totalQuantity}</span>
                          </div>

                          {activeStage === 'cooking' && (
                             <div className="dispatcher-cooking-counter">
                               <button
                                 className="dispatcher-counter-btn"
                                 onClick={() => handleUpdateCookingCount(order.orderId, item.itemId, 1, item.doneCount)}
                                 disabled={item.cookingCount === 0}
                               >
                                 <Minus size={16} />
                               </button>
                               <span className="dispatcher-counter-value">
                                 {item.cookingCount} cooking
                               </span>
                               <button
                                 className="dispatcher-counter-btn"
                                 onClick={() => handleUpdateCookingCount(order.orderId, item.itemId, -1, item.doneCount)}
                                 disabled={item.doneCount === 0}
                               >
                                 <Plus size={16} />
                               </button>
                             </div>
                           )}

                          {activeStage === 'preparing' && (
                            <div className="dispatcher-item-rejection">
                              <button
                                className={`dispatcher-rejection-btn ${activeRejection === 'only_1_left' ? 'active' : ''}`}
                                onClick={() => toggleRejection(item.itemId, 'only_1_left')}
                              >
                                Only 1
                              </button>
                              <button
                                className={`dispatcher-rejection-btn ${activeRejection === 'only_2_left' ? 'active' : ''}`}
                                onClick={() => toggleRejection(item.itemId, 'only_2_left')}
                              >
                                Only 2
                              </button>
                              <button
                                className={`dispatcher-rejection-btn ${activeRejection === 'only_3_left' ? 'active' : ''}`}
                                onClick={() => toggleRejection(item.itemId, 'only_3_left')}
                              >
                                Only 3
                              </button>
                              <button
                                className={`dispatcher-rejection-btn ${activeRejection === 'only_4_left' ? 'active' : ''}`}
                                onClick={() => toggleRejection(item.itemId, 'only_4_left')}
                              >
                                Only 4
                              </button>
                              <button
                                className={`dispatcher-rejection-btn ${activeRejection === 'only_5_left' ? 'active' : ''}`}
                                onClick={() => toggleRejection(item.itemId, 'only_5_left')}
                              >
                                Only 5
                              </button>
                              <button
                                className={`dispatcher-rejection-btn unavailable ${activeRejection === 'unavailable' ? 'active' : ''}`}
                                onClick={() => toggleRejection(item.itemId, 'unavailable')}
                              >
                                <XCircle className="dispatcher-rejection-icon" />
                                Unavailable
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  <div className="dispatcher-order-actions">
                    {activeStage === 'preparing' && (
                      <>
                        <button
                          className="dispatcher-action-btn reject"
                          onClick={() => handleRejectItems(order.orderId)}
                          disabled={itemRejections.size === 0}
                        >
                          <XCircle className="dispatcher-action-icon" />
                          Reject Selected
                        </button>
                        <button
                          className="dispatcher-action-btn primary"
                          onClick={() => handleMoveToCooking(order.orderId)}
                        >
                          <ArrowRight className="dispatcher-action-icon" />
                          Send to Cooking
                        </button>
                      </>
                    )}

                    {activeStage === 'cooking' && (
                      <button
                        className="dispatcher-action-btn primary"
                        onClick={() => handleMoveToDispatched(order.orderId)}
                        disabled={!fullyCooked}
                      >
                        <CheckCircle className="dispatcher-action-icon" />
                        Mark as Completed
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {toastMessage && (
        <div className={`dispatcher-toast dispatcher-toast-${toastMessage.type}`}>
          {toastMessage.text}
        </div>
      )}
    </div>
  )
}
