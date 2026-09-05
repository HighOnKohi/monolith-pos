import type { MenuItem } from './menu'

// ─── Cart Types ───────────────────────────────────────────────────────────────

export type DiningType = 'dine-in' | 'take-away'

export interface CartItem {
  item: MenuItem
  quantity: number
  /** Customer customization notes e.g. "No onions, extra spicy" */
  notes?: string
}

export interface CartState {
  items: CartItem[]
  diningType: DiningType
  subtotal: number
  tax: number
  total: number
  itemCount: number
}
