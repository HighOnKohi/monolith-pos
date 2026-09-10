import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  Clock,
  ChefHat,
  RefreshCw,
  Plus,
  Minus,
  CheckCircle,
  LayoutGrid,
  Ticket,
  ListFilter,
  Flame,
  CheckCircle2,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  fetchDispatcherOrders,
  moveOrderToCooking,
  moveOrderToReady,
  moveOrderToCompleted,
  updateItemCookingCount,
  fetchDispatcherTicketOrders,
  startCookingTicketDish,
  cookAllRequestedTickets,
  updateTicketDishCookingCount,
  markTicketDishDone,
  subscribeToOrderUpdates,
  type DispatcherOrder,
  type DispatcherTicketOrder,
} from '@/services/dispatcherService'

type TableStage = 'preparing' | 'cooking' | 'done'
type TicketStage = 'requested' | 'preparing'
type DispatcherMode = 'tables' | 'tickets'

interface GroupedItem {
  itemId: string
  name: string
  totalQuantity: number
  cookingCount: number
  doneCount: number
  orderItemIds: number[]
}

interface AggregatedTicketDish {
  name: string
  totalQuantity: number
  cookingCount: number
  doneCount: number
  orderItemIds: number[]
  ticketIds: number[]
  isGroup?: boolean
  includedItems?: Array<{ id: number; name: string }>
  subItems?: Array<{
    id?: number
    name: string
    totalQuantity: number
    cookingCount: number
    doneCount: number
  }>
  sources: Array<{
    ticketId: number
    registeredName: string | null
    timeOfArrival: string | null
    total: number
    cookingCount: number
    doneCount: number
    orderItemIds: number[]
  }>
}

interface CompactDishSummary {
  name: string
  totalQuantity: number
  sources: Array<{ label: string; count: number }>
}

