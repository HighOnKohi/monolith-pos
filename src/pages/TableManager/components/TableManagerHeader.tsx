import React, { useState, useRef, useEffect, memo } from 'react'
import {
  Edit3,
  Save,
  Plus,
  Trash2,
  Pencil,
  ChevronDown,
  RotateCcw,
  FileDown,
  Printer,
} from 'lucide-react'
import type { TableLayoutPreset } from '@/services/tableLayoutService'

interface TableManagerHeaderProps {
  presets: TableLayoutPreset[]
  activePresetId: number | null
  totalCapacity?: number
  maxVenueCapacity?: number
  isDirty?: boolean
  onSelectPreset: (presetId: number) => void
  onRenamePreset: (presetId: number, currentName: string) => void
  onDeletePreset: (presetId: number) => void
  onOpenNewPresetModal: () => void
  isEditMode: boolean
  onToggleEditMode: () => void
  onSaveLayout?: () => void
  onDiscardChanges?: () => void
  isSaving?: boolean
  onDownloadQrPdf?: () => void
  onPrintAllQr?: () => void
  isGeneratingPdf?: boolean
  isPrintingBulk?: boolean
  hasTables?: boolean
}

export const TableManagerHeader: React.FC<TableManagerHeaderProps> = memo(({
  presets,
  activePresetId,
  totalCapacity = 0,
  maxVenueCapacity = 50,
  isDirty = false,
  onSelectPreset,
  onRenamePreset,
  onDeletePreset,
  onOpenNewPresetModal,
  isEditMode,
  onToggleEditMode,
  onSaveLayout,
  onDiscardChanges,
  isSaving = false,
  onDownloadQrPdf,
  onPrintAllQr,
  isGeneratingPdf = false,
  isPrintingBulk = false,
  hasTables = true,
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
    <div className="table-manager-header flex items-center justify-between shrink-0 px-5 pt-4 pb-3 select-none">
      {/* Left side: Preset dropdown & Venue Capacity Counter */}
      <div className="flex items-center gap-3">
        {/* (a) Preset dropdown */}
        <div className="relative min-w-[220px] z-30" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setIsDropdownOpen((prev) => !prev)}
            aria-expanded={isDropdownOpen}
            className={`w-full min-w-[220px] px-3.5 py-2.5 bg-white hover:bg-slate-50 border border-slate-300 text-xs font-bold text-[#14274E] flex items-center justify-between gap-2 shadow-xs cursor-pointer transition-colors ${
              isDropdownOpen ? 'rounded-t-xl rounded-b-none border-b-0 shadow-none' : 'rounded-xl'
            }`}
          >
            <div className="flex items-center gap-1.5 truncate">
              <span className="text-slate-400 font-semibold">Preset:</span>
              <span className="font-black text-[#14274E] truncate">
                {activePreset?.PRESET_NAME ?? 'Select Preset'}
              </span>
            </div>
            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-200 ${
                isDropdownOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

        {/* Seamlessly Connected Dropdown Menu without margins and without rounded corners on options */}
        {isDropdownOpen && (
          <div className="absolute top-full left-0 w-full min-w-[220px] z-50 bg-white border border-slate-300 border-t-0 rounded-b-xl shadow-xl overflow-hidden animate-in fade-in duration-100">
            <div className="max-h-60 overflow-y-auto p-0 m-0 divide-y divide-slate-100">
              {presets.map((preset) => {
                const isSelected = preset.LAYOUT_PRESET_ID === activePresetId
                return (
                  <div
                    key={preset.LAYOUT_PRESET_ID}
                    onClick={() => {
                      onSelectPreset(preset.LAYOUT_PRESET_ID)
                      setIsDropdownOpen(false)
                    }}
                    className={`group w-full px-3.5 py-2.5 text-xs font-bold rounded-none m-0 flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-[#14274E] text-white'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="truncate flex-1 text-left">{preset.PRESET_NAME}</span>

                    {/* Hover Action Buttons (Rename & Delete) */}
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
                  </div>
                )
              })}
            </div>

            {/* Dropdown Footer: Create New Preset */}
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
          </div>
        )}
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

      {/* (b) Bulk QR Actions & Edit Layout / Save Layout / Discard Changes Buttons */}
      <div className="flex items-center gap-2.5">
        {!isEditMode && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!hasTables || isGeneratingPdf}
              onClick={onDownloadQrPdf}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white text-[#14274E] border border-slate-300 rounded-xl text-xs font-bold shadow-2xs transition-transform active:scale-95 cursor-pointer disabled:cursor-not-allowed"
              title="Download print-ready A4 PDF with all table QR cards"
            >
              <FileDown className="w-3.5 h-3.5 text-[#14274E]" />
              <span>{isGeneratingPdf ? 'Generating PDF...' : 'Download QR PDF'}</span>
            </button>

            <button
              type="button"
              disabled={!hasTables || isPrintingBulk}
              onClick={onPrintAllQr}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white text-[#14274E] border border-slate-300 rounded-xl text-xs font-bold shadow-2xs transition-transform active:scale-95 cursor-pointer disabled:cursor-not-allowed"
              title="Print all table QR codes in a 2-column grid"
            >
              <Printer className="w-3.5 h-3.5 text-[#14274E]" />
              <span>{isPrintingBulk ? 'Preparing...' : 'Print All QRs'}</span>
            </button>
          </div>
        )}

        {isEditMode ? (
          <>
            {onDiscardChanges && (
              <button
                type="button"
                disabled={isSaving || !isDirty}
                onClick={onDiscardChanges}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-white hover:bg-rose-50 disabled:opacity-40 disabled:hover:bg-white text-rose-600 border border-slate-200 hover:border-rose-300 rounded-xl text-xs font-black shadow-2xs transition-transform active:scale-95 cursor-pointer disabled:cursor-not-allowed"
                title="Discard all unsaved layout changes"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Discard Changes</span>
              </button>
            )}

            <button
              type="button"
              disabled={isSaving}
              onClick={onSaveLayout}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#E9C46A] hover:bg-[#dfba5f] disabled:opacity-50 text-[#14274E] rounded-xl text-xs font-black shadow-xs transition-transform active:scale-95 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5 text-[#14274E]" />
              <span>{isSaving ? 'Saving...' : 'Save Layout'}</span>
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onToggleEditMode}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#14274E] hover:bg-[#0f1f40] text-[#E9C46A] rounded-xl text-xs font-black shadow-xs transition-transform active:scale-95 cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5 text-[#E9C46A]" />
            <span>Edit Layout</span>
          </button>
        )}
      </div>
    </div>
  )
})

TableManagerHeader.displayName = 'TableManagerHeader'
