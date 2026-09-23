import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Loader2, RefreshCw, RotateCcw } from 'lucide-react'
import {
  ClockFilledIcon,
  ChefHatFilledIcon,
  CheckCircleFilledIcon,
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

  // Optimistic tracking refs to guard against stale database fetch overrides during rapid clicking
  const OPTIMISTIC_TTL_MS = 6000
  const optimisticOrderStatusesRef = useRef<Map<number, { status: string; expiresAt: number }>>(new Map())
  const optimisticItemStatusesRef = useRef<Map<number, { status: string; expiresAt: number }>>(new Map())
  const optimisticFlagsRef = useRef<Map<string, { isFlagged: boolean; expiresAt: number }>>(new Map())
  const currentlyRejectedRef = useRef<Map<number, number>>(new Map())
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Tables mode data & state
  const [orders, setOrders] = useState<DispatcherOrder[]>([])
  const ordersRef = useRef<DispatcherOrder[]>([])
  const [activeTableStage, setActiveTableStage] = useState<TableStage>('preparing')
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

  // Helper to merge and apply active optimistic overrides onto raw database order data
  const applyOptimisticOverrides = useCallback((orderList: DispatcherOrder[]): DispatcherOrder[] => {
    const now = Date.now()

    // Clean up expired entries
    for (const [orderId, expiresAt] of currentlyRejectedRef.current.entries()) {
      if (expiresAt < now) currentlyRejectedRef.current.delete(orderId)
    }
    for (const [orderId, data] of optimisticOrderStatusesRef.current.entries()) {
      if (data.expiresAt < now) optimisticOrderStatusesRef.current.delete(orderId)
    }
    for (const [orderItemId, data] of optimisticItemStatusesRef.current.entries()) {
      if (data.expiresAt < now) optimisticItemStatusesRef.current.delete(orderItemId)
    }
    for (const [flagKey, data] of optimisticFlagsRef.current.entries()) {
      if (data.expiresAt < now) optimisticFlagsRef.current.delete(flagKey)
    }

    // Filter out rejected orders
    const nonRejected = orderList.filter((order) => !currentlyRejectedRef.current.has(order.orderId))

    // Apply active overrides
    return nonRejected.map((order) => {
      let orderStatus = order.orderStatus
      const orderOverride = optimisticOrderStatusesRef.current.get(order.orderId)
      if (orderOverride) {
        orderStatus = orderOverride.status
      }

      const items = order.items.map((item) => {
        let status = item.status
        let isFlagged = item.isFlagged

        const itemStatusOverride = optimisticItemStatusesRef.current.get(item.orderItemId)
        if (itemStatusOverride) {
          status = itemStatusOverride.status
        }

        const flagKey = `${order.orderId}_${item.itemId}`
        const flagOverride = optimisticFlagsRef.current.get(flagKey)
        if (flagOverride) {
          isFlagged = flagOverride.isFlagged
        }

        return {
          ...item,
          status,
          isFlagged,
        }
      })

      return {
        ...order,
        orderStatus,
        items,
      }
    })
  }, [])

  // ── 1. Fetch Table Orders ──
  const loadOrders = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true)
    try {
      const data = await fetchDispatcherOrders()
      if (isMounted.current) {
        const nextOrders = applyOptimisticOverrides(data)
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
      if (isMounted.current && !silent) showToast('Failed to load orders', 'error')
    } finally {
      if (isMounted.current && !silent) setIsLoading(false)
    }
  }, [applyOptimisticOverrides])

  // Debounced loadOrders for Realtime and external event triggers to avoid race-conditions on fast clicks
  const debouncedLoadOrders = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    debounceTimerRef.current = setTimeout(() => {
      void loadOrders(true)
    }, 400)
  }, [loadOrders])

  // Initial loads and Realtime
  useEffect(() => {
    isMounted.current = true
    loadOrders(false)

    // Event bus listener for same-tab and cross-tab triggers
    const unsubscribeBus = subscribeToOrderUpdates((detail) => {
      if (!detail?.type || detail.type === 'tables' || detail.type === 'all' || detail.type === 'table_label_changed') {
        debouncedLoadOrders()
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
        debouncedLoadOrders,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'orders', table: 'Order_Items' },
        debouncedLoadOrders,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'tables', table: 'Restaurant_Tables' },
        debouncedLoadOrders,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'tables', table: 'Table_Labels' },
        debouncedLoadOrders,
      )
      .subscribe()

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      unsubscribeBus()
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus)
      window.removeEventListener('focus', handleVisibilityOrFocus)
      void supabase.removeChannel(ordersChannel)
    }
  }, [loadOrders, debouncedLoadOrders])

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

  // ── Toggle Individual Item Done Handler (Optimistic & Resilient) ──
  // ── Mark 1 Piece of an Item Group as Done ──
  async function handleMarkOnePieceDone(orderId: number, itemId: string) {
    const now = Date.now()
    let affectedOrderItemId: number | null = null
    let itemName = ''
    let isAllDoneNow = false

    setOrders((currentOrders) => {
      const order = currentOrders.find((o) => o.orderId === orderId)
      if (!order) return currentOrders

      // Find the first active undone item matching this itemId
      const undoneItem = order.items.find(
        (it) => it.itemId === itemId && it.status !== 'DONE' && it.status !== 'CANCELLED',
      )
      if (!undoneItem) return currentOrders

      affectedOrderItemId = undoneItem.orderItemId
      itemName = undoneItem.name

      // Record optimistic item status
      optimisticItemStatusesRef.current.set(affectedOrderItemId, {
        status: 'DONE',
        expiresAt: now + OPTIMISTIC_TTL_MS,
      })

      const updatedItems = order.items.map((it) =>
        it.orderItemId === affectedOrderItemId ? { ...it, status: 'DONE' } : it,
      )

      // Check if ALL active items in this order are now marked DONE
      const activeItems = updatedItems.filter((i) => i.status !== 'CANCELLED')
      isAllDoneNow = activeItems.length > 0 && activeItems.every((i) => i.status === 'DONE')

      let nextOrderStatus = order.orderStatus
      if (isAllDoneNow) {
        nextOrderStatus = 'READY'
        optimisticOrderStatusesRef.current.set(orderId, {
          status: 'READY',
          expiresAt: now + OPTIMISTIC_TTL_MS,
        })
      }

      return currentOrders.map((ord) =>
        ord.orderId === orderId
          ? {
              ...ord,
              orderStatus: nextOrderStatus,
              items: updatedItems,
            }
          : ord,
      )
    })

    if (!affectedOrderItemId) return

    const finalItemId = affectedOrderItemId as number

    // Track in undoHistory
    setUndoHistory((prev) => [
      ...prev.filter((h) => h.orderItemId !== finalItemId),
      { orderId, orderItemId: finalItemId, itemId, itemName, timestamp: now },
    ])

    if (isAllDoneNow) {
      showToast(`Order #${orderId} completed → Moved to Done tab!`, 'success')
      try {
        await updateOrderItemStatus(finalItemId, 'DONE')
        await moveOrderToReady(orderId)
      } catch (err) {
        console.error('Failed to auto-move order to ready:', err)
        optimisticItemStatusesRef.current.delete(finalItemId)
        optimisticOrderStatusesRef.current.delete(orderId)
        showToast('Failed to move order to Done', 'error')
        void loadOrders(true)
      }
    } else {
      showToast(`Marked 1 ${itemName} as done`, 'info')
      try {
        await updateOrderItemStatus(finalItemId, 'DONE')
      } catch (err) {
        console.error('Failed to update item status:', err)
        optimisticItemStatusesRef.current.delete(finalItemId)
        showToast('Failed to update item', 'error')
        void loadOrders(true)
      }
    }
  }

  // ── Undo Last Marked Done Item for Order ──
  async function handleUndoLastDone(orderId: number) {
    const now = Date.now()
    let itemToRevert: number | null = null
    let itemName = 'item'

    setOrders((currentOrders) => {
      const order = currentOrders.find((o) => o.orderId === orderId)
      if (!order) return currentOrders

      // 1. Check if there is an entry in undoHistory for this order
      const historyForOrder = undoHistory.filter((h) => h.orderId === orderId)
      if (historyForOrder.length > 0) {
        const lastAction = historyForOrder[historyForOrder.length - 1]
        const it = order.items.find((i) => i.orderItemId === lastAction.orderItemId)
        if (it && it.status === 'DONE') {
          itemToRevert = lastAction.orderItemId
        }
      }

      // 2. Fallback: find the last active item with status === 'DONE'
      if (!itemToRevert) {
        const doneItems = order.items.filter((i) => i.status === 'DONE' && i.status !== 'CANCELLED')
        if (doneItems.length > 0) {
          itemToRevert = doneItems[doneItems.length - 1].orderItemId
        }
      }

      if (!itemToRevert) return currentOrders

      const itemObj = order.items.find((i) => i.orderItemId === itemToRevert)
      itemName = itemObj?.name || 'item'

      // Record optimistic status overrides
      optimisticItemStatusesRef.current.set(itemToRevert, {
        status: 'COOKING',
        expiresAt: now + OPTIMISTIC_TTL_MS,
      })
      optimisticOrderStatusesRef.current.set(orderId, {
        status: 'PREPARING',
        expiresAt: now + OPTIMISTIC_TTL_MS,
      })

      return currentOrders.map((ord) => {
        if (ord.orderId !== orderId) return ord
        return {
          ...ord,
          orderStatus: 'PREPARING',
          items: ord.items.map((it) =>
            it.orderItemId === itemToRevert ? { ...it, status: 'COOKING' } : it,
          ),
        }
      })
    })

    if (!itemToRevert) {
      showToast('No items to undo', 'info')
      return
    }

    const finalRevertId = itemToRevert as number

    // Remove from undoHistory
    setUndoHistory((prev) => prev.filter((h) => h.orderItemId !== finalRevertId))
    showToast(`Reverted 1 ${itemName} to cooking`, 'info')

    try {
      await updateOrderItemStatus(finalRevertId, 'COOKING')
      const targetOrder = ordersRef.current.find((o) => o.orderId === orderId)
      if (targetOrder?.orderStatus === 'READY') {
        await supabase
          .from('Restaurant_Orders')
          .update({ ORDER_STATUS: 'PREPARING' })
          .eq('ORDER_ID', orderId)
      }
    } catch (err) {
      console.error('Failed to undo item:', err)
      optimisticItemStatusesRef.current.delete(finalRevertId)
      optimisticOrderStatusesRef.current.delete(orderId)
      showToast('Failed to undo item', 'error')
      void loadOrders(true)
    }
  }

  // ── Return Order from Done Back to Cooking ──
  async function handleUndoOrderToCooking(orderId: number) {
    const now = Date.now()

    optimisticOrderStatusesRef.current.set(orderId, {
      status: 'PREPARING',
      expiresAt: now + OPTIMISTIC_TTL_MS,
    })

    setOrders((currentOrders) =>
      currentOrders.map((ord) => {
        if (ord.orderId !== orderId) return ord
        ord.items.forEach((it) => {
          if (it.status !== 'CANCELLED') {
            optimisticItemStatusesRef.current.set(it.orderItemId, {
              status: 'COOKING',
              expiresAt: now + OPTIMISTIC_TTL_MS,
            })
          }
        })
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
    } catch (err) {
      console.error('Failed to return order to cooking:', err)
      optimisticOrderStatusesRef.current.delete(orderId)
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
    const now = Date.now()

    optimisticOrderStatusesRef.current.set(orderId, {
      status: 'READY',
      expiresAt: now + OPTIMISTIC_TTL_MS,
    })

    setOrders((prev) =>
      prev.map((o) => {
        if (o.orderId !== orderId) return o
        o.items.forEach((it) => {
          if (it.status !== 'CANCELLED') {
            optimisticItemStatusesRef.current.set(it.orderItemId, {
              status: 'DONE',
              expiresAt: now + OPTIMISTIC_TTL_MS,
            })
          }
        })
        return {
          ...o,
          orderStatus: 'READY',
          items: o.items.map((it) => (it.status === 'CANCELLED' ? it : { ...it, status: 'DONE' })),
        }
      }),
    )
    showToast(`Order #${orderId} completed → Moved to Done tab!`, 'success')

    try {
      await moveOrderToReady(orderId)
    } catch (err) {
      console.error('Failed to move order to ready:', err)
      optimisticOrderStatusesRef.current.delete(orderId)
      showToast('Failed to move order to Done', 'error')
      void loadOrders(true)
    }
  }

  function handleMoveToCooking(orderId: number) {
    const now = Date.now()
    optimisticOrderStatusesRef.current.set(orderId, {
      status: 'PREPARING',
      expiresAt: now + OPTIMISTIC_TTL_MS,
    })

    setOrders((currentOrders) =>
      currentOrders.map((order) => {
        if (order.orderId !== orderId) return order
        order.items.forEach((item) => {
          if (item.status === 'PENDING') {
            optimisticItemStatusesRef.current.set(item.orderItemId, {
              status: 'COOKING',
              expiresAt: now + OPTIMISTIC_TTL_MS,
            })
          }
        })
        return {
          ...order,
          orderStatus: 'PREPARING',
          items: order.items.map((item) => (item.status === 'PENDING' ? { ...item, status: 'COOKING' } : item)),
        }
      }),
    )
    showToast('Order moved to cooking', 'success')

    void moveOrderToCooking(orderId).catch((err) => {
      console.error('Failed to persist cooking status:', err)
      optimisticOrderStatusesRef.current.delete(orderId)
      showToast('Failed to move order', 'error')
      void loadOrders(true)
    })
  }

  function handleMoveToCompleted(orderId: number) {
    const now = Date.now()
    optimisticOrderStatusesRef.current.set(orderId, {
      status: 'COMPLETED',
      expiresAt: now + OPTIMISTIC_TTL_MS,
    })

    setOrders((currentOrders) =>
      currentOrders.map((order) => {
        if (order.orderId !== orderId) return order
        order.items.forEach((item) => {
          if (item.status !== 'CANCELLED') {
            optimisticItemStatusesRef.current.set(item.orderItemId, {
              status: 'DONE',
              expiresAt: now + OPTIMISTIC_TTL_MS,
            })
          }
        })
        return {
          ...order,
          orderStatus: 'COMPLETED',
          items: order.items.map((item) => (item.status === 'CANCELLED' ? item : { ...item, status: 'DONE' })),
        }
      }),
    )
    showToast('Order marked as complete → Sent to Cashier', 'success')

    void moveOrderToCompleted(orderId).catch((err) => {
      console.error('Failed to persist completed status:', err)
      optimisticOrderStatusesRef.current.delete(orderId)
      showToast('Failed to complete order', 'error')
      void loadOrders(true)
    })
  }

  // ── Fast Optimistic Item Flag Handler ──
  function handleToggleItemFlag(orderId: number, itemId: string, flag: boolean) {
    const now = Date.now()
    const flagKey = `${orderId}_${itemId}`

    optimisticFlagsRef.current.set(flagKey, {
      isFlagged: flag,
      expiresAt: now + OPTIMISTIC_TTL_MS,
    })

    setOrders((currentOrders) =>
      currentOrders.map((ord) => {
        if (ord.orderId !== orderId) return ord
        return {
          ...ord,
          items: ord.items.map((it) =>
            it.itemId === itemId ? { ...it, isFlagged: flag } : it,
          ),
        }
      }),
    )
    showToast(flag ? 'Item flagged as unavailable' : 'Item unflagged', 'info')

    void flagOrderItems(orderId, [itemId], flag).catch((err) => {
      console.error('[Dispatcher] toggleItemFlag error:', err)
      optimisticFlagsRef.current.delete(flagKey)
      showToast('Failed to update item flag', 'error')
      void loadOrders(true)
    })
  }

  // ── Fast Optimistic Reject Handler ──
  function handleRejectOrder(note: string, flaggedItemIds: string[]) {
    if (!rejectingOrder) return

    const orderId = rejectingOrder.orderId
    const targetOrder = rejectingOrder
    const now = Date.now()

    // Optimistically remove from UI right away without waiting for database queries
    currentlyRejectedRef.current.set(orderId, now + OPTIMISTIC_TTL_MS)
    setOrders((prev) => prev.filter((o) => o.orderId !== orderId))
    setRejectingOrder(null)
    showToast('Order rejected & items flagged', 'success')

    // Run backend mutations asynchronously in the background
    void (async () => {
      try {
        if (note?.trim()) {
          try {
            await saveDispatcherNote(orderId, note.trim())
          } catch {
            // Ignore note error
          }
        }

        if (flaggedItemIds.length > 0) {
          await flagOrderItems(orderId, flaggedItemIds, true)
        }

        const activeItems = targetOrder.items.filter((i) => i.status !== 'CANCELLED')
        const rejections = activeItems.map((item) => ({
          orderItemId: item.orderItemId,
          itemId: item.itemId,
          reason: 'unavailable',
        }))

        if (rejections.length > 0) {
          await rejectOrderItems(orderId, rejections)
        }
      } catch (err) {
        console.error('Failed to reject order in background:', err)
        currentlyRejectedRef.current.delete(orderId)
        showToast('Failed to reject order', 'error')
        void loadOrders(true)
      }
    })()
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
                  style={
                    order.labelColor
                      ? {
                          borderColor: order.labelColor,
                        }
                      : undefined
                  }
                >
                  {/* Overlapping Floating Hierarchy Label on Card Border */}
                  {order.labelName && order.labelColor && (
                    <div
                      className="dispatcher-card-floating-badge"
                      style={{ backgroundColor: order.labelColor }}
                    >
                      <span>{order.labelName}</span>
                    </div>
                  )}

                  {/* Card Header */}
                  <div
                    className="dispatcher-order-header"
                    style={
                      order.labelColor
                        ? {
                            borderBottomColor: order.labelColor,
                          }
                        : undefined
                    }
                  >
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="dispatcher-order-table">{order.tableDisplay}</h3>
                      </div>
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
                      /* ── Cooking Stage: Clean Categorized Sections with +1 Done Stepper ── */
                      (() => {
                        const catGroups = new Map<string, GroupedItem[]>()
                        groupedItems.forEach((group) => {
                          const cat = group.categoryName || 'Other'
                          if (!catGroups.has(cat)) catGroups.set(cat, [])
                          catGroups.get(cat)!.push(group)
                        })

                        const sortedCategories = Array.from(catGroups.entries()).sort((a, b) =>
                          a[0].localeCompare(b[0]),
                        )

                        return sortedCategories.map(([category, items]) => {
                          // Inside each category, completed items (doneCount === totalQuantity) sink to bottom
                          const sortedItems = [...items].sort((a, b) => {
                            const aDone = a.doneCount === a.totalQuantity ? 1 : 0
                            const bDone = b.doneCount === b.totalQuantity ? 1 : 0
                            if (aDone !== bDone) return aDone - bDone
                            return a.name.localeCompare(b.name)
                          })

                          return (
                            <div key={category} className="dispatcher-category-section">
                              <div className="dispatcher-category-header">
                                <span className="dispatcher-category-badge">{category}</span>
                              </div>

                              <div className="dispatcher-category-items">
                                {sortedItems.map((group) => {
                                  const remainingQuantity = Math.max(0, group.totalQuantity - group.doneCount)
                                  const isAllDone = remainingQuantity === 0

                                  return (
                                    <div
                                      key={group.itemId}
                                      className={`dispatcher-order-item ${isAllDone ? 'item-row-done' : ''}`}
                                    >
                                      <div className="flex items-center justify-between gap-2 w-full">
                                        <div className="flex flex-col min-w-0 flex-1">
                                          <span
                                            className={`dispatcher-item-name ${
                                              isAllDone
                                                ? 'line-through text-slate-400 font-medium'
                                                : 'text-[#0f1d3a]'
                                            }`}
                                          >
                                            {group.name}
                                          </span>
                                        </div>

                                        <div className="flex items-center gap-1.5 shrink-0">
                                          <span className="dispatcher-item-qty">
                                            ×{isAllDone ? 0 : remainingQuantity}
                                          </span>
                                          {isAllDone ? (
                                            <div className="px-2.5 py-1 rounded-lg text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center justify-center">
                                              <span>Done</span>
                                            </div>
                                          ) : (
                                            <button
                                              type="button"
                                              onClick={() => handleMarkOnePieceDone(order.orderId, group.itemId)}
                                              className="px-2.5 py-1 rounded-lg text-xs font-black transition-all flex items-center justify-center cursor-pointer bg-white hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 text-slate-700 border border-slate-200 shadow-2xs active:scale-95"
                                              title={`Mark 1 ${group.name} as done`}
                                            >
                                              <span>Done</span>
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
                      /* ── Requested & Done Stages: Clean Categorized Sections ── */
                      (() => {
                        const catGroups = new Map<string, GroupedItem[]>()
                        groupedItems.forEach((group) => {
                          const cat = group.categoryName || 'Other'
                          if (!catGroups.has(cat)) catGroups.set(cat, [])
                          catGroups.get(cat)!.push(group)
                        })

                        const sortedCategories = Array.from(catGroups.entries()).sort((a, b) =>
                          a[0].localeCompare(b[0]),
                        )

                        return sortedCategories.map(([category, items]) => {
                          const sortedItems = [...items].sort((a, b) => a.name.localeCompare(b.name))

                          return (
                            <div key={category} className="dispatcher-category-section">
                              <div className="dispatcher-category-header">
                                <span className="dispatcher-category-badge">{category}</span>
                              </div>

                              <div className="dispatcher-category-items">
                                {sortedItems.map((group) => {
                                  return (
                                    <div key={group.itemId} className="dispatcher-order-item">
                                      <div className="flex items-center justify-between gap-2 w-full">
                                        <span className="dispatcher-item-name">
                                          {group.name}
                                        </span>

                                        <div className="flex items-center gap-1.5 shrink-0">
                                          {activeTableStage === 'preparing' && (
                                            <button
                                              type="button"
                                              onClick={() =>
                                                handleToggleItemFlag(order.orderId, group.itemId, !group.isFlagged)
                                              }
                                              className={[
                                                'w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer border',
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
                                              <FlagFilledIcon className="w-3.5 h-3.5" />
                                            </button>
                                          )}
                                          <span className="dispatcher-item-qty">×{group.totalQuantity}</span>
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
                    )}
                  </div>

                  {/* Card Actions / State Transitions */}
                  <div className="dispatcher-order-actions">
                    {activeTableStage === 'preparing' && (
                      (() => {
                        const hasFlaggedItems = order.items.some(
                          (item) => item.status !== 'CANCELLED' && item.isFlagged,
                        )

                        return (
                          <>
                            <button
                              onClick={() => setRejectingOrder(order)}
                              className="dispatcher-reject-action-btn"
                            >
                              <XCircleFilledIcon className="w-4 h-4" />
                              <span>Reject Order</span>
                            </button>
                            <button
                              onClick={() => handleMoveToCooking(order.orderId)}
                              disabled={hasFlaggedItems}
                              className="flex-1 py-2.5 px-3 rounded-xl bg-[#14274E] hover:bg-[#203c73] disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed disabled:shadow-none text-white text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs whitespace-nowrap active:scale-98"
                              title={
                                hasFlaggedItems
                                  ? 'Resolve or reject flagged items before cooking'
                                  : 'Start Cooking'
                              }
                            >
                              <ChefHatFilledIcon
                                className={`w-4 h-4 ${hasFlaggedItems ? 'text-slate-400' : 'text-[#E9C46A]'}`}
                              />
                              <span>Start Cooking</span>
                            </button>
                          </>
                        )
                      })()
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
