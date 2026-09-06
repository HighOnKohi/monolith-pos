import { Utensils, ReceiptText, BellRing } from 'lucide-react'

export type TabType = 'menu' | 'orders' | 'settings'

interface MobileBottomNavProps {
  activeTab: TabType
  onTabChange: (tab: TabType) => void
  onOpenAssist: () => void
  activeOrderCount?: number
  hasActiveAssist?: boolean
  hasOrderStatusChange?: boolean
}

export function MobileBottomNav({
  activeTab,
  onTabChange,
  onOpenAssist,
  activeOrderCount = 0,
  hasActiveAssist = false,
  hasOrderStatusChange = false,
}: MobileBottomNavProps) {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#9BA4B4]/25 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.06)] select-none w-full max-w-full">
      <div className="flex items-center justify-around h-16 sm:h-[70px] max-w-md mx-auto px-2">
        {/* Menu Tab */}
        <button
          onClick={() => onTabChange('menu')}
          className={[
            'relative flex flex-col items-center justify-center flex-1 h-full py-1 space-y-1 transition-all duration-200 active:scale-95 cursor-pointer select-none',
            activeTab === 'menu' ? 'text-[#14274E]' : 'text-[#8492a6] hover:text-[#14274E]',
          ].join(' ')}
          aria-label="Menu Tab"
        >
          {activeTab === 'menu' && (
            <span className="absolute top-0 w-8 h-1 bg-[#14274E] rounded-full animate-fade-in" />
          )}
          <div
            className={[
              'w-8 h-8 rounded-xl flex items-center justify-center transition-all',
              activeTab === 'menu'
                ? 'bg-[#14274E] text-[#E9C46A] shadow-xs scale-105'
                : 'text-[#8492a6]',
            ].join(' ')}
          >
            <Utensils className="w-4 h-4" />
          </div>
          <span className={['text-[11px] tracking-tight leading-none', activeTab === 'menu' ? 'font-extrabold text-[#14274E]' : 'font-semibold'].join(' ')}>
            Menu
          </span>
        </button>

        {/* Orders Tab - Blinks if there are status changes! */}
        <button
          onClick={() => onTabChange('orders')}
          className={[
            'relative flex flex-col items-center justify-center flex-1 h-full py-1 space-y-1 transition-all duration-200 active:scale-95 cursor-pointer select-none',
            activeTab === 'orders' ? 'text-[#14274E]' : 'text-[#8492a6] hover:text-[#14274E]',
            hasOrderStatusChange ? 'animate-order-blink text-[#C94A4A]' : '',
          ].join(' ')}
          aria-label="Orders Tab"
        >
          {activeTab === 'orders' && !hasOrderStatusChange && (
            <span className="absolute top-0 w-8 h-1 bg-[#14274E] rounded-full animate-fade-in" />
          )}
          <div className="relative">
            <div
              className={[
                'w-8 h-8 rounded-xl flex items-center justify-center transition-all',
                activeTab === 'orders'
                  ? 'bg-[#14274E] text-white shadow-xs scale-105'
                  : hasOrderStatusChange
                  ? 'bg-red-50 text-red-600'
                  : 'text-[#8492a6]',
              ].join(' ')}
            >
              <ReceiptText className="w-4 h-4" />
            </div>

            {/* Active order count badge */}
            {activeOrderCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-[#C94A4A] text-white text-[9px] font-black w-4 h-4 flex items-center justify-center rounded-full ring-2 ring-white shadow-xs">
                {activeOrderCount}
              </span>
            )}

            {/* Status change pulsing glow indicator */}
            {hasOrderStatusChange && !activeOrderCount && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full ring-2 ring-white animate-badge-pulse" />
            )}
          </div>
          <span
            className={[
              'text-[11px] tracking-tight leading-none transition-colors',
              hasOrderStatusChange
                ? 'font-black text-[#C94A4A]'
                : activeTab === 'orders'
                ? 'font-extrabold text-[#14274E]'
                : 'font-semibold',
            ].join(' ')}
          >
            {hasOrderStatusChange ? 'Orders • New' : 'Orders'}
          </span>
        </button>

        {/* Assist Button */}
        <button
          onClick={onOpenAssist}
          className="relative flex flex-col items-center justify-center flex-1 h-full py-1 space-y-1 text-[#14274E] hover:text-[#14274E]/80 transition-all active:scale-95 cursor-pointer select-none"
          aria-label="Table Assistance"
        >
          <div className="relative">
            <div
              className={[
                'w-8 h-8 rounded-xl flex items-center justify-center transition-all',
                hasActiveAssist
                  ? 'bg-amber-500 text-white animate-pulse shadow-sm scale-105'
                  : 'bg-amber-50 text-amber-900 border border-amber-200/80 hover:scale-105',
              ].join(' ')}
            >
              <BellRing className="w-4 h-4 text-amber-700" />
            </div>
            {hasActiveAssist && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-white" />
            )}
          </div>
          <span
            className={[
              'text-[11px] tracking-tight leading-none font-bold',
              hasActiveAssist ? 'text-amber-700 font-extrabold' : 'text-[#394867]',
            ].join(' ')}
          >
            {hasActiveAssist ? 'Alerted' : 'Assist'}
          </span>
        </button>
      </div>
    </nav>
  )
}
