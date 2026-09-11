import React from 'react'
import {
  ChevronDown,
  ChevronUp,
  ShoppingBag,
  Ticket,
  Trash2,
  Plus,
  Minus,
  Send,
} from 'lucide-react'
import type { TicketCartItem } from '@/types/ticket'

interface TicketingCollapsibleCartProps {
  activeTicketId: number
  cart: TicketCartItem[]
  isExpanded: boolean
  onToggleExpand: () => void
  onClose: () => void
  onIncreaseQty: (itemId: string) => void
  onDecreaseQty: (itemId: string) => void
  onRemoveItem: (itemId: string) => void
  onClearCart: () => void
  onOpenCustomerModal: () => void
}

export const TicketingCollapsibleCart: React.FC<TicketingCollapsibleCartProps> = ({
  activeTicketId,
  cart,
  isExpanded,
  onToggleExpand,
  onClose,
  onIncreaseQty,
  onDecreaseQty,
  onRemoveItem,
  onClearCart,
  onOpenCustomerModal,
}) => {
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0)
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const total = subtotal

  return (
    <div className="lg:hidden">
      {/* ── 1. EXPANDED CART DRAWER / BOTTOM SHEET ── */}
      {isExpanded && (
        <>
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 bg-[#14274E]/50 backdrop-blur-xs z-[70] animate-fade-in transition-opacity"
            onClick={onClose}
          />

          {/* Bottom Drawer Container */}
          <div
            className="fixed bottom-0 inset-x-0 z-[80] bg-white rounded-t-3xl shadow-[0_-16px_50px_rgba(20,39,78,0.28)] max-h-[85vh] flex flex-col animate-slide-up border-t border-slate-200"
            role="dialog"
            aria-modal="true"
            aria-label="Ticket Cart Drawer"
          >
            {/* Grab Handle */}
            <div className="flex justify-center pt-3 pb-1 shrink-0 cursor-pointer" onClick={onClose}>
              <div className="w-12 h-1 bg-slate-300 rounded-full" />
            </div>

            {/* Drawer Header */}
            <div className="flex items-center justify-between px-4 sm:px-5 py-2.5 border-b border-slate-200/80 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#14274E] text-[#E9C46A] flex items-center justify-center shadow-xs">
                  <Ticket className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-[#14274E] leading-tight">
                    Ticket Cart
                  </h3>
                  <p className="text-[11px] font-semibold text-slate-400">
                    Ticket #{activeTicketId} • {itemCount} {itemCount === 1 ? 'item' : 'items'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {cart.length > 0 && (
                  <button
                    type="button"
                    onClick={onClearCart}
                    className="flex items-center gap-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 px-3 py-2 rounded-xl transition-colors cursor-pointer min-h-[36px]"
                    title="Clear Cart"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 rounded-full hover:bg-slate-100 text-[#14274E] transition-colors cursor-pointer"
                  aria-label="Collapse cart"
                  title="Collapse cart"
                >
                  <ChevronDown className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5 overscroll-contain">
              {cart.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                  <ShoppingBag className="w-8 h-8 text-slate-300" />
                  <span className="font-semibold text-slate-600">Ticket Cart is empty</span>
                  <span className="text-[11px] text-slate-400">
                    Select dishes or meal packages from the catalog to build Ticket #{activeTicketId}.
                  </span>
                </div>
              ) : (
                cart.map((ci) => (
                  <div
                    key={ci.id}
                    className="p-3 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2.5">
                      <img
                        src={ci.imageUrl}
                        alt={ci.name}
                        className="w-13 h-13 rounded-xl object-cover shrink-0 bg-slate-100"
                      />
                      <div className="flex-1 min-w-0">
                        <h5 className="text-xs sm:text-sm font-bold text-[#14274E] truncate">
                          {ci.name}
                        </h5>
                        <span className="text-xs sm:text-sm font-black text-[#14274E]">
                          ₱{(ci.price * ci.quantity).toLocaleString('en-PH', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </div>

                      {/* Stepper */}
                      <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl p-1">
                        <button
                          onClick={() => onDecreaseQty(ci.id)}
                          className="w-7 h-7 sm:w-6 sm:h-6 rounded-lg flex items-center justify-center bg-white text-slate-600 hover:bg-slate-200 text-xs font-bold cursor-pointer active:scale-95 shadow-2xs"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="w-3 h-3 sm:w-2.5 sm:h-2.5" />
                        </button>
                        <span className="text-xs font-black w-5 text-center text-[#14274E]">
                          {ci.quantity}
                        </span>
                        <button
                          onClick={() => onIncreaseQty(ci.id)}
                          className="w-7 h-7 sm:w-6 sm:h-6 rounded-lg flex items-center justify-center bg-[#14274E] text-white hover:bg-[#203c73] text-xs font-bold cursor-pointer active:scale-95 shadow-2xs"
                          aria-label="Increase quantity"
                        >
                          <Plus className="w-3 h-3 sm:w-2.5 sm:h-2.5" />
                        </button>
                      </div>

                      <button
                        onClick={() => onRemoveItem(ci.id)}
                        className="text-slate-400 hover:text-rose-600 p-2 rounded-lg cursor-pointer transition-colors"
                        title="Remove"
                        aria-label="Remove item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Bottom Sticky Action Footer */}
            {cart.length > 0 && (
              <div className="p-4 border-t border-slate-100 bg-slate-50/90 shrink-0 space-y-2.5 pb-safe">
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between text-slate-500">
                    <span>Subtotal ({itemCount} items)</span>
                    <span>
                      ₱{subtotal.toLocaleString('en-PH', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm sm:text-base font-black text-[#14274E] pt-1.5 border-t border-slate-200">
                    <span>Total Amount</span>
                    <span>
                      ₱{total.toLocaleString('en-PH', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    onClose()
                    onOpenCustomerModal()
                  }}
                  className="w-full py-3.5 sm:py-3 rounded-2xl sm:rounded-xl bg-[#14274E] hover:bg-[#203c73] text-white text-sm font-black flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md active:scale-98 min-h-[48px]"
                >
                  <Send className="w-4 h-4 text-[#E9C46A]" />
                  <span>Punch Ticket Order (Ticket #{activeTicketId}) →</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="w-full text-center text-xs font-bold text-slate-500 hover:text-[#14274E] py-2 cursor-pointer transition-colors"
                >
                  ← Keep Browsing Catalog
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── 2. COLLAPSED FLOATING SUMMARY BAR ── */}
      {!isExpanded && cart.length > 0 && (
        <div className="fixed bottom-[104px] sm:bottom-[108px] inset-x-0 z-40 px-3 sm:px-4 pointer-events-none animate-slide-up">
          <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-[0_10px_35px_rgba(20,39,78,0.2)] border border-slate-200/90 p-2.5 sm:p-3 max-w-lg mx-auto pointer-events-auto transition-all duration-200 flex items-center justify-between gap-3">
            {/* Left: Clickable expand area with shopping bag & price */}
            <button
              type="button"
              onClick={onToggleExpand}
              className="flex items-center gap-2.5 flex-1 min-w-0 text-left hover:opacity-90 active:scale-98 transition-all cursor-pointer group"
              title="Click to expand and view ticket cart"
              aria-label="View ticket cart"
            >
              <div className="w-10 h-10 rounded-xl bg-[#14274E] text-[#E9C46A] flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">
                    {itemCount} {itemCount === 1 ? 'Item' : 'Items'}
                  </span>
                  <span className="text-[10px] font-bold text-[#14274E] flex items-center group-hover:underline">
                    View Cart <ChevronUp className="w-3 h-3 ml-0.5" />
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-base sm:text-lg font-black text-[#14274E] leading-tight">
                    ₱{total.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </button>

            {/* Right: Punch Order Quick CTA */}
            <button
              onClick={onOpenCustomerModal}
              className="bg-[#14274E] hover:bg-[#203c73] text-white h-[46px] sm:h-[42px] px-4 sm:px-4 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-xs hover:shadow-md active:scale-95 transition-all cursor-pointer shrink-0 min-h-[44px]"
            >
              <Send className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-[#E9C46A]" />
              <span>Punch Order</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
