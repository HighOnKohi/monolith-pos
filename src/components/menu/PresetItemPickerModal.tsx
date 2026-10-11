import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import {
  Search,
  X,
  Minus,
  Grid,
  Loader2,
  UtensilsCrossed,
  ChevronLeft,
  ChevronRight,
  Sun,
  Clock,
  HelpCircle,
} from 'lucide-react'
import type { MenuItem, Category } from '@/types/menu'
import { DEFAULT_FOOD_PLACEHOLDER } from '@/types/menu'
import { categoryIconMap, categoryIcons } from '@/components/menu/NewMenuCategoryModal'

export type ScheduleTabType = 'morning' | 'afternoon' | 'whole-day'

// Half sun icon for afternoon shift (prominent dome cut in half horizontally with evenly distributed rays on top)
export function HalfSun({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Prominent half-sun dome cut horizontally at base */}
      <path d="M4 18a8 8 0 0 1 16 0Z" />
      {/* 5 evenly distributed rays radiating from center around the top */}
      <line x1="12" y1="7.8" x2="12" y2="4.5" />
      <line x1="16.3" y1="8.8" x2="17.7" y2="5.8" />
      <line x1="19.8" y1="11.4" x2="22.3" y2="9.3" />
      <line x1="7.7" y1="8.8" x2="6.3" y2="5.8" />
      <line x1="4.2" y1="11.4" x2="1.7" y2="9.3" />
    </svg>
  )
}

interface PresetItemPickerModalProps {
  isOpen: boolean
  title?: string
  subtitle?: string
  presetName?: string
  isCreatingNewPreset?: boolean
  catalogItems: MenuItem[]
  categories: Category[]
  initialWholeDayItemIds?: string[]
  initialMorningItemIds?: string[]
  initialAfternoonItemIds?: string[]
  // Fallback for single array
  initialSelectedItemIds?: string[]
  onClose: () => void
  onSubmit: (data: {
    presetName?: string
    wholeDayItemIds: string[]
    morningItemIds: string[]
    afternoonItemIds: string[]
  }) => Promise<void> | void
}

