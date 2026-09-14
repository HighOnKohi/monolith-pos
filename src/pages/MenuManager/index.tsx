import { useEffect, useState } from 'react'
import { Search, Plus, Edit2, Trash2, ChevronDown, Pencil, Lock } from 'lucide-react'
import { useMenu } from '@/hooks/useMenu'
import { useActiveEvent } from '@/hooks/useActiveEvent'
import {
  createMenuItem,
  createCategory,
  deleteMenuItem,
  updateMenuItem,
  updateCategory,
  deleteCategory,
  fetchMenuItemGroups,
  updateMenuItemGroup,
  deleteMenuItemGroup,
  updateMenuPreset,
  deleteMenuPreset,
  type MenuItemGroup
} from '@/services/menuService'
import type { MenuItem, Category } from '@/types/menu'
import { categoryIconMap, categoryIcons, NewMenuCategoryModal } from '@/components/menu/NewMenuCategoryModal'
import { NewMenuItemModal, type NewMenuItemForm } from '@/components/menu/NewMenuItemModal'
import { ConfirmModal } from '@/components/menu/ConfirmModal'

export default function MenuManagerPage() {
  const { items, categories, loadState, setItems, setCategories, reload, presets, activePresetId, setActivePresetId, createPreset } = useMenu()
  const { activeEvent, isEventActive } = useActiveEvent()

  const [activeCat, setActiveCat]             = useState<string>('all')
  const [editingItem, setEditingItem]         = useState<MenuItem | null>(null)
  const [isCategoryModalOpen, setCategoryModalOpen] = useState(false)
  const [editingCategory, setEditingCategory]       = useState<Category | null>(null)
  const [isItemModalOpen, setItemModalOpen]   = useState(false)
  const [editingGroup, setEditingGroup] = useState<MenuItemGroup | null>(null)
  const [isEditModalOpen, setEditModalOpen]   = useState(false)
  const [groups, setGroups] = useState<MenuItemGroup[]>([])
  const [search, setSearch]             = useState('')
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null)
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null)
  const [selectedGroup, setSelectedGroup] = useState<MenuItemGroup | null>(null)
  const [availabilitySaving, setAvailabilitySaving] = useState<string | null>(null)
  const [isPresetModalOpen, setPresetModalOpen] = useState(false)
  const [isPresetDropdownOpen, setPresetDropdownOpen] = useState(false)
  const [presetName, setPresetName] = useState('')

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
    if (item.presetId !== activePresetId) return false
    if (search.trim() !== '') return item.name.toLowerCase().includes(search.toLowerCase())
    return activeCat === 'all' || item.categoryId === activeCat
  })
  const filteredGroups = groups.filter((group) => {
    if (group.presetId !== activePresetId) return false
    if (search.trim() !== '') return group.name.toLowerCase().includes(search.toLowerCase())
    return activeCat === 'all' || group.categoryId === activeCat
  })
  const presetItems = items.filter((item) => item.presetId === activePresetId)
  const presetGroups = groups.filter((group) => group.presetId === activePresetId)
  const categoryCounts = [...presetItems, ...presetGroups].reduce<Record<string, number>>((counts, item) => {
    const categoryId = 'categoryId' in item ? item.categoryId : ''
    if (categoryId) counts[categoryId] = (counts[categoryId] ?? 0) + 1
    return counts
  }, {})
  const displayCategories = categories.map((category) => ({
    ...category,
    count: category.id === 'all' ? presetItems.length + presetGroups.length : categoryCounts[category.id] ?? 0,
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
      const updatedGroups = await fetchMenuItemGroups()
      setGroups(updatedGroups)
      setSelectedGroup((current) => {
        if (!current) return current
        return updatedGroups.find((group) => group.id === current.id) ?? current
      })
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

  async function handleGroupAvailabilityChange(group: MenuItemGroup, isAvailable: boolean) {
    const previous = group
    const updated = { ...group, status: isAvailable ? 'AVAILABLE' : 'OUT_OF_STOCK' }
    setAvailabilitySaving(group.id)
    setGroups((current) => current.map((entry) => entry.id === group.id ? updated : entry))
    setSelectedGroup((current) => current?.id === group.id ? updated : current)
    try {
      await updateMenuItem(group.id, { isAvailable })
      const updatedGroups = await fetchMenuItemGroups()
      setGroups(updatedGroups)
      setSelectedGroup(updatedGroups.find((entry) => entry.id === group.id) ?? updated)
      showToast(`${group.name} is now ${isAvailable ? 'available' : 'not available'}.`, 'success')
    } catch (err: unknown) {
      setGroups((current) => current.map((entry) => entry.id === group.id ? previous : entry))
      setSelectedGroup((current) => current?.id === group.id ? previous : current)
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
        description:    form.description,
        orderLimit:     form.orderLimit,
        itemIds:        form.itemIds,
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
        await createCategory(name, icon, activePresetId)
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
    await createMenuItem({ ...form, presetId: activePresetId })
    await reload()
    showToast(`Added "${form.name}".`, 'success')
  }

  async function handleRenamePreset(presetId: number, currentName: string) {
    const newName = window.prompt('Enter new name for menu preset:', currentName)
    if (!newName || !newName.trim() || newName.trim() === currentName) return
    try {
      await updateMenuPreset(presetId, newName.trim())
      reload()
      showToast(`Preset renamed to "${newName.trim()}".`, 'success')
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to rename preset.', 'error')
    }
  }

  async function handleDeletePreset(presetId: number, presetName: string) {
    if (isEventActive) {
      showToast(`Cannot delete preset while event "${activeEvent?.title ?? 'Active Event'}" is active.`, 'error')
      return
    }
    if (presets.length <= 1) {
      showToast('Cannot delete the only remaining preset.', 'error')
      return
    }
    setConfirmState({
      title: `Delete Preset "${presetName}"?`,
      message: `Are you sure you want to delete the preset "${presetName}"? Items in this preset will no longer be accessible.`,
      onConfirm: async () => {
        setConfirmState(null)
        try {
          await deleteMenuPreset(presetId)
          const remaining = presets.filter((p) => p.PRESET_ID !== presetId)
          if (remaining.length > 0 && activePresetId === presetId) {
            setActivePresetId(remaining[0].PRESET_ID)
          }
          reload()
          showToast(`Deleted preset "${presetName}".`, 'info')
        } catch (err: unknown) {
          showToast(err instanceof Error ? err.message : 'Failed to delete preset.', 'error')
        }
      },
    })
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
            <div className="menu-preset-dropdown">
              <button
                type="button"
                className={`menu-preset-dropdown-trigger ${isEventActive ? 'opacity-85 cursor-not-allowed border-amber-300' : ''}`}
                onClick={() => {
                  if (isEventActive) {
                    showToast(
                      `Preset switching is locked while event "${activeEvent?.title ?? 'Active Event'}" is active. Deactivate the event in Events to switch presets.`,
                      'error'
                    )
                    return
                  }
                  setPresetDropdownOpen((open) => !open)
                }}
                aria-expanded={isPresetDropdownOpen}
                title={isEventActive ? `Locked: Event "${activeEvent?.title}" is active` : undefined}
              >
                {isEventActive && <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0 mr-1" />}
                <span className="menu-preset-dropdown-label">
                  <span className="menu-preset-dropdown-prefix">Preset: </span>
                  {presets.find((preset) => preset.PRESET_ID === activePresetId)?.PRESET_NAME ?? 'Default'}
                  {isEventActive && (
                    <span className="ml-1.5 text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                      Event Active
                    </span>
                  )}
                </span>
                <ChevronDown className={`menu-preset-dropdown-chevron ${isPresetDropdownOpen ? 'is-open' : ''}`} />
              </button>
              {isPresetDropdownOpen && (
                <div className="menu-preset-dropdown-menu">
                  <div className="menu-preset-dropdown-options">
                    {presets.map((preset) => {
                      const isSelected = preset.PRESET_ID === activePresetId
                      return (
                        <div
                          key={preset.PRESET_ID}
                          className={`menu-preset-dropdown-option group ${isSelected ? 'is-selected' : ''}`}
                          onClick={() => {
                            if (isEventActive) {
                              showToast(`Cannot switch preset while event "${activeEvent?.title ?? 'Active Event'}" is active.`, 'error')
                              setPresetDropdownOpen(false)
                              return
                            }
                            void setActivePresetId(preset.PRESET_ID)
                            setPresetDropdownOpen(false)
                          }}
                        >
                          <span className="truncate flex-1">{preset.PRESET_NAME}</span>
                          <div
                            className={`menu-preset-dropdown-actions flex items-center gap-1 ${isSelected ? 'opacity-90' : 'opacity-0 group-hover:opacity-100'}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              title="Rename Preset"
                              className="menu-preset-action-btn"
                              onClick={() => {
                                setPresetDropdownOpen(false)
                                void handleRenamePreset(preset.PRESET_ID, preset.PRESET_NAME)
                              }}
                            >
                              <Pencil className="w-2.5 h-2.5" />
                            </button>
                            {presets.length > 1 && (
                              <button
                                type="button"
                                title="Delete Preset"
                                className="menu-preset-action-btn delete"
                                onClick={() => {
                                  setPresetDropdownOpen(false)
                                  void handleDeletePreset(preset.PRESET_ID, preset.PRESET_NAME)
                                }}
                              >
                                <Trash2 className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <button
                    type="button"
                    className="menu-preset-dropdown-footer"
                    onClick={() => {
                      if (isEventActive) {
                        showToast(`Cannot create or switch preset while event "${activeEvent?.title ?? 'Active Event'}" is active.`, 'error')
                        return
                      }
                      setPresetDropdownOpen(false)
                      setPresetModalOpen(true)
                    }}
                  >
                    <Plus className="menu-preset-dropdown-plus" /> Create a new Preset
                  </button>
                </div>
              )}
            </div>
            <button type="button" className="menu-manager-add-category" onClick={handleAddCategory}><Plus className="menu-manager-plus-icon" /> Add Category</button>
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
                  {group.status === 'OUT_OF_STOCK' && (
                    <div className="absolute top-2 right-2 z-10 rounded-md bg-[#C94A4A] px-2 py-0.5 text-[10px] font-bold text-white shadow">
                      SOLD OUT
                    </div>
                  )}
                  <div className="menu-item-image-container h-32 w-full overflow-hidden">
                    <img
                      src={group.imageUrl}
                      alt={group.name}
                      className={`menu-item-image h-full w-full object-cover ${group.status === 'OUT_OF_STOCK' ? 'opacity-60 grayscale-[40%]' : ''}`}
                    />
                  </div>
                  <div className="flex flex-col gap-1 pt-2">
                    <p className="menu-item-name text-sm font-semibold text-[#14274E] line-clamp-2">{group.name}</p>
                    <div className="flex items-center justify-between">
                      <span className="menu-item-price text-sm font-bold text-[#14274E]">₱{group.price.toFixed(2)}</span>
                      <span className="text-[10px] font-semibold text-[#14274E]">Group</span>
                    </div>
                  </div>
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
            <div className="menu-manager-sidebar-hero">
              <img className="menu-manager-sidebar-image" src={selectedGroup.imageUrl} alt={selectedGroup.name} />
              <div className="menu-manager-sidebar-title">
                <div>
                  <h3>{selectedGroup.name}</h3>
                  <p className="menu-manager-sidebar-category">
                    {categories.find(category => category.id === selectedGroup.categoryId)?.name ?? 'Uncategorized'}
                  </p>
                </div>
                <strong>₱{selectedGroup.price.toFixed(2)}</strong>
              </div>
            </div>
            <div className="menu-manager-sidebar-summary">
              <span>Description</span>
              <p>{selectedGroup.description || 'No description available.'}</p>
            </div>
            <div className="menu-manager-sidebar-meta">
              <div>
                <span>Dietary</span>
                <strong>Varied</strong>
              </div>
              <div>
                <span>Menu type</span>
                <strong>Item group</strong>
              </div>
            </div>
            {selectedGroup.itemNames.length > 0 && (
              <section className="menu-manager-sidebar-included">
                <div className="menu-manager-sidebar-section-title">
                  <span>Items Included</span>
                  <strong>{selectedGroup.itemNames.length}</strong>
                </div>
                <ul>
                  {selectedGroup.itemNames.map((name, idx) => (
                    <li
                      key={selectedGroup.itemIds[idx] ?? name}
                      className={selectedGroup.itemAvailability[idx] === false ? 'is-unavailable' : ''}
                    >
                      {selectedGroup.itemImages[idx] ? (
                        <img src={selectedGroup.itemImages[idx]} alt="" />
                      ) : (
                        <span className="menu-manager-sidebar-item-placeholder" />
                      )}
                      <span className="menu-manager-sidebar-item-name">{name}</span>
                      {selectedGroup.itemAvailability[idx] === false && (
                        <strong className="menu-manager-sidebar-item-status">Sold Out</strong>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <label className="menu-sidebar-availability-toggle">
              <span>Availability</span>
              <span className="menu-sidebar-toggle-row">
                <input
                  type="checkbox"
                  checked={selectedGroup.status !== 'OUT_OF_STOCK'}
                  disabled={availabilitySaving === selectedGroup.id}
                  onChange={(event) => void handleGroupAvailabilityChange(selectedGroup, event.target.checked)}
                />
                <span>{selectedGroup.status !== 'OUT_OF_STOCK' ? 'Available' : 'Not Available'}</span>
              </span>
            </label>
            <footer className="menu-manager-sidebar-footer">
              <div className="menu-manager-sidebar-actions">
                <button
                  type="button"
                  onClick={() => {
                    setEditingGroup(selectedGroup)
                    setItemModalOpen(true)
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
            <div className="menu-manager-sidebar-hero">
              <img className="menu-manager-sidebar-image" src={selectedItem.imageUrl} alt={selectedItem.name} />
              <div className="menu-manager-sidebar-title">
                <div>
                  <h3>{selectedItem.name}</h3>
                  <p className="menu-manager-sidebar-category">
                    {categories.find(category => category.id === selectedItem.categoryId)?.name ?? 'Uncategorized'}
                  </p>
                </div>
                <strong>₱{selectedItem.price.toFixed(2)}</strong>
              </div>
            </div>
            <div className="menu-manager-sidebar-summary">
              <span>Description</span>
              <p>{selectedItem.description || 'No description available.'}</p>
            </div>
            <div className="menu-manager-sidebar-meta">
              <div>
                <span>Dietary</span>
                <strong>{selectedItem.dietaryType === 'veg' ? 'Vegetarian' : 'Non-vegetarian'}</strong>
              </div>
              <div>
                <span>Menu type</span>
                <strong>Single item</strong>
              </div>
            </div>
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
      items={items}
      editItem={editingItem}
      onClose={() => { setEditModalOpen(false); setEditingItem(null) }}
      onSubmit={async (form) => {
        await submitEdit(form)
        setEditModalOpen(false)
        setEditingItem(null)
      }}
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
      items={items}
      editGroup={editingGroup}
      defaultCategoryId={selectedCategoryId}
      onClose={() => { setItemModalOpen(false); setEditingGroup(null) }}
      onSubmit={async (form) => {
        if (editingGroup) {
          await updateMenuItemGroup(editingGroup.id, {
            name: form.name,
            description: form.description ?? '',
            price: form.price,
            imageUrl: form.imageUrl,
            status: form.isAvailable ? 'AVAILABLE' : 'OUT_OF_STOCK',
            orderLimit: form.orderLimit,
            categoryId: form.categoryId,
            itemIds: form.itemIds,
          })
          const updatedGroups = await fetchMenuItemGroups()
          setGroups(updatedGroups)
          setSelectedGroup(updatedGroups.find((group) => group.id === editingGroup.id) ?? null)
          showToast(`Updated "${form.name}".`, 'success')
        } else {
          await submitDish(form)
          }
      }}
    />

    {isPresetModalOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 animate-backdrop-fade" onClick={() => setPresetModalOpen(false)}>
        <form className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl animate-modal-pop" onClick={(event) => event.stopPropagation()} onSubmit={async (event) => {
          event.preventDefault()
          if (!presetName.trim()) return
          if (isEventActive) {
            showToast(`Cannot create or switch preset while event "${activeEvent?.title ?? 'Active Event'}" is active.`, 'error')
            return
          }
          try {
            const preset = await createPreset(presetName.trim())
            void setActivePresetId(preset.PRESET_ID)
            setPresetName('')
            setPresetModalOpen(false)
            reload()
            showToast(`Created preset "${preset.PRESET_NAME}".`, 'success')
          } catch (err) { showToast(err instanceof Error ? err.message : 'Failed to create preset.', 'error') }
        }}>
          <h2 className="mb-3 text-lg font-bold text-[#14274E]">Create a new Preset</h2>
          <input required value={presetName} onChange={(event) => setPresetName(event.target.value)} placeholder="Preset name" className="mb-2 w-full rounded-lg border p-2" />
          <div className="flex justify-end gap-2"><button type="button" onClick={() => setPresetModalOpen(false)} className="rounded-lg px-3 py-2">Cancel</button><button type="submit" className="rounded-lg bg-[#14274E] px-3 py-2 text-white">Save</button></div>
        </form>
      </div>
    )}

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
