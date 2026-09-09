import { ArrowRight, Loader2, Lock } from 'lucide-react'
import type { DiningType } from '@/types/cart'
import { DiningTypeSelector } from './DiningTypeSelector'

interface CartSummaryProps {
  itemCount: number
  total: number
  diningType: DiningType
  onDiningTypeChange: (type: DiningType) => void
  onPlaceOrder: () => void
  onClear?: () => void
  isSubmitting?: boolean
  /** True when another device at this table is currently placing an order */
  isLockedByOther?: boolean
}

export function CartSummary({
  itemCount,
  total,
  diningType,
  onDiningTypeChange,
  onPlaceOrder,
  onClear,
  isSubmitting = false,
  isLockedByOther = false,
}: CartSummaryProps) {
  if (itemCount === 0) return null

  const isDisabled = isSubmitting || isLockedByOther

  return (
    <div className="fixed bottom-[84px] inset-x-0 z-50 px-3.5 sm:px-4 pointer-events-none animate-slide-up">
      <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-[0_10px_35px_rgba(20,39,78,0.2)] border border-[#9BA4B4]/25 p-3 sm:p-3.5 max-w-lg mx-auto pointer-events-auto transition-all duration-200">
        {/* Locked-by-other banner */}
        {isLockedByOther && (
          <div className="flex items-center gap-1.5 mb-2 px-2 py-1.5 bg-amber-50 border border-amber-200 rounded-xl">
            <Lock className="w-3 h-3 text-amber-600 shrink-0" />
            <span className="text-[11px] font-bold text-amber-800">
              Someone at your table is placing this order…
            </span>
          </div>
        )}

        {/* Dining Type Selector */}
        <div className="mb-2.5">
          <DiningTypeSelector
            value={diningType}
            onChange={onDiningTypeChange}
            disabled={isDisabled}
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          {/* Order info: Item Count, Clear Action & Pricing */}
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black text-[#9BA4B4] uppercase tracking-wider">
                {itemCount} {itemCount === 1 ? 'Item' : 'Items'}
              </span>
              {onClear && !isLockedByOther && (
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
            disabled={isDisabled}
            className="flex-1 max-w-[200px] bg-[#E9C46A] hover:bg-[#d6b35d] text-[#14274E] h-[48px] rounded-xl font-black text-sm flex items-center justify-center gap-2 interactive-button shadow-sm hover:shadow-md hover:shadow-amber-500/25 disabled:opacity-60 cursor-pointer transition-all active:scale-95"
          >
            {isSubmitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : isLockedByOther ? (
              <>
                <Lock className="w-4 h-4" />
                <span className="text-xs">Ordering…</span>
              </>
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
