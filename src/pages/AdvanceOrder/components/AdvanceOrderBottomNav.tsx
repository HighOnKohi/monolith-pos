import { Utensils, ReceiptText } from 'lucide-react'

export type AdvanceOrderTabType = 'menu' | 'order'

interface AdvanceOrderBottomNavProps {
  activeTab: AdvanceOrderTabType
  onTabChange: (tab: AdvanceOrderTabType) => void
  hasActiveOrder?: boolean
  countdownFormatted?: string
}

export function AdvanceOrderBottomNav({
  activeTab,
  onTabChange,
  hasActiveOrder = false,
  countdownFormatted,
}: AdvanceOrderBottomNavProps) {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#9BA4B4]/25 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.06)] select-none w-full max-w-full">
      <div className="flex items-center justify-around h-16 sm:h-[70px] max-w-md mx-auto px-4">
        {/* Menu Tab */}
        <button
          type="button"
          onClick={() => onTabChange('menu')}
          className={[
            'relative flex flex-col items-center justify-center flex-1 h-full py-1 space-y-1 transition-all duration-200 active:scale-95 cursor-pointer select-none',
            activeTab === 'menu' ? 'text-[#14274E]' : 'text-[#8492a6] hover:text-[#14274E]',
          ].join(' ')}
          aria-label="Menu Tab"
        >
          {activeTab === 'menu' && (
            <span className="absolute top-0 w-10 h-1 bg-[#14274E] rounded-full animate-fade-in" />
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
          <span
            className={[
              'text-[11px] tracking-tight leading-none',
              activeTab === 'menu' ? 'font-extrabold text-[#14274E]' : 'font-semibold',
            ].join(' ')}
          >
            Menu
          </span>
        </button>

        {/* Your Order Tab */}
        <button
          type="button"
          onClick={() => onTabChange('order')}
          className={[
            'relative flex flex-col items-center justify-center flex-1 h-full py-1 space-y-1 transition-all duration-200 active:scale-95 cursor-pointer select-none',
            activeTab === 'order' ? 'text-[#14274E]' : 'text-[#8492a6] hover:text-[#14274E]',
          ].join(' ')}
          aria-label="Your Order Tab"
        >
          {activeTab === 'order' && (
            <span className="absolute top-0 w-10 h-1 bg-[#14274E] rounded-full animate-fade-in" />
          )}
          <div
            className={[
              'w-8 h-8 rounded-xl flex items-center justify-center transition-all relative',
              activeTab === 'order'
                ? 'bg-[#14274E] text-[#E9C46A] shadow-xs scale-105'
                : 'text-[#8492a6]',
            ].join(' ')}
          >
            <ReceiptText className="w-4 h-4" />
            {hasActiveOrder && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full ring-2 ring-white animate-pulse" />
            )}
          </div>
          <div className="flex items-center gap-1">
            <span
              className={[
                'text-[11px] tracking-tight leading-none',
                activeTab === 'order' ? 'font-extrabold text-[#14274E]' : 'font-semibold',
              ].join(' ')}
            >
              Your Order
            </span>
            {hasActiveOrder && countdownFormatted && (
              <span className="text-[10px] font-mono font-bold text-amber-600 bg-amber-50 px-1 rounded">
                {countdownFormatted}
              </span>
            )}
          </div>
        </button>
      </div>
    </nav>
  )
}
