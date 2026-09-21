import React, { useState, useEffect, useCallback } from 'react'
import {
  fetchAllLabels,
  createLabel,
  updateLabel,
  deleteLabel,
  reorderLabels,
  type TableLabel,
} from '@/services/tableLabelService'
import { TableLabelBadge } from '@/components/common/TableLabelBadge'
import { logTableAction, logHierarchyChange } from '@/services/tableAuditService'
import {
  GripVertical,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  RefreshCw,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  Sparkles,
} from 'lucide-react'

const COLOR_PRESETS = [
  { name: 'Maroon', hex: '#8B0000' },
  { name: 'Gold', hex: '#DAA520' },
  { name: 'Blue', hex: '#1E90FF' },
  { name: 'Emerald', hex: '#059669' },
  { name: 'Purple', hex: '#7C3AED' },
  { name: 'Gray', hex: '#6B7280' },
  { name: 'Silver', hex: '#A3A3A3' },
]

export const LabelHierarchyManager: React.FC = () => {
  const [labels, setLabels] = useState<TableLabel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Edit state
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('')

  // New label state
  const [isAdding, setIsAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#8B0000')

  // Drag state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

  const loadLabels = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchAllLabels()
      setLabels(data)
    } catch (err) {
      console.error('Error fetching labels:', err)
      setError('Failed to load table labels.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadLabels()
  }, [loadLabels])

  const showSuccess = (msg: string) => {
    setSuccess(msg)
    setTimeout(() => setSuccess(null), 3000)
  }

  // ── Drag & Drop / Move ──
  const handleMove = async (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= labels.length) return
    const reordered = [...labels]
    const [moved] = reordered.splice(fromIndex, 1)
    reordered.splice(toIndex, 0, moved)

    // Update priorities
    const updated = reordered.map((lbl, idx) => ({ ...lbl, PRIORITY: idx + 1 }))
    setLabels(updated)

    try {
      await reorderLabels(updated.map((l) => l.LABEL_ID))
      void logHierarchyChange(updated.map((l) => l.NAME))
      showSuccess('Hierarchy priorities updated.')
    } catch (err) {
      setError((err as Error).message || 'Failed to save reordered hierarchy.')
      void loadLabels()
    }
  }

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === index) return
    void handleMove(draggedIndex, index)
    setDraggedIndex(index)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
  }

  // ── Edit ──
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
    if (!editName.trim()) {
      setError('Label name cannot be empty.')
      return
    }
    try {
      await updateLabel(id, { name: editName, color: editColor })
      void logTableAction('LABEL_UPDATED', `Updated label "${editName}" (${editColor}).`, {
        targetEntity: 'LABEL',
        targetId: String(id),
        newState: { name: editName, color: editColor },
      })
      setEditingId(null)
      showSuccess('Label updated successfully.')
      await loadLabels()
    } catch (err) {
      setError((err as Error).message || 'Failed to update label.')
    }
  }

  // ── Create ──
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) {
      setError('Label name is required.')
      return
    }
    try {
      await createLabel(newName, newColor)
      void logTableAction('LABEL_CREATED', `Created new label "${newName}" (${newColor}).`, {
        targetEntity: 'LABEL',
        newState: { name: newName, color: newColor },
      })
      setNewName('')
      setNewColor('#8B0000')
      setIsAdding(false)
      showSuccess('New label created.')
      await loadLabels()
    } catch (err) {
      setError((err as Error).message || 'Failed to create label.')
    }
  }

  // ── Delete ──
  const handleDelete = async (id: number, name: string) => {
    if (!window.confirm(`Are you sure you want to delete the "${name}" label? It will be unassigned from all tables.`)) {
      return
    }
    try {
      await deleteLabel(id)
      void logTableAction('LABEL_DELETED', `Deleted label "${name}".`, {
        targetEntity: 'LABEL',
        targetId: String(id),
      })
      showSuccess(`Deleted label "${name}".`)
      await loadLabels()
    } catch (err) {
      setError((err as Error).message || 'Failed to delete label.')
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-black text-[#14274E]">Table Hierarchy & Label Management</h2>
          <p className="text-xs font-semibold text-slate-500">
            Orders from higher-priority tables jump ahead in Kitchen and Dispatcher queues.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void loadLabels()}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-600 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={() => setIsAdding((v) => !v)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#14274E] text-white text-xs font-black hover:bg-[#0f1f40] transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Label</span>
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="flex items-center gap-2.5 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-700">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2.5 p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-bold text-emerald-700">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Add New Label Form */}
      {isAdding && (
        <form
          onSubmit={handleCreate}
          className="p-4.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 animate-in fade-in duration-150"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-[#14274E] flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              New Priority Label
            </h3>
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                Label Name
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. VIP, Platinum, Event Guest"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#14274E]/20"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                Color Treatment
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={newColor}
                  onChange={(e) => setNewColor(e.target.value)}
                  className="w-9 h-9 p-0.5 rounded-xl border border-slate-200 cursor-pointer bg-white"
                />
                <div className="flex items-center gap-1.5 flex-wrap">
                  {COLOR_PRESETS.map((p) => (
                    <button
                      key={p.hex}
                      type="button"
                      onClick={() => setNewColor(p.hex)}
                      className="w-5 h-5 rounded-full border border-slate-200 hover:scale-110 transition-transform"
                      style={{ backgroundColor: p.hex }}
                      title={p.name}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-200">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-400">Preview:</span>
              <TableLabelBadge name={newName || 'Preview'} color={newColor} />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-black text-white bg-[#14274E] hover:bg-[#0f1f40] rounded-xl shadow-xs transition-colors"
              >
                Create Label
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Priority Hierarchy List */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-3 text-[11px] font-black uppercase tracking-wider text-slate-400">
          <span>Priority Hierarchy (Top = Highest Priority)</span>
          <span>Actions</span>
        </div>

        {labels.map((lbl, index) => {
          const isEditing = editingId === lbl.LABEL_ID
          const isHighest = index === 0
          const isLowest = index === labels.length - 1

          return (
            <div
              key={lbl.LABEL_ID}
              draggable={!isEditing}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              className={`flex items-center justify-between p-3.5 bg-white rounded-2xl border transition-all shadow-2xs ${
                draggedIndex === index
                  ? 'border-[#14274E] ring-2 ring-[#14274E]/10 bg-slate-50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              {/* Left: Grip, Priority Index, Name & Badge */}
              <div className="flex items-center gap-3">
                <div
                  className="cursor-grab active:cursor-grabbing p-1 text-slate-400 hover:text-slate-700"
                  title="Drag to reorder priority"
                >
                  <GripVertical className="w-4 h-4" />
                </div>

                <div className="w-7 h-7 rounded-xl bg-slate-100 flex items-center justify-center font-mono font-black text-xs text-slate-700 shrink-0">
                  #{lbl.PRIORITY}
                </div>

                {isEditing ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="px-2.5 py-1 text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[#14274E]"
                    />
                    <input
                      type="color"
                      value={editColor}
                      onChange={(e) => setEditColor(e.target.value)}
                      className="w-7 h-7 p-0.5 rounded-lg border border-slate-200 cursor-pointer bg-white"
                    />
                    <div className="flex items-center gap-1">
                      {COLOR_PRESETS.map((p) => (
                        <button
                          key={p.hex}
                          type="button"
                          onClick={() => setEditColor(p.hex)}
                          className="w-4 h-4 rounded-full border border-slate-200"
                          style={{ backgroundColor: p.hex }}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <TableLabelBadge name={lbl.NAME} color={lbl.COLOR} />
                    {isHighest && (
                      <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                        Top Priority
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Right: Order Arrows & Edit/Delete Buttons */}
              <div className="flex items-center gap-1.5">
                {isEditing ? (
                  <>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition-colors"
                      title="Cancel"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void saveEdit(lbl.LABEL_ID)}
                      className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                      title="Save"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => void handleMove(index, index - 1)}
                      disabled={isHighest}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Increase priority (move up)"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleMove(index, index + 1)}
                      disabled={isLowest}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Decrease priority (move down)"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => startEdit(lbl)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                      title="Edit label"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(lbl.LABEL_ID, lbl.NAME)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Delete label"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
