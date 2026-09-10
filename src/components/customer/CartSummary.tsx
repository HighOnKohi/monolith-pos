import { useState } from 'react'
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Loader2,
  Lock,
  Plus,
  Minus,
  ShoppingBag,
  Trash2,
  X,
  FileEdit,
  Check,
} from 'lucide-react'
import type { CartItem, DiningType } from '@/types/cart'
import { DiningTypeSelector } from './DiningTypeSelector'
import { DEFAULT_FOOD_PLACEHOLDER } from '@/types/menu'

const FALLBACK_IMG = DEFAULT_FOOD_PLACEHOLDER

interface CartSummaryProps {
  items: CartItem[]
  itemCount: number
  total: number
  diningType: DiningType
  onDiningTypeChange: (type: DiningType) => void
  onPlaceOrder: () => void
  onClear?: () => void
  onIncreaseQty: (itemId: string) => void
  onDecreaseQty: (itemId: string) => void
  onRemoveItem: (itemId: string) => void
  onUpdateNotes: (itemId: string, notes: string) => void
  isSubmitting?: boolean
  isLockedByOther?: boolean
  isExpanded: boolean
  onToggleExpand: () => void
  onClose: () => void
  tableNum?: number | null
  onChangeTable?: () => void
}

export function CartSummary({
  items,
  itemCount,
  total,
  diningType,
  onDiningTypeChange,
  onPlaceOrder,
  onClear,
  onIncreaseQty,
  onDecreaseQty,
  onRemoveItem,
  onUpdateNotes,
  isSubmitting = false,
  isLockedByOther = false,
  isExpanded,
  onToggleExpand,
  onClose,
  tableNum,
  onChangeTable,
}: CartSummaryProps) {
  const [editingNoteItemId, setEditingNoteItemId] = useState<string | null>(null)
  const [noteDraft, setNoteDraft] = useState('')

  if (itemCount === 0) return null

  const isDisabled = isSubmitting || isLockedByOther

  const handleStartEditNote = (itemId: string, currentNotes?: string) => {
    setEditingNoteItemId(itemId)
    setNoteDraft(currentNotes ?? '')
  }

  const handleSaveNote = (itemId: string) => {
    onUpdateNotes(itemId, noteDraft.trim())
    setEditingNoteItemId(null)
  }

  return (
    <>
      {/* ── 1. EXPANDED CART DRAWER / SHEET ── */}
      {isExpanded && (
        <>
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 bg-[#14274E]/50 backdrop-blur-xs z-[70] animate-fade-in transition-opacity"
            onClick={onClose}
          />

          {/* Drawer container */}
          <div
            className="fixed bottom-0 inset-x-0 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-full sm:max-w-lg z-[80] bg-white rounded-t-3xl shadow-[0_-16px_50px_rgba(20,39,78,0.28)] max-h-[85vh] flex flex-col animate-slide-up border-t border-[#9BA4B4]/20"
            role="dialog"
            aria-modal="true"
            aria-label="Current Cart"
          >
            {/* Grab Handle */}
            <div className="flex justify-center pt-3 pb-1 shrink-0 cursor-pointer" onClick={onClose}>
              <div className="w-12 h-1 bg-[#9BA4B4]/40 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 sm:px-5 py-2.5 border-b border-[#9BA4B4]/15 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#14274E] text-[#E9C46A] flex items-center justify-center">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-[#14274E] leading-tight">
                    Current Cart
                  </h3>
                  <p className="text-[11px] font-semibold text-[#9BA4B4]">
                    {itemCount} {itemCount === 1 ? 'dish' : 'dishes'} selected
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {onClear && !isLockedByOther && (
                  <button
                    type="button"
                    onClick={onClear}
                    className="flex items-center gap-1 text-xs font-bold text-[#C94A4A] hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                    title="Clear all items from cart"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-full hover:bg-[#F1F6F9] text-[#14274E] transition-colors cursor-pointer"
                  aria-label="Collapse cart"
                  title="Collapse cart"
                >
                  <ChevronDown className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Locked-by-other banner */}
            {isLockedByOther && (
              <div className="mx-4 mt-3 flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl shrink-0">
                <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="text-xs font-bold text-amber-800">
                  Someone at your table is currently submitting this order…
                </span>
              </div>
            )}

            {/* Scrollable Cart Items List */}
            <div className="overflow-y-auto px-4 sm:px-5 py-3 space-y-2.5 flex-1 min-h-0">
              {items.map(({ item, quantity, notes }) => {
                const isEditingNote = editingNoteItemId === item.id

                return (
                  <div
                    key={item.id}
                    className="p-3 rounded-2xl border border-[#9BA4B4]/20 bg-[#F1F6F9]/40 hover:bg-[#F1F6F9]/70 transition-all flex flex-col gap-2 shadow-2xs"
                  >
                    {/* Item Row: Thumbnail + Title/Price + Quantity Controls */}
                    <div className="flex items-center justify-between gap-3">
                      {/* Thumbnail & Info */}
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <img
                          src={item.imageUrl ?? FALLBACK_IMG}
                          alt={item.name}
                          className="w-13 h-13 rounded-xl object-cover shrink-0 border border-[#9BA4B4]/20 bg-white"
                          onError={(e) => {
                            ;(e.currentTarget as HTMLImageElement).src = FALLBACK_IMG
                          }}
                        />
                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-extrabold text-[#14274E] truncate" title={item.name}>
                            {item.name}
                          </h4>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs font-bold text-[#394867]">
                              ₱{item.price.toFixed(2)}
                            </span>
                            <span className="text-[10px] text-[#9BA4B4]">× {quantity}</span>
                          </div>
                        </div>
                      </div>

                      {/* Quantity Stepper & Line Total */}
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="text-sm font-black text-[#14274E]">
                          ₱{(item.price * quantity).toFixed(2)}
                        </span>

                        <div className="flex items-center rounded-xl bg-white border border-[#9BA4B4]/30 shadow-2xs p-0.5">
                          <button
                            type="button"
                            onClick={() => onDecreaseQty(item.id)}
                            disabled={isDisabled}
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-[#14274E] hover:bg-[#F1F6F9] active:scale-90 transition-all disabled:opacity-40 cursor-pointer"
                            title={quantity === 1 ? 'Remove item' : 'Decrease quantity'}
                            aria-label="Decrease quantity"
                          >
                            {quantity === 1 ? (
                              <Trash2 className="w-3.5 h-3.5 text-[#C94A4A]" />
                            ) : (
                              <Minus className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <span className="text-xs font-black text-[#14274E] min-w-[24px] text-center tabular-nums">
                            {quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => onIncreaseQty(item.id)}
                            disabled={isDisabled}
                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#14274E] text-white hover:bg-[#14274E]/90 active:scale-90 transition-all disabled:opacity-40 cursor-pointer"
                            title="Increase quantity"
                            aria-label="Increase quantity"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Special Instructions / Notes Row */}
                    <div className="pt-1.5 border-t border-[#9BA4B4]/15">
                      {isEditingNote ? (
                        <div className="flex items-center gap-1.5 mt-1 animate-fade-in">
                          <input
                            type="text"
                            value={noteDraft}
                            onChange={(e) => setNoteDraft(e.target.value)}
                            placeholder="Special requests (e.g. less spicy, no onions)..."
                            className="flex-1 text-xs px-2.5 py-1.5 rounded-lg border border-[#394867]/30 bg-white text-[#14274E] focus:outline-none focus:border-[#14274E]"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveNote(item.id)
                              if (e.key === 'Escape') setEditingNoteItemId(null)
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveNote(item.id)}
                            className="p-1.5 rounded-lg bg-[#14274E] text-white hover:bg-[#14274E]/90 cursor-pointer"
                            title="Save note"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingNoteItemId(null)}
                            className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-600 cursor-pointer"
                            title="Cancel"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between text-xs">
                          {notes ? (
                            <div
                              onClick={() => handleStartEditNote(item.id, notes)}
                              className="flex items-center gap-1.5 text-amber-900 bg-amber-50 hover:bg-amber-100/80 px-2 py-0.5 rounded-md border border-amber-200/80 cursor-pointer transition-colors"
                              title="Click to edit instructions"
                            >
                              <span className="font-semibold truncate max-w-[220px]">
                                📝 {notes}
                              </span>
                              <FileEdit className="w-3 h-3 text-amber-700 shrink-0" />
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleStartEditNote(item.id)}
                              disabled={isDisabled}
                              className="text-[11px] font-semibold text-[#3F72AF] hover:underline cursor-pointer flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Add instructions</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => onRemoveItem(item.id)}
                            disabled={isDisabled}
                            className="text-[11px] font-semibold text-[#9BA4B4] hover:text-[#C94A4A] cursor-pointer transition-colors"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Footer / Checkout Controls */}
            <div className="p-4 sm:p-5 bg-white border-t border-[#9BA4B4]/20 space-y-3 shrink-0">
              {/* Dining Type Selector */}
              <div>
                <DiningTypeSelector
                  value={diningType}
                  onChange={onDiningTypeChange}
                  disabled={isDisabled}
                />
              </div>

              {/* Seating Table Row for Dine-In */}
              {diningType === 'dine-in' && onChangeTable && (
                <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs animate-in fade-in duration-150">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-slate-500 font-bold">Seating:</span>
                    {tableNum ? (
                      <span className="font-extrabold text-[#14274E] bg-[#14274E]/10 px-2 py-0.5 rounded-md">
                        Table {tableNum}
                      </span>
                    ) : (
                      <span className="font-extrabold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                        No table selected
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={onChangeTable}
                    disabled={isDisabled}
                    className="text-xs font-extrabold text-[#14274E] hover:text-[#1f3b73] hover:underline cursor-pointer ml-2 shrink-0"
                  >
                    {tableNum ? 'Change' : 'Select Table'}
                  </button>
                </div>
              )}

              {/* Cost Summary */}
              <div className="flex items-center justify-between pt-1">
                <div>
                  <span className="text-[11px] font-black text-[#9BA4B4] uppercase tracking-wider block">
                    Total Amount
                  </span>
                  <span className="text-[10px] font-bold text-[#9BA4B4]">
                    INCL. 5% TAX
                  </span>
                </div>
                <span className="text-2xl font-black text-[#14274E]">
                  ₱{total.toFixed(2)}
                </span>
              </div>

              {/* Place Order CTA Button */}
              <button
                onClick={onPlaceOrder}
                disabled={isDisabled}
                className="w-full bg-[#E9C46A] hover:bg-[#d6b35d] text-[#14274E] h-[50px] rounded-xl font-black text-base flex items-center justify-center gap-2 shadow-sm hover:shadow-md hover:shadow-amber-500/25 disabled:opacity-60 cursor-pointer transition-all active:scale-95"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Submitting Order…</span>
                  </>
                ) : isLockedByOther ? (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Tablemate is ordering…</span>
                  </>
                ) : (
                  <>
                    <span>Place Order (₱{total.toFixed(2)})</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {/* Collapse / Continue Browsing */}
              <button
                type="button"
                onClick={onClose}
                className="w-full text-center text-xs font-bold text-[#394867] hover:text-[#14274E] py-1 cursor-pointer transition-colors"
              >
                ← Keep Browsing Menu
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── 2. COLLAPSED FLOATING SUMMARY BAR ── */}
      {!isExpanded && (
        <div className="fixed bottom-[80px] sm:bottom-[84px] inset-x-0 z-40 px-3 sm:px-4 pointer-events-none animate-slide-up">
          <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-[0_10px_35px_rgba(20,39,78,0.2)] border border-[#9BA4B4]/25 p-2.5 sm:p-3 max-w-lg mx-auto pointer-events-auto transition-all duration-200 flex items-center justify-between gap-3">
            {/* Left: Clickable expand area with shopping bag & price */}
            <button
              type="button"
              onClick={onToggleExpand}
              className="flex items-center gap-2.5 flex-1 min-w-0 text-left hover:opacity-90 active:scale-98 transition-all cursor-pointer group"
              title="Click to expand and view cart items"
              aria-label="View cart items"
            >
              <div className="w-10 h-10 rounded-xl bg-[#14274E] text-[#E9C46A] flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-black text-[#9BA4B4] uppercase tracking-wider">
                    {itemCount} {itemCount === 1 ? 'Item' : 'Items'}
                  </span>
                  <span className="text-[10px] font-bold text-[#3F72AF] flex items-center group-hover:underline">
                    View Cart <ChevronUp className="w-3 h-3 ml-0.5" />
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-lg font-black text-[#14274E] leading-tight">
                    ₱{total.toFixed(2)}
                  </span>
                  <span className="text-[9px] font-bold text-[#9BA4B4]">
                    INCL. TAX
                  </span>
                </div>
              </div>
            </button>

            {/* Right: Place Order CTA */}
            <button
              onClick={onPlaceOrder}
              disabled={isDisabled}
              className="bg-[#E9C46A] hover:bg-[#d6b35d] text-[#14274E] h-[44px] px-4 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-xs hover:shadow-md hover:shadow-amber-500/25 disabled:opacity-60 cursor-pointer transition-all active:scale-95 shrink-0"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isLockedByOther ? (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span>Ordering…</span>
                </>
              ) : (
                <>
                  <span>Place Order</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
