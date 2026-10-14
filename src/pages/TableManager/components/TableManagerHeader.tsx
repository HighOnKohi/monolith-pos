import React, { useState, useRef, useEffect, memo } from 'react'
import {
  Plus,
  Trash2,
  Pencil,
  ChevronDown,
  Printer,
  X,
} from 'lucide-react'
import type { TableLayoutPreset } from '@/services/tableLayoutService'

interface TableManagerHeaderProps {
  presets: TableLayoutPreset[]
  activePresetId: number | null
  isEventActive?: boolean
  activeEventTitle?: string
  isBusinessDayOpen?: boolean
  totalCapacity?: number
  maxVenueCapacity?: number
  isDirty?: boolean
  onSelectPreset: (presetId: number) => void
  onRenamePreset: (presetId: number, currentName: string) => void
  onDeletePreset: (presetId: number) => void
  onOpenNewPresetModal: () => void
  onOpenAutoAllocate?: () => void
  isEditMode?: boolean
  isSaving?: boolean
  isQrPrintMode?: boolean
  selectedPrintCount?: number
  onToggleQrPrintMode?: () => void
  onCancelQrPrint?: () => void
  onPrintSelectedQrs?: () => void
  isPrintingBulk?: boolean
  hasTables?: boolean
}

export const TableManagerHeader: React.FC<TableManagerHeaderProps> = memo(({
  presets,
  activePresetId,
  isEventActive = false,
  activeEventTitle,
  isBusinessDayOpen = false,
  totalCapacity = 0,
  maxVenueCapacity = 50,
  isDirty: _isDirty = false,
  onSelectPreset,
  onRenamePreset,
  onDeletePreset,
  onOpenNewPresetModal,
  onOpenAutoAllocate: _onOpenAutoAllocate,
  isEditMode = true,
  isSaving: _isSaving = false,
  isQrPrintMode = false,
  selectedPrintCount = 0,
  onToggleQrPrintMode,
  onCancelQrPrint,
  onPrintSelectedQrs,
  isPrintingBulk = false,
  hasTables = false,
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const activePreset = presets.find((p) => p.LAYOUT_PRESET_ID === activePresetId)

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

  return (
    <div className="table-manager-header flex items-center justify-between gap-3 bg-white px-4 py-2.5 rounded-2xl border border-slate-200/90 shadow-2xs shrink-0 select-none relative z-40">
      {/* Left side: Preset dropdown & Venue Capacity Counter */}
      <div className="flex items-center gap-3">
        {/* (a) Preset dropdown */}
        <div className="relative min-w-[220px] z-50" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => {
              if (isQrPrintMode || isEventActive || isBusinessDayOpen) return
              setIsDropdownOpen((prev) => !prev)
            }}
            aria-expanded={isDropdownOpen}
            title={
              isEventActive
                ? `Locked: Preset cannot be switched while event "${activeEventTitle ?? 'Active Event'}" is active`
                : isBusinessDayOpen
                ? 'Locked: Preset cannot be switched while Business Day is in progress'
                : undefined
            }
            className={`w-full min-w-[220px] px-3.5 py-2.5 bg-white border border-slate-300 text-xs font-bold text-[#14274E] flex items-center justify-between gap-2 shadow-xs transition-all duration-200 ${
              isEventActive || isBusinessDayOpen || isQrPrintMode
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:bg-slate-50 cursor-pointer'
            } ${
              isDropdownOpen ? 'rounded-t-xl rounded-b-none border-b-0 shadow-none' : 'rounded-xl'
            }`}
          >
            <div className="flex items-center gap-1.5 truncate">
              <span className="text-slate-400 font-semibold">Preset:</span>
              <span className="font-black text-[#14274E] truncate">
                {activePreset?.PRESET_NAME ?? 'Select Preset'}
              </span>
            </div>
            {!isQrPrintMode && !isEventActive && !isBusinessDayOpen && (
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-200 ${
                  isDropdownOpen ? 'rotate-180' : ''
                }`}
              />
            )}
          </button>

        {/* Seamlessly Connected Dropdown Menu without margins and without rounded corners on options */}
        <div
          className={`absolute top-full left-0 w-full min-w-[220px] z-50 bg-white border border-slate-300 border-t-0 rounded-b-xl shadow-xl overflow-hidden transition-all duration-300 ease-in-out origin-top ${
            isDropdownOpen
              ? 'max-h-96 opacity-100 translate-y-0 pointer-events-auto'
              : 'max-h-0 opacity-0 -translate-y-2 pointer-events-none'
          }`}
        >
          <div className="max-h-60 overflow-y-auto p-0 m-0 divide-y divide-slate-100">
            {presets.map((preset) => {
              const isSelected = preset.LAYOUT_PRESET_ID === activePresetId
              return (
                <div
                  key={preset.LAYOUT_PRESET_ID}
                  onClick={() => {
                    if (isQrPrintMode) return
                    onSelectPreset(preset.LAYOUT_PRESET_ID)
                    setIsDropdownOpen(false)
                  }}
                  className={`group w-full px-3.5 py-2.5 text-xs font-bold rounded-none m-0 flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-[#14274E] text-white'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span className="truncate flex-1 text-left">
                    {preset.PRESET_NAME}{' '}
                    <span className={isSelected ? 'text-slate-200 font-normal text-[11px]' : 'text-slate-400 font-normal text-[11px]'}>
                      ({preset.MAX_PAX || 50} Pax)
                    </span>
                  </span>

                  {/* Hover Action Buttons (Rename & Delete) */}
                  {!isEventActive && !isBusinessDayOpen && !isQrPrintMode && (
                    <div
                      className={`flex items-center gap-1 transition-opacity ${
                        isSelected ? 'opacity-90' : 'opacity-0 group-hover:opacity-100'
                      }`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setIsDropdownOpen(false)
                          onRenamePreset(preset.LAYOUT_PRESET_ID, preset.PRESET_NAME)
                        }}
                        title="Rename Preset"
                        className={`p-1 rounded-sm transition-colors cursor-pointer ${
                          isSelected
                            ? 'hover:bg-white/20 text-slate-200'
                            : 'hover:bg-slate-200 text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        <Pencil className="w-3 h-3" />
                      </button>

                      {presets.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsDropdownOpen(false)
                            onDeletePreset(preset.LAYOUT_PRESET_ID)
                          }}
                          title="Delete Preset"
                          className={`p-1 rounded-sm transition-colors cursor-pointer ${
                            isSelected
                              ? 'hover:bg-rose-600 text-rose-300 hover:text-white'
                              : 'hover:bg-rose-100 text-slate-400 hover:text-rose-600'
                          }`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Dropdown Footer: Create New Preset */}
          {!isEventActive && !isBusinessDayOpen && !isQrPrintMode && (
            <button
              type="button"
              onClick={() => {
                setIsDropdownOpen(false)
                onOpenNewPresetModal()
              }}
              className="w-full px-3.5 py-2.5 text-left text-xs font-black text-[#14274E] bg-slate-50 hover:bg-slate-100 border-t border-slate-200 flex items-center gap-2 cursor-pointer transition-colors rounded-none m-0"
            >
              <Plus className="w-3.5 h-3.5 text-slate-600" />
              <span>Create a new Preset</span>
            </button>
          )}
        </div>
        </div>

        {/* Venue Capacity Counter Badge: 0/50 */}
        <div className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-300 rounded-xl shadow-xs text-xs font-bold text-slate-500">
          <span className="font-semibold text-slate-400">Capacity:</span>
          <span className={`font-black ${totalCapacity > maxVenueCapacity ? 'text-rose-600' : 'text-[#14274E]'}`}>
            {totalCapacity}
          </span>
          <span className="text-slate-400">/{maxVenueCapacity}</span>
        </div>
      </div>

      {/* (b) Status Legend in View Mode (Above the grid container) */}
      {!isEditMode && !isQrPrintMode && (
        <div className="hidden md:flex items-center gap-3.5 px-3.5 py-2 bg-white border border-slate-300 rounded-xl shadow-xs">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
            <span className="w-2.5 h-2.5 rounded-full bg-[#10B981] shrink-0" />
            <span>Available</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
            <span className="w-2.5 h-2.5 rounded-full bg-[#3B82F6] shrink-0" />
            <span>Occupied</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
            <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B] shrink-0" />
            <span>Reserved</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
            <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444] shrink-0" />
            <span>Bill Out</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
            <span className="w-2.5 h-2.5 rounded-full bg-[#64748B] shrink-0" />
            <span>Unavailable</span>
          </div>
        </div>
      )}

      {/* (c) QR Print Actions & Edit Layout / Save Layout / Discard Changes Buttons */}
      <div className="flex items-center gap-2.5">
        {isQrPrintMode ? (
          <>
            {/* Cancel Button in QR Print Mode */}
            <button
              type="button"
              onClick={onCancelQrPrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-black shadow-2xs transition-transform active:scale-95 cursor-pointer"
            >
              <X className="w-3.5 h-3.5 text-slate-500" />
              <span>Cancel</span>
            </button>

            {/* Print Selected QRs Button */}
            <button
              type="button"
              disabled={selectedPrintCount === 0 || isPrintingBulk}
              onClick={onPrintSelectedQrs}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#14274E] hover:bg-[#0f1f40] disabled:opacity-40 text-white rounded-xl text-xs font-black shadow-xs transition-transform active:scale-95 cursor-pointer disabled:cursor-not-allowed"
            >
              <Printer className="w-3.5 h-3.5 text-[#E9C46A]" />
              <span>
                {isPrintingBulk ? 'Preparing...' : `Print QRs (${selectedPrintCount})`}
              </span>
            </button>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!hasTables}
              onClick={onToggleQrPrintMode}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-white hover:bg-slate-50 disabled:opacity-40 text-[#14274E] border border-slate-300 rounded-xl text-xs font-bold shadow-2xs transition-transform active:scale-95 cursor-pointer disabled:cursor-not-allowed"
              title="Enter QR code batch print mode"
            >
              <Printer className="w-3.5 h-3.5 text-[#14274E]" />
              <span>Print All QRs</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
})

TableManagerHeader.displayName = 'TableManagerHeader'

