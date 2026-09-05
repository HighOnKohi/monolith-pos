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
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-[#9BA4B4]/20 pb-safe shadow-lg">
      <div className="flex items-center justify-around h-[72px]">
        {/* Menu Tab */}
        <button
          onClick={() => onTabChange('menu')}
          className={[
            'relative flex flex-col items-center justify-center w-full h-full space-y-1 transition-all duration-200 active:scale-90 cursor-pointer select-none',
            activeTab === 'menu' ? 'text-[#14274E]' : 'text-[#9BA4B4] hover:text-[#394867]',
          ].join(' ')}
        >
          {activeTab === 'menu' && (
            <span className="absolute top-0 w-8 h-1 bg-[#14274E] rounded-full animate-fade-in" />
          )}
          <Utensils className={['w-5 h-5 transition-transform duration-200', activeTab === 'menu' ? 'scale-110' : ''].join(' ')} />
          <span className={['text-[11px] tracking-wide', activeTab === 'menu' ? 'font-black text-[#14274E]' : 'font-semibold'].join(' ')}>
            Menu
          </span>
        </button>

        {/* Orders Tab - Blinks if there are status changes! */}
        <button
          onClick={() => onTabChange('orders')}
          className={[
            'relative flex flex-col items-center justify-center w-full h-full space-y-1 transition-all duration-200 active:scale-90 cursor-pointer select-none',
            activeTab === 'orders' ? 'text-[#14274E]' : 'text-[#9BA4B4] hover:text-[#394867]',
            hasOrderStatusChange ? 'animate-order-blink text-[#C94A4A]' : '',
          ].join(' ')}
        >
          {activeTab === 'orders' && !hasOrderStatusChange && (
            <span className="absolute top-0 w-8 h-1 bg-[#14274E] rounded-full animate-fade-in" />
          )}
          <div className="relative">
            <ReceiptText
              className={[
                'w-5 h-5 transition-transform duration-200',
                activeTab === 'orders' ? 'scale-110 text-[#14274E]' : '',
                hasOrderStatusChange ? 'text-[#C94A4A]' : '',
              ].join(' ')}
            />

            {/* Active order count badge */}
            {activeOrderCount > 0 && (
              <span className="absolute -top-1.5 -right-2.5 bg-[#C94A4A] text-white text-[10px] font-extrabold w-4 h-4 flex items-center justify-center rounded-full ring-2 ring-white shadow-xs">
                {activeOrderCount}
              </span>
            )}

            {/* Status change pulsing glow indicator */}
            {hasOrderStatusChange && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full ring-2 ring-white animate-badge-pulse" />
            )}
          </div>
          <span
            className={[
              'text-[11px] tracking-wide transition-colors',
              hasOrderStatusChange
                ? 'font-black text-[#C94A4A]'
                : activeTab === 'orders'
                ? 'font-black text-[#14274E]'
                : 'font-semibold',
            ].join(' ')}
          >
            {hasOrderStatusChange ? 'Orders • New' : 'Orders'}
          </span>
        </button>

        {/* Assist Button */}
        <button
          onClick={onOpenAssist}
          className="relative flex flex-col items-center justify-center w-full h-full space-y-1 text-[#14274E] hover:text-[#14274E]/80 transition-transform active:scale-95 group"
        >
          <div className="relative">
            <div
              className={[
                'w-8 h-8 rounded-full flex items-center justify-center transition-all',
                hasActiveAssist
                  ? 'bg-amber-500 text-white animate-pulse shadow-sm'
                  : 'bg-[#14274E]/10 text-[#14274E] group-hover:scale-110',
              ].join(' ')}
            >
              <BellRing className="w-4 h-4" />
            </div>
            {hasActiveAssist && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full ring-2 ring-white" />
            )}
          </div>
          <span
            className={[
              'text-[11px] tracking-wide font-extrabold',
              hasActiveAssist ? 'text-amber-600' : 'text-[#14274E]',
            ].join(' ')}
          >
            {hasActiveAssist ? 'Staff Alerted' : 'Assist'}
          </span>
        </button>
      </div>
    </nav>
  )
}
