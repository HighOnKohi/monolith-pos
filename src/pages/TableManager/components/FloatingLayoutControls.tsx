import React, { useState, useRef, useEffect, useMemo, memo } from 'react'
import { Plus, ChevronDown } from 'lucide-react'
import { TABLE_TYPES, type TableType } from '@/services/tableLayoutService'
import { fetchAllTypeConfigs, type TableTypeConfig } from '@/services/tableTypeConfigService'
import { TableShapeIcon } from './TableVisual'

interface FloatingLayoutControlsProps {
  onAddTable: (type: TableType) => void
  onOpenAutoAllocate?: () => void
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
  const [dbTypes, setDbTypes] = useState<TableTypeConfig[]>([])
  const dropdownRef = useRef<HTMLDivElement>(null)

  const isVenueFull = totalCapacity >= maxVenueCapacity

  // Load database table types dynamically
  useEffect(() => {
    let isMounted = true
    const loadTypes = async () => {
      try {
        const configs = await fetchAllTypeConfigs()
        if (isMounted && configs.length > 0) {
          const activeOnly = configs.filter((c) => c.IS_ACTIVE !== false)
          setDbTypes(activeOnly)
          if (!activeOnly.some((c) => c.TABLE_TYPE === selectedType)) {
            setSelectedType((activeOnly[0].TABLE_TYPE as TableType) || 1)
          }
        }
      } catch (err) {
        console.error('[FloatingLayoutControls] Failed to load table types from DB:', err)
      }
    }
    void loadTypes()
    return () => {
      isMounted = false
    }
  }, [])

  // Refresh DB table types whenever dropdown opens to stay synchronized with DB
  useEffect(() => {
    if (isDropdownOpen) {
      void fetchAllTypeConfigs().then((configs) => {
        if (configs.length > 0) {
          const activeOnly = configs.filter((c) => c.IS_ACTIVE !== false)
          setDbTypes(activeOnly)
        }
      })
    }
  }, [isDropdownOpen])

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

  // Table types strictly follow database table types (excluding hardcoded Type 5)
  const tableTypeOptions: Array<{ typeKey: TableType; name: string }> = useMemo(() => {
    if (dbTypes.length > 0) {
      return dbTypes.map((c) => ({
        typeKey: c.TABLE_TYPE as TableType,
        name: c.NAME || TABLE_TYPES[c.TABLE_TYPE as TableType]?.name || `Table Type ${c.TABLE_TYPE}`,
      }))
    }
    // Fallback strictly following database types [1, 2, 3, 4]
    return ([1, 2, 3, 4] as TableType[]).map((typeKey) => ({
      typeKey,
      name: TABLE_TYPES[typeKey]?.name || `Table Type ${typeKey}`,
    }))
  }, [dbTypes])

  return (
    <div className="flex items-center gap-2 select-none">
      {/* Add Table Controls */}
      <div className="relative" ref={dropdownRef}>
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

        {/* Table Type Dropdown Menu with Golden Icons (Follows DB types, no dimensions) */}
        {isDropdownOpen && (
          <div className="absolute top-full left-0 mt-1.5 min-w-[180px] bg-white border border-slate-200 rounded-xl shadow-2xl p-1 z-50 animate-in fade-in duration-100 text-slate-800">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider px-2.5 py-1">
              Table Type
            </div>
            <div className="space-y-0.5">
              {tableTypeOptions.map(({ typeKey, name }) => {
                const isCurrent = typeKey === selectedType

                return (
                  <button
                    key={typeKey}
                    type="button"
                    onClick={() => {
                      setSelectedType(typeKey)
                      setIsDropdownOpen(false)
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-2.5 cursor-pointer transition-colors whitespace-nowrap ${
                      isCurrent
                        ? 'bg-[#14274E] text-white font-black'
                        : 'text-slate-700 hover:bg-slate-100 font-bold'
                    }`}
                  >
                    <TableShapeIcon tableType={typeKey} size={16} />
                    <span className="whitespace-nowrap">{name}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
})

FloatingLayoutControls.displayName = 'FloatingLayoutControls'
