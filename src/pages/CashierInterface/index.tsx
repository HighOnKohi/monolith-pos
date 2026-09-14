import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CreditCard,
  Receipt,
  Users,
  ChevronDown,
  ChevronRight,
  Clock,
  Trash2,
  AlertTriangle,
  X,
  GitMerge,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { fetchAllTables, fetchOrderSummariesForIds, type TableData } from '@/services/tableService'
import { fetchOrdersByTable, settleTableOrders, deleteOrder } from '@/services/orderService'
import { fetchAllBillRequests, resolveBillOutRequest, updateBillRequestStatus } from '@/services/billService'
import { subscribeToOrderUpdates, broadcastOrderUpdate } from '@/services/dispatcherService'
import type { BillRequest } from '@/types/bill'
import type { Order, OrderStatus } from '@/types/order'
import { resolveTableGroupByList } from '@/services/tableGroupService'
import { buildReceiptSnapshot } from '@/components/receipt/buildReceipt'
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

export default function CashierInterface() {
  // Tables state
  const [tables, setTables] = useState<TableData[]>([])
  const [summaries, setSummaries] = useState<Map<number, { totalBill: number; activeOrderCount: number }>>(new Map())
  const [billRequests, setBillRequests] = useState<BillRequest[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [orders, setOrders] = useState<Order[]>([])

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
      const [nextTables, nextRequests] = await Promise.all([
        fetchAllTables(),
        fetchAllBillRequests(),
      ])
      const nextSummaries = await fetchOrderSummariesForIds(
        nextTables.map((table) => table.TABLE_ID),
        ALL_ACTIVE_ORDER_STATUSES,
      )
      setTables(nextTables)
      setSummaries(nextSummaries)
      setBillRequests(nextRequests)

      setSelectedId((current) => {
        const valid = current && nextTables.some((table) => table.TABLE_ID === current) ? current : null
        if (valid) {
          const group = resolveTableGroupByList(valid, nextTables)
          void fetchOrdersByTable(group.anchorTableId, ALL_ACTIVE_ORDER_STATUSES, group.memberTableIds)
            .then((updated) => setOrders(updated))
            .catch(() => { })
        } else {
          setOrders([])
        }
        return valid
      })
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
      .on('postgres_changes', { event: '*', schema: 'tables', table: 'Table_Layout_Presets' }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Restaurant_Orders' }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Order_Items' }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Bill_Requests' }, () => void load())
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

  const selectedTableGroup = groups.find(({ group }) => group.anchorTableId === selectedId) ?? null
  const activeBillRequest = selectedTableGroup
    ? billRequests.find((request) => selectedTableGroup.group.memberTableIds.includes(request.tableId)) ?? null
    : null

  // Dispatcher completion check: table orders must be COMPLETED in Dispatcher to bill out
  const isTableDispatcherDone = useMemo(() => {
    if (orders.length === 0) return false
    return orders.every((o) => o.orderStatus === 'COMPLETED')
  }, [orders])

  // Active items in current view
  const activeItems = useMemo<Array<{
    orderItemId: string
    orderId: number
    name: string
    price: number
    orderType: string
  }>>(() => {
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
  }, [orders])

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
    if (selectedTableGroup && groupedItems.length > 0) {
      setDisableAnimation(true)
      const allGroupNames = groupedItems.filter((g) => g.items.length > 1).map((g) => g.name)
      setCollapsedGroups(new Set(allGroupNames))
      setTimeout(() => setDisableAnimation(false), 50)
    }
  }, [selectedTableGroup?.group.anchorTableId, groupedItems])

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

  async function handleRemoveOrder() {
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
        .schema('tables')
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

  const enabledTablesCount = groups.filter((g) => g.summary.activeOrderCount > 0).length

  return (
    <div className="cashier-interface-page staff-page">
      {error && <div className="ci-error">{error}</div>}
      <div className="cashier-interface-layout">
        <section className="inner-cashier-container">
          {/* Header */}
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2.5">
            <h2 className="text-sm font-black text-[#14274E]">
              Tables ({enabledTablesCount})
            </h2>

            <span className="text-xs font-bold text-slate-400">
              Showing dine-in & takeout tables
            </span>
          </div>

          {/* Tables Cards Grid */}
          <div className="ci-table-grid">
            {groups.map(({ table, group, summary }) => {
              const enabled = summary.activeOrderCount > 0
              return (
                <button
                  key={table.TABLE_ID}
                  type="button"
                  disabled={!enabled}
                  className={`ci-table-card ${enabled ? '' : 'is-disabled'} ${group.isMerged ? 'is-merged' : ''} ${selectedTableGroup?.group.anchorTableId === group.anchorTableId ? 'is-selected' : ''
                    }`}
                  onClick={() => void selectTable(group.anchorTableId)}
                >
                  <div className="ci-table-top">
                    <span className="flex items-center gap-1.5">Table {group.memberTableNums.join(' + ')}</span>
                    {group.isMerged && (
                      <span className="ci-merged-badge">
                        <GitMerge className="w-3 h-3" />
                        Merged
                      </span>
                    )}
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
        </section>

        {/* Sidebar Panel */}
        <aside className="cashier-sidebar">
          <header className="ci-sidebar-header">
            <div>
              <span className="ci-sidebar-kicker">Table Cashier</span>
              <h2 className="flex items-center gap-2">
                {selectedTableGroup
                  ? selectedTableGroup.group.displayLabel
                  : 'Select a table'}
                {selectedTableGroup?.group.isMerged && (
                  <span className="ci-merged-badge text-[10px]">
                    <GitMerge className="w-3 h-3" />
                    Merged ({selectedTableGroup.group.memberTableNums.length} Tables)
                  </span>
                )}
              </h2>
            </div>
            <Receipt className="ci-header-icon" />
          </header>

          <div className="ci-sidebar-body">
            {!selectedTableGroup ? (
              <div className="ci-sidebar-empty">Select an enabled table card to review its completed order.</div>
            ) : (
              <>
                <div className="ci-top-body">
                  <div className="ci-guest-info">
                    <Users className="ci-icon" />
                    <span>
                      {selectedTableGroup.group.currentGuestCount}/{selectedTableGroup.group.capacity}
                    </span>
                  </div>
                  <div className="ci-order-type">
                    {activeItems.length > 0 && activeItems[0].orderType === 'TAKEOUT' ? 'Takeout' : 'Dine In'}
                  </div>
                </div>

                {activeItems.length === 0 ? (
                  <div className="ci-sidebar-empty">No completed items to bill.</div>
                ) : (
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
                                className={`ci-item-row ${groupIndex % 2 === 0 ? 'ci-row-even' : 'ci-row-odd'
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
                              className={`ci-item-row ${isMultiple && isCollapsed ? 'ci-collapsed-row' : ''
                                } ${isMultiple && !isCollapsed ? 'ci-item-group-header' : ''} ${groupIndex % 2 === 0 ? 'ci-row-even' : 'ci-row-odd'
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
                              className={`ci-subrows-container ${!isCollapsed ? 'expanded' : ''} ${disableAnimation ? 'no-animation' : ''
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
                                      className={`ci-item-row ci-item-subrow ${groupIndex % 2 === 0 ? 'ci-row-even' : 'ci-row-odd'
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
                )}
              </>
            )}
          </div>

          <footer className="ci-sidebar-footer">
            <div className="ci-total-row">
              <span>Subtotal</span>
              <span>{money(subtotal)}</span>
            </div>
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
            <div className="ci-total-row">
              <span>VAT (5%)</span>
              <span>{money(taxableSubtotal * 0.05)}</span>
            </div>
            <div className="ci-grand-total">
              <span>Total</span>
              <strong>{money(total)}</strong>
            </div>

            {/* Warning banner if not completed in Dispatcher */}
            {selectedTableGroup && orders.length > 0 && !isTableDispatcherDone && (
              <div className="ci-dispatcher-warning">
                <Clock className="w-4 h-4 shrink-0 text-amber-600" />
                <span>Awaiting Dispatcher completion. Cannot be billed out yet.</span>
              </div>
            )}

            <div className="ci-action-buttons">
              <button
                type="button"
                className="ci-remove-button"
                disabled={busy || removeBusy || !selectedTableGroup || orders.length === 0}
                onClick={() => setShowRemoveConfirm(true)}
                title="Remove and cancel this order"
              >
                <Trash2 className="w-4 h-4" />
                <span>Remove Order</span>
              </button>

              <button
                type="button"
                className="ci-settle-button"
                disabled={!selectedTableGroup || orders.length === 0 || !isTableDispatcherDone || busy || removeBusy}
                onClick={() => void settleTable()}
              >
                <CreditCard className="ci-icon" />
                {busy ? 'Processing...' : !isTableDispatcherDone ? 'Awaiting Dispatcher' : 'Bill Out Customer'}
              </button>
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
                <span>Remove Table Order</span>
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
              {selectedTableGroup && (
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
