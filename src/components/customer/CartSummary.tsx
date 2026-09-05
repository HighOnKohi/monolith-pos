import { ArrowRight, Loader2 } from 'lucide-react'
import type { DiningType } from '@/types/cart'
import { DiningTypeSelector } from './DiningTypeSelector'

interface CartSummaryProps {
  itemCount: number
  total: number
  diningType: DiningType
  onDiningTypeChange: (type: DiningType) => void
  onPlaceOrder: () => void
  isSubmitting?: boolean
}

export function CartSummary({
  itemCount,
  total,
  diningType,
  onDiningTypeChange,
  onPlaceOrder,
  isSubmitting = false,
}: CartSummaryProps) {
  if (itemCount === 0) return null

  return (
    <div className="fixed bottom-[72px] inset-x-0 z-30 px-4 pointer-events-none animate-slide-up">
      <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgba(0,0,0,0.16)] border border-[#9BA4B4]/20 p-4 pointer-events-auto transition-all duration-200">
        
        {/* Dining Type Toggle */}
        <div className="mb-4">
          <DiningTypeSelector value={diningType} onChange={onDiningTypeChange} />
        </div>

        {/* Order Details & Checkout */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold text-[#9BA4B4] uppercase tracking-wider mb-0.5">
              {itemCount} {itemCount === 1 ? 'Item' : 'Items'}
            </p>
            <p className="text-lg font-extrabold text-[#14274E] leading-none">
              ₱{total.toFixed(2)}
            </p>
            <p className="text-[10px] font-medium text-[#9BA4B4] mt-1">
              INCLUDES 5% TAX
            </p>
          </div>
          
          <button
            onClick={onPlaceOrder}
            disabled={isSubmitting}
            className="flex-1 bg-[#E9C46A] hover:bg-[#d6b35d] text-[#14274E] h-[52px] rounded-2xl font-extrabold text-base flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-70"
          >
            {isSubmitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                Place Order
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
