import React from 'react'
import { Check } from 'lucide-react'
import type { MenuItem } from '@/types/menu'

interface ProductCardProps {
  item: MenuItem
  quantityInCart: number
  onAddToCart: (item: MenuItem) => void
  onDecreaseQty: (itemId: string) => void
}

export const ProductCard: React.FC<ProductCardProps> = ({
  item,
  quantityInCart,
  onAddToCart,
  onDecreaseQty,
}) => {
  const isSelected = quantityInCart > 0

  return (
    <div
      className={[
        'service-interface-dish-card p-3 relative select-none cursor-pointer',
        isSelected ? 'is-selected ring-2 ring-[#14274E]/15' : '',
        item.isSoldOut ? 'opacity-50 grayscale' : '',
      ].join(' ')}
      onClick={() => {
        if (!item.isSoldOut) onAddToCart(item)
      }}
      onContextMenu={(event) => {
        event.preventDefault()
        if (quantityInCart > 0) onDecreaseQty(item.id)
      }}
      aria-label={`${item.name}, ${quantityInCart} in order`}
    >
      {/* Food Image Container with Badge */}
      <div className="relative w-full aspect-4/3 rounded-2xl overflow-hidden bg-slate-100 mb-3 shrink-0 service-interface-dish-image-container">
        <img
          src={item.imageUrl}
          draggable={false}
          alt={item.name}
          className="w-full h-full object-cover"
          loading="lazy"
        />

        {/* Top Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1 items-start">
          {isSelected && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#14274E] text-white flex items-center gap-1 shadow-xs">
              <Check className="w-2.5 h-2.5" />
              Selected ({quantityInCart})
            </span>
          )}
          {item.isSoldOut && (
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#C94A4A] text-white shadow-xs">
              SOLD OUT
            </span>
          )}
        </div>
      </div>

      {/* Item Title */}
      <h4
        className="text-base font-extrabold text-[#14274E] mb-1 line-clamp-1 leading-snug"
        title={item.name}
      >
        {item.name}
      </h4>

      {/* Price & Dietary Classification matching reference image */}
      <div className="flex items-center justify-between mb-3 mt-auto">
        <span className="text-lg font-black text-[#14274E]">
          ₱{item.price.toFixed(2)}
        </span>
        <span className="text-[11px] font-bold flex items-center gap-1 text-slate-600">
          <span
            className={[
              'w-2.5 h-2.5 rounded-full',
              item.dietaryType === 'veg' ? 'bg-green-500' : 'bg-amber-400',
            ].join(' ')}
          />
          {item.dietaryType === 'veg' ? 'Vegetarian' : 'Non-Vegetarian'}
        </span>
      </div>


    </div>
  )
}
