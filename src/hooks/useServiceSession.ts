import { useServiceSessionContext } from '@/contexts/ServiceSessionContext'

/**
 * useServiceSession
 *
 * Hook to access the current Service Shift, active Server/Staff details,
 * and service shift operations (startShift, endShift, getShiftMetrics).
 * Note: This is independent of both Cashier shifts and Supabase Auth.
 */
export function useServiceSession() {
  return useServiceSessionContext()
}
