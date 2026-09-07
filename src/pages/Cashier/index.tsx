import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { fetchAllBillRequests, updateBillRequestStatus } from '@/services/billService'
import {
  fetchOrdersByTable,
  createOrder,
  settleTableOrders,
  deleteOrder,
} from '@/services/orderService'
import { useMenu } from '@/hooks/useMenu'
import { useRealtimeMenu, applyMenuUpdate } from '@/hooks/useRealtimeMenu'
import type { BillRequest } from '@/types/bill'
import type { Order } from '@/types/order'
import type { MenuItem } from '@/types/menu'
import type { CartItem, DiningType } from '@/types/cart'
import { buildReceiptSnapshot } from '@/components/receipt/buildReceipt'
import { ReceiptPreviewModal } from '@/components/receipt/ReceiptPreviewModal'
import type { ReceiptSnapshot } from '@/components/receipt/types'
import { resolveTableGroupByList } from '@/services/tableGroupService'
import type { TableData } from '@/services/tableService'

import { CashierHeader } from './components/CashierHeader'
import { CategoryCardsRow } from './components/CategoryCardsRow'
import { ProductCard } from './components/ProductCard'
import { CashierRightPanel, type CashierRightTab, type DiscountInfo } from './components/CashierRightPanel'
import { TableSelectorModal, type TableItem } from './components/TableSelectorModal'
import { TableAlertsBanner } from '@/components/alerts/TableAlertsBanner'
import {
  resolveTableAssistance,
  recordAssistanceRequest,
  removeAssistanceRequest,
} from '@/services/assistanceService'
import { resolveBillOutRequest } from '@/services/billService'
import type { AssistanceRequest } from '@/types/assistance'

