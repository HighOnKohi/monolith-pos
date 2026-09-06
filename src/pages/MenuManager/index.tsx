import { useState, useRef } from 'react'
import { Search, Plus, ChevronLeft, ChevronRight, Edit2, Trash2 } from 'lucide-react'
import { useMenu } from '@/hooks/useMenu'
import {
  createMenuItem,
  createCategory,
  deleteMenuItem,
  updateMenuItem,
  updateCategory,
  deleteCategory,
} from '@/services/menuService'
import type { MenuItem, Category } from '@/types/menu'
import { categoryIconMap, categoryIcons, NewMenuCategoryModal } from '@/components/menu/NewMenuCategoryModal'
import { NewMenuItemModal, type NewMenuItemForm } from '@/components/menu/NewMenuItemModal'
import { ConfirmModal } from '@/components/menu/ConfirmModal'

export default function MenuManagerPage() {
  const { items, categories, loadState, reload } = useMenu()

  const [activeCat, setActiveCat]             = useState<string>('all')
  const [editingItem, setEditingItem]         = useState<MenuItem | null>(null)
  const [isCategoryModalOpen, setCategoryModalOpen] = useState(false)
  const [editingCategory, setEditingCategory]       = useState<Category | null>(null)
  const [isItemModalOpen, setItemModalOpen]   = useState(false)
  const [isEditModalOpen, setEditModalOpen]   = useState(false)
  const [search, setSearch]             = useState('')
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null)

  // Confirm modal state
  const [confirmState, setConfirmState] = useState<{
    title: string; message: string; warning?: string; onConfirm: () => void
  } | null>(null)

  function showToast(text: string, type: 'success' | 'info' | 'error' = 'success') {
    setToastMessage({ text, type })
    setTimeout(() => setToastMessage(null), 3500)
  }

  const catScrollRef = useRef<HTMLDivElement>(null)

  // ── Category strip helpers ─────────────────────────────────────────────────
  function scrollCats(dir: 'left' | 'right') {
    catScrollRef.current?.scrollBy({ left: dir === 'left' ? -160 : 160, behavior: 'smooth' })
  }

  // ── Filtered items ─────────────────────────────────────────────────────────
  const filtered = items.filter((item) => {
    // If searching, show all matching items across all categories
    if (search.trim() !== '') {
      return item.name.toLowerCase().includes(search.toLowerCase())
    }
    // Otherwise only show items from the active category
    return activeCat === 'all' || item.categoryId === activeCat
  })

  // ── Edit handlers ──────────────────────────────────────────────────────────
  function handleEdit(item: MenuItem) {
    setEditingItem(item)
    setEditModalOpen(true)
  }

  function handleClose() {
    setEditingItem(null)
  }

  async function submitEdit(form: NewMenuItemForm) {
    if (!editingItem) return
    await updateMenuItem(editingItem.id, {
      name:        form.name,
      price:       form.price,
      categoryId:  form.categoryId,
      dietaryType: form.dietaryType,
      isAvailable: form.isAvailable,
      imageUrl:    form.imageUrl,
      description: form.description,
    })
    reload()
    showToast(`Updated "${form.name}" successfully!`, 'success')
  }

  // ── Add Category ───────────────────────────────────────────────────────────
  function handleAddCategory() {
    setCategoryModalOpen(true)
  }

  function handleAddDish() {
    setItemModalOpen(true)
  }

  const selectedCategoryId = categories.find(c => c.id === activeCat && c.id !== 'all')?.id
    ?? categories.find(c => c.id !== 'all')?.id

  async function submitCategory(name: string, icon: string) {
    if (editingCategory) {
      await updateCategory(editingCategory.id, name, icon)
      reload()
      showToast(`Updated "${name}".`, 'success')
    } else {
      await createCategory(name, icon)
      reload()
      showToast(`Added "${name}".`, 'success')
    }
    setEditingCategory(null)
  }

  async function handleDeleteCategory(cat: Category) {
    const hasItems = items.some(i => i.categoryId === cat.id)
    setConfirmState({
      title: `Delete "${cat.name}"?`,
      message: `Are you sure you want to delete the category "${cat.name}"?`,
      warning: hasItems
        ? `This category still has ${cat.count} item(s). Remove all items from it before deleting.`
        : undefined,
      onConfirm: async () => {
        if (hasItems) {
          showToast(`Remove all items from "${cat.name}" before deleting.`, 'error')
          setConfirmState(null)
          return
        }
        setConfirmState(null)
        try {
          await deleteCategory(cat.id)
          if (activeCat === cat.id) setActiveCat('all')
          reload()
          showToast(`Deleted "${cat.name}".`, 'info')
        } catch (err: unknown) {
          showToast(err instanceof Error ? err.message : 'Failed to delete category.', 'error')
        }
      },
    })
  }

  async function submitDish(form: NewMenuItemForm) {
    await createMenuItem(form)
    reload()
    showToast(`Added "${form.name}".`, 'success')
  }

  // ── Pagination ─────────────────────────────────────────────────────────────
  const PAGE_SIZE = 12
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const activeLabel = categories.find((c: Category) => c.id === activeCat)?.name ?? 'All'

  return (
    <div className="menu-manager-page-container staff-page">

      {/* ── LEFT: Menu browser ───────────────────────────── */}
      <div className="inner-menu-manager-container">

        <div className="menu-item-searchbar-container">
          <div className="menu-search flex items-center gap-2 rounded-xl bg-white border border-[#9BA4B4]/30 px-3 py-2">
            <Search className="menu-searchbar-icon" />
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              placeholder="Search menu items, categories, SKU..."
              className="menu-searchbar-input flex-1 bg-transparent outline-none"
            />
          </div>
        </div>

        <section className="menu-item-category-buttons-section">
          <div className="menu-item-category-buttons-header">
            <button type="button" onClick={handleAddCategory}>
              <Plus className="menu-manager-plus-icon" /> Add Category
            </button>
          </div>
          <div className="menu-item-category-buttons-row">
            <button type="button" onClick={() => scrollCats('left')} className="menu-item-category-arrow menu-item-category-arrow-left">
              <ChevronLeft className="menu-item-category-arrow-icon" />
            </button>
            <div ref={catScrollRef} className="menu-item-category-buttons-container">
              {categories.map((cat: Category, index) => {
                const CategoryIcon = categoryIconMap[cat.icon as keyof typeof categoryIconMap]
                  ?? categoryIcons[index % categoryIcons.length].component
                return (
                  <button
                    type="button"
                    key={cat.id}
                    onClick={() => { setActiveCat(cat.id); setPage(1) }}
                    className={['menu-item-category-button shrink-0', activeCat === cat.id ? 'is-active' : ''].join(' ')}
                  >
                    <div className="menu-item-category-body">
                      <CategoryIcon className="menu-item-category-icon" />
                      <span className="menu-item-category-title">{cat.name}</span>
                    </div>
                    <div className="menu-item-category-footer" onClick={(e) => e.stopPropagation()}>
                      <span className="menu-item-category-count">{cat.count} Items</span>
                      {cat.id !== 'all' && activeCat === cat.id && (
                        <div className="menu-item-category-actions">
                          <button type="button" className="menu-item-category-edit-btn" title="Edit category"
                            onClick={() => { setEditingCategory(cat); setCategoryModalOpen(true) }}>
                            <Edit2 className="menu-item-category-action-icon" />
                          </button>
                          <button type="button" className="menu-item-category-delete-btn" title="Delete category"
                            onClick={() => handleDeleteCategory(cat)}>
                            <Trash2 className="menu-item-category-action-icon" />
                          </button>
                        </div>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
            <button type="button" onClick={() => scrollCats('right')} className="menu-item-category-arrow menu-item-category-arrow-right">
              <ChevronRight className="menu-item-category-arrow-icon" />
            </button>
          </div>
        </section>

        {/* Item grid */}
        <section className="menu-item-grid">
          <div className="menu-item-card-header">
            <button type="button" onClick={handleAddDish}>
              <Plus className="menu-item-add-icon" /> Add Item
            </button>
          </div>
          <div className="menu-item-card-grid">
            {loadState === 'loading' && (
            <div className="flex h-full items-center justify-center text-sm text-[#9BA4B4]">
              Loading menu...
            </div>
          )}
          {loadState === 'error' && (
            <div className="flex h-full items-center justify-center text-sm text-[#C94A4A]">
              Failed to load menu.
            </div>
          )}
          {(loadState === 'loaded' || loadState === 'empty') && (
            <div className="menu-item-card-grid-content" key={activeCat}>
              {paginated.map((item) => (
                <div
                  key={item.id}
                  className={[
                    'menu-item-card-container relative flex flex-col rounded-xl border bg-white overflow-hidden transition-all cursor-pointer',
                    editingItem?.id === item.id
                      ? 'border-[#14274E] ring-2 ring-[#14274E]/30 shadow-md'
                      : 'border-[#9BA4B4]/20 hover:border-[#14274E]/30',
                  ].join(' ')}
                  onClick={() => handleEdit(item)}
                >
                  {/* Selected / Editing badge */}
                  {editingItem?.id === item.id && (
                    <div className="absolute top-2 left-2 z-10 flex items-center gap-1 rounded-full bg-[#14274E] px-2 py-0.5 text-[10px] font-bold text-white shadow">
                      ✓ Editing
                    </div>
                  )}

                  {/* Sold out status badge */}
                  {item.isSoldOut && (
                    <div className="absolute top-2 right-2 z-10 rounded-md bg-[#C94A4A] px-2 py-0.5 text-[10px] font-bold text-white shadow">
                      SOLD OUT
                    </div>
                  )}

                  {/* Image */}
                  <div className="menu-item-image-container h-32 w-full overflow-hidden">
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className={`menu-item-image h-full w-full object-cover ${item.isSoldOut ? 'opacity-60 grayscale-[40%]' : ''}`}
                    />
                  </div>

                  {/* Info */}
                  <div className="flex flex-col gap-1 p-2.5">
                    <p className="menu-item-name text-sm font-semibold text-[#14274E] line-clamp-2">{item.name}</p>
                    <div className="flex items-center justify-between">
                      <span className="menu-item-price text-sm font-bold text-[#14274E]">₱{item.price.toFixed(2)}</span>
                      <span className={[
                        ' gap-1 text-[10px] font-semibold',
                        item.dietaryType === 'veg' ? 'text-yellow-600' : 'text-[#C94A4A]',
                      ].join(' ')}>
                        <span className={[
                          'h-1.5 w-1.5 rounded-full',
                          item.dietaryType === 'veg' ? 'bg-yellow-500' : 'bg-[#C94A4A]',
                        ].join(' ')} />
                        {item.dietaryType === 'veg' ? 'Veg' : 'Non Veg'}
                      </span>
                    </div>

                    {/* Card actions */}
                    <div className="menu-item-footer flex gap-1.5 mt-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleEdit(item)}
                        className="edit-menu-item-button flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold"
                        style={{ background: '#14274E', color: '#ffffff' }}
                      >
                        <Edit2 style={{ color: '#E9C46A', width: '0.9rem', height: '0.9rem', strokeWidth: 3 }} />
                        Edit
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setConfirmState({
                            title: `Delete "${item.name}"?`,
                            message: `Are you sure you want to remove "${item.name}" from the menu? This cannot be undone.`,
                            onConfirm: async () => {
                              setConfirmState(null)
                              try {
                                await deleteMenuItem(item.id)
                                if (editingItem?.id === item.id) handleClose()
                                reload()
                                showToast(`Deleted "${item.name}".`, 'info')
                              } catch (err: unknown) {
                                const msg = err instanceof Error ? err.message : 'Failed to delete dish.'
                                showToast(msg, 'error')
                              }
                            },
                          })
                        }}
                        className="delete-menu-item-button flex h-7 w-7 items-center justify-center rounded-lg border border-[#C94A4A]/30 text-[#C94A4A] hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {paginated.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-sm font-semibold text-[#14274E]">No items found</p>
                  <p className="text-xs text-[#9BA4B4]">Try a different category or search term.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Pagination footer */}
        <div className="shrink-0 flex items-center justify-between pt-1 border-t border-[#9BA4B4]/20">
          <p className="text-xs text-[#9BA4B4]">
            Showing {paginated.length} of {filtered.length} items in{' '}
            <span className="font-semibold text-[#394867]">{activeLabel}</span>
          </p>
          <div className="flex items-center gap-1">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#9BA4B4]/30 text-[#394867] hover:bg-[#F1F6F9] disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={[
                  'flex h-7 w-7 items-center justify-center rounded-lg text-xs font-semibold transition-colors',
                  p === page ? 'bg-[#14274E] text-white' : 'border border-[#9BA4B4]/30 text-[#394867] hover:bg-[#F1F6F9]',
                ].join(' ')}
              >
                {p}
              </button>
            ))}
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#9BA4B4]/30 text-[#394867] hover:bg-[#F1F6F9] disabled:opacity-40 transition-colors"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </section>
    </div>

    <NewMenuItemModal
      isOpen={isEditModalOpen}
      categories={categories}
      editItem={editingItem}
      onClose={() => { setEditModalOpen(false); setEditingItem(null) }}
      onSubmit={submitEdit}
    />

    <NewMenuCategoryModal
      isOpen={isCategoryModalOpen}
      editCategory={editingCategory}
      onClose={() => { setCategoryModalOpen(false); setEditingCategory(null) }}
      onSubmit={submitCategory}
    />
    <NewMenuItemModal
      isOpen={isItemModalOpen}
      categories={categories}
      defaultCategoryId={selectedCategoryId}
      onClose={() => setItemModalOpen(false)}
      onSubmit={submitDish}
    />

    <ConfirmModal
      isOpen={confirmState !== null}
      title={confirmState?.title ?? ''}
      message={confirmState?.message ?? ''}
      warning={confirmState?.warning}
      onConfirm={confirmState?.onConfirm ?? (() => {})}
      onCancel={() => setConfirmState(null)}
    />

    {/* ── Toast Alert Banner ── */}
    {toastMessage && (
      <div
        className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl shadow-xl text-xs font-bold text-white flex items-center gap-2 ${
          toastMessage.type === 'error' ? 'bg-[#C94A4A]' : 'bg-[#14274E]'
        }`}
      >
        <span>{toastMessage.text}</span>
      </div>
    )}
  </div>
)
}
