import React, { useState, useEffect } from 'react'
import {
  X,
  AlertCircle,
  KeyRound,
  User,
  ChefHat,
  Store,
  UtensilsCrossed,
  Sparkles,
  Check,
} from 'lucide-react'
import type { StaffCodeItem, StaffCodeFormData, StaffRole, CodeStatus } from '@/types/account'
import { ROLE_DEFINITIONS } from '@/types/account'
import { suggestNextCode } from '@/services/staffCodeService'

export type DrawerMode = 'create' | 'edit'

interface StaffDrawerProps {
  isOpen: boolean
  mode: DrawerMode
  codeItem: StaffCodeItem | null
  onClose: () => void
  onSave: (data: StaffCodeFormData, originalCodeId?: number) => Promise<void>
}

export const StaffDrawer: React.FC<StaffDrawerProps> = ({
  isOpen,
  mode,
  codeItem,
  onClose,
  onSave,
}) => {
  // Form State
  const [staffName, setStaffName] = useState('')
  const [codeId, setCodeId] = useState<string>('')
  const [staffRole, setStaffRole] = useState<StaffRole>('DISPATCHER')
  const [codeStatus, setCodeStatus] = useState<CodeStatus>('ACTIVE')

  // UI State
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSuggesting, setIsSuggesting] = useState(false)

  // ESC key listener
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  // Populate form on open or switch
  useEffect(() => {
    if (!isOpen) return
    setFormError(null)

    if (mode === 'create') {
      setStaffName('')
      setStaffRole('DISPATCHER')
      setCodeStatus('ACTIVE')
      // Auto-suggest next code
      suggestNextCode().then((next) => setCodeId(String(next)))
    } else if (codeItem) {
      setStaffName(codeItem.staffName)
      setCodeId(String(codeItem.codeId))
      setStaffRole(codeItem.staffRole)
      setCodeStatus(codeItem.codeStatus || codeItem.status || 'ACTIVE')
    }
  }, [isOpen, mode, codeItem])

  const handleSuggestNext = async () => {
    setIsSuggesting(true)
    try {
      const next = await suggestNextCode()
      setCodeId(String(next))
    } finally {
      setIsSuggesting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    const trimmedName = staffName.trim()
    if (!trimmedName) {
      setFormError('Please enter a staff member name.')
      return
    }

    const numericCode = Number(codeId)
    if (!codeId || isNaN(numericCode) || numericCode <= 0) {
      setFormError('Please enter a valid numeric staff code (e.g. 1001).')
      return
    }

    setSubmitting(true)
    try {
      await onSave(
        {
          codeId: numericCode,
          staffName: trimmedName,
          staffRole,
          codeStatus,
          status: codeStatus,
        },
        mode === 'edit' && codeItem ? codeItem.codeId : undefined,
      )
      onClose()
    } catch (err: unknown) {
      console.error('[StaffDrawer] Save error:', err)
      setFormError(err instanceof Error ? err.message : 'Failed to save staff code.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen) return null

  const rolesList: StaffRole[] = ['DISPATCHER', 'SERVICE', 'CASHIER']

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs transition-opacity animate-in fade-in duration-200"
      />

      {/* Drawer Container */}
      <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-250 border-l border-slate-200">
        {/* Drawer Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#14274E] text-[#E9C46A] flex items-center justify-center font-bold">
                <KeyRound className="w-4 h-4" />
              </div>
              <h2 className="text-base font-extrabold text-[#14274E]">
                {mode === 'create' ? 'Add Staff Code' : 'Edit Staff Code'}
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 ml-10">
              Assign a numeric staff code and operational role for terminal access.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Body Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          {/* 1. Staff Name */}
          <div className="space-y-1.5">
            <label className="block text-xs font-black uppercase tracking-wider text-slate-500">
              Staff Member Name <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                required
                value={staffName}
                onChange={(e) => setStaffName(e.target.value)}
                placeholder="e.g. Juan Dela Cruz"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#14274E] focus:bg-white transition-all font-semibold"
              />
            </div>
          </div>

          {/* 2. Staff Code */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-black uppercase tracking-wider text-slate-500">
                Staff Code (PIN) <span className="text-rose-500">*</span>
              </label>
              <button
                type="button"
                onClick={handleSuggestNext}
                disabled={isSuggesting}
                className="text-[11px] font-bold text-[#14274E] hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="w-3 h-3 text-[#E9C46A]" />
                <span>Suggest Next</span>
              </button>
            </div>
            <div className="relative">
              <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="number"
                required
                min={1}
                step={1}
                value={codeId}
                onChange={(e) => setCodeId(e.target.value)}
                placeholder="e.g. 1001"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-xs font-mono font-black text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#14274E] focus:bg-white transition-all"
              />
            </div>
            <p className="text-[11px] text-slate-400">
              Unique numeric code entered by this staff member to unlock their operational interface.
            </p>
          </div>

          {/* 3. Role Selector */}
          <div className="space-y-2">
            <label className="block text-xs font-black uppercase tracking-wider text-slate-500">
              Assigned Operational Role <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-1 gap-2">
              {rolesList.map((rKey) => {
                const isSelected = staffRole === rKey
                const meta = ROLE_DEFINITIONS[rKey]
                let Icon = ChefHat
                if (rKey === 'SERVICE') Icon = UtensilsCrossed
                if (rKey === 'CASHIER') Icon = Store

                return (
                  <button
                    key={rKey}
                    type="button"
                    onClick={() => setStaffRole(rKey)}
                    className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[#14274E] bg-[#14274E]/5 ring-1 ring-[#14274E]'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${meta.badgeBg} ${meta.badgeText}`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-xs text-[#14274E]">
                          {meta.label}
                        </span>
                        {isSelected && (
                          <div className="w-4 h-4 rounded-full bg-[#14274E] text-[#E9C46A] flex items-center justify-center">
                            <Check className="w-2.5 h-2.5" />
                          </div>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                        {meta.description}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 4. Code Status Toggle */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <label className="block text-xs font-black uppercase tracking-wider text-slate-500">
              Account Status
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCodeStatus('ACTIVE')}
                className={`py-2 px-3 rounded-xl border text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  codeStatus === 'ACTIVE'
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-400'
                    : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-white'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Active</span>
              </button>
              <button
                type="button"
                onClick={() => setCodeStatus('INACTIVE')}
                className={`py-2 px-3 rounded-xl border text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  codeStatus === 'INACTIVE'
                    ? 'border-slate-400 bg-slate-100 text-slate-800 ring-1 ring-slate-400'
                    : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-white'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-slate-400" />
                <span>Inactive</span>
              </button>
            </div>
          </div>

          {/* Form Actions */}
          <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-[#14274E] hover:bg-[#1a3468] text-white text-xs font-black shadow-xs active:scale-98 transition-all cursor-pointer disabled:opacity-50"
            >
              {submitting ? 'Saving...' : mode === 'create' ? 'Create Staff Code' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