export default function CashierPage() {
  // ── 1. Data States ──
  const [tables, setTables] = useState<TableItem[]>([])
  const [selectedTableId, setSelectedTableId] = useState<number>(1)
  const [tableOrders, setTableOrders] = useState<Order[]>([])
  const [billRequests, setBillRequests] = useState<BillRequest[]>([])
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false)

  // ── 2. UI & Filter States ──
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [activeRightTab, setActiveRightTab] = useState<CashierRightTab>('new')
  const [mobileActiveView, setMobileActiveView] = useState<'menu' | 'cart'>('menu')

  // Popovers & Modals
  const [isTableSelectorOpen, setIsTableSelectorOpen] = useState(false)

  // Receipt state
  const [currentReceipt, setCurrentReceipt] = useState<ReceiptSnapshot | null>(null)
  const [showReceiptModal, setShowReceiptModal] = useState(false)

  // Toast feedback state
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null)

  const showToast = useCallback((text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage({ text, type })
    setTimeout(() => setToastMessage(null), 3500)
  }, [])

  // ── 3. Menu Data Hook ──
  const { items: menuItems, categories } = useMenu()
  const [liveItems, setLiveItems] = useState<MenuItem[]>([])
  useEffect(() => {
    setLiveItems(menuItems)
  }, [menuItems])

  useRealtimeMenu((itemId, isSoldOut) => {
    setLiveItems((prev) => applyMenuUpdate(prev, itemId, isSoldOut))
  })

  // ── 4. Punch Cart State (for cashier order entry) ──
  const [punchCart, setPunchCart] = useState<CartItem[]>([])
  const [diningType, setDiningType] = useState<DiningType>('dine-in')
  const [serverNote, setServerNote] = useState('')

  // Selected table group object (resolves merged tables into unified dining session)
  const selectedGroup = useMemo(
    () => resolveTableGroupByList(selectedTableId, tables as unknown as TableData[]),
    [tables, selectedTableId],
  )

  // Selected table object (primary/anchor table)
  const selectedTable = useMemo(
    () => tables.find((t) => t.TABLE_ID === selectedGroup.anchorTableId) || (tables.length > 0 ? tables[0] : null),
    [tables, selectedGroup.anchorTableId],
  )

  // Active bill request for any table belonging to this dining session
  const activeBillRequest = useMemo(
    () => billRequests.find((r) => selectedGroup.memberTableIds.includes(r.tableId)) || null,
    [billRequests, selectedGroup.memberTableIds],
  )

  // Keep a ref to selectedTableId to avoid recreating loadInitialData when table selection changes
  const selectedTableIdRef = useRef(selectedTableId)
  useEffect(() => {
    selectedTableIdRef.current = selectedTableId
  }, [selectedTableId])

  // ── 5. Fetch Data ──
  const loadTables = useCallback(async (): Promise<TableItem[]> => {
    try {
      const { data, error } = await supabase
        .from('Restaurant_Tables')
        .select('*')
        .order('TABLE_NUM')

      if (error) throw error
      const tList = (data as TableItem[]) ?? []
      setTables((prev) => {
        if (prev.length === tList.length) {
          const isSame = prev.every((oldT, idx) => {
            const n = tList[idx]
            return (
              n &&
              oldT.TABLE_ID === n.TABLE_ID &&
              oldT.STATUS === n.STATUS &&
              oldT.GUEST_CAPACITY === n.GUEST_CAPACITY &&
              oldT.CURRENT_GUEST_COUNT === n.CURRENT_GUEST_COUNT &&
              oldT.MERGE_GROUP_ID === n.MERGE_GROUP_ID &&
              oldT.BILL_OUT_REQUESTED === n.BILL_OUT_REQUESTED
            )
          })
          if (isSame) return prev
        }
        return tList
      })

      // If current selected table doesn't exist, pick the first
      const curId = selectedTableIdRef.current
      if (tList.length > 0 && (!curId || !tList.some((t) => t.TABLE_ID === curId))) {
        setSelectedTableId(tList[0].TABLE_ID)
      }
      return tList
    } catch (err) {
      console.error('[Cashier] Failed to load tables:', err)
      return []
    }
  }, [])

  const loadTableOrders = useCallback(async (anchorId: number, memberIds?: number[]) => {
    try {
      const orders = await fetchOrdersByTable(anchorId, undefined, memberIds)
      setTableOrders((prev) => {
        if (prev.length === orders.length) {
          const isSame = prev.every((oldO, idx) => {
            const n = orders[idx]
            return (
              n &&
              oldO.orderId === n.orderId &&
              oldO.orderStatus === n.orderStatus &&
              oldO.totalBill === n.totalBill &&
              (oldO.items?.length ?? 0) === (n.items?.length ?? 0)
            )
          })
          if (isSame) return prev
        }
        return orders
      })
    } catch (err) {
      console.error('[Cashier] Failed to fetch orders for table:', err)
    }
  }, [])

  const loadInitialData = useCallback(async () => {
    try {
      // 1. Tables
      const tList = await loadTables()

      // 2. Bill Requests
      const bData = await fetchAllBillRequests()
      setBillRequests((prev) => {
        if (prev.length === bData.length) {
          const isSame = prev.every((oldB, idx) => {
            const n = bData[idx]
            return (
              n &&
              oldB.requestId === n.requestId &&
              oldB.status === n.status &&
              oldB.paymentMethod === n.paymentMethod
            )
          })
          if (isSame) return prev
        }
        return bData
      })

      // 3. Orders for current selected table group
      const curId = selectedTableIdRef.current
      if (curId && tList.length > 0) {
        const grp = resolveTableGroupByList(curId, tList as unknown as TableData[])
        await loadTableOrders(grp.anchorTableId, grp.memberTableIds)
      }
    } catch (err) {
      console.error('[Cashier] Load data error:', err)
    }
  }, [loadTables, loadTableOrders])

  // Sync orders when selected table changes
  useEffect(() => {
    if (selectedTableId && tables.length > 0) {
      const grp = resolveTableGroupByList(selectedTableId, tables as unknown as TableData[])
      void loadTableOrders(grp.anchorTableId, grp.memberTableIds)
    }
  }, [selectedTableId, tables, loadTableOrders])

  // Initial load + Realtime & Polling
  useEffect(() => {
    loadInitialData()

    // Constant background polling every 5000ms when visible
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadInitialData()
      }
    }, 5000)

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadInitialData()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Realtime subscription for Bill Requests
    const billChannel = supabase
      .channel('cashier-bill-requests-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'Bill_Requests' },
        () => {
          loadInitialData()
        }
      )
      .subscribe()

    // Realtime subscription for Orders
    const ordersChannel = supabase
      .channel('cashier-orders-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'Restaurant_Orders' },
        () => {
          loadInitialData()
        }
      )
      .subscribe()

    // Realtime subscription for Tables
    const tablesChannel = supabase
      .channel('cashier-tables-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'Restaurant_Tables' },
        () => {
          loadTables()
        }
      )
      .subscribe()

    // Realtime subscription for Assistance broadcasts
    const assistanceChannel = supabase
      .channel('cashier-assistance-sync')
      .on('broadcast', { event: 'assistance_request' }, (payload) => {
        if (payload?.payload) {
          recordAssistanceRequest(payload.payload as AssistanceRequest)
        }
        loadTables()
      })
      .on('broadcast', { event: 'assistance_resolved' }, (payload) => {
        const tId = payload?.payload?.tableId
        const tIds = payload?.payload?.tableIds
        removeAssistanceRequest(tId, tIds)
        loadTables()
      })
      .subscribe()

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      supabase.removeChannel(billChannel)
      supabase.removeChannel(ordersChannel)
      supabase.removeChannel(tablesChannel)
      supabase.removeChannel(assistanceChannel)
    }
  }, [loadInitialData, loadTables])

  // When selected table changes, fetch its orders immediately
  useEffect(() => {
    if (selectedTableId) {
      loadTableOrders(selectedGroup.anchorTableId, selectedGroup.memberTableIds)
    }
  }, [selectedTableId, selectedGroup.anchorTableId, selectedGroup.memberTableIds, loadTableOrders])


  // ── 6. Handlers ──

  // Bill Request Handlers
  const handleAcknowledgeBillRequest = async (req: BillRequest) => {
    try {
      await updateBillRequestStatus(req.requestId, 'PROCESSING', req.tableId)
      setBillRequests((prev) =>
        prev.map((r) => (r.requestId === req.requestId ? { ...r, status: 'PROCESSING' } : r))
      )
      showToast(`Bill request for Table ${req.tableId} marked processing.`)
    } catch (err) {
      console.error(err)
      showToast('Error updating bill request.', 'error')
    }
  }

  const handleClearAssistance = useCallback(async (tableId: number) => {
    try {
      const affectedIds = await resolveTableAssistance(tableId)
      setTables((prev) =>
        prev.map((t) =>
          affectedIds.includes(t.TABLE_ID)
            ? { ...t, STATUS: 'OCCUPIED', BILL_OUT_REQUESTED: false }
            : t,
        ),
      )
      showToast('Assistance alert cleared.', 'info')
    } catch (err) {
      console.error(err)
      showToast('Failed to clear assistance alert.', 'error')
    }
  }, [showToast])

  const handleClearBillOut = useCallback(async (tableId: number) => {
    try {
      const affectedIds = await resolveBillOutRequest(tableId)
      setTables((prev) =>
        prev.map((t) =>
          affectedIds.includes(t.TABLE_ID)
            ? { ...t, BILL_OUT_REQUESTED: false }
            : t,
        ),
      )
      setBillRequests((prev) =>
        prev.filter((r) => !affectedIds.includes(r.tableId)),
      )
      showToast('Bill out request cleared.', 'info')
    } catch (err) {
      console.error(err)
      showToast('Failed to clear bill out request.', 'error')
    }
  }, [showToast])

  // Bill Settlement Handler
  const handleCompletePayment = async (discountInfo: DiscountInfo) => {
    if (!selectedTable) return
    const tableId = selectedGroup.anchorTableId
    const tableNum = selectedGroup.displayLabel

    // ── STEP 1: Snapshot receipt BEFORE any DB operations clear the table ──
    // This is critical: once the bill-out runs, tableOrders will be cleared.
    const snapshot = buildReceiptSnapshot({
      tableOrders,
      discountType: discountInfo.discountType,
      customPercent: discountInfo.customPercent,
      activeBillRequest,
      tableId,
      tableNum,
    })

    try {
      // ── STEP 2: Execute bill-out DB operations ──
      // 1. Settle all active table orders across all member tables in the group
      await settleTableOrders(selectedGroup.anchorTableId, selectedGroup.memberTableIds)

      // 2. If there are active bill requests for any member table, mark PAID
      const matchedRequests = billRequests.filter((r) =>
        selectedGroup.memberTableIds.includes(r.tableId),
      )
      for (const req of matchedRequests) {
        await updateBillRequestStatus(req.requestId, 'PAID', req.tableId)
      }
      setBillRequests((prev) =>
        prev.filter((r) => !selectedGroup.memberTableIds.includes(r.tableId)),
      )

      // 3. Clear table bill-out requested and mark all member tables AVAILABLE
      await supabase
        .from('Restaurant_Tables')
        .update({
          BILL_OUT_REQUESTED: false,
          STATUS: 'AVAILABLE',
          CURRENT_GUEST_COUNT: 0,
        })
        .in('TABLE_ID', selectedGroup.memberTableIds)

      // ── STEP 3: Clear active cashier state ONLY after DB operations succeed ──
      setTableOrders([])
      setPunchCart([])

      // ── STEP 4: Display the captured receipt snapshot ──
      setCurrentReceipt(snapshot)
      setShowReceiptModal(true)

      showToast(`${tableNum} bill settled and marked Available!`, 'success')
      await loadInitialData()
    } catch (err) {
      console.error('Payment completion error:', err)
      showToast('Failed to complete payment. Order state preserved.', 'error')
    }
  }

  // Print Official Receipt — delegates to the receipt preview modal
  // The modal has the Print button; this fallback is kept for external callers.
  const handlePrintReceipt = () => {
    if (currentReceipt) {
      setShowReceiptModal(true)
    }
  }

  const handleReorder = (order: Order) => {
    const restoredItems = (order.items ?? []).reduce<CartItem[]>((cart, orderItem) => {
      if (orderItem.status === 'CANCELLED') return cart

      const menuItem = liveItems.find((item) => item.id === orderItem.itemId)
      if (!menuItem) return cart

      const existing = cart.find((entry) => entry.item.id === menuItem.id)
      if (existing) {
        existing.quantity += 1
      } else {
        cart.push({ item: menuItem, quantity: 1 })
      }

      return cart
    }, [])

    if (restoredItems.length === 0) {
      showToast('The cancelled order items are no longer available.', 'error')
      return
    }

    setPunchCart(restoredItems)
    setDiningType(order.orderType === 'TAKEOUT' ? 'take-away' : 'dine-in')
    setActiveRightTab('new')
    showToast(`Order #${order.orderId} moved to New Orders for editing.`, 'success')
  }

  const handleDeleteCancelledOrder = async (order: Order) => {
    try {
      await deleteOrder(order.orderId)
      showToast(`Cancelled Order #${order.orderId} deleted.`, 'success')
      await loadTableOrders(selectedTableId)
    } catch (err) {
      console.error('Failed to delete cancelled order:', err)
      showToast('Failed to delete cancelled order.', 'error')
    }
  }

  // ── 7. Punch Cart Handlers ──
  const handleAddToCart = (item: MenuItem) => {
    setPunchCart((prev) => {
      const exists = prev.find((ci) => ci.item.id === item.id)
      if (exists) {
        return prev.map((ci) =>
          ci.item.id === item.id ? { ...ci, quantity: ci.quantity + 1 } : ci
        )
      }
      return [...prev, { item, quantity: 1 }]
    })
    showToast(`Added ${item.name} to punch cart!`, 'info')
  }

  const handleIncreasePunchQty = (itemId: string) => {
    setPunchCart((prev) =>
      prev.map((ci) => (ci.item.id === itemId ? { ...ci, quantity: ci.quantity + 1 } : ci))
    )
  }

  const handleDecreasePunchQty = (itemId: string) => {
    setPunchCart((prev) =>
      prev
        .map((ci) => (ci.item.id === itemId ? { ...ci, quantity: ci.quantity - 1 } : ci))
        .filter((ci) => ci.quantity > 0)
    )
  }

  const handleRemovePunchItem = (itemId: string) => {
    setPunchCart((prev) => prev.filter((ci) => ci.item.id !== itemId))
  }

  const handleClearPunchCart = () => {
    setPunchCart([])
  }

  // Submit Order from Cashier to Kitchen
  const handleSendOrderToKitchen = async () => {
    if (!selectedTableId || punchCart.length === 0) return
    setIsSubmittingOrder(true)

    try {
      const subtotal = punchCart.reduce((sum, ci) => sum + ci.item.price * ci.quantity, 0)
      const total = subtotal * 1.05

      await createOrder(selectedGroup.anchorTableId, punchCart, diningType, total, 'Cashier', serverNote)

      showToast(`Order sent to Kitchen for ${selectedGroup.displayLabel}!`, 'success')
      setPunchCart([])
      setServerNote('')
      setActiveRightTab('pending')
      await loadTableOrders(selectedGroup.anchorTableId, selectedGroup.memberTableIds)
      await loadTables()
    } catch (err) {
      console.error('Failed to punch order:', err)
      showToast('Failed to submit order. Please try again.', 'error')
    } finally {
      setIsSubmittingOrder(false)
    }
  }

  // ── 8. Filtered Items & Pagination ──
  const filteredItems = useMemo(() => {
    const list = liveItems.filter((item) => {
      // 1. Search Query
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        if (!item.name.toLowerCase().includes(q) && !item.code.toLowerCase().includes(q)) {
          return false
        }
      }
      // 2. Category
      if (selectedCategory === 'best_sellers') {
        if (!item.isBestSeller) return false
      } else if (selectedCategory !== 'all' && item.categoryId !== selectedCategory) {
        return false
      }
      return true
    })

    // Sort best sellers on top
    return list.sort((a, b) => {
      if (a.isBestSeller && !b.isBestSeller) return -1
      if (!a.isBestSeller && b.isBestSeller) return 1
      return 0
    })
  }, [liveItems, searchQuery, selectedCategory])

  const currentCategoryName = useMemo(() => {
    if (selectedCategory === 'all') return 'All Menu'
    if (selectedCategory === 'best_sellers') return 'Best Sellers'
    const found = categories.find((c) => c.id === selectedCategory)
    return found ? found.name : 'Dishes'
  }, [selectedCategory, categories])

  return (
    <div className="cashier-page-container">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl shadow-xl border bg-[#14274E] text-white text-xs font-bold animate-slide-down flex items-center gap-2">
          <span>{toastMessage.text}</span>
        </div>
      )}

      <div className="cashier-layout">
        <div className="inner-cashier-interface-container">
          <div className="cashier-header">
            <CashierHeader
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              selectedTable={selectedTable}
              selectedTableLabel={selectedGroup.displayLabel}
              onOpenTableSelector={() => setIsTableSelectorOpen(true)}
            />
          </div>

          {/* ── Table Alerts (Bill Out & Assistance) placed just below search bar ── */}
          <div className="px-6 pt-1 pb-1 shrink-0">
            <TableAlertsBanner
              tables={tables}
              billRequests={billRequests}
              onSelectTable={(tableId) => {
                setSelectedTableId(tableId)
                showToast(`Switched to Table ${tableId}`, 'info')
              }}
              onClearAssistance={handleClearAssistance}
              onClearBillOut={handleClearBillOut}
            />
          </div>

          <div className="cashier-categories">
            <CategoryCardsRow
              categories={categories}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
            />
          </div>

          <div className="flex lg:hidden px-3 pt-2 pb-1 shrink-0">
            <div className="flex bg-slate-200/80 p-1 rounded-xl w-full gap-1">
              <button
                onClick={() => setMobileActiveView('menu')}
                className={[
                  'flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer',
                  mobileActiveView === 'menu' ? 'bg-white text-[#14274E] shadow-xs font-extrabold' : 'text-slate-600 hover:text-[#14274E]',
                ].join(' ')}
              >
                <span>Menu Dishes</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 font-bold">{filteredItems.length}</span>
              </button>
              <button
                onClick={() => setMobileActiveView('cart')}
                className={[
                  'flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer',
                  mobileActiveView === 'cart' ? 'bg-white text-[#14274E] shadow-xs font-extrabold' : 'text-slate-600 hover:text-[#14274E]',
                ].join(' ')}
              >
                <span>Ticket &amp; Cart</span>
                {punchCart.length > 0 && <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#14274E] text-white font-extrabold">{punchCart.reduce((sum, i) => sum + i.quantity, 0)}</span>}
              </button>
            </div>
          </div>

          <div className="cashier-menu-items">
            {/* Left Section: Menu Items Grid */}
            <div
              className={[
                'cashier-menu-items-content min-w-0 flex-col overflow-hidden',
                mobileActiveView === 'menu' ? 'flex' : 'hidden lg:flex',
              ].join(' ')}
            >
          {/* Header count bar for Category */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200/80 shrink-0 text-xs text-slate-500">
            <span className="cashier-selected-category-label font-semibold">
              <strong className="text-[#14274E] font-extrabold">{currentCategoryName}</strong>
              <span className="ml-1.5 text-slate-400">({filteredItems.length} dish{filteredItems.length !== 1 ? 'es' : ''})</span>
            </span>
          </div>

          {/* Dishes Grid — Smoothly Scrollable */}
          <div className="flex-1 overflow-y-auto pr-1 pb-4">
            {filteredItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs py-16">
                <span className="font-bold text-sm text-slate-600 mb-1">No dishes found</span>
                <span>Try adjusting your search or category filter.</span>
              </div>
            ) : (
              <div
                key={selectedCategory}
                className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-5 pb-6"
              >
                {filteredItems.map((item) => {
                  const cartEntry = punchCart.find((ci) => ci.item.id === item.id)
                  const quantityInCart = cartEntry ? cartEntry.quantity : 0
                  return (
                    <ProductCard
                      key={item.id}
                      item={item}
                      quantityInCart={quantityInCart}
                      onAddToCart={handleAddToCart}
                      onDecreaseQty={handleDecreasePunchQty}
                    />
                  )
                })}
              </div>
            )}
          </div>
            </div>
          </div>
        </div>

        {/* Floating order sidebar */}
        <div
          className={[
            'sidebar-container min-w-0 h-full flex-col',
            mobileActiveView === 'cart' ? 'flex' : 'hidden lg:flex',
          ].join(' ')}
        >
          <CashierRightPanel
            selectedTable={selectedTable}
            tableLabel={selectedGroup.displayLabel}
            activeTab={activeRightTab}
            onTabChange={setActiveRightTab}
            tableOrders={tableOrders}
            activeBillRequest={activeBillRequest}
            onAcknowledgeBillRequest={handleAcknowledgeBillRequest}
            onCompletePayment={handleCompletePayment}
            onPrintReceipt={handlePrintReceipt}
            onReorder={handleReorder}
            onDeleteCancelledOrder={handleDeleteCancelledOrder}
            punchCart={punchCart}
            diningType={diningType}
            onDiningTypeChange={setDiningType}
            serverNote={serverNote}
            onServerNoteChange={setServerNote}
            onIncreasePunchQty={handleIncreasePunchQty}
            onDecreasePunchQty={handleDecreasePunchQty}
            onRemovePunchItem={handleRemovePunchItem}
            onSendOrderToKitchen={handleSendOrderToKitchen}
            onClearPunchCart={handleClearPunchCart}
            isSubmittingOrder={isSubmittingOrder}
          />
        </div>
      </div>

      {/* Table Selector Modal */}
      <TableSelectorModal
        isOpen={isTableSelectorOpen}
        tables={tables}
        selectedTableId={selectedTableId}
        onSelectTable={(tableId) => {
          setSelectedTableId(tableId)
          setActiveRightTab('new')
        }}
        onClose={() => setIsTableSelectorOpen(false)}
      />

      {/* Receipt Preview Modal */}
      {showReceiptModal && currentReceipt && (
        <ReceiptPreviewModal
          receipt={currentReceipt}
          onClose={() => setShowReceiptModal(false)}
        />
      )}
    </div>
  )
}
