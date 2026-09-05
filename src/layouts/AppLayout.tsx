import { useState, useCallback } from 'react'
import { Outlet } from 'react-router-dom'
import { AppHeader } from '@/components/layout/AppHeader'
import { AppSidebar } from '@/components/layout/AppSidebar'

/**
 * AppLayout — Authenticated application shell.
 *
 * Structure:
 *   ┌─────────────────────────────────────┐
 *   │             AppHeader               │
 *   ├──────────────┬──────────────────────┤
 *   │  AppSidebar  │  <Outlet /> (pages)  │
 *   │  (lg: fixed) │                      │
 *   └──────────────┴──────────────────────┘
 *
 * Mobile: AppSidebar is a slide-in drawer controlled by the burger button.
 * Desktop (lg+): AppSidebar is always visible on the left.
 */
export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleMenuToggle = useCallback(() => setSidebarOpen((v) => !v), [])
  const handleSidebarClose = useCallback(() => setSidebarOpen(false), [])

  return (
    <div className = "website"> 
      <div className="website-container">
        <AppSidebar open={sidebarOpen} onClose={handleSidebarClose} />

        <div className="flex flex-1 flex-col overflow-hidden">

          <main className="flex-1 overflow-y-auto p-4 lg:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
