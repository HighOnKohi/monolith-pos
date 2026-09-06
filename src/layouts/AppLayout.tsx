import { useState, useCallback } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { AppSidebar } from '@/components/layout/AppSidebar'

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()

  const handleSidebarClose = useCallback(() => setSidebarOpen(false), [])

  const pageTitle = (() => {
    const p = location.pathname.replace('/', '')
    if (p.startsWith('kitchen')) return 'Kitchen Display'
    if (p.startsWith('cashier')) return 'Cashier Station'
    if (p.startsWith('tables')) return 'Table Manager'
    if (p.startsWith('menu')) return 'Menu Manager'
    if (p.startsWith('analytics')) return 'Analytics'
    if (p.startsWith('accounts')) return 'Account Manager'
    if (p.startsWith('order-logs')) return 'Order Logs'
    return 'Monolith POS'
  })()

  return (
    <div className="website staff-shell">
      <div className="website-container">
        <AppSidebar open={sidebarOpen} onClose={handleSidebarClose} />

        <div className="staff-workspace flex flex-1 flex-col overflow-hidden">
          {/* Mobile Top Header - only visible on screens < 1024px */}
          <div className="flex lg:hidden items-center justify-between px-3.5 py-2.5 bg-white border-b border-slate-200 shrink-0 z-30 shadow-2xs">
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-1.5 rounded-xl text-[#14274E] hover:bg-slate-100 active:scale-95 transition-all cursor-pointer border border-slate-200"
                aria-label="Open staff navigation menu"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-[#14274E] text-[#E9C46A] flex items-center justify-center font-black text-xs">M</span>
                <span className="font-extrabold text-xs sm:text-sm text-[#14274E] tracking-tight">{pageTitle}</span>
              </div>
            </div>
            <span className="text-[10px] sm:text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              Staff
            </span>
          </div>

          <main className="flex-1 overflow-hidden">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
