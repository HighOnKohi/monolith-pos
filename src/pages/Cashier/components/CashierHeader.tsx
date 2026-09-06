import React, { useState } from 'react'
import { Search, SlidersHorizontal, RefreshCw, LayoutGrid, ChevronDown } from 'lucide-react'
import { NotificationPills } from './NotificationPills'
import type { AssistanceRequest } from '@/types/assistance'
import type { Order } from '@/types/order'
import type { TableItem } from './TableSelectorModal'

export type DietaryFilter = 'all' | 'veg' | 'non-veg'

interface CashierHeaderProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  dietaryFilter: DietaryFilter
  onDietaryChange: (filter: DietaryFilter) => void
  selectedTable: TableItem | null
  onOpenTableSelector: () => void
  assistanceRequests: AssistanceRequest[]
  verifiedOrders: Order[]
  isAssistanceOpen: boolean
  isVerifiedOpen: boolean
  onToggleAssistance: () => void
  onToggleVerified: () => void
  onCloseAllPopovers: () => void
  onResolveAssistance: (tableId: number) => void
  onAcknowledgeVerifiedOrder: (orderId: number) => void
  onRefresh: () => void
  isRefreshing: boolean
}

export const CashierHeader: React.FC<CashierHeaderProps> = ({
  searchQuery,
  onSearchChange,
  dietaryFilter,
  onDietaryChange,
  selectedTable,
  onOpenTableSelector,
  assistanceRequests,
  verifiedOrders,
  isAssistanceOpen,
  isVerifiedOpen,
  onToggleAssistance,
  onToggleVerified,
  onCloseAllPopovers,
  onResolveAssistance,
  onAcknowledgeVerifiedOrder,
  onRefresh,
  isRefreshing,
}) => {
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false)

  return (
    <div className="cashier-top-bar relative z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
      {/* Left: Search input matching reference image */}
      <div className="flex-1 max-w-md flex items-center gap-2">
        <div className="cashier-search-wrapper flex-1">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search menu items, categories, SKU..."
            className="cashier-search-input"
          />
        </div>

        {/* Filter button with dropdown */}
        <div className="relative">
          <button
            onClick={() => setFilterDropdownOpen((v) => !v)}
            className={[
              'p-2.5 rounded-full border transition-all cursor-pointer flex items-center justify-center',
              dietaryFilter !== 'all'
                ? 'bg-[#14274E] text-white border-[#14274E]'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50',
            ].join(' ')}
            title="Filter by dietary preference"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </button>

          {filterDropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setFilterDropdownOpen(false)}
              />
              <div className="absolute left-0 mt-2 w-44 rounded-2xl bg-white shadow-xl border border-slate-100 py-1.5 z-40 text-xs font-semibold">
                <button
                  onClick={() => {
                    onDietaryChange('all')
                    setFilterDropdownOpen(false)
                  }}
                  className={[
                    'w-full px-3 py-2 text-left flex items-center justify-between hover:bg-slate-50 cursor-pointer',
                    dietaryFilter === 'all' ? 'text-[#14274E] font-black' : 'text-slate-600',
                  ].join(' ')}
                >
                  <span>All Dishes</span>
                  {dietaryFilter === 'all' && <span>✓</span>}
                </button>
                <button
                  onClick={() => {
                    onDietaryChange('veg')
                    setFilterDropdownOpen(false)
                  }}
                  className={[
                    'w-full px-3 py-2 text-left flex items-center justify-between hover:bg-slate-50 cursor-pointer',
                    dietaryFilter === 'veg' ? 'text-emerald-700 font-black' : 'text-slate-600',
                  ].join(' ')}
                >
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    Vegetarian
                  </span>
                  {dietaryFilter === 'veg' && <span>✓</span>}
                </button>
                <button
                  onClick={() => {
                    onDietaryChange('non-veg')
                    setFilterDropdownOpen(false)
                  }}
                  className={[
                    'w-full px-3 py-2 text-left flex items-center justify-between hover:bg-slate-50 cursor-pointer',
                    dietaryFilter === 'non-veg' ? 'text-rose-700 font-black' : 'text-slate-600',
                  ].join(' ')}
                >
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                    Non-Veg
                  </span>
                  {dietaryFilter === 'non-veg' && <span>✓</span>}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Right: Table Quick Switcher + Collapsible Notification Pills + Refresh */}
      <div className="flex items-center gap-2">
        {/* Table Selector Pill */}
        <button
          onClick={onOpenTableSelector}
          className="cashier-pill-btn cashier-pill-table cursor-pointer"
          title="Select Table"
        >
          <LayoutGrid className="w-3.5 h-3.5 text-[#14274E]" />
          <span className="font-extrabold text-[#14274E]">
            Table {selectedTable ? (selectedTable.TABLE_NUM || selectedTable.TABLE_ID) : '—'}
          </span>
          {selectedTable?.BILL_OUT_REQUESTED && (
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          )}
          <ChevronDown className="w-3 h-3 text-slate-400" />
        </button>

        {/* Collapsible Notification Pills (Assistance Calls & Kitchen-Verified Orders) */}
        <NotificationPills
          assistanceRequests={assistanceRequests}
          verifiedOrders={verifiedOrders}
          isAssistanceOpen={isAssistanceOpen}
          isVerifiedOpen={isVerifiedOpen}
          onToggleAssistance={onToggleAssistance}
          onToggleVerified={onToggleVerified}
          onCloseAll={onCloseAllPopovers}
          onResolveAssistance={onResolveAssistance}
          onAcknowledgeVerifiedOrder={onAcknowledgeVerifiedOrder}
        />

        {/* Refresh button */}
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="p-2 text-slate-500 hover:text-[#14274E] rounded-full border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
          title="Refresh Cashier Data"
        >
          <RefreshCw
            className={[
              'w-3.5 h-3.5',
              isRefreshing ? 'animate-spin text-[#14274E]' : '',
            ].join(' ')}
          />
        </button>
      </div>
    </div>
  )
}
