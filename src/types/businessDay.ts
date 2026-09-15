export type BusinessDayStatus = 'OPEN' | 'CLOSED'

export interface BusinessDay {
  businessDayId: number
  businessDate: string
  status: BusinessDayStatus
  startedAt: string
  startedBy: string | null
  endedAt: string | null
  endedBy: string | null
  totalTransactions: number
  totalRevenue: number
  totalCustomersServed: number
}

export interface CashierDailyPerformance {
  staffId: number
  staffName: string
  staffRole: string
  shiftIds: number[]
  shiftTimes: string[]
  transactionsCount: number
  customersServed: number
  totalSales: number
  cashTotal: number
  cardTotal: number
  eWalletTotal: number
  voidsCount: number
  discountsTotal: number
}

export interface DailyPaymentBreakdown {
  method: string
  count: number
  total: number
  percentage: number
}

export interface DailyTransactionRow {
  orderId: number
  time: string
  tableLabel: string
  staffId: number | null
  cashierName: string
  shiftId: number | null
  transactionType: 'PAYMENT' | 'VOID' | 'REFUND' | 'ORDER'
  paymentMethod: string
  amount: number
  discount: number
  status: string
}

export interface DailySummary {
  businessDay: BusinessDay
  grossRevenue: number
  subtotalRevenue: number
  totalDiscounts: number
  completedOrdersCount: number
  cancelledOrdersCount: number
  customersServed: number
  averageOrderValue: number
  averageSpendPerCustomer: number
  paymentBreakdown: DailyPaymentBreakdown[]
  adjustments: {
    discounts: number
    refunds: number
    voids: number
  }
  cashierPerformance: CashierDailyPerformance[]
  transactionsList: DailyTransactionRow[]
}

export interface ActiveOrdersCheckResult {
  hasActiveOrders: boolean
  count: number
  orders: Array<{
    orderId: number
    tableId: number
    status: string
    totalBill: number
  }>
}

export interface ActiveShiftsCheckResult {
  hasActiveShifts: boolean
  cashierShifts: Array<{
    shiftId: number
    staffId: number
    staffName?: string
    startedAt: string
  }>
  serviceShifts: Array<{
    shiftId: number
    staffId: number
    staffName?: string
    startedAt: string
  }>
}
