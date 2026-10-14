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
  totalValuePunched: number
  durationMinutes: number
  startedAt: string
}

export interface ServiceShiftPunchedOrder {
  orderId: number
  tableId: number
  tableNum: number
  tableDisplay: string
  totalBill: number
  time: string
  status: string
  itemCount: number
  items: Array<{ name: string; quantity: number; price?: number }>
}

export interface ServiceShiftPunchedTable {
  tableId: number
  tableNum: number
  tableDisplay: string
  ordersCount: number
  totalValue: number
  orders: ServiceShiftPunchedOrder[]
}

export interface ServiceShiftDetailedSummary {
  metrics: ServiceShiftSummaryMetrics
  orders: ServiceShiftPunchedOrder[]
  tables: ServiceShiftPunchedTable[]
}

export interface ServiceStaffValidationResult {
  valid: boolean
  error?: string
  staff?: StaffCodeItem
}
