import { useEffect, useState, useMemo, useCallback } from 'react'
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  ChevronDown,
  Pencil,
  Lock,
  Layers,
  UtensilsCrossed,
  Grid,
  CheckCircle2,
  XCircle,
  FolderKanban,
  MinusCircle,
  Loader2,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMenu } from '@/hooks/useMenu'
import { useActiveEvent } from '@/hooks/useActiveEvent'
import { useBusinessDay } from '@/hooks/useBusinessDay'
import {
  fetchCatalogItems,
  fetchPresetItemIds,
  savePresetItems,
  updateMenuItem,
  updateMenuPreset,
  deleteMenuPreset,
  deleteMenuItem,
} from '@/services/menuService'
import type { MenuItem } from '@/types/menu'
import { DEFAULT_FOOD_PLACEHOLDER } from '@/types/menu'
import { PresetItemPickerModal } from '@/components/menu/PresetItemPickerModal'
import { NewMenuItemModal, type NewMenuItemForm } from '@/components/menu/NewMenuItemModal'
import { categoryIconMap, categoryIcons } from '@/components/menu/NewMenuCategoryModal'
import { ConfirmModal } from '@/components/menu/ConfirmModal'

export default function MenuManagerPage() {
  const {
    items: presetItems,
    categories,
    loadState,
    setItems,
    reload,
    presets,
    activePresetId,
    setActivePresetId,
    createPreset,
  } = useMenu()

  const { activeEvent, isEventActive } = useActiveEvent()
  const { isOpen: isBusinessDayOpen } = useBusinessDay()

  // State
  const [catalogItems, setCatalogItems] = useState<MenuItem[]>([])
  const [search, setSearch] = useState('')
  const [activeCat, setActiveCat] = useState<string>('all')
  const [isPresetDropdownOpen, setPresetDropdownOpen] = useState(false)
  const [isPickerModalOpen, setPickerModalOpen] = useState(false)
  const [pickerMode, setPickerMode] = useState<'create' | 'edit'>('create')
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null)
  const [isItemModalOpen, setItemModalOpen] = useState(false)
  const [availabilitySaving, setAvailabilitySaving] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null)

  // Confirm modal state
  const [confirmState, setConfirmState] = useState<{
    title: string
    message: string
    warning?: string
    onConfirm: () => void
  } | null>(null)

  function showToast(text: string, type: 'success' | 'info' | 'error' = 'success') {
    setToastMessage({ text, type })
    setTimeout(() => setToastMessage(null), 3500)
  }

  // Fetch all master catalog items
  const loadCatalog = useCallback(async () => {
    try {
      const allItems = await fetchCatalogItems()
      setCatalogItems(allItems)
    } catch (err) {
      console.warn('[MenuManager] Notice fetching master catalog:', err)
    }
  }, [])

  useEffect(() => {
    void loadCatalog()
  }, [loadCatalog])

  // Current active preset object
  const activePreset = useMemo(() => {
    return presets.find((p) => p.PRESET_ID === activePresetId) ?? presets[0]
  }, [presets, activePresetId])

  // Active preset items filtered by active preset ITEM_IDS array
  const currentPresetItems = useMemo(() => {
    const activeItemIds = new Set((activePreset?.ITEM_IDS ?? []).map(String))
    const sourceItems = catalogItems.length > 0 ? catalogItems : presetItems
    if (activeItemIds.size > 0) {
      return sourceItems.filter((item) => !item.isItemGroup && activeItemIds.has(item.id))
    }
    return sourceItems.filter((item) => !item.isItemGroup)
  }, [activePreset, catalogItems, presetItems])

  const filtered = useMemo(() => {
    return currentPresetItems.filter((item) => {
      const matchesSearch =
        search.trim() === '' ||
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.code.toLowerCase().includes(search.toLowerCase())
      const matchesCat = activeCat === 'all' || item.categoryId === activeCat
      return matchesSearch && matchesCat
    })
  }, [currentPresetItems, search, activeCat])

  // Category counts based on items currently in this preset
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    currentPresetItems.forEach((item) => {
      counts[item.categoryId] = (counts[item.categoryId] ?? 0) + 1
    })
    return counts
  }, [currentPresetItems])

  const displayCategories = useMemo(() => {
    return categories.map((category) => ({
      ...category,
      count: category.id === 'all' ? currentPresetItems.length : categoryCounts[category.id] ?? 0,
    }))
  }, [categories, currentPresetItems.length, categoryCounts])

  // ── Preset Actions ────────────────────────────────────────────────────────
  const handleOpenCreatePresetModal = () => {
    if (isBusinessDayOpen) {
      showToast('Cannot create or switch menu presets while Business Day is active.', 'error')
      return
    }
    if (isEventActive) {
      showToast(`Cannot create preset while event "${activeEvent?.title ?? 'Active Event'}" is active.`, 'error')
      return
    }
    setPickerMode('create')
    setPickerModalOpen(true)
    setPresetDropdownOpen(false)
  }

  const handleOpenEditPresetItems = () => {
    setPickerMode('edit')
    setPickerModalOpen(true)
  }

  const handlePickerSubmit = async ({
    presetName,
    selectedItemIds,
  }: {
    presetName?: string
    selectedItemIds: string[]
  }) => {
    if (pickerMode === 'create') {
      if (!presetName) return
      try {
        const created = await createPreset(presetName, selectedItemIds)
        await setActivePresetId(created.PRESET_ID)
        await loadCatalog()
        reload()
        showToast(`Created preset "${presetName}" with ${selectedItemIds.length} dishes!`, 'success')
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Failed to create preset.', 'error')
      }
    } else {
      try {
        await savePresetItems(activePresetId, selectedItemIds)
        await loadCatalog()
        reload()
        showToast(`Preset items updated (${selectedItemIds.length} items in set).`, 'success')
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Failed to update preset items.', 'error')
      }
    }
  }

  const handleRemoveItemFromPreset = (item: MenuItem) => {
    setConfirmState({
      title: `Remove from Preset?`,
      message: `Remove "${item.name}" from the active preset "${activePreset?.PRESET_NAME ?? 'Preset'}"? (The item will remain safe in the Menu Catalog).`,
      onConfirm: async () => {
        setConfirmState(null)
        const remainingIds = currentPresetItems.filter((i) => i.id !== item.id).map((i) => i.id)
        try {
          await savePresetItems(activePresetId, remainingIds)
          reload()
          showToast(`Removed "${item.name}" from "${activePreset?.PRESET_NAME}".`, 'info')
        } catch (err) {
          showToast(err instanceof Error ? err.message : 'Failed to remove item from preset.', 'error')
        }
      },
    })
  }

  const handleRenamePreset = async (presetId: number, currentName: string) => {
    if (isBusinessDayOpen) {
      showToast('Cannot rename menu preset while Business Day is active. Please end the business day first.', 'error')
      return
    }
    const newName = window.prompt('Enter new name for menu preset:', currentName)
    if (!newName || !newName.trim() || newName.trim() === currentName) return
    try {
      await updateMenuPreset(presetId, newName.trim())
      reload()
      showToast(`Preset renamed to "${newName.trim()}".`, 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to rename preset.', 'error')
    }
  }

  const handleDeletePreset = async (presetId: number, presetName: string) => {
    if (isBusinessDayOpen) {
      showToast('Cannot delete menu preset while Business Day is active. Please end the business day first.', 'error')
      return
    }
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
      message: `Are you sure you want to delete the preset "${presetName}"? Master catalog items will not be deleted.`,
      onConfirm: async () => {
        setConfirmState(null)
        try {
          await deleteMenuPreset(presetId)
          const remaining = presets.filter((p) => p.PRESET_ID !== presetId)
          if (remaining.length > 0 && activePresetId === presetId) {
            await setActivePresetId(remaining[0].PRESET_ID)
          }
          reload()
          showToast(`Deleted preset "${presetName}".`, 'info')
        } catch (err) {
          showToast(err instanceof Error ? err.message : 'Failed to delete preset.', 'error')
        }
      },
    })
  }

  // Availability toggle
  const handleAvailabilityToggle = async (item: MenuItem) => {
    const newStatus = !item.isAvailable
    const previous = item
    const updated = { ...item, isAvailable: newStatus, isSoldOut: !newStatus }
    setAvailabilitySaving(item.id)
    setItems((current) => current.map((entry) => (entry.id === item.id ? updated : entry)))
    try {
      await updateMenuItem(item.id, { isAvailable: newStatus })
      reload()
      showToast(`${item.name} is now ${newStatus ? 'available' : 'out of stock'}.`, 'success')
    } catch (err) {
      setItems((current) => current.map((entry) => (entry.id === item.id ? previous : entry)))
      showToast(err instanceof Error ? err.message : 'Failed to update availability.', 'error')
    } finally {
      setAvailabilitySaving(null)
    }
  }

  const handleEditItemSubmit = async (form: NewMenuItemForm) => {
    if (!editingItem) return
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
      await loadCatalog()
      reload()
      showToast(`Updated "${form.name}" successfully!`, 'success')
    } catch (err) {
      setItems((current) => current.map((i) => (i.id === editingItem.id ? prev : i)))
      throw err
    }
  }

  // Currently selected item IDs for the active preset
  const activePresetItemIds = useMemo(() => {
    return currentPresetItems.map((i) => i.id)
  }, [currentPresetItems])

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
          {/* Title & Preset Switcher */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#14274E] text-[#E9C46A] flex items-center justify-center shrink-0 shadow-xs">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black text-[#14274E] tracking-tight">Menu Manager</h1>

                {/* Preset Dropdown Trigger */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      if (isBusinessDayOpen) {
                        showToast(
                          'Menu preset switching is locked while Business Day is active. Please end the business day to switch presets.',
                          'error'
                        )
                        return
                      }
                      if (isEventActive) {
                        showToast(
                          `Preset switching is locked while event "${activeEvent?.title ?? 'Active Event'}" is active.`,
                          'error'
                        )
                        return
                      }
                      setPresetDropdownOpen((v) => !v)}
                    }
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                      isEventActive || isBusinessDayOpen
                        ? 'bg-amber-50 text-amber-900 border-amber-300'
                        : 'bg-slate-100 text-[#14274E] border-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    {(isEventActive || isBusinessDayOpen) && <Lock className="w-3.5 h-3.5 text-amber-600" />}
                    <span className="text-slate-500 font-bold">Preset:</span>
                    <span>{activePreset?.PRESET_NAME || 'Default'}</span>
                    {activePreset?.IS_DEFAULT && (
                      <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.2 rounded font-black">
                        DEFAULT
                      </span>
                    )}
                    <ChevronDown className="w-3.5 h-3.5 ml-0.5 text-slate-500" />
                  </button>

                  {/* Dropdown Menu */}
                  {isPresetDropdownOpen && (
                    <div className="absolute left-0 top-full mt-1.5 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                      <div className="px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 mb-1">
                        Select Menu Preset
                      </div>
                      <div className="space-y-1 max-h-56 overflow-y-auto">
                        {presets.map((p) => {
                          const isSelected = p.PRESET_ID === activePresetId
                          return (
                            <div
                              key={p.PRESET_ID}
                              className={`flex items-center justify-between p-2 rounded-xl text-xs transition-colors ${
                                isSelected ? 'bg-slate-100 font-black text-[#14274E]' : 'hover:bg-slate-50 text-slate-700'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  void setActivePresetId(p.PRESET_ID)
                                  setPresetDropdownOpen(false)
                                  showToast(`Switched to "${p.PRESET_NAME}".`, 'info')
                                }}
                                className="flex-1 text-left truncate cursor-pointer"
                              >
                                {p.PRESET_NAME}
                                {p.IS_DEFAULT && (
                                  <span className="ml-1.5 text-[9px] bg-blue-100 text-blue-700 px-1 rounded font-bold">
                                    DEFAULT
                                  </span>
                                )}
                              </button>

                              <div className="flex items-center gap-1 shrink-0 ml-1">
                                <button
                                  type="button"
                                  onClick={() => handleRenamePreset(p.PRESET_ID, p.PRESET_NAME)}
                                  className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-200/60 transition-colors"
                                  title="Rename"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                                {presets.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeletePreset(p.PRESET_ID, p.PRESET_NAME)}
                                    className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors"
                                    title="Delete"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      <div className="border-t border-slate-100 pt-1.5 mt-1">
                        <button
                          type="button"
                          onClick={handleOpenCreatePresetModal}
                          className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-[#14274E] hover:bg-[#1f3b73] text-[#E9C46A] rounded-xl text-xs font-black transition-colors cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>+ Create New Preset</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <p className="text-xs text-slate-500 font-medium">
                Active menu preset containing{' '}
                <strong className="text-[#14274E]">{currentPresetItems.length} items</strong>.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            {/* Search */}
            <div className="relative flex-1 sm:w-56">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search preset dishes..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 focus:border-[#14274E] focus:bg-white rounded-xl text-xs font-semibold text-[#14274E] outline-none"
              />
            </div>

            {/* Edit Preset Items from Catalog */}
            <button
              type="button"
              onClick={handleOpenEditPresetItems}
              className="px-3.5 py-2 bg-[#14274E] hover:bg-[#1f3b73] text-[#E9C46A] text-xs font-black rounded-xl flex items-center gap-1.5 shrink-0 transition-colors shadow-xs cursor-pointer"
              title="Add or remove items from the master catalog"
            >
              <Grid className="w-3.5 h-3.5" />
              <span>Select Items from Catalog</span>
            </button>

            {/* View Catalog Link */}
            <Link
              to="/catalog"
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 shrink-0 transition-colors border border-slate-300 shadow-2xs"
            >
              <FolderKanban className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Go to Catalog</span>
            </Link>
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
            const isActive = activeCat === cat.id
            const isAll = cat.id === 'all'
            const CategoryIcon = isAll
              ? Grid
              : (cat.icon ? categoryIconMap[cat.icon as keyof typeof categoryIconMap] : undefined)
                ?? categoryIcons[idx % categoryIcons.length]?.component
                ?? UtensilsCrossed

            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCat(cat.id)}
                className={`px-3 py-2 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap shrink-0 min-w-max border-2 ${
                  isActive
                    ? 'bg-[#14274E] border-[#14274E] text-white shadow-md shadow-[#14274E]/15 scale-[1.01]'
                    : 'bg-white border-slate-200/80 text-slate-700 hover:border-slate-300 hover:bg-slate-50 shadow-2xs'
                }`}
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
            )
          })}
        </div>
      </div>

      {/* Main Grid View */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-5 pb-5">
        {loadState === 'loading' ? (
          <div className="py-24 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#14274E] mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-500">Loading preset dishes...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-md mx-auto my-12 shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto mb-3 text-slate-400">
              <UtensilsCrossed className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-extrabold text-[#14274E]">
              {search ? 'No matching dishes in this preset' : 'No dishes added to this preset yet'}
            </h3>
            <p className="text-xs text-slate-400 mt-1 mb-4">
              {search
                ? 'Try a different search query or select another category.'
                : 'Select items from your Master Menu Catalog to add them to this preset.'}
            </p>
            <button
              type="button"
              onClick={handleOpenEditPresetItems}
              className="px-4 py-2 bg-[#14274E] text-[#E9C46A] rounded-xl text-xs font-black shadow-xs hover:bg-[#1f3b73] transition-colors cursor-pointer"
            >
              + Select Items from Catalog
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filtered.map((item) => {
              const category = categories.find((c) => c.id === item.categoryId)
              const isSavingThis = availabilitySaving === item.id

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

                    {/* Actions: Edit & Remove from Preset */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingItem(item)
                          setItemModalOpen(true)
                        }}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-[#14274E] hover:bg-slate-200/80 transition-colors cursor-pointer"
                        title="Edit Dish"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveItemFromPreset(item)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-amber-700 hover:bg-amber-50 transition-colors cursor-pointer"
                        title="Remove from this Preset (Keeps in Catalog)"
                      >
                        <MinusCircle className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Preset Item Picker Modal (Grid selection from Catalog) */}
      <PresetItemPickerModal
        isOpen={isPickerModalOpen}
        title={pickerMode === 'create' ? 'Create New Preset from Catalog' : `Edit Preset "${activePreset?.PRESET_NAME}"`}
        subtitle={
          pickerMode === 'create'
            ? 'Choose catalog dishes to include in your new preset set.'
            : 'Select or unselect dishes from the catalog for this preset.'
        }
        presetName={pickerMode === 'create' ? '' : activePreset?.PRESET_NAME}
        isCreatingNewPreset={pickerMode === 'create'}
        catalogItems={catalogItems}
        categories={categories}
        initialSelectedItemIds={pickerMode === 'create' ? catalogItems.map((i) => i.id) : activePresetItemIds}
        onClose={() => setPickerModalOpen(false)}
        onSubmit={handlePickerSubmit}
      />

      {/* Edit Item Modal */}
      <NewMenuItemModal
        isOpen={isItemModalOpen}
        categories={categories}
        defaultCategoryId={activeCat !== 'all' ? activeCat : undefined}
        editItem={editingItem}
        items={catalogItems}
        onClose={() => {
          setItemModalOpen(false)
          setEditingItem(null)
        }}
        onSubmit={handleEditItemSubmit}
      />

      {/* Confirm Modal */}
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
