import { useState } from 'react'
import { AlertTriangle, Lock, Trash2, X, Loader2 } from 'lucide-react'
import { clearAnalyticsData } from '@/services/analyticsService'

interface ClearDataModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (deletedCount: number) => void
}

export function ClearDataModal({ isOpen, onClose, onSuccess }: ClearDataModalProps) {
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [typedPhrase, setTypedPhrase] = useState('')
  const [confirmedRisk, setConfirmedRisk] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  if (!isOpen) return null

  const isConfirmed = typedPhrase.trim() === 'CLEAR DATA' && confirmedRisk
  const canSubmit = !loading && isConfirmed && adminEmail.trim() !== '' && adminPassword !== ''

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return

    setLoading(true)
    setErrorMsg(null)

    try {
      const result = await clearAnalyticsData(adminEmail, adminPassword)
      onSuccess(result.deletedOrdersCount)
      onClose()
    } catch (err: unknown) {
      console.error('[ClearDataModal] Error clearing analytics data:', err)
      const msg = err instanceof Error ? err.message : 'Authentication or deletion failed.'
      setErrorMsg(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-rose-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-rose-50 px-5 py-4 border-b border-rose-100 flex items-center justify-between">
          <div className="flex items-center gap-2 text-rose-700">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <span className="font-extrabold text-sm tracking-tight">Clear Analytics Data</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-white/80 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {/* Warning Banner */}
          <div className="p-3 bg-rose-50/70 border border-rose-200 rounded-xl text-rose-800 leading-relaxed space-y-1">
            <p className="font-bold text-[11px] text-rose-900">
              WARNING: Destructive Administrative Action
            </p>
            <p className="text-[11px]">
              This will permanently purge all <strong>Completed</strong> and <strong>Cancelled</strong> orders
              and their child items from the database. This action cannot be undone. Active dining orders will not be affected.
            </p>
          </div>

          {errorMsg && (
            <div className="p-2.5 bg-rose-100/80 border border-rose-300 rounded-xl text-rose-800 font-semibold text-[11px]">
              {errorMsg}
            </div>
          )}

          {/* Admin Credentials */}
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center gap-1.5 text-slate-700 font-bold text-[11px]">
              <Lock className="w-3.5 h-3.5 text-slate-500" />
              <span>Admin Authentication Required</span>
            </div>

            <div>
              <label className="block text-slate-600 font-semibold mb-1 text-[11px]">
                Administrator Email
              </label>
              <input
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="admin@example.com"
                required
                disabled={loading}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>

            <div>
              <label className="block text-slate-600 font-semibold mb-1 text-[11px]">
                Administrator Password
              </label>
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={loading}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>
          </div>

          {/* Confirmation Checkbox */}
          <label className="flex items-start gap-2 pt-1 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={confirmedRisk}
              onChange={(e) => setConfirmedRisk(e.target.checked)}
              disabled={loading}
              className="mt-0.5 rounded text-rose-600 focus:ring-rose-500"
            />
            <span className="text-slate-600 text-[11px] leading-snug">
              I understand that historical analytics, revenue reports, and completed order records will be permanently deleted.
            </span>
          </label>

          {/* Confirmation Input: CLEAR DATA */}
          <div>
            <label className="block text-slate-700 font-bold mb-1 text-[11px]">
              Type <span className="font-mono text-rose-600 bg-rose-50 px-1 py-0.5 rounded">CLEAR DATA</span> to confirm
            </label>
            <input
              type="text"
              value={typedPhrase}
              onChange={(e) => setTypedPhrase(e.target.value)}
              placeholder="CLEAR DATA"
              disabled={loading}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Clearing Data...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Permanently Clear Data</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
