import { supabase } from '@/lib/supabase'
import type { BillRequest, PaymentMethod, BillStatus } from '@/types/bill'

function mapBillRequest(row: Record<string, unknown>): BillRequest {
  return {
    requestId: Number(row['REQUEST_ID']),
    tableId: Number(row['TABLE_ID']),
    orderId: row['ORDER_ID'] != null ? Number(row['ORDER_ID']) : undefined,
    paymentMethod: row['PAYMENT_METHOD'] as PaymentMethod,
    status: row['STATUS'] as BillStatus,
    requestedAt: String(row['REQUESTED_AT']),
  }
}

export async function createBillRequest(
  tableId: number,
  paymentMethod: PaymentMethod,
  orderId?: number,
): Promise<BillRequest> {
  const { data, error } = await supabase
    .from('Bill_Requests')
    .insert({
      TABLE_ID: tableId,
      ORDER_ID: orderId ?? null,
      PAYMENT_METHOD: paymentMethod,
      STATUS: 'REQUESTED',
    })
    .select()
    .single()

  if (error || !data) throw error ?? new Error('Failed to create bill request')
  return mapBillRequest(data as Record<string, unknown>)
}

export async function fetchActiveBillRequest(tableId: number): Promise<BillRequest | null> {
  const { data, error } = await supabase
    .from('Bill_Requests')
    .select('*')
    .eq('TABLE_ID', tableId)
    .not('STATUS', 'eq', 'PAID')
    .not('STATUS', 'eq', 'CANCELLED')
    .order('REQUESTED_AT', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  return mapBillRequest(data as Record<string, unknown>)
}

export async function fetchAllBillRequests(): Promise<BillRequest[]> {
  const { data, error } = await supabase
    .from('Bill_Requests')
    .select('*')
    .in('STATUS', ['REQUESTED', 'PROCESSING'])
    .order('REQUESTED_AT', { ascending: false })

  if (error) throw error
  return (data ?? []).map((row) => mapBillRequest(row as Record<string, unknown>))
}

export async function updateBillRequestStatus(
  requestId: number,
  status: BillStatus,
  tableId?: number,
): Promise<void> {
  const { error } = await supabase
    .from('Bill_Requests')
    .update({ STATUS: status })
    .eq('REQUEST_ID', requestId)

  if (error) throw error

  if (status === 'PAID' && tableId) {
    try {
      await supabase
        .from('Restaurant_Tables')
        .update({ BILL_OUT_REQUESTED: false })
        .eq('TABLE_ID', tableId)
    } catch (err) {
      console.warn('Failed to clear table bill out status:', err)
    }
  }
}

