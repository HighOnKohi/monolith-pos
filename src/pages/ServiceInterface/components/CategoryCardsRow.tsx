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
  const getCategoryIcon = (id: string, iconName?: string, index = 0) => {
    if (id === 'all') return <Grid className="service-interface-category-icon" />
    const savedIcon = iconName ? categoryIconMap[iconName] : undefined
    const Icon = savedIcon ?? categoryIcons[index % categoryIcons.length].component ?? UtensilsCrossed
    return <Icon className="service-interface-category-icon" />
  }

  return (
    <div className="w-full max-w-full min-w-0 overflow-hidden px-4 sm:px-6 py-3 sm:py-3.5 border-b border-slate-200/60 bg-[#F8FAFD] shrink-0">
      <div className="flex items-center gap-3 sm:gap-4 overflow-x-auto no-scrollbar py-1 w-full max-w-full min-w-0">
        {categories.map((cat, index) => {
          const isActive = selectedCategory === cat.id
          return (
            <button
              key={cat.id}
              onClick={() => onSelectCategory(cat.id)}
              className={[
                'service-interface-category-card shrink-0',
                isActive ? 'is-active' : '',
              ].join(' ')}
            >
              <div className="mb-1.5 p-1.5 rounded-full bg-slate-50 flex items-center justify-center">
                {getCategoryIcon(cat.id, cat.icon, index)}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-[#14274E] whitespace-nowrap">
                  {cat.name.replace('⭐ ', '')}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">
                {cat.count} {cat.count === 1 ? 'item' : 'items'}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
