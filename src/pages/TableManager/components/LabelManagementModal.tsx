import React from 'react'
import { LabelHierarchyManager } from './LabelHierarchyManager'

interface LabelManagementModalProps {
  isOpen: boolean
  onClose: () => void
}

export const LabelManagementModal: React.FC<LabelManagementModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-3xl max-h-[90vh] bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
        <div className="flex-1 overflow-y-auto">
          <LabelHierarchyManager isModal onClose={onClose} />
        </div>
      </div>
    </div>
  )
}
