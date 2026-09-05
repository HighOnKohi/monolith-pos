import { X } from 'lucide-react'

export type DietaryFilter = 'all' | 'veg' | 'non-veg'

interface FilterSheetProps {
  value: DietaryFilter
  onChange: (filter: DietaryFilter) => void
  onClose: () => void
}

const filters: { label: string; value: DietaryFilter; description: string }[] = [
  { label: 'All Items', value: 'all', description: 'Show everything' },
  { label: 'Veg', value: 'veg', description: 'Vegetarian only' },
  { label: 'Non Veg', value: 'non-veg', description: 'Non-vegetarian only' },
]

export function FilterSheet({ value, onChange, onClose }: FilterSheetProps) {
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-[#14274E]/25 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Bottom sheet */}
      <div className="fixed bottom-0 inset-x-0 z-50 bg-white rounded-t-3xl shadow-2xl">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-[#9BA4B4]/40 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#9BA4B4]/15">
          <h3 className="text-base font-bold text-[#14274E]">Filter</h3>
          <button
            onClick={onClose}
            aria-label="Close filter"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-[#9BA4B4] hover:text-[#14274E] hover:bg-[#F1F6F9] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Filter options */}
        <div className="p-4 pb-8 space-y-2">
          {filters.map((filter) => (
            <button
              key={filter.value}
              onClick={() => { onChange(filter.value); onClose() }}
              aria-pressed={value === filter.value}
              className={[
                'w-full flex items-center justify-between px-4 py-4 rounded-2xl transition-all text-left min-h-[56px]',
                value === filter.value
                  ? 'bg-[#14274E] text-white'
                  : 'bg-[#F1F6F9] text-[#394867] hover:bg-[#9BA4B4]/10',
              ].join(' ')}
            >
              <div>
                <p className={['text-sm font-bold', value === filter.value ? 'text-white' : 'text-[#14274E]'].join(' ')}>
                  {filter.label}
                </p>
                <p className={['text-xs mt-0.5', value === filter.value ? 'text-white/70' : 'text-[#9BA4B4]'].join(' ')}>
                  {filter.description}
                </p>
              </div>
              {value === filter.value && (
                <span className="w-5 h-5 rounded-full border-2 border-white flex items-center justify-center shrink-0">
                  <span className="w-2 h-2 bg-[#E9C46A] rounded-full" />
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
