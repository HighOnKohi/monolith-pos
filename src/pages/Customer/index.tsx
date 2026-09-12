import { useState, useMemo, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { CustomerHeader } from '@/components/customer/CustomerHeader'
import { SearchBar } from '@/components/customer/SearchBar'
import type { DietaryFilter } from '@/components/customer/FilterSheet'
import { CategorySelector } from '@/components/customer/CategorySelector'
import { MenuGrid } from '@/components/customer/MenuGrid'
import { MenuItemDetail } from '@/components/customer/MenuItemDetail'
import { CartSummary } from '@/components/customer/CartSummary'
import { MobileBottomNav, type TabType } from '@/components/customer/MobileBottomNav'
import { ActiveOrders } from '@/components/customer/ActiveOrders'
import { BillOutModal } from '@/components/customer/BillOutModal'
import { BillRequestBanner } from '@/components/customer/BillRequestBanner'
import { AssistanceModal } from '@/components/customer/AssistanceModal'
import { LiveOrderStatusPopup } from '@/components/customer/LiveOrderStatusPopup'
import PageLoader from '@/components/common/PageLoader'

import { useMenu } from '@/hooks/useMenu'
import { useSharedCart } from '@/hooks/useSharedCart'
import { useOrders } from '@/hooks/useOrders'
import { useBillRequest } from '@/hooks/useBillRequest'
import { useTableGroup } from '@/services/tableGroupService'
import { getCachedTableAssistance, clearCachedTableAssistance } from '@/services/assistanceService'
import { compressTableOrders } from '@/services/orderService'
import { supabase } from '@/lib/supabase'
import type { MenuItem } from '@/types/menu'
import type { PaymentMethod } from '@/types/bill'
import type { AssistanceRequest } from '@/types/assistance'

export default function CustomerPage() {
  const { tableId } = useParams<{ tableId: string }>()
  const parsedTableId = tableId ? (Number(tableId.replace(/\D/g, '')) || 1) : 1

  // Resolve table group (handles single tables as well as merged groups)
  const { groupInfo } = useTableGroup(parsedTableId)
  const effectiveAnchorId = groupInfo?.anchorTableId ?? parsedTableId
  const memberTableIds = useMemo(
    () => groupInfo?.memberTableIds ?? [parsedTableId],
    [groupInfo?.memberTableIds, parsedTableId],
  )
  const tableLabel = groupInfo?.displayLabel ?? `Table ${parsedTableId}`

  // Global States
  const [activeTab, setActiveTab] = useState<TabType>('menu')
  const [searchQuery, setSearchQuery] = useState('')
  const [dietaryFilter, setDietaryFilter] = useState<DietaryFilter>('all')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  
  // Modals
  const [activeItem, setActiveItem] = useState<MenuItem | null>(null)
  const [isBillOutOpen, setIsBillOutOpen] = useState(false)
  const [isAssistOpen, setIsAssistOpen] = useState(false)
  const [activeAssistance, setActiveAssistance] = useState<AssistanceRequest | null>(null)
  const [isCartExpanded, setIsCartExpanded] = useState(false)

  // Initialize cached assistance state & Realtime assistance resolution subscription
  useEffect(() => {
    if (!parsedTableId) return

    setActiveAssistance(getCachedTableAssistance(parsedTableId))

    // Realtime channel for staff assistance resolution broadcasts and table updates
    const channel = supabase
      .channel(`table-assistance-customer-${parsedTableId}`)
      .on('broadcast', { event: 'assistance_resolved' }, (payload) => {
        const resolvedTableId = payload?.payload?.tableId
        if (resolvedTableId === parsedTableId) {
          clearCachedTableAssistance(parsedTableId)
          setActiveAssistance(null)
        }
      })
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'tables',
          table: 'Restaurant_Tables',
          filter: `TABLE_ID=eq.${parsedTableId}`,
        },
        (payload) => {
          const newStatus = payload.new?.STATUS
          if (newStatus && newStatus !== 'HAS_REQUEST') {
            clearCachedTableAssistance(parsedTableId)
            setActiveAssistance(null)
          }
        },
      )
      .subscribe()

    const handleVisibilityChange = async () => {
      if (document.visibilityState !== 'visible') return
      try {
        const { data } = await supabase
          .from('Restaurant_Tables')
          .select('STATUS')
          .eq('TABLE_ID', parsedTableId)
          .maybeSingle()

        if (data && data.STATUS !== 'HAS_REQUEST') {
          clearCachedTableAssistance(parsedTableId)
          setActiveAssistance(null)
        }
      } catch {
        // Ignore network hiccups during background sync
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      supabase.removeChannel(channel)
    }
  }, [parsedTableId])

  // Hooks
  const { items, categories, loadState } = useMenu()
  const {
    items: cartItems,
    diningType,
    setDiningType,
    addItem,
    updateNotes,
    removeItem,
    increaseQty,
    decreaseQty,
    getQuantity,
    total,
    itemCount,
    clearCart,
    isLockedByOther,
    acquireLock,
    releaseLock,
  } = useSharedCart(effectiveAnchorId)
  const {
    orders,
    isSubmitting: isSubmittingOrder,
    placeOrder,
    latestStatusUpdate,
    hasUnreadStatusChange,
    markStatusUpdateAsRead,
    dismissLatestStatusUpdate,
  } = useOrders(effectiveAnchorId, memberTableIds)
  const { billRequest, isRequesting: isRequestingBill, requestBill } = useBillRequest(effectiveAnchorId, memberTableIds)

  // Auto-collapse cart drawer if all items were removed
  useEffect(() => {
    if (itemCount === 0) {
      setIsCartExpanded(false)
    }
  }, [itemCount])

  // We maintain a local copy of menu items to apply realtime updates without triggering a full re-fetch
  const liveItems = items

  // Derived filtered items with Best Sellers tab support and top sorting
  const filteredItems = useMemo(() => {
    const list = liveItems.filter((item) => {
      // 1. Search
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

    // Each best selling item should also be marked in their respective category and put on top
    return list.sort((a, b) => {
      if (a.isBestSeller && !b.isBestSeller) return -1
      if (!a.isBestSeller && b.isBestSeller) return 1
      return 0
    })
  }, [liveItems, searchQuery, selectedCategory, dietaryFilter])

  // Active unserved orders count
  const activeOrderCount = useMemo(
    () => orders.filter((o) => o.orderStatus !== 'SERVED').length,
    [orders],
  )

  // Bill out is available when there are active table orders and all are SERVED (matching Orders tab)
  const canBillOut = useMemo(
    () => compressTableOrders(orders)?.canBillOut ?? false,
    [orders],
  )

  // Tab change with unread badge clearing
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab)
    if (tab === 'orders') {
      markStatusUpdateAsRead()
    }
  }

  // Handlers
  const handlePlaceOrder = async () => {
    // Duplication protection: acquire cooperative lock before submitting
    if (isLockedByOther) return // another device is placing right now

    const gotLock = acquireLock()
    if (!gotLock) return // race: another device just locked between our check and acquire

    try {
      const serverNote = groupInfo?.isMerged && parsedTableId !== effectiveAnchorId
        ? `Customer entered via Table ${parsedTableId}`
        : undefined
      const success = await placeOrder(cartItems, diningType, total, serverNote)
      if (success) {
        clearCart()
        setIsCartExpanded(false)
        handleTabChange('orders')
      }
    } finally {
      releaseLock()
    }
  }

  const handleRequestBill = async (method: PaymentMethod) => {
    const success = await requestBill(method)
    if (success) {
      setIsBillOutOpen(false)
    }
  }

  // Loading / Empty States
  if (loadState === 'loading') return <PageLoader />
  if (loadState === 'error') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F1F6F9] px-6 text-center animate-fade-in">
        <div>
          <h1 className="text-xl font-bold text-[#14274E] mb-2">Error Loading Menu</h1>
          <p className="text-[#394867] mb-6">There was a problem connecting to the server.</p>
          <button onClick={() => window.location.reload()} className="bg-[#14274E] text-white px-6 py-3 rounded-xl font-bold active:scale-95 transition-transform">
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div id="customer-page-root" className="min-h-screen w-full max-w-full overflow-x-hidden bg-[#F1F6F9] font-sans pb-safe selection:bg-[#E9C46A]/40">
      {/* Live Order Status Alert Popup */}
      <LiveOrderStatusPopup
        notification={latestStatusUpdate}
        onDismiss={dismissLatestStatusUpdate}
        onViewOrders={() => handleTabChange('orders')}
      />

      <BillRequestBanner billRequest={billRequest} />

      {activeTab === 'menu' && (
        <div className="flex flex-col h-full w-full max-w-full min-w-0 animate-fade-in">
          <div className="sticky top-0 z-20 bg-[#F1F6F9]/95 backdrop-blur-md pb-1.5 sm:pb-2 transition-all w-full max-w-full min-w-0">
            <CustomerHeader
              tableLabel={tableLabel}
              onOpenAssist={() => setIsAssistOpen(true)}
              hasActiveAssist={Boolean(activeAssistance)}
              onOpenOrders={() => handleTabChange('orders')}
              activeOrderCount={activeOrderCount}
              hasOrderStatusChange={hasUnreadStatusChange}
              cartItemCount={itemCount}
              onOpenCart={() => setIsCartExpanded(true)}
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
            onItemTap={setActiveItem} // Only image tap opens detail modal!
            onItemAdd={(item) => addItem(item)} // '+ Add to Dish' directly adds to cart!
            onItemIncrease={(item) => increaseQty(item.id)}
            onItemDecrease={(item) => decreaseQty(item.id)}
          />
        </div>
      )}

      {activeTab === 'orders' && (
        <div className="flex flex-col h-full w-full max-w-full min-w-0 animate-fade-in">
          <div className="sticky top-0 z-20 bg-[#F1F6F9]/95 backdrop-blur-md pb-1.5 sm:pb-2 w-full max-w-full min-w-0">
            <CustomerHeader
              tableLabel={tableLabel}
              onOpenAssist={() => setIsAssistOpen(true)}
              hasActiveAssist={Boolean(activeAssistance)}
              onOpenOrders={() => handleTabChange('orders')}
              activeOrderCount={activeOrderCount}
              hasOrderStatusChange={hasUnreadStatusChange}
              cartItemCount={itemCount}
              onOpenCart={() => setIsCartExpanded(true)}
            />
          </div>
          <ActiveOrders
            orders={orders}
            onRequestBill={() => setIsBillOutOpen(true)}
          />
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="flex flex-col items-center justify-center py-32 px-6 text-center animate-fade-in">
          <h2 className="text-xl font-bold text-[#14274E] mb-2">Settings</h2>
          <p className="text-[#9BA4B4]">No settings available.</p>
        </div>
      )}

      {/* Modals & Overlays */}
      {activeItem && (
        <MenuItemDetail
          item={activeItem}
          initialQuantity={getQuantity(activeItem.id)}
          initialNotes={cartItems.find(c => c.item.id === activeItem.id)?.notes ?? ''}
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

      {isBillOutOpen && (
        <BillOutModal
          isSubmitting={isRequestingBill}
          onClose={() => setIsBillOutOpen(false)}
          onRequest={handleRequestBill}
        />
      )}

      {isAssistOpen && (
        <AssistanceModal
          tableId={parsedTableId}
          activeRequest={activeAssistance}
          onClose={() => setIsAssistOpen(false)}
          onRequestSent={(req) => setActiveAssistance(req)}
          onRequestCleared={() => setActiveAssistance(null)}
          onOpenBillOutModal={() => setIsBillOutOpen(true)}
          canBillOut={canBillOut}
        />
      )}

      {/* Expandable Cart Summary & Drawer */}
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
        isLockedByOther={isLockedByOther}
        isExpanded={isCartExpanded}
        onToggleExpand={() => setIsCartExpanded((prev) => !prev)}
        onClose={() => setIsCartExpanded(false)}
      />

      {/* Mobile Bottom Navigation - permanent at bottom of page overlapping content */}
      <MobileBottomNav
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onOpenAssist={() => setIsAssistOpen(true)}
        activeOrderCount={activeOrderCount}
        hasActiveAssist={Boolean(activeAssistance)}
        hasOrderStatusChange={hasUnreadStatusChange}
      />
    </div>
  )
}
