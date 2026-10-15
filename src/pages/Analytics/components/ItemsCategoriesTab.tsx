import { useState, useEffect, useMemo, useRef } from 'react'
import {
  Package,
  Layers,
  Filter,
  ChevronDown,
  Search,
  SlidersHorizontal,
  Tag,
  Check,
  Info,
} from 'lucide-react'
import type {
  AnalyticsSummary,
  ItemSalesStat,
} from '@/services/analyticsService'
import { fetchMenuPresets, getAllPresetItemIds, type MenuPreset } from '@/services/menuService'

interface ItemsCategoriesTabProps {
  summary: AnalyticsSummary
}

const CATEGORY_PALETTE = [
  '#14274E',
  '#F97316',
  '#2A9D8F',
  '#E76F51',
  '#6366F1',
  '#EC4899',
  '#10B981',
  '#8B5CF6',
  '#F59E0B',
  '#06B6D4',
]

const ITEM_PALETTE = [
  '#14274E',
  '#F97316',
  '#2A9D8F',
  '#E76F51',
  '#6366F1',
  '#EC4899',
  '#10B981',
  '#8B5CF6',
  '#F59E0B',
  '#06B6D4',
]

const TREND_DAYS = [
  { key: 'Sunday', short: 'Sun' },
  { key: 'Monday', short: 'Mon' },
  { key: 'Tuesday', short: 'Tue' },
  { key: 'Wednesday', short: 'Wed' },
  { key: 'Thursday', short: 'Thu' },
  { key: 'Friday', short: 'Fri' },
  { key: 'Saturday', short: 'Sat' },
]

const TREND_MONTHS = [
  { key: 'January', short: 'Jan' },
  { key: 'February', short: 'Feb' },
  { key: 'March', short: 'Mar' },
  { key: 'April', short: 'Apr' },
  { key: 'May', short: 'May' },
  { key: 'June', short: 'Jun' },
  { key: 'July', short: 'Jul' },
  { key: 'August', short: 'Aug' },
  { key: 'September', short: 'Sep' },
  { key: 'October', short: 'Oct' },
  { key: 'November', short: 'Nov' },
  { key: 'December', short: 'Dec' },
]

/**
 * Reusable sleek info tooltip helper matching the Revenue Summary & Peak Hour design
 */
