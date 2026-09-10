import React from 'react'
import {
  Send,
  Trash2,
  Ticket,
  Plus,
  Minus,
} from 'lucide-react'
import type { TicketCartItem } from '@/types/ticket'

interface TicketingRightPanelProps {
  activeTicketId: number
  // Cart state
  cart: TicketCartItem[]
  onIncreaseQty: (itemId: string) => void
  onDecreaseQty: (itemId: string) => void
  onRemoveItem: (itemId: string) => void
  onClearCart: () => void
  onOpenCustomerModal: () => void
}

export const TicketingRightPanel: React.FC<TicketingRightPanelProps> = ({
  activeTicketId,
  cart,
  onIncreaseQty,
  onDecreaseQty,
  onRemoveItem,
  onClearCart,
  onOpenCustomerModal,
}) => {
  // Calculations
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const tax = subtotal * 0.05
  const total = subtotal + tax

  return (
    <div className="ticketing-right-panel-wrapper flex flex-col h-full bg-white">
      {/* Top Header */}
      <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Ticket className="w-4 h-4 text-[#14274E]" />
          <h2 className="text-sm font-black text-[#14274E]">Ticket Cart</h2>
        </div>
        <span className="text-xs font-black text-[#14274E] bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
          Ticket #{activeTicketId}
        </span>
      </div>

      {/* Cart Items List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {cart.length === 0 ? (
          <div className="py-20 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
            <Plus className="w-8 h-8 text-slate-300" />
            <span className="font-semibold text-slate-600">Ticket Cart is empty</span>
            <span className="text-[11px] text-slate-400">
              Select dishes or group items from the catalog to build Ticket #{activeTicketId}.
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
                <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg p-0.5">
                  <button
                    onClick={() => onDecreaseQty(ci.id)}
                    className="w-6 h-6 rounded-md flex items-center justify-center bg-white text-slate-600 hover:bg-slate-200 text-xs font-bold cursor-pointer"
                  >
                    <Minus className="w-2.5 h-2.5" />
                  </button>
                  <span className="text-xs font-bold w-4 text-center">
                    {ci.quantity}
                  </span>
                  <button
                    onClick={() => onIncreaseQty(ci.id)}
                    className="w-6 h-6 rounded-md flex items-center justify-center bg-[#14274E] text-white hover:bg-[#203c73] text-xs font-bold cursor-pointer"
                  >
                    <Plus className="w-2.5 h-2.5" />
                  </button>
                </div>

                <button
                  onClick={() => onRemoveItem(ci.id)}
                  className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer transition-colors"
                  title="Remove"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Subtotal & Punch Order Footer */}
      <div className="p-4 border-t border-slate-100 bg-slate-50/80 shrink-0 space-y-2.5">
        <div className="space-y-1 text-xs">
          <div className="flex justify-between text-slate-500">
            <span>Subtotal ({cart.reduce((s, c) => s + c.quantity, 0)} items)</span>
            <span>
              ₱{subtotal.toLocaleString('en-PH', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
          <div className="flex justify-between text-slate-500">
            <span>Tax (5%)</span>
            <span>
              ₱{tax.toLocaleString('en-PH', {
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

        <div className="space-y-2 pt-1">
          <button
            disabled={cart.length === 0}
            onClick={onOpenCustomerModal}
            className="w-full py-2.5 rounded-xl bg-[#14274E] hover:bg-[#203c73] disabled:opacity-50 text-white text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
          >
            <Send className="w-3.5 h-3.5 text-[#E9C46A]" />
            <span>Punch Ticket Order (Ticket #{activeTicketId}) →</span>
          </button>

          <button
            disabled={cart.length === 0}
            onClick={onClearCart}
            className="w-full py-1.5 rounded-xl border border-rose-200 bg-rose-50/50 hover:bg-rose-100/60 disabled:opacity-40 text-rose-600 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Cart</span>
          </button>
        </div>
      </div>
    </div>
  )
}
