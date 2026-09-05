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
  'best-seller': 'bg-amber-500 text-white shadow-sm font-black',
}

const FALLBACK_IMG = DEFAULT_FOOD_PLACEHOLDER

export function MenuItemCard({ item, quantity, onTap, onAdd, onIncrease, onDecrease }: MenuItemCardProps) {
  const inCart = quantity > 0
  const isSoldOut = item.isSoldOut

  return (
    <article
      className={[
        'bg-white rounded-2xl p-3 flex flex-col justify-between relative overflow-hidden shadow-xs',
        'interactive-card cursor-default',
        inCart ? 'border-2 border-[#14274E] ring-2 ring-[#14274E]/10' : 'border border-[#9BA4B4]/25 hover:border-[#14274E]/30',
        isSoldOut ? 'opacity-70 grayscale-[30%]' : '',
      ].join(' ')}
    >
      {/* Badge */}
      {(item.badge || item.isBestSeller) && !isSoldOut && (
        <div className="absolute top-2.5 left-2.5 z-10 animate-fade-in">
          <span className={[
            'text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 shadow-xs transition-transform hover:scale-105',
            item.isBestSeller
              ? 'bg-amber-500 text-white shadow-amber-500/20'
              : badgeStyles[item.badge?.type || 'popular'],
          ].join(' ')}>
            {item.isBestSeller ? '★ Best Seller' : item.badge?.label}
          </span>
        </div>
      )}

      {/* Sold Out overlay badge */}
      {isSoldOut && (
        <div className="absolute top-2.5 left-2.5 z-10">
          <span className="bg-[#9BA4B4] text-white text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-xs">
            Sold Out
          </span>
        </div>
      )}

      {/* Product image - Clicking image triggers detail modal */}
      <div
        onClick={isSoldOut ? undefined : onTap}
        role={isSoldOut ? undefined : 'button'}
        aria-label={isSoldOut ? undefined : `View details for ${item.name}`}
        tabIndex={isSoldOut ? undefined : 0}
        onKeyDown={(e) => {
          if (!isSoldOut && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            onTap()
          }
        }}
        className={[
          'w-full h-32 rounded-xl overflow-hidden bg-[#F1F6F9] mb-3 relative group select-none',
          isSoldOut ? '' : 'cursor-pointer active:scale-[0.98] transition-transform duration-200',
        ].join(' ')}
      >
        <img
          src={item.imageUrl ?? FALLBACK_IMG}
          alt={item.name}
          className={[
            'w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-108',
            isSoldOut ? 'grayscale opacity-60' : '',
          ].join(' ')}
          loading="lazy"
          onError={(e) => {
            const target = e.currentTarget
            if (target.src !== FALLBACK_IMG) {
              target.src = FALLBACK_IMG
            }
          }}
        />
        {/* Subtle tap-for-details indicator on image */}
        {!isSoldOut && (
          <div className="absolute bottom-1.5 right-1.5 bg-black/60 text-white text-[9px] font-bold px-2 py-0.5 rounded-md backdrop-blur-xs opacity-85 group-hover:opacity-100 group-hover:scale-105 transition-all shadow-xs">
            Tap for info
          </div>
        )}
        {isSoldOut && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#14274E]/30 backdrop-blur-[1px]">
            <span className="text-white text-xs font-black tracking-widest uppercase bg-black/50 px-3 py-1 rounded-full drop-shadow-sm">
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
            <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" /> Veg
            </span>
          ) : (
            <span className="text-xs font-bold text-[#C94A4A] flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#C94A4A] shrink-0" /> Non Veg
            </span>
          )}
          <span className="text-xs text-[#9BA4B4] font-mono">{item.code}</span>
        </div>

        {/* Name */}
        <h2 className="text-sm font-extrabold text-[#14274E] line-clamp-2 leading-snug mb-2 group-hover:text-primary">
          {item.name}
        </h2>

        {/* Price */}
        <div className="flex items-baseline justify-between mt-auto mb-3">
          <span className="text-base font-black text-[#14274E] tracking-tight">
            ₱{item.price.toFixed(2)}
          </span>
          {item.originalPrice && (
            <span className="text-xs text-[#9BA4B4] line-through font-semibold">
              ₱{item.originalPrice.toFixed(2)}
            </span>
          )}
        </div>

        {/* Action */}
        {isSoldOut ? (
          <button
            disabled
            className="w-full py-2.5 rounded-xl bg-[#9BA4B4]/20 text-[#9BA4B4] text-xs font-bold cursor-not-allowed"
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
            className="w-full py-2.5 rounded-xl bg-[#F1F6F9] hover:bg-[#14274E] hover:text-white border border-[#9BA4B4]/35 text-[#14274E] text-xs font-extrabold interactive-button flex items-center justify-center gap-1 min-h-[42px]"
          >
            + Add to Dish
          </button>
        )}
      </div>
    </article>
  )
}
