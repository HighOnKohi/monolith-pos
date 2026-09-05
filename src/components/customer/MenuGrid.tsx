import type { MenuItem } from '@/types/menu'
import { MenuItemCard } from './MenuItemCard'

interface MenuGridProps {
  items: MenuItem[]
  getQuantity: (itemId: string) => number
  onItemTap: (item: MenuItem) => void
  onItemAdd: (item: MenuItem) => void
  onItemIncrease: (item: MenuItem) => void
  onItemDecrease: (item: MenuItem) => void
}

export function MenuGrid({
  items,
  getQuantity,
  onItemTap,
  onItemAdd,
  onItemIncrease,
  onItemDecrease,
}: MenuGridProps) {
  if (items.length === 0) {
    return (
      <div className="py-20 text-center px-6">
        <h3 className="text-[#14274E] text-lg font-bold mb-2">No items found</h3>
        <p className="text-[#9BA4B4] text-sm font-medium">
          Try adjusting your search or filter settings.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 px-4 pb-48 pt-2">
      {items.map((item) => (
        <MenuItemCard
          key={item.id}
          item={item}
          quantity={getQuantity(item.id)}
          onTap={() => onItemTap(item)}
          onAdd={() => onItemAdd(item)}
          onIncrease={() => onItemIncrease(item)}
          onDecrease={() => onItemDecrease(item)}
        />
      ))}
    </div>
  )
}
