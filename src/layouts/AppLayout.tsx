import { useState, useCallback } from 'react'
import { Outlet } from 'react-router-dom'
import { AppSidebar } from '@/components/layout/AppSidebar'

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleSidebarClose = useCallback(() => setSidebarOpen(false), [])

  return (
    <div className="website staff-shell">
      <div className="website-container">
        <AppSidebar open={sidebarOpen} onClose={handleSidebarClose} />

        <div className="staff-workspace flex flex-1 flex-col overflow-hidden">
          <main className="flex-1 overflow-hidden">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
