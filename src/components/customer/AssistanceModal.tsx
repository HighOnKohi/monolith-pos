import { useState } from 'react'
import {
  X,
  Droplets,
  UserCheck,
  UtensilsCrossed,
  Receipt,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import type { AssistanceType, AssistanceRequest } from '@/types/assistance'
import { ASSISTANCE_OPTIONS } from '@/types/assistance'
import { sendAssistanceRequest, clearCachedTableAssistance } from '@/services/assistanceService'

interface AssistanceModalProps {
  tableId: number | null
  activeRequest: AssistanceRequest | null
  onClose: () => void
  onRequestSent: (req: AssistanceRequest) => void
  onRequestCleared: () => void
  onOpenBillOutModal?: () => void
  canBillOut?: boolean
}

const ICON_MAP = {
  Droplets,
  UserCheck,
  UtensilsCrossed,
  Receipt,
  MessageSquare,
}

export function AssistanceModal({
  tableId,
  activeRequest,
  onClose,
  onRequestSent,
  onRequestCleared,
  onOpenBillOutModal,
  canBillOut = false,
}: AssistanceModalProps) {
  const [selectedType, setSelectedType] = useState<AssistanceType>('WATER')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!tableId) {
      setErrorMessage('Table information is missing.')
      return
    }

    // If BILL_OUT, user might prefer the dedicated bill out payment modal
    if (selectedType === 'BILL_OUT') {
      if (!canBillOut) {
        setErrorMessage('Bill out is available once all dishes are served.')
        return
      }
      if (onOpenBillOutModal) {
        onClose()
        onOpenBillOutModal()
        return
      }
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const req = await sendAssistanceRequest(tableId, selectedType, notes)
      onRequestSent(req)
      setNotes('')
    } catch (err) {
      console.error(err)
      setErrorMessage('Failed to send request. Please alert a nearby staff member.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancelActive = () => {
    if (tableId) clearCachedTableAssistance(tableId)
    onRequestCleared()
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#14274E]/45 backdrop-blur-md animate-backdrop-fade"
        onClick={onClose}
      />

      {/* Modal / Bottom Sheet */}
      <div className="relative w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl z-10 max-h-[90vh] overflow-y-auto animate-sheet-up sm:animate-modal-pop">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#9BA4B4]/15">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#E9C46A]/20 flex items-center justify-center text-[#14274E]">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-[#14274E] tracking-tight">
                Table Assistance
              </h3>
              <p className="text-xs text-[#394867] font-medium">
                {tableId ? `Table ${tableId}` : 'Customer Station'} • Quick Staff Request
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-[#F1F6F9] text-[#9BA4B4] active:scale-90 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Existing Active Request Notification */}
        {activeRequest && (
          <div className="mt-4 p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-amber-900 uppercase tracking-wide">
                Active Staff Alert
              </p>
              <p className="text-sm font-extrabold text-amber-950 mt-0.5">
                {activeRequest.title}
              </p>
              {activeRequest.notes && (
                <p className="text-xs text-amber-800 mt-1 italic">
                  "{activeRequest.notes}"
                </p>
              )}
              <p className="text-[11px] text-amber-700 mt-1">
                Requested at {new Date(activeRequest.requestedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. A staff member is on the way.
              </p>
              <button
                onClick={handleCancelActive}
                className="mt-2 text-xs font-bold text-amber-800 underline hover:text-amber-950"
              >
                Clear / Make new request
              </button>
            </div>
          </div>
        )}

        {/* Request Options Grid */}
        <div className="mt-4">
          <label className="text-xs font-bold uppercase tracking-wider text-[#394867] mb-2 block">
            What can we assist you with?
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {ASSISTANCE_OPTIONS.map((opt) => {
              const Icon = ICON_MAP[opt.icon as keyof typeof ICON_MAP] || MessageSquare
              const isSelected = selectedType === opt.type
              const isBillOut = opt.type === 'BILL_OUT'
              const isDisabled = isBillOut && !canBillOut

              return (
                <button
                  key={opt.type}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => {
                    if (isDisabled) return
                    setSelectedType(opt.type)
                  }}
                  title={isDisabled ? 'Bill out available once all dishes are served' : undefined}
                  className={[
                    'p-3.5 rounded-2xl border text-left transition-all duration-200 flex items-start gap-3',
                    isDisabled
                      ? 'opacity-40 bg-[#F1F6F9]/80 border-[#9BA4B4]/20 cursor-not-allowed select-none'
                      : isSelected
                      ? 'border-[#14274E] bg-[#14274E]/5 ring-2 ring-[#14274E]/20 shadow-xs interactive-card cursor-pointer'
                      : 'border-[#9BA4B4]/30 hover:border-[#14274E]/40 bg-white shadow-2xs interactive-card cursor-pointer',
                  ].join(' ')}
                >
                  <div
                    className={[
                      'w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors',
                      isDisabled
                        ? 'bg-[#9BA4B4]/15 text-[#9BA4B4]'
                        : isSelected
                        ? 'bg-[#14274E] text-[#E9C46A]'
                        : 'bg-[#F1F6F9] text-[#14274E]',
                    ].join(' ')}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1.5">
                      <span
                        className={[
                          'text-sm font-extrabold block truncate',
                          isDisabled ? 'text-[#9BA4B4]' : 'text-[#14274E]',
                        ].join(' ')}
                      >
                        {opt.title}
                      </span>
                      {isDisabled && (
                        <span className="text-[9px] font-black uppercase tracking-wider bg-[#9BA4B4]/15 text-[#9BA4B4] px-1.5 py-0.5 rounded-md shrink-0">
                          Unavailable
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-[#9BA4B4] leading-tight block mt-0.5 line-clamp-2">
                      {isDisabled ? 'Available once all active dishes are served' : opt.description}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Notes input */}
        <div className="mt-4">
          <label className="text-xs font-bold uppercase tracking-wider text-[#394867] mb-1.5 block">
            Additional notes (optional)
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={
              selectedType === 'WATER'
                ? 'e.g. Pitcher with extra ice and 3 glasses'
                : selectedType === 'UTENSILS'
                ? 'e.g. 2 forks, extra napkins and soy sauce'
                : 'e.g. Please send a server to our table'
            }
            maxLength={150}
            className="w-full px-3.5 py-2.5 rounded-xl border border-[#9BA4B4]/40 text-sm text-[#14274E] placeholder-[#9BA4B4] focus:outline-hidden focus:border-[#14274E] focus:ring-2 focus:ring-[#14274E]/20 transition-all"
          />
        </div>

        {errorMessage && (
          <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200 flex items-center gap-2 text-xs font-bold text-red-700 animate-fade-in">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Action Button */}
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-xl border border-[#9BA4B4]/40 text-sm font-bold text-[#394867] hover:bg-[#F1F6F9] active:scale-95 transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleSubmit}
            className="flex-1 py-3 px-4 rounded-xl bg-[#14274E] hover:bg-[#14274E]/95 text-white text-sm font-extrabold interactive-button flex items-center justify-center gap-2 shadow-sm disabled:opacity-60 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Sending...</span>
              </>
            ) : (
              <span>Notify Staff</span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
