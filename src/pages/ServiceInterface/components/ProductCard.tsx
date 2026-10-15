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
  const isSoldOut = item.isSoldOut || (item.orderLimit !== undefined && item.orderLimit <= 0)
  const isLimitReached = item.orderLimit !== undefined && quantityInCart >= item.orderLimit
  const isSelected = quantityInCart > 0

  return (
    <div
      className={[
        'service-interface-dish-card p-3 relative select-none',
        isSoldOut ? 'opacity-50 grayscale cursor-not-allowed' : isLimitReached ? 'cursor-not-allowed' : 'cursor-pointer',
        isSelected ? 'is-selected ring-2 ring-[#14274E]/15' : '',
      ].join(' ')}
      onClick={() => {
        if (!isSoldOut && !isLimitReached) onAddToCart(item)
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
          {isSoldOut ? (
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#C94A4A] text-white shadow-xs">
              SOLD OUT
            </span>
          ) : item.orderLimit !== undefined && item.orderLimit > 0 ? (
            <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-500 text-white shadow-xs">
              {item.orderLimit} left
            </span>
          ) : null}
        </div>
      </div>

      {/* Item Title and Price at bottom */}
      <div className="mt-auto pt-1 text-left">
        {item.isItemGroup && item.includedItemNames && item.includedItemNames.length > 0 && (
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500 line-clamp-1">
            {item.includedItemNames.join(' • ')}
          </p>
        )}
        <div className="flex items-start justify-between gap-1.5">
          <h4
            className="text-sm font-extrabold text-[#14274E] line-clamp-2 leading-snug text-left flex-1"
            title={item.name}
          >
            {item.name}
          </h4>
          <span className="text-sm font-black text-[#14274E] shrink-0">
            ₱{item.price.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>
    </div>
  )
}
