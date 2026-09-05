import { Outlet } from 'react-router-dom'

/**
 * RootLayout
 *
 * Minimal shell layout that wraps all main application routes.
 * Future additions: navigation, sidebar, toast notifications, modals, etc.
 */
function RootLayout() {
  return (
    <div id="root-layout">
      <Outlet />
    </div>
  )
}

export default RootLayout
