import React from 'react'
import { AlertTriangle, HelpCircle, X } from 'lucide-react'

interface ConfirmModalProps {
  isOpen: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning' | 'primary'
  onConfirm: () => void
  onCancel: () => void
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary',
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null

  const getVariantStyles = () => {
    switch (variant) {
      case 'danger':
        return {
          iconBg: 'bg-rose-50 text-rose-600 border border-rose-200/80',
          icon: <AlertTriangle className="w-5 h-5 text-rose-600" />,
          buttonClass: 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs',
        }
      case 'warning':
        return {
          iconBg: 'bg-amber-50 text-amber-600 border border-amber-200/80',
          icon: <AlertTriangle className="w-5 h-5 text-amber-600" />,
          buttonClass: 'bg-amber-500 hover:bg-amber-600 text-white shadow-xs',
        }
      case 'primary':
      default:
        return {
          iconBg: 'bg-slate-100 text-[#14274E] border border-slate-200',
          icon: <HelpCircle className="w-5 h-5 text-[#14274E]" />,
          buttonClass: 'bg-[#14274E] hover:bg-[#0f1f40] text-[#E9C46A] shadow-xs',
        }
    }
  }

  const styles = getVariantStyles()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 select-none">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between p-4 px-6 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl flex items-center justify-center ${styles.iconBg}`}>
              {styles.icon}
            </div>
            <h3 className="text-sm font-black text-[#14274E]">
              {title}
            </h3>
          </div>

          <button
            type="button"
            onClick={onCancel}
            className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <p className="text-xs text-slate-600 font-medium leading-relaxed">
            {message}
          </p>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-slate-100 bg-slate-50/80">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-2xs"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${styles.buttonClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
