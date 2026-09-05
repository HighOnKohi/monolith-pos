import { useAuthContext } from '@/contexts/AuthContext'

/**
 * useAuth — public hook for consuming auth state.
 * Use this in all components instead of accessing AuthContext directly.
 */
export function useAuth() {
  return useAuthContext()
}
