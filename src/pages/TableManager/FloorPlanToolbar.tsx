// ─────────────────────────────────────────────────────────────────────────────
// FloorPlanToolbar — Top toolbar for the floor plan editor
// ─────────────────────────────────────────────────────────────────────────────

import { memo } from 'react'
import {
  Undo2, Redo2, ZoomIn, ZoomOut, Maximize2,
  Grid3X3, Save, Printer, Settings, Trash2, RotateCw,
} from 'lucide-react'

interface FloorPlanToolbarProps {
  zoom: number
  canUndo: boolean
  canRedo: boolean
  snapEnabled: boolean
  isDirty: boolean
  saving?: boolean
  activePresetName?: string | null
  onUndo: () => void
  onRedo: () => void
  onRotateSelected?: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onResetZoom: () => void
  onToggleSnap: () => void
  onOpenGridSettings: () => void
  onSavePreset: () => void
  onPrintQr: () => void
  onRemoveAll: () => void
}

export const FloorPlanToolbar = memo(function FloorPlanToolbar({
  zoom,
  canUndo,
  canRedo,
  snapEnabled,
  isDirty,
  saving,
  activePresetName,
  onUndo,
  onRedo,
  onRotateSelected,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onToggleSnap,
  onOpenGridSettings,
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

      {/* Zoom */}
      <div className="fp-toolbar-group">
        <button className="fp-toolbar-btn" onClick={onZoomOut} title="Zoom Out">
          <ZoomOut className="w-4 h-4" />
        </button>
        <button className="fp-toolbar-zoom-label" onClick={onResetZoom} title="Reset Zoom">
          {Math.round(zoom * 100)}%
        </button>
        <button className="fp-toolbar-btn" onClick={onZoomIn} title="Zoom In">
          <ZoomIn className="w-4 h-4" />
        </button>
        <button className="fp-toolbar-btn" onClick={onResetZoom} title="Fit to Screen">
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      <div className="fp-toolbar-separator" />

      {/* Snap */}
      <button
        className={`fp-toolbar-btn fp-toolbar-toggle ${snapEnabled ? 'fp-active' : ''}`}
        onClick={onToggleSnap}
        title={snapEnabled ? 'Snap ON' : 'Snap OFF'}
      >
        <Grid3X3 className="w-4 h-4" />
        <span>Snap {snapEnabled ? 'ON' : 'OFF'}</span>
      </button>

      {/* Grid Settings */}
      <button className="fp-toolbar-btn" onClick={onOpenGridSettings} title="Grid Settings">
        <Settings className="w-4 h-4" />
      </button>

      <div className="fp-toolbar-spacer" />

      {/* Right-side actions */}
      <div className="fp-toolbar-group">
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
