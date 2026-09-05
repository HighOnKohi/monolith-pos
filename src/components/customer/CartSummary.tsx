import { ArrowRight, Loader2 } from 'lucide-react'

interface CartSummaryProps {
  itemCount: number
  total: number
  onPlaceOrder: () => void
  onClear?: () => void
  isSubmitting?: boolean
}

export function CartSummary({
  itemCount,
  total,
  onPlaceOrder,
  onClear,
  isSubmitting = false,
}: CartSummaryProps) {
  if (itemCount === 0) return null

  return (
    <div className="fixed bottom-[84px] inset-x-0 z-50 px-3.5 sm:px-4 pointer-events-none animate-slide-up">
      <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-[0_10px_35px_rgba(20,39,78,0.2)] border border-[#9BA4B4]/25 p-3 sm:p-3.5 max-w-lg mx-auto pointer-events-auto transition-all duration-200">
        <div className="flex items-center justify-between gap-3">
          {/* Order info: Item Count, Clear Action & Pricing */}
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black text-[#9BA4B4] uppercase tracking-wider">
                {itemCount} {itemCount === 1 ? 'Item' : 'Items'}
              </span>
              {onClear && (
                <button
                  type="button"
                  onClick={onClear}
                  className="text-[11px] font-bold text-[#C94A4A] hover:underline cursor-pointer transition-colors"
                  title="Clear Cart"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-lg sm:text-xl font-black text-[#14274E] leading-none">
                ₱{total.toFixed(2)}
              </span>
              <span className="text-[10px] font-bold text-[#9BA4B4]">
                INCL. 5% TAX
              </span>
            </div>
          </div>

          {/* Place Order CTA Button */}
          <button
            onClick={onPlaceOrder}
            disabled={isSubmitting}
            className="flex-1 max-w-[200px] bg-[#E9C46A] hover:bg-[#d6b35d] text-[#14274E] h-[48px] rounded-xl font-black text-sm flex items-center justify-center gap-2 interactive-button shadow-sm hover:shadow-md hover:shadow-amber-500/25 disabled:opacity-70 cursor-pointer transition-all active:scale-95"
          >
            {isSubmitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <span>Place Order</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
