import { useState, useEffect, useCallback, useMemo } from 'react'
import { useMenu } from '@/hooks/useMenu'
import { fetchMenuItemGroups, type MenuItemGroup } from '@/services/menuService'
import {
  generateTicketId,
  createTicketOrder,
} from '@/services/ticketService'
import type { TicketCartItem, TicketCustomerInfo } from '@/types/ticket'
import type { Category } from '@/types/menu'

import { TicketingHeader } from './components/TicketingHeader'
import { TicketingCategoryCardsRow } from './components/TicketingCategoryCardsRow'
import { TicketingProductCard } from './components/TicketingProductCard'
import { TicketingRightPanel } from './components/TicketingRightPanel'
import { TicketCustomerInfoModal } from './components/TicketCustomerInfoModal'

export default function TicketingInterfacePage() {
  // ── 1. Data States ──
  const [activeTicketId, setActiveTicketId] = useState<number>(0)
  const [groups, setGroups] = useState<MenuItemGroup[]>([])
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false)

  // ── 2. UI & Filter States ──
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [mobileActiveView, setMobileActiveView] = useState<'menu' | 'cart'>('menu')
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false)

  // Toast feedback state
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null)

  const showToast = useCallback((text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage({ text, type })
    setTimeout(() => setToastMessage(null), 3500)
  }, [])

  // ── 3. Menu Data Hook ──
  const { items: liveItems, categories } = useMenu()

  // ── 4. Ticket Punch Cart State ──
  const [cart, setCart] = useState<TicketCartItem[]>([])

  // Load ticket ID and menu groups on mount
  useEffect(() => {
    void generateTicketId().then(setActiveTicketId)
    void fetchMenuItemGroups().then(setGroups).catch(() => setGroups([]))
  }, [])

  // ── 6. Category counts including groups ──
  const displayCategories = useMemo<Category[]>(() => {
    const counts: Record<string, number> = {}
    for (const item of liveItems) {
      counts[item.categoryId] = (counts[item.categoryId] ?? 0) + 1
    }
    for (const grp of groups) {
      if (grp.categoryId) {
        counts[grp.categoryId] = (counts[grp.categoryId] ?? 0) + 1
      }
    }

    return categories.map((cat) => ({
      ...cat,
      count: cat.id === 'all' ? liveItems.length + groups.length : counts[cat.id] ?? 0,
    }))
  }, [liveItems, groups, categories])

  // ── 7. Unified catalog items (individual items + group meals) ──
  const unifiedCatalog = useMemo<TicketCartItem[]>(() => {
    const list: TicketCartItem[] = []

    // 1. Group items
    for (const grp of groups) {
      list.push({
        id: `group-${grp.id}`,
        name: grp.name,
        price: grp.price,
        imageUrl: grp.imageUrl || liveItems[0]?.imageUrl || '',
        quantity: 1,
        isGroup: true,
        groupDescription: grp.description,
        includedItems: grp.itemNames,
        categoryId: grp.categoryId,
        isSoldOut: grp.status === 'OUT_OF_STOCK',
        rawGroup: grp,
      })
    }

    // 2. Individual menu items
    for (const it of liveItems) {
      list.push({
        id: it.id,
        name: it.name,
        price: it.price,
        imageUrl: it.imageUrl || '',
        quantity: 1,
        isGroup: false,
        dietaryType: it.dietaryType,
        categoryId: it.categoryId,
        isSoldOut: it.isSoldOut,
        rawItem: it,
      })
    }

    return list
  }, [groups, liveItems])

  // Filter catalog by search and category
  const filteredCatalog = useMemo(() => {
    return unifiedCatalog.filter((item) => {
      const matchSearch =
        searchQuery.trim() === '' ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.includedItems && item.includedItems.some((n) => n.toLowerCase().includes(searchQuery.toLowerCase())))

      const matchCategory =
        selectedCategory === 'all' || item.categoryId === selectedCategory

      return matchSearch && matchCategory
    })
  }, [unifiedCatalog, searchQuery, selectedCategory])

  // ── 8. Cart Handlers ──
  const handleAddToCart = (product: TicketCartItem) => {
    setCart((prev) => {
      const existing = prev.find((ci) => ci.id === product.id)
      if (existing) {
        return prev.map((ci) =>
          ci.id === product.id ? { ...ci, quantity: ci.quantity + 1 } : ci,
        )
      }
      return [...prev, { ...product, quantity: 1 }]
    })
  }

  const handleIncreaseQty = (itemId: string) => {
    setCart((prev) =>
      prev.map((ci) => (ci.id === itemId ? { ...ci, quantity: ci.quantity + 1 } : ci)),
    )
  }

  const handleDecreaseQty = (itemId: string) => {
    setCart((prev) =>
      prev
        .map((ci) => (ci.id === itemId ? { ...ci, quantity: ci.quantity - 1 } : ci))
        .filter((ci) => ci.quantity > 0),
    )
  }

  const handleRemoveItem = (itemId: string) => {
    setCart((prev) => prev.filter((ci) => ci.id !== itemId))
  }

  const handleClearCart = () => {
    setCart([])
  }

  // ── 9. Submit / Punch Order Modal Handler ──
  const handleSubmitTicketOrder = async (customerInfo: TicketCustomerInfo) => {
    if (cart.length === 0) return

    setIsSubmittingOrder(true)
    try {
      // Map cart items with stripped group- prefix if group
      const payloadCart: TicketCartItem[] = cart.map((ci) => ({
        ...ci,
        id: ci.isGroup ? ci.id.replace('group-', '') : ci.id,
      }))

      await createTicketOrder(activeTicketId, customerInfo, payloadCart)

      showToast(`Ticket #${activeTicketId} punched for ${customerInfo.name}!`, 'success')
      setIsCustomerModalOpen(false)
      setCart([])

      // Generate next ticket ID for upcoming order
      const nextId = await generateTicketId()
      setActiveTicketId(nextId)
    } catch (err: unknown) {
      console.error('[Ticketing] Failed to punch ticket order:', err)
      showToast(err instanceof Error ? err.message : 'Failed to punch order.', 'error')
      throw err
    } finally {
      setIsSubmittingOrder(false)
    }
  }

  // Current selected category title
  const currentCategoryName =
    selectedCategory === 'all'
      ? 'All Menu'
      : displayCategories.find((c) => c.id === selectedCategory)?.name || 'Category'

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const tax = subtotal * 0.05
  const total = subtotal + tax

  return (
    <div className="ticketing-page-container">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={[
            'fixed top-5 right-5 z-50 px-4 py-2.5 rounded-2xl shadow-xl border text-xs sm:text-sm font-black flex items-center gap-2 animate-bounce-short',
            toastMessage.type === 'success'
              ? 'bg-[#14274E] text-[#E9C46A] border-[#E9C46A]/40'
              : toastMessage.type === 'error'
              ? 'bg-rose-700 text-white border-rose-500'
              : 'bg-slate-800 text-white border-slate-600',
          ].join(' ')}
        >
          <span>{toastMessage.text}</span>
        </div>
      )}

      <div className="ticketing-interface-page-container">
        {/* Main Split Layout */}
        <div className="ticketing-interface-layout">
          {/* Inner Left: Header + Categories + Product Grid */}
          <div className="inner-ticketing-container">
            {/* Header with Search and Ticket ID */}
            <div className="ticketing-header">
              <TicketingHeader
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                activeTicketId={activeTicketId}
              />
            </div>

            {/* Category Cards Horizontal Bar */}
            <div>
              <TicketingCategoryCardsRow
                categories={displayCategories}
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
              />
            </div>

            {/* Mobile View Toggle */}
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
                  <span>Catalog</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 font-bold">
                    {filteredCatalog.length}
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
                  <span>Ticket Cart</span>
                  {cart.length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#14274E] text-white font-extrabold">
                      {cart.reduce((sum, i) => sum + i.quantity, 0)}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Catalog Grid Section */}
            <div
              className={[
                'flex-1 min-w-0 flex-col overflow-hidden px-4 sm:px-6 pt-3',
                mobileActiveView === 'menu' ? 'flex' : 'hidden lg:flex',
              ].join(' ')}
            >
              {/* Category label and count */}
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200/80 shrink-0 text-xs text-slate-500">
                <span className="font-semibold">
                  <strong className="text-[#14274E] font-extrabold">{currentCategoryName}</strong>
                  <span className="ml-1.5 text-slate-400">
                    ({filteredCatalog.length} item{filteredCatalog.length !== 1 ? 's' : ''})
                  </span>
                </span>
              </div>

              {/* Grid of Dishes and Group Combos */}
              <div className="flex-1 overflow-y-auto pr-1 pb-4">
                {filteredCatalog.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs py-16">
                    <span className="font-bold text-sm text-slate-600 mb-1">No items found</span>
                    <span>Try adjusting your search or category filter.</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-5 pb-6">
                    {filteredCatalog.map((product) => {
                      const cartEntry = cart.find((ci) => ci.id === product.id)
                      const quantityInCart = cartEntry ? cartEntry.quantity : 0
                      return (
                        <TicketingProductCard
                          key={product.id}
                          item={product}
                          quantityInCart={quantityInCart}
                          onAddToCart={handleAddToCart}
                          onDecreaseQty={handleDecreaseQty}
                        />
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Sidebar: Cart & Orders Panel */}
          <div
            className={[
              'sidebar-container min-w-0 h-full flex-col',
              mobileActiveView === 'cart' ? 'flex' : 'hidden lg:flex',
            ].join(' ')}
          >
            <TicketingRightPanel
              activeTicketId={activeTicketId}
              cart={cart}
              onIncreaseQty={handleIncreaseQty}
              onDecreaseQty={handleDecreaseQty}
              onRemoveItem={handleRemoveItem}
              onClearCart={handleClearCart}
              onOpenCustomerModal={() => setIsCustomerModalOpen(true)}
            />
          </div>
        </div>
      </div>

      {/* Customer Info Modal on Order Punch */}
      <TicketCustomerInfoModal
        isOpen={isCustomerModalOpen}
        ticketId={activeTicketId}
        cartItems={cart}
        subtotal={subtotal}
        tax={tax}
        total={total}
        onClose={() => setIsCustomerModalOpen(false)}
        onSubmit={handleSubmitTicketOrder}
        isSubmitting={isSubmittingOrder}
      />
    </div>
  )
}
