import { useState, useEffect } from 'react'
import { X, Banknote, CreditCard, QrCode, Loader2 } from 'lucide-react'
import type { PaymentMethod } from '@/types/bill'

interface BillOutModalProps {
  onClose: () => void
  onRequest: (method: PaymentMethod) => Promise<void>
  isSubmitting: boolean
}

const paymentMethods: { id: PaymentMethod; label: string; icon: typeof Banknote }[] = [
  { id: 'CASH', label: 'Cash', icon: Banknote },
  { id: 'CREDIT_CARD', label: 'Credit Card', icon: CreditCard },
  { id: 'INSTAPAY_QR', label: 'InstaPay QR', icon: QrCode },
]

export function BillOutModal({ onClose, onRequest, isSubmitting }: BillOutModalProps) {
  const [selected, setSelected] = useState<PaymentMethod | null>(null)

  // Prevent background scrolling
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = 'auto' }
  }, [])

  return (
    <>
      <div className="fixed inset-0 z-[95] bg-[#14274E]/45 backdrop-blur-md animate-backdrop-fade" onClick={onClose} />

      <div className="fixed bottom-0 inset-x-0 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-full sm:max-w-lg z-[100] bg-white rounded-t-3xl sm:rounded-3xl sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 shadow-[0_-12px_40px_rgba(20,39,78,0.2)] flex flex-col animate-sheet-up sm:animate-modal-pop">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-[#9BA4B4]/40 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#9BA4B4]/15">
          <h3 className="text-lg font-extrabold text-[#14274E]">Request Bill</h3>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full text-[#9BA4B4] hover:bg-[#F1F6F9] active:scale-90 transition-all cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          <p className="text-sm font-bold text-[#394867] mb-4">
            How would you like to pay?
          </p>

          <div className="space-y-3 mb-6">
            {paymentMethods.map((pm) => {
              const Icon = pm.icon
              const isSelected = selected === pm.id
              return (
                <button
                  key={pm.id}
                  onClick={() => setSelected(pm.id)}
                  className={[
                    'w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all min-h-[64px] interactive-card cursor-pointer',
                    isSelected
                      ? 'border-[#14274E] bg-[#14274E]/5 ring-2 ring-[#14274E]/15 shadow-sm'
                      : 'border-[#9BA4B4]/20 hover:border-[#14274E]/30 bg-white'
                  ].join(' ')}
                >
                  <div className={[
                    'w-10 h-10 rounded-full flex items-center justify-center transition-colors',
                    isSelected ? 'bg-[#14274E] text-[#E9C46A]' : 'bg-[#F1F6F9] text-[#9BA4B4]'
                  ].join(' ')}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className={['font-extrabold text-sm', isSelected ? 'text-[#14274E]' : 'text-[#394867]'].join(' ')}>
                    {pm.label}
                  </span>
                  {isSelected && (
                    <div className="ml-auto w-5 h-5 rounded-full border-2 border-[#14274E] flex items-center justify-center animate-fade-in">
                      <div className="w-2.5 h-2.5 bg-[#14274E] rounded-full" />
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          <button
            onClick={() => selected && onRequest(selected)}
            disabled={!selected || isSubmitting}
            className="w-full bg-[#14274E] text-white h-[54px] rounded-2xl font-extrabold text-base flex items-center justify-center gap-2 interactive-button disabled:opacity-50 cursor-pointer shadow-sm"
          >
            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirm Request'}
          </button>
        </div>
      </div>
    </>
  )
}
