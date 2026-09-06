import React from 'react'
import { Plus, Minus, Check, Sparkles } from 'lucide-react'
import type { MenuItem } from '@/types/menu'

interface ProductCardProps {
  item: MenuItem
  quantityInCart: number
  onAddToCart: (item: MenuItem) => void
  onIncreaseQty: (itemId: string) => void
  onDecreaseQty: (itemId: string) => void
}

export const ProductCard: React.FC<ProductCardProps> = ({
  item,
  quantityInCart,
  onAddToCart,
  onIncreaseQty,
  onDecreaseQty,
}) => {
  const isSelected = quantityInCart > 0

  return (
    <div
      className={[
        'cashier-dish-card p-3 relative select-none',
        isSelected ? 'is-selected ring-2 ring-[#14274E]/15' : '',
        item.isSoldOut ? 'opacity-50 grayscale' : '',
      ].join(' ')}
    >
      {/* Food Image Container with Badge */}
      <div className="relative w-full aspect-16/11 rounded-2xl overflow-hidden bg-slate-100 mb-3 shrink-0">
        <img
          src={item.imageUrl}
          alt={item.name}
          className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
          loading="lazy"
        />

        {/* Top Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1 items-start">
          {item.isBestSeller && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-400 text-amber-950 flex items-center gap-1 shadow-xs">
              <Sparkles className="w-2.5 h-2.5" />
              Best Seller
            </span>
          )}
          {isSelected && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#14274E] text-white flex items-center gap-1 shadow-xs">
              <Check className="w-2.5 h-2.5" />
              Selected ({quantityInCart})
            </span>
          )}
          {item.isSoldOut && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-600 text-white shadow-xs">
              Out of Stock
            </span>
          )}
        </div>
      </div>

      {/* Item Title */}
      <h4
        className="text-xs font-extrabold text-[#14274E] mb-1 line-clamp-1 leading-snug"
        title={item.name}
      >
        {item.name}
      </h4>

      {/* Price & Dietary Classification matching reference image */}
      <div className="flex items-center justify-between mb-3 mt-auto">
        <span className="text-sm font-black text-[#14274E]">
          ₱{item.price.toFixed(2)}
        </span>
        <span className="text-[11px] font-bold flex items-center gap-1 text-slate-600">
          <span
            className={[
              'w-2 h-2 rounded-full',
              item.dietaryType === 'veg' ? 'bg-amber-400' : 'bg-rose-500',
            ].join(' ')}
          />
          {item.dietaryType === 'veg' ? 'Veg' : 'Non-Veg'}
        </span>
      </div>

      {/* Bottom Action Button matching reference image */}
      <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5">
        {quantityInCart === 0 ? (
          <button
            disabled={item.isSoldOut}
            onClick={() => onAddToCart(item)}
            className="w-full py-1.5 px-3 rounded-xl border border-slate-200 hover:border-[#14274E] hover:bg-slate-50 text-xs font-bold text-[#14274E] flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add to Order</span>
          </button>
        ) : (
          <div className="w-full flex items-center justify-between bg-slate-50 border border-[#14274E] rounded-xl p-1">
            <button
              onClick={() => onDecreaseQty(item.id)}
              className="w-7 h-7 rounded-lg bg-white shadow-xs hover:bg-rose-50 hover:text-rose-600 text-slate-700 flex items-center justify-center font-bold text-xs transition-colors cursor-pointer"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="text-xs font-black text-[#14274E]">
              {quantityInCart}
            </span>
            <button
              onClick={() => onIncreaseQty(item.id)}
              className="w-7 h-7 rounded-lg bg-[#14274E] text-white hover:bg-[#203c73] flex items-center justify-center font-bold text-xs transition-colors cursor-pointer"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
