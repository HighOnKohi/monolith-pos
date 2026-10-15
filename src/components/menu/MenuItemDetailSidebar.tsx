import React from 'react'
import {
  Edit2,
  Trash2,
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
  onClose?: () => void
  onEdit: (item: MenuItem) => void
  onToggleAvailability?: (item: MenuItem) => void
  isAvailabilitySaving?: boolean
  secondaryAction?: {
    label: string
    icon?: React.ReactNode
    onClick: (item: MenuItem) => void
    variant?: 'danger' | 'warning' | 'default'
  }
}

export const MenuItemDetailSidebar: React.FC<MenuItemDetailSidebarProps> = ({
  item,
  categories,
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
      <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/70 min-h-[53px]">
        <h2 className="text-sm font-black text-[#14274E] tracking-tight truncate">
          {item ? item.name : 'No item selected'}
        </h2>
      </div>

      {/* Body */}
      {!item ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-400">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200/80 flex items-center justify-center mb-3 text-slate-400 shadow-2xs">
            <Grid className="w-7 h-7 stroke-[1.5]" />
          </div>
          <h3 className="text-xs font-black text-[#14274E] mb-1">Select an Item</h3>
          <p className="text-[11px] text-slate-400 font-medium max-w-[200px] leading-relaxed">
            Click on any item card in the grid to review full details, pricing, availability, and settings.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 no-scrollbar">
          {/* Hero Image */}
          <div className="relative aspect-4/3 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200/90 shadow-2xs">
            <img
              src={item.imageUrl || DEFAULT_FOOD_PLACEHOLDER}
              alt={item.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                ;(e.currentTarget as HTMLImageElement).src = DEFAULT_FOOD_PLACEHOLDER
              }}
            />

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
          </div>

          {/* I. Price */}
          <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Price
            </span>
            <div className="flex items-center justify-between">
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-black text-[#14274E]">₱{item.price.toFixed(2)}</span>
                {item.originalPrice && item.originalPrice > item.price && (
                  <span className="text-xs text-slate-400 line-through font-bold">
                    ₱{item.originalPrice.toFixed(2)}
                  </span>
                )}
              </div>
              {item.discountPercent && item.discountPercent > 0 ? (
                <div className="flex items-center gap-1 bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-0.5 rounded-xl text-xs font-black">
                  <Percent className="w-3 h-3" />
                  <span>{item.discountPercent}% OFF</span>
                </div>
              ) : item.isBestSeller ? (
                <div className="flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-300/80 px-2.5 py-0.5 rounded-xl text-xs font-extrabold">
                  <Sparkles className="w-3 h-3 text-amber-600" />
                  <span>Best Seller</span>
                </div>
              ) : null}
            </div>
          </div>

          {/* II. Description */}
          <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Description
            </span>
            <p className="text-xs text-slate-600 font-medium leading-relaxed whitespace-pre-line">
              {item.description || <span className="text-slate-400 italic">No description provided.</span>}
            </p>
          </div>

          {/* III. Availability */}
          <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Availability
            </span>
            <div className="flex items-center justify-between">
              {item.isAvailable ? (
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Available</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-xs font-bold text-rose-700">
                  <XCircle className="w-4 h-4 text-rose-600" />
                  <span>Out of Stock</span>
                </div>
              )}

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
          </div>

          {/* IV. Order Limit */}
          <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Order Limit
            </span>
            <span className="text-xs font-bold text-[#14274E]">
              {item.orderLimit != null && item.orderLimit > 0 ? `${item.orderLimit} items` : 'No limit'}
            </span>
          </div>

          {/* V. Vegan Label */}
          <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Vegan Label
            </span>
            {item.dietaryType === 'veg' ? (
              <span className="text-xs font-black tracking-wide text-emerald-800 bg-emerald-100/95 border border-emerald-300 px-2.5 py-0.5 rounded-lg shadow-2xs inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                VEG
              </span>
            ) : (
              <span className="text-xs font-black tracking-wide text-rose-800 bg-rose-100/95 border border-rose-300 px-2.5 py-0.5 rounded-lg shadow-2xs inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                NON-VEG
              </span>
            )}
          </div>

          {/* VI. Category */}
          <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Category
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white text-[#14274E] text-xs font-bold border border-slate-200/90 shadow-2xs">
              <CategoryIcon className="w-3.5 h-3.5 text-[#14274E]" />
              <span>{category?.name || 'Uncategorized'}</span>
            </span>
          </div>

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
        <div className="p-3.5 border-t border-slate-200/90 bg-slate-50/90 flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onEdit(item)}
            className="flex-1 py-2.5 bg-[#14274E] hover:bg-[#1f3b73] text-[#E9C46A] text-xs font-black rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-xs cursor-pointer min-w-0"
          >
            <Edit2 className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Edit Item</span>
          </button>

          {secondaryAction && (
            <button
              type="button"
              onClick={() => secondaryAction.onClick(item)}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200 shadow-xs min-w-0"
            >
              {secondaryAction.icon || <Trash2 className="w-3.5 h-3.5 shrink-0" />}
              <span className="truncate">
                {secondaryAction.label === 'Delete from Catalog' || secondaryAction.label.toLowerCase().includes('delete')
                  ? 'Delete'
                  : secondaryAction.label}
              </span>
            </button>
          )}
        </div>
      )}
    </aside>
  )
}
