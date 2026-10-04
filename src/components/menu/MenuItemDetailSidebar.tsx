import React from 'react'
import {
  X,
  Edit2,
  CheckCircle2,
  XCircle,
  UtensilsCrossed,
  Sparkles,
  Layers,
  Percent,
  Grid,
  Loader2,
} from 'lucide-react'
import type { MenuItem, Category } from '@/types/menu'
import { DEFAULT_FOOD_PLACEHOLDER } from '@/types/menu'
import { categoryIconMap, categoryIcons } from '@/components/menu/NewMenuCategoryModal'

export interface MenuItemDetailSidebarProps {
  item: MenuItem | null
  categories: Category[]
  onClose: () => void
  onEdit: (item: MenuItem) => void
  onToggleAvailability?: (item: MenuItem) => void
  isAvailabilitySaving?: boolean
  secondaryAction?: {
    label: string
    icon: React.ReactNode
    onClick: (item: MenuItem) => void
    variant?: 'danger' | 'warning' | 'default'
  }
}

export const MenuItemDetailSidebar: React.FC<MenuItemDetailSidebarProps> = ({
  item,
  categories,
  onClose,
  onEdit,
  onToggleAvailability,
  isAvailabilitySaving = false,
  secondaryAction,
}) => {
  const category = item ? categories.find((c) => c.id === item.categoryId) : null

  const CategoryIcon = category
    ? (category.icon ? categoryIconMap[category.icon as keyof typeof categoryIconMap] : undefined)
      ?? categoryIcons.find((ci) => ci.name === category.icon)?.component
      ?? UtensilsCrossed
    : UtensilsCrossed

  return (
    <aside className="w-80 sm:w-88 md:w-96 shrink-0 h-full bg-white rounded-2xl border border-slate-200/90 shadow-sm flex flex-col overflow-hidden select-none">
      {/* Header */}
      <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/70">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#14274E] text-[#E9C46A] flex items-center justify-center shrink-0 shadow-2xs">
            <UtensilsCrossed className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-black text-[#14274E] uppercase tracking-wider">Dish Inspector</h2>
            <p className="text-[10px] text-slate-400 font-bold">
              {item ? `Code #${item.code}` : 'No dish selected'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {item && (
            <button
              type="button"
              onClick={() => onEdit(item)}
              className="p-1.5 rounded-xl hover:bg-slate-200/80 text-slate-600 hover:text-[#14274E] transition-colors cursor-pointer"
              title="Edit dish details"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          )}
          {item && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-slate-200/80 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
              title="Close inspector"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      {!item ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-400">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200/80 flex items-center justify-center mb-3 text-slate-400 shadow-2xs">
            <Grid className="w-7 h-7 stroke-[1.5]" />
          </div>
          <h3 className="text-xs font-black text-[#14274E] mb-1">Select a Dish</h3>
          <p className="text-[11px] text-slate-400 font-medium max-w-[200px] leading-relaxed">
            Click on any dish card in the grid to review full details, pricing, ingredients, and stock status.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
          {/* Hero Image & Badges */}
          <div className="relative aspect-4/3 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200/90 shadow-2xs">
            <img
              src={item.imageUrl || DEFAULT_FOOD_PLACEHOLDER}
              alt={item.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                ;(e.currentTarget as HTMLImageElement).src = DEFAULT_FOOD_PLACEHOLDER
              }}
            />

            {/* Top Badges */}
            <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 flex-wrap">
              {item.dietaryType === 'veg' ? (
                <span className="text-[9px] font-black tracking-wide text-emerald-800 bg-emerald-100/95 border border-emerald-300 px-2 py-0.5 rounded-md shadow-2xs">
                  VEG
                </span>
              ) : (
                <span className="text-[9px] font-black tracking-wide text-rose-800 bg-rose-100/95 border border-rose-300 px-2 py-0.5 rounded-md shadow-2xs">
                  NON-VEG
                </span>
              )}
            </div>

            {item.badge && (
              <div className="absolute top-2.5 right-2.5">
                <span
                  className={`text-[9px] font-black tracking-wide px-2 py-0.5 rounded-md shadow-2xs ${
                    item.badge.type === 'discount'
                      ? 'bg-amber-400 text-amber-950 border border-amber-500'
                      : 'bg-[#14274E] text-[#E9C46A] border border-[#E9C46A]/30'
                  }`}
                >
                  {item.badge.label}
                </span>
              </div>
            )}

            {/* Bottom Stock Indicator */}
            {item.orderLimit != null && item.orderLimit > 0 && (
              <div className="absolute bottom-2.5 left-2.5 bg-slate-900/85 text-white text-[10px] font-bold px-2 py-0.5 rounded-lg backdrop-blur-2xs">
                Stock Limit: {item.orderLimit}
              </div>
            )}
          </div>

          {/* Title & Category Info */}
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-700 text-[10px] font-bold border border-slate-200">
                <CategoryIcon className="w-3 h-3 text-[#14274E]" />
                <span>{category?.name || 'Dish'}</span>
              </span>
              <span className="text-[10px] font-mono text-slate-400 font-bold">#{item.code}</span>
            </div>

            <h1 className="text-base font-black text-[#14274E] leading-snug">{item.name}</h1>
          </div>

          {/* Price & Discount Box */}
          <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                Selling Price
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-black text-[#14274E]">₱{item.price.toFixed(2)}</span>
                {item.originalPrice && item.originalPrice > item.price && (
                  <span className="text-xs text-slate-400 line-through font-bold">
                    ₱{item.originalPrice.toFixed(2)}
                  </span>
                )}
              </div>
            </div>

            {item.discountPercent && item.discountPercent > 0 ? (
              <div className="flex items-center gap-1 bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-1 rounded-xl text-xs font-black">
                <Percent className="w-3 h-3" />
                <span>{item.discountPercent}% OFF</span>
              </div>
            ) : item.isBestSeller ? (
              <div className="flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-300/80 px-2.5 py-1 rounded-xl text-xs font-extrabold">
                <Sparkles className="w-3 h-3 text-amber-600" />
                <span>Best Seller</span>
              </div>
            ) : null}
          </div>

          {/* Availability & Stock Status */}
          <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Availability &amp; Stock
            </span>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {item.isAvailable ? (
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>In Stock &amp; Active</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-xs font-bold text-rose-700">
                    <XCircle className="w-4 h-4 text-rose-600" />
                    <span>Out of Stock (Hidden)</span>
                  </div>
                )}
              </div>

              {onToggleAvailability && (
                <button
                  type="button"
                  onClick={() => onToggleAvailability(item)}
                  disabled={isAvailabilitySaving}
                  className={`px-2.5 py-1 rounded-xl text-[10px] font-black cursor-pointer transition-colors ${
                    item.isAvailable
                      ? 'bg-rose-100 hover:bg-rose-200 text-rose-700'
                      : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800'
                  }`}
                >
                  {isAvailabilitySaving ? (
                    <Loader2 className="w-3 h-3 animate-spin inline mr-1" />
                  ) : null}
                  {item.isAvailable ? 'Mark Sold Out' : 'Mark Available'}
                </button>
              )}
            </div>

            <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs text-slate-600 font-medium">
              <span>Order Stock Limit:</span>
              <span className="font-bold text-[#14274E]">
                {item.orderLimit && item.orderLimit > 0 ? `${item.orderLimit} remaining` : 'Unlimited'}
              </span>
            </div>
          </div>

          {/* Description */}
          {item.description && (
            <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Description &amp; Notes
              </span>
              <p className="text-xs text-slate-600 font-medium leading-relaxed whitespace-pre-line">
                {item.description}
              </p>
            </div>
          )}

          {/* Included combo items if item group */}
          {item.isItemGroup && item.includedItemNames && item.includedItemNames.length > 0 && (
            <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <Layers className="w-3.5 h-3.5 text-[#14274E]" />
                <span>Combo Inclusions ({item.includedItemNames.length})</span>
              </div>
              <ul className="space-y-1">
                {item.includedItemNames.map((name, i) => (
                  <li key={i} className="text-xs font-semibold text-[#14274E] flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#14274E]" />
                    <span>{name}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Footer Actions */}
      {item && (
        <div className="p-3.5 border-t border-slate-200/90 bg-slate-50/90 flex flex-col gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onEdit(item)}
            className="w-full py-2.5 bg-[#14274E] hover:bg-[#1f3b73] text-[#E9C46A] text-xs font-black rounded-xl flex items-center justify-center gap-2 transition-colors shadow-xs cursor-pointer"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Edit Dish Details</span>
          </button>

          {secondaryAction && (
            <button
              type="button"
              onClick={() => secondaryAction.onClick(item)}
              className={`w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border ${
                secondaryAction.variant === 'danger'
                  ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                  : secondaryAction.variant === 'warning'
                    ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              {secondaryAction.icon}
              <span>{secondaryAction.label}</span>
            </button>
          )}
        </div>
      )}
    </aside>
  )
}
