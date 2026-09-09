import logo from '@/assets/images/monolith-logo-nobg.png'
import { ShoppingBag, Clock, User, Edit3 } from 'lucide-react'

interface AdvanceOrderHeaderProps {
  customerName?: string
  onEditName?: () => void
  cartItemCount?: number
  onOpenCart?: () => void
  hasActiveOrder?: boolean
  countdownFormatted?: string
  onOpenOrderTab?: () => void
}

export function AdvanceOrderHeader({
  customerName,
  onEditName,
  cartItemCount = 0,
  onOpenCart,
  hasActiveOrder = false,
  countdownFormatted,
  onOpenOrderTab,
}: AdvanceOrderHeaderProps) {
  return (
    <div className="flex items-center justify-between px-3 sm:px-4 pt-3 sm:pt-4 pb-2.5 sm:pb-3 bg-[#F1F6F9] w-full max-w-full min-w-0 gap-2">
      {/* Brand & Customer Tag */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink">
        <img
          src={logo}
          alt="Monolith logo"
          className="h-9 w-9 sm:h-11 sm:w-11 object-contain shrink-0"
        />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h1 className="text-base sm:text-lg font-extrabold text-[#14274E] tracking-tight leading-tight truncate">
              MONOLITH
            </h1>
            <span className="px-1.5 py-0.5 rounded-md bg-[#14274E] text-[#E9C46A] text-[9px] font-black uppercase tracking-wider shrink-0">
              Advance
            </span>
          </div>

          {customerName ? (
            <button
              type="button"
              onClick={onEditName}
              className="group flex items-center gap-1 text-[11px] font-bold text-[#394867] hover:text-[#14274E] transition-colors truncate text-left cursor-pointer"
              title="Click to edit name"
            >
              <User className="w-3 h-3 text-slate-400 group-hover:text-[#14274E]" />
              <span className="truncate">{customerName}</span>
              {onEditName && <Edit3 className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />}
            </button>
          ) : (
            <p className="text-[10px] sm:text-xs font-medium text-[#394867] truncate">
              Pre-Order Station
            </p>
          )}
        </div>
      </div>

      {/* Right controls: Active Order Timer Button + Cart Button */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* If an active order is ticking, show a live pill that jumps to the Order tab */}
        {hasActiveOrder && onOpenOrderTab && (
          <button
            type="button"
            onClick={onOpenOrderTab}
            className="px-2.5 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 font-extrabold text-xs flex items-center gap-1.5 hover:bg-amber-500/20 active:scale-95 transition-all cursor-pointer shadow-2xs"
            title="View Active Order"
          >
            <Clock className="w-3.5 h-3.5 text-amber-600 animate-spin" style={{ animationDuration: '8s' }} />
            <span className="font-mono text-xs font-black">{countdownFormatted || 'Active'}</span>
          </button>
        )}

        {/* Cart Drawer Trigger */}
        {onOpenCart && cartItemCount > 0 && (
          <button
            type="button"
            onClick={onOpenCart}
            className="p-2 rounded-xl border border-[#14274E]/20 bg-white text-[#14274E] hover:bg-[#F1F6F9] transition-all duration-150 flex items-center justify-center relative active:scale-95 cursor-pointer shrink-0 shadow-2xs"
            title="View Current Cart"
            aria-label="View Current Cart"
          >
            <ShoppingBag className="w-4 h-4 text-[#14274E]" />
            <span className="absolute -top-1.5 -right-1.5 bg-[#E9C46A] text-[#14274E] text-[10px] font-black w-4 h-4 flex items-center justify-center rounded-full ring-2 ring-white shadow-xs">
              {cartItemCount}
            </span>
          </button>
        )}
      </div>
    </div>
  )
}
