import React from 'react'
import { AlertTriangle, X } from 'lucide-react'

interface AccountActionConfirmModalProps {
  isOpen: boolean
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  isDestructive?: boolean
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export const AccountActionConfirmModal: React.FC<AccountActionConfirmModalProps> = ({
  isOpen,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDestructive = false,
  loading = false,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity animate-in fade-in"
        onClick={loading ? undefined : onCancel}
      />

      {/* Dialog Box */}
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-5 space-y-4 z-10 animate-in zoom-in-95 duration-150">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                isDestructive ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'
              }`}
            >
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="text-base font-black text-[#14274E]">{title}</h3>
          </div>

          <button
            disabled={loading}
            onClick={onCancel}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed pl-13">{description}</p>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
            className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 transition-colors cursor-pointer"
          >
            {cancelText}
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className={`px-4 py-2 rounded-xl text-xs font-black text-white transition-all shadow-xs cursor-pointer flex items-center gap-1.5 ${
              isDestructive
                ? 'bg-rose-600 hover:bg-rose-700'
                : 'bg-[#14274E] hover:bg-[#1a3468]'
            } disabled:opacity-50`}
          >
            {loading ? (
              <>
                <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <span>{confirmText}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
