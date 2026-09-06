import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { DEFAULT_FOOD_PLACEHOLDER, type MenuItem } from '@/types/menu'
import { QuantityControl } from './QuantityControl'

interface MenuItemDetailProps {
  item: MenuItem
  initialQuantity: number
  initialNotes?: string
  onClose: () => void
  onUpdateCart: (quantity: number, notes: string) => void
}

const FALLBACK_IMG = DEFAULT_FOOD_PLACEHOLDER

export function MenuItemDetail({
  item,
  initialQuantity,
  initialNotes = '',
  onClose,
  onUpdateCart,
}: MenuItemDetailProps) {
  const [qty, setQty] = useState(initialQuantity === 0 ? 1 : initialQuantity)
  const [notes, setNotes] = useState(initialNotes)

  // Prevent background scrolling while open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = 'auto'
    }
  }, [])

  const handleSave = () => {
    onUpdateCart(qty, notes.trim())
    onClose()
  }

  const handleRemove = () => {
    onUpdateCart(0, '')
    onClose()
  }

  return (
    <>
      <div className="fixed inset-0 z-[95] bg-[#14274E]/45 backdrop-blur-md animate-backdrop-fade" onClick={onClose} />

      <div className="fixed bottom-0 inset-x-0 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-full sm:max-w-lg z-[100] bg-white rounded-t-3xl sm:rounded-3xl sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 shadow-[0_-12px_40px_rgba(20,39,78,0.2)] max-h-[90vh] flex flex-col animate-sheet-up sm:animate-modal-pop">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 bg-[#9BA4B4]/40 rounded-full" />
        </div>

        {/* Header Actions */}
        <div className="absolute top-4 right-4 z-10 shrink-0">
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md hover:bg-black/70 active:scale-90 transition-all cursor-pointer shadow-xs"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto no-scrollbar pb-24">
          {/* Image */}
          <div className="w-full aspect-[4/3] bg-[#F1F6F9] relative">
            <img
              src={item.imageUrl ?? FALLBACK_IMG}
              alt={item.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                const target = e.currentTarget
                if (target.src !== FALLBACK_IMG) {
                  target.src = FALLBACK_IMG
                }
              }}
            />
          </div>

          <div className="p-5 space-y-4">
            {/* Title & Price */}
            <div className="flex justify-between items-start gap-4">
              <div>
                <h2 className="text-xl font-extrabold text-[#14274E] leading-tight mb-1">
                  {item.name}
                </h2>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[#9BA4B4] font-mono">
                    {item.code}
                  </span>
                  <span className="w-1 h-1 rounded-full bg-[#9BA4B4]/50" />
                  <span className={['text-xs font-semibold', item.dietaryType === 'veg' ? 'text-emerald-600' : 'text-[#C94A4A]'].join(' ')}>
                    {item.dietaryType === 'veg' ? 'Vegetarian' : 'Non-Vegetarian'}
                  </span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-2xl font-extrabold text-[#14274E]">
                  ₱{item.price.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Description */}
            {item.description && (
              <p className="text-[#394867] text-sm leading-relaxed">
                {item.description}
              </p>
            )}

            <div className="w-full h-px bg-[#9BA4B4]/20 my-2" />

            {/* Customization Notes */}
            <div>
              <label htmlFor="notes" className="block text-sm font-bold text-[#14274E] mb-2">
                Special Instructions
              </label>
              <textarea
                id="notes"
                rows={3}
                placeholder="e.g., No onions, allergy to peanuts..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-[#F1F6F9] border border-[#9BA4B4]/30 rounded-2xl p-4 text-sm text-[#14274E] placeholder-[#9BA4B4] focus:outline-none focus:ring-2 focus:ring-[#14274E]/20 resize-none"
              />
            </div>
          </div>
        </div>

        {/* Sticky Bottom Actions */}
        <div className="absolute bottom-0 inset-x-0 bg-white border-t border-[#9BA4B4]/15 p-4 flex gap-4 pb-safe-4">
          <div className="w-36 shrink-0">
            <QuantityControl
              quantity={qty}
              onDecrease={() => setQty((q) => Math.max(1, q - 1))}
              onIncrease={() => setQty((q) => q + 1)}
            />
          </div>
          
          {initialQuantity > 0 && qty === initialQuantity && notes === initialNotes ? (
            <button
              onClick={handleRemove}
              className="flex-1 bg-[#F1F6F9] text-[#C94A4A] rounded-2xl font-bold text-base active:scale-[0.98] transition-transform flex items-center justify-center min-h-[52px]"
            >
              Remove
            </button>
          ) : (
            <button
              onClick={handleSave}
              className="flex-1 bg-[#14274E] text-white rounded-2xl font-bold text-base active:scale-[0.98] transition-transform flex items-center justify-center min-h-[52px] shadow-sm"
            >
              {initialQuantity > 0 ? 'Update Item' : `Add ₱${(item.price * qty).toFixed(2)}`}
            </button>
          )}
        </div>
      </div>
    </>
  )
}
