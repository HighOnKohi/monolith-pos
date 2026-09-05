import { DEFAULT_FOOD_PLACEHOLDER, type MenuItem } from '@/types/menu'
import { QuantityControl } from './QuantityControl'

interface MenuItemCardProps {
  item: MenuItem
  quantity: number
  onTap: () => void
  onAdd: () => void
  onIncrease: () => void
  onDecrease: () => void
}

const badgeStyles = {
  popular: 'bg-[#C94A4A] text-white',
  discount: 'bg-[#E9C46A] text-[#14274E]',
  'chef-pick': 'bg-[#14274E] text-[#E9C46A]',
}

const FALLBACK_IMG = DEFAULT_FOOD_PLACEHOLDER

export function MenuItemCard({ item, quantity, onTap, onAdd, onIncrease, onDecrease }: MenuItemCardProps) {
  const inCart = quantity > 0
  const isSoldOut = item.isSoldOut

  return (
    <article
      onClick={isSoldOut ? undefined : onTap}
      className={[
        'bg-white rounded-2xl p-3 flex flex-col justify-between relative overflow-hidden shadow-sm',
        'transition-all duration-150',
        inCart ? 'border-2 border-[#14274E]' : 'border border-[#9BA4B4]/30',
        isSoldOut ? 'opacity-70' : 'cursor-pointer active:scale-[0.98]',
      ].join(' ')}
    >
      {/* Badge */}
      {item.badge && !isSoldOut && (
        <div className="absolute top-2.5 left-2.5 z-10">
          <span className={[
            'text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider',
            badgeStyles[item.badge.type],
          ].join(' ')}>
            {item.badge.label}
          </span>
        </div>
      )}

      {/* Sold Out overlay badge */}
      {isSoldOut && (
        <div className="absolute top-2.5 left-2.5 z-10">
          <span className="bg-[#9BA4B4] text-white text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider">
            Sold Out
          </span>
        </div>
      )}

      {/* Product image */}
      <div className="w-full h-32 rounded-xl overflow-hidden bg-[#F1F6F9] mb-3 relative">
        <img
          src={item.imageUrl ?? FALLBACK_IMG}
          alt={item.name}
          className={['w-full h-full object-cover', isSoldOut ? 'grayscale opacity-60' : ''].join(' ')}
          loading="lazy"
          onError={(e) => {
            const target = e.currentTarget
            if (target.src !== FALLBACK_IMG) {
              target.src = FALLBACK_IMG
            }
          }}
        />
        {isSoldOut && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#14274E]/20">
            <span className="text-white text-sm font-extrabold tracking-widest uppercase drop-shadow">
              Sold Out
            </span>
          </div>
        )}
      </div>

      {/* Details */}
      <div className="flex-1 flex flex-col">
        {/* Dietary + code */}
        <div className="flex items-center justify-between mb-1.5">
          {item.dietaryType === 'veg' ? (
            <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" /> Veg
            </span>
          ) : (
            <span className="text-xs font-semibold text-[#C94A4A] flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#C94A4A] shrink-0" /> Non Veg
            </span>
          )}
          <span className="text-xs text-[#9BA4B4] font-mono">{item.code}</span>
        </div>

        {/* Name */}
        <h2 className="text-sm font-bold text-[#14274E] line-clamp-2 leading-snug mb-2">
          {item.name}
        </h2>

        {/* Price */}
        <div className="flex items-baseline justify-between mt-auto mb-3">
          <span className="text-base font-extrabold text-[#14274E]">
            ₱{item.price.toFixed(2)}
          </span>
          {item.originalPrice && (
            <span className="text-xs text-[#9BA4B4] line-through font-medium">
              ₱{item.originalPrice.toFixed(2)}
            </span>
          )}
        </div>

        {/* Action */}
        {isSoldOut ? (
          <button
            disabled
            className="w-full py-3 rounded-xl bg-[#9BA4B4]/20 text-[#9BA4B4] text-sm font-bold cursor-not-allowed"
          >
            Sold Out
          </button>
        ) : inCart ? (
          <QuantityControl
            quantity={quantity}
            onIncrease={(e?: React.MouseEvent) => { e?.stopPropagation?.(); onIncrease() }}
            onDecrease={(e?: React.MouseEvent) => { e?.stopPropagation?.(); onDecrease() }}
          />
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); onAdd() }}
            className="w-full py-3 rounded-xl bg-[#F1F6F9] hover:bg-[#14274E] hover:text-white border border-[#9BA4B4]/40 text-[#14274E] text-sm font-bold transition-all duration-150 flex items-center justify-center gap-1 active:scale-[0.97] min-h-[44px]"
          >
            + Add to Dish
          </button>
        )}
      </div>
    </article>
  )
}
