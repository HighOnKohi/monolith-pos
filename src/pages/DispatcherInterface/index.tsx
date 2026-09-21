import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Loader2 } from 'lucide-react'
import {
  Clock,
  ChefHat,
  RefreshCw,
  Check,
  CheckCircle,
  CheckCircle2,
  Flag,
  XCircle,
  RotateCcw,
} from 'lucide-react'
import {
  ClockFilledIcon,
  ChefHatFilledIcon,
  CheckCircleFilledIcon,
  CheckmarkFilledIcon,
  FlagFilledIcon,
  XCircleFilledIcon,
} from '@/components/icons/FilledIcons'
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
import { TableLabelBadge } from '@/components/common/TableLabelBadge'

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
  const [undoHistory, setUndoHistory] = useState<
    Array<{ orderId: number; orderItemId: number; itemId: string; itemName: string; timestamp: number }>
  >([])

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
      if (!detail?.type || detail.type === 'tables' || detail.type === 'all' || detail.type === 'table_label_changed') {
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
      .on(
        'postgres_changes',
        { event: '*', schema: 'tables', table: 'Restaurant_Tables' },
        () => loadOrders(true),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'tables', table: 'Table_Labels' },
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
        // 1. Hierarchy / Label priority sorting layer: lower number = higher priority
        const aPrio = a.labelPriority != null ? a.labelPriority : 999999
        const bPrio = b.labelPriority != null ? b.labelPriority : 999999
        if (aPrio !== bPrio) {
          return aPrio - bPrio
        }

        // 2. Existing cooking stage marked items ordering
        if (activeTableStage === 'cooking') {
          // In cooking tab, marked orders (orders with 1+ items marked DONE) go to the bottom
          const aHasMarked = a.items.some((i) => i.status === 'DONE')
          const bHasMarked = b.items.some((i) => i.status === 'DONE')
          if (aHasMarked !== bHasMarked) {
            return aHasMarked ? 1 : -1
          }
        }

        // 3. Chronological / ID ordering
        return b.orderId - a.orderId
      })
  }, [orders, activeTableStage])

  // ── Toggle Individual Item Done Handler ──
  // ── Mark 1 Piece of an Item Group as Done ──
  async function handleMarkOnePieceDone(orderId: number, itemId: string) {
    const order = orders.find((o) => o.orderId === orderId)
    if (!order) return

    // Find the first active undone item matching this itemId
    const undoneItem = order.items.find(
      (it) => it.itemId === itemId && it.status !== 'DONE' && it.status !== 'CANCELLED',
    )
    if (!undoneItem) return

    const orderItemId = undoneItem.orderItemId

    // Optimistically update item status to 'DONE'
    const nextOrders = orders.map((ord) => {
      if (ord.orderId !== orderId) return ord
      return {
        ...ord,
        items: ord.items.map((it) =>
          it.orderItemId === orderItemId ? { ...it, status: 'DONE' } : it,
        ),
      }
    })

    // Track in undoHistory
    setUndoHistory((prev) => [
      ...prev.filter((h) => h.orderItemId !== orderItemId),
      { orderId, orderItemId, itemId, itemName: undoneItem.name, timestamp: Date.now() },
    ])

    // Check if ALL active items in this order are now marked DONE
    const targetOrder = nextOrders.find((o) => o.orderId === orderId)
    const activeItems = targetOrder?.items.filter((i) => i.status !== 'CANCELLED') ?? []
    const allMarked = activeItems.length > 0 && activeItems.every((i) => i.status === 'DONE')

    if (allMarked) {
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
      showToast(`Marked 1 ${undoneItem.name} as done`, 'info')
      try {
        await updateOrderItemStatus(orderItemId, 'DONE')
      } catch (err) {
        console.error('Failed to update item status:', err)
        showToast('Failed to update item', 'error')
        void loadOrders(true)
      }
    }
  }

  // ── Undo Last Marked Done Item for Order ──
  async function handleUndoLastDone(orderId: number) {
    const order = orders.find((o) => o.orderId === orderId)
    if (!order) return

    // 1. Check if there is an entry in undoHistory for this order
    let targetOrderItemId: number | null = null
    const historyForOrder = undoHistory.filter((h) => h.orderId === orderId)
    if (historyForOrder.length > 0) {
      const lastAction = historyForOrder[historyForOrder.length - 1]
      const it = order.items.find((i) => i.orderItemId === lastAction.orderItemId)
      if (it && it.status === 'DONE') {
        targetOrderItemId = lastAction.orderItemId
      }
    }

    // 2. Fallback: find the last active item with status === 'DONE'
    if (!targetOrderItemId) {
      const doneItems = order.items.filter((i) => i.status === 'DONE' && i.status !== 'CANCELLED')
      if (doneItems.length === 0) {
        showToast('No items to undo', 'info')
        return
      }
      targetOrderItemId = doneItems[doneItems.length - 1].orderItemId
    }

    const itemToRevert = targetOrderItemId
    const itemObj = order.items.find((i) => i.orderItemId === itemToRevert)
    const itemName = itemObj?.name || 'item'

    // Remove from undoHistory
    setUndoHistory((prev) => prev.filter((h) => h.orderItemId !== itemToRevert))

    // Optimistically revert item to 'COOKING' and order to 'PREPARING'
    setOrders((currentOrders) =>
      currentOrders.map((ord) => {
        if (ord.orderId !== orderId) return ord
        return {
          ...ord,
          orderStatus: 'PREPARING',
          items: ord.items.map((it) =>
            it.orderItemId === itemToRevert ? { ...it, status: 'COOKING' } : it,
          ),
        }
      }),
    )

    showToast(`Reverted 1 ${itemName} to cooking`, 'info')

    try {
      await updateOrderItemStatus(itemToRevert, 'COOKING')
      if (order.orderStatus === 'READY') {
        await supabase
          .from('Restaurant_Orders')
          .update({ ORDER_STATUS: 'PREPARING' })
          .eq('ORDER_ID', orderId)
      }
      void loadOrders(true)
    } catch (err) {
      console.error('Failed to undo item:', err)
      showToast('Failed to undo item', 'error')
      void loadOrders(true)
    }
  }

  // ── Return Order from Done Back to Cooking ──
  async function handleUndoOrderToCooking(orderId: number) {
    setOrders((currentOrders) =>
      currentOrders.map((ord) => {
        if (ord.orderId !== orderId) return ord
        return {
          ...ord,
          orderStatus: 'PREPARING',
          items: ord.items.map((it) => (it.status === 'CANCELLED' ? it : { ...it, status: 'COOKING' })),
        }
      }),
    )

    showToast(`Order #${orderId} returned to Cooking`, 'info')

    try {
      await supabase
        .from('Restaurant_Orders')
        .update({ ORDER_STATUS: 'PREPARING' })
        .eq('ORDER_ID', orderId)
      await supabase
        .from('Order_Items')
        .update({ ORDER_ITEM_STATUS: 'COOKING' })
        .eq('ORDER_ID', orderId)
        .neq('ORDER_ITEM_STATUS', 'CANCELLED')
      void loadOrders(true)
    } catch (err) {
      console.error('Failed to return order to cooking:', err)
      showToast('Failed to return order', 'error')
      void loadOrders(true)
    }
  }

  // ── Global Undo Most Recent Done Action ──
  function handleGlobalUndo() {
    if (undoHistory.length === 0) return
    const lastAction = undoHistory[undoHistory.length - 1]
    void handleUndoLastDone(lastAction.orderId)
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

      {/* ── Dispatcher Stage Tabs (Segmented Style with Sliding Indicator) ── */}
      <div className="dispatcher-tabs-bar relative">
        <nav className="dispatcher-tabs-nav" aria-label="Dispatcher stages">
          {/* Animated sliding background pill */}
          <div
            className={`dispatcher-tab-slider ${
              activeTableStage === 'preparing'
                ? 'pos-0'
                : activeTableStage === 'cooking'
                  ? 'pos-1'
                  : 'pos-2'
            }`}
            aria-hidden="true"
          />

          <button
            type="button"
            onClick={() => setActiveTableStage('preparing')}
            className={`dispatcher-tab-btn ${activeTableStage === 'preparing' ? 'is-active' : ''}`}
          >
            <span className="dispatcher-tab-content">
              <ClockFilledIcon className="dispatcher-tab-icon" />
              <span>Requested</span>
            </span>
            {activeTableStage !== 'preparing' && tablePreparingCount > 0 && (
              <span className="dispatcher-tab-badge">{tablePreparingCount}</span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTableStage('cooking')}
            className={`dispatcher-tab-btn ${activeTableStage === 'cooking' ? 'is-active' : ''}`}
          >
            <span className="dispatcher-tab-content">
              <ChefHatFilledIcon className="dispatcher-tab-icon" />
              <span>Cooking</span>
            </span>
            {activeTableStage !== 'cooking' && tableCookingCount > 0 && (
              <span className="dispatcher-tab-badge">{tableCookingCount}</span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTableStage('done')}
            className={`dispatcher-tab-btn ${activeTableStage === 'done' ? 'is-active' : ''}`}
          >
            <span className="dispatcher-tab-content">
              <CheckCircleFilledIcon className="dispatcher-tab-icon" />
              <span>Done</span>
            </span>
            {activeTableStage !== 'done' && tableDoneCount > 0 && (
              <span className="dispatcher-tab-badge">{tableDoneCount}</span>
            )}
          </button>
        </nav>

        {/* Action Controls in Header */}
        <div className="hidden sm:flex absolute right-6 items-center gap-2">
          {undoHistory.length > 0 && (
            <button
              type="button"
              onClick={handleGlobalUndo}
              className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-black flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer active:scale-95"
              title="Undo the most recent item marked done across orders"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span>Undo Last ({undoHistory.length})</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              loadOrders(false)
            }}
            disabled={isLoading}
            className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-black flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer active:scale-95"
            title="Refresh orders"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Main Content Area with Dedicated Background Container */}
      <main className="dispatcher-main-content">
        <div className="dispatcher-orders-container">
          {isLoading && orders.length === 0 ? (
            <div className="dispatcher-loading-state">
              <Loader2 className="w-9 h-9 text-[#14274E] animate-spin mb-3" />
              <span className="font-extrabold text-[#14274E] text-sm">Loading orders...</span>
              <span className="text-slate-400 text-xs mt-0.5">Querying kitchen orders from database</span>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="dispatcher-empty-state">
              <ChefHatFilledIcon className="w-11 h-11 text-slate-300 mb-2" />
              <span className="font-bold text-slate-600 text-sm">No orders in this stage</span>
              <span className="text-slate-400 text-xs mt-0.5">Orders will appear here as they are punched by service.</span>
            </div>
          ) : (
            <div className="dispatcher-orders-grid">
              {filteredOrders.map((order) => {
              const groupedItems = groupOrderItems(order)
              const activeItems = order.items.filter((i) => i.status !== 'CANCELLED')
              const doneCount = activeItems.filter((i) => i.status === 'DONE').length

              return (
                <div
                  key={order.orderId}
                  className="dispatcher-order-card"
                  style={{
                    border: order.labelColor ? `2.5px solid ${order.labelColor}` : '1px solid #e2e8f0',
                    boxShadow: order.labelColor
                      ? `0 4px 16px ${order.labelColor}25, 0 0 0 1px ${order.labelColor}30`
                      : undefined,
                  }}
                >
                  {/* Top Color Accent Strip for VIP/Priority tiers */}
                  {order.labelColor && (
                    <div
                      className="h-1.5 w-full shrink-0"
                      style={{ backgroundColor: order.labelColor }}
                    />
                  )}

                  {/* Card Header */}
                  <div
                    className="dispatcher-order-header"
                    style={{
                      backgroundColor: order.labelColor ? `${order.labelColor}0d` : undefined,
                    }}
                  >
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="dispatcher-order-table">{order.tableDisplay}</h3>
                        {order.labelName && order.labelColor && (
                          <TableLabelBadge
                            name={order.labelName}
                            color={order.labelColor}
                            size="sm"
                            showDot
                          />
                        )}
                      </div>
                      <span className="dispatcher-order-id">Order #{order.orderId}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {activeTableStage === 'cooking' && doneCount > 0 && (
                        <button
                          type="button"
                          onClick={() => handleUndoLastDone(order.orderId)}
                          className="px-2.5 py-1 text-xs font-black text-slate-600 hover:text-rose-700 bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-lg shadow-2xs flex items-center gap-1 transition-all cursor-pointer active:scale-95"
                          title="Undo last completed item piece"
                        >
                          <RotateCcw className="w-3 h-3 text-slate-500" />
                          <span>Undo</span>
                        </button>
                      )}
                      <span className="dispatcher-order-type">{order.orderType || 'DINE-IN'}</span>
                    </div>
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
                      /* ── Cooking Stage: Categorized Containers with Aggregated Items & +1 Done Stepper ── */
                      (() => {
                        const catGroups = new Map<string, GroupedItem[]>()
                        groupedItems.forEach((group) => {
                          const cat = group.categoryName || 'Other'
                          if (!catGroups.has(cat)) catGroups.set(cat, [])
                          catGroups.get(cat)!.push(group)
                        })

                        return Array.from(catGroups.entries()).map(([category, items]) => {
                          // Inside each category, completed items (doneCount === totalQuantity) sink to bottom
                          const sortedItems = [...items].sort((a, b) => {
                            const aDone = a.doneCount === a.totalQuantity ? 1 : 0
                            const bDone = b.doneCount === b.totalQuantity ? 1 : 0
                            if (aDone !== bDone) return aDone - bDone
                            return a.name.localeCompare(b.name)
                          })

                          const catTotalQty = sortedItems.reduce((sum, g) => sum + g.totalQuantity, 0)
                          const catDoneQty = sortedItems.reduce((sum, g) => sum + g.doneCount, 0)

                          return (
                            <div key={category} className="dispatcher-category-container">
                              <div className="dispatcher-category-header">
                                <div className="flex items-center gap-1.5">
                                  <span className="dispatcher-category-badge">{category}</span>
                                  {catDoneQty > 0 && (
                                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-md border border-emerald-300">
                                      {catDoneQty}/{catTotalQty} cooked
                                    </span>
                                  )}
                                </div>
                                <span className="dispatcher-category-count">
                                  {catTotalQty} item{catTotalQty !== 1 ? 's' : ''}
                                </span>
                              </div>

                              <div className="dispatcher-category-items">
                                {sortedItems.map((group, idx) => {
                                  const isAllDone = group.doneCount >= group.totalQuantity
                                  const isPartiallyDone = group.doneCount > 0 && !isAllDone

                                  const zebraClass = isAllDone
                                    ? 'item-row-done bg-emerald-50/50 border-emerald-200'
                                    : isPartiallyDone
                                      ? 'bg-amber-50/40 border-amber-200'
                                      : idx % 2 === 0
                                        ? 'item-row-even bg-white border-slate-200/90'
                                        : 'item-row-odd bg-slate-100/75 border-slate-200'

                                  return (
                                    <div
                                      key={group.itemId}
                                      className={`dispatcher-order-item transition-all duration-200 ${zebraClass}`}
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                          <span
                                            className={`dispatcher-item-name truncate ${
                                              isAllDone ? 'line-through text-slate-400 font-normal' : 'text-[#14274E] font-bold'
                                            }`}
                                          >
                                            {group.name}
                                          </span>
                                          {group.isFlagged && (
                                            <span className="dispatcher-flag-badge shrink-0">
                                              <FlagFilledIcon className="h-2.5 w-2.5" />
                                              Flagged
                                            </span>
                                          )}
                                          {group.totalQuantity > 1 && (
                                            <span
                                              className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-md shrink-0 border ${
                                                isAllDone
                                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                                  : isPartiallyDone
                                                    ? 'bg-amber-100 text-amber-800 border-amber-300'
                                                    : 'bg-slate-100 text-slate-600 border-slate-200'
                                              }`}
                                            >
                                              {group.doneCount}/{group.totalQuantity} ready
                                            </span>
                                          )}
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                          <span className="dispatcher-item-qty">×{group.totalQuantity}</span>
                                          {isAllDone ? (
                                            <div className="px-2.5 py-1.5 rounded-xl text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1 shadow-2xs">
                                              <CheckCircleFilledIcon className="w-3.5 h-3.5 text-emerald-600" />
                                              <span>Done</span>
                                            </div>
                                          ) : (
                                            <button
                                              type="button"
                                              onClick={() => handleMarkOnePieceDone(order.orderId, group.itemId)}
                                              className="px-2.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1 cursor-pointer bg-white hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 text-slate-700 border border-slate-200 shadow-2xs active:scale-95"
                                              title={
                                                group.totalQuantity > 1
                                                  ? `Mark 1 ${group.name} as done (${group.doneCount + 1}/${group.totalQuantity})`
                                                  : `Mark ${group.name} as done`
                                              }
                                            >
                                              <CheckmarkFilledIcon className="w-3.5 h-3.5 text-slate-400" />
                                              <span>
                                                {group.totalQuantity > 1 ? `+1 Done` : 'Mark Done'}
                                              </span>
                                            </button>
                                          )}
                                        </div>
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
                                              <FlagFilledIcon className="h-2.5 w-2.5" />
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
                                              <FlagFilledIcon className="w-2.5 h-2.5" />
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
                          <XCircleFilledIcon className="w-4 h-4" />
                          <span>Flag / Reject</span>
                        </button>
                        <button
                          onClick={() => handleMoveToCooking(order.orderId)}
                          className="w-full py-2.5 rounded-xl bg-[#14274E] hover:bg-[#203c73] text-white text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
                        >
                          <ChefHatFilledIcon className="w-4 h-4 text-[#E9C46A]" />
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
                        <div className="flex items-center gap-2">
                          {doneCount > 0 && (
                            <button
                              type="button"
                              onClick={() => handleUndoLastDone(order.orderId)}
                              className="py-2 px-3 rounded-xl text-xs font-black border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs active:scale-95 shrink-0"
                              title="Undo last completed piece"
                            >
                              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                              <span>Undo</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleMarkAllDone(order.orderId)}
                            className="flex-1 py-2 rounded-xl text-xs font-bold border border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100 text-emerald-800 flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs active:scale-95"
                            title="Mark all remaining items as done and move order to Done"
                          >
                            <CheckCircleFilledIcon className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Mark All Done →</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {activeTableStage === 'done' && (
                      <div className="flex items-center gap-2 w-full">
                        <button
                          type="button"
                          onClick={() => handleUndoOrderToCooking(order.orderId)}
                          className="py-2.5 px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs active:scale-95 shrink-0"
                          title="Move order back to Cooking tab"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                          <span>Undo</span>
                        </button>
                        <button
                          onClick={() => handleMoveToCompleted(order.orderId)}
                          className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
                        >
                          <CheckCircleFilledIcon className="w-4 h-4" />
                          <span>Mark as Complete →</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
            </div>
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
