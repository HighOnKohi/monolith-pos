import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import RootLayout from '@/layouts/RootLayout'
import AppLayout from '@/layouts/AppLayout'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import PageLoader from '@/components/common/PageLoader'

// ─── Public pages ─────────────────────────────────────────────────────────────
const LoginPage = lazy(() => import('@/pages/Login'))
const NotFound = lazy(() => import('@/pages/NotFound'))

// ─── Protected pages ──────────────────────────────────────────────────────────
const KitchenPage = lazy(() => import('@/pages/Kitchen'))
const CashierPage = lazy(() => import('@/pages/Cashier'))
const CustomerPage = lazy(() => import('@/pages/Customer'))
const TableManagerPage = lazy(() => import('@/pages/TableManager'))
const MenuManagerPage = lazy(() => import('@/pages/MenuManager'))
const AnalyticsPage = lazy(() => import('@/pages/Analytics'))
const AccountManagerPage = lazy(() => import('@/pages/AccountManager'))
const OrderLogsPage = lazy(() => import('@/pages/OrderLogs'))

function wrap(Component: React.ComponentType) {
  return (
    <Suspense fallback={<PageLoader />}>
      <Component />
    </Suspense>
  )
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
    ],
  },

  // ── Protected routes (auth required) ────────────────────────────────────────
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/', element: <Navigate to="/kitchen" replace /> },
          { path: 'kitchen', element: wrap(KitchenPage) },
          { path: 'cashier', element: wrap(CashierPage) },
          { path: 'customer', element: wrap(CustomerPage) },
          { path: 'tables', element: wrap(TableManagerPage) },
          { path: 'menu', element: wrap(MenuManagerPage) },
          { path: 'analytics', element: wrap(AnalyticsPage) },
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