function InfoTooltip({
  title,
  text,
  bullets,
  align = 'right',
}: {
  title: string
  text?: string
  bullets?: Array<{ label: string; desc: string }>
  align?: 'left' | 'right'
}) {
  const [open, setOpen] = useState(false)

  return (
    <div
      className="relative inline-flex items-center"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-5 h-5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors cursor-help select-none no-print"
        aria-label="Info tooltip"
      >
        <Info className="w-3.5 h-3.5" />
      </button>

      {open && (
        <div
          className={`absolute top-full mt-2 w-72 bg-[#14274E] text-white p-3 rounded-xl shadow-xl border border-slate-700/80 text-xs z-50 pointer-events-none transition-all duration-150 ${
            align === 'left' ? 'right-0' : 'left-0'
          }`}
        >
          <div className="font-bold text-[#E9C46A] mb-1.5 flex items-center gap-1.5 text-[11px] uppercase tracking-wide">
            <Info className="w-3 h-3 text-[#E9C46A]" />
            <span>{title}</span>
          </div>
          {text && <p className="text-slate-200 leading-relaxed text-[11px] mb-1.5">{text}</p>}
          {bullets && (
            <div className="space-y-1.5 pt-0.5">
              {bullets.map((b, idx) => (
                <div key={idx} className="leading-snug text-[11px]">
                  <span className="font-extrabold text-amber-300">{b.label}: </span>
                  <span className="text-slate-200">{b.desc}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function ItemsCategoriesTab({ summary }: ItemsCategoriesTabProps) {
  // ── Global Presets Filter State ──
  const [presets, setPresets] = useState<MenuPreset[]>([])
  const [selectedPresetIds, setSelectedPresetIds] = useState<Set<number>>(new Set())
  const [presetDropdownOpen, setPresetDropdownOpen] = useState(false)
  const presetDropdownRef = useRef<HTMLDivElement>(null)

  // ── Item Graph State ──
  const [itemMode, setItemMode] = useState<'ranking' | 'trend'>('ranking')
  const [itemTrendPeriod, setItemTrendPeriod] = useState<'weekly' | 'monthly'>('weekly')
  const [itemTrendDropdownOpen, setItemTrendDropdownOpen] = useState(false)
  const [itemSortOrder, setItemSortOrder] = useState<'desc' | 'asc'>('desc')
  const [excludedItemIds, setExcludedItemIds] = useState<Set<number>>(new Set())
  const [itemDropdownOpen, setItemDropdownOpen] = useState(false)
  const [itemSearchQuery, setItemSearchQuery] = useState('')
  const [hoveredItemId, setHoveredItemId] = useState<number | null>(null)
  const itemTrendDropdownRef = useRef<HTMLDivElement>(null)
  const itemFilterRef = useRef<HTMLDivElement>(null)

  // ── Category Graph State ──
  const [categoryMode, setCategoryMode] = useState<'ranking' | 'trend'>('ranking')
  const [categoryTrendPeriod, setCategoryTrendPeriod] = useState<'weekly' | 'monthly'>('weekly')
  const [categoryTrendDropdownOpen, setCategoryTrendDropdownOpen] = useState(false)
  const [categorySortOrder, setCategorySortOrder] = useState<'desc' | 'asc'>('desc')
  const [excludedCategoryNames, setExcludedCategoryNames] = useState<Set<string>>(new Set())
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false)
  const [hoveredCategoryName, setHoveredCategoryName] = useState<string | null>(null)
  const categoryTrendDropdownRef = useRef<HTMLDivElement>(null)
  const categoryFilterRef = useRef<HTMLDivElement>(null)

  // ── Preset Performance Graph State ──
  const [presetSortOrder, setPresetSortOrder] = useState<'desc' | 'asc'>('desc')

  // Load menu presets
  useEffect(() => {
    fetchMenuPresets()
      .then((data) => {
        setPresets(data)
        setSelectedPresetIds(new Set(data.map((p) => p.PRESET_ID)))
      })
      .catch((err) => {
        console.error('[ItemsCategoriesTab] Failed to fetch menu presets:', err)
      })
  }, [])

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node
      if (presetDropdownRef.current && !presetDropdownRef.current.contains(target)) {
        setPresetDropdownOpen(false)
      }
      if (itemTrendDropdownRef.current && !itemTrendDropdownRef.current.contains(target)) {
        setItemTrendDropdownOpen(false)
      }
      if (itemFilterRef.current && !itemFilterRef.current.contains(target)) {
        setItemDropdownOpen(false)
      }
      if (categoryTrendDropdownRef.current && !categoryTrendDropdownRef.current.contains(target)) {
        setCategoryTrendDropdownOpen(false)
      }
      if (categoryFilterRef.current && !categoryFilterRef.current.contains(target)) {
        setCategoryDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Map of preset ID to allowed item IDs
  const presetItemIdsMap = useMemo(() => {
    const map = new Map<number, Set<string>>()
    for (const p of presets) {
      const ids = getAllPresetItemIds(p)
      map.set(p.PRESET_ID, new Set(ids))
    }
    return map
  }, [presets])

  // Set of allowed item IDs across currently selected presets
  const activePresetAllowedItemIds = useMemo(() => {
    if (presets.length === 0 || selectedPresetIds.size === presets.length) {
      return null
    }
    const combined = new Set<string>()
    for (const pId of selectedPresetIds) {
      const ids = presetItemIdsMap.get(pId)
      if (ids) ids.forEach((id) => combined.add(id))
    }
    return combined
  }, [presets, selectedPresetIds, presetItemIdsMap])

  // Base list of items
  const baseItems: ItemSalesStat[] = useMemo(() => {
    return summary.allItems?.length ? summary.allItems : summary.topItems
  }, [summary.allItems, summary.topItems])

  // Group items by category for the item selector
  const itemsByCategory = useMemo(() => {
    const map = new Map<string, ItemSalesStat[]>()
    for (const it of baseItems) {
      const cat = it.categoryName || 'Uncategorized'
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat)!.push(it)
    }
    return map
  }, [baseItems])

  // Filtered items for display
  const displayItems = useMemo(() => {
    return baseItems
      .filter((it) => {
        if (activePresetAllowedItemIds !== null && !activePresetAllowedItemIds.has(String(it.itemId))) {
          return false
        }
        if (excludedItemIds.has(it.itemId)) {
          return false
        }
        return true
      })
      .sort((a, b) => (itemSortOrder === 'desc' ? b.quantity - a.quantity : a.quantity - b.quantity))
  }, [baseItems, activePresetAllowedItemIds, excludedItemIds, itemSortOrder])

  // Filtered categories for display
  const displayCategories = useMemo(() => {
    const catMap = new Map<string, { categoryName: string; itemsSold: number; revenue: number }>()

    for (const it of baseItems) {
      if (activePresetAllowedItemIds !== null && !activePresetAllowedItemIds.has(String(it.itemId))) {
        continue
      }
      const catName = it.categoryName || 'Uncategorized'
      if (excludedCategoryNames.has(catName)) {
        continue
      }

      const existing = catMap.get(catName) || {
        categoryName: catName,
        itemsSold: 0,
        revenue: 0,
      }
      existing.itemsSold += it.quantity
      existing.revenue += it.revenue
      catMap.set(catName, existing)
    }

    const list = Array.from(catMap.values())
    const totalSold = list.reduce((sum, c) => sum + c.itemsSold, 0)

    return list
      .map((c) => ({
        ...c,
        percentageOfTotal: totalSold > 0 ? Math.round((c.itemsSold / totalSold) * 100) : 0,
      }))
      .sort((a, b) => (categorySortOrder === 'desc' ? b.itemsSold - a.itemsSold : a.itemsSold - b.itemsSold))
  }, [baseItems, activePresetAllowedItemIds, excludedCategoryNames, categorySortOrder])

  // Filtered presets for display
  const displayPresets = useMemo(() => {
    const list = [...(summary.presetStats || [])]
    return list.sort((a, b) => (presetSortOrder === 'desc' ? b.itemsSold - a.itemsSold : a.itemsSold - b.itemsSold))
  }, [summary.presetStats, presetSortOrder])

  // Toggle presets
  const togglePreset = (pId: number) => {
    setSelectedPresetIds((prev) => {
      const next = new Set(prev)
      if (next.has(pId)) next.delete(pId)
      else next.add(pId)
      return next
    })
  }

  // Toggle single item
  const toggleItem = (itemId: number) => {
    setExcludedItemIds((prev) => {
      const next = new Set(prev)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })
  }

  // Bulk category item toggle
  const toggleAllItemsInCategory = (categoryName: string, makeIncluded: boolean) => {
    const itemsInCat = itemsByCategory.get(categoryName) || []
    setExcludedItemIds((prev) => {
      const next = new Set(prev)
      for (const it of itemsInCat) {
        if (makeIncluded) next.delete(it.itemId)
        else next.add(it.itemId)
      }
      return next
    })
  }

  // Toggle single category
  const toggleCategory = (catName: string) => {
    setExcludedCategoryNames((prev) => {
      const next = new Set(prev)
      if (next.has(catName)) next.delete(catName)
      else next.add(catName)
      return next
    })
  }

  // Maximum sell counts for Ranking mode
  const maxItemSellCount = Math.max(...displayItems.map((i) => i.quantity), 1)
  const maxCatSellCount = Math.max(...displayCategories.map((c) => c.itemsSold), 1)
  const maxPresetSellCount = Math.max(...displayPresets.map((p) => p.itemsSold), 1)

  // ── Items Trend Analysis Setup ──
  const trackedTrendItems = useMemo(() => {
    // If user filtered down, show active items (up to 6); otherwise top 5
    return displayItems.slice(0, 5)
  }, [displayItems])

  const getItemTrendValue = (pointKey: string, itemId: number): number => {
    if (itemTrendPeriod === 'weekly') {
      return summary.dayOfWeekItemStats?.[pointKey]?.allItems?.find((i) => i.itemId === itemId)?.quantity || 0
    }
    return summary.monthItemStats?.[pointKey]?.allItems?.find((i) => i.itemId === itemId)?.quantity || 0
  }

  const itemTrendPoints = itemTrendPeriod === 'weekly' ? TREND_DAYS : TREND_MONTHS

  const itemTrendMax = useMemo(() => {
    let max = 0
    for (const pt of itemTrendPoints) {
      for (const it of trackedTrendItems) {
        const v = getItemTrendValue(pt.key, it.itemId)
        if (v > max) max = v
      }
    }
    return Math.max(max, 1)
  }, [itemTrendPoints, trackedTrendItems, itemTrendPeriod, summary])

  // Total sold across all points for the hovered item
  const hoveredItemTotal = useMemo(() => {
    if (hoveredItemId === null) return 0
    return itemTrendPoints.reduce((sum, pt) => sum + getItemTrendValue(pt.key, hoveredItemId), 0)
  }, [hoveredItemId, itemTrendPoints, itemTrendPeriod, summary])

  const hoveredItemObj = useMemo(() => {
    if (hoveredItemId === null) return null
    return trackedTrendItems.find((i) => i.itemId === hoveredItemId) || null
  }, [hoveredItemId, trackedTrendItems])

  // ── Categories Trend Analysis Setup ──
  const trackedTrendCategories = useMemo(() => {
    return displayCategories.slice(0, 5)
  }, [displayCategories])

  const getCategoryTrendValue = (pointKey: string, categoryName: string): number => {
    if (categoryTrendPeriod === 'weekly') {
      return (summary.dayOfWeekItemStats?.[pointKey]?.allItems || [])
        .filter((i) => (i.categoryName || 'Uncategorized') === categoryName)
        .reduce((sum, i) => sum + i.quantity, 0)
    }
    return (summary.monthItemStats?.[pointKey]?.allItems || [])
      .filter((i) => (i.categoryName || 'Uncategorized') === categoryName)
      .reduce((sum, i) => sum + i.quantity, 0)
  }

  const categoryTrendPoints = categoryTrendPeriod === 'weekly' ? TREND_DAYS : TREND_MONTHS

  const categoryTrendMax = useMemo(() => {
    let max = 0
    for (const pt of categoryTrendPoints) {
      for (const c of trackedTrendCategories) {
        const v = getCategoryTrendValue(pt.key, c.categoryName)
        if (v > max) max = v
      }
    }
    return Math.max(max, 1)
  }, [categoryTrendPoints, trackedTrendCategories, categoryTrendPeriod, summary])

  const hoveredCategoryTotal = useMemo(() => {
    if (!hoveredCategoryName) return 0
    return categoryTrendPoints.reduce((sum, pt) => sum + getCategoryTrendValue(pt.key, hoveredCategoryName), 0)
  }, [hoveredCategoryName, categoryTrendPoints, categoryTrendPeriod, summary])

  return (
    <div className="flex flex-col gap-6">
      {/* ── Top Bar: Global Menu Preset Filter Banner ── */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#14274E] text-[#E9C46A] flex items-center justify-center font-bold">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-black text-[#14274E] tracking-tight">
              Menu Preset Filter
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Include or exclude entire menu presets to evaluate performance
            </p>
          </div>
        </div>

        {/* Preset Selector Dropdown */}
        <div className="relative" ref={presetDropdownRef}>
          <button
            type="button"
            onClick={() => setPresetDropdownOpen((v) => !v)}
            className="inline-flex items-center justify-between gap-3 px-4 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 transition-all cursor-pointer shadow-xs min-w-[220px]"
          >
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <span>
                {selectedPresetIds.size === presets.length
                  ? 'All Presets Included'
                  : selectedPresetIds.size === 0
                  ? 'No Presets Active'
                  : `${selectedPresetIds.size} of ${presets.length} Presets`}
              </span>
            </div>
            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${presetDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {presetDropdownOpen && (
            <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 p-3 z-50 flex flex-col gap-2">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-xs font-black text-[#14274E] uppercase">Select Presets</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedPresetIds(new Set(presets.map((p) => p.PRESET_ID)))}
                    className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                  >
                    Select All
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => setSelectedPresetIds(new Set())}
                    className="text-[10px] font-bold text-rose-600 hover:text-rose-800 cursor-pointer"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
                {presets.map((p) => {
                  const isChecked = selectedPresetIds.has(p.PRESET_ID)
                  return (
                    <label
                      key={p.PRESET_ID}
                      className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 cursor-pointer text-xs transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => togglePreset(p.PRESET_ID)}
                          className="w-4 h-4 rounded text-[#14274E] accent-[#14274E] cursor-pointer"
                        />
                        <span className="font-semibold text-slate-700">{p.PRESET_NAME}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {presetItemIdsMap.get(p.PRESET_ID)?.size ?? 0} items
                      </span>
                    </label>
                  )
                })}
              </div>

              <div className="pt-2 border-t border-slate-100 flex justify-end">
                <button
                  type="button"
                  onClick={() => setPresetDropdownOpen(false)}
                  className="px-3 py-1 bg-[#14274E] text-white rounded-lg text-xs font-bold hover:bg-[#1E3A8A] cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* ── ROW 1: ITEM PERFORMANCE (FULL WIDTH CONTAINER) ──        */}
      {/* ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2.5">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-[#14274E] tracking-tight">
            Item Performance
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Sell count rankings and cyclical trend performance across individual menu items
          </p>
        </div>

        {/* White Card Container */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs flex flex-col gap-4 w-full">
          {/* Card Top Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            {/* Top Left: Mode Switcher (Ranking vs Trend Analysis) + Tooltip */}
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 text-xs font-bold text-slate-600 no-print">
                <button
                  type="button"
                  onClick={() => setItemMode('ranking')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    itemMode === 'ranking'
                      ? 'bg-white text-[#14274E] shadow-xs'
                      : 'hover:text-slate-900'
                  }`}
                >
                  Ranking
                </button>
                <button
                  type="button"
                  onClick={() => setItemMode('trend')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    itemMode === 'trend'
                      ? 'bg-white text-[#14274E] shadow-xs'
                      : 'hover:text-slate-900'
                  }`}
                >
                  Trend Analysis
                </button>
              </div>

              <InfoTooltip
                title="Item Performance: Ranking vs. Trend"
                bullets={[
                  {
                    label: 'Ranking',
                    desc: 'Ranks all active items by total units sold across the active period.',
                  },
                  {
                    label: 'Trend Analysis',
                    desc: 'Compares top items across recurring days of the week or months of the year.',
                  },
                ]}
                align="right"
              />
            </div>

            {/* Top Right: Mode-Specific Controls */}
            <div className="flex items-center gap-2">
              {itemMode === 'trend' ? (
                <>
                  <InfoTooltip
                    title="Item Trend Cycles"
                    text="Choose Weekly Summary (Sunday to Saturday) to spot regular rush days, or Monthly Summary (January to December) to track yearly seasonality."
                    align="left"
                  />

                  {/* Trend Period Dropdown (Weekly vs Monthly) */}
                  <div className="relative" ref={itemTrendDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setItemTrendDropdownOpen((v) => !v)}
                      className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs font-bold rounded-xl border border-slate-200/90 shadow-2xs transition-all cursor-pointer select-none"
                    >
                      <span>
                        {itemTrendPeriod === 'weekly' ? 'Weekly Summary' : 'Monthly Summary'}
                      </span>
                      <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${itemTrendDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {itemTrendDropdownOpen && (
                      <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-200 p-1.5 z-50 flex flex-col gap-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            setItemTrendPeriod('weekly')
                            setItemTrendDropdownOpen(false)
                          }}
                          className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer text-left ${
                            itemTrendPeriod === 'weekly' ? 'bg-[#14274E] text-[#E9C46A]' : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex flex-col">
                            <span className="font-bold">Weekly Summary</span>
                            <span className={`text-[10px] ${itemTrendPeriod === 'weekly' ? 'text-slate-300' : 'text-slate-400'}`}>
                              Sunday to Saturday performance
                            </span>
                          </div>
                          {itemTrendPeriod === 'weekly' && <Check className="w-4 h-4 text-[#E9C46A]" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setItemTrendPeriod('monthly')
                            setItemTrendDropdownOpen(false)
                          }}
                          className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer text-left ${
                            itemTrendPeriod === 'monthly' ? 'bg-[#14274E] text-[#E9C46A]' : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex flex-col">
                            <span className="font-bold">Monthly Summary</span>
                            <span className={`text-[10px] ${itemTrendPeriod === 'monthly' ? 'text-slate-300' : 'text-slate-400'}`}>
                              January to December performance
                            </span>
                          </div>
                          {itemTrendPeriod === 'monthly' && <Check className="w-4 h-4 text-[#E9C46A]" />}
                        </button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                /* Ranking Mode: Sort Toggle */
                <button
                  type="button"
                  onClick={() => setItemSortOrder((s) => (s === 'desc' ? 'asc' : 'desc'))}
                  className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-200/90 shadow-2xs transition-all cursor-pointer"
                >
                  {itemSortOrder === 'desc' ? 'Highest Sold First' : 'Lowest Sold First'}
                </button>
              )}

              {/* Item Filter Dropdown (Present in both modes) */}
              <div className="relative" ref={itemFilterRef}>
                <button
                  type="button"
                  onClick={() => setItemDropdownOpen((v) => !v)}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 transition-all cursor-pointer shadow-xs"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
                  <span>
                    {excludedItemIds.size === 0
                      ? `All ${baseItems.length} Items`
                      : `${baseItems.length - excludedItemIds.size} of ${baseItems.length}`}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${itemDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {itemDropdownOpen && (
                  <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-200 p-3 z-50 flex flex-col gap-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <div>
                        <span className="text-xs font-black text-[#14274E] uppercase">Filter Items</span>
                        <p className="text-[10px] text-slate-400">Include or exclude specific items or entire categories</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setExcludedItemIds(new Set())}
                          className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                        >
                          Include All
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                          type="button"
                          onClick={() => setExcludedItemIds(new Set(baseItems.map((i) => i.itemId)))}
                          className="text-[10px] font-bold text-rose-600 hover:text-rose-800 cursor-pointer"
                        >
                          Exclude All
                        </button>
                      </div>
                    </div>

                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search items..."
                        value={itemSearchQuery}
                        onChange={(e) => setItemSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#14274E]"
                      />
                    </div>

                    <div className="max-h-72 overflow-y-auto space-y-3 pr-1">
                      {Array.from(itemsByCategory.entries()).map(([catName, catItems]) => {
                        const filteredCatItems = itemSearchQuery.trim()
                          ? catItems.filter((i) => i.itemName.toLowerCase().includes(itemSearchQuery.trim().toLowerCase()))
                          : catItems

                        if (filteredCatItems.length === 0) return null

                        const includedInCatCount = catItems.filter((i) => !excludedItemIds.has(i.itemId)).length
                        const allIncluded = includedInCatCount === catItems.length
                        const noneIncluded = includedInCatCount === 0

                        return (
                          <div key={catName} className="rounded-xl border border-slate-100 bg-slate-50/60 p-2.5">
                            <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-200/60">
                              <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={allIncluded}
                                  ref={(input) => {
                                    if (input) input.indeterminate = !allIncluded && !noneIncluded
                                  }}
                                  onChange={(e) => toggleAllItemsInCategory(catName, e.target.checked)}
                                  className="w-4 h-4 rounded text-[#14274E] accent-[#14274E] cursor-pointer"
                                />
                                <span className="font-bold text-xs text-slate-800">{catName}</span>
                              </label>

                              <button
                                type="button"
                                onClick={() => toggleAllItemsInCategory(catName, !allIncluded)}
                                className="text-[10px] font-bold text-slate-500 hover:text-indigo-600 cursor-pointer"
                              >
                                {allIncluded ? 'Exclude All' : 'Include All'}
                              </button>
                            </div>

                            <div className="space-y-1 pl-5">
                              {filteredCatItems.map((it) => {
                                const isItemIncluded = !excludedItemIds.has(it.itemId)
                                return (
                                  <label
                                    key={it.itemId}
                                    className="flex items-center justify-between py-1 px-1.5 rounded-lg hover:bg-white cursor-pointer text-xs transition-colors"
                                  >
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="checkbox"
                                        checked={isItemIncluded}
                                        onChange={() => toggleItem(it.itemId)}
                                        className="w-3.5 h-3.5 rounded text-[#14274E] accent-[#14274E] cursor-pointer"
                                      />
                                      <span className={`text-[11px] ${isItemIncluded ? 'text-slate-800 font-medium' : 'text-slate-400 line-through'}`}>
                                        {it.itemName}
                                      </span>
                                    </div>
                                    <span className="text-[10px] text-slate-400 font-mono">
                                      {it.quantity} sold
                                    </span>
                                  </label>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex justify-end">
                      <button
                        type="button"
                        onClick={() => setItemDropdownOpen(false)}
                        className="px-3 py-1 bg-[#14274E] text-white rounded-lg text-xs font-bold hover:bg-[#1E3A8A] cursor-pointer"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Graph Content */}
          {displayItems.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-xs italic bg-slate-50/50 rounded-xl border border-slate-100">
              <Package className="w-8 h-8 text-slate-300 mb-2" />
              <span>No items match current filters.</span>
            </div>
          ) : itemMode === 'trend' ? (
            /* ── ITEM TREND ANALYSIS GRAPH WITH CROSS-FADING & MIDDLE BANNER ── */
            <div className="relative w-full h-72 pt-8 pb-2 px-2 flex flex-col justify-end border-b border-slate-100 select-none">
              {/* Middle Banner: Shows the hovered item title and total sold across period */}
              {hoveredItemObj ? (
                <div className="absolute top-1 left-1/2 -translate-x-1/2 z-20 px-4 py-1.5 rounded-xl bg-[#14274E] text-white border border-slate-700 shadow-xl flex items-center gap-2 pointer-events-none select-none transition-all duration-150">
                  <span
                    className="w-2.5 h-2.5 rounded-full ring-2 ring-white/80"
                    style={{
                      backgroundColor:
                        ITEM_PALETTE[trackedTrendItems.findIndex((x) => x.itemId === hoveredItemObj.itemId) % ITEM_PALETTE.length],
                    }}
                  />
                  <span className="font-extrabold text-xs text-[#E9C46A]">{hoveredItemObj.itemName}</span>
                  <span className="text-slate-300 font-mono text-[11px]">
                    ({hoveredItemTotal} sold in {itemTrendPeriod === 'weekly' ? 'week' : 'year'})
                  </span>
                </div>
              ) : (
                <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 hidden sm:flex items-center gap-1.5 px-3 py-1 bg-slate-50 border border-slate-200/80 rounded-full text-[11px] text-slate-500 font-medium pointer-events-none select-none">
                  <Info className="w-3.5 h-3.5 text-slate-400" />
                  <span>Hover any bar to isolate performance across all {itemTrendPeriod === 'weekly' ? 'days' : 'months'}</span>
                </div>
              )}

              {/* Bars Columns across time points */}
              <div className="w-full h-full flex items-end gap-2 sm:gap-4 overflow-x-auto pt-8">
                {itemTrendPoints.map((pt) => (
                  <div
                    key={pt.key}
                    className="flex-1 min-w-[50px] h-full flex flex-col justify-end items-center relative pb-6 group"
                  >
                    {/* Cluster of bars for tracked items */}
                    <div className="w-full flex items-end justify-center gap-1 h-full">
                      {trackedTrendItems.map((item, itIdx) => {
                        const val = getItemTrendValue(pt.key, item.itemId)
                        const heightPct = Math.max((val / itemTrendMax) * 100, val ? 5 : 0)
                        const isHovered = hoveredItemId === item.itemId
                        const color = ITEM_PALETTE[itIdx % ITEM_PALETTE.length]

                        // Fading logic: If something is hovered, fade all other items to 0.15
                        const opacity =
                          hoveredItemId === null
                            ? 0.9
                            : isHovered
                            ? 1
                            : 0.15

                        return (
                          <div
                            key={item.itemId}
                            className="relative flex-1 max-w-[20px] flex flex-col items-center justify-end h-full cursor-pointer transition-all duration-200"
                            style={{ opacity }}
                            onMouseEnter={() => setHoveredItemId(item.itemId)}
                            onMouseLeave={() => setHoveredItemId(null)}
                          >
                            {/* Sold count displayed on ALL bars of the hovered item */}
                            {isHovered && (
                              <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-black text-[#14274E] bg-white px-1.5 py-0.5 rounded shadow-sm border border-slate-200 z-30 whitespace-nowrap">
                                {val}
                              </span>
                            )}

                            {/* Bar Graphic */}
                            <div
                              className="w-full rounded-t-md transition-all duration-200"
                              style={{
                                height: `${heightPct}%`,
                                backgroundColor: color,
                                boxShadow: isHovered ? `0 0 10px ${color}80` : undefined,
                              }}
                            />
                          </div>
                        )
                      })}
                    </div>

                    {/* X Axis Label */}
                    <span className="absolute bottom-0 text-[10px] font-bold text-slate-500">
                      {pt.short}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* ── ITEM RANKING GRAPH (ALL ACTIVE ITEMS RANKED) ── */
            <div className="h-72 flex items-end gap-3 border-b border-slate-100 px-2 pt-6 overflow-x-auto select-none scrollbar-thin">
              {displayItems.map((item, idx) => (
                <div
                  key={item.itemId}
                  className="min-w-[56px] flex-1 h-full flex flex-col items-center justify-end gap-1.5 pb-2 group"
                  title={`${item.itemName}: ${item.quantity} sold`}
                >
                  <span className="text-[10px] font-black text-[#14274E]">
                    {item.quantity}
                  </span>
                  <div
                    className="w-full rounded-t-lg bg-[#14274E] hover:bg-[#1E3A8A] transition-all cursor-pointer"
                    style={{
                      height: `${Math.max((item.quantity / maxItemSellCount) * 85, item.quantity ? 5 : 0)}%`,
                    }}
                  />
                  <span className="text-[10px] font-semibold text-slate-700 truncate w-full text-center">
                    {item.itemName}
                  </span>
                  <span className="text-[9px] font-bold text-slate-400">
                    #{idx + 1}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* ── ROW 2: CATEGORY PERFORMANCE (FULL WIDTH CONTAINER) ──    */}
      {/* ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2.5">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-[#14274E] tracking-tight">
            Category Performance
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Items sold distribution and category trends across menu groups
          </p>
        </div>

        {/* White Card Container */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs flex flex-col gap-4 w-full">
          {/* Card Top Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            {/* Top Left: Mode Switcher (Ranking vs Trend Analysis) + Tooltip */}
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 text-xs font-bold text-slate-600 no-print">
                <button
                  type="button"
                  onClick={() => setCategoryMode('ranking')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    categoryMode === 'ranking'
                      ? 'bg-white text-[#14274E] shadow-xs'
                      : 'hover:text-slate-900'
                  }`}
                >
                  Ranking
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryMode('trend')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    categoryMode === 'trend'
                      ? 'bg-white text-[#14274E] shadow-xs'
                      : 'hover:text-slate-900'
                  }`}
                >
                  Trend Analysis
                </button>
              </div>

              <InfoTooltip
                title="Category Performance: Ranking vs. Trend"
                bullets={[
                  {
                    label: 'Ranking',
                    desc: 'Ranks all categories by total items sold in the active date range.',
                  },
                  {
                    label: 'Trend Analysis',
                    desc: 'Tracks category sales volume across days of the week or months of the year.',
                  },
                ]}
                align="right"
              />
            </div>

            {/* Top Right: Mode-Specific Controls */}
            <div className="flex items-center gap-2">
              {categoryMode === 'trend' ? (
                <>
                  <InfoTooltip
                    title="Category Trend Cycles"
                    text="Choose Weekly Summary (Sunday to Saturday) or Monthly Summary (January to December) to inspect cyclical category performance."
                    align="left"
                  />

                  {/* Trend Period Dropdown (Weekly vs Monthly) */}
                  <div className="relative" ref={categoryTrendDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setCategoryTrendDropdownOpen((v) => !v)}
                      className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs font-bold rounded-xl border border-slate-200/90 shadow-2xs transition-all cursor-pointer select-none"
                    >
                      <span>
                        {categoryTrendPeriod === 'weekly' ? 'Weekly Summary' : 'Monthly Summary'}
                      </span>
                      <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${categoryTrendDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {categoryTrendDropdownOpen && (
                      <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-200 p-1.5 z-50 flex flex-col gap-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            setCategoryTrendPeriod('weekly')
                            setCategoryTrendDropdownOpen(false)
                          }}
                          className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer text-left ${
                            categoryTrendPeriod === 'weekly' ? 'bg-[#14274E] text-[#E9C46A]' : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex flex-col">
                            <span className="font-bold">Weekly Summary</span>
                            <span className={`text-[10px] ${categoryTrendPeriod === 'weekly' ? 'text-slate-300' : 'text-slate-400'}`}>
                              Sunday to Saturday distribution
                            </span>
                          </div>
                          {categoryTrendPeriod === 'weekly' && <Check className="w-4 h-4 text-[#E9C46A]" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCategoryTrendPeriod('monthly')
                            setCategoryTrendDropdownOpen(false)
                          }}
                          className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer text-left ${
                            categoryTrendPeriod === 'monthly' ? 'bg-[#14274E] text-[#E9C46A]' : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex flex-col">
                            <span className="font-bold">Monthly Summary</span>
                            <span className={`text-[10px] ${categoryTrendPeriod === 'monthly' ? 'text-slate-300' : 'text-slate-400'}`}>
                              January to December distribution
                            </span>
                          </div>
                          {categoryTrendPeriod === 'monthly' && <Check className="w-4 h-4 text-[#E9C46A]" />}
                        </button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                /* Ranking Mode: Sort Toggle */
                <button
                  type="button"
                  onClick={() => setCategorySortOrder((s) => (s === 'desc' ? 'asc' : 'desc'))}
                  className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-200/90 shadow-2xs transition-all cursor-pointer"
                >
                  {categorySortOrder === 'desc' ? 'Highest Sold First' : 'Lowest Sold First'}
                </button>
              )}

              {/* Category Filter Dropdown */}
              <div className="relative" ref={categoryFilterRef}>
                <button
                  type="button"
                  onClick={() => setCategoryDropdownOpen((v) => !v)}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 transition-all cursor-pointer shadow-xs"
                >
                  <Filter className="w-3.5 h-3.5 text-slate-500" />
                  <span>
                    {excludedCategoryNames.size === 0
                      ? `All ${Array.from(itemsByCategory.keys()).length} Categories`
                      : `${Array.from(itemsByCategory.keys()).length - excludedCategoryNames.size} Active`}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${categoryDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {categoryDropdownOpen && (
                  <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 p-3 z-50 flex flex-col gap-2">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <span className="text-xs font-black text-[#14274E] uppercase">Filter Categories</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setExcludedCategoryNames(new Set())}
                          className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                        >
                          Include All
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                          type="button"
                          onClick={() => setExcludedCategoryNames(new Set(Array.from(itemsByCategory.keys())))}
                          className="text-[10px] font-bold text-rose-600 hover:text-rose-800 cursor-pointer"
                        >
                          Exclude All
                        </button>
                      </div>
                    </div>

                    <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
                      {Array.from(itemsByCategory.keys()).map((catName) => {
                        const isChecked = !excludedCategoryNames.has(catName)
                        return (
                          <label
                            key={catName}
                            className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 cursor-pointer text-xs transition-colors"
                          >
                            <div className="flex items-center gap-2.5">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleCategory(catName)}
                                className="w-4 h-4 rounded text-[#14274E] accent-[#14274E] cursor-pointer"
                              />
                              <span className="font-semibold text-slate-700">{catName}</span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {itemsByCategory.get(catName)?.length ?? 0} items
                            </span>
                          </label>
                        )
                      })}
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex justify-end">
                      <button
                        type="button"
                        onClick={() => setCategoryDropdownOpen(false)}
                        className="px-3 py-1 bg-[#14274E] text-white rounded-lg text-xs font-bold hover:bg-[#1E3A8A] cursor-pointer"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Graph Content */}
          {displayCategories.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-xs italic bg-slate-50/50 rounded-xl border border-slate-100">
              <Tag className="w-8 h-8 text-slate-300 mb-2" />
              <span>No categories match current filters.</span>
            </div>
          ) : categoryMode === 'trend' ? (
            /* ── CATEGORY TREND ANALYSIS GRAPH WITH CROSS-FADING & MIDDLE BANNER ── */
            <div className="relative w-full h-72 pt-8 pb-2 px-2 flex flex-col justify-end border-b border-slate-100 select-none">
              {/* Middle Banner: Shows the hovered category title and total items sold */}
              {hoveredCategoryName ? (
                <div className="absolute top-1 left-1/2 -translate-x-1/2 z-20 px-4 py-1.5 rounded-xl bg-[#14274E] text-white border border-slate-700 shadow-xl flex items-center gap-2 pointer-events-none select-none transition-all duration-150">
                  <span
                    className="w-2.5 h-2.5 rounded-full ring-2 ring-white/80"
                    style={{
                      backgroundColor:
                        CATEGORY_PALETTE[
                          trackedTrendCategories.findIndex((c) => c.categoryName === hoveredCategoryName) %
                            CATEGORY_PALETTE.length
                        ],
                    }}
                  />
                  <span className="font-extrabold text-xs text-[#E9C46A]">{hoveredCategoryName}</span>
                  <span className="text-slate-300 font-mono text-[11px]">
                    ({hoveredCategoryTotal} sold in {categoryTrendPeriod === 'weekly' ? 'week' : 'year'})
                  </span>
                </div>
              ) : (
                <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 hidden sm:flex items-center gap-1.5 px-3 py-1 bg-slate-50 border border-slate-200/80 rounded-full text-[11px] text-slate-500 font-medium pointer-events-none select-none">
                  <Info className="w-3.5 h-3.5 text-slate-400" />
                  <span>Hover any bar to isolate performance across all {categoryTrendPeriod === 'weekly' ? 'days' : 'months'}</span>
                </div>
              )}

              {/* Bars Columns across time points */}
              <div className="w-full h-full flex items-end gap-2 sm:gap-4 overflow-x-auto pt-8">
                {categoryTrendPoints.map((pt) => (
                  <div
                    key={pt.key}
                    className="flex-1 min-w-[50px] h-full flex flex-col justify-end items-center relative pb-6 group"
                  >
                    {/* Cluster of bars for tracked categories */}
                    <div className="w-full flex items-end justify-center gap-1 h-full">
                      {trackedTrendCategories.map((cat, catIdx) => {
                        const val = getCategoryTrendValue(pt.key, cat.categoryName)
                        const heightPct = Math.max((val / categoryTrendMax) * 100, val ? 5 : 0)
                        const isHovered = hoveredCategoryName === cat.categoryName
                        const color = CATEGORY_PALETTE[catIdx % CATEGORY_PALETTE.length]

                        // Fading logic
                        const opacity =
                          hoveredCategoryName === null
                            ? 0.9
                            : isHovered
                            ? 1
                            : 0.15

                        return (
                          <div
                            key={cat.categoryName}
                            className="relative flex-1 max-w-[22px] flex flex-col items-center justify-end h-full cursor-pointer transition-all duration-200"
                            style={{ opacity }}
                            onMouseEnter={() => setHoveredCategoryName(cat.categoryName)}
                            onMouseLeave={() => setHoveredCategoryName(null)}
                          >
                            {/* Sold count displayed on ALL bars of the hovered category */}
                            {isHovered && (
                              <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-black text-[#14274E] bg-white px-1.5 py-0.5 rounded shadow-sm border border-slate-200 z-30 whitespace-nowrap">
                                {val}
                              </span>
                            )}

                            {/* Bar Graphic */}
                            <div
                              className="w-full rounded-t-md transition-all duration-200"
                              style={{
                                height: `${heightPct}%`,
                                backgroundColor: color,
                                boxShadow: isHovered ? `0 0 10px ${color}80` : undefined,
                              }}
                            />
                          </div>
                        )
                      })}
                    </div>

                    {/* X Axis Label */}
                    <span className="absolute bottom-0 text-[10px] font-bold text-slate-500">
                      {pt.short}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* ── CATEGORY RANKING GRAPH (ALL ACTIVE CATEGORIES RANKED) ── */
            <div className="h-72 flex items-end gap-3 border-b border-slate-100 px-2 pt-6 overflow-x-auto select-none scrollbar-thin">
              {displayCategories.map((cat, idx) => (
                <div
                  key={cat.categoryName}
                  className="min-w-[64px] flex-1 h-full flex flex-col items-center justify-end gap-1.5 pb-2 group"
                  title={`${cat.categoryName}: ${cat.itemsSold} sold, ₱${cat.revenue.toLocaleString('en-PH')}`}
                >
                  <span className="text-[10px] font-black text-[#14274E]">
                    {cat.itemsSold}
                  </span>
                  <div
                    className="w-full rounded-t-lg transition-all cursor-pointer"
                    style={{
                      height: `${Math.max((cat.itemsSold / maxCatSellCount) * 85, cat.itemsSold ? 5 : 0)}%`,
                      backgroundColor: CATEGORY_PALETTE[idx % CATEGORY_PALETTE.length],
                    }}
                  />
                  <span className="text-[10px] font-semibold text-slate-700 truncate w-full text-center">
                    {cat.categoryName}
                  </span>
                  <span className="text-[9px] font-bold text-slate-400">
                    #{idx + 1}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* ── ROW 3: PRESET PERFORMANCE (FULL WIDTH CONTAINER) ──      */}
      {/* ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2.5">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-[#14274E] tracking-tight">
            Preset Performance
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Items sold distribution and percentage of total sales by active menu preset
          </p>
        </div>

        {/* White Card Container */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs flex flex-col gap-4 w-full">
          {/* Card Top Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-xl">
                Ranking
              </span>
              <InfoTooltip
                title="Preset Performance"
                text="Evaluates total sales volume driven by each business-day menu preset to determine which configuration yields the highest revenue."
                align="right"
              />
            </div>

            {/* Sort Toggle */}
            <button
              type="button"
              onClick={() => setPresetSortOrder((s) => (s === 'desc' ? 'asc' : 'desc'))}
              className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-200/90 shadow-2xs transition-all cursor-pointer"
            >
              {presetSortOrder === 'desc' ? 'Highest Sold First' : 'Lowest Sold First'}
            </button>
          </div>

          {/* Graph Content */}
          {!displayPresets.length ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-xs italic bg-slate-50/50 rounded-xl border border-slate-100">
              <Layers className="w-8 h-8 text-slate-300 mb-2" />
              <span>No preset sales data available for this date range.</span>
            </div>
          ) : (
            <div className="h-72 flex items-end gap-3 border-b border-slate-100 px-2 pt-6 overflow-x-auto select-none scrollbar-thin">
              {displayPresets.map((preset, idx) => (
                <div
                  key={preset.presetId}
                  className="min-w-[70px] flex-1 h-full flex flex-col items-center justify-end gap-1.5 pb-2 group"
                  title={`${preset.presetName}: ${preset.itemsSold} items sold (${preset.percentageOfSales}%)`}
                >
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] font-black text-[#14274E]">
                      {preset.itemsSold}
                    </span>
                    <span className="text-[9px] font-bold text-slate-400">
                      {preset.percentageOfSales}%
                    </span>
                  </div>
                  <div
                    className="w-full rounded-t-lg transition-all cursor-pointer"
                    style={{
                      height: `${Math.max((preset.itemsSold / maxPresetSellCount) * 85, preset.itemsSold ? 5 : 0)}%`,
                      backgroundColor: CATEGORY_PALETTE[idx % CATEGORY_PALETTE.length],
                    }}
                  />
                  <span className="text-[10px] font-semibold text-slate-700 truncate w-full text-center">
                    {preset.presetName}
                  </span>
                  <span className="text-[9px] font-bold text-slate-400">
                    #{idx + 1}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
