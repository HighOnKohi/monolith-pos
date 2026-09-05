import { Utensils, ReceiptText, Settings } from 'lucide-react'

export type TabType = 'menu' | 'orders' | 'settings'

interface MobileBottomNavProps {
  activeTab: TabType
  onTabChange: (tab: TabType) => void
  activeOrderCount?: number
}

const navItems: { id: TabType; label: string; icon: typeof Utensils }[] = [
  { id: 'menu', label: 'Menu', icon: Utensils },
  { id: 'orders', label: 'Orders', icon: ReceiptText },
  { id: 'settings', label: 'Settings', icon: Settings },
]

export function MobileBottomNav({ activeTab, onTabChange, activeOrderCount = 0 }: MobileBottomNavProps) {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-[#9BA4B4]/20 pb-safe">
      <div className="flex items-center justify-around h-[72px]">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = activeTab === item.id
          
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={[
                'relative flex flex-col items-center justify-center w-full h-full space-y-1',
                isActive ? 'text-[#14274E]' : 'text-[#9BA4B4] hover:text-[#394867]'
              ].join(' ')}
            >
              <div className="relative">
                <Icon className={['w-6 h-6 transition-transform duration-200', isActive ? 'scale-110' : ''].join(' ')} />
                {item.id === 'orders' && activeOrderCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-[#C94A4A] text-white text-[10px] font-extrabold w-4 h-4 flex items-center justify-center rounded-full ring-2 ring-white">
                    {activeOrderCount}
                  </span>
                )}
              </div>
              <span className={['text-[11px] font-extrabold tracking-wide', isActive ? 'text-[#14274E]' : 'font-semibold'].join(' ')}>
                {item.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
