import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CreditCard,
  Receipt,
  Users,
  ChevronDown,
  ChevronRight,
  LayoutGrid,
  Ticket,
  Clock,
  Phone,
  User,
  Trash2,
  AlertTriangle,
  X,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { fetchAllTables, fetchOrderSummariesForIds, type TableData } from '@/services/tableService'
import { fetchOrdersByTable, settleTableOrders, deleteOrder } from '@/services/orderService'
import { fetchAllBillRequests, resolveBillOutRequest, updateBillRequestStatus } from '@/services/billService'
import { fetchTicketOrders, settleTicketOrder, deleteTicketOrder } from '@/services/ticketService'
import { subscribeToOrderUpdates, broadcastOrderUpdate } from '@/services/dispatcherService'
import type { BillRequest } from '@/types/bill'
import type { Order, OrderStatus } from '@/types/order'
import type { TicketOrder } from '@/types/ticket'
import { resolveTableGroupByList } from '@/services/tableGroupService'
import { buildReceiptSnapshot, buildTicketReceiptSnapshot } from '@/components/receipt/buildReceipt'
import { ReceiptPreviewModal } from '@/components/receipt/ReceiptPreviewModal'
import type { ReceiptSnapshot } from '@/components/receipt/types'

// Active order statuses displayed in cashier
const ALL_ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  'REQUESTED',
  'VERIFIED',
  'PREPARING',
  'READY',
  'SERVED',
  'COMPLETED',
]
const money = (value: number) => `₱${value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

interface ItemDiscount {
  pwd: boolean
  senior: boolean
  custom: number
}

type CashierMode = 'tables' | 'tickets'

export default function CashierInterface() {
  const [mode, setMode] = useState<CashierMode>('tables')

  // Tables state
  const [tables, setTables] = useState<TableData[]>([])
  const [summaries, setSummaries] = useState<Map<number, { totalBill: number; activeOrderCount: number }>>(new Map())
  const [billRequests, setBillRequests] = useState<BillRequest[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [orders, setOrders] = useState<Order[]>([])

  // Tickets state
  const [tickets, setTickets] = useState<TicketOrder[]>([])
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null)

  // Shared discount & receipt state
  const [itemDiscounts, setItemDiscounts] = useState<Map<string, ItemDiscount>>(new Map())
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [disableAnimation, setDisableAnimation] = useState(false)
  const [applyAllPwd, setApplyAllPwd] = useState(false)
  const [applyAllSenior, setApplyAllSenior] = useState(false)
  const [applyAllCustom, setApplyAllCustom] = useState(0)
  const [receipt, setReceipt] = useState<ReceiptSnapshot | null>(null)
  const [busy, setBusy] = useState(false)
  const [removeBusy, setRemoveBusy] = useState(false)
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const [nextTables, nextRequests, nextTickets] = await Promise.all([
        fetchAllTables(),
        fetchAllBillRequests(),
        fetchTicketOrders(),
      ])
      const nextSummaries = await fetchOrderSummariesForIds(
        nextTables.map((table) => table.TABLE_ID),
        ALL_ACTIVE_ORDER_STATUSES,
      )
      setTables(nextTables)
      setSummaries(nextSummaries)
      setBillRequests(nextRequests)
      setTickets(nextTickets)

      setSelectedId((current) => {
        const valid = current && nextTables.some((table) => table.TABLE_ID === current) ? current : null
        if (valid) {
          const group = resolveTableGroupByList(valid, nextTables)
          void fetchOrdersByTable(group.anchorTableId, ALL_ACTIVE_ORDER_STATUSES, group.memberTableIds)
            .then((updated) => setOrders(updated))
            .catch(() => {})
        } else {
          setOrders([])
        }
        return valid
      })
      setSelectedTicketId((current) =>
        current && nextTickets.some((t) => t.ticketId === current && !t.completedAt)
          ? current
          : null,
      )
    } catch (err) {
      console.error('[CashierInterface] Failed to load data:', err)
      setError('Unable to load cashier data. Please try again.')
    }
  }, [])

  useEffect(() => {
    void load()

    const unsubscribeBus = subscribeToOrderUpdates(() => {
      void load()
    })

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void load()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('focus', handleVisibility)

    const channel = supabase
      .channel('cashier-interface-sync')
      .on('postgres_changes', { event: '*', schema: 'tables', table: 'Restaurant_Tables' }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'orders', table: 'Restaurant_Orders' }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'orders', table: 'Order_Items' }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'orders', table: 'Bill_Requests' }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'tickets', table: 'Ticket_Orders' }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'tickets', table: 'Ticket_Order_Items' }, () => void load())
      .subscribe()

    return () => {
      unsubscribeBus()
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('focus', handleVisibility)
      void supabase.removeChannel(channel)
    }
  }, [load])

  // Tables group calculations
  const groups = useMemo(() => {
    const seen = new Set<number>()
    return tables.flatMap((table) => {
      if (seen.has(table.TABLE_ID)) return []
      const group = resolveTableGroupByList(table.TABLE_ID, tables)
      group.memberTableIds.forEach((id) => seen.add(id))
      const summary = group.memberTableIds.reduce(
        (result, id) => {
          const item = summaries.get(id)
          return {
            totalBill: result.totalBill + (item?.totalBill ?? 0),
            activeOrderCount: result.activeOrderCount + (item?.activeOrderCount ?? 0),
          }
        },
        { totalBill: 0, activeOrderCount: 0 },
      )
      return [{ table, group, summary }]
    })
  }, [tables, summaries])

  // Active Tickets List (all active tickets not yet billed out / settled)
  const activeTickets = useMemo(() => {
    return tickets.filter((t) => !t.completedAt)
  }, [tickets])

  const selectedTableGroup = groups.find(({ group }) => group.anchorTableId === selectedId) ?? null
  const selectedTicket = activeTickets.find((t) => t.ticketId === selectedTicketId) ?? null
  const activeBillRequest = selectedTableGroup
    ? billRequests.find((request) => selectedTableGroup.group.memberTableIds.includes(request.tableId)) ?? null
    : null

  // Dispatcher completion check: tickets and table orders must be COMPLETED in Dispatcher to bill out
  const isTableDispatcherDone = useMemo(() => {
    if (orders.length === 0) return false
    return orders.every((o) => o.orderStatus === 'COMPLETED')
  }, [orders])

  const isTicketDispatcherDone = useMemo(() => {
    if (!selectedTicket) return false
    return selectedTicket.ticketStatus === 'COMPLETED'
  }, [selectedTicket])

  // Active items in current view (tables or tickets)
  const activeItems = useMemo<Array<{
    orderItemId: string
    orderId: number
    name: string
    price: number
    orderType: string
  }>>(() => {
    if (mode === 'tables') {
      return orders
        .filter((order) => order.orderStatus !== 'CANCELLED')
        .flatMap((order) =>
          (order.items ?? [])
            .filter((item) => item.status !== 'CANCELLED')
            .map((item) => ({
              orderItemId: String(item.orderItemId),
              orderId: order.orderId,
              name: item.name ?? `Item #${item.itemId}`,
              price: item.price ?? 0,
              orderType: String(order.orderType),
            })),
        )
    } else {
      if (!selectedTicket) return []
      return (selectedTicket.items ?? []).map((item) => ({
        orderItemId: String(item.ticketOrderItemId),
        orderId: selectedTicket.ticketId,
        name: item.name ?? `Item #${item.ticketOrderItemId}`,
        price: item.price ?? 0,
        orderType: 'TICKET',
      }))
    }
  }, [mode, orders, selectedTicket])

  const groupedItems = useMemo(() => {
    const grouped = new Map<string, typeof activeItems>()
    activeItems.forEach((item) => {
      const existing = grouped.get(item.name)
      if (existing) {
        existing.push(item)
      } else {
        grouped.set(item.name, [item])
      }
    })
    return Array.from(grouped.entries()).map(([name, items]) => ({ name, items }))
  }, [activeItems])

  // Collapse all groups by default when selected target changes
  useEffect(() => {
    if ((selectedTableGroup || selectedTicket) && groupedItems.length > 0) {
      setDisableAnimation(true)
      const allGroupNames = groupedItems.filter((g) => g.items.length > 1).map((g) => g.name)
      setCollapsedGroups(new Set(allGroupNames))
      setTimeout(() => setDisableAnimation(false), 50)
    }
  }, [selectedTableGroup?.group.anchorTableId, selectedTicket?.ticketId, groupedItems])

  // Calculation formulas for subtotal, discounts, VAT, and grand total
  const { subtotal, pwdCount, seniorCount, customTotal, taxableSubtotal, total } = useMemo(() => {
    const baseSubtotal = activeItems.reduce((sum, item) => sum + item.price, 0) / 1.05
    let pwdDiscounts = 0
    let seniorDiscounts = 0
    let customDiscounts = 0
    let pwdApplied = 0
    let seniorApplied = 0

    activeItems.forEach((item) => {
      const discount = itemDiscounts.get(item.orderItemId)
      if (!discount) return
      const itemBase = item.price / 1.05
      if (discount.pwd) {
        pwdDiscounts += itemBase * 0.2
        pwdApplied++
      }
      if (discount.senior) {
        seniorDiscounts += itemBase * 0.2
        seniorApplied++
      }
      if (discount.custom > 0) {
        customDiscounts += itemBase * (Math.min(100, Math.max(0, discount.custom)) / 100)
      }
    })

    const totalDiscount = pwdDiscounts + seniorDiscounts + customDiscounts
    const afterDiscount = Math.max(0, baseSubtotal - totalDiscount)
    const grandTotal = afterDiscount * 1.05

    return {
      subtotal: baseSubtotal,
      pwdCount: pwdApplied,
      seniorCount: seniorApplied,
      customTotal: customDiscounts,
      taxableSubtotal: afterDiscount,
      total: grandTotal,
    }
  }, [activeItems, itemDiscounts])

  async function selectTable(tableId: number) {
    setError('')
    setSelectedId(tableId)
    setSelectedTicketId(null)
    setItemDiscounts(new Map())
    const group = resolveTableGroupByList(tableId, tables)
    try {
      setOrders(await fetchOrdersByTable(group.anchorTableId, ALL_ACTIVE_ORDER_STATUSES, group.memberTableIds))
    } catch (err) {
      console.error('[CashierInterface] Failed to fetch orders:', err)
      setOrders([])
      setError("Unable to load this table's orders.")
    }
  }

  function selectTicket(ticketId: number) {
    setError('')
    setSelectedTicketId(ticketId)
    setSelectedId(null)
    setItemDiscounts(new Map())
  }

  function updateItemDiscount(orderItemId: string, field: keyof ItemDiscount, value: boolean | number) {
    setItemDiscounts((prev) => {
      const next = new Map(prev)
      const current = next.get(orderItemId) ?? { pwd: false, senior: false, custom: 0 }
      next.set(orderItemId, { ...current, [field]: value })
      return next
    })
  }

  function updateGroupDiscount(group: typeof groupedItems[0], field: keyof ItemDiscount, value: boolean | number) {
    setItemDiscounts((prev) => {
      const next = new Map(prev)
      group.items.forEach((item) => {
        const current = next.get(item.orderItemId) ?? { pwd: false, senior: false, custom: 0 }
        next.set(item.orderItemId, { ...current, [field]: value })
      })
      return next
    })
  }

  function getGroupDiscount(group: typeof groupedItems[0], field: keyof ItemDiscount): boolean | number {
    if (group.items.length === 0) return field === 'custom' ? 0 : false
    const firstValue = itemDiscounts.get(group.items[0].orderItemId)?.[field] ?? (field === 'custom' ? 0 : false)
    const allSame = group.items.every((item) => {
      const discount = itemDiscounts.get(item.orderItemId)?.[field] ?? (field === 'custom' ? 0 : false)
      return discount === firstValue
    })
    return allSame ? firstValue : field === 'custom' ? 0 : false
  }

  function toggleGroup(name: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(name)) {
        next.delete(name)
      } else {
        next.add(name)
      }
      return next
    })
  }

  function applyDiscountToAll(field: keyof ItemDiscount, value: boolean | number) {
    setItemDiscounts((prev) => {
      const next = new Map(prev)
      activeItems.forEach((item) => {
        const current = next.get(item.orderItemId) ?? { pwd: false, senior: false, custom: 0 }
        next.set(item.orderItemId, { ...current, [field]: value })
      })
      return next
    })
  }

  async function settleTable() {
    if (!selectedTableGroup || orders.length === 0) return
    setBusy(true)
    setError('')
    const snapshot = buildReceiptSnapshot({
      tableOrders: orders.filter((order) => order.orderStatus !== 'CANCELLED'),
      discountType: 'none',
      customPercent: 0,
      activeBillRequest,
      tableId: selectedTableGroup.group.anchorTableId,
      tableNum: selectedTableGroup.group.anchorTableNum,
    })
    const previousTables = tables
    const previousSummaries = summaries
    const previousRequests = billRequests
    const previousOrders = orders
    const previousSelectedId = selectedId
    const memberIds = selectedTableGroup.group.memberTableIds
    setOrders([])
    setItemDiscounts(new Map())
    setBillRequests((prev) => prev.filter((request) => !memberIds.includes(request.tableId)))
    setTables((prev) =>
      prev.map((table) =>
        memberIds.includes(table.TABLE_ID)
          ? { ...table, STATUS: 'AVAILABLE', CURRENT_GUEST_COUNT: 0, BILL_OUT_REQUESTED: false }
          : table,
      ),
    )
    setSummaries((prev) => {
      const next = new Map(prev)
      memberIds.forEach((id) => next.set(id, { totalBill: 0, activeOrderCount: 0 }))
      return next
    })
    setSelectedId(null)

    try {
      await settleTableOrders(selectedTableGroup.group.anchorTableId, memberIds)
      if (activeBillRequest) await updateBillRequestStatus(activeBillRequest.requestId, 'PAID')
      await resolveBillOutRequest(selectedTableGroup.group.anchorTableId)
      setReceipt(snapshot)
      await load()
    } catch (err) {
      console.error('[CashierInterface] Settlement failed:', err)
      setTables(previousTables)
      setSummaries(previousSummaries)
      setBillRequests(previousRequests)
      setOrders(previousOrders)
      setItemDiscounts(new Map())
      setSelectedId(previousSelectedId)
      setError(err instanceof Error ? err.message : 'Unable to complete bill-out. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function settleTicket() {
    if (!selectedTicket || activeItems.length === 0) return
    setBusy(true)
    setError('')

    const discounts: Array<{ label: string; amount: number }> = []
    if (pwdCount > 0) {
      discounts.push({
        label: `PWD Discount (${pwdCount} items)`,
        amount: (subtotal * 0.2 * pwdCount) / Math.max(1, activeItems.length),
      })
    }
    if (seniorCount > 0) {
      discounts.push({
        label: `Senior Citizen Discount (${seniorCount} items)`,
        amount: (subtotal * 0.2 * seniorCount) / Math.max(1, activeItems.length),
      })
    }
    if (customTotal > 0) {
      discounts.push({
        label: 'Custom Discount',
        amount: customTotal,
      })
    }
    const totalDiscountAmount = discounts.reduce((sum, d) => sum + d.amount, 0)

    const snapshot = buildTicketReceiptSnapshot({
      ticketId: selectedTicket.ticketId,
      registeredName: selectedTicket.registeredName,
      items: groupedItems.map((g) => ({
        name: g.name,
        price: g.items[0]?.price ?? 0,
        quantity: g.items.length,
      })),
      baseSubtotal: subtotal,
      discounts,
      totalDiscount: totalDiscountAmount,
      taxAmount: taxableSubtotal * 0.05,
      grandTotal: total,
      paymentMethod: 'Cash',
    })

    try {
      await settleTicketOrder(selectedTicket.ticketId)
      setReceipt(snapshot)
      setSelectedTicketId(null)
      setItemDiscounts(new Map())
      await load()
    } catch (err) {
      console.error('[CashierInterface] Ticket settlement failed:', err)
      setError(err instanceof Error ? err.message : 'Unable to complete ticket bill-out.')
    } finally {
      setBusy(false)
    }
  }

  async function handleRemoveOrder() {
    if (mode === 'tickets') {
      if (!selectedTicket) return
      setRemoveBusy(true)
      setError('')
      try {
        await deleteTicketOrder(selectedTicket.ticketId)
        broadcastOrderUpdate({ type: 'all' })
        setSelectedTicketId(null)
        setShowRemoveConfirm(false)
        await load()
      } catch (err) {
        console.error('[CashierInterface] Failed to remove ticket order:', err)
        setError(err instanceof Error ? err.message : 'Failed to remove ticket order.')
      } finally {
        setRemoveBusy(false)
      }
    } else {
      if (!selectedTableGroup || orders.length === 0) return
      setRemoveBusy(true)
      setError('')
      try {
        const memberIds = selectedTableGroup.group.memberTableIds
        for (const order of orders) {
          await deleteOrder(order.orderId)
        }
        if (activeBillRequest) {
          await updateBillRequestStatus(activeBillRequest.requestId, 'CANCELLED')
        }
        await resolveBillOutRequest(selectedTableGroup.group.anchorTableId)

        await supabase
          .from('Restaurant_Tables')
          .update({
            STATUS: 'AVAILABLE',
            BILL_OUT_REQUESTED: false,
            CURRENT_GUEST_COUNT: 0,
            RESERVED_SINCE: null,
          })
          .in('TABLE_ID', memberIds)

        broadcastOrderUpdate({ type: 'all' })
        setSelectedId(null)
        setOrders([])
        setShowRemoveConfirm(false)
        await load()
      } catch (err) {
        console.error('[CashierInterface] Failed to remove table order:', err)
        setError(err instanceof Error ? err.message : 'Failed to remove table order.')
      } finally {
        setRemoveBusy(false)
      }
    }
  }

  const enabledTablesCount = groups.filter((g) => g.summary.activeOrderCount > 0).length
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
    <div className="cashier-interface-page staff-page">
      {error && <div className="ci-error">{error}</div>}
      <div className="cashier-interface-layout">
        <section className="inner-cashier-container">
          {/* Header & Mode Switcher */}
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2.5">
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 gap-1">
              <button
                type="button"
                onClick={() => {
                  setMode('tables')
                  setSelectedTicketId(null)
                }}
                className={[
                  'px-3.5 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer',
                  mode === 'tables' ? 'bg-[#14274E] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900',
                ].join(' ')}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Tables ({enabledTablesCount})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode('tickets')
                  setSelectedId(null)
                  setOrders([])
                }}
                className={[
                  'px-3.5 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer',
                  mode === 'tickets' ? 'bg-[#14274E] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900',
                ].join(' ')}
              >
                <Ticket className="w-3.5 h-3.5 text-[#E9C46A]" />
                <span>Tickets ({activeTickets.length})</span>
              </button>
            </div>

            <span className="text-xs font-bold text-slate-400">
              {mode === 'tables' ? 'Showing dine-in/takeout tables' : 'Showing active ticket orders'}
            </span>
          </div>

          {/* Tables Cards Grid */}
          {mode === 'tables' ? (
            <div className="ci-table-grid">
              {groups.map(({ table, group, summary }) => {
                const enabled = summary.activeOrderCount > 0
                return (
                  <button
                    key={table.TABLE_ID}
                    type="button"
                    disabled={!enabled}
                    className={`ci-table-card ${enabled ? '' : 'is-disabled'} ${
                      selectedTableGroup?.group.anchorTableId === group.anchorTableId ? 'is-selected' : ''
                    }`}
                    onClick={() => void selectTable(group.anchorTableId)}
                  >
                    <div className="ci-table-top">
                      <span>{group.displayLabel}</span>
                    </div>
                    <div className={`tm-pax-row ${group.currentGuestCount >= group.capacity ? 'tm-pax-full' : ''}`}>
                      <Users className="ci-icon" />
                      <span>
                        {group.currentGuestCount}/{group.capacity}
                      </span>
                    </div>
                  </button>
                )
              })}
              {groups.length === 0 && <div className="ci-empty">No tables available.</div>}
            </div>
          ) : (
            /* Tickets Cards Grid */
            <div className="ci-table-grid">
              {activeTickets.map((tk) => {
                const isSelected = selectedTicketId === tk.ticketId
                const displayName = tk.registeredName || 'Guest Order'
                const isDone = tk.ticketStatus === 'COMPLETED'
                const isCooking = tk.ticketStatus === 'PREPARING'
                return (
                  <button
                    key={tk.ticketId}
                    type="button"
                    className={`ci-table-card ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => selectTicket(tk.ticketId)}
                  >
                    <div className="ci-table-top">
                      <span className="flex items-center gap-1.5 min-w-0">
                        <Ticket className="w-4 h-4 text-[#E9C46A] shrink-0" />
                        <span className="text-base font-black text-[#14274E] truncate">
                          {displayName}
                        </span>
                      </span>
                      {isDone ? (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 shrink-0">READY</span>
                      ) : isCooking ? (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-amber-100 text-amber-700 shrink-0">COOKING</span>
                      ) : (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 shrink-0">REQUESTED</span>
                      )}
                    </div>

                    <div className="text-left space-y-1.5 py-1">
                      {tk.registeredContactInfo && (
                        <div className="text-xs sm:text-sm font-bold text-slate-700 flex items-center gap-1.5">
                          <Phone className="w-4 h-4 text-slate-500 shrink-0" />
                          <span>{tk.registeredContactInfo}</span>
                        </div>
                      )}
                      {tk.registeredTimeOfArrival && (
                        <div className="text-xs sm:text-sm font-black text-amber-900 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 flex items-center gap-1.5">
                          <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>ETA: {formatArrivalDisplay(tk.registeredTimeOfArrival)}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs font-bold text-slate-500">
                      <span>{(tk.items ?? []).length} items</span>
                      <span className="text-base font-black text-[#14274E]">{money(tk.totalAmount ?? 0)}</span>
                    </div>
                  </button>
                )
              })}
              {activeTickets.length === 0 && (
                <div className="ci-empty">No active ticket orders.</div>
              )}
            </div>
          )}
        </section>

        {/* Sidebar Panel */}
        <aside className="cashier-sidebar">
          <header className="ci-sidebar-header">
            <div>
              <span className="ci-sidebar-kicker">
                {mode === 'tables' ? 'Table Cashier' : 'Ticket Cashier'}
              </span>
              <h2>
                {mode === 'tables'
                  ? selectedTableGroup
                    ? selectedTableGroup.group.displayLabel
                    : 'Select a table'
                  : selectedTicket
                  ? (selectedTicket.registeredName || 'Guest Order')
                  : 'Select a ticket'}
              </h2>
            </div>
            <Receipt className="ci-header-icon" />
          </header>

          <div className="ci-sidebar-body">
            {mode === 'tables' && !selectedTableGroup ? (
              <div className="ci-sidebar-empty">Select an enabled table card to review its completed order.</div>
            ) : mode === 'tickets' && !selectedTicket ? (
              <div className="ci-sidebar-empty">Select a ticket card to review its items and bill out.</div>
            ) : (
              <>
                <div className="ci-top-body">
                  {mode === 'tables' && selectedTableGroup ? (
                    <>
                      <div className="ci-guest-info">
                        <Users className="ci-icon" />
                        <span>
                          {selectedTableGroup.group.currentGuestCount}/{selectedTableGroup.group.capacity}
                        </span>
                      </div>
                      <div className="ci-order-type">
                        {activeItems.length > 0 && activeItems[0].orderType === 'TAKEOUT' ? 'Takeout' : 'Dine In'}
                      </div>
                    </>
                  ) : selectedTicket ? (
                    <>
                      <div className="ci-guest-info text-sm font-bold text-[#14274E] flex items-center gap-2">
                        <User className="w-4 h-4 text-slate-400" />
                        <span>{selectedTicket.registeredName || 'Guest'}</span>
                        {selectedTicket.registeredContactInfo && (
                          <span className="text-sm font-bold text-slate-500">
                            • {selectedTicket.registeredContactInfo}
                          </span>
                        )}
                      </div>
                      <div className="ci-order-type font-black text-amber-700 text-xs sm:text-sm bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        <span>
                          {selectedTicket.registeredTimeOfArrival
                            ? `ETA: ${formatArrivalDisplay(selectedTicket.registeredTimeOfArrival)}`
                            : 'TICKET'}
                        </span>
                      </div>
                    </>
                  ) : null}
                </div>

                {activeItems.length === 0 ? (
                  <div className="ci-sidebar-empty">No completed items to bill.</div>
                ) : mode === 'tables' ? (
                  /* ── Table Mode with Discount Controls ── */
                  <div className="ci-items-table">
                    <div className="ci-items-header">
                      <span>Name</span>
                      <span>
                        PWD
                        <input
                          type="checkbox"
                          checked={applyAllPwd}
                          onChange={(e) => {
                            setApplyAllPwd(e.target.checked)
                            applyDiscountToAll('pwd', e.target.checked)
                          }}
                        />
                      </span>
                      <span>
                        Senior
                        <input
                          type="checkbox"
                          checked={applyAllSenior}
                          onChange={(e) => {
                            setApplyAllSenior(e.target.checked)
                            applyDiscountToAll('senior', e.target.checked)
                          }}
                        />
                      </span>
                      <span>
                        Custom
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={applyAllCustom}
                          onChange={(e) => {
                            const val = Number(e.target.value) || 0
                            setApplyAllCustom(val)
                            applyDiscountToAll('custom', val)
                          }}
                        />
                      </span>
                      <span>Price</span>
                    </div>

                    <div className="ci-items-body">
                      {groupedItems.map((group, groupIndex) => {
                        const isCollapsed = collapsedGroups.has(group.name)
                        const isMultiple = group.items.length > 1
                        const totalPrice = group.items.reduce((sum, item) => sum + item.price, 0) / 1.05

                        // Split name and counter for proper wrapping
                        const nameParts = group.name.split(' ')
                        const counter = isMultiple ? `x${group.items.length}` : ''
                        let displayName = group.name
                        let displayCounter = counter

                        if (isMultiple && nameParts.length > 1) {
                          const lastWord = nameParts[nameParts.length - 1]
                          displayName = nameParts.slice(0, -1).join(' ')
                          displayCounter = `${lastWord} ${counter}`
                        }

                        // Single item
                        if (!isMultiple) {
                          const item = group.items[0]
                          const discount = itemDiscounts.get(item.orderItemId) ?? {
                            pwd: false,
                            senior: false,
                            custom: 0,
                          }
                          return (
                            <div key={group.name} className="ci-item-group">
                              <div
                                className={`ci-item-row ${
                                  groupIndex % 2 === 0 ? 'ci-row-even' : 'ci-row-odd'
                                }`}
                              >
                                <span className="ci-item-name">{group.name}</span>
                                <span className="ci-item-checkbox">
                                  <input
                                    type="checkbox"
                                    checked={discount.pwd}
                                    onChange={(e) => updateItemDiscount(item.orderItemId, 'pwd', e.target.checked)}
                                  />
                                </span>
                                <span className="ci-item-checkbox">
                                  <input
                                    type="checkbox"
                                    checked={discount.senior}
                                    onChange={(e) => updateItemDiscount(item.orderItemId, 'senior', e.target.checked)}
                                  />
                                </span>
                                <span className="ci-item-custom">
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={discount.custom}
                                    onChange={(e) =>
                                      updateItemDiscount(item.orderItemId, 'custom', Number(e.target.value) || 0)
                                    }
                                  />
                                </span>
                                <span className="ci-item-price">{money(item.price / 1.05)}</span>
                              </div>
                            </div>
                          )
                        }

                        // Multiple items - render as collapsible group
                        return (
                          <div key={group.name} className="ci-item-group">
                            <div
                              className={`ci-item-row ${
                                isMultiple && isCollapsed ? 'ci-collapsed-row' : ''
                              } ${isMultiple && !isCollapsed ? 'ci-item-group-header' : ''} ${
                                groupIndex % 2 === 0 ? 'ci-row-even' : 'ci-row-odd'
                              }`}
                            >
                              <span className="ci-item-name">
                                {isMultiple && (
                                  <button
                                    type="button"
                                    className="ci-collapse-btn"
                                    onClick={() => toggleGroup(group.name)}
                                  >
                                    {isCollapsed ? (
                                      <ChevronRight className="ci-icon-sm" />
                                    ) : (
                                      <ChevronDown className="ci-icon-sm" />
                                    )}
                                  </button>
                                )}
                                {isMultiple ? (
                                  <>
                                    {displayName} {displayCounter}
                                  </>
                                ) : (
                                  group.name
                                )}
                              </span>
                              <span className="ci-item-checkbox">
                                <input
                                  type="checkbox"
                                  checked={Boolean(getGroupDiscount(group, 'pwd'))}
                                  onChange={(e) => updateGroupDiscount(group, 'pwd', e.target.checked)}
                                />
                              </span>
                              <span className="ci-item-checkbox">
                                <input
                                  type="checkbox"
                                  checked={Boolean(getGroupDiscount(group, 'senior'))}
                                  onChange={(e) => updateGroupDiscount(group, 'senior', e.target.checked)}
                                />
                              </span>
                              <span className="ci-item-custom">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={Number(getGroupDiscount(group, 'custom'))}
                                  onChange={(e) =>
                                    updateGroupDiscount(group, 'custom', Number(e.target.value) || 0)
                                  }
                                />
                              </span>
                              <span className="ci-item-price">{money(totalPrice)}</span>
                            </div>
                            <div
                              className={`ci-subrows-container ${!isCollapsed ? 'expanded' : ''} ${
                                disableAnimation ? 'no-animation' : ''
                              }`}
                            >
                              <div className="ci-subrows-inner">
                                {group.items.map((item, itemIndex) => {
                                  const discount = itemDiscounts.get(item.orderItemId) ?? {
                                    pwd: false,
                                    senior: false,
                                    custom: 0,
                                  }
                                  return (
                                    <div
                                      className={`ci-item-row ci-item-subrow ${
                                        groupIndex % 2 === 0 ? 'ci-row-even' : 'ci-row-odd'
                                      }`}
                                      key={item.orderItemId}
                                    >
                                      <span className="ci-item-name ci-subitem-name">└ #{itemIndex + 1}</span>
                                      <span className="ci-item-checkbox">
                                        <input
                                          type="checkbox"
                                          checked={discount.pwd}
                                          onChange={(e) =>
                                            updateItemDiscount(item.orderItemId, 'pwd', e.target.checked)
                                          }
                                        />
                                      </span>
                                      <span className="ci-item-checkbox">
                                        <input
                                          type="checkbox"
                                          checked={discount.senior}
                                          onChange={(e) =>
                                            updateItemDiscount(item.orderItemId, 'senior', e.target.checked)
                                          }
                                        />
                                      </span>
                                      <span className="ci-item-custom">
                                        <input
                                          type="number"
                                          min="0"
                                          max="100"
                                          value={discount.custom}
                                          onChange={(e) =>
                                            updateItemDiscount(item.orderItemId, 'custom', Number(e.target.value) || 0)
                                          }
                                        />
                                      </span>
                                      <span className="ci-item-price">{money(item.price / 1.05)}</span>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  /* ── Ticket Mode Clean Items Breakdown (No Discounts) ── */
                  <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-2xs">
                    <div className="grid grid-cols-[1fr_auto] gap-3 px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-black text-[#14274E]">
                      <span>Item Description</span>
                      <span>Price</span>
                    </div>
                    <div className="divide-y divide-slate-100 max-h-[340px] overflow-y-auto">
                      {groupedItems.map((group) => {
                        const qty = group.items.length
                        const itemBasePrice = (group.items[0]?.price ?? 0) / 1.05
                        const totalGroupPrice = group.items.reduce((sum, it) => sum + it.price, 0) / 1.05
                        return (
                          <div
                            key={group.name}
                            className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50/60 transition-colors"
                          >
                            <div>
                              <span className="font-extrabold text-sm text-[#14274E]">{group.name}</span>
                              {qty > 1 && (
                                <span className="ml-2 text-xs font-bold text-slate-500">
                                  ({money(itemBasePrice)} × {qty})
                                </span>
                              )}
                            </div>
                            <span className="font-black text-sm text-[#14274E] shrink-0">
                              {money(totalGroupPrice)}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <footer className="ci-sidebar-footer">
            <div className="ci-total-row">
              <span>Subtotal</span>
              <span>{money(subtotal)}</span>
            </div>
            {mode === 'tables' && (
              <>
                {pwdCount > 0 && (
                  <div className="ci-total-row ci-discount-total">
                    <span>PWD Discounts ({pwdCount})</span>
                    <span>-{money((subtotal * 0.2 * pwdCount) / Math.max(1, activeItems.length))}</span>
                  </div>
                )}
                {seniorCount > 0 && (
                  <div className="ci-total-row ci-discount-total">
                    <span>Senior Discounts ({seniorCount})</span>
                    <span>-{money((subtotal * 0.2 * seniorCount) / Math.max(1, activeItems.length))}</span>
                  </div>
                )}
                {customTotal > 0 && (
                  <div className="ci-total-row ci-discount-total">
                    <span>Custom Discounts</span>
                    <span>-{money(customTotal)}</span>
                  </div>
                )}
              </>
            )}
            <div className="ci-total-row">
              <span>VAT (5%)</span>
              <span>{money(taxableSubtotal * 0.05)}</span>
            </div>
            <div className="ci-grand-total">
              <span>Total</span>
              <strong>{money(total)}</strong>
            </div>

            {/* Warning banner if not completed in Dispatcher */}
            {((mode === 'tables' && selectedTableGroup && orders.length > 0 && !isTableDispatcherDone) ||
              (mode === 'tickets' && selectedTicket && !isTicketDispatcherDone)) && (
              <div className="ci-dispatcher-warning">
                <Clock className="w-4 h-4 shrink-0 text-amber-600" />
                <span>Awaiting Dispatcher completion. Cannot be billed out yet.</span>
              </div>
            )}

            <div className="ci-action-buttons">
              <button
                type="button"
                className="ci-remove-button"
                disabled={
                  busy ||
                  removeBusy ||
                  (mode === 'tables' ? !selectedTableGroup || orders.length === 0 : !selectedTicket)
                }
                onClick={() => setShowRemoveConfirm(true)}
                title="Remove and cancel this order"
              >
                <Trash2 className="w-4 h-4" />
                <span>Remove Order</span>
              </button>

              {mode === 'tables' ? (
                <button
                  type="button"
                  className="ci-settle-button"
                  disabled={!selectedTableGroup || orders.length === 0 || !isTableDispatcherDone || busy || removeBusy}
                  onClick={() => void settleTable()}
                >
                  <CreditCard className="ci-icon" />
                  {busy ? 'Processing...' : !isTableDispatcherDone ? 'Awaiting Dispatcher' : 'Bill Out Customer'}
                </button>
              ) : (
                <button
                  type="button"
                  className="ci-settle-button"
                  disabled={!selectedTicket || activeItems.length === 0 || !isTicketDispatcherDone || busy || removeBusy}
                  onClick={() => void settleTicket()}
                >
                  <CreditCard className="ci-icon" />
                  {busy ? 'Processing...' : !isTicketDispatcherDone ? 'Awaiting Dispatcher' : 'Bill Out Ticket'}
                </button>
              )}
            </div>
          </footer>
        </aside>
      </div>

      {/* Remove Order Confirmation Modal */}
      {showRemoveConfirm && (
        <div className="ci-modal-overlay" onClick={() => !removeBusy && setShowRemoveConfirm(false)}>
          <div className="ci-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="ci-modal-header">
              <span className="ci-modal-title">
                <Trash2 className="w-4 h-4 text-rose-600" />
                <span>{mode === 'tickets' ? 'Remove Ticket Order' : 'Remove Table Order'}</span>
              </span>
              <button
                type="button"
                className="text-slate-400 hover:text-slate-600 cursor-pointer p-1 rounded-md"
                disabled={removeBusy}
                onClick={() => setShowRemoveConfirm(false)}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="ci-modal-body">
              {mode === 'tickets' && selectedTicket && (
                <>
                  <p className="mb-3 text-slate-700 font-medium">
                    Are you sure you want to remove <strong>Ticket #{selectedTicket.ticketId}</strong> ({selectedTicket.registeredName || 'Guest Order'})?
                  </p>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-bold">Dispatcher Status:</span>
                      <span className={`font-black ${selectedTicket.ticketStatus === 'COMPLETED' ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {selectedTicket.ticketStatus === 'COMPLETED' ? 'Ready for Billing' : selectedTicket.ticketStatus === 'PREPARING' ? 'Cooking in Dispatcher' : 'Requested'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-bold">Line Items:</span>
                      <span className="font-extrabold text-[#14274E]">{(selectedTicket.items ?? []).length} item(s)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-bold">Order Total:</span>
                      <span className="font-black text-[#14274E]">{money(total)}</span>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-rose-600 font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>This will permanently cancel and remove the ticket from all stations.</span>
                  </p>
                </>
              )}

              {mode === 'tables' && selectedTableGroup && (
                <>
                  <p className="mb-3 text-slate-700 font-medium">
                    Are you sure you want to remove active order(s) for <strong>{selectedTableGroup.group.displayLabel}</strong>?
                  </p>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-bold">Dispatcher Status:</span>
                      <span className={`font-black ${isTableDispatcherDone ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {isTableDispatcherDone ? 'Ready for Billing' : 'In Preparation / Dispatcher'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-bold">Orders:</span>
                      <span className="font-extrabold text-[#14274E]">#{orders.map((o) => o.orderId).join(', #')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-bold">Active Items:</span>
                      <span className="font-extrabold text-[#14274E]">{activeItems.length} item(s)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-bold">Order Total:</span>
                      <span className="font-black text-[#14274E]">{money(total)}</span>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-rose-600 font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>This will cancel the active order(s) and reset the table to Available.</span>
                  </p>
                </>
              )}
            </div>

            <div className="ci-modal-footer">
              <button
                type="button"
                className="ci-modal-btn-cancel"
                disabled={removeBusy}
                onClick={() => setShowRemoveConfirm(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="ci-modal-btn-danger"
                disabled={removeBusy}
                onClick={() => void handleRemoveOrder()}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{removeBusy ? 'Removing...' : 'Confirm Remove'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {receipt && <ReceiptPreviewModal receipt={receipt} onClose={() => setReceipt(null)} />}
      {!receipt && selectedTableGroup && activeBillRequest && (
        <span className="sr-only">Payment requested via {activeBillRequest.paymentMethod}</span>
      )}
    </div>
  )
}

