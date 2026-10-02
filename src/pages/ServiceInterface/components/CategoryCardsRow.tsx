import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Grid, UtensilsCrossed } from 'lucide-react'
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
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const checkScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 6)
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 6)
  }, [])

  useEffect(() => {
    checkScroll()
    const el = scrollRef.current
    if (!el) return
    el.addEventListener('scroll', checkScroll, { passive: true })
    window.addEventListener('resize', checkScroll)
    return () => {
      el.removeEventListener('scroll', checkScroll)
      window.removeEventListener('resize', checkScroll)
    }
  }, [checkScroll, categories])

  const handleWheel = (e: React.WheelEvent) => {
    const el = scrollRef.current
    if (!el) return
    if (Math.abs(e.deltaX) < Math.abs(e.deltaY)) {
      el.scrollLeft += e.deltaY
    }
  }

  const scroll = (offset: number) => {
    scrollRef.current?.scrollBy({ left: offset, behavior: 'smooth' })
  }

  return (
    <div className="relative w-full max-w-full min-w-0 px-4 sm:px-6 py-2 shrink-0 group/row">
      {/* Scroll Left Button */}
      {canScrollLeft && (
        <button
          type="button"
          onClick={() => scroll(-240)}
          className="absolute left-1 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-white/95 border border-slate-200 shadow-md flex items-center justify-center text-slate-700 hover:bg-[#14274E] hover:text-white transition-all cursor-pointer"
          title="Scroll Left"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      )}

      {/* Scroll Right Button */}
      {canScrollRight && (
        <button
          type="button"
          onClick={() => scroll(240)}
          className="absolute right-1 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-white/95 border border-slate-200 shadow-md flex items-center justify-center text-slate-700 hover:bg-[#14274E] hover:text-white transition-all cursor-pointer"
          title="Scroll Right"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}

      <div
        ref={scrollRef}
        onWheel={handleWheel}
        className="flex items-center gap-2.5 sm:gap-3 overflow-x-auto no-scrollbar py-1 w-full max-w-full min-w-0 scroll-smooth"
      >
        {categories.map((cat, index) => {
          const CategoryIcon = cat.id === 'all'
            ? Grid
            : (cat.icon ? categoryIconMap[cat.icon as keyof typeof categoryIconMap] : undefined)
              ?? categoryIcons[index % categoryIcons.length]?.component
              ?? UtensilsCrossed

          const isActive = selectedCategory === cat.id

          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelectCategory(cat.id)}
              className={[
                'group flex items-center gap-3 px-3.5 py-2.5 rounded-2xl transition-all duration-200 shrink-0 cursor-pointer select-none text-left min-w-[130px]',
                isActive
                  ? 'bg-[#14274E] border-2 border-[#14274E] text-white shadow-md shadow-[#14274E]/20 scale-[1.01]'
                  : 'bg-white border-2 border-slate-200/80 hover:border-slate-300 hover:bg-slate-50 text-slate-700 shadow-2xs',
              ].join(' ')}
            >
              <div
                className={[
                  'w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors',
                  isActive ? 'bg-[#E9C46A] text-[#14274E] shadow-xs' : 'bg-slate-100 text-[#394867] group-hover:bg-slate-200/70',
                ].join(' ')}
              >
                <CategoryIcon className="w-5 h-5 shrink-0" />
              </div>
              <div className="flex flex-col min-w-0 pr-1">
                <span
                  className={[
                    'text-xs font-bold truncate transition-colors leading-tight',
                    isActive ? 'text-white' : 'text-[#14274E]',
                  ].join(' ')}
                >
                  {cat.name.replace('⭐ ', '')}
                </span>
                <span
                  className={[
                    'text-[10px] font-medium leading-tight mt-0.5',
                    isActive ? 'text-[#E9C46A]' : 'text-slate-400',
                  ].join(' ')}
                >
                  {cat.count} {cat.count === 1 ? 'Item' : 'Items'}
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
