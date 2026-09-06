// ─── Menu Item Types ──────────────────────────────────────────────────────────

export type DietaryType = 'veg' | 'non-veg'

export type BadgeType = 'popular' | 'discount' | 'chef-pick' | 'best-seller'

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
  /** Base64 Data URI or image data stored directly in database */
  imageUrl?: string
  isAvailable: boolean
  isSoldOut: boolean
  badge?: ItemBadge
  isBestSeller?: boolean
}

export const DEFAULT_FOOD_PLACEHOLDER =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="400" height="300" fill="%23F1F6F9"/><circle cx="200" cy="115" r="14" fill="%23C94A4A"/><path d="M110 180c0-49.7 40.3-90 90-90s90 40.3 90 90H110z" fill="%2314274E"/><rect x="90" y="185" width="220" height="12" rx="6" fill="%239BA4B4"/><ellipse cx="200" cy="220" rx="130" ry="14" fill="%23CBD5E1"/></svg>'


// ─── Category Types ───────────────────────────────────────────────────────────

export interface Category {
  id: string
  name: string
  count: number
  icon?: string
}
