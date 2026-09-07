import React from 'react'
import { Search, LayoutGrid, ChevronDown } from 'lucide-react'
import type { TableItem } from './TableSelectorModal'

interface CashierHeaderProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  selectedTable: TableItem | null
  selectedTableLabel?: string
  onOpenTableSelector: () => void
}

export const CashierHeader: React.FC<CashierHeaderProps> = ({
  searchQuery,
  onSearchChange,
  selectedTable,
  selectedTableLabel,
  onOpenTableSelector,
}) => {
  return (
    <div className="cashier-top-bar relative z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
      {/* Left: Search input matching reference image */}
      <div className="cashier-header-search flex-1 max-w-md">
        <div className="cashier-search-wrapper">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search menu items, categories, SKU..."
            className="cashier-search-input"
          />
        </div>
      </div>

      {/* Right: Table selector */}
      <div className="cashier-header-table-selector flex items-center gap-2">
        {/* Table Selector Pill */}
        <button
          onClick={onOpenTableSelector}
          className="cashier-pill-btn cashier-pill-table cursor-pointer"
          title="Select Table"
        >
          <LayoutGrid className="w-3.5 h-3.5 text-[#14274E]" />
          <span className="font-extrabold text-[#14274E]">
            {selectedTableLabel || (selectedTable ? `Table ${selectedTable.TABLE_NUM || selectedTable.TABLE_ID}` : '—')}
          </span>
          {selectedTable?.BILL_OUT_REQUESTED && (
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          )}
          <ChevronDown className="w-3 h-3 text-slate-400" />
        </button>


      </div>
    </div>
  )
}
