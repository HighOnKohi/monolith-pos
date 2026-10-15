import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import PageLoader from '@/components/common/PageLoader'

/**
 * ProtectedRoute
 *
 * Wraps routes that require authentication.
 * - While Supabase is loading the session → show PageLoader (prevents flicker)
 * - No authenticated user → redirect to /login
 * - Authenticated user → render child routes via <Outlet />
 */
export function ProtectedRoute() {
  const { user, loading } = useAuth()

  if (loading) return <PageLoader />
  if (!user) return <Navigate to="/login" replace />

  return <Outlet />
}

export function AdminProtectedRoute() {
  const { user, loading } = useAuth()

  if (loading) return <PageLoader />
  if (!user) return <Navigate to="/login" replace />

  const isAdmin =
    user.email === 'taponakawnt@gmail.com' ||
    user.email === 'admin@monolith.com' ||
    user.email === 'adminmonolith@gmail.com' ||
    user.user_metadata?.role === 'admin'
  if (!isAdmin) {
    return <Navigate to="/service" replace />
  }

  return <Outlet />
}
