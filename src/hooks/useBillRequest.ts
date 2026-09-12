import { useState, useCallback, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import type { BillRequest, PaymentMethod } from '@/types/bill'
import { createBillRequest, fetchActiveBillRequest } from '@/services/billService'

interface UseBillRequestResult {
  billRequest: BillRequest | null
  isRequesting: boolean
  requestError: string | null
  requestBill: (paymentMethod: PaymentMethod, orderId?: number) => Promise<boolean>
  clearError: () => void
}

export function useBillRequest(
  tableId: number | null,
  memberTableIds?: number[],
): UseBillRequestResult {
  const [billRequest, setBillRequest] = useState<BillRequest | null>(null)
  const [isRequesting, setIsRequesting] = useState(false)
  const [requestError, setRequestError] = useState<string | null>(null)

  const memberIdsKey = memberTableIds ? memberTableIds.join(',') : ''
  const targetTableIds = useMemo(() => {
    if (memberTableIds && memberTableIds.length > 0) return memberTableIds
    return tableId ? [tableId] : []
  }, [tableId, memberIdsKey])

  const refreshBillRequest = useCallback(async () => {
    if (!tableId || targetTableIds.length === 0) return
    try {
      const active = await fetchActiveBillRequest(tableId, targetTableIds)
      setBillRequest((prev) => {
        if (!prev && !active) return prev
        if (
          prev &&
          active &&
          prev.requestId === active.requestId &&
          prev.status === active.status &&
          prev.paymentMethod === active.paymentMethod &&
          prev.tableId === active.tableId
        ) {
          return prev
        }
        return active
      })
    } catch (err) {
      console.error('[useBillRequest] fetch error', err)
    }
  }, [tableId, targetTableIds])

  // Initial fetch + Visibility sync
  useEffect(() => {
    if (!tableId || targetTableIds.length === 0) return

    refreshBillRequest()

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshBillRequest()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [tableId, targetTableIds, refreshBillRequest])

  // Realtime subscription to bill request status changes
  useEffect(() => {
    if (!tableId || targetTableIds.length === 0) return

    const channelName = `bill-requests-table-${targetTableIds.join('-')}`
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'orders',
          table: 'Bill_Requests',
        },
        (payload) => {
          const newRow = payload.new as Record<string, any> | null
          const oldRow = payload.old as Record<string, any> | null
          const rowTableId = Number(newRow?.TABLE_ID || oldRow?.TABLE_ID)
          if (targetTableIds.includes(rowTableId)) {
            refreshBillRequest()
          }
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [tableId, targetTableIds, refreshBillRequest])

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
