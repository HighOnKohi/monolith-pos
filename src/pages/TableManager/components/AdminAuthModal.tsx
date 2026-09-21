import React, { useState } from 'react'
import { ShieldAlert, X, Lock, KeyRound } from 'lucide-react'
import { verifyAdminPassword } from '@/services/authVerificationService'
import { useAuth } from '@/hooks/useAuth'

interface AdminAuthModalProps {
  isOpen: boolean
  title?: string
  description?: string
  onClose: () => void
  onSuccess: () => void
}

export const AdminAuthModal: React.FC<AdminAuthModalProps> = ({
  isOpen,
  title = 'Administrator Authorization Required',
  description = 'Modifying or resetting protected layout presets requires administrative authorization.',
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth()
  const [password, setPassword] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password.trim()) {
      setError('Please enter the administrator password.')
      return
    }

    setIsVerifying(true)
    setError(null)

    try {
      const res = await verifyAdminPassword(password, user?.email)
      if (res.valid) {
        setPassword('')
        setError(null)
        onSuccess()
      } else {
        setError(res.error || 'Invalid administrator password.')
      }
    } catch (err) {
      setError((err as Error).message || 'Authorization failed.')
    } finally {
      setIsVerifying(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 px-6 border-b border-slate-100 bg-amber-50/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-600 text-white">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-[#14274E]">{title}</h3>
              <p className="text-[11px] font-semibold text-slate-500">Security Gate</p>
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-xs font-medium text-slate-600 leading-relaxed">
            {description}
          </p>

          {error && (
            <div className="p-3 text-xs font-bold text-rose-600 bg-rose-50 rounded-xl border border-rose-200">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Admin Password
            </label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin password..."
                className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#14274E]/20 focus:bg-white transition-all"
                autoFocus
              />
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isVerifying || !password.trim()}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-black text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-xs transition-all disabled:opacity-50"
            >
              <KeyRound className="w-3.5 h-3.5" />
              {isVerifying ? 'Verifying...' : 'Authorize'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
