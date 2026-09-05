import { useState, useCallback, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { BillRequest, BillStatus, PaymentMethod } from '@/types/bill'
import { createBillRequest, fetchActiveBillRequest } from '@/services/billService'

interface UseBillRequestResult {
  billRequest: BillRequest | null
  isRequesting: boolean
  requestError: string | null
  requestBill: (paymentMethod: PaymentMethod, orderId?: number) => Promise<boolean>
  clearError: () => void
}

export function useBillRequest(tableId: number | null): UseBillRequestResult {
  const [billRequest, setBillRequest] = useState<BillRequest | null>(null)
  const [isRequesting, setIsRequesting] = useState(false)
  const [requestError, setRequestError] = useState<string | null>(null)

  // Fetch existing active bill request on mount
  useEffect(() => {
    if (!tableId) return
    fetchActiveBillRequest(tableId)
      .then(setBillRequest)
      .catch((err) => console.error('[useBillRequest] fetch error', err))
  }, [tableId])

  // Realtime subscription to bill request status changes
  useEffect(() => {
    if (!tableId) return

    const channel = supabase
      .channel(`bill-requests-table-${tableId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'Bill_Requests',
          filter: `TABLE_ID=eq.${tableId}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>
          setBillRequest((prev) =>
            prev
              ? { ...prev, status: row['STATUS'] as BillStatus }
              : null,
          )
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [tableId])

  const requestBill = useCallback(
    async (paymentMethod: PaymentMethod, orderId?: number): Promise<boolean> => {
      if (!tableId) return false
      setIsRequesting(true)
      setRequestError(null)
      try {
        const req = await createBillRequest(tableId, paymentMethod, orderId)
        setBillRequest(req)
        return true
      } catch (err) {
        console.error('[useBillRequest] requestBill error', err)
        setRequestError('Failed to request the bill. Please try again.')
        return false
      } finally {
        setIsRequesting(false)
      }
    },
    [tableId],
  )

  return {
    billRequest,
    isRequesting,
    requestError,
    requestBill,
    clearError: () => setRequestError(null),
  }
}
