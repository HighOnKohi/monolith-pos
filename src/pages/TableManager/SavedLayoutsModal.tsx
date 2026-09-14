// ─────────────────────────────────────────────────────────────────────────────
// SavedLayoutsModal — View, load, rename, delete, and save floor plan presets
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, memo } from 'react'
import {
  X, FolderOpen, Star, Plus, Pencil, Trash2, Lock,
  Loader2, Layout, Calendar,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { LayoutPreset } from '@/services/layoutService'

interface SavedLayoutsModalProps {
  isOpen: boolean
  onClose: () => void
  presets: LayoutPreset[]
  activePresetId: number | null
  onLoadPreset: (presetId: number) => void
  onSaveNewPreset: () => void
  onRenamePreset: (preset: LayoutPreset) => void
  onDeletePreset: (preset: LayoutPreset) => void
  hasActiveOrders?: boolean
  isSwitchingLayout?: boolean
  switchingPresetId?: number | null
}

export const SavedLayoutsModal = memo(function SavedLayoutsModal({
  isOpen,
  onClose,
  presets,
  activePresetId,
  onLoadPreset,
  onSaveNewPreset,
  onRenamePreset,
  onDeletePreset,
  hasActiveOrders = false,
  isSwitchingLayout = false,
  switchingPresetId = null,
}: SavedLayoutsModalProps) {
  useEffect(() => {
    if (!isOpen) return
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fp-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="fp-modal max-w-lg w-full">
        {/* Header */}
        <div className="fp-modal-header">
          <div>
            <div className="fp-modal-title flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-[#14274E]" />
              <span>Saved Layouts</span>
            </div>
            <p className="fp-modal-desc">
              Select a floor plan layout to load or save your current arrangement.
            </p>
          </div>
          <button onClick={onClose} className="fp-modal-close-btn" title="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="fp-modal-body space-y-3 max-h-[60vh] overflow-y-auto">
          {/* Active Orders Warning */}
          {hasActiveOrders && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center gap-2 font-medium">
              <Lock className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                Layout switching is locked while active dine-in orders are in progress.
              </span>
            </div>
          )}

          {presets.length === 0 ? (
            <div className="py-8 text-center text-slate-500">
              <Layout className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="text-sm font-semibold text-slate-700">No saved layouts yet</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Arrange tables on the floor plan and click &quot;Save As New Layout&quot;.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {presets.map((preset) => {
                const isActive = preset.PRESET_ID === activePresetId
                const isThisPresetLoading =
                  isSwitchingLayout && switchingPresetId === preset.PRESET_ID
                const isPresetDisabled = hasActiveOrders || isSwitchingLayout

                return (
                  <div
                    key={preset.PRESET_ID}
                    className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                      isActive
                        ? 'bg-amber-50/70 border-amber-300 shadow-sm'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[#14274E] truncate">
                          {preset.PRESET_NAME}
                        </span>
                        {isActive && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200/80 text-amber-900 flex items-center gap-1">
                            <Star className="w-2.5 h-2.5 fill-amber-700 text-amber-700" />
                            Active
                          </span>
                        )}
                        {preset.EVENT_ID && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 flex items-center gap-1">
                            <Calendar className="w-2.5 h-2.5" />
                            Event
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                        <span>{(preset.LAYOUT_DATA ?? []).length} Tables</span>
                        {preset.FLOOR_WIDTH_BLOCKS && preset.FLOOR_HEIGHT_BLOCKS && (
                          <span>
                            · {preset.FLOOR_WIDTH_BLOCKS} × {preset.FLOOR_HEIGHT_BLOCKS} blocks
                          </span>
                        )}
                        {preset.DESCRIPTION && (
                          <span className="truncate max-w-[180px] text-slate-400">
                            · {preset.DESCRIPTION}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all ${
                          isActive
                            ? 'bg-amber-100 text-amber-800 cursor-default'
                            : isPresetDisabled
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed opacity-60'
                            : 'bg-[#14274E] text-[#F1F6F9] hover:bg-[#1a3365]'
                        }`}
                        disabled={isPresetDisabled || isActive}
                        onClick={() => {
                          if (!isPresetDisabled && !isActive) {
                            onLoadPreset(preset.PRESET_ID)
                            onClose()
                          }
                        }}
                        title={
                          isActive
                            ? 'Currently loaded layout'
                            : hasActiveOrders
                            ? 'Cannot switch layout while active orders are in progress'
                            : isSwitchingLayout
                            ? 'Switching layout...'
                            : `Load ${preset.PRESET_NAME}`
                        }
                      >
                        {isThisPresetLoading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
                        ) : hasActiveOrders ? (
                          <Lock className="w-3.5 h-3.5" />
                        ) : (
                          <FolderOpen className="w-3.5 h-3.5" />
                        )}
                        {isThisPresetLoading
                          ? 'Loading…'
                          : isActive
                          ? 'Active'
                          : 'Load'}
                      </button>

                      <button
                        className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200"
                        disabled={isSwitchingLayout}
                        onClick={() => {
                          onRenamePreset(preset)
                          onClose()
                        }}
                        title={`Rename ${preset.PRESET_NAME}`}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>

                      <button
                        className="p-1.5 rounded-lg text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200"
                        disabled={isSwitchingLayout}
                        onClick={() => {
                          onDeletePreset(preset)
                          onClose()
                        }}
                        title={`Delete ${preset.PRESET_NAME}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="fp-modal-footer flex items-center justify-between">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              onSaveNewPreset()
              onClose()
            }}
            disabled={isSwitchingLayout}
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Save As New Layout
          </Button>

          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  )
})

export default SavedLayoutsModal
