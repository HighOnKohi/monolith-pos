import React from 'react'
import { Grid, UtensilsCrossed } from 'lucide-react'
import {
  categoryIconMap,
  categoryIcons,
} from '@/components/menu/NewMenuCategoryModal'
import type { Category } from '@/types/menu'

interface CategoryCardsRowProps {
  categories: Category[]
  selectedCategory: string
  onSelectCategory: (categoryId: string) => void
}

export const CategoryCardsRow: React.FC<CategoryCardsRowProps> = ({
  categories,
  selectedCategory,
  onSelectCategory,
}) => {
  return (
    <section className="menu-item-category-buttons-section w-full max-w-full min-w-0 px-4 sm:px-6 py-2 shrink-0">
      <div className="menu-item-category-buttons-header">
        <div className="menu-item-category-buttons-row">
          <div className="menu-item-category-buttons-container">
            {categories.map((cat, index) => {
              const CategoryIcon = cat.id === 'all'
                ? Grid
                : (cat.icon ? categoryIconMap[cat.icon as keyof typeof categoryIconMap] : undefined)
                  ?? categoryIcons[index % categoryIcons.length]?.component
                  ?? UtensilsCrossed

              const isActive = selectedCategory === cat.id

              return (
                <div
                  key={cat.id}
                  className={['menu-item-category-button shrink-0', isActive ? 'is-active' : ''].join(' ')}
                >
                  <button
                    type="button"
                    className="menu-item-category-default cursor-pointer text-left"
                    onClick={() => onSelectCategory(cat.id)}
                  >
                    <div className="menu-item-category-body">
                      <CategoryIcon className="menu-item-category-icon" />
                      <span className="menu-item-category-title">{cat.name.replace('⭐ ', '')}</span>
                    </div>
                    <span className="menu-item-category-count">
                      {cat.count} {cat.count === 1 ? 'Item' : 'Items'}
                    </span>
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
