import React from 'react'
import { Grid, UtensilsCrossed } from 'lucide-react'
import {
  categoryIconMap,
  categoryIcons,
} from '@/components/menu/NewMenuCategoryModal'
import type { Category } from '@/types/menu'

interface TicketingCategoryCardsRowProps {
  categories: Category[]
  selectedCategory: string
  onSelectCategory: (categoryId: string) => void
}

export const TicketingCategoryCardsRow: React.FC<TicketingCategoryCardsRowProps> = ({
  categories,
  selectedCategory,
  onSelectCategory,
}) => {
  const getCategoryIcon = (id: string, iconName?: string, index = 0) => {
    if (id === 'all') return <Grid className="ticketing-category-icon" />
    const savedIcon = iconName ? categoryIconMap[iconName] : undefined
    const Icon = savedIcon ?? categoryIcons[index % categoryIcons.length].component ?? UtensilsCrossed
    return <Icon className="ticketing-category-icon" />
  }

  return (
    <div className="w-full max-w-full min-w-0 overflow-hidden px-4 sm:px-6 py-2 bg-transparent shrink-0">
      <div className="flex items-center gap-3 sm:gap-4 overflow-x-auto no-scrollbar py-1 w-full max-w-full min-w-0 scroll-smooth touch-pan-x overscroll-x-contain">
        {categories.map((cat, index) => {
          const isActive = selectedCategory === cat.id
          return (
            <button
              key={cat.id}
              onClick={() => onSelectCategory(cat.id)}
              className={[
                'ticketing-category-card shrink-0',
                isActive ? 'is-active' : '',
              ].join(' ')}
            >
              <div className="mb-1.5 p-1.5 rounded-full flex items-center justify-center">
                {getCategoryIcon(cat.id, cat.icon, index)}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-[#14274E] whitespace-nowrap">
                  {cat.name.replace('⭐ ', '')}
                </span>
              </div>
              <span className="ticketing-cat-count text-[10px] text-slate-400 font-medium whitespace-nowrap">
                {cat.count} {cat.count === 1 ? 'item' : 'items'}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
