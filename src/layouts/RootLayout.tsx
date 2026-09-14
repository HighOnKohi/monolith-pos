import { Outlet } from 'react-router-dom'
import { MenuProvider } from '@/hooks/useMenu'

/**
 * RootLayout
 *
 * Minimal shell layout that wraps all main application routes.
 * Future additions: navigation, sidebar, toast notifications, modals, etc.
 */
function RootLayout() {
  return (
    <MenuProvider>
      <div id="root-layout">
        <Outlet />
      </div>
    </MenuProvider>
  )
}

export default RootLayout
