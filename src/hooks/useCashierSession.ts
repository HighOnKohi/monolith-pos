import { useCashierSessionContext } from '@/contexts/CashierSessionContext'

/**
 * useCashierSession
 *
 * Hook to access the current Cashier Shift, active Cashier Staff details,
 * and cashier shift operations (startShift, endShift, getShiftMetrics).
 * Note: This is strictly separate from the application's Supabase Auth user.
 */
export function useCashierSession() {
  return useCashierSessionContext()
}
