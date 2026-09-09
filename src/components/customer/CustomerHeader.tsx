import logo from '@/assets/images/monolith-logo-nobg.png'
import { TableBadge } from './TableBadge'
import { BellRing, ReceiptText, ShoppingBag } from 'lucide-react'

interface CustomerHeaderProps {
  tableLabel: string
  onOpenAssist?: () => void
  hasActiveAssist?: boolean
  onOpenOrders?: () => void
  activeOrderCount?: number
  hasOrderStatusChange?: boolean
  cartItemCount?: number
  onOpenCart?: () => void
}

export function CustomerHeader({
  tableLabel,
  onOpenAssist,
  hasActiveAssist,
  onOpenOrders,
  activeOrderCount = 0,
  hasOrderStatusChange = false,
  cartItemCount = 0,
  onOpenCart,
}: CustomerHeaderProps) {
  return (
    <div className="flex items-center justify-between px-3 sm:px-4 pt-3 sm:pt-4 pb-2.5 sm:pb-3 bg-[#F1F6F9] w-full max-w-full min-w-0 gap-2">
      {/* Brand */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink">
        <img
          src={logo}
          alt="Monolith logo"
          className="h-9 w-9 sm:h-11 sm:w-11 object-contain shrink-0"
        />
        <div className="min-w-0">
          <h1 className="text-base sm:text-lg font-extrabold text-[#14274E] tracking-tight leading-tight truncate">
            MONOLITH
          </h1>
          <p className="text-[10px] sm:text-xs font-medium text-[#394867] truncate">Order Station</p>
        </div>
      </div>

      {/* Right controls: Cart + Orders + Assist + Table badge */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {onOpenCart && cartItemCount > 0 && (
          <button
            onClick={onOpenCart}
            className="p-1.5 sm:p-2 rounded-full border border-[#14274E]/20 bg-white text-[#14274E] hover:bg-[#F1F6F9] transition-all duration-150 flex items-center justify-center relative active:scale-95 cursor-pointer shrink-0 shadow-2xs"
            title="View Current Cart"
            aria-label="View Current Cart"
          >
            <ShoppingBag className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#14274E]" />
            <span className="absolute -top-1 -right-1 bg-[#E9C46A] text-[#14274E] text-[9px] font-black w-4 h-4 flex items-center justify-center rounded-full ring-2 ring-white shadow-xs">
              {cartItemCount}
            </span>
          </button>
        )}
        {onOpenOrders && (
          <button
            onClick={onOpenOrders}
            className={[
              'p-1.5 sm:p-2 rounded-full border transition-all duration-150 flex items-center justify-center relative active:scale-95 cursor-pointer shrink-0',
              hasOrderStatusChange
                ? 'bg-red-50 text-red-600 border-red-300 animate-pulse shadow-xs'
                : 'bg-white text-[#14274E] border-[#9BA4B4]/30 hover:bg-[#F1F6F9]',
            ].join(' ')}
            title="View Orders"
            aria-label="View Orders"
          >
            <ReceiptText className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            {activeOrderCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-[#C94A4A] text-white text-[9px] font-black w-4 h-4 flex items-center justify-center rounded-full ring-2 ring-white shadow-xs">
                {activeOrderCount}
              </span>
            )}
            {hasOrderStatusChange && !activeOrderCount && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-white animate-ping" />
            )}
          </button>
        )}

        {onOpenAssist && (
          <button
            onClick={onOpenAssist}
            className={[
              'p-1.5 sm:p-2 rounded-full border transition-all duration-150 flex items-center justify-center relative active:scale-95 cursor-pointer shrink-0',
              hasActiveAssist
                ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                : 'bg-white text-[#14274E] border-[#9BA4B4]/30 hover:bg-[#F1F6F9]',
            ].join(' ')}
            title="Request Table Assistance"
            aria-label="Request Table Assistance"
          >
            <BellRing className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            {hasActiveAssist && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-white animate-ping" />
            )}
          </button>
        )}
        <TableBadge tableLabel={tableLabel} />
      </div>
    </div>
  )
}