export default function DispatcherInterface() {
  const isMounted = useRef(true)
  useEffect(() => {
    return () => {
      isMounted.current = false
    }
  }, [])

  // Mode state: 'tables' vs 'tickets'
  const [dispatcherMode, setDispatcherMode] = useState<DispatcherMode>('tables')
  const [isCompactView, setIsCompactView] = useState(false)

  // Tables mode data & state
  const [orders, setOrders] = useState<DispatcherOrder[]>([])
  const ordersRef = useRef<DispatcherOrder[]>([])
  const [localCookingCounts, setLocalCookingCounts] = useState(new Map<string, number>())
  const [activeTableStage, setActiveTableStage] = useState<TableStage>('preparing')
  const currentlyRejectedRef = useRef(new Set<number>())

  // Tickets mode data & state
  const [tickets, setTickets] = useState<DispatcherTicketOrder[]>([])
  const [localTicketCookingCounts, setLocalTicketCookingCounts] = useState(new Map<string, number>())
  const [localGroupSubItemCookingCounts, setLocalGroupSubItemCookingCounts] = useState(new Map<string, number>())
  const [activeTicketStage, setActiveTicketStage] = useState<TicketStage>('requested')

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

  // ── 2. Fetch Ticket Orders ──
  const loadTickets = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true)
    try {
      const data = await fetchDispatcherTicketOrders()
      if (isMounted.current) {
        setTickets(data)
      }
    } catch (err) {
      console.error('Failed to load dispatcher tickets:', err)
      if (isMounted.current) showToast('Failed to load tickets', 'error')
    } finally {
      if (isMounted.current && !silent) setIsLoading(false)
    }
  }, [])

  // Initial loads and Realtime
  useEffect(() => {
    isMounted.current = true
    loadOrders(false)
    loadTickets(false)

    // Event bus listener for same-tab and cross-tab triggers
    const unsubscribeBus = subscribeToOrderUpdates((detail) => {
      if (!detail?.type || detail.type === 'tables' || detail.type === 'all') {
        void loadOrders(true)
      }
      if (!detail?.type || detail.type === 'tickets' || detail.type === 'all') {
        void loadTickets(true)
      }
    })

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        loadOrders(true)
        loadTickets(true)
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

    const ticketsChannel = supabase
      .channel('dispatcher-tickets-realtime-sub')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'Ticket_Orders' },
        () => loadTickets(true),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'Ticket_Order_Items' },
        () => loadTickets(true),
      )
      .subscribe()

    return () => {
      unsubscribeBus()
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus)
      window.removeEventListener('focus', handleVisibilityOrFocus)
      void supabase.removeChannel(ordersChannel)
      void supabase.removeChannel(ticketsChannel)
    }
  }, [loadOrders, loadTickets])

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

  // ── Aggregated Item-Centric Ticket Dishes across Tabs ──
  const aggregatedTicketDishes = useMemo<AggregatedTicketDish[]>(() => {
    const map = new Map<
      string,
      {
        name: string
        totalQuantity: number
        cookingCount: number
        doneCount: number
        orderItemIds: number[]
        ticketIds: Set<number>
        isGroup: boolean
        includedItems: Array<{ id: number; name: string }>
        sourcesMap: Map<
          number,
          {
            ticketId: number
            registeredName: string | null
            timeOfArrival: string | null
            total: number
            cookingCount: number
            doneCount: number
            orderItemIds: number[]
          }
        >
      }
    >()

    tickets.forEach((ticket) => {
      ticket.items.forEach((item) => {
        // Tab filtering based strictly on item.status:
        if (activeTicketStage === 'requested' && item.status !== 'REQUESTED') return
        if (activeTicketStage === 'preparing' && item.status !== 'PREPARING') return

        const name = item.name
        if (!map.has(name)) {
          map.set(name, {
            name,
            totalQuantity: 0,
            cookingCount: 0,
            doneCount: 0,
            orderItemIds: [],
            ticketIds: new Set(),
            isGroup: Boolean(item.isGroup),
            includedItems: item.includedItems ?? [],
            sourcesMap: new Map(),
          })
        }
        const entry = map.get(name)!
        entry.totalQuantity += 1
        entry.orderItemIds.push(item.ticketOrderItemId)
        entry.ticketIds.add(ticket.ticketId)
        entry.cookingCount += 1

        if (!entry.sourcesMap.has(ticket.ticketId)) {
          entry.sourcesMap.set(ticket.ticketId, {
            ticketId: ticket.ticketId,
            registeredName: ticket.registeredName,
            timeOfArrival: ticket.registeredTimeOfArrival,
            total: 0,
            cookingCount: 0,
            doneCount: 0,
            orderItemIds: [],
          })
        }
        const src = entry.sourcesMap.get(ticket.ticketId)!
        src.total += 1
        src.orderItemIds.push(item.ticketOrderItemId)
        src.cookingCount += 1
      })
    })

    // Apply local optimistic cooking counts for preparing stage (for non-group dishes)
    if (activeTicketStage === 'preparing') {
      map.forEach((entry) => {
        if (!entry.isGroup) {
          const localCooking = localTicketCookingCounts.get(entry.name)
          if (localCooking !== undefined) {
            entry.cookingCount = localCooking
            entry.doneCount = entry.totalQuantity - localCooking
          }
        }
      })
    }

    return Array.from(map.values())
      .map((entry) => {
        const subItems =
          entry.isGroup && entry.includedItems && entry.includedItems.length > 0
            ? entry.includedItems.map((inc) => {
                const key = `${entry.name}:${inc.name}`
                const localSubCooking = localGroupSubItemCookingCounts.get(key)
                const subCooking = localSubCooking !== undefined ? localSubCooking : entry.totalQuantity
                const subDone = entry.totalQuantity - subCooking
                return {
                  id: inc.id,
                  name: inc.name,
                  totalQuantity: entry.totalQuantity,
                  cookingCount: subCooking,
                  doneCount: subDone,
                }
              })
            : undefined

        return {
          name: entry.name,
          totalQuantity: entry.totalQuantity,
          cookingCount: entry.cookingCount,
          doneCount: entry.doneCount,
          orderItemIds: entry.orderItemIds,
          ticketIds: Array.from(entry.ticketIds),
          isGroup: entry.isGroup,
          includedItems: entry.includedItems,
          subItems,
          sources: Array.from(entry.sourcesMap.values()),
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [tickets, activeTicketStage, localTicketCookingCounts, localGroupSubItemCookingCounts])

  // ── Compact List Aggregation ──
  const compactSummary = useMemo<CompactDishSummary[]>(() => {
    const dishMap = new Map<string, { total: number; sources: Map<string, number> }>()

    if (dispatcherMode === 'tables') {
      filteredOrders.forEach((order) => {
        const activeItems = order.items.filter((i) => i.status !== 'CANCELLED')
        const label = order.tableDisplay || `Table ${order.tableNum || order.tableId}`
        activeItems.forEach((item) => {
          const name = item.name || `Item #${item.itemId}`
          if (!dishMap.has(name)) {
            dishMap.set(name, { total: 0, sources: new Map() })
          }
          const entry = dishMap.get(name)!
          entry.total += 1
          entry.sources.set(label, (entry.sources.get(label) || 0) + 1)
        })
      })
    } else {
      aggregatedTicketDishes.forEach((dish) => {
        if (!dishMap.has(dish.name)) {
          dishMap.set(dish.name, { total: 0, sources: new Map() })
        }
        const entry = dishMap.get(dish.name)!
        entry.total = dish.totalQuantity
        dish.sources.forEach((src) => {
          const label = `Ticket #${src.ticketId}${src.registeredName ? ` (${src.registeredName})` : ''}`
          entry.sources.set(label, src.total)
        })
      })
    }

    return Array.from(dishMap.entries())
      .map(([name, data]) => ({
        name,
        totalQuantity: data.total,
        sources: Array.from(data.sources.entries()).map(([label, count]) => ({ label, count })),
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [dispatcherMode, filteredOrders, aggregatedTicketDishes])

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

  // ── Ticket Dish-Level Actions & Stepper Handlers ──
  async function handleStartCookingTicketDish(dish: AggregatedTicketDish) {
    try {
      // Optimistically move only this dish's items to PREPARING
      setTickets((currentTickets) =>
        currentTickets.map((t) => {
          if (!dish.ticketIds.includes(t.ticketId)) return t
          return {
            ...t,
            ticketStatus: 'PREPARING',
            items: t.items.map((it) => {
              if (it.name === dish.name && it.status === 'REQUESTED') {
                return { ...it, status: 'PREPARING' }
              }
              return it
            }),
          }
        }),
      )

      showToast(`Started cooking for ${dish.name}!`, 'success')
      await startCookingTicketDish(dish.orderItemIds, dish.ticketIds)
      await loadTickets(true)
    } catch (err: unknown) {
      console.error('Failed to start cooking ticket dish:', err)
      showToast(err instanceof Error ? err.message : 'Failed to start cooking dish', 'error')
    }
  }

  function handleTicketDishCookingCountChange(
    dish: AggregatedTicketDish,
    delta: number,
    event?: React.MouseEvent,
  ) {
    const currentCooking = dish.cookingCount
    let newCooking: number

    // Shift+Click sets to 0 (all done) or max (all cooking)
    if (event?.shiftKey) {
      newCooking = delta < 0 ? 0 : dish.totalQuantity
    } else {
      newCooking = Math.max(0, Math.min(dish.totalQuantity, currentCooking + delta))
    }

    if (newCooking === currentCooking) return

    const newDone = dish.totalQuantity - newCooking

    // Optimistic UI state update: strictly keyed by dish.name
    setLocalTicketCookingCounts((prev) => {
      const next = new Map(prev)
      next.set(dish.name, newCooking)
      return next
    })

    setTickets((currentTickets) => {
      let doneToAllocate = newDone
      return currentTickets.map((t) => {
        if (!dish.ticketIds.includes(t.ticketId)) return t
        return {
          ...t,
          items: t.items.map((it) => {
            if (it.name !== dish.name) return it
            if (doneToAllocate > 0) {
              doneToAllocate--
              return { ...it, status: 'COMPLETED' }
            }
            return { ...it, status: 'PREPARING' }
          }),
        }
      })
    })

    // Persist to database asynchronously
    void updateTicketDishCookingCount(dish.orderItemIds, newDone)
      .then(() => loadTickets(true))
      .catch((err) => {
        console.error('Failed to update ticket dish count:', err)
        showToast('Failed to update dish count', 'error')
      })
  }

  function handleGroupSubItemCookingCountChange(
    dish: AggregatedTicketDish,
    subItemName: string,
    subTotalQty: number,
    delta: number,
    event?: React.MouseEvent,
  ) {
    const key = `${dish.name}:${subItemName}`
    const currentCooking = localGroupSubItemCookingCounts.get(key) ?? subTotalQty
    let newCooking: number

    if (event?.shiftKey) {
      newCooking = delta < 0 ? 0 : subTotalQty
    } else {
      newCooking = Math.max(0, Math.min(subTotalQty, currentCooking + delta))
    }

    if (newCooking === currentCooking) return

    setLocalGroupSubItemCookingCounts((prev) => {
      const next = new Map(prev)
      next.set(key, newCooking)
      return next
    })
  }

  const handleCookAllRequestedTickets = async () => {
    try {
      setLocalTicketCookingCounts(new Map())
      setLocalGroupSubItemCookingCounts(new Map())
      // Optimistically move all requested items to PREPARING
      setTickets((currentTickets) =>
        currentTickets.map((t) => ({
          ...t,
          ticketStatus: 'PREPARING',
          items: t.items.map((it) => (it.status === 'REQUESTED' ? { ...it, status: 'PREPARING' } : it)),
        })),
      )
      await cookAllRequestedTickets()
      showToast('All requested tickets are now cooking!', 'success')
      await loadTickets(true)
      setActiveTicketStage('preparing')
    } catch (err: unknown) {
      console.error('Failed to cook all requested tickets:', err)
      showToast(err instanceof Error ? err.message : 'Failed to cook all tickets', 'error')
    }
  }

  const handleMarkTicketDishDone = async (dish: AggregatedTicketDish) => {
    try {
      setLocalTicketCookingCounts((prev) => {
        const next = new Map(prev)
        next.delete(dish.name)
        return next
      })

      if (dish.isGroup && dish.includedItems) {
        setLocalGroupSubItemCookingCounts((prev) => {
          const next = new Map(prev)
          dish.includedItems?.forEach((inc) => next.delete(`${dish.name}:${inc.name}`))
          return next
        })
      }

      // Optimistically mark only this dish's items as COMPLETED
      setTickets((currentTickets) =>
        currentTickets.map((t) => {
          if (!dish.ticketIds.includes(t.ticketId)) return t
          const updatedItems = t.items.map((it) => {
            if (it.name === dish.name) {
              return { ...it, status: 'COMPLETED' as const }
            }
            return it
          })
          const allDone = updatedItems.every((it) => it.status === 'COMPLETED')
          return {
            ...t,
            ticketStatus: allDone ? 'COMPLETED' : t.ticketStatus,
            items: updatedItems,
          }
        }),
      )

      showToast(`${dish.name} marked as Done!`, 'success')
      await markTicketDishDone(dish.orderItemIds, dish.ticketIds)
      await loadTickets(true)
    } catch (err: unknown) {
      console.error('Failed to mark dish done:', err)
      showToast(err instanceof Error ? err.message : 'Failed to mark dish done', 'error')
    }
  }

  // Counts for Tabs
  const tablePreparingCount = orders.filter((o) => ['REQUESTED', 'VERIFIED'].includes(o.orderStatus)).length
  const tableCookingCount = orders.filter((o) => o.orderStatus === 'PREPARING').length
  const tableDoneCount = orders.filter((o) => ['READY', 'SERVED'].includes(o.orderStatus)).length

  const ticketRequestedDishesCount = tickets
    .reduce((sum, t) => sum + t.items.filter((i) => i.status === 'REQUESTED').length, 0)

  const ticketPreparingDishesCount = tickets
    .reduce((sum, t) => sum + t.items.filter((i) => i.status === 'PREPARING').length, 0)

  const formatArrivalDisplay = (timeStr: string | null) => {
    if (!timeStr) return null
    const parts = timeStr.split(':')
    if (parts.length >= 2) {
      let hh = parseInt(parts[0], 10)
      const mm = parts[1]
      const ampm = hh >= 12 ? 'PM' : 'AM'
      hh = hh % 12 || 12
      return `${hh}:${mm} ${ampm}`
    }
    return timeStr
  }

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
        <div className="flex items-center gap-4">
          <h1 className="dispatcher-title">Dispatcher Interface</h1>

          {/* Mode Switcher: Tables vs Tickets */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 gap-1">
            <button
              onClick={() => {
                setDispatcherMode('tables')
                setIsCompactView(false)
              }}
              className={[
                'px-3.5 py-1.5 rounded-lg text-xs font-black flex items-center gap-2 transition-all cursor-pointer',
                dispatcherMode === 'tables'
                  ? 'bg-[#14274E] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900',
              ].join(' ')}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Tables</span>
            </button>

            <button
              onClick={() => {
                setDispatcherMode('tickets')
                setIsCompactView(false)
              }}
              className={[
                'px-3.5 py-1.5 rounded-lg text-xs font-black flex items-center gap-2 transition-all cursor-pointer',
                dispatcherMode === 'tickets'
                  ? 'bg-[#14274E] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900',
              ].join(' ')}
            >
              <Ticket className="w-3.5 h-3.5 text-[#E9C46A]" />
              <span>Tickets</span>
            </button>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          {/* Cook All Button (Visible in Tickets Mode -> Requested Tab) */}
          {dispatcherMode === 'tickets' && activeTicketStage === 'requested' && ticketRequestedDishesCount > 0 && (
            <button
              onClick={handleCookAllRequestedTickets}
              className="px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 bg-[#14274E] text-[#E9C46A] hover:bg-[#203c73] transition-all cursor-pointer shadow-sm border border-[#E9C46A]/30"
              title="Start cooking for all requested tickets at once"
            >
              <Flame className="w-4 h-4 text-[#E9C46A]" />
              <span>Cook All ({ticketRequestedDishesCount})</span>
            </button>
          )}

          {/* Compact List Button */}
          <button
            onClick={() => setIsCompactView((prev) => !prev)}
            className={[
              'px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border',
              isCompactView
                ? 'bg-[#14274E] text-[#E9C46A] border-[#14274E] shadow-sm'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50',
            ].join(' ')}
            title="Toggle Compact Aggregated List"
          >
            <ListFilter className="w-4 h-4" />
            <span>{isCompactView ? 'Card View' : 'Compact List'}</span>
          </button>

          <button
            onClick={() => {
              loadOrders(false)
              loadTickets(false)
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
        {dispatcherMode === 'tables' ? (
          <>
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
          </>
        ) : (
          <>
            <button
              className={['dispatcher-tab', activeTicketStage === 'requested' ? 'active' : ''].join(' ')}
              onClick={() => setActiveTicketStage('requested')}
            >
              <Clock className="dispatcher-tab-icon" />
              <span className="dispatcher-tab-label">Requested</span>
              <span className="dispatcher-tab-badge">{ticketRequestedDishesCount}</span>
            </button>
            <button
              className={['dispatcher-tab', activeTicketStage === 'preparing' ? 'active' : ''].join(' ')}
              onClick={() => setActiveTicketStage('preparing')}
            >
              <ChefHat className="dispatcher-tab-icon" />
              <span className="dispatcher-tab-label">Cooking</span>
              <span className="dispatcher-tab-badge">{ticketPreparingDishesCount}</span>
            </button>
          </>
        )}
      </div>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        {/* ── Compact List View ── */}
        {isCompactView ? (
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-base font-black text-[#14274E]">
                  Compact Dish Breakdown ({dispatcherMode === 'tables' ? activeTableStage.toUpperCase() : activeTicketStage.toUpperCase()})
                </h3>
                <p className="text-xs text-slate-500">
                  All items aggregated across active {dispatcherMode}. Group meals are shown with their constituent items.
                </p>
              </div>
              <span className="px-3 py-1 rounded-full bg-[#14274E] text-white text-xs font-black">
                {compactSummary.reduce((sum, d) => sum + d.totalQuantity, 0)} Total Dishes
              </span>
            </div>

            {compactSummary.length === 0 ? (
              <div className="py-20 text-center text-slate-400 text-xs">
                No active items needing preparation in this stage.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {compactSummary.map((dish) => (
                  <div
                    key={dish.name}
                    className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between gap-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm sm:text-base font-extrabold text-[#14274E]">
                        {dish.name}
                      </span>
                      <span className="px-2.5 py-1 rounded-xl bg-amber-100 text-amber-900 font-black text-sm">
                        ×{dish.totalQuantity}
                      </span>
                    </div>

                    {/* Sources breakdown */}
                    <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-1.5 text-[11px] text-slate-500">
                      {dish.sources.map((src) => (
                        <span
                          key={src.label}
                          className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold"
                        >
                          {src.label}: <strong>×{src.count}</strong>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : dispatcherMode === 'tables' ? (
          /* ── Tables Mode Order Cards ── */
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
                              <span className="dispatcher-item-qty font-black text-sm text-[#14274E]">
                                ×{group.totalQuantity}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Card Actions */}
                    <div className="dispatcher-order-actions pt-3 border-t border-slate-100">
                      {activeTableStage === 'preparing' && (
                        <button
                          onClick={() => handleMoveToCooking(order.orderId)}
                          className="w-full py-2.5 rounded-xl bg-[#14274E] text-[#E9C46A] text-xs font-black flex items-center justify-center gap-2 hover:bg-[#203c73] transition-all cursor-pointer shadow-xs"
                        >
                          <Flame className="w-4 h-4" />
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
                          <span>{allDone ? 'Mark as Done →' : 'Mark as Done (Pending Items)'}</span>
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
        ) : (
          /* ── Tickets Mode Item-Centric Dish Cards ── */
          <div className="dispatcher-orders-grid">
            {aggregatedTicketDishes.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-400 text-xs">
                <Ticket className="w-10 h-10 text-slate-300 mb-2" />
                <span className="font-bold text-slate-600 text-sm">No items needing preparation in this stage</span>
                <span>Items punched from Ticketing Interface will appear here.</span>
              </div>
            ) : (
              aggregatedTicketDishes.map((dish) => {
                const isGroupAllDone =
                  dish.isGroup && dish.subItems && dish.subItems.length > 0
                    ? dish.subItems.every((s) => s.cookingCount === 0)
                    : false
                const allDone = dish.isGroup ? isGroupAllDone : dish.cookingCount === 0

                return (
                  <div key={dish.name} className="dispatcher-order-card flex flex-col justify-between">
                    {/* Card Header: Dish Name & Total Quantity */}
                    <div>
                      <div className="dispatcher-order-header flex items-center justify-between p-4 bg-white border-b border-slate-100 gap-3">
                        <div className="flex-1 pr-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-lg sm:text-xl font-black text-[#14274E] tracking-tight leading-snug break-words">
                              {dish.name}
                            </h3>
                            {dish.isGroup && (
                              <span className="px-2 py-0.5 rounded-md bg-[#14274E]/10 text-[#14274E] font-black text-[10px] tracking-wide uppercase">
                                Group Meal
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="px-3.5 py-1.5 rounded-xl bg-[#14274E] text-[#E9C46A] font-black text-base sm:text-lg shadow-2xs shrink-0 flex items-center justify-center min-w-[44px]">
                          ×{dish.totalQuantity}
                        </span>
                      </div>

                      {/* Item Details / Cooking Controls */}
                      <div className="p-4 space-y-3">
                        {dish.isGroup ? (
                          /* Group Meal Layout */
                          activeTicketStage === 'requested' ? (
                            /* Requested Stage: List Included Items */
                            <div className="space-y-2">
                              <div className="text-[11px] font-black text-slate-500 uppercase tracking-wider">
                                Included Items
                              </div>
                              <div className="flex flex-col gap-1.5">
                                {dish.includedItems && dish.includedItems.length > 0 ? (
                                  dish.includedItems.map((inc) => (
                                    <div
                                      key={inc.id || inc.name}
                                      className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700"
                                    >
                                      <span>{inc.name}</span>
                                      <span className="text-slate-400 font-extrabold">×{dish.totalQuantity}</span>
                                    </div>
                                  ))
                                ) : (
                                  <span className="text-xs text-slate-400">Standard set components</span>
                                )}
                              </div>
                            </div>
                          ) : (
                            /* Cooking (Preparing) Stage: Individual sub-item steppers */
                            <div className="space-y-2">
                              <div className="text-[11px] font-black text-slate-500 uppercase tracking-wider">
                                Constituent Items Progress
                              </div>
                              <div className="space-y-2">
                                {dish.subItems?.map((sub) => (
                                  <div
                                    key={sub.name}
                                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200"
                                  >
                                    <div className="flex-1 pr-2">
                                      <div className="font-bold text-xs sm:text-sm text-[#14274E] leading-tight">
                                        {sub.name}
                                      </div>
                                      <div className="text-[10px] font-semibold text-slate-400 mt-0.5">
                                        {sub.doneCount}/{sub.totalQuantity} done
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200 shrink-0">
                                      <button
                                        onClick={(e) =>
                                          handleGroupSubItemCookingCountChange(
                                            dish,
                                            sub.name,
                                            sub.totalQuantity,
                                            -1,
                                            e,
                                          )
                                        }
                                        disabled={sub.cookingCount <= 0}
                                        className="w-7 h-7 rounded-md flex items-center justify-center bg-slate-100 hover:bg-slate-200 disabled:opacity-30 text-slate-700 font-bold cursor-pointer transition-all shadow-2xs"
                                        title="Click: -1 | Shift+Click: Set to 0 (All Done)"
                                      >
                                        <Minus className="w-3.5 h-3.5" />
                                      </button>
                                      <span className="w-7 text-center text-xs sm:text-sm font-black text-[#14274E]">
                                        {sub.cookingCount}
                                      </span>
                                      <button
                                        onClick={(e) =>
                                          handleGroupSubItemCookingCountChange(
                                            dish,
                                            sub.name,
                                            sub.totalQuantity,
                                            1,
                                            e,
                                          )
                                        }
                                        disabled={sub.cookingCount >= sub.totalQuantity}
                                        className="w-7 h-7 rounded-md flex items-center justify-center bg-[#14274E] hover:bg-[#203c73] disabled:opacity-30 text-white font-bold cursor-pointer transition-all shadow-2xs"
                                        title="Click: +1 | Shift+Click: Set to Max (All Cooking)"
                                      >
                                        <Plus className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        ) : (
                          /* Regular Item Layout */
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs sm:text-sm font-extrabold text-[#14274E]">
                              {activeTicketStage === 'requested' && 'Pending Cooking'}
                              {activeTicketStage === 'preparing' && 'Cooking Progress'}
                            </span>

                            {activeTicketStage === 'preparing' ? (
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-400">
                                  {dish.doneCount}/{dish.totalQuantity} done
                                </span>
                                <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                                  <button
                                    onClick={(e) => handleTicketDishCookingCountChange(dish, -1, e)}
                                    disabled={dish.cookingCount <= 0}
                                    className="w-7 h-7 rounded-md flex items-center justify-center bg-white hover:bg-slate-200 disabled:opacity-30 text-slate-700 font-bold cursor-pointer transition-all shadow-2xs"
                                    title="Click: -1 | Shift+Click: Set to 0 (All Done)"
                                  >
                                    <Minus className="w-3.5 h-3.5" />
                                  </button>
                                  <span className="w-7 text-center text-sm font-black text-[#14274E]">
                                    {dish.cookingCount}
                                  </span>
                                  <button
                                    onClick={(e) => handleTicketDishCookingCountChange(dish, 1, e)}
                                    disabled={dish.cookingCount >= dish.totalQuantity}
                                    className="w-7 h-7 rounded-md flex items-center justify-center bg-[#14274E] hover:bg-[#203c73] disabled:opacity-30 text-white font-bold cursor-pointer transition-all shadow-2xs"
                                    title="Click: +1 | Shift+Click: Set to Max (All Cooking)"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <span className="font-black text-sm text-[#14274E]">
                                ×{dish.totalQuantity}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="dispatcher-order-actions p-4 pt-3 border-t border-slate-100">
                      {activeTicketStage === 'requested' && (
                        <button
                          onClick={() => handleStartCookingTicketDish(dish)}
                          className="w-full py-2.5 rounded-xl bg-[#14274E] text-[#E9C46A] text-xs font-black flex items-center justify-center gap-2 hover:bg-[#203c73] transition-all cursor-pointer shadow-xs"
                        >
                          <Flame className="w-4 h-4" />
                          <span>Start Cooking ({dish.totalQuantity}) →</span>
                        </button>
                      )}

                      {activeTicketStage === 'preparing' && (
                        <button
                          onClick={() => handleMarkTicketDishDone(dish)}
                          disabled={!allDone}
                          className={[
                            'w-full py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all shadow-xs',
                            allDone
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
                              : 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-75',
                          ].join(' ')}
                          title={allDone ? 'Click to mark dish as done' : 'Cook all items (count to 0) to mark as done'}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>{allDone ? 'Mark as Done →' : 'Mark as Done (Cooking Items Remaining)'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
      </main>
    </div>
  )
}

