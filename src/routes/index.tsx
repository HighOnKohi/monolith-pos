import { lazy, Suspense, useEffect } from 'react'
import { createBrowserRouter, Navigate, useLocation } from 'react-router-dom'
import RootLayout from '@/layouts/RootLayout'
import AppLayout from '@/layouts/AppLayout'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import PageLoader from '@/components/common/PageLoader'
import { VERCEL_APP_URL } from '@/components/table-qr/tableQrUtils'

// ─── Public pages ─────────────────────────────────────────────────────────────
const LoginPage = lazy(() => import('@/pages/Login'))
const CustomerPage = lazy(() => import('@/pages/Customer'))
const NotFound = lazy(() => import('@/pages/NotFound'))

// ─── Protected pages ──────────────────────────────────────────────────────────
const DispatcherInterface = lazy(() => import('@/pages/DispatcherInterface'))
const CashierPage = lazy(() => import('@/pages/ServiceInterface'))
const CashierInterfacePage = lazy(() => import('@/pages/CashierInterface'))
const OrderViewerPage = lazy(() => import('@/pages/OrderViewer'))
const TableManagerPage = lazy(() => import('@/pages/TableManager'))
const MenuManagerPage = lazy(() => import('@/pages/MenuManager'))
const AnalyticsPage = lazy(() => import('@/pages/Analytics'))
const AccountManagerPage = lazy(() => import('@/pages/AccountManager'))
const OrderLogsPage = lazy(() => import('@/pages/OrderLogs'))
const EventsPage = lazy(() => import('@/pages/Events'))

function wrap(Component: React.ComponentType) {
  return (
    <Suspense fallback={<PageLoader />}>
      <Component />
    </Suspense>
  )
}

function CustomerRouteWrapper() {
  const location = useLocation()

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname
      const isLocalhost =
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '0.0.0.0' ||
        hostname.endsWith('.local')

      const searchParams = new URLSearchParams(location.search)
      if (isLocalhost && !searchParams.has('local')) {
        const dest = `${VERCEL_APP_URL}${location.pathname}${location.search}`
        window.location.replace(dest)
      }
    }
  }, [location])

  return (
    <Suspense fallback={<PageLoader />}>
      <CustomerPage />
    </Suspense>
  )
}

function CustomerRootRedirect() {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname
      const isLocalhost =
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '0.0.0.0' ||
        hostname.endsWith('.local')

      const searchParams = new URLSearchParams(window.location.search)
      if (isLocalhost && !searchParams.has('local')) {
        window.location.replace(`${VERCEL_APP_URL}/customer/table-1`)
      }
    }
  }, [])

  return <Navigate to="/customer/table-1" replace />
}

export const router = createBrowserRouter([
  // ── Public routes (no auth required) ────────────────────────────────────────
  {
    element: <RootLayout />,
    children: [
      {
        path: 'login',
        element: wrap(LoginPage),
      },
      {
        path: 'customer',
        element: <CustomerRootRedirect />,
      },
      {
        path: 'customer/:tableId',
        element: <CustomerRouteWrapper />,
      },
    ],
  },

  // ── Protected routes (auth required) ────────────────────────────────────────
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/', element: <Navigate to="/dispatcher" replace /> },
          { path: 'dispatcher', element: wrap(DispatcherInterface) },
          { path: 'kitchen', element: <Navigate to="/dispatcher" replace /> },
          { path: 'order-viewer', element: wrap(OrderViewerPage) },
          { path: 'service', element: wrap(CashierPage) },
          { path: 'cashier', element: wrap(CashierInterfacePage) },
          { path: 'tables', element: wrap(TableManagerPage) },
          { path: 'menu', element: wrap(MenuManagerPage) },
          { path: 'analytics', element: wrap(AnalyticsPage) },
          { path: 'events', element: wrap(EventsPage) },
          { path: 'accounts', element: wrap(AccountManagerPage) },
          { path: 'order-logs', element: wrap(OrderLogsPage) },
        ],
      },
    ],
  },

  // ── 404 ─────────────────────────────────────────────────────────────────────
  {
    path: '*',
    element: wrap(NotFound),
  },
])
