// ─── Bill Request Types ───────────────────────────────────────────────────────

export type PaymentMethod = 'CASH' | 'CREDIT_CARD' | 'INSTAPAY_QR'

export type BillStatus = 'REQUESTED' | 'PROCESSING' | 'PAID' | 'CANCELLED'

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  CASH: 'Cash',
  CREDIT_CARD: 'Credit Card',
  INSTAPAY_QR: 'InstaPay QR',
}

export const BILL_STATUS_LABEL: Record<BillStatus, string> = {
  REQUESTED: 'Bill Requested',
  PROCESSING: 'Processing',
  PAID: 'Paid',
  CANCELLED: 'Cancelled',
}

export interface BillRequest {
  requestId: number
  tableId: number
  orderId?: number
  paymentMethod: PaymentMethod
  status: BillStatus
  requestedAt: string
}
