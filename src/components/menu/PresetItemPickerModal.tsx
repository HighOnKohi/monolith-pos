import { useState, useMemo, useEffect } from 'react'
import { Search, X, Check, CheckSquare, Square, Layers, Loader2, UtensilsCrossed } from 'lucide-react'
import type { MenuItem, Category } from '@/types/menu'
import { DEFAULT_FOOD_PLACEHOLDER } from '@/types/menu'

interface PresetItemPickerModalProps {
  isOpen: boolean
  title: string
  subtitle?: string
  presetName?: string
  isCreatingNewPreset?: boolean
  catalogItems: MenuItem[]
  categories: Category[]
  initialSelectedItemIds: string[]
  onClose: () => void
  onSubmit: (data: { presetName?: string; selectedItemIds: string[] }) => Promise<void> | void
}

export function PresetItemPickerModal({
  isOpen,
  title,
  subtitle,
  presetName: initialPresetName = '',
  isCreatingNewPreset = false,
  catalogItems,
  categories,
  initialSelectedItemIds,
  onClose,
  onSubmit,
}: PresetItemPickerModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(initialSelectedItemIds))
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [nameInput, setNameInput] = useState(initialPresetName)
  const [nameError, setNameError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Sync initial selection when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedIds(new Set(initialSelectedItemIds))
      setNameInput(initialPresetName)
      setNameError(null)
      setSearch('')
      setActiveCategory('all')
    }
  }, [isOpen, initialSelectedItemIds, initialPresetName])

  // Filtered catalog items
  const filteredItems = useMemo(() => {
    return catalogItems.filter((item) => {
      if (item.isItemGroup) return false
      const matchesSearch =
        search.trim() === '' ||
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.code.toLowerCase().includes(search.toLowerCase())
      const matchesCat = activeCategory === 'all' || item.categoryId === activeCategory
      return matchesSearch && matchesCat
    })
  }, [catalogItems, search, activeCategory])

  // Category counts based on catalog
  const selectableCategories = useMemo(() => {
    const counts: Record<string, number> = {}
    catalogItems.forEach((it) => {
      counts[it.categoryId] = (counts[it.categoryId] ?? 0) + 1
    })
    return categories
      .filter((c) => c.id !== 'all')
      .map((c) => ({
        ...c,
        count: counts[c.id] ?? 0,
      }))
  }, [categories, catalogItems])

  if (!isOpen) return null

  const toggleItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleSelectAllFiltered = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      filteredItems.forEach((item) => next.add(item.id))
      return next
    })
  }

  const handleDeselectAllFiltered = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      filteredItems.forEach((item) => next.delete(item.id))
      return next
    })
  }

  const handleSelectAllGlobal = () => {
    setSelectedIds(new Set(catalogItems.map((item) => item.id)))
  }

  const handleDeselectAllGlobal = () => {
    setSelectedIds(new Set())
  }

  const handleSave = async () => {
    if (isCreatingNewPreset) {
      if (!nameInput.trim()) {
        setNameError('Please enter a name for the new preset.')
        return
      }
    }

    setIsSaving(true)
    try {
      await onSubmit({
        presetName: isCreatingNewPreset ? nameInput.trim() : undefined,
        selectedItemIds: Array.from(selectedIds),
      })
      onClose()
    } finally {
      setIsSaving(false)
    }
  }

  const totalCatalogCount = catalogItems.filter((i) => !i.isItemGroup).length
  const selectedCount = selectedIds.size

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 sm:p-5 overflow-y-auto">
      <div className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-[#14274E] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-[#E9C46A]">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight">{title}</h2>
              <p className="text-xs text-slate-300 font-medium">
                {subtitle || 'Select catalog dishes to include in this menu preset.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Preset Name Input (if creating new preset) */}
        {isCreatingNewPreset && (
          <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-200 shrink-0">
            <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1">
              New Preset Name *
            </label>
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={nameInput}
                onChange={(e) => {
                  setNameInput(e.target.value)
                  if (nameError) setNameError(null)
                }}
                placeholder="e.g. Weekend Special, Dinner Menu, Lunch Buffet..."
                className="w-full sm:max-w-md px-3.5 py-2 bg-white border border-slate-300 focus:border-[#14274E] focus:ring-1 focus:ring-[#14274E] rounded-xl text-sm font-bold text-[#14274E] outline-none"
                autoFocus
              />
              {nameError && (
                <span className="text-xs font-bold text-rose-600 shrink-0">{nameError}</span>
              )}
            </div>
          </div>
        )}

        {/* Filters & Actions Bar */}
        <div className="px-6 py-3 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Search bar */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search catalog items..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 focus:border-[#14274E] focus:bg-white rounded-xl text-xs font-semibold outline-none"
            />
          </div>

          {/* Quick selection stats & actions */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className="font-extrabold text-[#14274E] bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200/80">
              <span className="text-[#E9C46A] bg-[#14274E] px-1.5 py-0.5 rounded-md text-[11px] font-black mr-1.5">
                {selectedCount} / {totalCatalogCount}
              </span>
              Items Selected
            </span>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleSelectAllFiltered}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-[11px] transition-colors cursor-pointer"
                title="Select all currently visible items"
              >
                Select Page ({filteredItems.length})
              </button>
              <button
                type="button"
                onClick={handleDeselectAllFiltered}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-[11px] transition-colors cursor-pointer"
                title="Deselect visible items"
              >
                Clear Page
              </button>
              <button
                type="button"
                onClick={selectedCount === totalCatalogCount ? handleDeselectAllGlobal : handleSelectAllGlobal}
                className="px-2.5 py-1.5 bg-[#14274E]/10 hover:bg-[#14274E]/15 text-[#14274E] font-black rounded-lg text-[11px] transition-colors cursor-pointer"
              >
                {selectedCount === totalCatalogCount ? 'Deselect All' : 'Select All Catalog'}
              </button>
            </div>
          </div>
        </div>

        {/* Category Pills */}
        <div className="px-6 py-2 bg-slate-50 border-b border-slate-200/70 flex items-center gap-1.5 overflow-x-auto scrollbar-none shrink-0">
          <button
            type="button"
            onClick={() => setActiveCategory('all')}
            className={`px-3 py-1 rounded-full text-xs font-black transition-all cursor-pointer shrink-0 ${
              activeCategory === 'all'
                ? 'bg-[#14274E] text-[#E9C46A] shadow-xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            All Categories ({catalogItems.filter((i) => !i.isItemGroup).length})
          </button>
          {selectableCategories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                activeCategory === cat.id
                  ? 'bg-[#14274E] text-[#E9C46A] shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>{cat.name}</span>
              <span className="text-[10px] opacity-70">({cat.count})</span>
            </button>
          ))}
        </div>

        {/* Item Grid Body */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50">
          {filteredItems.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto mb-3 text-slate-400">
                <UtensilsCrossed className="w-6 h-6" />
              </div>
              <p className="text-sm font-extrabold text-slate-700">No catalog items found</p>
              <p className="text-xs text-slate-400 mt-1">Try changing your search term or category filter.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
              {filteredItems.map((item) => {
                const isSelected = selectedIds.has(item.id)
                const category = categories.find((c) => c.id === item.categoryId)

                return (
                  <div
                    key={item.id}
                    onClick={() => toggleItem(item.id)}
                    className={`relative rounded-2xl border-2 transition-all p-3 bg-white flex flex-col justify-between cursor-pointer select-none group hover:shadow-md ${
                      isSelected
                        ? 'border-[#14274E] ring-2 ring-[#14274E]/15 bg-blue-50/30 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 opacity-80 hover:opacity-100'
                    }`}
                  >
                    {/* Checkbox indicator badge */}
                    <div className="flex items-start gap-3">
                      <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                        <img
                          src={item.imageUrl || DEFAULT_FOOD_PLACEHOLDER}
                          alt={item.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          onError={(e) => {
                            ;(e.currentTarget as HTMLImageElement).src = DEFAULT_FOOD_PLACEHOLDER
                          }}
                        />
                        <div
                          className={`absolute top-1 left-1 w-5 h-5 rounded-md flex items-center justify-center transition-all ${
                            isSelected
                              ? 'bg-[#14274E] text-[#E9C46A] shadow-xs'
                              : 'bg-white/90 border border-slate-300 text-transparent'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                            {category?.name || 'Dish'}
                          </span>
                          {item.dietaryType === 'veg' ? (
                            <span className="text-[9px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-1 rounded">
                              VEG
                            </span>
                          ) : (
                            <span className="text-[9px] font-black text-rose-700 bg-rose-50 border border-rose-200 px-1 rounded">
                              NON-VEG
                            </span>
                          )}
                        </div>

                        <h3 className="font-extrabold text-xs text-[#14274E] leading-snug line-clamp-2 mt-0.5">
                          {item.name}
                        </h3>

                        <div className="flex items-center justify-between mt-1.5">
                          <span className="font-black text-xs text-[#14274E]">
                            ₱{item.price.toFixed(2)}
                          </span>
                          {!item.isAvailable && (
                            <span className="text-[9px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                              Out of Stock
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Bottom active pill */}
                    <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] font-extrabold">
                      <span className={isSelected ? 'text-[#14274E]' : 'text-slate-400'}>
                        {isSelected ? '✓ In this preset' : 'Click to add'}
                      </span>
                      <span className="text-slate-400 font-mono">#{item.code}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-white border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 font-semibold">
            <strong className="text-[#14274E] font-black">{selectedCount}</strong> dishes selected for this preset
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-2 rounded-xl bg-[#14274E] hover:bg-[#1f3b73] active:bg-[#0f1d3b] text-white text-xs font-black tracking-wide flex items-center gap-2 shadow-sm shadow-[#14274E]/25 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving Preset...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>{isCreatingNewPreset ? 'Create Preset with Selected' : 'Save Preset Items'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
