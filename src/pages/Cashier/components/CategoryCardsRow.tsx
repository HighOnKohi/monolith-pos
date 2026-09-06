import React from 'react'
import {
  UtensilsCrossed,
  Sparkles,
  Coffee,
  Soup,
  Pizza,
  Sandwich,
  Flame,
  Wine,
  IceCream,
  Grid,
} from 'lucide-react'
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
  const getCategoryIcon = (id: string, name: string) => {
    const lower = name.toLowerCase()
    if (id === 'all') return <Grid className="w-4 h-4 text-slate-600" />
    if (id === 'best_sellers' || lower.includes('best'))
      return <Sparkles className="w-4 h-4 text-amber-500" />
    if (lower.includes('burger') || lower.includes('sandwich'))
      return <Sandwich className="w-4 h-4 text-[#14274E]" />
    if (lower.includes('breakfast') || lower.includes('egg'))
      return <Coffee className="w-4 h-4 text-amber-700" />
    if (lower.includes('soup')) return <Soup className="w-4 h-4 text-orange-600" />
    if (lower.includes('pasta') || lower.includes('noodle'))
      return <UtensilsCrossed className="w-4 h-4 text-indigo-600" />
    if (lower.includes('pizza')) return <Pizza className="w-4 h-4 text-rose-600" />
    if (lower.includes('drink') || lower.includes('beverage'))
      return <Wine className="w-4 h-4 text-blue-600" />
    if (lower.includes('dessert') || lower.includes('sweet'))
      return <IceCream className="w-4 h-4 text-pink-600" />
    return <Flame className="w-4 h-4 text-slate-600" />
  }

  return (
    <div className="px-5 py-3 border-b border-slate-200/60 bg-[#F8FAFD]">
      <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-1">
        {categories.map((cat) => {
          const isActive = selectedCategory === cat.id
          return (
            <button
              key={cat.id}
              onClick={() => onSelectCategory(cat.id)}
              className={[
                'cashier-category-card shrink-0',
                isActive ? 'is-active' : '',
              ].join(' ')}
            >
              <div className="mb-1.5 p-1.5 rounded-full bg-slate-50 flex items-center justify-center">
                {getCategoryIcon(cat.id, cat.name)}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-[#14274E] whitespace-nowrap">
                  {cat.name.replace('⭐ ', '')}
                </span>
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block shrink-0" />
                )}
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
