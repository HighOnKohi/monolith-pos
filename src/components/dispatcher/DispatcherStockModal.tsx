import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  X,
  Search,
  Package,
  CheckCircle2,
  Ban,
  Loader2,
  Utensils,
  AlertTriangle,
} from 'lucide-react'
import { fetchMenuItems, fetchCategories, updateMenuItem } from '@/services/menuService'
import type { MenuItem, Category } from '@/types/menu'

interface DispatcherStockModalProps {
  isOpen: boolean
  onClose: () => void
}

type StockFilter = 'all' | 'available' | 'out_of_stock'

export const DispatcherStockModal: React.FC<DispatcherStockModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [items, setItems] = useState<MenuItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [stockFilter, setStockFilter] = useState<StockFilter>('all')
  const [togglingItemId, setTogglingItemId] = useState<string | null>(null)
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'warning' } | null>(null)

  const showNotification = useCallback((message: string, type: 'success' | 'warning') => {
    setNotification({ message, type })
    setTimeout(() => {
      setNotification((curr) => (curr?.message === message ? null : curr))
    }, 3000)
  }, [])

  // Load menu items when modal opens
  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const fetchedItems = await fetchMenuItems()
      setItems(fetchedItems)
      const fetchedCategories = await fetchCategories(fetchedItems)
      setCategories(fetchedCategories)
    } catch (err) {
      console.error('[DispatcherStockModal] Error loading menu items:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      void loadData()
      setSearchQuery('')
      setSelectedCategory('all')
      setStockFilter('all')
    }
  }, [isOpen, loadData])

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Toggle availability
  const handleToggleStock = async (item: MenuItem) => {
    const nextAvailability = !item.isAvailable
    setTogglingItemId(item.id)

    // Optimistic local update
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, isAvailable: nextAvailability } : i)),
    )

    try {
      await updateMenuItem(item.id, { isAvailable: nextAvailability })
      showNotification(
        nextAvailability
          ? `"${item.name}" marked as AVAILABLE.`
          : `"${item.name}" marked as OUT OF STOCK.`,
        nextAvailability ? 'success' : 'warning',
      )
    } catch (err) {
      console.error('[DispatcherStockModal] Failed to update stock status:', err)
      // Revert optimistic update
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, isAvailable: item.isAvailable } : i)),
      )
    } finally {
      setTogglingItemId(null)
    }
  }

  // Counts
  const availableCount = useMemo(() => items.filter((i) => i.isAvailable).length, [items])
  const outOfStockCount = useMemo(() => items.filter((i) => !i.isAvailable).length, [items])

  // Category lookup map
  const categoryMap = useMemo(() => {
    return new Map(categories.map((c) => [c.id, c.name]))
  }, [categories])

  // Filtered items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Category filter
      if (selectedCategory !== 'all' && item.categoryId !== selectedCategory) {
        return false
      }

      // Stock status filter
      if (stockFilter === 'available' && !item.isAvailable) return false
      if (stockFilter === 'out_of_stock' && item.isAvailable) return false

      // Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim()
        const matchesName = item.name.toLowerCase().includes(query)
        const catName = categoryMap.get(item.categoryId)
        const matchesCat = catName?.toLowerCase().includes(query)
        if (!matchesName && !matchesCat) return false
      }

      return true
    })
  }, [items, selectedCategory, stockFilter, searchQuery, categoryMap])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[90vh] bg-white rounded-3xl shadow-2xl border border-slate-200/90 flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-[#14274E] text-[#E9C46A] flex items-center justify-center shadow-xs shrink-0">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-[#14274E]">Kitchen Stock Management</h2>
                {outOfStockCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-black border border-rose-200">
                    {outOfStockCount} Out of Stock
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Quickly toggle item availability live across customer &amp; cashier menus
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center cursor-pointer transition-colors"
            title="Close modal (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* In-Modal Notification Pill */}
        {notification && (
          <div
            className={`px-6 py-2 text-xs font-bold flex items-center gap-2 border-b shrink-0 animate-in slide-in-from-top-1 ${
              notification.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            )}
            <span>{notification.message}</span>
          </div>
        )}

        {/* Controls: Search, Category Pills, Status Tabs */}
        <div className="p-4 border-b border-slate-100 bg-white space-y-3 shrink-0">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 justify-between">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search dish or beverage..."
                className="w-full pl-10 pr-9 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#14274E] focus:bg-white transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Status Filter Tabs */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200/80 shrink-0">
              <button
                type="button"
                onClick={() => setStockFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  stockFilter === 'all'
                    ? 'bg-white text-[#14274E] shadow-2xs'
                    : 'text-slate-600 hover:text-[#14274E]'
                }`}
              >
                All ({items.length})
              </button>
              <button
                type="button"
                onClick={() => setStockFilter('available')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                  stockFilter === 'available'
                    ? 'bg-white text-emerald-700 shadow-2xs'
                    : 'text-slate-600 hover:text-emerald-700'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Available ({availableCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setStockFilter('out_of_stock')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                  stockFilter === 'out_of_stock'
                    ? 'bg-white text-rose-700 shadow-2xs'
                    : 'text-slate-600 hover:text-rose-700'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span>Out of Stock ({outOfStockCount})</span>
              </button>
            </div>
          </div>

          {/* Category Pills (horizontal scroll) */}
          {categories.length > 1 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                    selectedCategory === cat.id
                      ? 'bg-[#14274E] text-[#E9C46A]'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat.name}
                  {cat.count !== undefined && cat.count > 0 && (
                    <span className="ml-1 opacity-70 text-[10px]">({cat.count})</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 divide-y divide-slate-100">
          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-[#14274E]" />
              <span className="text-xs font-bold text-slate-600">Loading menu stock data...</span>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
              <Utensils className="w-8 h-8 opacity-30" />
              <span className="text-xs font-bold text-slate-500">No items match the current filters</span>
              <span className="text-[11px] text-slate-400">Try adjusting your search query or category filter</span>
            </div>
          ) : (
            filteredItems.map((item) => {
              const isToggling = togglingItemId === item.id
              return (
                <div
                  key={item.id}
                  className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-4 group"
                >
                  {/* Item Info */}
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Thumbnail / Food Icon */}
                    <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <Utensils className="w-5 h-5 text-slate-400" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-black text-[#14274E] leading-tight truncate">
                          {item.name}
                        </h4>
                        {/* Status Badge */}
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 border shrink-0 ${
                            item.isAvailable
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              item.isAvailable ? 'bg-emerald-500' : 'bg-rose-500'
                            }`}
                          />
                          <span>{item.isAvailable ? 'Available' : 'Out of Stock'}</span>
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-1 font-medium">
                        {categoryMap.has(item.categoryId) && (
                          <span className="truncate max-w-[150px]">{categoryMap.get(item.categoryId)}</span>
                        )}
                        <span>·</span>
                        <span className="font-bold text-slate-700">₱{item.price.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Toggle Action Button */}
                  <div className="shrink-0">
                    {item.isAvailable ? (
                      <button
                        type="button"
                        onClick={() => handleToggleStock(item)}
                        disabled={isToggling}
                        className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-black flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                        title="Mark item as Out of Stock"
                      >
                        {isToggling ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-600" />
                        ) : (
                          <Ban className="w-3.5 h-3.5 text-rose-600" />
                        )}
                        <span className="hidden sm:inline">Mark Out of Stock</span>
                        <span className="sm:hidden">Out of Stock</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleToggleStock(item)}
                        disabled={isToggling}
                        className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black flex items-center gap-1.5 shadow-xs transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                        title="Mark item as Available"
                      >
                        {isToggling ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                        )}
                        <span className="hidden sm:inline">Mark Available</span>
                        <span className="sm:hidden">Available</span>
                      </button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500 font-medium">
            Showing <strong className="text-slate-800">{filteredItems.length}</strong> item(s)
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#14274E] hover:bg-[#1a3468] text-white text-xs font-black shadow-xs cursor-pointer transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
