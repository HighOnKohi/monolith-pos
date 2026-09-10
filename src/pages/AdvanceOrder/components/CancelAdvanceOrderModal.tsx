import { useState } from 'react'
import { AlertOctagon, X, Loader2 } from 'lucide-react'

interface CancelAdvanceOrderModalProps {
  isOpen: boolean
  orderNumber: string
  onClose: () => void
  onConfirmCancel: (reason: string) => Promise<void>
}

const COMMON_REASONS = [
  'Change of plans / Can no longer make it',
  'Need to change items in order',
  'Ordered by mistake',
  'Expected dining time changed',
  'Other',
]

export function CancelAdvanceOrderModal({
  isOpen,
  orderNumber,
  onClose,
  onConfirmCancel,
}: CancelAdvanceOrderModalProps) {
  const [selectedReason, setSelectedReason] = useState<string>(COMMON_REASONS[0])
  const [customNote, setCustomNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleConfirm = async () => {
    setIsSubmitting(true)
    setError(null)
    try {
      const finalReason =
        selectedReason === 'Other'
          ? customNote.trim() || 'Other'
          : customNote.trim()
            ? `${selectedReason}: ${customNote.trim()}`
            : selectedReason

      await onConfirmCancel(finalReason)
      onClose()
    } catch (err) {
      console.error('[CancelAdvanceOrderModal] Failed to cancel order:', err)
      setError(err instanceof Error ? err.message : 'Failed to cancel order.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden p-6 sm:p-7 animate-in zoom-in-95 duration-150 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 shadow-2xs border border-rose-100">
              <AlertOctagon className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 leading-tight">
                Cancel Advance Order?
              </h3>
              <p className="text-xs font-mono font-bold text-[#14274E]">
                Reference: {orderNumber}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Warning text */}
        <div className="p-3.5 bg-rose-50/70 border border-rose-200/80 rounded-2xl text-xs text-rose-900 leading-relaxed">
          Cancelling will permanently release this pre-order and immediately stop the 30-minute confirmation window.
        </div>

        {/* Reason options */}
        <div className="space-y-2">
          <label className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">
            Reason for Cancellation
          </label>
          <div className="space-y-1.5">
            {COMMON_REASONS.map((r) => (
              <label
                key={r}
                className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                  selectedReason === r
                    ? 'border-rose-400 bg-rose-50/50 text-rose-950 ring-1 ring-rose-400/30'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="cancellation-reason"
                  value={r}
                  checked={selectedReason === r}
                  onChange={() => setSelectedReason(r)}
                  className="text-rose-600 focus:ring-rose-500 cursor-pointer"
                />
                <span>{r}</span>
              </label>
            ))}
          </div>

          {selectedReason === 'Other' && (
            <textarea
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              placeholder="Please provide details..."
              rows={2}
              maxLength={200}
              className="w-full mt-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500/20 resize-none"
            />
          )}
        </div>

        {error && (
          <p className="text-xs font-bold text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-200">
            {error}
          </p>
        )}

        {/* Actions */}
        <div className="pt-2 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2.5 text-xs font-extrabold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            Keep My Order
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Cancelling…</span>
              </>
            ) : (
              <span>Confirm Cancellation</span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
