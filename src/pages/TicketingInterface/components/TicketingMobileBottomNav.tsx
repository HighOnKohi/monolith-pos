import React from 'react'
import { Utensils, ShoppingBag, Ticket } from 'lucide-react'

export type TicketingMobileTab = 'catalog' | 'cart'

interface TicketingMobileBottomNavProps {
  activeTab: TicketingMobileTab
  onTabChange: (tab: TicketingMobileTab) => void
  cartItemCount: number
  activeTicketId: number
  isCartExpanded: boolean
  onToggleCart: () => void
}

export const TicketingMobileBottomNav: React.FC<TicketingMobileBottomNavProps> = ({
  activeTab,
  onTabChange,
  cartItemCount,
  activeTicketId,
  isCartExpanded,
  onToggleCart,
}) => {
  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.06)] select-none w-full max-w-full">
      <div className="flex items-center justify-around h-[68px] sm:h-[70px] max-w-md mx-auto px-2">
        {/* Catalog Tab */}
        <button
          onClick={() => {
            onTabChange('catalog')
            if (isCartExpanded) onToggleCart()
          }}
          className={[
            'relative flex flex-col items-center justify-center flex-1 h-full py-1 space-y-1 transition-all duration-200 active:scale-95 cursor-pointer select-none',
            activeTab === 'catalog' && !isCartExpanded ? 'text-[#14274E]' : 'text-[#8492a6] hover:text-[#14274E]',
          ].join(' ')}
          aria-label="Catalog Tab"
        >
          {activeTab === 'catalog' && !isCartExpanded && (
            <span className="absolute top-0 w-8 h-1 bg-[#14274E] rounded-full animate-fade-in" />
          )}
          <div
            className={[
              'w-9 h-9 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center transition-all',
              activeTab === 'catalog' && !isCartExpanded
                ? 'bg-[#14274E] text-[#E9C46A] shadow-xs scale-105'
                : 'text-[#8492a6]',
            ].join(' ')}
          >
            <Utensils className="w-4.5 h-4.5 sm:w-4 sm:h-4" />
          </div>
          <span
            className={[
              'text-xs sm:text-[11px] tracking-tight leading-none',
              activeTab === 'catalog' && !isCartExpanded
                ? 'font-extrabold text-[#14274E]'
                : 'font-semibold',
            ].join(' ')}
          >
            Catalog
          </span>
        </button>

        {/* Ticket Cart Tab - Toggles Collapsible Drawer */}
        <button
          onClick={onToggleCart}
          className={[
            'relative flex flex-col items-center justify-center flex-1 h-full py-1 space-y-1 transition-all duration-200 active:scale-95 cursor-pointer select-none',
            isCartExpanded ? 'text-[#14274E]' : 'text-[#8492a6] hover:text-[#14274E]',
          ].join(' ')}
          aria-label="Ticket Cart Tab"
        >
          {isCartExpanded && (
            <span className="absolute top-0 w-8 h-1 bg-[#14274E] rounded-full animate-fade-in" />
          )}
          <div className="relative">
            <div
              className={[
                'w-9 h-9 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center transition-all',
                isCartExpanded
                  ? 'bg-[#14274E] text-[#E9C46A] shadow-xs scale-105'
                  : 'text-[#8492a6]',
              ].join(' ')}
            >
              <ShoppingBag className="w-4.5 h-4.5 sm:w-4 sm:h-4" />
            </div>

            {/* Cart Item count badge */}
            {cartItemCount > 0 && (
              <span className="absolute -top-1 -right-1.5 bg-[#14274E] text-[#E9C46A] text-[10px] sm:text-[9px] font-black min-w-[18px] sm:min-w-[16px] h-[18px] sm:h-4 px-1 flex items-center justify-center rounded-full ring-2 ring-white shadow-xs">
                {cartItemCount}
              </span>
            )}
          </div>
          <span
            className={[
              'text-xs sm:text-[11px] tracking-tight leading-none',
              isCartExpanded ? 'font-extrabold text-[#14274E]' : 'font-semibold',
            ].join(' ')}
          >
            Ticket Cart
          </span>
        </button>

        {/* Ticket Status / ID Tab */}
        <div
          className="relative flex flex-col items-center justify-center flex-1 h-full py-1 space-y-1 text-[#14274E] select-none"
          title={`Active Ticket #${activeTicketId}`}
        >
          <div className="relative">
            <div className="w-9 h-9 sm:w-8 sm:h-8 rounded-xl bg-slate-100 flex items-center justify-center border border-slate-200 shadow-2xs">
              <Ticket className="w-4 h-4 text-[#14274E]" />
            </div>
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full ring-2 ring-white animate-pulse" />
          </div>
          <span className="text-[10px] tracking-tight leading-none font-extrabold text-[#14274E] truncate max-w-[80px]">
            #{activeTicketId || '—'}
          </span>
        </div>
      </div>
    </nav>
  )
}
