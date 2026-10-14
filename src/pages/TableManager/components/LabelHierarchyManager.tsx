import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  fetchAllLabels,
  createLabel,
  updateLabel,
  deleteLabel,
  reorderLabels,
  type TableLabel,
} from '@/services/tableLabelService'
import { logTableAction } from '@/services/tableAuditService'
import { ConfirmModal } from './ConfirmModal'
import {
  GripVertical,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  Sparkles,
} from 'lucide-react'

const COLOR_PRESETS = [
  { name: 'Maroon', hex: '#8B0000' },
  { name: 'Gold', hex: '#DAA520' },
  { name: 'Navy', hex: '#14274E' },
  { name: 'Emerald', hex: '#059669' },
  { name: 'Purple', hex: '#7C3AED' },
  { name: 'Blue', hex: '#1E90FF' },
  { name: 'Amber', hex: '#D97706' },
  { name: 'Rose', hex: '#E11D48' },
  { name: 'Slate', hex: '#475569' },
]

export interface LabelHierarchyManagerProps {
  isModal?: boolean
  onClose?: () => void
  isSidebar?: boolean
}

export const LabelHierarchyManager: React.FC<LabelHierarchyManagerProps> = ({
  isModal = false,
  onClose,
  isSidebar = false,
}) => {
  const [labels, setLabels] = useState<TableLabel[]>([])
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Edit state
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('#8B0000')

  // New label state
  const [isAdding, setIsAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#8B0000')

  // Drag state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

  // Delete modal state
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; name: string } | null>(null)

  // Debounced reorder ref to prevent stutters and batch rapid calls
  const reorderTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const broadcastLabelChange = useCallback(() => {
    if (typeof window !== 'undefined') {
      const detail = { type: 'table_label_changed' }
      window.dispatchEvent(new CustomEvent('monolith-order-update', { detail }))
      try {
        const bc = new BroadcastChannel('monolith_order_events')
        bc.postMessage(detail)
        bc.close()
      } catch {
        // Ignore
      }
    }
  }, [])

  const loadLabels = useCallback(async () => {
    try {
      const data = await fetchAllLabels()
      setLabels(data)
    } catch (err) {
      console.error('Error fetching labels:', err)
      setError('Failed to load table labels.')
    }
  }, [])

  useEffect(() => {
    void loadLabels()
    return () => {
      if (reorderTimeoutRef.current) {
        clearTimeout(reorderTimeoutRef.current)
      }
    }
  }, [loadLabels])

  const showSuccess = (msg: string) => {
    setSuccess(msg)
    setTimeout(() => setSuccess(null), 2500)
  }

  // ── Optimistic Background Sync for Reordering ──
  const syncReorderToDb = useCallback(
    (orderedIds: number[]) => {
      if (reorderTimeoutRef.current) {
        clearTimeout(reorderTimeoutRef.current)
      }
      reorderTimeoutRef.current = setTimeout(async () => {
        try {
          await reorderLabels(orderedIds)
          broadcastLabelChange()
        } catch (err) {
          console.error('Failed to sync reordered labels:', err)
          setError('Failed to save order priority. Reverting...')
          void loadLabels()
        }
      }, 350)
    },
    [broadcastLabelChange, loadLabels],
  )

  // ── Optimistic Move (Arrow Up / Down) ──
  const handleMove = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= labels.length || fromIndex === toIndex) return
    const reordered = [...labels]
    const [moved] = reordered.splice(fromIndex, 1)
    reordered.splice(toIndex, 0, moved)

    const updated = reordered.map((lbl, idx) => ({ ...lbl, PRIORITY: idx + 1 }))
    // Instant 0ms UI update
    setLabels(updated)
    // Debounced background sync
    syncReorderToDb(updated.map((l) => l.LABEL_ID))
  }

  // ── Drag & Drop ──
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === index) return
    const reordered = [...labels]
    const [moved] = reordered.splice(draggedIndex, 1)
    reordered.splice(index, 0, moved)

    const updated = reordered.map((lbl, idx) => ({ ...lbl, PRIORITY: idx + 1 }))
    // Instant UI movement during drag
    setLabels(updated)
    setDraggedIndex(index)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
    // Sync final reorder order to database once on drop
    syncReorderToDb(labels.map((l) => l.LABEL_ID))
  }

  // ── Optimistic Edit ──
  const startEdit = (lbl: TableLabel) => {
    setEditingId(lbl.LABEL_ID)
    setEditName(lbl.NAME)
    setEditColor(lbl.COLOR)
    setError(null)
  }

  const cancelEdit = () => {
    setEditingId(null)
  }

  const saveEdit = async (id: number) => {
    const trimmed = editName.trim()
    if (!trimmed) {
      setError('Label name cannot be empty.')
      return
    }

    // 1. Optimistic UI update immediately
    const prevLabels = [...labels]
    setLabels((prev) =>
      prev.map((l) => (l.LABEL_ID === id ? { ...l, NAME: trimmed, COLOR: editColor } : l)),
    )
    setEditingId(null)
    showSuccess(`Updated "${trimmed}".`)

    // 2. Background DB call
    try {
      await updateLabel(id, { name: trimmed, color: editColor })
      void logTableAction('LABEL_UPDATED', `Updated label "${trimmed}" (${editColor}).`, {
        targetEntity: 'LABEL',
        targetId: String(id),
        newState: { name: trimmed, color: editColor },
      })
      broadcastLabelChange()
    } catch (err) {
      setError((err as Error).message || 'Failed to update label.')
      setLabels(prevLabels) // Rollback on error
    }
  }

  // ── Optimistic Create ──
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = newName.trim()
    if (!trimmed) {
      setError('Label name is required.')
      return
    }

    const tempId = -Date.now()
    const optimisticLabel: TableLabel = {
      LABEL_ID: tempId,
      NAME: trimmed,
      COLOR: newColor,
      PRIORITY: labels.length + 1,
      IS_ACTIVE: true,
    }

    // 1. Optimistic UI update immediately
    setLabels((prev) => [...prev, optimisticLabel])
    setNewName('')
    setNewColor('#8B0000')
    setIsAdding(false)
    showSuccess(`Added "${trimmed}".`)

    // 2. Background DB call
    try {
      const created = await createLabel(trimmed, newColor)
      void logTableAction('LABEL_CREATED', `Created new label "${trimmed}" (${newColor}).`, {
        targetEntity: 'LABEL',
        newState: { name: trimmed, color: newColor },
      })
      // Update temporary ID with real DB ID
      if (created?.LABEL_ID) {
        setLabels((prev) =>
          prev.map((l) => (l.LABEL_ID === tempId ? { ...l, LABEL_ID: created.LABEL_ID } : l)),
        )
      }
      broadcastLabelChange()
    } catch (err) {
      setError((err as Error).message || 'Failed to create label.')
      setLabels((prev) => prev.filter((l) => l.LABEL_ID !== tempId)) // Rollback on error
    }
  }

  // ── Optimistic Delete ──
  const handleDelete = (id: number, name: string) => {
    setDeleteConfirm({ id, name })
  }

  const confirmDeleteLabel = async () => {
    if (!deleteConfirm) return
    const { id, name } = deleteConfirm
    setDeleteConfirm(null)

    // 1. Optimistic UI update immediately
    const prevLabels = [...labels]
    setLabels((prev) => prev.filter((l) => l.LABEL_ID !== id))
    showSuccess(`Deleted "${name}".`)

    // 2. Background DB call
    try {
      await deleteLabel(id)
      void logTableAction('LABEL_DELETED', `Deleted label "${name}".`, {
        targetEntity: 'LABEL',
        targetId: String(id),
      })
      broadcastLabelChange()
    } catch (err) {
      setError((err as Error).message || 'Failed to delete label.')
      setLabels(prevLabels) // Rollback on error
    }
  }

  return (
    <div
      className={
        isSidebar
          ? 'p-3.5 space-y-3 select-none'
          : isModal
            ? 'max-w-4xl mx-auto space-y-4 p-6 sm:p-8'
            : 'max-w-4xl mx-auto space-y-4 p-6'
      }
    >
      {/* ── Top Action Bar (No Title, No Description, No Refresh Button) ── */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold text-slate-400">
          {labels.length} {labels.length === 1 ? 'Label' : 'Labels'}
        </span>
        <div className="flex items-center gap-2">
          {/* Add Button with Gold Accent and Thicker Plus Icon */}
          <button
            type="button"
            onClick={() => setIsAdding((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#14274E] hover:bg-[#0f1f40] text-[#E9C46A] border border-[#E9C46A]/30 text-xs font-black transition-all shadow-xs cursor-pointer active:scale-95"
          >
            <Plus className="w-3.5 h-3.5 stroke-[3] text-[#E9C46A]" />
            <span>Add</span>
          </button>
          {isModal && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              title="Close dialog"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700 animate-in fade-in duration-100">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span className="flex-1">{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-rose-400 hover:text-rose-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-700 animate-in fade-in duration-100">
          <Check className="w-4 h-4 text-emerald-600 shrink-0 stroke-[2.5]" />
          <span>{success}</span>
        </div>
      )}

      {/* ── Add New Label Form ── */}
      {isAdding && (
        <form
          onSubmit={handleCreate}
          className="p-3.5 bg-slate-50 border border-slate-200/90 rounded-2xl space-y-3 animate-in fade-in duration-150 shadow-2xs"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-[#14274E] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Create Priority Label</span>
            </span>
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2.5">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                Label Title
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. VIP, Priority, Lounge"
                maxLength={30}
                className="w-full px-3 py-1.5 text-xs font-bold bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#14274E]"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={newColor}
                  onChange={(e) => setNewColor(e.target.value)}
                  className="w-8 h-8 rounded-lg border border-slate-200 cursor-pointer p-0.5"
                />
                <div className="flex items-center gap-1.5 flex-wrap">
                  {COLOR_PRESETS.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setNewColor(c.hex)}
                      className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 cursor-pointer ${
                        newColor.toLowerCase() === c.hex.toLowerCase()
                          ? 'border-[#14274E] scale-110 ring-1 ring-[#14274E]/30'
                          : 'border-white shadow-2xs'
                      }`}
                      style={{ backgroundColor: c.hex }}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200/80">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3.5 py-1.5 bg-[#14274E] text-[#E9C46A] border border-[#E9C46A]/20 text-xs font-black rounded-xl hover:bg-[#0f1f40] transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3] text-[#E9C46A]" />
              <span>Save Label</span>
            </button>
          </div>
        </form>
      )}

      {/* ── Priority Hierarchy List ── */}
      <div className="space-y-2">
        {labels.length === 0 && (
          <div className="text-center py-10 bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
            <p className="text-xs font-bold text-slate-400">No labels configured</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Click &quot;Add&quot; to create a priority label tier.
            </p>
          </div>
        )}

        {labels.map((lbl, index) => {
          const isHighest = index === 0
          const isLowest = index === labels.length - 1
          const isEditing = editingId === lbl.LABEL_ID

          if (isEditing) {
            return (
              <div
                key={lbl.LABEL_ID}
                className="bg-white border border-[#14274E] ring-2 ring-[#14274E]/10 rounded-2xl p-3.5 shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-[#14274E]">Edit Label</span>
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#14274E]"
                    maxLength={30}
                    autoFocus
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={editColor}
                      onChange={(e) => setEditColor(e.target.value)}
                      className="w-7 h-7 rounded-lg border border-slate-200 cursor-pointer p-0.5"
                    />
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {COLOR_PRESETS.map((c) => (
                        <button
                          key={c.hex}
                          type="button"
                          onClick={() => setEditColor(c.hex)}
                          className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 cursor-pointer ${
                            editColor.toLowerCase() === c.hex.toLowerCase()
                              ? 'border-[#14274E] scale-110 ring-1 ring-[#14274E]/30'
                              : 'border-white shadow-2xs'
                          }`}
                          style={{ backgroundColor: c.hex }}
                          title={c.name}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="px-2.5 py-1 text-[11px] font-bold text-slate-500 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void saveEdit(lbl.LABEL_ID)}
                    className="px-3 py-1 bg-[#14274E] text-[#E9C46A] border border-[#E9C46A]/20 text-[11px] font-black rounded-lg hover:bg-[#0f1f40] transition-colors shadow-xs cursor-pointer flex items-center gap-1"
                  >
                    <Check className="w-3 h-3 stroke-[3]" />
                    <span>Save</span>
                  </button>
                </div>
              </div>
            )
          }

          return (
            <div
              key={lbl.LABEL_ID}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              className={`flex items-center justify-between p-3 bg-white border rounded-2xl transition-all select-none ${
                draggedIndex === index
                  ? 'border-indigo-400 bg-indigo-50/20 shadow-md opacity-60'
                  : 'border-slate-200/80 hover:border-slate-300 shadow-2xs'
              }`}
            >
              {/* Left: Grip Handle + Stylized Color Swatch + Title (No Numbers, No Highest Priority Tag) */}
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 p-0.5 rounded transition-colors shrink-0"
                  title="Drag to reorder hierarchy"
                >
                  <GripVertical className="w-4 h-4" />
                </div>

                {/* Stylized Color Container with Color Pill & Dot */}
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border shadow-2xs"
                  style={{
                    backgroundColor: `${lbl.COLOR}18`,
                    borderColor: `${lbl.COLOR}35`,
                  }}
                >
                  <span
                    className="w-3.5 h-3.5 rounded-full shadow-xs border-2 border-white ring-1 ring-black/10"
                    style={{ backgroundColor: lbl.COLOR }}
                  />
                </div>

                <div className="min-w-0">
                  <h4 className="text-xs font-black text-[#14274E] truncate tracking-tight">
                    {lbl.NAME}
                  </h4>
                  <span
                    className="text-[10px] font-bold tracking-wider uppercase font-mono block mt-0.5"
                    style={{ color: lbl.COLOR }}
                  >
                    {lbl.COLOR}
                  </span>
                </div>
              </div>

              {/* Right: Quick Move Arrows + Edit + Delete */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  disabled={isHighest}
                  onClick={() => handleMove(index, index - 1)}
                  className="w-6 h-6 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-[#14274E] disabled:opacity-20 transition-colors cursor-pointer"
                  title="Move Up"
                >
                  <ArrowUp className="w-3.5 h-3.5 stroke-[2.5]" />
                </button>
                <button
                  type="button"
                  disabled={isLowest}
                  onClick={() => handleMove(index, index + 1)}
                  className="w-6 h-6 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-[#14274E] disabled:opacity-20 transition-colors cursor-pointer"
                  title="Move Down"
                >
                  <ArrowDown className="w-3.5 h-3.5 stroke-[2.5]" />
                </button>
                <div className="w-px h-3.5 bg-slate-200 mx-0.5" />
                <button
                  type="button"
                  onClick={() => startEdit(lbl)}
                  className="w-6 h-6 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-[#14274E] transition-colors cursor-pointer"
                  title="Edit Label"
                >
                  <Edit2 className="w-3.5 h-3.5 stroke-[2.2]" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(lbl.LABEL_ID, lbl.NAME)}
                  className="w-6 h-6 rounded-lg hover:bg-rose-50 flex items-center justify-center text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                  title="Delete Label"
                >
                  <Trash2 className="w-3.5 h-3.5 stroke-[2.2]" />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteConfirm !== null}
        title="Delete Table Label"
        message={`Are you sure you want to delete the "${deleteConfirm?.name}" label? It will be unassigned from all tables.`}
        confirmLabel="Delete Label"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => void confirmDeleteLabel()}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  )
}
