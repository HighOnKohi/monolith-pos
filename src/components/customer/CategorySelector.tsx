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
              'flex items-center gap-2 px-4 py-2.5 rounded-full whitespace-nowrap min-h-[42px] cursor-pointer',
              'text-xs font-bold transition-all duration-200 active:scale-95 hover:scale-[1.02]',
              isActive
                ? 'bg-[#14274E] text-[#E9C46A] shadow-md shadow-[#14274E]/20 ring-2 ring-[#14274E]/20 -translate-y-0.5'
                : 'bg-white text-[#394867] border border-[#9BA4B4]/30 hover:border-[#14274E]/40 hover:bg-[#F1F6F9] shadow-2xs',
            ].join(' ')}
          >
            <span>{cat.name}</span>
            <span
              className={[
                'text-[10px] px-2 py-0.5 rounded-full font-black transition-colors',
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
