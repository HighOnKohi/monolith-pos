// ─── Menu Item Types ──────────────────────────────────────────────────────────

export type DietaryType = 'veg' | 'non-veg'

export type BadgeType = 'popular' | 'discount' | 'chef-pick'

export interface ItemBadge {
  label: string
  type: BadgeType
}

export interface MenuItem {
  id: string
  name: string
  description?: string
  code: string
  price: number
  originalPrice?: number
  /** category ID — matches Category.id */
  categoryId: string
  dietaryType: DietaryType
  /** URL to image — Supabase Storage or external */
  imageUrl?: string
  isAvailable: boolean
  isSoldOut: boolean
  badge?: ItemBadge
}

// ─── Category Types ───────────────────────────────────────────────────────────

export interface Category {
  id: string
  name: string
  count: number
}
