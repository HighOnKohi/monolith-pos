import { useCallback, useEffect, useMemo, useState } from 'react'
import { CreditCard, Receipt, Users, ChevronDown, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { fetchAllTables, fetchOrderSummariesForIds, type TableData } from '@/services/tableService'
import { fetchOrdersByTable, settleTableOrders } from '@/services/orderService'
import { fetchAllBillRequests, resolveBillOutRequest, updateBillRequestStatus } from '@/services/billService'
import type { BillRequest } from '@/types/bill'
import type { Order } from '@/types/order'
import { resolveTableGroupByList } from '@/services/tableGroupService'
import { buildReceiptSnapshot } from '@/components/receipt/buildReceipt'
import { ReceiptPreviewModal } from '@/components/receipt/ReceiptPreviewModal'
import type { ReceiptSnapshot } from '@/components/receipt/types'

const ACTIVE_STATUSES = ['REQUESTED', 'VERIFIED', 'PREPARING', 'READY', 'SERVED'] as const
const money = (value: number) => `₱${value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

interface ItemDiscount {
  pwd: boolean
  senior: boolean
  custom: number
}

export default function CashierInterface() {
  const [tables, setTables] = useState<TableData[]>([])
  const [summaries, setSummaries] = useState<Map<number, { totalBill: number; activeOrderCount: number }>>(new Map())
  const [billRequests, setBillRequests] = useState<BillRequest[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
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
      const [nextTables, nextRequests] = await Promise.all([fetchAllTables(), fetchAllBillRequests()])
      const nextSummaries = await fetchOrderSummariesForIds(nextTables.map((table) => table.TABLE_ID))
      setTables(nextTables)
      setSummaries(nextSummaries)
      setBillRequests(nextRequests)
      setSelectedId((current) => current && nextTables.some((table) => table.TABLE_ID === current) ? current : null)
    } catch (err) {
      console.error('[CashierInterface] Failed to load data:', err)
      setError('Unable to load tables. Please try again.')
    }
  }, [])

  useEffect(() => {
    void load()
    const handleVisibility = () => { if (document.visibilityState === 'visible') void load() }
    document.addEventListener('visibilitychange', handleVisibility)
    const channel = supabase.channel('cashier-interface-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Restaurant_Tables' }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Restaurant_Orders' }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Bill_Requests' }, () => void load())
      .subscribe()
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      void supabase.removeChannel(channel)
    }
  }, [load])

  const groups = useMemo(() => {
    const seen = new Set<number>()
    return tables.flatMap((table) => {
      if (seen.has(table.TABLE_ID)) return []
      const group = resolveTableGroupByList(table.TABLE_ID, tables)
      group.memberTableIds.forEach((id) => seen.add(id))
      const summary = group.memberTableIds.reduce((result, id) => {
        const item = summaries.get(id)
        return { totalBill: result.totalBill + (item?.totalBill ?? 0), activeOrderCount: result.activeOrderCount + (item?.activeOrderCount ?? 0) }
      }, { totalBill: 0, activeOrderCount: 0 })
      return [{ table, group, summary }]
    })
  }, [tables, summaries])

  const selected = groups.find(({ group }) => group.anchorTableId === selectedId) ?? null
  const activeBillRequest = selected ? billRequests.find((request) => selected.group.memberTableIds.includes(request.tableId)) ?? null : null
  
  const activeItems = useMemo(() => {
    return orders
      .filter((order) => ACTIVE_STATUSES.includes(order.orderStatus as typeof ACTIVE_STATUSES[number]))
      .flatMap((order) => 
        (order.items ?? []).map((item) => ({
          orderItemId: String(item.orderItemId),
          orderId: order.orderId,
          name: item.name ?? `Item #${item.itemId}`,
          price: item.price ?? 0,
          orderType: order.orderType
        }))
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

  // Collapse all groups by default when selected table changes
  useEffect(() => {
    if (selected && groupedItems.length > 0) {
      setDisableAnimation(true)
      const allGroupNames = groupedItems.filter(g => g.items.length > 1).map(g => g.name)
      setCollapsedGroups(new Set(allGroupNames))
      setTimeout(() => setDisableAnimation(false), 50)
    }
  }, [selected?.group.anchorTableId, groupedItems])

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
      total: grandTotal
    }
  }, [activeItems, itemDiscounts])

  async function selectTable(tableId: number) {
    setError('')
    setSelectedId(tableId)
    setItemDiscounts(new Map())
    const group = resolveTableGroupByList(tableId, tables)
    try {
      setOrders(await fetchOrdersByTable(group.anchorTableId, undefined, group.memberTableIds))
    } catch (err) {
      console.error('[CashierInterface] Failed to fetch orders:', err)
      setOrders([])
      setError('Unable to load this table\'s active order.')
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
    return allSame ? firstValue : (field === 'custom' ? 0 : false)
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

  async function settle() {
    if (!selected || orders.length === 0) return
    setBusy(true)
    setError('')
    const snapshot = buildReceiptSnapshot({
      tableOrders: orders.filter((order) => ACTIVE_STATUSES.includes(order.orderStatus as typeof ACTIVE_STATUSES[number])),
      discountType: 'none',
      customPercent: 0,
      activeBillRequest,
      tableId: selected.group.anchorTableId,
      tableNum: selected.group.anchorTableNum
    })
    try {
      await settleTableOrders(selected.group.anchorTableId, selected.group.memberTableIds)
      if (activeBillRequest) await updateBillRequestStatus(activeBillRequest.requestId, 'PAID')
      await resolveBillOutRequest(selected.group.anchorTableId)
      setReceipt(snapshot)
      setSelectedId(null)
      setOrders([])
      setItemDiscounts(new Map())
      await load()
    } catch (err) {
      console.error('[CashierInterface] Settlement failed:', err)
      setError(err instanceof Error ? err.message : 'Unable to complete bill-out. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="cashier-interface-page staff-page">
      {error && <div className="ci-error">{error}</div>}
      <div className="cashier-interface-layout">
        <section className="inner-cashier-container">
          <div className="ci-table-grid">
            {groups.map(({ table, group, summary }) => {
              const enabled = summary.activeOrderCount > 0
              return (
                <button key={table.TABLE_ID} type="button" disabled={!enabled} className={`ci-table-card ${enabled ? '' : 'is-disabled'} ${selected?.group.anchorTableId === group.anchorTableId ? 'is-selected' : ''}`} onClick={() => void selectTable(group.anchorTableId)}>
                  <div className="ci-table-top"><span>Table {group.memberTableNums.join(' + ')}</span></div>
                  <div className={`tm-pax-row ${group.currentGuestCount >= group.capacity ? 'tm-pax-full' : ''}`}>
                    <Users className="ci-icon" />
                    <span>{group.currentGuestCount}/{group.capacity}</span>
                  </div>
                </button>
              )
            })}
            {groups.length === 0 && <div className="ci-empty">No tables available.</div>}
          </div>
        </section>

        <aside className="cashier-sidebar">
          <header className="ci-sidebar-header"><div><span className="ci-sidebar-kicker">Cashier</span><h2>{selected ? selected.group.displayLabel : 'Select a table'}</h2></div><Receipt className="ci-header-icon" /></header>
          <div className="ci-sidebar-body">
            {!selected ? <div className="ci-sidebar-empty">Select an enabled table card to review its active order.</div> : (
              <>
                <div className="ci-top-body">
                  <div className="ci-guest-info">
                    <Users className="ci-icon" />
                    <span>{selected.group.currentGuestCount}/{selected.group.capacity}</span>
                  </div>
                  <div className="ci-order-type">{activeItems.length > 0 && activeItems[0].orderType === 'TAKEOUT' ? 'Takeout' : 'Dine In'}</div>
                </div>
                {activeItems.length === 0 ? (
                  <div className="ci-sidebar-empty">No active orders for this table.</div>
                ) : (
                  <div className="ci-items-table">
                    <div className="ci-items-header">
                      <span>Name</span>
                      <span>
                        PWD
                        <input type="checkbox" checked={applyAllPwd} onChange={(e) => { setApplyAllPwd(e.target.checked); applyDiscountToAll('pwd', e.target.checked); }} />
                      </span>
                      <span>
                        Senior
                        <input type="checkbox" checked={applyAllSenior} onChange={(e) => { setApplyAllSenior(e.target.checked); applyDiscountToAll('senior', e.target.checked); }} />
                      </span>
                      <span>
                        Custom
                        <input type="number" min="0" max="100" value={applyAllCustom} onChange={(e) => { const val = Number(e.target.value) || 0; setApplyAllCustom(val); applyDiscountToAll('custom', val); }} />
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
                        
                        // If counter would be on its own line, move last word with it
                        if (isMultiple && nameParts.length > 1) {
                          const lastWord = nameParts[nameParts.length - 1]
                          displayName = nameParts.slice(0, -1).join(' ')
                          displayCounter = `${lastWord} ${counter}`
                        }
                        
                        // Single item - render as a simple row without grouping
                        if (!isMultiple) {
                          const item = group.items[0]
                          const discount = itemDiscounts.get(item.orderItemId) ?? { pwd: false, senior: false, custom: 0 }
                          return (
                            <div key={group.name} className="ci-item-group">
                              <div className={`ci-item-row ${groupIndex % 2 === 0 ? 'ci-row-even' : 'ci-row-odd'}`}>
                                <span className="ci-item-name">{group.name}</span>
                                <span className="ci-item-checkbox">
                                  <input type="checkbox" checked={discount.pwd} onChange={(e) => updateItemDiscount(item.orderItemId, 'pwd', e.target.checked)} />
                                </span>
                                <span className="ci-item-checkbox">
                                  <input type="checkbox" checked={discount.senior} onChange={(e) => updateItemDiscount(item.orderItemId, 'senior', e.target.checked)} />
                                </span>
                                <span className="ci-item-custom">
                                  <input type="number" min="0" max="100" value={discount.custom} onChange={(e) => updateItemDiscount(item.orderItemId, 'custom', Number(e.target.value) || 0)} />
                                </span>
                                <span className="ci-item-price">{money(item.price / 1.05)}</span>
                              </div>
                            </div>
                          )
                        }
                        
                        // Multiple items - render as collapsible group
                        return (
                          <div key={group.name} className="ci-item-group">
                            <div className={`ci-item-row ${isMultiple && isCollapsed ? 'ci-collapsed-row' : ''} ${isMultiple && !isCollapsed ? 'ci-item-group-header' : ''} ${groupIndex % 2 === 0 ? 'ci-row-even' : 'ci-row-odd'}`}>
                              <span className="ci-item-name">
                                {isMultiple && (
                                  <button type="button" className="ci-collapse-btn" onClick={() => toggleGroup(group.name)}>
                                    {isCollapsed ? <ChevronRight className="ci-icon-sm" /> : <ChevronDown className="ci-icon-sm" />}
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
                                <input type="checkbox" checked={Boolean(getGroupDiscount(group, 'pwd'))} onChange={(e) => updateGroupDiscount(group, 'pwd', e.target.checked)} />
                              </span>
                              <span className="ci-item-checkbox">
                                <input type="checkbox" checked={Boolean(getGroupDiscount(group, 'senior'))} onChange={(e) => updateGroupDiscount(group, 'senior', e.target.checked)} />
                              </span>
                              <span className="ci-item-custom">
                                <input type="number" min="0" max="100" value={Number(getGroupDiscount(group, 'custom'))} onChange={(e) => updateGroupDiscount(group, 'custom', Number(e.target.value) || 0)} />
                              </span>
                              <span className="ci-item-price">{money(totalPrice)}</span>
                            </div>
                            <div className={`ci-subrows-container ${!isCollapsed ? 'expanded' : ''} ${disableAnimation ? 'no-animation' : ''}`}>
                              <div className="ci-subrows-inner">
                                {group.items.map((item, itemIndex) => {
                                  const discount = itemDiscounts.get(item.orderItemId) ?? { pwd: false, senior: false, custom: 0 }
                                  return (
                                    <div className={`ci-item-row ci-item-subrow ${groupIndex % 2 === 0 ? 'ci-row-even' : 'ci-row-odd'}`} key={item.orderItemId}>
                                      <span className="ci-item-name ci-subitem-name">└ #{itemIndex + 1}</span>
                                      <span className="ci-item-checkbox">
                                        <input type="checkbox" checked={discount.pwd} onChange={(e) => updateItemDiscount(item.orderItemId, 'pwd', e.target.checked)} />
                                      </span>
                                      <span className="ci-item-checkbox">
                                        <input type="checkbox" checked={discount.senior} onChange={(e) => updateItemDiscount(item.orderItemId, 'senior', e.target.checked)} />
                                      </span>
                                      <span className="ci-item-custom">
                                        <input type="number" min="0" max="100" value={discount.custom} onChange={(e) => updateItemDiscount(item.orderItemId, 'custom', Number(e.target.value) || 0)} />
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
            <div className="ci-total-row"><span>Subtotal</span><span>{money(subtotal)}</span></div>
            {pwdCount > 0 && <div className="ci-total-row ci-discount-total"><span>PWD Discounts ({pwdCount})</span><span>-{money(subtotal * 0.2 * pwdCount / activeItems.length)}</span></div>}
            {seniorCount > 0 && <div className="ci-total-row ci-discount-total"><span>Senior Discounts ({seniorCount})</span><span>-{money(subtotal * 0.2 * seniorCount / activeItems.length)}</span></div>}
            {customTotal > 0 && <div className="ci-total-row ci-discount-total"><span>Custom Discounts</span><span>-{money(customTotal)}</span></div>}
            <div className="ci-total-row"><span>VAT (5%)</span><span>{money(taxableSubtotal * 0.05)}</span></div>
            <div className="ci-grand-total"><span>Total</span><strong>{money(total)}</strong></div>
            <button type="button" className="ci-settle-button" disabled={!selected || orders.length === 0 || busy} onClick={() => void settle()}><CreditCard className="ci-icon" />{busy ? 'Processing...' : 'Bill Out Customer'}</button>
          </footer>
        </aside>
      </div>
      {receipt && <ReceiptPreviewModal receipt={receipt} onClose={() => setReceipt(null)} />}
      {!receipt && selected && activeBillRequest && <span className="sr-only">Payment requested via {activeBillRequest.paymentMethod}</span>}
    </div>
  )
}
