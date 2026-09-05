import type { Category } from '@/types/menu'

interface CategorySelectorProps {
  categories: Category[]
  selected: string
  onSelect: (id: string) => void
}

export function CategorySelector({ categories, selected, onSelect }: CategorySelectorProps) {
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 py-2 select-none">
      {categories.map((cat) => {
        const isActive = cat.id === selected
        return (
          <button
            key={cat.id}
            onClick={() => onSelect(cat.id)}
            aria-pressed={isActive}
            className={[
              'flex items-center gap-2 px-4 py-2.5 rounded-full whitespace-nowrap min-h-[44px]',
              'text-sm font-semibold transition-all duration-150 active:scale-95',
              isActive
                ? 'bg-[#14274E] text-[#E9C46A] shadow-sm'
                : 'bg-white text-[#394867] border border-[#9BA4B4]/30',
            ].join(' ')}
          >
            <span>{cat.name}</span>
            <span
              className={[
                'text-xs px-2 py-0.5 rounded-full font-bold',
                isActive
                  ? 'bg-[#E9C46A] text-[#14274E]'
                  : 'bg-[#F1F6F9] text-[#9BA4B4]',
              ].join(' ')}
            >
              {cat.count}
            </span>
          </button>
        )
      })}
    </div>
  )
}
