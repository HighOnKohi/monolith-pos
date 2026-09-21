import React, { useState } from 'react'
import { AlertTriangle, Trash2, X, ShieldAlert } from 'lucide-react'

interface RemoveAllTablesModalProps {
  isOpen: boolean
  totalTablesCount: number
  onClose: () => void
  onConfirm: () => Promise<void>
}

export const RemoveAllTablesModal: React.FC<RemoveAllTablesModalProps> = ({
  isOpen,
  totalTablesCount,
  onClose,
  onConfirm,
}) => {
  const [confirmText, setConfirmText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const isConfirmed = confirmText.trim().toUpperCase() === 'REMOVE ALL'

  const handleConfirm = async () => {
    if (!isConfirmed) return
    setIsDeleting(true)
    setError(null)
    try {
      await onConfirm()
      setConfirmText('')
      onClose()
    } catch (err) {
      setError((err as Error).message || 'Failed to remove tables.')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-rose-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 px-6 border-b border-rose-100 bg-rose-50/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-600 text-white">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-rose-950">Remove All Tables?</h3>
              <p className="text-[11px] font-semibold text-rose-600">Destructive Configuration Action</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="p-3.5 bg-rose-50/60 rounded-xl border border-rose-200/80 text-xs text-rose-900 leading-relaxed">
            <p className="font-bold mb-1">
              You are about to remove all {totalTablesCount} table{totalTablesCount === 1 ? '' : 's'} from the active layout.
            </p>
            <p className="text-[11px] text-rose-700 font-medium">
              This action cannot be undone. Tables currently associated with active orders will be protected and retained.
            </p>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <ShieldAlert className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Historical sales, order records, and invoices remain safely intact.</span>
          </div>

          {error && (
            <div className="p-3 text-xs font-bold text-rose-600 bg-rose-50 rounded-xl border border-rose-200">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Type <span className="font-black text-rose-600 select-all">REMOVE ALL</span> to confirm:
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="REMOVE ALL"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:bg-white transition-all uppercase"
              autoFocus
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!isConfirmed || isDeleting}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-black text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {isDeleting ? 'Removing Tables...' : 'Remove All Tables'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
