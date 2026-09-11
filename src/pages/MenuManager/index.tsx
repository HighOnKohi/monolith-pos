import { useEffect, useState } from 'react'
import { Search, Plus, Edit2, Trash2 } from 'lucide-react'
import { useMenu } from '@/hooks/useMenu'
import {
  createMenuItem,
  createCategory,
  deleteMenuItem,
  updateMenuItem,
  updateCategory,
  deleteCategory,
  createMenuItemGroup,
  fetchMenuItemGroups,
  updateMenuItemGroup,
  deleteMenuItemGroup,
  type MenuItemGroup,
} from '@/services/menuService'
import type { MenuItem, Category } from '@/types/menu'
import { categoryIconMap, categoryIcons, NewMenuCategoryModal } from '@/components/menu/NewMenuCategoryModal'
import { NewMenuItemModal, type NewMenuItemForm } from '@/components/menu/NewMenuItemModal'
import { NewMenuGroupModal, type MenuGroupValue, type NewMenuGroupForm } from '@/components/menu/NewMenuGroupModal'
import { ConfirmModal } from '@/components/menu/ConfirmModal'

export default function MenuManagerPage() {
  const { items, categories, loadState, setItems, setCategories, reload } = useMenu()

  const [activeCat, setActiveCat]             = useState<string>('all')
  const [editingItem, setEditingItem]         = useState<MenuItem | null>(null)
  const [isCategoryModalOpen, setCategoryModalOpen] = useState(false)
  const [editingCategory, setEditingCategory]       = useState<Category | null>(null)
  const [isItemModalOpen, setItemModalOpen]   = useState(false)
  const [isGroupModalOpen, setGroupModalOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<MenuGroupValue | null>(null)
  const [isEditModalOpen, setEditModalOpen]   = useState(false)
  const [groups, setGroups] = useState<MenuItemGroup[]>([])
  const [search, setSearch]             = useState('')
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null)
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null)
  const [selectedGroup, setSelectedGroup] = useState<MenuItemGroup | null>(null)
  const [availabilitySaving, setAvailabilitySaving] = useState<string | null>(null)

  // Confirm modal state
  const [confirmState, setConfirmState] = useState<{
    title: string; message: string; warning?: string; onConfirm: () => void
  } | null>(null)

  function showToast(text: string, type: 'success' | 'info' | 'error' = 'success') {
    setToastMessage({ text, type })
    setTimeout(() => setToastMessage(null), 3500)
  }

  useEffect(() => {
    void fetchMenuItemGroups().then(setGroups).catch(() => setGroups([]))
  }, [])

  async function submitGroup(form: NewMenuGroupForm) {
    if (editingGroup) {
      await updateMenuItemGroup(editingGroup.id, form)
      showToast(`Updated "${form.name}".`, 'success')
    } else {
      await createMenuItemGroup(form)
      showToast(`Added "${form.name}".`, 'success')
    }
    const updatedGroups = await fetchMenuItemGroups()
    setGroups(updatedGroups)
    if (editingGroup) {
      const refreshed = updatedGroups.find((g) => g.id === editingGroup.id)
      if (refreshed) {
        setSelectedGroup(refreshed)
      }
    }
    setEditingGroup(null)
  }

  async function handleDeleteGroup(group: MenuItemGroup) {
    setConfirmState({
      title: `Delete Group "${group.name}"?`,
      message: `Are you sure you want to remove the group item "${group.name}" from the menu? This cannot be undone.`,
      onConfirm: async () => {
        setConfirmState(null)
        const previous = group
        setGroups((current) => current.filter((g) => g.id !== previous.id))
        handleClose()
        try {
          await deleteMenuItemGroup(previous.id)
          showToast(`Deleted group "${previous.name}".`, 'info')
        } catch (err: unknown) {
          setGroups((current) => [...current, previous])
          showToast(err instanceof Error ? err.message : 'Failed to delete group item.', 'error')
        }
      },
    })
  }

  // ── Filtered items ─────────────────────────────────────────────────────────
  const filtered = items.filter((item) => {
    if (search.trim() !== '') return item.name.toLowerCase().includes(search.toLowerCase())
    return activeCat === 'all' || item.categoryId === activeCat
  })
  const filteredGroups = groups.filter((group) => {
    if (search.trim() !== '') return group.name.toLowerCase().includes(search.toLowerCase())
    return activeCat === 'all' || group.categoryId === activeCat
  })
  const categoryCounts = [...items, ...groups].reduce<Record<string, number>>((counts, item) => {
    const categoryId = 'categoryId' in item ? item.categoryId : ''
    if (categoryId) counts[categoryId] = (counts[categoryId] ?? 0) + 1
    return counts
  }, {})
  const displayCategories = categories.map((category) => ({
    ...category,
    count: category.id === 'all' ? items.length + groups.length : categoryCounts[category.id] ?? 0,
  }))

  // ── Edit handlers ──────────────────────────────────────────────────────────
  function handleEdit(item: MenuItem) {
    setSelectedItem(item)
    setSelectedGroup(null)
    setEditingItem(item)
    setEditModalOpen(true)
  }

  async function handleAvailabilityChange(item: MenuItem, isAvailable: boolean) {
    const previous = item
    const updated = { ...item, isAvailable, isSoldOut: !isAvailable }
    setAvailabilitySaving(item.id)
    setItems((current) => current.map((entry) => entry.id === item.id ? updated : entry))
    setSelectedItem((current) => current?.id === item.id ? updated : current)
    try {
      await updateMenuItem(item.id, { isAvailable })
      reload()
      showToast(`${item.name} is now ${isAvailable ? 'available' : 'not available'}.`, 'success')
    } catch (err: unknown) {
      setItems((current) => current.map((entry) => entry.id === item.id ? previous : entry))
      setSelectedItem((current) => current?.id === item.id ? previous : current)
      showToast(err instanceof Error ? err.message : 'Failed to update availability.', 'error')
    } finally {
      setAvailabilitySaving(null)
    }
  }

  function handleClose() {
    setEditingItem(null)
    setSelectedItem(null)
    setSelectedGroup(null)
  }

  async function submitEdit(form: NewMenuItemForm) {
    if (!editingItem) return
    const previous = editingItem
    const updated: MenuItem = {
      ...editingItem,
      name: form.name,
      price: form.price,
      categoryId: form.categoryId,
      dietaryType: form.dietaryType,
      isAvailable: form.isAvailable,
      isSoldOut: !form.isAvailable,
      imageUrl: form.imageUrl,
      description: form.description,
    }
    setItems((current) => current.map((item) => item.id === editingItem.id ? updated : item))
    setSelectedItem((current) => current?.id === editingItem.id ? updated : current)
    try {
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
    } catch (err: unknown) {
      setItems((current) => current.map((item) => item.id === editingItem.id ? previous : item))
      setSelectedItem((current) => current?.id === editingItem.id ? previous : current)
      throw err
    }
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
      const previous = editingCategory
      const updated = { ...editingCategory, name, icon }
      setCategories((current) => current.map((category) => category.id === editingCategory.id ? updated : category))
      try {
        await updateCategory(editingCategory.id, name, icon)
        reload()
        showToast(`Updated "${name}".`, 'success')
      } catch (err: unknown) {
        setCategories((current) => current.map((category) => category.id === editingCategory.id ? previous : category))
        throw err
      }
    } else {
      const temporaryId = `temporary-${Date.now()}`
      const temporaryCategory: Category = { id: temporaryId, name, icon, count: 0 }
      setCategories((current) => [...current, temporaryCategory])
      try {
        await createCategory(name, icon)
        reload()
        showToast(`Added "${name}".`, 'success')
      } catch (err: unknown) {
        setCategories((current) => current.filter((category) => category.id !== temporaryId))
        throw err
      }
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
        setCategories((current) => current.filter((category) => category.id !== cat.id))
        if (activeCat === cat.id) setActiveCat('all')
        if (cat.id.startsWith('temporary-')) {
          showToast(`Deleted "${cat.name}".`, 'info')
          return
        }
        try {
          await deleteCategory(cat.id)
          reload()
          showToast(`Deleted "${cat.name}".`, 'info')
        } catch (err: unknown) {
          setCategories((current) => [...current, cat])
          showToast(err instanceof Error ? err.message : 'Failed to delete category.', 'error')
        }
      },
    })
  }

  async function submitDish(form: NewMenuItemForm) {
    const temporaryId = `temporary-${Date.now()}`
    const optimisticItem: MenuItem = {
      id: temporaryId,
      code: temporaryId,
      name: form.name,
      price: form.price,
      categoryId: form.categoryId,
      dietaryType: form.dietaryType,
      imageUrl: form.imageUrl ?? '',
      isAvailable: form.isAvailable,
      isSoldOut: !form.isAvailable,
      description: form.description,
    }
    setItems((current) => [...current, optimisticItem])
    try {
      await createMenuItem(form)
      reload()
      showToast(`Added "${form.name}".`, 'success')
    } catch (err: unknown) {
      setItems((current) => current.filter((item) => item.id !== temporaryId))
      throw err
    }
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
            <button type="button" className="menu-manager-add-group" onClick={() => setGroupModalOpen(true)}><Plus className="menu-item-add-icon" /> Add Group Item</button>
            <button type="button" className="menu-manager-add-item" onClick={handleAddDish}><Plus className="menu-item-add-icon" /> Add Item</button>
          </div>
        </div>

        <section className="menu-item-category-buttons-section">
          <div className="menu-item-category-buttons-header">
          <div className="menu-item-category-buttons-row">
            <div className="menu-item-category-buttons-container">
              {displayCategories.map((cat: Category, index) => {
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
            <div className="menu-item-card-grid-content">
              {filteredGroups.map((group) => (
                <div
                  key={`group-${group.id}`}
                  className={[
                    'menu-item-card-container relative flex flex-col rounded-xl border bg-white overflow-hidden transition-all cursor-pointer',
                    selectedGroup?.id === group.id
                      ? 'selected border-[#14274E] ring-2 ring-[#14274E]/30 shadow-md'
                      : 'border-[#9BA4B4]/20 hover:border-[#14274E]/30',
                  ].join(' ')}
                  onClick={() => { setSelectedGroup(group); setSelectedItem(null) }}
                >
                  <div className="menu-item-image-container h-32 w-full overflow-hidden"><img src={group.imageUrl} alt={group.name} className="menu-item-image h-full w-full object-cover" /></div>
                  <div className="flex flex-col gap-1 pt-2"><p className="menu-item-name text-sm font-semibold text-[#14274E] line-clamp-2">{group.name}</p><div className="flex items-center justify-between"><span className="menu-item-price text-sm font-bold text-[#14274E]">₱{group.price.toFixed(2)}</span><span className="text-[10px] font-semibold text-[#14274E]">Group</span></div></div>
                </div>
              ))}
              {paginated.map((item) => (
                <div
                  key={item.id}
                  className={[
                    'menu-item-card-container relative flex flex-col rounded-xl border bg-white overflow-hidden transition-all cursor-pointer',
                    selectedItem?.id === item.id
                      ? 'selected border-[#14274E] ring-2 ring-[#14274E]/30 shadow-md'
                      : 'border-[#9BA4B4]/20 hover:border-[#14274E]/30',
                  ].join(' ')}
                  onClick={() => { setSelectedItem(item); setSelectedGroup(null) }}
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

              {paginated.length === 0 && filteredGroups.length === 0 && (
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
        {selectedGroup ? (
          <div className="menu-manager-sidebar-content">
            <div className="menu-manager-sidebar-heading">
              <h2>Group Details</h2>
            </div>
            <img className="menu-manager-sidebar-image" src={selectedGroup.imageUrl} alt={selectedGroup.name} />
            <h3>{selectedGroup.name}</h3>
            <p className="menu-manager-sidebar-category">
              {categories.find(category => category.id === selectedGroup.categoryId)?.name ?? 'Uncategorized'}
            </p>
            <p className="menu-manager-sidebar-price">₱{selectedGroup.price.toFixed(2)}</p>
            <dl className="menu-manager-sidebar-details">
              <div>
                <dt>Description</dt>
                <dd>{selectedGroup.description || 'No description available.'}</dd>
              </div>
              <div>
                <dt>Items Included ({selectedGroup.itemNames.length})</dt>
                <dd className="mt-1.5">
                  <ul className="space-y-1.5">
                    {selectedGroup.itemNames.map((name, idx) => (
                      <li
                        key={idx}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200/80 text-xs font-bold text-[#14274E]"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-[#14274E]/80 shrink-0" />
                        <span className="truncate">{name}</span>
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
              <div>
                <dt>Availability</dt>
                <dd>{selectedGroup.status}</dd>
              </div>
            </dl>
            <footer className="menu-manager-sidebar-footer">
              <div className="menu-manager-sidebar-actions">
                <button
                  type="button"
                  onClick={() => {
                    setEditingGroup(selectedGroup)
                    setGroupModalOpen(true)
                  }}
                >
                  <Edit2 /> Edit
                </button>
                <button
                  type="button"
                  className="is-danger"
                  onClick={() => handleDeleteGroup(selectedGroup)}
                >
                  <Trash2 /> Delete
                </button>
              </div>
            </footer>
          </div>
        ) : !selectedItem ? (
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
                  const previous = selectedItem
                  setItems((current) => current.filter((item) => item.id !== previous.id))
                  handleClose()
                  try {
                    await deleteMenuItem(previous.id)
                    reload()
                    showToast(`Deleted "${previous.name}".`, 'info')
                  } catch (err: unknown) {
                    setItems((current) => [...current, previous])
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
    <NewMenuGroupModal
      isOpen={isGroupModalOpen}
      items={items}
      categories={categories}
      editGroup={editingGroup}
      onClose={() => { setGroupModalOpen(false); setEditingGroup(null) }}
      onSubmit={submitGroup}
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
