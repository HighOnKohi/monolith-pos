import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  FolderKanban,
  UtensilsCrossed,
  Layers,
  CheckCircle2,
  XCircle,
  Pencil,
  Loader2,
  Grid,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  fetchMenuItems,
  fetchCategories,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  createCategory,
  updateCategory,
  deleteCategory,
} from '@/services/menuService'
import type { MenuItem, Category } from '@/types/menu'
import { DEFAULT_FOOD_PLACEHOLDER } from '@/types/menu'
import { NewMenuCategoryModal, categoryIconMap, categoryIcons } from '@/components/menu/NewMenuCategoryModal'
import { NewMenuItemModal, type NewMenuItemForm } from '@/components/menu/NewMenuItemModal'
import { ConfirmModal } from '@/components/menu/ConfirmModal'

export default function MenuCatalogPage() {
  const [items, setItems] = useState<MenuItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<string>('all')

  // Modals state
  const [isItemModalOpen, setItemModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null)
  const [isCategoryModalOpen, setCategoryModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [availabilitySavingId, setAvailabilitySavingId] = useState<string | null>(null)

  // Confirm modal state
  const [confirmState, setConfirmState] = useState<{
    title: string
    message: string
    warning?: string
    onConfirm: () => void
  } | null>(null)

  // Toast message
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null)

  function showToast(text: string, type: 'success' | 'info' | 'error' = 'success') {
    setToastMessage({ text, type })
    setTimeout(() => setToastMessage(null), 3500)
  }

  // Load catalog items and categories
  const loadCatalog = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true)
    try {
      const fetchedItems = await fetchMenuItems()
      const fetchedCategories = await fetchCategories(fetchedItems)
      setItems(fetchedItems)
      setCategories(fetchedCategories)
    } catch (err) {
      console.error('[MenuCatalog] Failed to load catalog:', err)
      if (!silent) showToast('Failed to load menu catalog.', 'error')
    } finally {
      if (!silent) setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadCatalog(false)

    // Realtime subscriptions
    const channel = supabase
      .channel('catalog-realtime-sub')
      .on(
        'postgres_changes',
        { event: '*', schema: 'menu', table: 'Menu_Items' },
        () => void loadCatalog(true),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'menu', table: 'Menu_Categories' },
        () => void loadCatalog(true),
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [loadCatalog])

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    items.forEach((it) => {
      counts[it.categoryId] = (counts[it.categoryId] ?? 0) + 1
    })
    return counts
  }, [items])

  const displayCategories = useMemo(() => {
    return categories.map((cat) => ({
      ...cat,
      count: cat.id === 'all' ? items.length : categoryCounts[cat.id] ?? 0,
    }))
  }, [categories, items.length, categoryCounts])

  // Filtered items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (item.isItemGroup) return false
      const matchesSearch =
        search.trim() === '' ||
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.code.toLowerCase().includes(search.toLowerCase())
      const matchesCategory = activeCategory === 'all' || item.categoryId === activeCategory
      return matchesSearch && matchesCategory
    })
  }, [items, search, activeCategory])

  // ── Handlers ─────────────────────────────────────────────────────────────
  async function handleAvailabilityToggle(item: MenuItem) {
    const newStatus = !item.isAvailable
    const previous = item
    const updated = { ...item, isAvailable: newStatus, isSoldOut: !newStatus }

    setAvailabilitySavingId(item.id)
    setItems((current) => current.map((i) => (i.id === item.id ? updated : i)))

    try {
      await updateMenuItem(item.id, { isAvailable: newStatus })
      showToast(`${item.name} is now marked as ${newStatus ? 'Available' : 'Out of Stock'}.`, 'success')
    } catch (err) {
      setItems((current) => current.map((i) => (i.id === item.id ? previous : i)))
      showToast(err instanceof Error ? err.message : 'Failed to update item availability.', 'error')
    } finally {
      setAvailabilitySavingId(null)
    }
  }

  async function handleSubmitItem(form: NewMenuItemForm) {
    if (editingItem) {
      const prev = editingItem
      const updated: MenuItem = {
        ...editingItem,
        name: form.name,
        price: form.price,
        originalPrice: form.originalPrice,
        discountPercent: form.discountPercent,
        discountAmount: form.discountAmount,
        isBestSeller: form.isBestSeller,
        categoryId: form.categoryId,
        dietaryType: form.dietaryType,
        isAvailable: form.isAvailable,
        isSoldOut: !form.isAvailable,
        imageUrl: form.imageUrl,
        description: form.description,
      }

      setItems((current) => current.map((i) => (i.id === editingItem.id ? updated : i)))
      try {
        await updateMenuItem(editingItem.id, {
          name: form.name,
          price: form.price,
          originalPrice: form.originalPrice,
          discountPercent: form.discountPercent,
          discountAmount: form.discountAmount,
          isBestSeller: form.isBestSeller,
          categoryId: form.categoryId,
          dietaryType: form.dietaryType,
          isAvailable: form.isAvailable,
          imageUrl: form.imageUrl,
          description: form.description,
          orderLimit: form.orderLimit,
          itemIds: form.itemIds,
        })
        await loadCatalog(true)
        showToast(`Updated "${form.name}" successfully!`, 'success')
      } catch (err) {
        setItems((current) => current.map((i) => (i.id === editingItem.id ? prev : i)))
        throw err
      }
    } else {
      await createMenuItem(form)
      await loadCatalog(true)
      showToast(`Added "${form.name}" to Catalog.`, 'success')
    }
  }

  function handleDeleteItem(item: MenuItem) {
    setConfirmState({
      title: `Delete "${item.name}"?`,
      message: `Are you sure you want to permanently delete "${item.name}" from the master catalog? This item will also be removed from any presets using it.`,
      onConfirm: async () => {
        setConfirmState(null)
        const prev = item
        setItems((current) => current.filter((i) => i.id !== prev.id))
        try {
          await deleteMenuItem(prev.id)
          await loadCatalog(true)
          showToast(`Deleted "${prev.name}" from catalog.`, 'info')
        } catch (err) {
          setItems((current) => [...current, prev])
          showToast(err instanceof Error ? err.message : 'Failed to delete item.', 'error')
        }
      },
    })
  }

  async function handleSubmitCategory(name: string, icon: string) {
    if (editingCategory) {
      const prev = editingCategory
      const updated = { ...editingCategory, name, icon }
      setCategories((current) => current.map((c) => (c.id === editingCategory.id ? updated : c)))
      try {
        await updateCategory(editingCategory.id, name, icon)
        await loadCatalog(true)
        showToast(`Category "${name}" updated.`, 'success')
      } catch (err) {
        setCategories((current) => current.map((c) => (c.id === editingCategory.id ? prev : c)))
        throw err
      }
    } else {
      await createCategory(name, icon)
      await loadCatalog(true)
      showToast(`Category "${name}" added.`, 'success')
    }
    setEditingCategory(null)
  }

  function handleDeleteCategory(cat: Category) {
    const hasItems = items.some((i) => i.categoryId === cat.id)
    setConfirmState({
      title: `Delete Category "${cat.name}"?`,
      message: `Are you sure you want to delete the category "${cat.name}"?`,
      warning: hasItems
        ? `This category contains ${cat.count} item(s). Please reassign or delete these items first.`
        : undefined,
      onConfirm: async () => {
        if (hasItems) {
          showToast(`Cannot delete category with active dishes. Reassign items first.`, 'error')
          setConfirmState(null)
          return
        }
        setConfirmState(null)
        setCategories((current) => current.filter((c) => c.id !== cat.id))
        if (activeCategory === cat.id) setActiveCategory('all')
        try {
          await deleteCategory(cat.id)
          await loadCatalog(true)
          showToast(`Category "${cat.name}" deleted.`, 'info')
        } catch (err) {
          setCategories((current) => [...current, cat])
          showToast(err instanceof Error ? err.message : 'Failed to delete category.', 'error')
        }
      },
    })
  }

  return (
    <div className="flex flex-col h-full bg-[#CBD5E1] overflow-hidden">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-5 right-5 z-50 px-4 py-2.5 rounded-2xl shadow-xl border text-xs sm:text-sm font-black flex items-center gap-2 animate-in fade-in slide-in-from-top-3 ${
            toastMessage.type === 'success'
              ? 'bg-[#14274E] text-[#E9C46A] border-[#E9C46A]/40'
              : toastMessage.type === 'error'
                ? 'bg-rose-700 text-white border-rose-500'
                : 'bg-slate-800 text-white border-slate-600'
          }`}
        >
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="p-4 sm:p-5 pb-0 shrink-0">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#14274E] text-[#E9C46A] flex items-center justify-center shrink-0 shadow-xs">
              <FolderKanban className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black text-[#14274E] tracking-tight">Menu Catalog</h1>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                  {items.length} Master Items
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Master repository of all restaurant items, pricing &amp; categories.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            {/* Search */}
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search catalog dishes..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 focus:border-[#14274E] focus:bg-white rounded-xl text-xs font-semibold text-[#14274E] outline-none"
              />
            </div>

            {/* Add Category */}
            <button
              type="button"
              onClick={() => {
                setEditingCategory(null)
                setCategoryModalOpen(true)
              }}
              className="px-3.5 py-2 bg-[#14274E] hover:bg-[#1f3b73] text-[#E9C46A] text-xs font-bold rounded-xl flex items-center gap-1.5 shrink-0 transition-colors shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Add Category</span>
            </button>

            {/* Add Catalog Dish */}
            <button
              type="button"
              onClick={() => {
                setEditingItem(null)
                setItemModalOpen(true)
              }}
              className="px-3.5 py-2 bg-[#E9C46A] hover:bg-[#dfba5e] text-[#14274E] text-xs font-black rounded-xl flex items-center gap-1.5 shrink-0 transition-colors shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>New Dish</span>
            </button>
          </div>
        </div>
      </div>

      {/* Category Tabs Row */}
      <div className="relative px-4 sm:px-5 py-3 shrink-0 group/catbar">
        <div
          onWheel={(e) => {
            const target = e.currentTarget
            if (Math.abs(e.deltaX) < Math.abs(e.deltaY)) {
              target.scrollLeft += e.deltaY
            }
          }}
          className="flex items-center gap-2.5 overflow-x-auto pb-1 no-scrollbar scroll-smooth w-full"
        >
          {displayCategories.map((cat, idx) => {
            const isActive = activeCategory === cat.id
            const isAll = cat.id === 'all'
            const CategoryIcon = isAll
              ? Grid
              : (cat.icon ? categoryIconMap[cat.icon as keyof typeof categoryIconMap] : undefined)
                ?? categoryIcons[idx % categoryIcons.length]?.component
                ?? UtensilsCrossed

            return (
              <div
                key={cat.id}
                className={`group relative inline-flex items-center rounded-2xl transition-all shrink-0 min-w-max border-2 ${
                  isActive
                    ? 'bg-[#14274E] border-[#14274E] text-white shadow-md shadow-[#14274E]/15 scale-[1.01]'
                    : 'bg-white border-slate-200/80 text-slate-700 hover:border-slate-300 hover:bg-slate-50 shadow-2xs'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className="px-3 py-2 text-xs font-bold flex items-center gap-2 cursor-pointer whitespace-nowrap"
                >
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                      isActive ? 'bg-[#E9C46A] text-[#14274E]' : 'bg-slate-100 text-[#394867] group-hover:bg-slate-200/70'
                    }`}
                  >
                    <CategoryIcon className="w-4 h-4 shrink-0" />
                  </div>
                  <span className="font-extrabold">{cat.name}</span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-md font-extrabold transition-colors ${
                      isActive ? 'bg-white/20 text-[#E9C46A]' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {cat.count}
                  </span>
                </button>

                {!isAll && (
                  <div className="pr-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditingCategory(cat)
                        setCategoryModalOpen(true)
                      }}
                      className={`p-1.5 rounded-lg hover:bg-black/10 transition-colors ${
                        isActive ? 'text-[#E9C46A]' : 'text-slate-500'
                      }`}
                      title="Edit Category"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteCategory(cat)
                      }}
                      className="p-1.5 rounded-lg hover:bg-rose-500/20 text-rose-500 transition-colors"
                      title="Delete Category"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Main Grid View */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-5 pb-5">
        {isLoading ? (
          <div className="py-24 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#14274E] mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-500">Loading master catalog...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-md mx-auto my-12 shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto mb-3 text-slate-400">
              <UtensilsCrossed className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-extrabold text-[#14274E]">No dishes found in Catalog</h3>
            <p className="text-xs text-slate-400 mt-1 mb-4">
              {search ? 'Try clearing your search filters' : 'Start by adding your first menu dish to the catalog.'}
            </p>
            <button
              type="button"
              onClick={() => {
                setEditingItem(null)
                setItemModalOpen(true)
              }}
              className="px-4 py-2 bg-[#14274E] text-[#E9C46A] rounded-xl text-xs font-black shadow-xs hover:bg-[#1f3b73] transition-colors cursor-pointer"
            >
              + Add First Dish
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredItems.map((item) => {
              const category = categories.find((c) => c.id === item.categoryId)
              const isSavingThis = availabilitySavingId === item.id

              return (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-all overflow-hidden flex flex-col justify-between group"
                >
                  {/* Image & Badges */}
                  <div>
                    <div className="relative aspect-4/3 bg-slate-100 overflow-hidden">
                      <img
                        src={item.imageUrl || DEFAULT_FOOD_PLACEHOLDER}
                        alt={item.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          ;(e.currentTarget as HTMLImageElement).src = DEFAULT_FOOD_PLACEHOLDER
                        }}
                      />

                      {/* Dietary Badge */}
                      <div className="absolute top-2 left-2">
                        {item.dietaryType === 'veg' ? (
                          <span className="text-[9px] font-black tracking-wide text-emerald-800 bg-emerald-100/90 border border-emerald-300 px-1.5 py-0.5 rounded-md shadow-2xs">
                            VEG
                          </span>
                        ) : (
                          <span className="text-[9px] font-black tracking-wide text-rose-800 bg-rose-100/90 border border-rose-300 px-1.5 py-0.5 rounded-md shadow-2xs">
                            NON-VEG
                          </span>
                        )}
                      </div>

                      {/* Discount / Best Seller Badge */}
                      {item.badge && (
                        <div className="absolute top-2 right-2">
                          <span
                            className={`text-[9px] font-black tracking-wide px-1.5 py-0.5 rounded-md shadow-2xs ${
                              item.badge.type === 'discount'
                                ? 'bg-amber-400 text-amber-950 border border-amber-500'
                                : 'bg-[#14274E] text-[#E9C46A] border border-[#E9C46A]/30'
                            }`}
                          >
                            {item.badge.label}
                          </span>
                        </div>
                      )}

                      {/* Stock limit */}
                      {item.orderLimit != null && item.orderLimit > 0 && (
                        <div className="absolute bottom-2 left-2 bg-slate-900/80 text-white text-[9px] font-bold px-1.5 py-0.5 rounded backdrop-blur-2xs">
                          Stock: {item.orderLimit}
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="p-3.5 space-y-2">
                      <div className="flex items-center justify-between gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <span>{category?.name || 'Dish'}</span>
                        <span className="font-mono">#{item.code}</span>
                      </div>

                      <h3 className="font-extrabold text-sm text-[#14274E] leading-snug line-clamp-1" title={item.name}>
                        {item.name}
                      </h3>

                      {item.description && (
                        <p className="text-[11px] text-slate-500 line-clamp-2 leading-tight">
                          {item.description}
                        </p>
                      )}

                      <div className="flex items-baseline gap-1.5 pt-0.5">
                        <span className="font-black text-sm text-[#14274E]">
                          ₱{item.price.toFixed(2)}
                        </span>
                        {item.originalPrice && item.originalPrice > item.price && (
                          <span className="text-[11px] text-slate-400 line-through font-semibold">
                            ₱{item.originalPrice.toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="px-3.5 py-2.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-2">
                    {/* Availability toggle */}
                    <button
                      type="button"
                      onClick={() => handleAvailabilityToggle(item)}
                      disabled={isSavingThis}
                      className={`px-2.5 py-1 rounded-xl text-[10px] font-black flex items-center gap-1 transition-all cursor-pointer ${
                        item.isAvailable
                          ? 'bg-emerald-100/70 text-emerald-800 hover:bg-emerald-200/70'
                          : 'bg-rose-100 text-rose-700 hover:bg-rose-200'
                      }`}
                      title="Toggle availability in POS & customer interfaces"
                    >
                      {isSavingThis ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : item.isAvailable ? (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Available</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3 h-3 text-rose-600" />
                          <span>Out of Stock</span>
                        </>
                      )}
                    </button>

                    {/* Edit & Delete */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingItem(item)
                          setItemModalOpen(true)
                        }}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-[#14274E] hover:bg-slate-200/80 transition-colors cursor-pointer"
                        title="Edit Dish in Catalog"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteItem(item)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Delete from Catalog"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modals */}
      <NewMenuItemModal
        isOpen={isItemModalOpen}
        categories={categories}
        defaultCategoryId={activeCategory !== 'all' ? activeCategory : undefined}
        editItem={editingItem}
        items={items}
        onClose={() => {
          setItemModalOpen(false)
          setEditingItem(null)
        }}
        onSubmit={handleSubmitItem}
      />

      <NewMenuCategoryModal
        isOpen={isCategoryModalOpen}
        editCategory={editingCategory}
        onClose={() => {
          setCategoryModalOpen(false)
          setEditingCategory(null)
        }}
        onSubmit={handleSubmitCategory}
      />

      {confirmState && (
        <ConfirmModal
          title={confirmState.title}
          message={confirmState.message}
          warning={confirmState.warning}
          onConfirm={confirmState.onConfirm}
          onCancel={() => setConfirmState(null)}
        />
      )}
    </div>
  )
}
