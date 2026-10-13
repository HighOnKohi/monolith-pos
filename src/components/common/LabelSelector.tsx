import React, { useState, useEffect, useRef } from 'react'
import { Tag, ChevronDown } from 'lucide-react'
import { fetchActiveLabels, assignLabelToTable, type TableLabel } from '@/services/tableLabelService'

interface LabelSelectorProps {
  tableId: number
  currentLabelId: number | null | undefined
  onLabelChanged?: (labelId: number | null) => void | Promise<void>
  labels?: TableLabel[]
  disabled?: boolean
  compact?: boolean
  className?: string
}

/**
 * Dropdown selector for assigning a table label.
 * Fetches active labels from the database and allows assignment/removal.
 * Used in both Receptionist and Table Management interfaces.
 */
export const LabelSelector: React.FC<LabelSelectorProps> = ({
  tableId,
  currentLabelId,
  onLabelChanged,
  labels: propLabels,
  disabled = false,
  compact = false,
  className = '',
}) => {
  const [labels, setLabels] = useState<TableLabel[]>(propLabels || [])
  const [isOpen, setIsOpen] = useState(false)
  const [isAssigning, setIsAssigning] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (propLabels && propLabels.length > 0) {
      setLabels(propLabels)
    } else {
      fetchActiveLabels().then(setLabels).catch(console.error)
    }
  }, [propLabels])

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const currentLabel = labels.find((l) => l.LABEL_ID === currentLabelId) ?? null

  async function handleSelect(labelId: number | null) {
    if (isAssigning) return
    setIsAssigning(true)
    try {
      if (onLabelChanged) {
        await onLabelChanged(labelId)
      } else {
        await assignLabelToTable(tableId, labelId)
      }
      setIsOpen(false)
    } catch (err) {
      console.error('[LabelSelector] Failed to assign label:', err)
    } finally {
      setIsAssigning(false)
    }
  }

  return (
    <div ref={dropdownRef} className={`relative w-full ${className}`}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full min-w-0 px-3.5 py-2.5 bg-white border border-slate-300 hover:border-slate-400 rounded-xl text-xs font-bold text-[#14274E] flex items-center justify-between gap-2 shadow-2xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
          compact ? 'px-2.5 py-1.5 text-[11px]' : ''
        } ${isOpen ? 'ring-2 ring-[#14274E]/10 border-slate-400' : ''}`}
      >
        <div className="flex items-center gap-2 truncate">
          {currentLabel ? (
            <>
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs"
                style={{ backgroundColor: currentLabel.COLOR }}
              />
              <span className="font-bold text-[#14274E] truncate">{currentLabel.NAME}</span>
            </>
          ) : (
            <>
              <Tag className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="text-slate-400 font-semibold truncate">Select Table Label...</span>
            </>
          )}
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1.5 w-full min-w-[200px] z-50 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in duration-100 max-h-56 overflow-y-auto divide-y divide-slate-100">
          {/* None / Clear Label option */}
          <button
            type="button"
            onClick={() => handleSelect(null)}
            disabled={isAssigning}
            className={`w-full px-3.5 py-2.5 text-left text-xs font-bold flex items-center justify-between gap-2 cursor-pointer transition-colors ${
              currentLabelId == null
                ? 'bg-[#14274E] text-white'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-2">
              <Tag className={`w-3.5 h-3.5 ${currentLabelId == null ? 'text-white' : 'text-slate-400'}`} />
              <span>None (No Label)</span>
            </div>
            {currentLabelId == null && (
              <span className="text-[10px] font-black tracking-wider uppercase text-slate-200">ACTIVE</span>
            )}
          </button>

          {/* Label options */}
          {labels.map((label) => {
            const isSelected = label.LABEL_ID === currentLabelId
            return (
              <button
                key={label.LABEL_ID}
                type="button"
                onClick={() => handleSelect(label.LABEL_ID)}
                disabled={isAssigning}
                className={`w-full px-3.5 py-2.5 text-left text-xs font-bold flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-[#14274E] text-white'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/10 shadow-2xs"
                    style={{ backgroundColor: label.COLOR }}
                  />
                  <span className="truncate">{label.NAME}</span>
                </div>
                {isSelected && (
                  <span className="text-[10px] font-black tracking-wider uppercase text-slate-200">ACTIVE</span>
                )}
              </button>
            )
          })}

          {labels.length === 0 && (
            <div className="p-3 text-xs text-slate-400 font-semibold text-center">
              No labels configured
            </div>
          )}
        </div>
      )}
    </div>
  )
}
