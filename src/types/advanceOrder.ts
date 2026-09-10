import type { CartItem, DiningType } from './cart'

export type AdvanceOrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'EXPIRED'

export interface AdvanceOrderItem {
  advanceItemId: number
  advanceOrderId: number
  itemId: number
  menuId?: number
  itemName: string
  quantity: number
  unitPrice: number
  totalPrice: number
  notes?: string
  imageUrl?: string
  createdAt?: string
}

export interface AdvanceOrder {
  advanceOrderId: number
  orderNumber: string // e.g. "AO-8F42K"
  sessionToken: string // secure random token
  customerName: string
  diningType: DiningType
  tableId?: number | null
  tableNum?: number | null
  status: AdvanceOrderStatus
  subtotal: number
  totalAmount: number
  notes?: string
  createdAt: string
  expiresAt: string
  confirmedAt?: string | null
  completedAt?: string | null
  cancelledAt?: string | null
  items: AdvanceOrderItem[]
}

export interface CreateAdvanceOrderPayload {
  customerName: string
  diningType: DiningType
  tableId?: number | null
  tableNum?: number | null
  cartItems: CartItem[]
  notes?: string
}

export interface PreOrderSession {
  sessionId: string
  customerName: string
  diningType: DiningType
  tableId?: number | null
  tableNum?: number | null
  cart: CartItem[]
}
