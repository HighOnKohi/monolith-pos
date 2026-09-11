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
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { fetchAllTables, fetchOrderSummariesForIds, type TableData } from '@/services/tableService'
import { fetchOrdersByTable, settleTableOrders } from '@/services/orderService'
import { fetchAllBillRequests, resolveBillOutRequest, updateBillRequestStatus } from '@/services/billService'
import { fetchTicketOrders, deleteTicketOrder } from '@/services/ticketService'
import { subscribeToOrderUpdates } from '@/services/dispatcherService'
import type { BillRequest } from '@/types/bill'
import type { Order } from '@/types/order'
import type { TicketOrder } from '@/types/ticket'
import { resolveTableGroupByList } from '@/services/tableGroupService'
import { buildReceiptSnapshot, buildTicketReceiptSnapshot } from '@/components/receipt/buildReceipt'
import { ReceiptPreviewModal } from '@/components/receipt/ReceiptPreviewModal'
import type { ReceiptSnapshot } from '@/components/receipt/types'

// Strict cashier visibility: Only COMPLETED orders appear in cashier
const ACTIVE_STATUSES = ['COMPLETED'] as const
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
        ['COMPLETED'],
      )
      setTables(nextTables)
      setSummaries(nextSummaries)
      setBillRequests(nextRequests)
      setTickets(nextTickets)

      setSelectedId((current) =>
        current && nextTables.some((table) => table.TABLE_ID === current) ? current : null,
      )
      setSelectedTicketId((current) =>
        current && nextTickets.some((t) => t.ticketId === current && t.ticketStatus === 'COMPLETED')
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Restaurant_Tables' }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Restaurant_Orders' }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Order_Items' }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Bill_Requests' }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Ticket_Orders' }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Ticket_Order_Items' }, () => void load())
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

  // Completed Tickets List
  const completedTickets = useMemo(() => {
    return tickets.filter((t) => t.ticketStatus === 'COMPLETED')
  }, [tickets])

  const selectedTableGroup = groups.find(({ group }) => group.anchorTableId === selectedId) ?? null
  const selectedTicket = completedTickets.find((t) => t.ticketId === selectedTicketId) ?? null
  const activeBillRequest = selectedTableGroup
    ? billRequests.find((request) => selectedTableGroup.group.memberTableIds.includes(request.tableId)) ?? null
    : null

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
        .filter((order) => ACTIVE_STATUSES.includes(order.orderStatus as typeof ACTIVE_STATUSES[number]))
        .flatMap((order) =>
          (order.items ?? [])
            .filter((item) => item.status === 'DONE')
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
      setOrders(await fetchOrdersByTable(group.anchorTableId, ['COMPLETED'], group.memberTableIds))
    } catch (err) {
      console.error('[CashierInterface] Failed to fetch orders:', err)
      setOrders([])
      setError("Unable to load this table's completed order.")
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
      tableOrders: orders.filter((order) => ACTIVE_STATUSES.includes(order.orderStatus as typeof ACTIVE_STATUSES[number])),
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

    const snapshot = buildTicketReceiptSnapshot({
      ticketId: selectedTicket.ticketId,
      registeredName: selectedTicket.registeredName,
      items: groupedItems.map((g) => ({
        name: g.name,
        price: g.items[0]?.price ?? 0,
        quantity: g.items.length,
      })),
      baseSubtotal: subtotal,
      discounts: [],
      totalDiscount: 0,
      taxAmount: taxableSubtotal * 0.05,
      grandTotal: total,
      paymentMethod: 'Cash',
    })

    try {
      await deleteTicketOrder(selectedTicket.ticketId)
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
                <span>Tickets ({completedTickets.length})</span>
              </button>
            </div>

            <span className="text-xs font-bold text-slate-400">
              {mode === 'tables' ? 'Showing completed dine-in/takeout tables' : 'Showing ready ticket orders'}
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
                      <span>Table {group.memberTableNums.join(' + ')}</span>
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
              {completedTickets.map((tk) => {
                const isSelected = selectedTicketId === tk.ticketId
                const displayName = tk.registeredName || 'Guest Order'
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
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 shrink-0">READY</span>
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
              {completedTickets.length === 0 && (
                <div className="ci-empty">No completed ticket orders ready for billing.</div>
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

            {mode === 'tables' ? (
              <button
                type="button"
                className="ci-settle-button"
                disabled={!selectedTableGroup || orders.length === 0 || busy}
                onClick={() => void settleTable()}
              >
                <CreditCard className="ci-icon" />
                {busy ? 'Processing...' : 'Bill Out Customer'}
              </button>
            ) : (
              <button
                type="button"
                className="ci-settle-button"
                disabled={!selectedTicket || activeItems.length === 0 || busy}
                onClick={() => void settleTicket()}
              >
                <CreditCard className="ci-icon" />
                {busy ? 'Processing...' : 'Bill Out Ticket'}
              </button>
            )}
          </footer>
        </aside>
      </div>

      {receipt && <ReceiptPreviewModal receipt={receipt} onClose={() => setReceipt(null)} />}
      {!receipt && selectedTableGroup && activeBillRequest && (
        <span className="sr-only">Payment requested via {activeBillRequest.paymentMethod}</span>
      )}
    </div>
  )
}

