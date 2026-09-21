import React, { useState, useEffect, useRef } from 'react'
import { Tag, ChevronDown, X } from 'lucide-react'
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
    <div ref={dropdownRef} className={`relative ${className}`}>
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`flex items-center gap-2 rounded-lg border border-[#394867]/20 bg-white/80 transition-all hover:bg-white hover:border-[#394867]/40 disabled:opacity-50 disabled:cursor-not-allowed ${
          compact ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm'
        }`}
      >
        {currentLabel ? (
          <>
            <span
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: currentLabel.COLOR }}
            />
            <span className="font-medium text-[#14274E]">{currentLabel.NAME}</span>
          </>
        ) : (
          <>
            <Tag className={`text-[#9BA4B4] ${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'}`} />
            <span className="text-[#9BA4B4]">No Label</span>
          </>
        )}
        <ChevronDown className={`text-[#9BA4B4] ml-auto transition-transform ${isOpen ? 'rotate-180' : ''} ${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 min-w-[180px] bg-white rounded-lg shadow-xl border border-[#394867]/15 z-50 py-1 max-h-[240px] overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150">
          {/* Remove label option */}
          {currentLabelId != null && (
            <button
              onClick={() => handleSelect(null)}
              disabled={isAssigning}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#C94A4A] hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              <X className="w-3.5 h-3.5" />
              <span>Remove Label</span>
            </button>
          )}

          {currentLabelId != null && labels.length > 0 && (
            <div className="h-px bg-[#394867]/10 mx-2 my-1" />
          )}

          {/* Label options */}
          {labels.map((label) => (
            <button
              key={label.LABEL_ID}
              onClick={() => handleSelect(label.LABEL_ID)}
              disabled={isAssigning || label.LABEL_ID === currentLabelId}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors disabled:opacity-50 ${
                label.LABEL_ID === currentLabelId
                  ? 'bg-[#E9C46A]/10 text-[#14274E] font-medium'
                  : 'text-[#394867] hover:bg-[#F1F6F9]'
              }`}
            >
              <span
                className="w-3 h-3 rounded-full flex-shrink-0 border border-black/10"
                style={{ backgroundColor: label.COLOR }}
              />
              <span className="flex-1 text-left">{label.NAME}</span>
              {label.LABEL_ID === currentLabelId && (
                <span className="text-[10px] text-[#9BA4B4] font-medium">ACTIVE</span>
              )}
            </button>
          ))}

          {labels.length === 0 && (
            <div className="px-3 py-3 text-xs text-[#9BA4B4] text-center">
              No labels configured. Create labels in Table Management.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
