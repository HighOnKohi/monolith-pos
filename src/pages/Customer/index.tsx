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
import PageLoader from '@/components/common/PageLoader'

import { useMenu } from '@/hooks/useMenu'
import { useRealtimeMenu, applyMenuUpdate } from '@/hooks/useRealtimeMenu'
import { useCart } from '@/hooks/useCart'
import { useOrders } from '@/hooks/useOrders'
import { useBillRequest } from '@/hooks/useBillRequest'
import { getCachedTableAssistance } from '@/services/assistanceService'
import type { MenuItem } from '@/types/menu'
import type { PaymentMethod } from '@/types/bill'
import type { AssistanceRequest } from '@/types/assistance'

export default function CustomerPage() {
  const { tableId } = useParams<{ tableId: string }>()
  const parsedTableId = tableId ? Number(tableId.replace(/\D/g, '')) : null
  const tableLabel = parsedTableId ? `Table ${parsedTableId}` : 'Unknown Table'

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

  // Initialize cached assistance state
  useEffect(() => {
    if (parsedTableId) {
      setActiveAssistance(getCachedTableAssistance(parsedTableId))
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
  } = useCart()
  const { orders, isSubmitting: isSubmittingOrder, placeOrder } = useOrders(parsedTableId)
  const { billRequest, isRequesting: isRequestingBill, requestBill } = useBillRequest(parsedTableId)

  // We maintain a local copy of menu items to apply realtime updates without triggering a full re-fetch
  const [liveItems, setLiveItems] = useState<MenuItem[]>([])
  useEffect(() => { setLiveItems(items) }, [items])
  useRealtimeMenu((itemId, isSoldOut) => {
    setLiveItems((prev) => applyMenuUpdate(prev, itemId, isSoldOut))
  })

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

  // Handlers
  const handlePlaceOrder = async () => {
    const success = await placeOrder(cartItems, diningType, total)
    if (success) {
      clearCart()
      setActiveTab('orders')
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
      <div className="flex items-center justify-center min-h-screen bg-[#F1F6F9] px-6 text-center">
        <div>
          <h1 className="text-xl font-bold text-[#14274E] mb-2">Error Loading Menu</h1>
          <p className="text-[#394867] mb-6">There was a problem connecting to the server.</p>
          <button onClick={() => window.location.reload()} className="bg-[#14274E] text-white px-6 py-3 rounded-xl font-bold">
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F1F6F9] font-sans pb-safe">
      <BillRequestBanner billRequest={billRequest} />

      {activeTab === 'menu' && (
        <div className="flex flex-col h-full">
          <div className="sticky top-0 z-20 bg-[#F1F6F9]/90 backdrop-blur-md pb-2">
            <CustomerHeader
              tableLabel={tableLabel}
              onOpenAssist={() => setIsAssistOpen(true)}
              hasActiveAssist={Boolean(activeAssistance)}
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

          <CartSummary
            itemCount={itemCount}
            total={total}
            diningType={diningType}
            onDiningTypeChange={setDiningType}
            onPlaceOrder={handlePlaceOrder}
            isSubmitting={isSubmittingOrder}
          />
        </div>
      )}

      {activeTab === 'orders' && (
        <div className="flex flex-col h-full">
          <div className="sticky top-0 z-20 bg-[#F1F6F9]/90 backdrop-blur-md pb-2">
            <CustomerHeader
              tableLabel={tableLabel}
              onOpenAssist={() => setIsAssistOpen(true)}
              hasActiveAssist={Boolean(activeAssistance)}
            />
          </div>
          <ActiveOrders
            orders={orders}
            onRequestBill={() => setIsBillOutOpen(true)}
          />
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="flex flex-col items-center justify-center py-32 px-6 text-center">
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
        />
      )}

      <MobileBottomNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenAssist={() => setIsAssistOpen(true)}
        activeOrderCount={orders.filter(o => o.orderStatus !== 'SERVED').length}
        hasActiveAssist={Boolean(activeAssistance)}
      />
    </div>
  )
}
