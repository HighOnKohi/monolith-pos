import { useState, useMemo, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import PageLoader from '@/components/common/PageLoader'
import { SearchBar } from '@/components/customer/SearchBar'
import type { DietaryFilter } from '@/components/customer/FilterSheet'
import { CategorySelector } from '@/components/customer/CategorySelector'
import { MenuGrid } from '@/components/customer/MenuGrid'
import { MenuItemDetail } from '@/components/customer/MenuItemDetail'
import { CartSummary } from '@/components/customer/CartSummary'
import { OrderStatusTracker } from '@/components/customer/OrderStatusTracker'
import { AdvanceOrderHeader } from './components/AdvanceOrderHeader'
import { CustomerNameGate } from './components/CustomerNameGate'
import { AdvanceOrderTab } from './components/AdvanceOrderTab'
import { AdvanceOrderTableModal } from './components/AdvanceOrderTableModal'
import { AdvanceOrderBottomNav, type AdvanceOrderTabType } from './components/AdvanceOrderBottomNav'

import { useMenu } from '@/hooks/useMenu'
import { useBusinessDay } from '@/hooks/useBusinessDay'
import { useSharedCart } from '@/hooks/useSharedCart'
import { supabase } from '@/lib/supabase'
import type { MenuItem } from '@/types/menu'
import type { DiningType } from '@/types/cart'
import type { AdvanceOrder } from '@/types/advanceOrder'
import {
  getPreOrderSession,
  saveCustomerName,
  savePreOrderTable,
  releaseTableReservation,
  createAdvanceOrder,
  getActiveAdvanceOrder,
  cancelAdvanceOrder,
  clearActiveAdvanceOrder,
  resetAdvanceOrderSession,
  getRemainingSeconds,
  formatCountdown,
  setActiveSessionToken,
} from '@/services/advanceOrderService'

export default function AdvanceOrderPage() {
  const { token: urlToken } = useParams<{ token?: string }>()
  const navigate = useNavigate()

  // Ensure body and documentElement allow free scrolling on the advance order interface
  useEffect(() => {
    document.body.style.overflowY = 'auto'
    document.body.style.height = 'auto'
    document.documentElement.style.overflowY = 'auto'
    document.documentElement.style.height = 'auto'
    return () => {
      document.body.style.overflowY = ''
      document.body.style.height = ''
      document.documentElement.style.overflowY = ''
      document.documentElement.style.height = ''
    }
  }, [])

  // ─── States ─────────────────────────────────────────────────────────────────
  const { isOpen } = useBusinessDay()
  const [activeTab, setActiveTab] = useState<AdvanceOrderTabType>('menu')
  const [activeOrder, setActiveOrder] = useState<AdvanceOrder | null>(null)
  const [isLoadingOrder, setIsLoadingOrder] = useState(true)

  // Pre-Order Session
  const [customerName, setCustomerName] = useState<string>('')
  const [isNameGateOpen, setIsNameGateOpen] = useState(false)
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null)
  const [selectedTableNum, setSelectedTableNum] = useState<number | null>(null)
  const [guestCount, setGuestCount] = useState<number>(2)
  const [isTableModalOpen, setIsTableModalOpen] = useState(false)

  // Realtime Shared Cart
  const {
    items: cartItems,
    diningType,
    setDiningType,
    addItem,
    setItemQuantity,
    removeItem,
    increaseQty,
    decreaseQty,
    updateNotes,
    clearCart,
    total,
    itemCount,
    getQuantity,
    isLockedByOther,
    acquireLock,
    releaseLock,
  } = useSharedCart(selectedTableId)

  const [isCartExpanded, setIsCartExpanded] = useState(false)
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false)
  const [orderError, setOrderError] = useState<string | null>(null)

  // Menu Search & Filter
  const [searchQuery, setSearchQuery] = useState('')
  const [dietaryFilter, setDietaryFilter] = useState<DietaryFilter>('all')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [activeItem, setActiveItem] = useState<MenuItem | null>(null)

  // Live Timer string for header & nav
  const [countdownString, setCountdownString] = useState<string>('')

  // ─── Initialize Order & Pre-Order Session ───────────────────────────────────
  useEffect(() => {
    let isMounted = true

    async function initSession() {
      setIsLoadingOrder(true)

      // If URL has a token, register it
      if (urlToken) {
        setActiveSessionToken(urlToken)
      }

      // Check for active submitted order
      const existingOrder = await getActiveAdvanceOrder(urlToken)
      if (!isMounted) return

      if (existingOrder) {
        setActiveOrder(existingOrder)
        // Default to order tab if an order is active and unexpired
        const remaining = getRemainingSeconds(existingOrder.expiresAt)
        if (remaining > 0 || existingOrder.status === 'CANCELLED') {
          setActiveTab('order')
        }
      } else {
        // Load pre-order session
        const preOrder = getPreOrderSession()
        setCustomerName(preOrder.customerName)
        setDiningType(preOrder.diningType)
        setSelectedTableId(preOrder.tableId ?? null)
        setSelectedTableNum(preOrder.tableNum ?? null)
        if (preOrder.guestCount) setGuestCount(preOrder.guestCount)

        // If no customer name is set, open the setup gate
        if (!preOrder.customerName) {
          setIsNameGateOpen(true)
        }
      }

      setIsLoadingOrder(false)
    }

    initSession()

    return () => {
      isMounted = false
    }
  }, [urlToken, setDiningType])

  // Synchronize live countdown string for header & nav bar
  useEffect(() => {
    if (!activeOrder) {
      setCountdownString('')
      return
    }

    const updateTimer = () => {
      const remaining = getRemainingSeconds(activeOrder.expiresAt)
      setCountdownString(formatCountdown(remaining))
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [activeOrder])

  // Realtime subscription for active advance order status changes
  useEffect(() => {
    if (!activeOrder?.sessionToken) return

    const token = activeOrder.sessionToken
    const channel = supabase
      .channel(`advance-order-live-${token}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'orders',
          table: 'Advance_Orders',
          filter: `SESSION_TOKEN=eq.${token}`,
        },
        async () => {
          const fresh = await getActiveAdvanceOrder(token)
          if (fresh) setActiveOrder(fresh)
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'Advance_Orders',
          filter: `SESSION_TOKEN=eq.${token}`,
        },
        async () => {
          const fresh = await getActiveAdvanceOrder(token)
          if (fresh) setActiveOrder(fresh)
        },
      )
      .subscribe()

    const handleVisibility = async () => {
      if (document.visibilityState === 'visible') {
        const fresh = await getActiveAdvanceOrder(token)
        if (fresh) setActiveOrder(fresh)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      supabase.removeChannel(channel)
    }
  }, [activeOrder?.sessionToken])

  // Auto-collapse cart drawer if empty
  useEffect(() => {
    if (cartItems.length === 0) {
      setIsCartExpanded(false)
    }
  }, [cartItems.length])

  // ─── Menu Data Hook ─────────────────────────────────────────────────────────
  const { items, categories, loadState } = useMenu()

  // Derived filtered items
  const filteredItems = useMemo(() => {
    const list = items.filter((item) => {
      // Search
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        if (!item.name.toLowerCase().includes(q) && !item.code.toLowerCase().includes(q)) {
          return false
        }
      }
      // Category
      if (selectedCategory === 'best_sellers') {
        if (!item.isBestSeller) return false
      } else if (selectedCategory !== 'all' && item.categoryId !== selectedCategory) {
        return false
      }
      // Dietary
      if (dietaryFilter !== 'all' && item.dietaryType !== dietaryFilter) {
        return false
      }
      return true
    })

    return list.sort((a, b) => {
      if (a.isBestSeller && !b.isBestSeller) return -1
      if (!a.isBestSeller && b.isBestSeller) return 1
      return 0
    })
  }, [items, searchQuery, selectedCategory, dietaryFilter])

  // ─── Actions & Order Submission ─────────────────────────────────────────────
  const handleSaveSetup = (
    name: string,
    type: DiningType,
    tableId: number | null,
    tableNum: number | null,
    guests?: number,
  ) => {
    const saved = saveCustomerName(name)
    const prevId = selectedTableId
    setCustomerName(saved)
    setDiningType(type)
    setSelectedTableId(tableId)
    setSelectedTableNum(tableNum)
    if (guests) setGuestCount(guests)
    void savePreOrderTable(tableId, tableNum, prevId, saved, guests)
    setIsNameGateOpen(false)
  }

  const handleSelectTable = (tableId: number, tableNum: number, guests?: number) => {
    const prevId = selectedTableId
    setSelectedTableId(tableId)
    setSelectedTableNum(tableNum)
    if (guests) setGuestCount(guests)
    void savePreOrderTable(tableId, tableNum, prevId, customerName, guests)
  }

  const handleResetSession = async () => {
    if (window.confirm('Reset advance order session and clear all test data?')) {
      setIsLoadingOrder(true)
      try {
        await resetAdvanceOrderSession()
        setCustomerName('')
        setDiningType('dine-in')
        setSelectedTableId(null)
        setSelectedTableNum(null)
        clearCart()
        setActiveOrder(null)
        setActiveTab('menu')
        navigate('/advance-order', { replace: true })
        setIsNameGateOpen(true)
      } catch (err) {
        console.error('[AdvanceOrderPage] Reset session failed:', err)
      } finally {
        setIsLoadingOrder(false)
      }
    }
  }

  const handleDiningTypeChange = (type: DiningType) => {
    setDiningType(type)
    if (type === 'dine-in' && !selectedTableNum) {
      setIsTableModalOpen(true)
    } else if (type === 'take-away' && selectedTableId) {
      // Release held table reservation if switching to takeout
      void releaseTableReservation(selectedTableId)
      setSelectedTableId(null)
      setSelectedTableNum(null)
      void savePreOrderTable(null, null, selectedTableId, customerName)
    }
  }

  const handlePlaceOrder = async () => {
    if (!isOpen) {
      setOrderError('Ordering is unavailable. The operational business day has ended or is closed.')
      return
    }

    // 1. Validate customer name
    const trimmedName = customerName.trim()
    if (!trimmedName) {
      setIsNameGateOpen(true)
      return
    }

    // 2. Validate table if dining in
    if (diningType === 'dine-in' && !selectedTableNum) {
      setIsTableModalOpen(true)
      setOrderError('Please choose an available table to sit on.')
      return
    }

    // 3. Validate cart
    if (cartItems.length === 0) return

    // 4. Acquire ordering lock to prevent simultaneous submissions
    if (!acquireLock()) {
      setOrderError('Another device is currently submitting an order for this table. Please wait a moment.')
      return
    }

    setIsSubmittingOrder(true)
    setOrderError(null)

    try {
      const created = await createAdvanceOrder({
        customerName: trimmedName,
        diningType,
        tableId: diningType === 'dine-in' ? selectedTableId : null,
        tableNum: diningType === 'dine-in' ? selectedTableNum : null,
        guestCount: diningType === 'dine-in' ? guestCount : undefined,
        cartItems,
      })

      setActiveOrder(created)
      clearCart()
      setIsCartExpanded(false)
      setActiveTab('order')
    } catch (err: unknown) {
      console.error('[AdvanceOrderPage] Failed to place order:', err)
      const msg = err instanceof Error ? err.message : 'Failed to submit advance order.'
      setOrderError(msg)
    } finally {
      releaseLock()
      setIsSubmittingOrder(false)
    }
  }

  const handleCancelOrder = async (reason: string) => {
    if (!activeOrder) return
    try {
      const cancelled = await cancelAdvanceOrder(activeOrder.sessionToken, reason)
      // Release reserved table if applicable
      if (activeOrder.tableId) {
        void releaseTableReservation(activeOrder.tableId)
      }
      if (cancelled) {
        setActiveOrder(cancelled)
      } else {
        setActiveOrder((prev) =>
          prev
            ? {
                ...prev,
                status: 'CANCELLED',
                cancelledAt: new Date().toISOString(),
                notes: reason ? `${prev.notes || ''} [Cancelled: ${reason}]`.trim() : prev.notes,
              }
            : null,
        )
      }
    } catch (err: unknown) {
      console.error('[AdvanceOrderPage] Failed to cancel order:', err)
      throw err
    }
  }

  const handleStartNewOrder = () => {
    if (activeOrder?.tableId) {
      void releaseTableReservation(activeOrder.tableId)
    }
    clearActiveAdvanceOrder()
    setActiveOrder(null)
    clearCart()
    setActiveTab('menu')
    // Re-verify if name should be re-entered or kept
    const pre = getPreOrderSession()
    if (!pre.customerName) {
      setIsNameGateOpen(true)
    }
  }

  // ─── Loading / Error ────────────────────────────────────────────────────────
  if (isLoadingOrder || loadState === 'loading') return <PageLoader />

  return (
    <div
      id="advance-order-page-root"
      className="min-h-screen w-full max-w-full overflow-x-hidden bg-[#F1F6F9] font-sans pb-safe selection:bg-[#E9C46A]/40"
    >
      {/* Customer Setup Gate Modal */}
      <CustomerNameGate
        isOpen={isNameGateOpen}
        initialName={customerName}
        initialDiningType={diningType}
        initialTableId={selectedTableId}
        initialTableNum={selectedTableNum}
        initialGuestCount={guestCount}
        onSaveSetup={handleSaveSetup}
        onCancel={customerName ? () => setIsNameGateOpen(false) : undefined}
      />

      {/* Available Table / Pax Selector Modal */}
      <AdvanceOrderTableModal
        isOpen={isTableModalOpen}
        selectedTableId={selectedTableId}
        initialGuestCount={guestCount}
        onSelectTable={handleSelectTable}
        onClose={() => setIsTableModalOpen(false)}
      />

      {/* Submission Error Banner */}
      {orderError && (
        <div className="fixed top-4 inset-x-4 z-50 max-w-md mx-auto p-3.5 bg-rose-50 border border-rose-200 rounded-2xl shadow-lg flex items-center justify-between text-xs text-rose-800 animate-in slide-in-from-top duration-200">
          <span>{orderError}</span>
          <button
            type="button"
            onClick={() => setOrderError(null)}
            className="font-bold text-rose-600 hover:text-rose-900 ml-2 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ─── TAB 1: MENU ─────────────────────────────────────────────────────── */}
      {activeTab === 'menu' && (
        <div className="flex flex-col w-full max-w-full min-w-0 animate-fade-in pb-24">
          <div className="sticky top-0 z-20 bg-[#F1F6F9]/95 backdrop-blur-md pb-1.5 sm:pb-2 transition-all w-full max-w-full min-w-0">
            <AdvanceOrderHeader
              customerName={customerName}
              diningType={diningType}
              tableNum={selectedTableNum}
              guestCount={guestCount}
              onEditName={() => setIsNameGateOpen(true)}
              cartItemCount={itemCount}
              onOpenCart={() => setIsCartExpanded(true)}
              hasActiveOrder={Boolean(activeOrder)}
              countdownFormatted={countdownString}
              onOpenOrderTab={() => setActiveTab('order')}
              onResetSession={handleResetSession}
            />
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              dietaryFilter={dietaryFilter}
              onDietaryChange={setDietaryFilter}
            />
            <CategorySelector
              categories={categories}
              selected={selectedCategory}
              onSelect={setSelectedCategory}
            />
          </div>

          <MenuGrid
            items={filteredItems}
            getQuantity={getQuantity}
            onItemTap={setActiveItem}
            onItemAdd={(item) => addItem(item)}
            onItemIncrease={(item) => increaseQty(item.id)}
            onItemDecrease={(item) => decreaseQty(item.id)}
          />
        </div>
      )}

      {/* ─── TAB 2: YOUR ORDER ───────────────────────────────────────────────── */}
      {activeTab === 'order' && (
        <div className="flex flex-col w-full max-w-full min-w-0 animate-fade-in pb-36 sm:pb-40">
          <div className="sticky top-0 z-20 bg-[#F1F6F9]/95 backdrop-blur-md pb-1.5 sm:pb-2 w-full max-w-full min-w-0">
            <AdvanceOrderHeader
              customerName={customerName || activeOrder?.customerName}
              diningType={activeOrder ? activeOrder.diningType : diningType}
              tableNum={activeOrder ? activeOrder.tableNum : selectedTableNum}
              guestCount={activeOrder ? activeOrder.guestCount : guestCount}
              onEditName={() => setIsNameGateOpen(true)}
              cartItemCount={itemCount}
              onOpenCart={() => setIsCartExpanded(true)}
              hasActiveOrder={Boolean(activeOrder)}
              countdownFormatted={countdownString}
              onResetSession={handleResetSession}
            />
          </div>

          {activeOrder ? (
            <AdvanceOrderTab
              order={activeOrder}
              onStartNewOrder={handleStartNewOrder}
              onCancelOrder={handleCancelOrder}
            />
          ) : (
            <div className="w-full max-w-lg mx-auto px-4 pt-2 space-y-4 animate-fade-in">
              {/* Order Status Process Cards Empty State */}
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-black uppercase tracking-wider text-[#14274E]">
                    Order Status Tracker
                  </h3>
                  <span className="text-[11px] font-bold text-slate-400">
                    No active orders
                  </span>
                </div>
                <OrderStatusTracker orders={[]} />
              </div>

              {/* Call-to-action banner */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200/80 text-center shadow-xs space-y-2">
                <h4 className="text-base font-black text-[#14274E]">Ready to place an Advance Order?</h4>
                <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                  Browse our menu and submit your selections to secure your table and start your 30-minute confirmation countdown.
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('menu')}
                    className="px-6 py-2.5 bg-[#14274E] text-white font-extrabold text-xs rounded-xl shadow-xs hover:bg-[#1f3b73] active:scale-95 transition-all cursor-pointer"
                  >
                    Browse Menu
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Item Detail Modal ───────────────────────────────────────────────── */}
      {activeItem && (
        <MenuItemDetail
          item={activeItem}
          initialQuantity={getQuantity(activeItem.id)}
          initialNotes={cartItems.find((c) => c.item.id === activeItem.id)?.notes ?? ''}
          onClose={() => setActiveItem(null)}
          onUpdateCart={(qty, notes) => {
            if (qty === 0) {
              removeItem(activeItem.id)
            } else {
              setItemQuantity(activeItem, qty, notes)
            }
          }}
        />
      )}

      {/* ─── Expandable Cart Drawer ─────────────────────────────────────────── */}
      <CartSummary
        items={cartItems}
        itemCount={itemCount}
        total={total}
        diningType={diningType}
        onDiningTypeChange={handleDiningTypeChange}
        tableNum={selectedTableNum}
        onChangeTable={() => setIsTableModalOpen(true)}
        onPlaceOrder={handlePlaceOrder}
        onClear={clearCart}
        onIncreaseQty={increaseQty}
        onDecreaseQty={decreaseQty}
        onRemoveItem={removeItem}
        onUpdateNotes={updateNotes}
        isSubmitting={isSubmittingOrder}
        isLockedByOther={isLockedByOther}
        isExpanded={isCartExpanded}
        onToggleExpand={() => setIsCartExpanded((prev) => !prev)}
        onClose={() => setIsCartExpanded(false)}
      />

      {/* ─── Mobile Bottom Navigation ────────────────────────────────────────── */}
      <AdvanceOrderBottomNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        hasActiveOrder={Boolean(activeOrder)}
        countdownFormatted={countdownString}
      />
    </div>
  )
}
