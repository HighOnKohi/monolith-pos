import React from 'react'
import { Search, ChevronDown } from 'lucide-react'
import type { TableItem } from './TableSelectorModal'

interface CashierHeaderProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  selectedTable: TableItem | null
  selectedTableLabel?: string
  isMerged?: boolean
  onOpenTableSelector: () => void
}

export const CashierHeader: React.FC<CashierHeaderProps> = ({
  searchQuery,
  onSearchChange,
  selectedTable,
  selectedTableLabel,
  isMerged = false,
  onOpenTableSelector,
}) => {
  return (
    <div className="service-interface-top-bar relative z-50 bg-white/90 backdrop-blur-md">
      {/* Left: Search input matching reference image */}
      <div className="service-interface-header-search flex-1 max-w-md">
        <div className="service-interface-search-wrapper h-[42px]">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search menu items, categories, SKU..."
            className="service-interface-search-input"
          />
        </div>
      </div>

      {/* Right: Table selector */}
      <div className="service-interface-header-table-selector flex items-center gap-2">
        {/* Table Selector Pill */}
        <button
          onClick={onOpenTableSelector}
          className={`service-interface-pill-btn service-interface-pill-table cursor-pointer justify-between h-[42px] px-4 ${
            isMerged ? 'border-dashed border-2 border-indigo-400 bg-indigo-50/50 shadow-xs' : ''
          }`}
          title="Select Table"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-extrabold text-[#14274E] truncate">
              {selectedTableLabel || (selectedTable ? (isMerged ? `Table ${selectedTable.TABLE_NUM || selectedTable.TABLE_ID}+` : `Table ${selectedTable.TABLE_NUM || selectedTable.TABLE_ID}`) : '—')}
            </span>
            {isMerged && (
              <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-indigo-100 text-indigo-700 border border-indigo-200 shrink-0">
                MERGED
              </span>
            )}
            {selectedTable?.BILL_OUT_REQUESTED && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
            )}
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-3" />
        </button>


      </div>
    </div>
  )
}
