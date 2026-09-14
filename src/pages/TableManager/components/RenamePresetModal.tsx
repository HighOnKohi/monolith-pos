import React, { useState, useEffect } from 'react'
import { X, Pencil } from 'lucide-react'

interface RenamePresetModalProps {
  isOpen: boolean
  currentName: string
  onClose: () => void
  onRename: (newName: string) => Promise<void>
}

export const RenamePresetModal: React.FC<RenamePresetModalProps> = ({
  isOpen,
  currentName,
  onClose,
  onRename,
}) => {
  const [name, setName] = useState(currentName)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setName(currentName)
    setError(null)
  }, [currentName, isOpen])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Please enter a preset name')
      return
    }

    try {
      setIsSubmitting(true)
      setError(null)
      await onRename(name.trim())
      onClose()
    } catch (err) {
      setError((err as Error).message || 'Failed to rename preset')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 select-none">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between p-4 px-6 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#14274E] text-[#E9C46A]">
              <Pencil className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-black text-[#14274E]">
              Rename Layout Preset
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 text-xs font-bold text-rose-600 bg-rose-50 rounded-xl border border-rose-200">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Preset Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Main Dining Hall"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#14274E]/20 focus:bg-white transition-all"
              autoFocus
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-2xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="px-4 py-2 bg-[#14274E] hover:bg-[#0f1f40] disabled:opacity-50 text-[#E9C46A] rounded-xl text-xs font-black transition-all cursor-pointer shadow-xs"
            >
              {isSubmitting ? 'Saving...' : 'Rename Preset'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
