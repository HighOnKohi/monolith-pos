// ─────────────────────────────────────────────────────────────────────────────
// TablePalette — Left sidebar: table templates, presets, add table
// ─────────────────────────────────────────────────────────────────────────────

import { useState, memo, useEffect } from 'react'
import { Plus, Layout, ChevronDown, ChevronRight, Pencil, Trash2, Lock, Calendar } from 'lucide-react'
import type { RestaurantEvent } from '@/types/event'
import { TableTemplateModal } from './TableTemplateModal'
import { distributeSeatsToSides, type TableSide } from '@/utils/floorPlan/adjacency'
import {
  fetchAllTableTemplates,
  saveCustomTemplate,
  deleteCustomTemplate,
  getLocalTemplates,
  type TableTemplate,
} from '@/services/templateService'

function TemplatePreviewIcon({
  seats,
  widthBlocks = 2,
  heightBlocks = 2,
}: {
  seats: number
  widthBlocks?: number
  heightBlocks?: number
}) {
  const sideCounts = distributeSeatsToSides(seats, widthBlocks, heightBlocks)
  const sides: TableSide[] = ['top', 'bottom', 'left', 'right']

  return (
    <div className="fp-tmpl-icon" aria-hidden="true">
      <div
        className="fp-tmpl-table"
        style={{
          width: widthBlocks > heightBlocks ? 32 : 24,
          height: heightBlocks > widthBlocks ? 32 : 24,
        }}
      >
        <span className="fp-tmpl-num">{seats}</span>
        {sides.map((side) => {
          const count = sideCounts[side]
          if (count === 0) return null
          return Array.from({ length: count }, (_, i) => {
            const frac = count > 1 ? (i + 0.5) / count : 0.5
            let style: React.CSSProperties = {}
            if (side === 'top') {
              style = { top: -3, left: `${frac * 100}%`, transform: 'translateX(-50%)' }
            } else if (side === 'bottom') {
              style = { bottom: -3, left: `${frac * 100}%`, transform: 'translateX(-50%)' }
            } else if (side === 'left') {
              style = { left: -3, top: `${frac * 100}%`, transform: 'translateY(-50%)' }
            } else if (side === 'right') {
              style = { right: -3, top: `${frac * 100}%`, transform: 'translateY(-50%)' }
            }
            return (
              <span
                key={`${side}-${i}`}
                className={`fp-tmpl-seat fp-tmpl-seat-${side}`}
                style={style}
              />
            )
          })
        })}
      </div>
    </div>
  )
}

interface TablePaletteProps {
  onAddTable: (capacity: number, widthBlocks?: number, heightBlocks?: number) => void
  tableCount: number
  totalSeats: number
  maxPax?: number
  activeLinkedEvent?: RestaurantEvent | null
  hasActiveOrders?: boolean
}

export const TablePalette = memo(function TablePalette({
  onAddTable,
  tableCount,
  totalSeats,
  maxPax = 50,
  activeLinkedEvent = null,
  hasActiveOrders = false,
}: TablePaletteProps) {
  const [tablesExpanded, setTablesExpanded] = useState(true)

  // Custom table templates state — permanently saved via templateService
  const [templates, setTemplates] = useState<TableTemplate[]>(getLocalTemplates)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<TableTemplate | null>(null)

  // Fetch persistent custom templates on mount
  useEffect(() => {
    fetchAllTableTemplates()
      .then(setTemplates)
      .catch(() => setTemplates(getLocalTemplates()))
  }, [])

  async function handleSaveTemplate(template: TableTemplate) {
    await saveCustomTemplate(template)
    setTemplates(getLocalTemplates())
  }

  async function handleDeleteTemplate(id: string) {
    await deleteCustomTemplate(id)
    setTemplates(getLocalTemplates())
  }

  function handleOpenCreate() {
    setEditingTemplate(null)
    setModalOpen(true)
  }

  function handleOpenEdit(tmpl: TableTemplate) {
    setEditingTemplate(tmpl)
    setModalOpen(true)
  }

  return (
    <aside className="fp-palette">
      {/* ── Tables Section ── */}
      <div className="fp-palette-section">
        <div className="flex items-center justify-between">
          <button
            className="fp-palette-section-header flex-1"
            onClick={() => setTablesExpanded(!tablesExpanded)}
          >
            <span className="fp-palette-section-title">
              <Layout className="w-3.5 h-3.5" />
              Table Types
            </span>
            {tablesExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        </div>

        {tablesExpanded && (
          <div className="fp-palette-section-body">
            {templates.map((tmpl) => (
              <div key={tmpl.id} className="fp-palette-template">
                <div className="fp-palette-template-header">
                  <TemplatePreviewIcon
                    seats={tmpl.seats}
                    widthBlocks={tmpl.widthBlocks}
                    heightBlocks={tmpl.heightBlocks}
                  />
                  <div className="fp-palette-template-info">
                    <span className="fp-palette-template-name">{tmpl.label}</span>
                    <span className="fp-palette-template-meta">
                      {tmpl.seats} seats · {tmpl.widthBlocks} × {tmpl.heightBlocks} blocks
                    </span>
                  </div>
                </div>

                <div className="fp-palette-template-actions">
                  <button
                    className="fp-palette-add-btn"
                    onClick={() => onAddTable(tmpl.seats, tmpl.widthBlocks, tmpl.heightBlocks)}
                    title={`Add ${tmpl.label}`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Table</span>
                  </button>
                  <button
                    className="fp-palette-action-btn"
                    onClick={() => handleOpenEdit(tmpl)}
                    title={`Edit ${tmpl.label}`}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  {templates.length > 1 && (
                    <button
                      className="fp-palette-action-btn delete"
                      onClick={() => handleDeleteTemplate(tmpl.id)}
                      title={`Delete ${tmpl.label}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}

            {/* Add Custom Table Type Button */}
            <button
              className="fp-palette-save-btn w-full mt-2"
              onClick={handleOpenCreate}
            >
              <Plus className="w-3.5 h-3.5" />
              Add Table Type
            </button>
          </div>
        )}
      </div>

      {/* ── Floor Summary ── */}
      <div className="fp-palette-summary">
        <div className="fp-palette-summary-item">
          <span>{tableCount}</span>
          <label>Layout Tables</label>
        </div>
        <div className="fp-palette-summary-item">
          <span>{totalSeats} / {maxPax}</span>
          <label>Seating Pax</label>
        </div>
      </div>

      {/* Linked Event Banner if Active Layout has an Associated Event */}
      {activeLinkedEvent && (
        <div className="mx-2 mb-2 p-2.5 rounded-xl bg-indigo-50 border border-indigo-200 text-xs animate-in fade-in">
          <div className="flex items-center gap-1.5 font-bold text-indigo-900">
            <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span className="truncate">{activeLinkedEvent.title}</span>
          </div>
          <p className="text-[10px] text-indigo-700 mt-0.5 font-medium">
            Event Seating Basis: <strong className="font-bold">{maxPax} Pax</strong>
          </p>
        </div>
      )}

      {/* Active Orders Warning if Presets are Locked */}
      {hasActiveOrders && (
        <div className="mx-2 mb-2 p-2 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800 flex items-center gap-1.5 font-medium">
          <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span>Layout switching locked (active orders in restaurant).</span>
        </div>
      )}



      {/* ── Table Template Modal (Create / Edit) ── */}
      <TableTemplateModal
        isOpen={modalOpen}
        initialTemplate={editingTemplate}
        onSave={handleSaveTemplate}
        onClose={() => setModalOpen(false)}
      />
    </aside>
  )
})

export default TablePalette
