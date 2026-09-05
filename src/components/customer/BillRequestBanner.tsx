import { Receipt, Loader2, CheckCircle2 } from 'lucide-react'
import type { BillRequest } from '@/types/bill'
import { PAYMENT_METHOD_LABEL } from '@/types/bill'

interface BillRequestBannerProps {
  billRequest: BillRequest | null
}

export function BillRequestBanner({ billRequest }: BillRequestBannerProps) {
  if (!billRequest || billRequest.status === 'PAID' || billRequest.status === 'CANCELLED') return null

  const isProcessing = billRequest.status === 'PROCESSING'

  return (
    <div className="fixed top-20 inset-x-4 z-20 animate-in slide-in-from-top-4 fade-in duration-300">
      <div className="bg-[#14274E] text-white rounded-2xl p-4 shadow-lg flex items-start gap-4">
        <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0">
          <Receipt className="w-5 h-5 text-[#E9C46A]" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <h4 className="font-extrabold text-white text-sm">
              Bill Requested
            </h4>
            <span className="flex items-center gap-1.5 text-xs font-bold text-[#E9C46A] bg-white/10 px-2 py-0.5 rounded-full">
              {isProcessing ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Processing
                </>
              ) : (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Pending
                </>
              )}
            </span>
          </div>
          <p className="text-xs text-white/80 font-medium leading-relaxed">
            Payment method: <strong className="text-white">{PAYMENT_METHOD_LABEL[billRequest.paymentMethod]}</strong>
            <br />
            A cashier will assist you shortly.
          </p>
        </div>
      </div>
    </div>
  )
}
