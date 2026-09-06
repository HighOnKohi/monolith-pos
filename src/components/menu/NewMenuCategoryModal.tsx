import { memo, useEffect, useMemo, useState } from 'react'
import {
  Apple, Banana, Beef, Beer, Blender, Cake, CakeSlice, Candy, Carrot, ChefHat, Cherry, Citrus, Coffee,
  Cookie, CookingPot, Croissant, CupSoda, Dessert, Drumstick, EggFried, Fish, GlassWater, Glasses, Grape,
  Hamburger, IceCreamBowl, IceCreamCone, Leaf, Lollipop, Martini, Milk, Nut, PackageOpen, Pizza, Popcorn,
  Salad, Sandwich, Soup, Sprout, Store, Utensils, UtensilsCrossed, Vegan, Wheat, Wine, X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export const categoryIcons: { name: string; component: LucideIcon }[] = [
  { name: 'Apple', component: Apple }, { name: 'Banana', component: Banana }, { name: 'Beef', component: Beef },
  { name: 'Beer', component: Beer }, { name: 'Blender', component: Blender }, { name: 'Cake', component: Cake },
  { name: 'CakeSlice', component: CakeSlice }, { name: 'Candy', component: Candy }, { name: 'Carrot', component: Carrot },
  { name: 'ChefHat', component: ChefHat }, { name: 'Cherry', component: Cherry }, { name: 'Citrus', component: Citrus },
  { name: 'Coffee', component: Coffee }, { name: 'Cookie', component: Cookie }, { name: 'CookingPot', component: CookingPot },
  { name: 'Croissant', component: Croissant }, { name: 'CupSoda', component: CupSoda }, { name: 'Dessert', component: Dessert },
  { name: 'Drumstick', component: Drumstick }, { name: 'EggFried', component: EggFried }, { name: 'Fish', component: Fish },
  { name: 'GlassWater', component: GlassWater }, { name: 'Glasses', component: Glasses }, { name: 'Grape', component: Grape },
  { name: 'Hamburger', component: Hamburger }, { name: 'IceCreamBowl', component: IceCreamBowl }, { name: 'IceCreamCone', component: IceCreamCone },
  { name: 'Leaf', component: Leaf }, { name: 'Lollipop', component: Lollipop }, { name: 'Martini', component: Martini },
  { name: 'Milk', component: Milk }, { name: 'Nut', component: Nut }, { name: 'PackageOpen', component: PackageOpen },
  { name: 'Pizza', component: Pizza }, { name: 'Popcorn', component: Popcorn }, { name: 'Salad', component: Salad },
  { name: 'Sandwich', component: Sandwich }, { name: 'Soup', component: Soup },
  { name: 'Sprout', component: Sprout }, { name: 'Store', component: Store },
  { name: 'Utensils', component: Utensils },
  { name: 'UtensilsCrossed', component: UtensilsCrossed },
  { name: 'Vegan', component: Vegan }, { name: 'Wheat', component: Wheat }, { name: 'Wine', component: Wine },
]

export const categoryIconMap: Record<string, LucideIcon> = Object.fromEntries(
  categoryIcons.map(({ name, component }) => [name, component]),
)

import type { Category } from '@/types/menu'

interface NewMenuCategoryModalProps {
  isOpen: boolean
  editCategory?: Category | null
  onClose: () => void
  onSubmit: (name: string, icon: string) => Promise<void> | void
}

const CategoryIconOption = memo(function CategoryIconOption({
  iconName,
  Icon,
  isSelected,
  isSaving,
  onSelect,
}: {
  iconName: string
  Icon: LucideIcon
  isSelected: boolean
  isSaving: boolean
  onSelect: (iconName: string) => void
}) {
  return (
    <button
      type="button"
      className={`menu-modal-icon-option ${isSelected ? 'is-selected' : ''}`}
      onClick={() => onSelect(iconName)}
      disabled={isSaving}
      aria-label={iconName}
      aria-pressed={isSelected}
      title={iconName}
    >
      <Icon className="h-5 w-5" />
    </button>
  )
})

export const NewMenuCategoryModal = memo(function NewMenuCategoryModal({ isOpen, editCategory, onClose, onSubmit }: NewMenuCategoryModalProps) {
  const isEditMode = Boolean(editCategory)
  const [name, setName] = useState('')
  const [icon, setIcon] = useState(categoryIcons[0].name)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const iconOptions = useMemo(() => categoryIcons, [])

  useEffect(() => {
    if (isOpen) {
      setName(editCategory?.name ?? '')
      setIcon(editCategory?.icon ?? iconOptions[0].name)
      setError(null)
    }
  }, [isOpen, editCategory, iconOptions])

  if (!isOpen) return null

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!name.trim()) {
      setError('Category name is required.')
      return
    }
    setIsSaving(true)
    setError(null)
    try {
      await onSubmit(name.trim(), icon)
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create category.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="menu-modal-overlay" role="dialog" aria-modal="true" aria-label="New Menu Category">
      <form className="menu-modal-panel" onSubmit={handleSubmit}>
        <header className="menu-modal-header">
          <h2>{isEditMode ? 'Editing Category...' : 'Adding New Category...'}</h2>
          <button type="button" className="menu-modal-close" onClick={onClose} disabled={isSaving} aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="menu-modal-body">
          <label className="menu-modal-field">
            <span>Category name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} autoFocus placeholder="e.g. Breakfast" disabled={isSaving} />
          </label>
          <fieldset className="menu-modal-field">
            <legend>Icon</legend>
            <div className="menu-modal-icon-grid">
              {iconOptions.map(({ name: iconName, component: Icon }) => (
                <CategoryIconOption
                  key={iconName}
                  iconName={iconName}
                  Icon={Icon}
                  isSelected={icon === iconName}
                  isSaving={isSaving}
                  onSelect={setIcon}
                />
              ))}
            </div>
          </fieldset>
          {error && <p className="menu-modal-error" role="alert">{error}</p>}
        </div>
        <footer className="menu-modal-footer">
          <button type="button" className="menu-modal-cancel" onClick={onClose} disabled={isSaving}>Cancel</button>
          <button type="submit" className="menu-modal-submit" disabled={isSaving}>
            {isSaving ? (isEditMode ? 'Saving...' : 'Adding...') : (isEditMode ? 'Save changes' : 'Add category')}
          </button>
        </footer>
      </form>
    </div>
  )
})
