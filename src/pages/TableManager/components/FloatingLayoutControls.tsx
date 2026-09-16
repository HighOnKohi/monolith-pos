import React, { useState, useRef, useEffect, memo } from 'react'
import { Plus, ChevronDown } from 'lucide-react'
import { TABLE_TYPES, type TableType } from '@/services/tableLayoutService'
import { TableShapeIcon } from './TableVisual'

interface FloatingLayoutControlsProps {
  onAddTable: (type: TableType) => void
  totalCapacity?: number
  maxVenueCapacity?: number
}

export const FloatingLayoutControls: React.FC<FloatingLayoutControlsProps> = memo(({
  onAddTable,
  totalCapacity = 0,
  maxVenueCapacity = 50,
}) => {
  const [selectedType, setSelectedType] = useState<TableType>(1)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const isVenueFull = totalCapacity >= maxVenueCapacity

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false)
      }
    }
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isDropdownOpen])

  const tableTypeOptions: TableType[] = [1, 2, 3, 4]

  return (
    <div className="relative select-none" ref={dropdownRef}>
      <div className={`relative inline-flex items-stretch rounded-xl shadow-xs border transition-opacity ${
        isVenueFull ? 'border-slate-400/50 bg-slate-700 text-slate-300 opacity-60' : 'border-slate-700/50 bg-[#14274E] text-white'
      }`}>
        {/* Main Action Button */}
        <button
          type="button"
          disabled={isVenueFull}
          onClick={() => onAddTable(selectedType)}
          className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-black whitespace-nowrap rounded-l-xl transition-colors ${
            isVenueFull ? 'cursor-not-allowed opacity-75' : 'hover:bg-[#0f1f40] cursor-pointer active:scale-98'
          }`}
          title={isVenueFull ? `Maximum venue capacity (${maxVenueCapacity} seats) reached` : 'Add Table'}
        >
          <div className="flex items-center gap-1.5 text-[#E9C46A]">
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
            <TableShapeIcon tableType={selectedType} size={15} />
          </div>
          <span className="whitespace-nowrap font-black">
            {isVenueFull ? `Venue Full (${totalCapacity}/${maxVenueCapacity})` : 'Add Table'}
          </span>
        </button>

        {/* Dropdown Chevron Trigger */}
        <button
          type="button"
          disabled={isVenueFull}
          onClick={() => setIsDropdownOpen((prev) => !prev)}
          className={`px-2 py-1.5 border-l border-blue-900/60 rounded-r-xl transition-colors flex items-center justify-center ${
            isVenueFull ? 'cursor-not-allowed text-slate-400' : 'hover:bg-[#0f1f40] cursor-pointer text-slate-300'
          }`}
          title="Select Table Type"
          aria-expanded={isDropdownOpen}
        >
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-200 ${
              isDropdownOpen ? 'rotate-180' : ''
            }`}
          />
        </button>
      </div>

      {/* Table Type Dropdown Menu with Golden Icons */}
      {isDropdownOpen && (
        <div className="absolute top-full right-0 mt-1.5 w-60 bg-white border border-slate-200 rounded-xl shadow-2xl p-1 z-50 animate-in fade-in duration-100 text-slate-800">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider px-2.5 py-1">
            Table Type
          </div>
          <div className="space-y-0.5">
            {tableTypeOptions.map((typeKey) => {
              const cfg = TABLE_TYPES[typeKey]
              const isCurrent = typeKey === selectedType

              return (
                <button
                  key={typeKey}
                  type="button"
                  onClick={() => {
                    setSelectedType(typeKey)
                    setIsDropdownOpen(false)
                  }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between cursor-pointer transition-colors whitespace-nowrap ${
                    isCurrent
                      ? 'bg-[#14274E] text-white font-black'
                      : 'text-slate-700 hover:bg-slate-100 font-bold'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <TableShapeIcon tableType={typeKey} size={16} />
                    <span className="whitespace-nowrap">{cfg.name}</span>
                  </div>
                  <span
                    className={`text-[10px] font-bold ${
                      isCurrent ? 'text-slate-300' : 'text-slate-400'
                    }`}
                  >
                    {cfg.width}×{cfg.height}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
})

FloatingLayoutControls.displayName = 'FloatingLayoutControls'
