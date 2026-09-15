import type { StaffCodeItem } from './account'

export type CashierShiftStatus = 'ACTIVE' | 'ENDED'

export interface CashierShift {
  shiftId: number
  staffId: number
  businessDayId?: number | null
  startedAt: string
  endedAt: string | null
  status: CashierShiftStatus
  totalEarning: number
  totalTablesHandled: number
  staffName?: string
  staffRole?: string
}

export type CashierAuditAction =
  | 'SHIFT_STARTED'
  | 'SHIFT_ENDED'
  | 'SERVICE_SHIFT_STARTED'
  | 'SERVICE_SHIFT_ENDED'
  | 'BUSINESS_DAY_STARTED'
  | 'BUSINESS_DAY_END_ATTEMPTED'
  | 'BUSINESS_DAY_END_BLOCKED'
  | 'BUSINESS_DAY_ENDED'
  | 'ORDER_CREATED'
  | 'ORDER_UPDATED'
  | 'ORDER_CANCELLED'
  | 'ORDER_REJECTED'
  | 'ORDER_COMPLETED'
  | 'ORDER_DELETED'
  | 'PAYMENT_CREATED'
  | 'PAYMENT_COMPLETED'
  | 'PAYMENT_FAILED'
  | 'PAYMENT_VOIDED'
  | 'REFUND_CREATED'
  | 'TABLE_ASSIGNED'
  | 'TABLE_MERGED'
  | 'TABLE_UNMERGED'
  | 'TABLE_CLEARED'
  | 'TABLE_ASSISTANCE_CLEARED'
  | 'TABLE_BILL_CLEARED'
  | 'DISCOUNT_APPLIED'
  | 'DISCOUNT_REMOVED'
  | 'PRICE_ADJUSTED'

export interface CashierAuditLog {
  logId: number
  businessDayId?: number | null
  shiftId: number | null
  staffId: number | null
  authUserId: string | null
  action: CashierAuditAction | string
  entityType: string | null
  entityId: string | null
  description: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
  staffName?: string
  staffRole?: string
}

export interface ShiftSummaryMetrics {
  totalEarnings: number
  tablesHandled: number
  ordersHandled: number
  durationMinutes: number
  startedAt: string
}

export interface CashierStaffValidationResult {
  valid: boolean
  error?: string
  staff?: StaffCodeItem
}
