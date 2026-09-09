import type { ComponentType, SVGProps } from 'react'
import type { DiningType } from '@/types/cart'
import { Utensils, ShoppingBag } from 'lucide-react'

interface DiningTypeSelectorProps {
  value: DiningType
  onChange: (type: DiningType) => void
  disabled?: boolean
}

const options: { label: string; value: DiningType; icon: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { label: 'Dine In', value: 'dine-in', icon: Utensils },
  { label: 'Take Out', value: 'take-away', icon: ShoppingBag },
]

export function DiningTypeSelector({ value, onChange, disabled = false }: DiningTypeSelectorProps) {
  return (
    <div className="flex p-1 bg-[#F1F6F9] rounded-xl text-xs sm:text-sm font-extrabold text-[#394867] border border-[#9BA4B4]/20 gap-1 shadow-inner">
      {options.map((opt) => {
        const Icon = opt.icon
        const isSelected = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            aria-pressed={isSelected}
            className={[
              'flex-1 py-1.5 sm:py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all duration-150',
              disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
              isSelected
                ? 'bg-[#14274E] text-white shadow-xs font-black'
                : 'text-[#394867] hover:text-[#14274E] hover:bg-white/60 active:scale-95',
            ].join(' ')}
          >
            <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-[#E9C46A]' : 'text-[#9BA4B4]'}`} />
            <span>{opt.label}</span>
          </button>
        )
      })}
    </div>
  )
}