export function PresetItemPickerModal({
  isOpen,
  title = 'Edit Preset',
  presetName: initialPresetName = '',
  isCreatingNewPreset = false,
  catalogItems,
  categories,
  initialWholeDayItemIds,
  initialMorningItemIds,
  initialAfternoonItemIds,
  initialSelectedItemIds,
  onClose,
  onSubmit,
}: PresetItemPickerModalProps) {
  const [activeTab, setActiveTab] = useState<ScheduleTabType>('morning')
  const [morningIds, setMorningIds] = useState<Set<string>>(new Set())
  const [afternoonIds, setAfternoonIds] = useState<Set<string>>(new Set())
  const [wholeDayIds, setWholeDayIds] = useState<Set<string>>(new Set())

  // Track previous schedule for items moved from other tabs so deselecting returns them home
  const [previousScheduleMap, setPreviousScheduleMap] = useState<Map<string, ScheduleTabType>>(new Map())

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

  // Initialize state when modal opens
  useEffect(() => {
    if (isOpen) {
      const whole = initialWholeDayItemIds ?? initialSelectedItemIds ?? []
      const morning = initialMorningItemIds ?? []
      const afternoon = initialAfternoonItemIds ?? []

      setWholeDayIds(new Set(whole.map(String)))
      setMorningIds(new Set(morning.map(String)))
      setAfternoonIds(new Set(afternoon.map(String)))
      setPreviousScheduleMap(new Map())
      setActiveTab('morning')
      setNameInput(initialPresetName)
      setNameError(null)
      setSearch('')
      setActiveCategory('all')
    }
  }, [
    isOpen,
    initialWholeDayItemIds,
    initialMorningItemIds,
    initialAfternoonItemIds,
    initialSelectedItemIds,
    initialPresetName,
  ])

  // Non-combo catalog items
  const nonGroupItems = useMemo(() => {
    return catalogItems.filter((item) => !item.isItemGroup)
  }, [catalogItems])

  // Active tab selection set
  const currentSet = useMemo(() => {
    if (activeTab === 'morning') return morningIds
    if (activeTab === 'afternoon') return afternoonIds
    return wholeDayIds
  }, [activeTab, morningIds, afternoonIds, wholeDayIds])

  // Helper to find which schedule an item currently belongs to
  const getItemSchedule = useCallback(
    (id: string): ScheduleTabType | null => {
      if (morningIds.has(id)) return 'morning'
      if (afternoonIds.has(id)) return 'afternoon'
      if (wholeDayIds.has(id)) return 'whole-day'
      return null
    },
    [morningIds, afternoonIds, wholeDayIds],
  )

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

  // Category stats for active tab
  const categoryStats = useMemo(() => {
    const stats: Record<string, { total: number; selected: number }> = {}

    nonGroupItems.forEach((it) => {
      if (!stats[it.categoryId]) {
        stats[it.categoryId] = { total: 0, selected: 0 }
      }
      stats[it.categoryId].total += 1
      if (currentSet.has(it.id)) {
        stats[it.categoryId].selected += 1
      }
    })

    return stats
  }, [nonGroupItems, currentSet])

  const allItemsCount = nonGroupItems.length
  const allSelectedInActiveTab = nonGroupItems.filter((i) => currentSet.has(i.id)).length

  if (!isOpen) return null

  // Toggle item in active schedule tab:
  // If moving from another tab, record origin. If deselecting, return to origin schedule!
  const toggleItem = (id: string) => {
    const isCurrentlySelectedInThisTab = currentSet.has(id)

    if (isCurrentlySelectedInThisTab) {
      // 1. Remove from current active tab
      if (activeTab === 'morning') {
        setMorningIds((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      } else if (activeTab === 'afternoon') {
        setAfternoonIds((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      } else {
        setWholeDayIds((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      }

      // 2. Check if this item was borrowed from another schedule; if so, RETURN IT HOME!
      const originSchedule = previousScheduleMap.get(id)
      if (originSchedule && originSchedule !== activeTab) {
        if (originSchedule === 'morning') {
          setMorningIds((prev) => new Set(prev).add(id))
        } else if (originSchedule === 'afternoon') {
          setAfternoonIds((prev) => new Set(prev).add(id))
        } else if (originSchedule === 'whole-day') {
          setWholeDayIds((prev) => new Set(prev).add(id))
        }

        // Clean up from previous map
        setPreviousScheduleMap((prev) => {
          const next = new Map(prev)
          next.delete(id)
          return next
        })
      }
    } else {
      // 1. Check if item currently exists in another schedule
      const currentSchedule = getItemSchedule(id)
      if (currentSchedule && currentSchedule !== activeTab) {
        // Record where it came from so deselecting returns it back!
        setPreviousScheduleMap((prev) => {
          const next = new Map(prev)
          if (!next.has(id)) {
            next.set(id, currentSchedule)
          }
          return next
        })
      }

      // 2. Select in active tab and remove from the other two tabs
      setMorningIds((prev) => {
        const next = new Set(prev)
        if (activeTab === 'morning') next.add(id)
        else next.delete(id)
        return next
      })
      setAfternoonIds((prev) => {
        const next = new Set(prev)
        if (activeTab === 'afternoon') next.add(id)
        else next.delete(id)
        return next
      })
      setWholeDayIds((prev) => {
        const next = new Set(prev)
        if (activeTab === 'whole-day') next.add(id)
        else next.delete(id)
        return next
      })
    }
  }

  // Bulk toggle category in active tab
  const toggleCategorySelection = (categoryId: string) => {
    const targetItems =
      categoryId === 'all'
        ? nonGroupItems
        : nonGroupItems.filter((it) => it.categoryId === categoryId)

    const allCatSelected =
      targetItems.length > 0 &&
      targetItems.every((it) => currentSet.has(it.id))

    const targetIds = targetItems.map((it) => it.id)

    if (allCatSelected) {
      // Deselect all target items in current tab & return borrowed items to their origin
      targetIds.forEach((id) => {
        const originSchedule = previousScheduleMap.get(id)
        if (originSchedule && originSchedule !== activeTab) {
          if (originSchedule === 'morning') setMorningIds((prev) => new Set(prev).add(id))
          else if (originSchedule === 'afternoon') setAfternoonIds((prev) => new Set(prev).add(id))
          else if (originSchedule === 'whole-day') setWholeDayIds((prev) => new Set(prev).add(id))
        }
      })

      setPreviousScheduleMap((prev) => {
        const next = new Map(prev)
        targetIds.forEach((id) => next.delete(id))
        return next
      })

      if (activeTab === 'morning') {
        setMorningIds((prev) => {
          const next = new Set(prev)
          targetIds.forEach((id) => next.delete(id))
          return next
        })
      } else if (activeTab === 'afternoon') {
        setAfternoonIds((prev) => {
          const next = new Set(prev)
          targetIds.forEach((id) => next.delete(id))
          return next
        })
      } else {
        setWholeDayIds((prev) => {
          const next = new Set(prev)
          targetIds.forEach((id) => next.delete(id))
          return next
        })
      }
    } else {
      // Add all targetIds to current tab, recording origin for moved items
      setPreviousScheduleMap((prev) => {
        const next = new Map(prev)
        targetIds.forEach((id) => {
          const currentSchedule = getItemSchedule(id)
          if (currentSchedule && currentSchedule !== activeTab && !next.has(id)) {
            next.set(id, currentSchedule)
          }
        })
        return next
      })

      setMorningIds((prev) => {
        const next = new Set(prev)
        targetIds.forEach((id) => {
          if (activeTab === 'morning') next.add(id)
          else next.delete(id)
        })
        return next
      })
      setAfternoonIds((prev) => {
        const next = new Set(prev)
        targetIds.forEach((id) => {
          if (activeTab === 'afternoon') next.add(id)
          else next.delete(id)
        })
        return next
      })
      setWholeDayIds((prev) => {
        const next = new Set(prev)
        targetIds.forEach((id) => {
          if (activeTab === 'whole-day') next.add(id)
          else next.delete(id)
        })
        return next
      })
    }
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
        wholeDayItemIds: Array.from(wholeDayIds),
        morningItemIds: Array.from(morningIds),
        afternoonItemIds: Array.from(afternoonIds),
      })
      onClose()
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 sm:p-5 select-none">
      <div className="w-full max-w-5xl h-[88vh] max-h-[880px] min-h-[640px] bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header: Clean title "Edit Preset" or "Create Preset", without icon or description */}
        <div className="px-6 py-4 bg-[#14274E] text-white flex items-center justify-between shrink-0">
          <h2 className="text-base font-black tracking-tight">
            {isCreatingNewPreset ? 'Create Preset' : 'Edit Preset'}
          </h2>
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
          <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 shrink-0">
            <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wider mb-1">
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
                placeholder="e.g. Standard Weekday Menu, Weekend Special, Brunch Lineup..."
                className="w-full sm:max-w-md px-3.5 py-2 bg-white border border-slate-300 focus:border-[#14274E] focus:ring-1 focus:ring-[#14274E] rounded-xl text-sm font-bold text-[#14274E] outline-none"
                autoFocus
              />
              {nameError && (
                <span className="text-xs font-bold text-rose-600 shrink-0">{nameError}</span>
              )}
            </div>
          </div>
        )}

        {/* 3 SCHEDULE TABS ON LEFT, SEARCH BAR ON RIGHT (Combined Row) */}
        <div className="px-6 py-2.5 bg-white border-b border-slate-200 shrink-0 flex items-center justify-between gap-4 flex-wrap">
          {/* Left: Info Question Mark Tooltip + 3 Schedule Tabs */}
          <div className="flex items-center gap-2">
            {/* Question Mark Info Tooltip */}
            <div className="relative group/info shrink-0">
              <button
                type="button"
                className="w-7 h-7 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200/90 flex items-center justify-center text-slate-500 hover:text-[#14274E] transition-all cursor-help"
                aria-label="Menu Scheduling Guide"
              >
                <HelpCircle className="w-3.5 h-3.5 stroke-[2.2]" />
              </button>

              {/* Tooltip Popover */}
              <div className="absolute left-0 top-full mt-2 w-72 p-3 bg-[#14274E] text-white rounded-2xl shadow-xl z-50 pointer-events-none opacity-0 invisible group-hover/info:opacity-100 group-hover/info:visible transition-all duration-200 -translate-y-1 group-hover/info:translate-y-0 border border-slate-700/50">
                <div className="font-black text-[#E9C46A] text-xs mb-1">
                  Menu Scheduling
                </div>
                <p className="text-slate-200 text-[11px] leading-relaxed">
                  <b>Morning:</b> Visible before the morning cutoff time.<br />
                  <b>Afternoon:</b> Visible after the cutoff time.<br />
                  <b>Whole Day:</b> Persists 24/7 regardless of time.
                </p>
                {/* Pointer tip */}
                <div className="absolute -top-1 left-3 w-2 h-2 bg-[#14274E] rotate-45 border-l border-t border-slate-700/50" />
              </div>
            </div>

            {/* 3 Tabs (Tab colors based on badge colors: Bright Yellow for Morning, Dark Orange for Afternoon, Navy for Whole Day) */}
            <div className="flex items-center bg-slate-100 p-1 rounded-2xl gap-1 border border-slate-200 shrink-0">
              {/* Tab 1: Morning (Full Sun icon, Bright Yellow when selected) */}
              <button
                type="button"
                onClick={() => setActiveTab('morning')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${activeTab === 'morning'
                  ? 'bg-yellow-400 text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
              >
                <Sun className={`w-3.5 h-3.5 ${activeTab === 'morning' ? 'text-slate-900' : 'text-yellow-600'}`} />
                <span>Morning</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${activeTab === 'morning'
                    ? 'bg-yellow-500 text-slate-900'
                    : 'bg-slate-200 text-slate-700'
                    }`}
                >
                  {morningIds.size}
                </span>
              </button>

              {/* Tab 2: Afternoon (Half Sun icon without arrow, Dark Orange when selected) */}
              <button
                type="button"
                onClick={() => setActiveTab('afternoon')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${activeTab === 'afternoon'
                  ? 'bg-orange-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
              >
                <HalfSun className={`w-3.5 h-3.5 ${activeTab === 'afternoon' ? 'text-white' : 'text-orange-600'}`} />
                <span>Afternoon</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${activeTab === 'afternoon'
                    ? 'bg-orange-700 text-white'
                    : 'bg-slate-200 text-slate-700'
                    }`}
                >
                  {afternoonIds.size}
                </span>
              </button>

              {/* Tab 3: Whole Day (Clock icon, Navy + Gold when selected) */}
              <button
                type="button"
                onClick={() => setActiveTab('whole-day')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${activeTab === 'whole-day'
                  ? 'bg-[#14274E] text-[#E9C46A] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
              >
                <Clock className={`w-3.5 h-3.5 ${activeTab === 'whole-day' ? 'text-[#E9C46A]' : 'text-slate-500'}`} />
                <span>Whole Day</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${activeTab === 'whole-day'
                    ? 'bg-[#1f3b73] text-[#E9C46A]'
                    : 'bg-slate-200 text-slate-700'
                    }`}
                >
                  {wholeDayIds.size}
                </span>
              </button>
            </div>
          </div>

          {/* Right: Search Bar */}
          <div className="relative w-full max-w-xs sm:max-w-sm">
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
        <div className="relative bg-slate-50 border-b border-slate-200/70 px-4 sm:px-6 py-2 shrink-0 group/row">
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
              const isAllSelected = allItemsCount > 0 && allSelectedInActiveTab === allItemsCount
              const isPartiallySelected =
                allSelectedInActiveTab > 0 && allSelectedInActiveTab < allItemsCount

              return (
                <div
                  onClick={() => setActiveCategory('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-2 border ${isAllActive
                    ? 'bg-[#14274E] text-white border-[#14274E] shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleCategorySelection('all')
                    }}
                    className={`w-4 h-4 rounded flex items-center justify-center transition-colors cursor-pointer shrink-0 ${isAllSelected
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
                    title={`Select / Deselect all dishes for ${activeTab}`}
                  >
                    {isAllSelected && <span className="font-black text-xs">✓</span>}
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
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-2 border ${isActive
                      ? 'bg-[#14274E] text-white border-[#14274E] shadow-2xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleCategorySelection(cat.id)
                      }}
                      className={`w-4 h-4 rounded flex items-center justify-center transition-colors cursor-pointer shrink-0 ${isAllCatSelected
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
                      title={`Select / Deselect all in ${cat.name} for ${activeTab}`}
                    >
                      {isAllCatSelected && <span className="font-black text-xs">✓</span>}
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
                const isSelectedInActiveTab = currentSet.has(item.id)
                const currentSchedule = getItemSchedule(item.id)
                const isOutOfSchedule = !isSelectedInActiveTab

                return (
                  <div
                    key={item.id}
                    onClick={() => toggleItem(item.id)}
                    className={`group relative rounded-2xl border-2 transition-all p-2.5 flex flex-col justify-between cursor-pointer select-none ${isSelectedInActiveTab
                      ? activeTab === 'morning'
                        ? 'border-yellow-400 shadow-sm shadow-yellow-400/10 ring-1 ring-yellow-400/40 bg-white opacity-100'
                        : activeTab === 'afternoon'
                          ? 'border-orange-600 shadow-sm shadow-orange-600/15 ring-1 ring-orange-600/30 bg-white opacity-100'
                          : 'border-[#14274E] shadow-sm shadow-[#14274E]/10 ring-1 ring-[#14274E]/20 bg-white opacity-100'
                      : isOutOfSchedule
                        ? 'border-slate-200/80 bg-slate-50/50 opacity-70 hover:opacity-90 hover:bg-white hover:border-slate-300 shadow-2xs'
                        : 'border-slate-200 hover:border-slate-300 shadow-2xs bg-white'
                      }`}
                  >
                    {/* Top-Left Schedule Badge: Full Sun for Morning, Half Sun (no arrow) for Afternoon, Clock for Whole Day */}
                    {/* If item is not of the active schedule, badge is also faded out to separate it more */}
                    {currentSchedule === 'morning' && (
                      <div
                        className={`absolute -top-[2px] -left-[2px] z-10 flex items-center justify-center w-7 h-7 rounded-tl-[14px] rounded-br-xl transition-all ${isSelectedInActiveTab
                          ? 'bg-yellow-400 text-slate-900 shadow-xs opacity-100'
                          : 'bg-yellow-400/80 text-slate-900/80 opacity-50 group-hover:opacity-90 shadow-none'
                          }`}
                        title={isSelectedInActiveTab ? 'Morning Menu Item' : 'Morning Menu Item (different schedule)'}
                      >
                        <Sun className="w-4 h-4 stroke-[2.4]" />
                      </div>
                    )}
                    {currentSchedule === 'afternoon' && (
                      <div
                        className={`absolute -top-[2px] -left-[2px] z-10 flex items-center justify-center w-7 h-7 rounded-tl-[14px] rounded-br-xl transition-all ${isSelectedInActiveTab
                          ? 'bg-orange-600 text-white shadow-xs opacity-100'
                          : 'bg-orange-600/75 text-white/90 opacity-50 group-hover:opacity-90 shadow-none'
                          }`}
                        title={isSelectedInActiveTab ? 'Afternoon Menu Item' : 'Afternoon Menu Item (different schedule)'}
                      >
                        <HalfSun className="w-4 h-4" />
                      </div>
                    )}
                    {currentSchedule === 'whole-day' && (
                      <div
                        className={`absolute -top-[2px] -left-[2px] z-10 flex items-center justify-center w-7 h-7 rounded-tl-[14px] rounded-br-xl transition-all ${isSelectedInActiveTab
                          ? 'bg-[#14274E] text-[#E9C46A] shadow-xs opacity-100'
                          : 'bg-[#14274E]/70 text-[#E9C46A]/80 opacity-50 group-hover:opacity-90 shadow-none'
                          }`}
                        title={isSelectedInActiveTab ? 'Whole Day Menu Item' : 'Whole Day Menu Item (different schedule)'}
                      >
                        <Clock className="w-4 h-4 stroke-[2.4]" />
                      </div>
                    )}

                    {/* Picture (No checkboxes per requirement) */}
                    <div>
                      <div className="relative w-full aspect-4/3 rounded-xl overflow-hidden bg-slate-100 mb-2 shrink-0">
                        <img
                          src={item.imageUrl || DEFAULT_FOOD_PLACEHOLDER}
                          alt={item.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            ; (e.currentTarget as HTMLImageElement).src = DEFAULT_FOOD_PLACEHOLDER
                          }}
                        />
                      </div>

                      {/* Full Name Display */}
                      <h3
                        className="font-black text-xs text-[#14274E] leading-snug break-words"
                        title={item.name}
                      >
                        {item.name}
                      </h3>
                    </div>

                    {/* Price (Vegan label removed) */}
                    <div className="mt-2.5 pt-1.5 border-t border-slate-100 flex items-center justify-between">
                      <span className="font-black text-xs text-[#14274E]">
                        ₱{item.price.toFixed(2)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Modal Footer: Clean without scheduled counter, item counter, or check icon */}
        <div className="px-6 py-3.5 bg-white border-t border-slate-200 flex items-center justify-end gap-2.5 shrink-0">
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
              <span>{isCreatingNewPreset ? 'Create Preset' : 'Save Menu Preset'}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
