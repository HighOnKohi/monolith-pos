import { useState, useEffect, useCallback, useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { fetchAllBillRequests, updateBillRequestStatus } from '@/services/billService'
import { resolveTableAssistance } from '@/services/assistanceService'
import { fetchOrdersByTable, createOrder } from '@/services/orderService'
import { useMenu } from '@/hooks/useMenu'
import { useRealtimeMenu, applyMenuUpdate } from '@/hooks/useRealtimeMenu'
import type { BillRequest } from '@/types/bill'
import type { AssistanceRequest } from '@/types/assistance'
import type { Order } from '@/types/order'
import type { MenuItem } from '@/types/menu'
import type { CartItem, DiningType } from '@/types/cart'
import { buildReceiptSnapshot } from '@/components/receipt/buildReceipt'
import { ReceiptPreviewModal } from '@/components/receipt/ReceiptPreviewModal'
import type { ReceiptSnapshot } from '@/components/receipt/types'

import { CashierHeader, type DietaryFilter } from './components/CashierHeader'
import { CategoryCardsRow } from './components/CategoryCardsRow'
import { ProductCard } from './components/ProductCard'
import { CashierRightPanel, type CashierRightTab, type DiscountInfo } from './components/CashierRightPanel'
import { TableSelectorModal, type TableItem } from './components/TableSelectorModal'

export default function CashierPage() {
  // ── 1. Data States ──
  const [tables, setTables] = useState<TableItem[]>([])
  const [selectedTableId, setSelectedTableId] = useState<number>(1)
  const [tableOrders, setTableOrders] = useState<Order[]>([])
  const [billRequests, setBillRequests] = useState<BillRequest[]>([])
  const [assistanceRequests, setAssistanceRequests] = useState<AssistanceRequest[]>([])
  const [verifiedOrders, setVerifiedOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false)

  // ── 2. UI & Filter States ──
  const [searchQuery, setSearchQuery] = useState('')
  const [dietaryFilter, setDietaryFilter] = useState<DietaryFilter>('all')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [activeRightTab, setActiveRightTab] = useState<CashierRightTab>('bill')
  const [mobileActiveView, setMobileActiveView] = useState<'menu' | 'cart'>('menu')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 3

  // Popovers & Modals
  const [isAssistanceOpen, setIsAssistanceOpen] = useState(false)
  const [isVerifiedOpen, setIsVerifiedOpen] = useState(false)
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

  // Selected table object
  const selectedTable = useMemo(
    () => tables.find((t) => t.TABLE_ID === selectedTableId) || (tables.length > 0 ? tables[0] : null),
    [tables, selectedTableId]
  )

  // Active bill request for the selected table (if customer requested checkout)
  const activeBillRequest = useMemo(
    () => billRequests.find((r) => r.tableId === selectedTableId) || null,
    [billRequests, selectedTableId]
  )

  // ── 5. Fetch Data ──
  const loadTables = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('Restaurant_Tables')
        .select('*')
        .order('TABLE_NUM')

      if (error) throw error
      const tList = (data as TableItem[]) ?? []
      setTables(tList)

      // If current selected table doesn't exist, pick the first
      if (tList.length > 0 && !tList.some((t) => t.TABLE_ID === selectedTableId)) {
        setSelectedTableId(tList[0].TABLE_ID)
      }
    } catch (err) {
      console.error('[Cashier] Failed to load tables:', err)
    }
  }, [selectedTableId])

  const loadTableOrders = useCallback(async (tableId: number) => {
    try {
      const orders = await fetchOrdersByTable(tableId)
      setTableOrders(orders)
    } catch (err) {
      console.error('[Cashier] Failed to fetch orders for table:', err)
    }
  }, [])

  const loadInitialData = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true)
    try {
      // 1. Tables
      await loadTables()

      // 2. Bill Requests
      const bData = await fetchAllBillRequests()
      setBillRequests(bData)

      // 3. Verified Kitchen Orders
      const { data: vData } = await supabase
        .from('Restaurant_Orders')
        .select('*')
        .eq('ORDER_STATUS', 'VERIFIED')
        .order('ORDER_ID', { ascending: false })

      if (vData) {
        setVerifiedOrders(
          vData.map((row) => ({
            orderId: Number(row['ORDER_ID']),
            tableId: Number(row['TABLE_ID']),
            orderStatus: row['ORDER_STATUS'],
            orderType: row['ORDER_TYPE'],
            totalBill: Number(row['TOTAL_BILL'] ?? 0),
            createdAt: row['TIME'],
          }))
        )
      }

      // 4. Assistance requests from tables with HAS_REQUEST
      const { data: tData } = await supabase
        .from('Restaurant_Tables')
        .select('TABLE_ID, TABLE_NUM, STATUS, BILL_OUT_REQUESTED')
        .eq('STATUS', 'HAS_REQUEST')

      if (tData && tData.length > 0) {
        const active: AssistanceRequest[] = tData.map((t) => ({
          id: `table_req_${t.TABLE_ID}`,
          tableId: Number(t.TABLE_ID),
          tableNum: Number(t.TABLE_NUM),
          type: t.BILL_OUT_REQUESTED ? 'BILL_OUT' : 'WAITER',
          title: t.BILL_OUT_REQUESTED ? 'Bill Out Assistance' : 'Table Assistance Needed',
          status: 'PENDING',
          requestedAt: new Date().toISOString(),
        }))
        setAssistanceRequests(active)
      } else {
        setAssistanceRequests([])
      }

      // 5. Orders for current selected table
      if (selectedTableId) {
        await loadTableOrders(selectedTableId)
      }
    } catch (err) {
      console.error('[Cashier] Load data error:', err)
    } finally {
      if (!silent) setIsLoading(false)
    }
  }, [loadTables, loadTableOrders, selectedTableId])

  // Initial load + Realtime & Polling
  useEffect(() => {
    loadInitialData(false)

    // Constant background polling every 2500ms
    const interval = setInterval(() => {
      loadInitialData(true)
    }, 2500)

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadInitialData(true)
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
          loadInitialData(true)
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
          loadInitialData(true)
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

    // Realtime subscription for Assistance Broadcasts
    const assistChannel = supabase
      .channel('table-assistance')
      .on('broadcast', { event: 'assistance_request' }, (payload) => {
        const req = payload.payload as AssistanceRequest
        setAssistanceRequests((prev) => {
          const filtered = prev.filter((r) => r.tableId !== req.tableId)
          return [req, ...filtered]
        })
      })
      .on('broadcast', { event: 'assistance_resolved' }, (payload) => {
        const { tableId } = payload.payload as { tableId: number }
        setAssistanceRequests((prev) => prev.filter((r) => r.tableId !== tableId))
      })
      .subscribe()

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      supabase.removeChannel(billChannel)
      supabase.removeChannel(ordersChannel)
      supabase.removeChannel(tablesChannel)
      supabase.removeChannel(assistChannel)
    }
  }, [loadInitialData, loadTables])

  // When selected table changes, fetch its orders immediately
  useEffect(() => {
    if (selectedTableId) {
      loadTableOrders(selectedTableId)
    }
  }, [selectedTableId, loadTableOrders])

  // Reset page when category, search, or dietary filter changes
  useEffect(() => {
    setCurrentPage(1)
  }, [selectedCategory, searchQuery, dietaryFilter])

  // ── 6. Handlers ──

  // Assistance Handlers
  const handleResolveAssistance = async (tableId: number) => {
    setAssistanceRequests((prev) => prev.filter((r) => r.tableId !== tableId))
    await resolveTableAssistance(tableId)
    showToast(`Assistance for Table ${tableId} resolved.`)
  }

  // Kitchen-Verified Order Handlers
  const handleAcknowledgeVerifiedOrder = async (orderId: number) => {
    try {
      await supabase
        .from('Restaurant_Orders')
        .update({ ORDER_STATUS: 'PREPARING' })
        .eq('ORDER_ID', orderId)

      setVerifiedOrders((prev) => prev.filter((o) => o.orderId !== orderId))
      showToast(`Order #${orderId} confirmed and moved to prep!`)
      loadInitialData(true)
    } catch (err) {
      console.error('Failed to acknowledge order:', err)
      showToast('Failed to acknowledge order.', 'error')
    }
  }

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

  // Bill Settlement Handler
  const handleCompletePayment = async (discountInfo: DiscountInfo) => {
    if (!selectedTable) return
    const tableId = selectedTable.TABLE_ID
    const tableNum = selectedTable.TABLE_NUM || selectedTable.TABLE_ID

    // ── STEP 1: Snapshot receipt BEFORE any DB operations clear the table ──
    // This is critical: once the bill-out runs, tableOrders will be empty.
    const snapshot = buildReceiptSnapshot({
      tableOrders,
      discountType: discountInfo.discountType,
      customPercent: discountInfo.customPercent,
      activeBillRequest,
      tableId,
      tableNum,
    })

    // Show receipt preview immediately (data is safely captured in snapshot)
    setCurrentReceipt(snapshot)
    setShowReceiptModal(true)

    try {
      // ── STEP 2: Execute bill-out DB operations ──
      // 1. If there is an active bill request, mark PAID
      if (activeBillRequest) {
        await updateBillRequestStatus(activeBillRequest.requestId, 'PAID', tableId)
        setBillRequests((prev) => prev.filter((r) => r.requestId !== activeBillRequest.requestId))
      }

      // 2. Clear table bill-out requested and mark table AVAILABLE
      await supabase
        .from('Restaurant_Tables')
        .update({
          BILL_OUT_REQUESTED: false,
          STATUS: 'AVAILABLE',
          CURRENT_GUEST_COUNT: 0,
        })
        .eq('TABLE_ID', tableId)

      showToast(`Table ${tableNum} bill settled and marked Available!`, 'success')
      await loadInitialData(true)
    } catch (err) {
      console.error('Payment completion error:', err)
      showToast('Failed to complete payment.', 'error')
    }
  }

  // Print Official Receipt — delegates to the receipt preview modal
  // The modal has the Print button; this fallback is kept for external callers.
  const handlePrintReceipt = () => {
    if (currentReceipt) {
      setShowReceiptModal(true)
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

  const handleUpdatePunchNotes = (itemId: string, notes: string) => {
    setPunchCart((prev) =>
      prev.map((ci) => (ci.item.id === itemId ? { ...ci, notes } : ci))
    )
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

      await createOrder(selectedTableId, punchCart, diningType, total, 'Cashier')

      showToast(`Order sent to Kitchen for Table ${selectedTable?.TABLE_NUM || selectedTableId}!`, 'success')
      setPunchCart([])
      setActiveRightTab('orders')
      await loadTableOrders(selectedTableId)
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
      // 3. Dietary Filter
      if (dietaryFilter !== 'all' && item.dietaryType !== dietaryFilter) {
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
  }, [liveItems, searchQuery, selectedCategory, dietaryFilter])

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / itemsPerPage))
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredItems.slice(start, start + itemsPerPage)
  }, [filteredItems, currentPage, itemsPerPage])

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

      {/* Top Header Bar */}
      <CashierHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        dietaryFilter={dietaryFilter}
        onDietaryChange={setDietaryFilter}
        selectedTable={selectedTable}
        onOpenTableSelector={() => setIsTableSelectorOpen(true)}
        assistanceRequests={assistanceRequests}
        verifiedOrders={verifiedOrders}
        isAssistanceOpen={isAssistanceOpen}
        isVerifiedOpen={isVerifiedOpen}
        onToggleAssistance={() => {
          setIsAssistanceOpen((v) => !v)
          setIsVerifiedOpen(false)
        }}
        onToggleVerified={() => {
          setIsVerifiedOpen((v) => !v)
          setIsAssistanceOpen(false)
        }}
        onCloseAllPopovers={() => {
          setIsAssistanceOpen(false)
          setIsVerifiedOpen(false)
        }}
        onResolveAssistance={handleResolveAssistance}
        onAcknowledgeVerifiedOrder={handleAcknowledgeVerifiedOrder}
        onRefresh={() => void loadInitialData()}
        isRefreshing={isLoading}
      />

      {/* Category Cards Carousel Row matching reference image */}
      <CategoryCardsRow
        categories={categories}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
      />

      {/* Mobile View Switcher (Menu Dishes vs Ticket & Cart) - only visible on < lg */}
      <div className="flex lg:hidden px-3 pt-2 pb-1 shrink-0">
        <div className="flex bg-slate-200/80 p-1 rounded-xl w-full gap-1">
          <button
            onClick={() => setMobileActiveView('menu')}
            className={[
              'flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer',
              mobileActiveView === 'menu'
                ? 'bg-white text-[#14274E] shadow-xs font-extrabold'
                : 'text-slate-600 hover:text-[#14274E]',
            ].join(' ')}
          >
            <span>Menu Dishes</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 font-bold">
              {filteredItems.length}
            </span>
          </button>
          <button
            onClick={() => setMobileActiveView('cart')}
            className={[
              'flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer',
              mobileActiveView === 'cart'
                ? 'bg-white text-[#14274E] shadow-xs font-extrabold'
                : 'text-slate-600 hover:text-[#14274E]',
            ].join(' ')}
          >
            <span>Ticket &amp; Cart</span>
            {punchCart.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#14274E] text-white font-extrabold">
                {punchCart.reduce((sum, i) => sum + i.quantity, 0)}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Main Content Area: Split View on Desktop / Tabbed on Mobile */}
      <div className="flex-1 min-w-0 max-w-full flex overflow-hidden p-4 sm:p-5 lg:p-6 gap-4 lg:gap-5">
        {/* Left Section: Menu Items Grid & Pagination */}
        <div
          className={[
            'flex-1 min-w-0 flex-col overflow-hidden',
            mobileActiveView === 'menu' ? 'flex' : 'hidden lg:flex',
          ].join(' ')}
        >
          {/* Dishes Grid */}
          <div className="flex-1 overflow-y-auto pr-1">
            {filteredItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs py-16">
                <span className="font-bold text-sm text-slate-600 mb-1">No dishes found</span>
                <span>Try adjusting your search or category filter.</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-5">
                {paginatedItems.map((item) => {
                  const cartEntry = punchCart.find((ci) => ci.item.id === item.id)
                  const quantityInCart = cartEntry ? cartEntry.quantity : 0
                  return (
                    <ProductCard
                      key={item.id}
                      item={item}
                      quantityInCart={quantityInCart}
                      onAddToCart={handleAddToCart}
                      onIncreaseQty={handleIncreasePunchQty}
                      onDecreaseQty={handleDecreasePunchQty}
                    />
                  )
                })}
              </div>
            )}
          </div>

          {/* Bottom Pagination Bar matching reference image */}
          <div className="mt-3 pt-3 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-500 shrink-0">
            <span className="font-medium">
              Showing {paginatedItems.length} of {filteredItems.length} items in{' '}
              <strong className="text-[#14274E] font-extrabold">{currentCategoryName}</strong>
            </span>

            {/* Pagination Controls matching reference image */}
            <div className="flex items-center gap-1.5">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="w-7 h-7 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 flex items-center justify-center text-slate-700 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={[
                    'w-7 h-7 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center',
                    currentPage === page
                      ? 'bg-[#14274E] text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50',
                  ].join(' ')}
                >
                  {page}
                </button>
              ))}

              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="w-7 h-7 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 flex items-center justify-center text-slate-700 transition-colors cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Section: POS Inspector / Order / Receipt Panel (320px-340px wide on desktop, full width on mobile) */}
        <div
          className={[
            'w-full lg:w-[320px] xl:w-[340px] shrink-0 min-w-0 h-full flex-col',
            mobileActiveView === 'cart' ? 'flex' : 'hidden lg:flex',
          ].join(' ')}
        >
          <CashierRightPanel
            selectedTable={selectedTable}
            activeTab={activeRightTab}
            onTabChange={setActiveRightTab}
            onOpenTableSelector={() => setIsTableSelectorOpen(true)}
            tableOrders={tableOrders}
            activeBillRequest={activeBillRequest}
            onAcknowledgeBillRequest={handleAcknowledgeBillRequest}
            onCompletePayment={handleCompletePayment}
            onPrintReceipt={handlePrintReceipt}
            punchCart={punchCart}
            diningType={diningType}
            onDiningTypeChange={setDiningType}
            onIncreasePunchQty={handleIncreasePunchQty}
            onDecreasePunchQty={handleDecreasePunchQty}
            onRemovePunchItem={handleRemovePunchItem}
            onUpdatePunchNotes={handleUpdatePunchNotes}
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
          setActiveRightTab('bill')
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
