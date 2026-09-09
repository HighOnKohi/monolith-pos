import { useState } from 'react'
import { Search, Plus, Edit2, Trash2 } from 'lucide-react'
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
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null)
  const [availabilitySaving, setAvailabilitySaving] = useState<string | null>(null)
  const [menuAnimationKey, setMenuAnimationKey] = useState(0)

  // Confirm modal state
  const [confirmState, setConfirmState] = useState<{
    title: string; message: string; warning?: string; onConfirm: () => void
  } | null>(null)

  function showToast(text: string, type: 'success' | 'info' | 'error' = 'success') {
    setToastMessage({ text, type })
    setTimeout(() => setToastMessage(null), 3500)
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
    setSelectedItem(item)
    setEditingItem(item)
    setEditModalOpen(true)
  }

  async function handleAvailabilityChange(item: MenuItem, isAvailable: boolean) {
    setAvailabilitySaving(item.id)
    try {
      await updateMenuItem(item.id, { isAvailable })
      setSelectedItem((current) => current?.id === item.id ? { ...current, isAvailable, isSoldOut: !isAvailable } : current)
      reload()
      showToast(`${item.name} is now ${isAvailable ? 'available' : 'not available'}.`, 'success')
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to update availability.', 'error')
    } finally {
      setAvailabilitySaving(null)
    }
  }

  function handleClose() {
    setEditingItem(null)
    setSelectedItem(null)
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
    setMenuAnimationKey((key) => key + 1)
    reload()
    showToast(`Added "${form.name}".`, 'success')
  }

  const paginated = filtered

  return (
    <>
    <div className="menu-manager-page-container staff-page">

      {/* ── LEFT: Menu browser ───────────────────────────── */}
      <div className="inner-menu-manager-container">

        <div className="inner-menu-manager-header">
          <div className="menu-item-searchbar-container">
          <div className="menu-search flex items-center gap-2 rounded-xl bg-white border border-[#9BA4B4]/30 px-3 py-2">
            <Search className="menu-searchbar-icon" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search menu items, categories, SKU..."
              className="menu-searchbar-input flex-1 bg-transparent outline-none"
            />
          </div>
          </div>
          <div className="menu-manager-header-actions">
            <button type="button" className="menu-manager-add-category" onClick={handleAddCategory}><Plus className="menu-manager-plus-icon" /> Add Category</button>
            <button type="button" className="menu-manager-add-item" onClick={handleAddDish}><Plus className="menu-item-add-icon" /> Add Item</button>
          </div>
        </div>

        <section className="menu-item-category-buttons-section">
          <div className="menu-item-category-buttons-header">
          <div className="menu-item-category-buttons-row">
            <div className="menu-item-category-buttons-container">
              {categories.map((cat: Category, index) => {
                const CategoryIcon = categoryIconMap[cat.icon as keyof typeof categoryIconMap]
                  ?? categoryIcons[index % categoryIcons.length].component
                return (
                  <div
                    key={cat.id}
                    className={['menu-item-category-button shrink-0', activeCat === cat.id ? 'is-active' : ''].join(' ')}
                  >
                    <button
                      type="button"
                      className="menu-item-category-default"
                      onClick={() => setActiveCat(cat.id)}
                    >
                      <div className="menu-item-category-body">
                        <CategoryIcon className="menu-item-category-icon" />
                        <span className="menu-item-category-title">{cat.name}</span>
                      </div>
                      <span className="menu-item-category-count">{cat.count} Items</span>
                    </button>
                    {cat.id !== 'all' && activeCat === cat.id && (
                      <div className="menu-item-category-hover-panel">
                        <button type="button" title="Edit category" onClick={() => { setEditingCategory(cat); setCategoryModalOpen(true) }}>
                          <Edit2 className="menu-item-category-action-icon" />
                        </button>
                        <button type="button" title="Delete category" onClick={() => handleDeleteCategory(cat)}>
                          <Trash2 className="menu-item-category-action-icon" />
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
          </div>
        </section>

        {/* Item grid */}
        <section className="menu-item-grid">
          <div className="menu-items-container">
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
            <div className="menu-item-card-grid-content" key={`${activeCat}-${menuAnimationKey}`}>
              {paginated.map((item) => (
                <div
                  key={item.id}
                  className={[
                    'menu-item-card-container relative flex flex-col rounded-xl border bg-white overflow-hidden transition-all cursor-pointer',
                    selectedItem?.id === item.id
                      ? 'selected border-[#14274E] ring-2 ring-[#14274E]/30 shadow-md'
                      : 'border-[#9BA4B4]/20 hover:border-[#14274E]/30',
                  ].join(' ')}
                  onClick={() => setSelectedItem(item)}
                >
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
                  <div className="flex flex-col gap-1 pt-2">
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
                        {item.dietaryType === 'veg' ? 'Vegetarian' : 'Non-vegetarian'}
                      </span>
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

          </div>
      </section>
      </div>

      <aside className="menu-manager-sidebar">
        {!selectedItem ? (
          <div className="menu-manager-sidebar-empty">
            <p>Select a menu item to view its details.</p>
          </div>
        ) : (
          <div className="menu-manager-sidebar-content">
            <div className="menu-manager-sidebar-heading">
              <h2>Item Details</h2>
            </div>
            <img className="menu-manager-sidebar-image" src={selectedItem.imageUrl} alt={selectedItem.name} />
            <h3>{selectedItem.name}</h3>
            <p className="menu-manager-sidebar-category">{categories.find(category => category.id === selectedItem.categoryId)?.name ?? 'Uncategorized'}</p>
            <p className="menu-manager-sidebar-price">₱{selectedItem.price.toFixed(2)}</p>
            <dl className="menu-manager-sidebar-details">
              <div><dt>Description</dt><dd>{selectedItem.description || 'No description available.'}</dd></div>
              <div><dt>Dietary</dt><dd>{selectedItem.dietaryType === 'veg' ? 'Vegetarian' : 'Non-vegetarian'}</dd></div>
              <div><dt>Availability</dt><dd>{selectedItem.isAvailable ? 'Available' : 'Not Available'}</dd></div>
            </dl>
            <label className="menu-sidebar-availability-toggle">
              <span>Availability</span>
              <span className="menu-sidebar-toggle-row">
                <input
                  type="checkbox"
                  checked={selectedItem.isAvailable}
                  disabled={availabilitySaving === selectedItem.id}
                  onChange={(event) => void handleAvailabilityChange(selectedItem, event.target.checked)}
                />
                <span>{selectedItem.isAvailable ? 'Available' : 'Not Available'}</span>
              </span>
            </label>
            <footer className="menu-manager-sidebar-footer">
              <div className="menu-manager-sidebar-actions">
                <button type="button" onClick={() => handleEdit(selectedItem)}><Edit2 /> Edit</button>
              <button type="button" className="is-danger" onClick={() => setConfirmState({
                title: `Delete "${selectedItem.name}"?`,
                message: `Are you sure you want to remove "${selectedItem.name}" from the menu? This cannot be undone.`,
                onConfirm: async () => {
                  setConfirmState(null)
                  try {
                    await deleteMenuItem(selectedItem.id)
                    handleClose()
                    reload()
                    showToast(`Deleted "${selectedItem.name}".`, 'info')
                  } catch (err: unknown) {
                    showToast(err instanceof Error ? err.message : 'Failed to delete dish.', 'error')
                  }
                },
                })}><Trash2 /> Delete</button>
              </div>
            </footer>
          </div>
        )}
      </aside>

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
  </>
  )
}
