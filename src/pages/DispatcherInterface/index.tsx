import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  Clock,
  ChefHat,
  RefreshCw,
  Check,
  CheckCircle,
  CheckCircle2,
  Flag,
  XCircle,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  fetchDispatcherOrders,
  moveOrderToCooking,
  moveOrderToReady,
  moveOrderToCompleted,
  updateOrderItemStatus,
  rejectOrderItems,
  flagOrderItems,
  saveDispatcherNote,
  subscribeToOrderUpdates,
  type DispatcherOrder,
} from '@/services/dispatcherService'
import { CancelOrderModal } from '@/components/dispatcher/CancelOrderModal'

type TableStage = 'preparing' | 'cooking' | 'done'

interface GroupedItem {
  itemId: string
  name: string
  categoryName: string
  totalQuantity: number
  cookingCount: number
  doneCount: number
  orderItemIds: number[]
  isFlagged: boolean
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
  const [activeTableStage, setActiveTableStage] = useState<TableStage>('preparing')
  const currentlyRejectedRef = useRef(new Set<number>())
  const [rejectingOrder, setRejectingOrder] = useState<DispatcherOrder | null>(null)

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
        { event: '*', schema: 'orders', table: 'Restaurant_Orders' },
        () => loadOrders(true),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'orders', table: 'Order_Items' },
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
          categoryName: item.categoryName || 'Other',
          totalQuantity: 0,
          cookingCount: 0,
          doneCount: 0,
          orderItemIds: [],
          isFlagged: false,
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
      if (item.isFlagged) {
        group.isFlagged = true
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
      .sort((a, b) => {
        if (activeTableStage === 'cooking') {
          // In cooking tab, marked orders (orders with 1+ items marked DONE) go to the bottom
          const aHasMarked = a.items.some((i) => i.status === 'DONE')
          const bHasMarked = b.items.some((i) => i.status === 'DONE')
          if (aHasMarked !== bHasMarked) {
            return aHasMarked ? 1 : -1
          }
        }
        return b.orderId - a.orderId
      })
  }, [orders, activeTableStage])

  // ── Toggle Individual Item Done Handler ──
  async function handleToggleItemDone(orderId: number, orderItemId: number) {
    const order = orders.find((o) => o.orderId === orderId)
    if (!order) return

    const item = order.items.find((i) => i.orderItemId === orderItemId)
    if (!item) return

    const newStatus: 'DONE' | 'COOKING' = item.status === 'DONE' ? 'COOKING' : 'DONE'

    // Optimistically update item status in orders
    const nextOrders = orders.map((ord) => {
      if (ord.orderId !== orderId) return ord
      return {
        ...ord,
        items: ord.items.map((it) =>
          it.orderItemId === orderItemId ? { ...it, status: newStatus } : it,
        ),
      }
    })

    // Check if ALL active items in this order are now marked DONE
    const targetOrder = nextOrders.find((o) => o.orderId === orderId)
    const activeItems = targetOrder?.items.filter((i) => i.status !== 'CANCELLED') ?? []
    const allMarked = activeItems.length > 0 && activeItems.every((i) => i.status === 'DONE')

    if (allMarked) {
      // Optimistically move order to READY status (instantly leaves cooking tab and enters done tab)
      setOrders(
        nextOrders.map((ord) =>
          ord.orderId === orderId
            ? {
                ...ord,
                orderStatus: 'READY',
                items: ord.items.map((it) => (it.status === 'CANCELLED' ? it : { ...it, status: 'DONE' })),
              }
            : ord,
        ),
      )
      showToast(`Order #${orderId} completed → Moved to Done tab!`, 'success')

      try {
        await updateOrderItemStatus(orderItemId, 'DONE')
        await moveOrderToReady(orderId)
        void loadOrders(true)
      } catch (err) {
        console.error('Failed to auto-move order to ready:', err)
        showToast('Failed to move order to Done', 'error')
        void loadOrders(true)
      }
    } else {
      setOrders(nextOrders)
      try {
        await updateOrderItemStatus(orderItemId, newStatus)
      } catch (err) {
        console.error('Failed to update item status:', err)
        showToast('Failed to update item', 'error')
        void loadOrders(true)
      }
    }
  }

  // ── Mark All Items in Order as Done Handler ──
  async function handleMarkAllDone(orderId: number) {
    const order = orders.find((o) => o.orderId === orderId)
    if (!order) return

    setOrders((prev) =>
      prev.map((o) =>
        o.orderId === orderId
          ? {
              ...o,
              orderStatus: 'READY',
              items: o.items.map((it) => (it.status === 'CANCELLED' ? it : { ...it, status: 'DONE' })),
            }
          : o,
      ),
    )
    showToast(`Order #${orderId} completed → Moved to Done tab!`, 'success')

    try {
      await moveOrderToReady(orderId)
      void loadOrders(true)
    } catch (err) {
      console.error('Failed to move order to ready:', err)
      showToast('Failed to move order to Done', 'error')
      void loadOrders(true)
    }
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

  // ── Fast Item Flag Handler ──
  async function handleToggleItemFlag(orderId: number, itemId: string, flag: boolean) {
    try {
      await flagOrderItems(orderId, [itemId], flag)
      showToast(flag ? 'Item flagged as unavailable' : 'Item unflagged', 'info')
      void loadOrders(true)
    } catch (err) {
      console.error('[Dispatcher] toggleItemFlag error:', err)
      showToast('Failed to update item flag', 'error')
    }
  }

  // ── Reject / Flag Handler ──
  async function handleRejectOrder(note: string, flaggedItemIds: string[]) {
    if (!rejectingOrder) return

    const orderId = rejectingOrder.orderId

    if (note?.trim()) {
      try {
        await saveDispatcherNote(orderId, note.trim())
      } catch {
        // Ignore note error
      }
    }

    // Flag the selected items
    if (flaggedItemIds.length > 0) {
      await flagOrderItems(orderId, flaggedItemIds, true)
    }

    // Build rejection list from all active items (the modal is a bulk-reject flow)
    const activeItems = rejectingOrder.items.filter((i) => i.status !== 'CANCELLED')
    const rejections = activeItems.map((item) => ({
      orderItemId: item.orderItemId,
      itemId: item.itemId,
      reason: flaggedItemIds.includes(item.itemId) ? 'unavailable' : 'unavailable',
    }))

    if (rejections.length > 0) {
      await rejectOrderItems(orderId, rejections)
    }

    // Optimistically remove from UI
    currentlyRejectedRef.current.add(orderId)
    setOrders((prev) => prev.filter((o) => o.orderId !== orderId))
    showToast('Order rejected & items flagged', 'success')
    void loadOrders(true)
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
              const activeItems = order.items.filter((i) => i.status !== 'CANCELLED')
              const doneCount = activeItems.filter((i) => i.status === 'DONE').length

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

                  {/* Items List */}
                  <div className="dispatcher-order-items">
                    {activeTableStage === 'cooking' ? (
                      /* ── Cooking Stage: Categorized Containers with Marked Items at Bottom ── */
                      (() => {
                        const catGroups = new Map<string, typeof activeItems>()
                        activeItems.forEach((item) => {
                          const cat = item.categoryName || 'Other'
                          if (!catGroups.has(cat)) catGroups.set(cat, [])
                          catGroups.get(cat)!.push(item)
                        })

                        return Array.from(catGroups.entries()).map(([category, items]) => {
                          // Inside each category, marked items (status === 'DONE') sink to the bottom
                          const sortedItems = [...items].sort((a, b) => {
                            const aDone = a.status === 'DONE' ? 1 : 0
                            const bDone = b.status === 'DONE' ? 1 : 0
                            if (aDone !== bDone) return aDone - bDone
                            return a.orderItemId - b.orderItemId
                          })

                          const doneCount = sortedItems.filter((i) => i.status === 'DONE').length

                          return (
                            <div key={category} className="dispatcher-category-container">
                              <div className="dispatcher-category-header">
                                <div className="flex items-center gap-1.5">
                                  <span className="dispatcher-category-badge">{category}</span>
                                  {doneCount > 0 && (
                                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-md border border-emerald-300">
                                      {doneCount}/{sortedItems.length} cooked
                                    </span>
                                  )}
                                </div>
                                <span className="dispatcher-category-count">
                                  {sortedItems.length} item{sortedItems.length !== 1 ? 's' : ''}
                                </span>
                              </div>

                              <div className="dispatcher-category-items">
                                {sortedItems.map((item, idx) => {
                                  const isDone = item.status === 'DONE'

                                  // If multiple items share the same name in this order, distinguish with (#1, #2...)
                                  const matchingItems = activeItems.filter((i) => i.name === item.name)
                                  let itemLabel = item.name
                                  if (matchingItems.length > 1) {
                                    const unitIndex = matchingItems.findIndex((i) => i.orderItemId === item.orderItemId) + 1
                                    itemLabel = `${item.name} (#${unitIndex})`
                                  }

                                  const zebraClass = isDone
                                    ? 'item-row-done bg-emerald-50/60 border-emerald-200'
                                    : idx % 2 === 0
                                      ? 'item-row-even bg-white border-slate-200/90'
                                      : 'item-row-odd bg-slate-100/75 border-slate-200'

                                  return (
                                    <div
                                      key={item.orderItemId}
                                      className={`dispatcher-order-item transition-all duration-200 ${zebraClass}`}
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                          <span
                                            className={`dispatcher-item-name truncate ${
                                              isDone ? 'line-through text-slate-400 font-normal' : 'text-[#14274E] font-bold'
                                            }`}
                                          >
                                            {itemLabel}
                                          </span>
                                          {item.isFlagged && (
                                            <span className="dispatcher-flag-badge shrink-0">
                                              <Flag className="h-2.5 w-2.5" />
                                              Flagged
                                            </span>
                                          )}
                                        </div>

                                        <button
                                          type="button"
                                          onClick={() => handleToggleItemDone(order.orderId, item.orderItemId)}
                                          className={`px-2.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95 shrink-0 ${
                                            isDone
                                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                              : 'bg-white hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 text-slate-700 border border-slate-200'
                                          }`}
                                          title={isDone ? 'Item cooked (click to unmark)' : 'Click to mark as done'}
                                        >
                                          {isDone ? (
                                            <>
                                              <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                                              <span>Done</span>
                                            </>
                                          ) : (
                                            <>
                                              <Check className="w-3.5 h-3.5 text-slate-400" />
                                              <span>Mark Done</span>
                                            </>
                                          )}
                                        </button>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        })
                      })()
                    ) : (
                      /* ── Requested & Done Stages: Categorized Containers with Grouped Items ── */
                      (() => {
                        const catGroups = new Map<string, GroupedItem[]>()
                        groupedItems.forEach((group) => {
                          const cat = group.categoryName || 'Other'
                          if (!catGroups.has(cat)) catGroups.set(cat, [])
                          catGroups.get(cat)!.push(group)
                        })

                        return Array.from(catGroups.entries()).map(([category, items]) => {
                          const totalQty = items.reduce((sum, g) => sum + g.totalQuantity, 0)
                          return (
                            <div key={category} className="dispatcher-category-container">
                              <div className="dispatcher-category-header">
                                <span className="dispatcher-category-badge">{category}</span>
                                <span className="dispatcher-category-count">
                                  {totalQty} item{totalQty !== 1 ? 's' : ''}
                                </span>
                              </div>

                              <div className="dispatcher-category-items">
                                {items.map((group, idx) => {
                                  const zebraClass =
                                    idx % 2 === 0
                                      ? 'item-row-even bg-white border-slate-200/90'
                                      : 'item-row-odd bg-slate-100/75 border-slate-200'

                                  return (
                                    <div key={group.itemId} className={`dispatcher-order-item ${zebraClass}`}>
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="dispatcher-item-name flex-1">
                                          {group.name}
                                          {group.isFlagged && (
                                            <span className="dispatcher-flag-badge ml-1.5">
                                              <Flag className="h-2.5 w-2.5" />
                                              Flagged
                                            </span>
                                          )}
                                        </span>

                                        {activeTableStage === 'preparing' ? (
                                          <div className="flex items-center gap-2">
                                            <button
                                              type="button"
                                              onClick={() =>
                                                handleToggleItemFlag(order.orderId, group.itemId, !group.isFlagged)
                                              }
                                              className={[
                                                'px-2 py-0.5 text-[10px] font-extrabold rounded-md flex items-center gap-1 transition-all cursor-pointer border',
                                                group.isFlagged
                                                  ? 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200 shadow-2xs'
                                                  : 'bg-white text-slate-400 border-slate-200 hover:border-amber-300 hover:text-amber-600',
                                              ].join(' ')}
                                              title={
                                                group.isFlagged
                                                  ? 'Unflag item'
                                                  : 'Flag item as unavailable / out of stock'
                                              }
                                            >
                                              <Flag
                                                className="w-2.5 h-2.5"
                                                fill={group.isFlagged ? 'currentColor' : 'none'}
                                              />
                                              <span>{group.isFlagged ? 'Flagged' : 'Flag'}</span>
                                            </button>
                                            <span className="dispatcher-item-qty">×{group.totalQuantity}</span>
                                          </div>
                                        ) : (
                                          <span className="dispatcher-item-qty">×{group.totalQuantity}</span>
                                        )}
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        })
                      })()
                    )}
                  </div>

                  {/* Card Actions / State Transitions */}
                  <div className="dispatcher-order-actions">
                    {activeTableStage === 'preparing' && (
                      <>
                        <button
                          onClick={() => setRejectingOrder(order)}
                          className="dispatcher-reject-action-btn"
                        >
                          <XCircle className="w-4 h-4" />
                          <span>Flag / Reject</span>
                        </button>
                        <button
                          onClick={() => handleMoveToCooking(order.orderId)}
                          className="w-full py-2.5 rounded-xl bg-[#14274E] hover:bg-[#203c73] text-white text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
                        >
                          <ChefHat className="w-4 h-4 text-[#E9C46A]" />
                          <span>Start Cooking →</span>
                        </button>
                      </>
                    )}

                    {activeTableStage === 'cooking' && (
                      <div className="w-full pt-1 space-y-2">
                        <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
                          <span>Cooking Progress</span>
                          <span className="font-black text-[#14274E]">
                            {doneCount} of {activeItems.length} items ready
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                            style={{
                              width: `${(doneCount / Math.max(1, activeItems.length)) * 100}%`,
                            }}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleMarkAllDone(order.orderId)}
                          className="w-full py-2 rounded-xl text-xs font-bold border border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100 text-emerald-800 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                          title="Mark all remaining items as done and move order to Done"
                        >
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Mark All Done →</span>
                        </button>
                      </div>
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

      {/* Reject / Flag Modal */}
      {rejectingOrder && (
        <CancelOrderModal
          order={rejectingOrder}
          onClose={() => setRejectingOrder(null)}
          onConfirm={handleRejectOrder}
        />
      )}
    </div>
  )
}
