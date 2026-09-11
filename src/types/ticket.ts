import type { MenuItem } from './menu'
import type { MenuItemGroup } from '@/services/menuService'

export type TicketStatus = 'REQUESTED' | 'PREPARING' | 'COMPLETED'

export interface TicketOrderItem {
  ticketOrderItemId: number
  ticketOrderId: number
  itemId: number | null
  itemGroupId: number | null
  discountId: number | null
  ticketOrderItemStatus: TicketStatus | null
  // Enriched presentation fields
  name?: string
  price?: number
  imageUrl?: string
  isGroup?: boolean
  groupDescription?: string
  includedItems?: string[]
}

export interface TicketOrder {
  ticketId: number
  registeredName: string | null
  registeredContactInfo: number | null
  registeredTimeOfArrival: string | null
  ticketStatus: TicketStatus
  createdAt?: string
  completedAt?: string | null
  items?: TicketOrderItem[]
  totalAmount?: number
}

export interface TicketCartItem {
  id: string
  name: string
  price: number
  imageUrl: string
  quantity: number
  notes?: string
  isGroup: boolean
  groupDescription?: string
  includedItems?: string[]
  dietaryType?: 'veg' | 'non-veg'
  categoryId?: string
  isSoldOut?: boolean
  rawItem?: MenuItem
  rawGroup?: MenuItemGroup
}

export interface TicketCustomerInfo {
  name: string
  contactInfo: string
  timeOfArrival: string
}
