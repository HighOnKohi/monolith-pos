import { useState, useMemo, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import PageLoader from '@/components/common/PageLoader'
import { SearchBar } from '@/components/customer/SearchBar'
import type { DietaryFilter } from '@/components/customer/FilterSheet'
import { CategorySelector } from '@/components/customer/CategorySelector'
import { MenuGrid } from '@/components/customer/MenuGrid'
import { MenuItemDetail } from '@/components/customer/MenuItemDetail'
import { CartSummary } from '@/components/customer/CartSummary'
import { AdvanceOrderHeader } from './components/AdvanceOrderHeader'
import { CustomerNameGate } from './components/CustomerNameGate'
import { AdvanceOrderTab } from './components/AdvanceOrderTab'
import { AdvanceOrderBottomNav, type AdvanceOrderTabType } from './components/AdvanceOrderBottomNav'

import { useMenu } from '@/hooks/useMenu'
import type { MenuItem } from '@/types/menu'
import type { CartItem, DiningType } from '@/types/cart'
import type { AdvanceOrder } from '@/types/advanceOrder'
import {
  getPreOrderSession,
  saveCustomerName,
  savePreOrderCart,
  clearPreOrderCart,
  createAdvanceOrder,
  getActiveAdvanceOrder,
  clearActiveAdvanceOrder,
  getRemainingSeconds,
  formatCountdown,
  setActiveSessionToken,
} from '@/services/advanceOrderService'

export default function AdvanceOrderPage() {
  const { token: urlToken } = useParams<{ token?: string }>()

  // ─── States ─────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<AdvanceOrderTabType>('menu')
  const [activeOrder, setActiveOrder] = useState<AdvanceOrder | null>(null)
  const [isLoadingOrder, setIsLoadingOrder] = useState(true)

  // Pre-Order Session
  const [customerName, setCustomerName] = useState<string>('')
  const [isNameGateOpen, setIsNameGateOpen] = useState(false)
  const [diningType, setDiningType] = useState<DiningType>('dine-in')
  const [cartItems, setCartItems] = useState<CartItem[]>([])
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
        if (remaining > 0) {
          setActiveTab('order')
        }
      } else {
        // Load pre-order session
        const preOrder = getPreOrderSession()
        setCustomerName(preOrder.customerName)
        setDiningType(preOrder.diningType)
        setCartItems(preOrder.cart)

        // If no customer name is set, open the name gate
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
  }, [urlToken])

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

  // Save cart to local storage whenever cartItems or diningType changes
  useEffect(() => {
    if (!activeOrder) {
      savePreOrderCart(cartItems, diningType)
    }
  }, [cartItems, diningType, activeOrder])

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

  // ─── Cart Calculations ──────────────────────────────────────────────────────
  const itemCount = useMemo(
    () => cartItems.reduce((sum, c) => sum + c.quantity, 0),
    [cartItems],
  )

  const total = useMemo(
    () => cartItems.reduce((sum, c) => sum + (c.item.price || 0) * c.quantity, 0),
    [cartItems],
  )

  const getQuantity = useCallback(
    (itemId: string) => cartItems.find((c) => c.item.id === itemId)?.quantity || 0,
    [cartItems],
  )

  // ─── Cart Mutations ─────────────────────────────────────────────────────────
  const addItem = (item: MenuItem, notes?: string) => {
    setCartItems((prev) => {
      const idx = prev.findIndex((c) => c.item.id === item.id)
      if (idx >= 0) {
        const copy = [...prev]
        copy[idx] = {
          ...copy[idx],
          quantity: copy[idx].quantity + 1,
          notes: notes !== undefined ? notes : copy[idx].notes,
        }
        return copy
      }
      return [...prev, { item, quantity: 1, notes }]
    })
  }

  const increaseQty = (itemId: string) => {
    setCartItems((prev) =>
      prev.map((c) => (c.item.id === itemId ? { ...c, quantity: c.quantity + 1 } : c)),
    )
  }

  const decreaseQty = (itemId: string) => {
    setCartItems((prev) =>
      prev
        .map((c) => (c.item.id === itemId ? { ...c, quantity: c.quantity - 1 } : c))
        .filter((c) => c.quantity > 0),
    )
  }

  const removeItem = (itemId: string) => {
    setCartItems((prev) => prev.filter((c) => c.item.id !== itemId))
  }

  const updateNotes = (itemId: string, notes: string) => {
    setCartItems((prev) =>
      prev.map((c) => (c.item.id === itemId ? { ...c, notes } : c)),
    )
  }

  const clearCart = () => {
    setCartItems([])
    clearPreOrderCart()
  }

  // ─── Actions & Order Submission ─────────────────────────────────────────────
  const handleSaveName = (name: string) => {
    const saved = saveCustomerName(name)
    setCustomerName(saved)
    setIsNameGateOpen(false)
  }

  const handlePlaceOrder = async () => {
    // 1. Validate customer name
    const trimmedName = customerName.trim()
    if (!trimmedName) {
      setIsNameGateOpen(true)
      return
    }

    // 2. Validate cart
    if (cartItems.length === 0) return

    setIsSubmittingOrder(true)
    setOrderError(null)

    try {
      const created = await createAdvanceOrder({
        customerName: trimmedName,
        diningType,
        cartItems,
      })

      setActiveOrder(created)
      setCartItems([])
      setIsCartExpanded(false)
      setActiveTab('order')
    } catch (err: unknown) {
      console.error('[AdvanceOrderPage] Failed to place order:', err)
      const msg = err instanceof Error ? err.message : 'Failed to submit advance order.'
      setOrderError(msg)
    } finally {
      setIsSubmittingOrder(false)
    }
  }

  const handleStartNewOrder = () => {
    clearActiveAdvanceOrder()
    setActiveOrder(null)
    setCartItems([])
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
      {/* Customer Name Gate Modal */}
      <CustomerNameGate
        isOpen={isNameGateOpen}
        initialName={customerName}
        onSaveName={handleSaveName}
        onCancel={customerName ? () => setIsNameGateOpen(false) : undefined}
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
        <div className="flex flex-col h-full w-full max-w-full min-w-0 animate-fade-in pb-24">
          <div className="sticky top-0 z-20 bg-[#F1F6F9]/95 backdrop-blur-md pb-1.5 sm:pb-2 transition-all w-full max-w-full min-w-0">
            <AdvanceOrderHeader
              customerName={customerName}
              onEditName={() => setIsNameGateOpen(true)}
              cartItemCount={itemCount}
              onOpenCart={() => setIsCartExpanded(true)}
              hasActiveOrder={Boolean(activeOrder)}
              countdownFormatted={countdownString}
              onOpenOrderTab={() => setActiveTab('order')}
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
        <div className="flex flex-col h-full w-full max-w-full min-w-0 animate-fade-in pb-24">
          <div className="sticky top-0 z-20 bg-[#F1F6F9]/95 backdrop-blur-md pb-1.5 sm:pb-2 w-full max-w-full min-w-0">
            <AdvanceOrderHeader
              customerName={customerName || activeOrder?.customerName}
              cartItemCount={itemCount}
              onOpenCart={() => setIsCartExpanded(true)}
              hasActiveOrder={Boolean(activeOrder)}
              countdownFormatted={countdownString}
            />
          </div>

          {activeOrder ? (
            <AdvanceOrderTab order={activeOrder} onStartNewOrder={handleStartNewOrder} />
          ) : (
            <div className="flex flex-col items-center justify-center py-24 px-6 text-center animate-fade-in">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
                <MenuGrid items={[]} getQuantity={() => 0} onItemTap={() => {}} onItemAdd={() => {}} onItemIncrease={() => {}} onItemDecrease={() => {}} />
              </div>
              <h2 className="text-lg font-black text-[#14274E]">No Active Advance Order</h2>
              <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">
                You haven&apos;t submitted an advance order yet. Browse our menu and place your order to start the 30-minute confirmation countdown.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('menu')}
                className="mt-4 px-5 py-2.5 bg-[#14274E] text-white font-bold text-xs rounded-xl shadow-xs hover:bg-[#1f3b73] transition-colors cursor-pointer"
              >
                Browse Menu
              </button>
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
              if (getQuantity(activeItem.id) === 0) addItem(activeItem, notes)
              else updateNotes(activeItem.id, notes)
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
        onDiningTypeChange={setDiningType}
        onPlaceOrder={handlePlaceOrder}
        onClear={clearCart}
        onIncreaseQty={increaseQty}
        onDecreaseQty={decreaseQty}
        onRemoveItem={removeItem}
        onUpdateNotes={updateNotes}
        isSubmitting={isSubmittingOrder}
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
