// ─────────────────────────────────────────────────────────────────────────────
// FloorPlanToolbar — Top toolbar for the floor plan editor
// ─────────────────────────────────────────────────────────────────────────────

import { memo } from 'react'
import {
  Undo2, Redo2,
  Save, Printer, Settings, Trash2, RotateCw, FolderOpen,
} from 'lucide-react'

interface FloorPlanToolbarProps {
  canUndo: boolean
  canRedo: boolean
  isDirty: boolean
  saving?: boolean
  activePresetName?: string | null
  onUndo: () => void
  onRedo: () => void
  onRotateSelected?: () => void
  onOpenGridSettings: () => void
  onOpenSavedLayouts: () => void
  onSavePreset: () => void
  onPrintQr: () => void
  onRemoveAll: () => void
}

export const FloorPlanToolbar = memo(function FloorPlanToolbar({
  canUndo,
  canRedo,
  isDirty,
  saving,
  activePresetName,
  onUndo,
  onRedo,
  onRotateSelected,
  onOpenGridSettings,
  onOpenSavedLayouts,
  onSavePreset,
  onPrintQr,
  onRemoveAll,
}: FloorPlanToolbarProps) {
  return (
    <div className="fp-toolbar">
      <div className="fp-toolbar-group">
        <span className="fp-toolbar-label">Edit Floorplan</span>
        {isDirty && <span className="fp-toolbar-dirty" title="Unsaved changes" />}
      </div>

      <div className="fp-toolbar-separator" />

      {/* Undo / Redo */}
      <div className="fp-toolbar-group">
        <button
          className="fp-toolbar-btn"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
        >
          <Undo2 className="w-4 h-4" />
        </button>
        <button
          className="fp-toolbar-btn"
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
        >
          <Redo2 className="w-4 h-4" />
        </button>
      </div>

      <div className="fp-toolbar-separator" />

      {/* Rotate selected table */}
      <div className="fp-toolbar-group">
        <button
          className="fp-toolbar-btn"
          onClick={onRotateSelected}
          disabled={!onRotateSelected}
          title={onRotateSelected ? "Rotate selected table 90° (R)" : "Select a table to rotate"}
        >
          <RotateCw className="w-4 h-4" />
          <span>Rotate</span>
        </button>
      </div>

      <div className="fp-toolbar-separator" />

      {/* Grid Settings */}
      <button className="fp-toolbar-btn" onClick={onOpenGridSettings} title="Grid Settings">
        <Settings className="w-4 h-4" />
      </button>

      <div className="fp-toolbar-spacer" />

      {/* Right-side actions */}
      <div className="fp-toolbar-group">
        {/* Saved Layouts */}
        <button
          className="fp-toolbar-btn"
          onClick={onOpenSavedLayouts}
          title="View and load saved floor plan layouts"
        >
          <FolderOpen className="w-4 h-4 text-[#14274E]" />
          <span>Saved Layouts</span>
          {activePresetName && (
            <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-100 text-amber-900">
              {activePresetName}
            </span>
          )}
        </button>

        <button className="fp-toolbar-btn" onClick={onPrintQr} title="Print QR Codes">
          <Printer className="w-4 h-4" />
          <span>Print QR</span>
        </button>
        <button className="fp-toolbar-btn text-red-600" onClick={onRemoveAll} title="Remove all tables">
          <Trash2 className="w-4 h-4" />
          <span>Remove All</span>
        </button>
        <button
          className="fp-toolbar-btn fp-toolbar-save"
          onClick={onSavePreset}
          disabled={saving}
          title={activePresetName ? `Save to "${activePresetName}"` : 'Save as Preset'}
        >
          <Save className="w-4 h-4" />
          <span>{saving ? 'Saving...' : 'Save Layout'}</span>
        </button>
      </div>
    </div>
  )
})

export default FloorPlanToolbar
