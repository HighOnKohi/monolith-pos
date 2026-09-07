// ─── Order Types ──────────────────────────────────────────────────────────────

/** DB ORDER_STATUS values used by the order lifecycle */
export type OrderStatus =
  | 'REQUESTED'
  | 'VERIFIED'
  | 'PREPARING'
  | 'READY'
  | 'SERVED'
  | 'CANCELLED'
  | 'COMPLETED'

/** Customer-facing display labels */
export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  REQUESTED: 'Order Placed',
  VERIFIED: 'Confirmed',
  PREPARING: 'Preparing',
  READY: 'Ready',
  SERVED: 'Food Served',
  CANCELLED: 'Cancelled',
  COMPLETED: 'Completed',
}

export type OrderType = 'DINE-IN' | 'TAKEOUT'

export interface OrderItem {
  orderItemId: number
  orderId: number
  itemId: string
  notes?: string
  status: string
  isFlagged?: boolean
  pwd?: boolean
  senior?: boolean
  name?: string
  price?: number
  imageUrl?: string
}

export interface Order {
  orderId: number
  tableId: number
  orderStatus: OrderStatus
  orderType: OrderType
  totalBill: number
  createdAt?: string
  kitchenNote?: string
  serverNote?: string
  guestCount?: number
  readyAt?: string
  servedAt?: string
  completedAt?: string
  items?: OrderItem[]
}

export interface CompressedOrderItem {
  itemId: string
  name: string
  price: number
  quantity: number
  total: number
  pendingCount: number
  preparingCount: number
  servedCount: number
}

export interface CompressedTableOrder {
  tableId: number
  totalBill: number
  totalItemCount: number
  orderCount: number
  overallStatus: OrderStatus
  items: CompressedOrderItem[]
  rawOrders: Order[]
  canBillOut: boolean
}

