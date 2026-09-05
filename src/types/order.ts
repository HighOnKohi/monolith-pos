// ─── Order Types ──────────────────────────────────────────────────────────────

/** DB ORDER_STATUS values (after migration adds SERVED) */
export type OrderStatus = 'REQUESTED' | 'VERIFIED' | 'PREPARING' | 'READY' | 'SERVED'

/** Customer-facing display labels */
export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  REQUESTED: 'Order Placed',
  VERIFIED: 'Confirmed',
  PREPARING: 'Preparing',
  READY: 'Ready',
  SERVED: 'Food Served',
}

export type OrderType = 'DINE-IN' | 'TAKEOUT'

export interface OrderItem {
  orderItemId: number
  orderId: number
  itemId: string
  quantity: number
  notes?: string
  status: string
}

export interface Order {
  orderId: number
  tableId: number
  orderStatus: OrderStatus
  orderType: OrderType
  totalBill: number
  createdAt?: string
  items?: OrderItem[]
}
