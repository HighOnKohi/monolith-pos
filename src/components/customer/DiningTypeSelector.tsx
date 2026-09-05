import type { DiningType } from '@/types/cart'

interface DiningTypeSelectorProps {
  value: DiningType
  onChange: (type: DiningType) => void
}

const options: { label: string; value: DiningType }[] = [
  { label: 'Dine In', value: 'dine-in' },
  { label: 'Take Away', value: 'take-away' },
]

export function DiningTypeSelector({ value, onChange }: DiningTypeSelectorProps) {
  return (
    <div className="flex p-1 bg-[#F1F6F9] rounded-2xl text-sm font-bold text-[#394867] border border-[#9BA4B4]/20 gap-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          aria-pressed={value === opt.value}
          className={[
            'flex-1 py-2.5 px-4 rounded-xl transition-all duration-150 min-h-[44px]',
            value === opt.value
              ? 'bg-[#14274E] text-white shadow-sm'
              : 'hover:text-[#14274E] active:scale-95',
          ].join(' ')}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
