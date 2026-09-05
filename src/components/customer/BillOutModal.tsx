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
      <div className="fixed inset-0 z-40 bg-[#14274E]/30 backdrop-blur-sm" onClick={onClose} />

      <div className="fixed bottom-0 inset-x-0 z-50 bg-white rounded-t-3xl shadow-2xl flex flex-col">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-[#9BA4B4]/40 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#9BA4B4]/15">
          <h3 className="text-lg font-extrabold text-[#14274E]">Request Bill</h3>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full text-[#9BA4B4] hover:bg-[#F1F6F9] active:scale-95 transition-all"
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
                    'w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all min-h-[64px]',
                    isSelected
                      ? 'border-[#14274E] bg-[#F1F6F9]'
                      : 'border-[#9BA4B4]/20 hover:border-[#14274E]/30'
                  ].join(' ')}
                >
                  <div className={[
                    'w-10 h-10 rounded-full flex items-center justify-center',
                    isSelected ? 'bg-[#14274E] text-white' : 'bg-[#F1F6F9] text-[#9BA4B4]'
                  ].join(' ')}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className={['font-bold', isSelected ? 'text-[#14274E]' : 'text-[#394867]'].join(' ')}>
                    {pm.label}
                  </span>
                  {isSelected && (
                    <div className="ml-auto w-5 h-5 rounded-full border-2 border-[#14274E] flex items-center justify-center">
                      <div className="w-2.5 h-2.5 bg-[#E9C46A] rounded-full" />
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          <button
            onClick={() => selected && onRequest(selected)}
            disabled={!selected || isSubmitting}
            className="w-full bg-[#14274E] text-white h-[56px] rounded-2xl font-extrabold text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirm Request'}
          </button>
        </div>
      </div>
    </>
  )
}
