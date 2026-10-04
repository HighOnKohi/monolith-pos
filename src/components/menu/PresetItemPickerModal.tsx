import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import {
  Search,
  X,
  Check,
  Minus,
  Grid,
  Loader2,
  UtensilsCrossed,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import type { MenuItem, Category } from '@/types/menu'
import { DEFAULT_FOOD_PLACEHOLDER } from '@/types/menu'
import { categoryIconMap, categoryIcons } from '@/components/menu/NewMenuCategoryModal'

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

  // Category scroll row refs & state
  const catScrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const checkScroll = useCallback(() => {
    const el = catScrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 2)
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 2)
  }, [])

  useEffect(() => {
    if (isOpen) {
      setTimeout(checkScroll, 100)
      setTimeout(checkScroll, 300)
    }
  }, [isOpen, checkScroll])

  useEffect(() => {
    const el = catScrollRef.current
    if (!el) return
    el.addEventListener('scroll', checkScroll, { passive: true })
    window.addEventListener('resize', checkScroll)
    return () => {
      el.removeEventListener('scroll', checkScroll)
      window.removeEventListener('resize', checkScroll)
    }
  }, [checkScroll])

  const handleCatWheel = (e: React.WheelEvent) => {
    const el = catScrollRef.current
    if (!el) return
    if (Math.abs(e.deltaX) < Math.abs(e.deltaY)) {
      el.scrollLeft += e.deltaY
      checkScroll()
    }
  }

  const scrollCategories = (offset: number) => {
    catScrollRef.current?.scrollBy({ left: offset, behavior: 'smooth' })
    setTimeout(checkScroll, 100)
    setTimeout(checkScroll, 250)
    setTimeout(checkScroll, 400)
  }

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

  // Non-combo catalog items
  const nonGroupItems = useMemo(() => {
    return catalogItems.filter((item) => !item.isItemGroup)
  }, [catalogItems])

  // Filtered catalog items
  const filteredItems = useMemo(() => {
    return nonGroupItems.filter((item) => {
      const matchesSearch =
        search.trim() === '' ||
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.code.toLowerCase().includes(search.toLowerCase())
      const matchesCat = activeCategory === 'all' || item.categoryId === activeCategory
      return matchesSearch && matchesCat
    })
  }, [nonGroupItems, search, activeCategory])

  // Category counts and selection state
  const categoryStats = useMemo(() => {
    const stats: Record<string, { total: number; selected: number }> = {}

    nonGroupItems.forEach((it) => {
      if (!stats[it.categoryId]) {
        stats[it.categoryId] = { total: 0, selected: 0 }
      }
      stats[it.categoryId].total += 1
      if (selectedIds.has(it.id)) {
        stats[it.categoryId].selected += 1
      }
    })

    return stats
  }, [nonGroupItems, selectedIds])

  const allItemsCount = nonGroupItems.length
  const allSelectedCount = nonGroupItems.filter((i) => selectedIds.has(i.id)).length

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

  const toggleCategorySelection = (categoryId: string) => {
    const categoryItems =
      categoryId === 'all'
        ? nonGroupItems
        : nonGroupItems.filter((it) => it.categoryId === categoryId)

    const allCatSelected =
      categoryItems.length > 0 &&
      categoryItems.every((it) => selectedIds.has(it.id))

    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allCatSelected) {
        // Deselect all in category
        categoryItems.forEach((it) => next.delete(it.id))
      } else {
        // Select all in category
        categoryItems.forEach((it) => next.add(it.id))
      }
      return next
    })
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 sm:p-5 select-none">
      <div className="w-full max-w-5xl h-[85vh] max-h-[850px] min-h-[600px] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-[#14274E] text-white flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base font-black tracking-tight">{title}</h2>
            <p className="text-xs text-slate-300 font-medium mt-0.5">
              {subtitle || 'Select catalog dishes to include in this menu preset.'}
            </p>
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

        {/* Search Bar Row */}
        <div className="px-6 py-3 bg-white border-b border-slate-200 shrink-0">
          <div className="relative w-full max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search catalog items..."
              className="w-full pl-10 pr-3.5 py-2 bg-slate-50 border border-slate-200 focus:border-[#14274E] focus:bg-white rounded-xl text-xs font-semibold text-[#14274E] outline-none transition-colors"
            />
          </div>
        </div>

        {/* Category Pills with Scroll Arrows */}
        <div className="relative bg-slate-50 border-b border-slate-200/70 px-4 sm:px-6 py-2.5 shrink-0 group/row">
          {/* Scroll Left (Back) Button */}
          {canScrollLeft && (
            <button
              type="button"
              onClick={() => scrollCategories(-240)}
              className="absolute left-1.5 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-white/95 border border-slate-200 shadow-md flex items-center justify-center text-slate-700 hover:bg-[#14274E] hover:text-white transition-all cursor-pointer"
              title="Scroll Left"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}

          {/* Scroll Right (Forward) Button */}
          {canScrollRight && (
            <button
              type="button"
              onClick={() => scrollCategories(240)}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-white/95 border border-slate-200 shadow-md flex items-center justify-center text-slate-700 hover:bg-[#14274E] hover:text-white transition-all cursor-pointer"
              title="Scroll Right"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}

          <div
            ref={catScrollRef}
            onWheel={handleCatWheel}
            className="flex items-center gap-2 overflow-x-auto scrollbar-none scroll-smooth w-full py-0.5"
          >
            {/* All Categories Pill */}
            {(() => {
              const isAllActive = activeCategory === 'all'
              const isAllSelected = allItemsCount > 0 && allSelectedCount === allItemsCount
              const isPartiallySelected = allSelectedCount > 0 && allSelectedCount < allItemsCount

              return (
                <div
                  onClick={() => setActiveCategory('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-2 border ${
                    isAllActive
                      ? 'bg-[#14274E] text-white border-[#14274E] shadow-2xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {/* Category Checkbox */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleCategorySelection('all')
                    }}
                    className={`w-4 h-4 rounded flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                      isAllSelected
                        ? isAllActive
                          ? 'bg-[#E9C46A] text-[#14274E]'
                          : 'bg-[#14274E] text-[#E9C46A]'
                        : isPartiallySelected
                          ? isAllActive
                            ? 'bg-[#E9C46A] text-[#14274E]'
                            : 'bg-[#14274E] text-white'
                          : isAllActive
                            ? 'border border-white/60 bg-white/20'
                            : 'border border-slate-300 bg-slate-50'
                    }`}
                    title="Select / Deselect all dishes"
                  >
                    {isAllSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    {isPartiallySelected && <Minus className="w-3 h-3 stroke-[3]" />}
                  </button>

                  <Grid className="w-3.5 h-3.5 shrink-0 opacity-80" />
                  <span>All Categories</span>
                  <span className={`text-[10px] ${isAllActive ? 'text-[#E9C46A]' : 'text-slate-400'}`}>
                    ({allItemsCount})
                  </span>
                </div>
              )
            })()}

            {/* Individual Category Pills */}
            {categories
              .filter((c) => c.id !== 'all')
              .map((cat, idx) => {
                const isActive = activeCategory === cat.id
                const stats = categoryStats[cat.id] ?? { total: 0, selected: 0 }
                const isAllCatSelected = stats.total > 0 && stats.selected === stats.total
                const isPartiallyCatSelected = stats.selected > 0 && stats.selected < stats.total

                const CategoryIcon =
                  (cat.icon ? categoryIconMap[cat.icon as keyof typeof categoryIconMap] : undefined) ??
                  categoryIcons[idx % categoryIcons.length]?.component ??
                  UtensilsCrossed

                return (
                  <div
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-2 border ${
                      isActive
                        ? 'bg-[#14274E] text-white border-[#14274E] shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {/* Checkbox for Category */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleCategorySelection(cat.id)
                      }}
                      className={`w-4 h-4 rounded flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                        isAllCatSelected
                          ? isActive
                            ? 'bg-[#E9C46A] text-[#14274E]'
                            : 'bg-[#14274E] text-[#E9C46A]'
                          : isPartiallyCatSelected
                            ? isActive
                              ? 'bg-[#E9C46A] text-[#14274E]'
                              : 'bg-[#14274E] text-white'
                            : isActive
                              ? 'border border-white/60 bg-white/20'
                              : 'border border-slate-300 bg-slate-50'
                      }`}
                      title={`Select / Deselect all in ${cat.name}`}
                    >
                      {isAllCatSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      {isPartiallyCatSelected && <Minus className="w-3 h-3 stroke-[3]" />}
                    </button>

                    <CategoryIcon className="w-3.5 h-3.5 shrink-0 opacity-80" />
                    <span>{cat.name}</span>
                    <span className={`text-[10px] ${isActive ? 'text-[#E9C46A]' : 'text-slate-400'}`}>
                      ({stats.total})
                    </span>
                  </div>
                )
              })}
          </div>
        </div>

        {/* Item Grid Body */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50">
          {filteredItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center py-16 text-center">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto mb-3 text-slate-400">
                <UtensilsCrossed className="w-6 h-6" />
              </div>
              <p className="text-sm font-extrabold text-slate-700">No catalog items found</p>
              <p className="text-xs text-slate-400 mt-1">Try changing your search term or category filter.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
              {filteredItems.map((item) => {
                const isSelected = selectedIds.has(item.id)

                return (
                  <div
                    key={item.id}
                    onClick={() => toggleItem(item.id)}
                    className={`relative rounded-2xl border-2 transition-colors p-2.5 bg-white flex flex-col justify-between cursor-pointer select-none ${
                      isSelected
                        ? 'border-[#14274E] shadow-sm shadow-[#14274E]/10 ring-1 ring-[#14274E]/20'
                        : 'border-slate-200 hover:border-slate-300 shadow-2xs'
                    }`}
                  >
                    {/* Picture & Badges */}
                    <div>
                      <div className="relative w-full aspect-4/3 rounded-xl overflow-hidden bg-slate-100 mb-2 shrink-0">
                        <img
                          src={item.imageUrl || DEFAULT_FOOD_PLACEHOLDER}
                          alt={item.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            ;(e.currentTarget as HTMLImageElement).src = DEFAULT_FOOD_PLACEHOLDER
                          }}
                        />

                        {/* Top-Right Selection Indicator */}
                        <div
                          className={`absolute top-1.5 right-1.5 w-5 h-5 rounded-md flex items-center justify-center transition-colors ${
                            isSelected
                              ? 'bg-[#14274E] text-[#E9C46A] shadow-xs'
                              : 'bg-white/90 border border-slate-300 text-transparent'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      </div>

                      {/* Full Name Display */}
                      <h3
                        className="font-black text-xs text-[#14274E] leading-snug break-words"
                        title={item.name}
                      >
                        {item.name}
                      </h3>
                    </div>

                    {/* Price & Vegan / Dietary Badge */}
                    <div className="mt-2.5 pt-1.5 border-t border-slate-100 flex items-center justify-between gap-1">
                      <span className="font-black text-xs text-[#14274E]">
                        ₱{item.price.toFixed(2)}
                      </span>

                      {/* Vegan / Dietary Badge */}
                      {item.dietaryType === 'veg' ? (
                        <span className="text-[8.5px] font-black tracking-wide text-emerald-800 bg-emerald-100/95 border border-emerald-300 px-1.5 py-0.5 rounded-md shadow-2xs">
                          VEG
                        </span>
                      ) : (
                        <span className="text-[8.5px] font-black tracking-wide text-rose-800 bg-rose-100/95 border border-rose-300 px-1.5 py-0.5 rounded-md shadow-2xs">
                          NON-VEG
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-white border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 font-medium">
            Toggle dishes or entire categories to update the active menu preset.
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
                  <span>{isCreatingNewPreset ? 'Create Preset with Selected' : 'Save Menu Preset'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
