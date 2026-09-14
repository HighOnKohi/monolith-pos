import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  Clock,
  ChefHat,
  RefreshCw,
  Plus,
  Minus,
  CheckCircle,
  CheckCircle2,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  fetchDispatcherOrders,
  moveOrderToCooking,
  moveOrderToReady,
  moveOrderToCompleted,
  updateItemCookingCount,
  subscribeToOrderUpdates,
  type DispatcherOrder,
} from '@/services/dispatcherService'

type TableStage = 'preparing' | 'cooking' | 'done'

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
  useEffect(() => {
    return () => {
      isMounted.current = false
    }
  }, [])

  // Tables mode data & state
  const [orders, setOrders] = useState<DispatcherOrder[]>([])
  const ordersRef = useRef<DispatcherOrder[]>([])
  const [localCookingCounts, setLocalCookingCounts] = useState(new Map<string, number>())
  const [activeTableStage, setActiveTableStage] = useState<TableStage>('preparing')
  const currentlyRejectedRef = useRef(new Set<number>())

  const [isLoading, setIsLoading] = useState(false)
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null)

  useEffect(() => {
    ordersRef.current = orders
  }, [orders])

  function showToast(text: string, type: 'success' | 'error' | 'info' = 'success') {
    setToastMessage({ text, type })
    setTimeout(() => setToastMessage(null), 3000)
  }

  // ── 1. Fetch Table Orders ──
  const loadOrders = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true)
    try {
      const data = await fetchDispatcherOrders()
      if (isMounted.current) {
        const returnedOrderIds = new Set(data.map((order) => order.orderId))
        const nextRejected = new Set(currentlyRejectedRef.current)
        nextRejected.forEach((orderId) => {
          if (!returnedOrderIds.has(orderId)) nextRejected.delete(orderId)
        })
        const nextOrders = data.filter((order) => !nextRejected.has(order.orderId))
        setOrders((currentOrders) => {
          const nextById = new Map(nextOrders.map((order) => [order.orderId, order]))
          const keptCurrent = currentOrders
            .map((order) => nextById.get(order.orderId))
            .filter((order): order is DispatcherOrder => Boolean(order))
          const currentIds = new Set(currentOrders.map((order) => order.orderId))
          return [...keptCurrent, ...nextOrders.filter((order) => !currentIds.has(order.orderId))]
        })
      }
    } catch (err) {
      console.error('Failed to load dispatcher table orders:', err)
      if (isMounted.current) showToast('Failed to load orders', 'error')
    } finally {
      if (isMounted.current && !silent) setIsLoading(false)
    }
  }, [])

  // Initial loads and Realtime
  useEffect(() => {
    isMounted.current = true
    loadOrders(false)

    // Event bus listener for same-tab and cross-tab triggers
    const unsubscribeBus = subscribeToOrderUpdates((detail) => {
      if (!detail?.type || detail.type === 'tables' || detail.type === 'all') {
        void loadOrders(true)
      }
    })

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        loadOrders(true)
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityOrFocus)
    window.addEventListener('focus', handleVisibilityOrFocus)

    const ordersChannel = supabase
      .channel('dispatcher-orders-realtime-sub')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'Restaurant_Orders' },
        () => loadOrders(true),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'Order_Items' },
        () => loadOrders(true),
      )
      .subscribe()

    return () => {
      unsubscribeBus()
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus)
      window.removeEventListener('focus', handleVisibilityOrFocus)
      void supabase.removeChannel(ordersChannel)
    }
  }, [loadOrders])

  // ── Table Item Grouping Helper with Cooking Stepper Counts ──
  function groupOrderItems(order: DispatcherOrder): GroupedItem[] {
    const grouped = new Map<string, GroupedItem>()

    order.items.forEach((item) => {
      if (item.status === 'CANCELLED') return
      if (!grouped.has(item.itemId)) {
        grouped.set(item.itemId, {
          itemId: item.itemId,
          name: item.name || `Item #${item.itemId}`,
          totalQuantity: 0,
          cookingCount: 0,
          doneCount: 0,
          orderItemIds: [],
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

    grouped.forEach((group) => {
      const localCount = localCookingCounts.get(`${order.orderId}:${group.itemId}`)
      if (localCount !== undefined) {
        group.cookingCount = localCount
        group.doneCount = group.totalQuantity - localCount
      }
    })

    return Array.from(grouped.values())
  }

  // ── Filtered Tables Orders (Deterministically Sorted) ──
  const filteredOrders = useMemo(() => {
    return orders
      .filter((order) => {
        const activeItems = order.items.filter((i) => i.status !== 'CANCELLED')
        if (activeItems.length === 0) return false

        // Requested tab: ORDER_STATUS is REQUESTED or VERIFIED
        if (activeTableStage === 'preparing') {
          return ['REQUESTED', 'VERIFIED'].includes(order.orderStatus)
        }
        // Cooking tab: ORDER_STATUS is PREPARING
        if (activeTableStage === 'cooking') {
          return order.orderStatus === 'PREPARING'
        }
        // Done tab: ORDER_STATUS is READY or SERVED
        if (activeTableStage === 'done') {
          return ['READY', 'SERVED'].includes(order.orderStatus)
        }
        return false
      })
      .sort((a, b) => b.orderId - a.orderId)
  }, [orders, activeTableStage, localCookingCounts])

  // ── Table Order Actions & Stepper Handlers ──
  function handleTableCookingCountChange(
    orderId: number,
    itemId: string,
    delta: number,
    event?: React.MouseEvent,
  ) {
    const order = orders.find((o) => o.orderId === orderId)
    if (!order) return

    const grouped = groupOrderItems(order).find((g) => g.itemId === itemId)
    if (!grouped) return

    const currentCooking = grouped.cookingCount
    let newCooking: number

    // Helper: Shift+Click sets to 0 (all done) or max (all cooking)
    if (event?.shiftKey) {
      newCooking = delta < 0 ? 0 : grouped.totalQuantity
    } else {
      newCooking = Math.max(0, Math.min(grouped.totalQuantity, currentCooking + delta))
    }

    if (newCooking === currentCooking) return

    const newDone = grouped.totalQuantity - newCooking

    // Optimistic UI state update immediately
    setLocalCookingCounts((prev) => {
      const next = new Map(prev)
      next.set(`${orderId}:${itemId}`, newCooking)
      return next
    })

    setOrders((currentOrders) =>
      currentOrders.map((ord) => {
        if (ord.orderId !== orderId) return ord
        let doneRemaining = newDone
        return {
          ...ord,
          items: ord.items.map((it) => {
            if (it.itemId !== itemId || it.status === 'CANCELLED') return it
            if (doneRemaining > 0) {
              doneRemaining--
              return { ...it, status: 'DONE' }
            }
            return { ...it, status: 'COOKING' }
          }),
        }
      }),
    )

    // Persist to database asynchronously
    void updateItemCookingCount(orderId, itemId, newDone)
      .then(() => loadOrders(true))
      .catch((err) => {
        console.error('Failed to update cooking count:', err)
        showToast('Failed to update count', 'error')
      })
  }

  function handleMoveToCooking(orderId: number) {
    const previousOrders = orders
    setOrders((currentOrders) =>
      currentOrders.map((order) =>
        order.orderId === orderId
          ? {
              ...order,
              orderStatus: 'PREPARING',
              items: order.items.map((item) => (item.status === 'PENDING' ? { ...item, status: 'COOKING' } : item)),
            }
          : order,
      ),
    )
    showToast('Order moved to cooking', 'success')

    void moveOrderToCooking(orderId)
      .then(() => loadOrders(true))
      .catch((err) => {
        console.error('Failed to persist cooking status:', err)
        setOrders(previousOrders)
        showToast('Failed to move order', 'error')
      })
  }

  function handleMoveToReady(orderId: number) {
    const previousOrders = orders
    setOrders((currentOrders) =>
      currentOrders.map((order) =>
        order.orderId === orderId
          ? {
              ...order,
              orderStatus: 'READY',
            }
          : order,
      ),
    )
    showToast('Order marked as done (Ready for serving)', 'success')

    void moveOrderToReady(orderId)
      .then(() => loadOrders(true))
      .catch((err) => {
        console.error('Failed to persist ready status:', err)
        setOrders(previousOrders)
        showToast('Failed to mark order as done', 'error')
      })
  }

  function handleMoveToCompleted(orderId: number) {
    const previousOrders = orders
    setOrders((currentOrders) =>
      currentOrders.map((order) =>
        order.orderId === orderId
          ? {
              ...order,
              orderStatus: 'COMPLETED',
              items: order.items.map((item) => (item.status === 'CANCELLED' ? item : { ...item, status: 'DONE' })),
            }
          : order,
      ),
    )
    showToast('Order marked as complete → Sent to Cashier', 'success')

    void moveOrderToCompleted(orderId)
      .then(() => loadOrders(true))
      .catch((err) => {
        console.error('Failed to persist completed status:', err)
        setOrders(previousOrders)
        showToast('Failed to complete order', 'error')
      })
  }

  // Counts for Tabs
  const tablePreparingCount = orders.filter((o) => ['REQUESTED', 'VERIFIED'].includes(o.orderStatus)).length
  const tableCookingCount = orders.filter((o) => o.orderStatus === 'PREPARING').length
  const tableDoneCount = orders.filter((o) => ['READY', 'SERVED'].includes(o.orderStatus)).length

  return (
    <div className="dispatcher-interface-container">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={[
            'fixed top-5 right-5 z-50 px-4 py-2.5 rounded-2xl shadow-xl border text-xs sm:text-sm font-black flex items-center gap-2 animate-bounce-short',
            toastMessage.type === 'success'
              ? 'bg-[#14274E] text-[#E9C46A] border-[#E9C46A]/40'
              : toastMessage.type === 'error'
              ? 'bg-rose-700 text-white border-rose-500'
              : 'bg-slate-800 text-white border-slate-600',
          ].join(' ')}
        >
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Top Header */}
      <header className="dispatcher-header">
        <h1 className="dispatcher-title">Dispatcher Interface</h1>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              loadOrders(false)
            }}
            disabled={isLoading}
            className="dispatcher-refresh-btn"
          >
            <RefreshCw className={['dispatcher-icon', isLoading ? 'animate-spin' : ''].join(' ')} />
            <span>Refresh</span>
          </button>
        </div>
      </header>

      {/* Tabs Row */}
      <div className="dispatcher-tabs">
        <button
          className={['dispatcher-tab', activeTableStage === 'preparing' ? 'active' : ''].join(' ')}
          onClick={() => setActiveTableStage('preparing')}
        >
          <Clock className="dispatcher-tab-icon" />
          <span className="dispatcher-tab-label">Requested</span>
          <span className="dispatcher-tab-badge">{tablePreparingCount}</span>
        </button>
        <button
          className={['dispatcher-tab', activeTableStage === 'cooking' ? 'active' : ''].join(' ')}
          onClick={() => setActiveTableStage('cooking')}
        >
          <ChefHat className="dispatcher-tab-icon" />
          <span className="dispatcher-tab-label">Cooking</span>
          <span className="dispatcher-tab-badge">{tableCookingCount}</span>
        </button>
        <button
          className={['dispatcher-tab', activeTableStage === 'done' ? 'active' : ''].join(' ')}
          onClick={() => setActiveTableStage('done')}
        >
          <CheckCircle2 className="dispatcher-tab-icon" />
          <span className="dispatcher-tab-label">Done</span>
          <span className="dispatcher-tab-badge">{tableDoneCount}</span>
        </button>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="dispatcher-orders-grid">
          {filteredOrders.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-400 text-xs">
                <ChefHat className="w-10 h-10 text-slate-300 mb-2" />
                <span className="font-bold text-slate-600 text-sm">No orders in this stage</span>
                <span>Orders will appear here as they are punched by service.</span>
              </div>
            ) : (
              filteredOrders.map((order) => {
                const groupedItems = groupOrderItems(order)
                const allDone = groupedItems.length > 0 && groupedItems.every((item) => item.cookingCount === 0)

                return (
                  <div key={order.orderId} className="dispatcher-order-card">
                    {/* Card Header */}
                    <div className="dispatcher-order-header">
                      <div>
                        <h3 className="dispatcher-order-table">{order.tableDisplay}</h3>
                        <span className="dispatcher-order-id">Order #{order.orderId}</span>
                      </div>
                      <span className="dispatcher-order-type">{order.orderType || 'DINE-IN'}</span>
                    </div>

                    {/* Server/Kitchen notes */}
                    {order.serverNote && (
                      <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-1.5 text-xs text-amber-900 font-medium">
                        <strong>Note:</strong> {order.serverNote}
                      </div>
                    )}

                    {/* Items List with Cooking Steppers in cooking stage */}
                    <div className="dispatcher-order-items">
                      {groupedItems.map((group) => (
                        <div key={group.itemId} className="dispatcher-order-item">
                          <div className="flex items-center justify-between gap-2">
                            <span className="dispatcher-item-name flex-1">{group.name}</span>

                            {activeTableStage === 'cooking' ? (
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-bold text-slate-400">
                                  {group.doneCount}/{group.totalQuantity} done
                                </span>
                                <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                                  <button
                                    onClick={(e) => handleTableCookingCountChange(order.orderId, group.itemId, -1, e)}
                                    disabled={group.cookingCount <= 0}
                                    className="w-6 h-6 rounded flex items-center justify-center bg-white hover:bg-slate-200 disabled:opacity-30 text-slate-700 font-bold cursor-pointer"
                                    title="Click: -1 | Shift+Click: Set to 0 (All Done)"
                                  >
                                    <Minus className="w-3 h-3" />
                                  </button>
                                  <span className="w-6 text-center text-xs font-black text-[#14274E]">
                                    {group.cookingCount}
                                  </span>
                                  <button
                                    onClick={(e) => handleTableCookingCountChange(order.orderId, group.itemId, 1, e)}
                                    disabled={group.cookingCount >= group.totalQuantity}
                                    className="w-6 h-6 rounded flex items-center justify-center bg-[#14274E] hover:bg-[#203c73] disabled:opacity-30 text-white font-bold cursor-pointer"
                                    title="Click: +1 | Shift+Click: Set to Max (All Cooking)"
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <span className="dispatcher-item-qty">×{group.totalQuantity}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Card Actions / State Transitions */}
                    <div className="dispatcher-order-actions">
                      {activeTableStage === 'preparing' && (
                        <button
                          onClick={() => handleMoveToCooking(order.orderId)}
                          className="w-full py-2.5 rounded-xl bg-[#14274E] hover:bg-[#203c73] text-white text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
                        >
                          <ChefHat className="w-4 h-4 text-[#E9C46A]" />
                          <span>Start Cooking →</span>
                        </button>
                      )}

                      {activeTableStage === 'cooking' && (
                        <button
                          onClick={() => handleMoveToReady(order.orderId)}
                          disabled={!allDone}
                          className={[
                            'w-full py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all shadow-xs',
                            allDone
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
                              : 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-75',
                          ].join(' ')}
                          title={allDone ? 'Click to mark order as done' : 'Cook all items (count to 0) to mark as done'}
                        >
                          <CheckCircle className="w-4 h-4" />
                          <span>{allDone ? 'Mark as Done (Ready) →' : 'Cooking Items Remaining'}</span>
                        </button>
                      )}

                      {activeTableStage === 'done' && (
                        <button
                          onClick={() => handleMoveToCompleted(order.orderId)}
                          className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Mark as Complete →</span>
                        </button>
                      )}
                    </div>
                  </div>
                )
              })
          )}
        </div>
      </main>
    </div>
  )
}
