import { useState, useMemo } from 'react'
import {
  Award,
  ChevronDown,
  ChevronUp,
  Search,
  Maximize2,
  X,
  Store,
  Smartphone,
  ArrowUpDown,
  AlertTriangle,
  Flame,
  Snowflake,
  Package,
  Layers,
} from 'lucide-react'
import type { ItemSalesStat } from '@/services/analyticsService'

interface TopItemsChartProps {
  items?: ItemSalesStat[]
  topItems?: ItemSalesStat[]
  leastItems?: ItemSalesStat[]
  allItems?: ItemSalesStat[]
  totalRevenue?: number
  totalItemsSold?: number
}

type TabType = 'top' | 'least' | 'all'
type SortColumn = 'rank' | 'name' | 'category' | 'price' | 'qty' | 'revenue'
type SortDirection = 'asc' | 'desc'

export function TopItemsChart({
  items,
  topItems,
  leastItems,
  allItems,
}: TopItemsChartProps) {
  const [activeTab, setActiveTab] = useState<TabType>('top')
  const [isExpanded, setIsExpanded] = useState(false)
  const [expandedRowIds, setExpandedRowIds] = useState<Set<number>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Modal sorting state
  const [modalSortCol, setModalSortCol] = useState<SortColumn>('qty')
  const [modalSortDir, setModalSortDir] = useState<SortDirection>('desc')

  // Resolve datasets with fallbacks
  const topList = useMemo(() => topItems ?? items ?? [], [topItems, items])
  const leastList = useMemo(() => {
    if (leastItems && leastItems.length > 0) return leastItems
    return [...topList].reverse()
  }, [leastItems, topList])
  const fullList = useMemo(() => {
    if (allItems && allItems.length > 0) return allItems
    return topList
  }, [allItems, topList])

  // Current active dataset based on tab
  const currentDataset = useMemo(() => {
    switch (activeTab) {
      case 'least':
        return leastList
      case 'all':
        return fullList
      case 'top':
      default:
        return topList
    }
  }, [activeTab, leastList, fullList, topList])

  // Filtered dataset based on search
  const filteredDataset = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return currentDataset
    return currentDataset.filter(
      (item) =>
        item.itemName.toLowerCase().includes(q) ||
        item.categoryName.toLowerCase().includes(q),
    )
  }, [currentDataset, searchQuery])

  // Maximum quantity for relative progress bar
  const maxQtyInView = useMemo(() => {
    const qtys = currentDataset.map((i) => i.quantity)
    return Math.max(...qtys, 1)
  }, [currentDataset])

  // Displayed items in the card (compact vs expanded)
  const visibleItems = useMemo(() => {
    if (isExpanded) return filteredDataset
    return filteredDataset.slice(0, 5)
  }, [filteredDataset, isExpanded])

  // Toggle individual row accordion
  const toggleRow = (itemId: number) => {
    setExpandedRowIds((prev) => {
      const next = new Set(prev)
      if (next.has(itemId)) {
        next.delete(itemId)
      } else {
        next.add(itemId)
      }
      return next
    })
  }

  // Toggle expand all rows currently visible
  const toggleExpandAllRows = () => {
    if (expandedRowIds.size >= visibleItems.length && visibleItems.length > 0) {
      setExpandedRowIds(new Set())
    } else {
      setExpandedRowIds(new Set(visibleItems.map((i) => i.itemId)))
    }
  }

  // Sorted list for full comparison modal
  const modalSortedItems = useMemo(() => {
    const list = [...fullList]
    list.sort((a, b) => {
      let valA: string | number = 0
      let valB: string | number = 0

      switch (modalSortCol) {
        case 'name':
          valA = a.itemName.toLowerCase()
          valB = b.itemName.toLowerCase()
          break
        case 'category':
          valA = a.categoryName.toLowerCase()
          valB = b.categoryName.toLowerCase()
          break
        case 'price':
          valA = a.unitPrice
          valB = b.unitPrice
          break
        case 'qty':
          valA = a.quantity
          valB = b.quantity
          break
        case 'revenue':
          valA = a.revenue
          valB = b.revenue
          break
        case 'rank':
        default:
          valA = b.quantity - a.quantity || b.revenue - a.revenue
          valB = 0
          break
      }

      if (typeof valA === 'string' && typeof valB === 'string') {
        return modalSortDir === 'asc'
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA)
      }
      return modalSortDir === 'asc'
        ? Number(valA) - Number(valB)
        : Number(valB) - Number(valA)
    })
    return list
  }, [fullList, modalSortCol, modalSortDir])

  const handleSortClick = (col: SortColumn) => {
    if (modalSortCol === col) {
      setModalSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setModalSortCol(col)
      setModalSortDir('desc')
    }
  }

  // Count items with zero sales
  const zeroSalesCount = useMemo(() => {
    return fullList.filter((i) => i.quantity === 0).length
  }, [fullList])

  if (!items && !topItems && !allItems) {
    return (
      <div className="h-44 flex items-center justify-center text-slate-400 text-xs italic">
        No sales recorded for this date range.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3.5">
      {/* View Switcher & Action Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-100">
        {/* Segmented Pill Tabs */}
        <div className="flex items-center p-1 bg-slate-100/90 rounded-xl gap-1 shrink-0 text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              setActiveTab('top')
              setSearchQuery('')
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'top'
                ? 'bg-[#14274E] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-[#E9C46A]" />
            <span>Most Selling</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                activeTab === 'top' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
              }`}
            >
              {topList.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('least')
              setSearchQuery('')
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'least'
                ? 'bg-[#14274E] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Snowflake className="w-3.5 h-3.5 text-sky-400" />
            <span>Least Selling</span>
            {zeroSalesCount > 0 && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  activeTab === 'least' ? 'bg-rose-500 text-white' : 'bg-rose-100 text-rose-700'
                }`}
                title={`${zeroSalesCount} items with 0 sales`}
              >
                {zeroSalesCount} unsold
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('all')
              setSearchQuery('')
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'all'
                ? 'bg-[#14274E] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            <span>All Items</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                activeTab === 'all' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
              }`}
            >
              {fullList.length}
            </span>
          </button>
        </div>

        {/* Right side controls: Search & Full Table Modal button */}
        <div className="flex items-center gap-2 justify-end">
          {/* Quick Search */}
          <div className="relative flex-1 sm:w-36">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search item..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-6 py-1 text-xs bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#14274E] transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Full Table Modal trigger */}
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            title="Open full comparison table"
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-[#14274E] bg-slate-100 hover:bg-slate-200/80 rounded-lg transition-all shrink-0 cursor-pointer"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Full Table</span>
          </button>
        </div>
      </div>

      {/* Subheader info or alert message */}
      {activeTab === 'least' && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50/80 border border-amber-200/80 rounded-xl text-amber-900 text-xs">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span className="leading-tight">
            Showing least-ordered menu items during this period.
            {zeroSalesCount > 0 && (
              <strong className="ml-1 text-rose-700">
                {zeroSalesCount} {zeroSalesCount === 1 ? 'item has' : 'items have'} 0 sales
              </strong>
            )}
            . Consider specials, recipe reviews, or menu pruning.
          </span>
        </div>
      )}

      {/* Items List */}
      {filteredDataset.length === 0 ? (
        <div className="py-8 flex flex-col items-center justify-center text-center gap-1.5 text-slate-400 text-xs">
          <Package className="w-8 h-8 text-slate-300 stroke-[1.5]" />
          <span>No items found matching "{searchQuery}"</span>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {visibleItems.map((item, index) => {
            const isRowExpanded = expandedRowIds.has(item.itemId)
            const percentage =
              maxQtyInView > 0 ? Math.round((item.quantity / maxQtyInView) * 100) : 0

            // Rank badge styling
            let rankColor = 'bg-slate-100 text-slate-600'
            if (activeTab === 'top') {
              if (index === 0) rankColor = 'bg-[#E9C46A] text-[#14274E] font-black shadow-xs'
              else if (index === 1) rankColor = 'bg-slate-300 text-slate-800 font-bold'
              else if (index === 2) rankColor = 'bg-amber-700/20 text-amber-900 font-bold'
            } else if (activeTab === 'least') {
              if (item.quantity === 0) {
                rankColor = 'bg-rose-100 text-rose-700 font-bold'
              } else {
                rankColor = 'bg-sky-100 text-sky-800 font-bold'
              }
            }

            return (
              <div
                key={item.itemId}
                className={`rounded-xl border transition-all duration-200 overflow-hidden ${
                  isRowExpanded
                    ? 'border-slate-300 bg-slate-50/50 shadow-xs'
                    : 'border-slate-100 hover:border-slate-200 bg-white hover:bg-slate-50/40'
                }`}
              >
                {/* Main Item Row (Click to toggle expansion) */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleRow(item.itemId)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      toggleRow(item.itemId)
                    }
                  }}
                  className="p-2.5 cursor-pointer flex flex-col gap-1.5 select-none"
                >
                  {/* Top line: Rank, Name, Category, Sold, Revenue & Expand Chevron */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span
                        className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] shrink-0 ${rankColor}`}
                      >
                        {activeTab === 'least' && item.quantity === 0 ? '0' : index + 1}
                      </span>
                      <span
                        className="font-bold text-slate-800 text-xs truncate hover:text-[#14274E]"
                        title={item.itemName}
                      >
                        {item.itemName}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded shrink-0 hidden sm:inline">
                        {item.categoryName}
                      </span>
                      {item.unitPrice > 0 && (
                        <span className="text-[10px] text-slate-400 hidden md:inline">
                          ₱{item.unitPrice.toLocaleString('en-PH')} ea
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0 text-right">
                      <span
                        className={`text-xs font-extrabold ${
                          item.quantity === 0 ? 'text-rose-500' : 'text-slate-700'
                        }`}
                      >
                        {item.quantity}{' '}
                        <span className="text-[10px] font-medium text-slate-400">
                          {item.quantity === 1 ? 'unit' : 'sold'}
                        </span>
                      </span>

                      <span className="font-black text-[#14274E] text-xs w-20 text-right">
                        ₱{item.revenue.toLocaleString('en-PH', { minimumFractionDigits: 0 })}
                      </span>

                      <div
                        className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors ${
                          isRowExpanded ? 'bg-slate-200 text-slate-700' : 'text-slate-400 hover:bg-slate-100'
                        }`}
                      >
                        {isRowExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar (Relative volume) */}
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden flex items-center">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        activeTab === 'least' && item.quantity === 0
                          ? 'bg-rose-300'
                          : activeTab === 'least'
                            ? 'bg-sky-500'
                            : index === 0
                              ? 'bg-[#E9C46A]'
                              : 'bg-[#14274E]'
                      }`}
                      style={{ width: `${Math.max(percentage, item.quantity > 0 ? 3 : 0)}%` }}
                    />
                  </div>
                </div>

                {/* Expanded Accordion Deep-Dive Panel */}
                {isRowExpanded && (
                  <div className="px-3 pb-3 pt-1 border-t border-slate-200/70 bg-white flex flex-col gap-2.5 text-xs">
                    {/* 4 Mini-KPIs for this item */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                      {/* Metric 1: Revenue Share */}
                      <div className="bg-slate-50 border border-slate-100 rounded-lg p-2 flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Revenue Share
                        </span>
                        <div className="flex items-baseline gap-1 mt-0.5">
                          <span className="text-sm font-black text-[#14274E]">
                            {item.percentageOfRevenue}%
                          </span>
                          <span className="text-[10px] text-slate-400">of total</span>
                        </div>
                      </div>

                      {/* Metric 2: Volume Share */}
                      <div className="bg-slate-50 border border-slate-100 rounded-lg p-2 flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Volume Share
                        </span>
                        <div className="flex items-baseline gap-1 mt-0.5">
                          <span className="text-sm font-black text-slate-800">
                            {item.percentageOfSales}%
                          </span>
                          <span className="text-[10px] text-slate-400">of items</span>
                        </div>
                      </div>

                      {/* Metric 3: Order Frequency */}
                      <div className="bg-slate-50 border border-slate-100 rounded-lg p-2 flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          In Orders
                        </span>
                        <div className="flex items-baseline gap-1 mt-0.5">
                          <span className="text-sm font-black text-slate-800">
                            {item.orderCount}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {item.orderCount === 1 ? 'order' : 'orders'}
                          </span>
                        </div>
                      </div>

                      {/* Metric 4: Unit Price */}
                      <div className="bg-slate-50 border border-slate-100 rounded-lg p-2 flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Unit Price
                        </span>
                        <div className="flex items-baseline gap-1 mt-0.5">
                          <span className="text-sm font-black text-slate-800">
                            ₱{item.unitPrice.toLocaleString('en-PH')}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Breakdown details: Dining Mode & Channel */}
                    {item.quantity > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                        {/* Dining Mode Breakdown */}
                        <div className="bg-slate-50/80 border border-slate-100 rounded-lg p-2.5 flex flex-col gap-1.5">
                          <div className="flex items-center justify-between text-[11px] font-bold">
                            <span className="flex items-center gap-1.5 text-slate-700">
                              <Store className="w-3.5 h-3.5 text-slate-500" />
                              Dining Mode
                            </span>
                            <span className="text-slate-500 text-[10px]">
                              {item.dineInCount} Dine-in · {item.takeoutCount} Takeout{item.ticketCount ? ` · ${item.ticketCount} Ticket` : ''}
                            </span>
                          </div>
                          {/* Segmented bar */}
                          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden flex">
                            {item.dineInCount > 0 && (
                              <div
                                style={{
                                  width: `${Math.round((item.dineInCount / item.quantity) * 100)}%`,
                                }}
                                className="bg-[#14274E] h-full"
                                title={`Dine-in: ${item.dineInCount}`}
                              />
                            )}
                            {item.takeoutCount > 0 && (
                              <div
                                style={{
                                  width: `${Math.round((item.takeoutCount / item.quantity) * 100)}%`,
                                }}
                                className="bg-[#E9C46A] h-full"
                                title={`Takeout: ${item.takeoutCount}`}
                              />
                            )}
                            {item.ticketCount !== undefined && item.ticketCount > 0 && (
                              <div
                                style={{
                                  width: `${Math.round((item.ticketCount / item.quantity) * 100)}%`,
                                }}
                                className="bg-[#2A9D8F] h-full"
                                title={`Ticket: ${item.ticketCount}`}
                              />
                            )}
                          </div>
                          <div className="flex justify-between text-[9px] font-bold text-slate-400">
                            <span className="text-[#14274E]">
                              Dine-in: {Math.round((item.dineInCount / item.quantity) * 100)}%
                            </span>
                            <span className="text-amber-800">
                              Takeout: {Math.round((item.takeoutCount / item.quantity) * 100)}%
                            </span>
                            {item.ticketCount !== undefined && item.ticketCount > 0 && (
                              <span className="text-[#2A9D8F]">
                                Ticket: {Math.round((item.ticketCount / item.quantity) * 100)}%
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Order Channel Breakdown */}
                        <div className="bg-slate-50/80 border border-slate-100 rounded-lg p-2.5 flex flex-col gap-1.5">
                          <div className="flex items-center justify-between text-[11px] font-bold">
                            <span className="flex items-center gap-1.5 text-slate-700">
                              <Smartphone className="w-3.5 h-3.5 text-slate-500" />
                              Order Channel
                            </span>
                            <span className="text-slate-500 text-[10px]">
                              {item.cashierCount} Cashier · {item.customerAppCount} Customer App{item.ticketCount ? ` · ${item.ticketCount} Ticketing` : ''}
                            </span>
                          </div>
                          {/* Segmented bar */}
                          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden flex">
                            {item.cashierCount > 0 && (
                              <div
                                style={{
                                  width: `${Math.round((item.cashierCount / item.quantity) * 100)}%`,
                                }}
                                className="bg-sky-600 h-full"
                                title={`Cashier: ${item.cashierCount}`}
                              />
                            )}
                            {item.customerAppCount > 0 && (
                              <div
                                style={{
                                  width: `${Math.round((item.customerAppCount / item.quantity) * 100)}%`,
                                }}
                                className="bg-emerald-500 h-full"
                                title={`Customer App: ${item.customerAppCount}`}
                              />
                            )}
                            {item.ticketCount !== undefined && item.ticketCount > 0 && (
                              <div
                                style={{
                                  width: `${Math.round((item.ticketCount / item.quantity) * 100)}%`,
                                }}
                                className="bg-[#14274E] h-full"
                                title={`Ticketing Interface: ${item.ticketCount}`}
                              />
                            )}
                          </div>
                          <div className="flex justify-between text-[9px] font-bold text-slate-400">
                            <span className="text-sky-700">
                              Cashier: {Math.round((item.cashierCount / item.quantity) * 100)}%
                            </span>
                            <span className="text-emerald-700">
                              Customer App: {Math.round((item.customerAppCount / item.quantity) * 100)}%
                            </span>
                            {item.ticketCount !== undefined && item.ticketCount > 0 && (
                              <span className="text-[#14274E]">
                                Ticketing: {Math.round((item.ticketCount / item.quantity) * 100)}%
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-2.5 bg-rose-50 border border-rose-100 rounded-lg flex items-center gap-2 text-rose-800 text-[11px]">
                        <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                        <span>
                          This menu item recorded <strong>0 orders</strong> in the selected timeframe.
                          Verify stock availability, display order in the customer menu, or run a promotion.
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Expand / Collapse Footer Controls */}
      {filteredDataset.length > 5 && (
        <div className="flex items-center justify-between pt-1 text-xs">
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="flex items-center gap-1.5 font-bold text-[#14274E] hover:text-[#394867] py-1 px-2.5 rounded-lg hover:bg-slate-100 transition-all cursor-pointer"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                <span>Show Top 5 Only</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                <span>
                  Expand & Show All {filteredDataset.length} Items ({filteredDataset.length - 5} more)
                </span>
              </>
            )}
          </button>

          {/* Quick toggle to expand or collapse all open accordions */}
          {visibleItems.length > 0 && (
            <button
              type="button"
              onClick={toggleExpandAllRows}
              className="text-[11px] font-semibold text-slate-400 hover:text-slate-700 py-1 px-2 rounded-lg hover:bg-slate-100 transition-all cursor-pointer"
            >
              {expandedRowIds.size >= visibleItems.length ? 'Collapse All Details' : 'Expand All Details'}
            </button>
          )}
        </div>
      )}

      {/* Full Comparison Table Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between gap-3 bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#14274E] text-[#E9C46A] flex items-center justify-center font-black">
                  <Award className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-[#14274E]">
                    Menu Item Sales Performance Breakdown
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Comprehensive ranked metrics for all {modalSortedItems.length} catalog items
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Table Container */}
            <div className="overflow-x-auto overflow-y-auto flex-1 p-2 sm:p-4">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/90 text-[11px] font-black text-slate-600 select-none">
                    <th
                      className="py-2.5 px-3 cursor-pointer hover:bg-slate-100 rounded-l-lg"
                      onClick={() => handleSortClick('rank')}
                    >
                      <div className="flex items-center gap-1">
                        <span>#</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th
                      className="py-2.5 px-3 cursor-pointer hover:bg-slate-100"
                      onClick={() => handleSortClick('name')}
                    >
                      <div className="flex items-center gap-1">
                        <span>Item Name</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th
                      className="py-2.5 px-3 cursor-pointer hover:bg-slate-100"
                      onClick={() => handleSortClick('category')}
                    >
                      <div className="flex items-center gap-1">
                        <span>Category</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th
                      className="py-2.5 px-3 text-right cursor-pointer hover:bg-slate-100"
                      onClick={() => handleSortClick('price')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Price</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th
                      className="py-2.5 px-3 text-right cursor-pointer hover:bg-slate-100"
                      onClick={() => handleSortClick('qty')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Qty Sold</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th
                      className="py-2.5 px-3 text-right cursor-pointer hover:bg-slate-100"
                      onClick={() => handleSortClick('revenue')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Total Revenue</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th className="py-2.5 px-3 text-right">Rev %</th>
                    <th className="py-2.5 px-3 text-center">Orders</th>
                    <th className="py-2.5 px-3 text-center rounded-r-lg">Dining Split</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {modalSortedItems.map((item, idx) => (
                    <tr
                      key={item.itemId}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="py-2.5 px-3 font-extrabold text-slate-500">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-800">
                        {item.itemName}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                          {item.categoryName}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-medium text-slate-600">
                        ₱{item.unitPrice.toLocaleString('en-PH')}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <span
                          className={`font-black ${
                            item.quantity === 0 ? 'text-rose-500' : 'text-slate-800'
                          }`}
                        >
                          {item.quantity}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-black text-[#14274E]">
                        ₱{item.revenue.toLocaleString('en-PH', { minimumFractionDigits: 0 })}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-600">
                        {item.percentageOfRevenue}%
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-600 font-semibold">
                        {item.orderCount}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {item.quantity > 0 ? (
                          <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-500">
                            <span className="text-[#14274E] font-bold">
                              {item.dineInCount} Dine
                            </span>
                            <span>/</span>
                            <span className="text-amber-700 font-bold">
                              {item.takeoutCount} Take
                            </span>
                            {item.ticketCount !== undefined && item.ticketCount > 0 && (
                              <>
                                <span>/</span>
                                <span className="text-[#2A9D8F] font-bold">
                                  {item.ticketCount} Ticket
                                </span>
                              </>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-rose-500 font-semibold">
                            Zero sales
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div className="p-3 sm:p-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between text-xs text-slate-500">
              <span>
                Total items tracked: <strong>{modalSortedItems.length}</strong>
              </span>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-1.5 bg-[#14274E] hover:bg-[#394867] text-white font-bold rounded-xl transition-all cursor-pointer"
              >
                Close Breakdown
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
