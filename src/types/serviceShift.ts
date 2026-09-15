import type { StaffCodeItem } from './account'

export type ServiceShiftStatus = 'ACTIVE' | 'ENDED'

export interface ServiceShift {
  shiftId: number
  staffId: number
  businessDayId?: number | null
  startedAt: string
  endedAt: string | null
  status: ServiceShiftStatus
  totalOrdersPunched: number
  totalTablesServed: number
  staffName?: string
  staffRole?: string
}

export interface ServiceShiftSummaryMetrics {
  ordersPunched: number
  tablesServed: number
  durationMinutes: number
  startedAt: string
}

export interface ServiceStaffValidationResult {
  valid: boolean
  error?: string
  staff?: StaffCodeItem
}
