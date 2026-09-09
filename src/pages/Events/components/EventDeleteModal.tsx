import React from 'react'
import { AlertTriangle, X } from 'lucide-react'

interface EventDeleteModalProps {
  isOpen: boolean
  eventTitle: string
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export const EventDeleteModal: React.FC<EventDeleteModalProps> = ({
  isOpen,
  eventTitle,
  loading = false,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity animate-in fade-in"
        onClick={loading ? undefined : onCancel}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-5 space-y-4 z-10 animate-in zoom-in-95 duration-150">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-[#14274E]">Delete Event</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">This action cannot be undone</p>
            </div>
          </div>

          <button
            disabled={loading}
            onClick={onCancel}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
          <p className="text-xs text-slate-600 leading-relaxed">
            Are you sure you want to delete{' '}
            <span className="font-black text-[#14274E]">"{eventTitle}"</span>?{' '}
            The event will be permanently removed and will no longer appear in the calendar or event list.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
            className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className="px-4 py-2 rounded-xl text-xs font-black text-white bg-rose-600 hover:bg-rose-700 transition-all shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
          >
            {loading ? (
              <>
                <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <span>Delete Event</span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
