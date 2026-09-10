import { useState, useEffect } from 'react'
import {
  Clock,
  Check,
  Copy,
  AlertTriangle,
  RotateCcw,
  Receipt,
  User,
  UtensilsCrossed,
  Info,
  ShieldAlert,
} from 'lucide-react'
import type { AdvanceOrder } from '@/types/advanceOrder'
import { getRemainingSeconds, formatCountdown } from '@/services/advanceOrderService'

interface AdvanceOrderTabProps {
  order: AdvanceOrder
  onStartNewOrder: () => void
}

export function AdvanceOrderTab({ order, onStartNewOrder }: AdvanceOrderTabProps) {
  const [remainingSeconds, setRemainingSeconds] = useState(() =>
    getRemainingSeconds(order.expiresAt),
  )
  const [copied, setCopied] = useState(false)
  const [confirmNewOpen, setConfirmNewOpen] = useState(false)

  // Live 1-second countdown interval
  useEffect(() => {
    // Initial sync
    setRemainingSeconds(getRemainingSeconds(order.expiresAt))

    const interval = setInterval(() => {
      const remaining = getRemainingSeconds(order.expiresAt)
      setRemainingSeconds(remaining)
      if (remaining <= 0) {
        clearInterval(interval)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [order.expiresAt])

  const isExpired = remainingSeconds <= 0
  const countdownFormatted = formatCountdown(remainingSeconds)

  // Calculate percentage remaining of 30 minutes (1800 seconds)
  const totalDuration = 30 * 60
  const progressPercent = Math.min(100, Math.max(0, (remainingSeconds / totalDuration) * 100))

  const handleCopyReference = () => {
    navigator.clipboard.writeText(order.orderNumber)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="w-full max-w-lg mx-auto px-4 pb-24 pt-2 animate-in fade-in duration-150 space-y-4">
      {/* Expiration Banner / Active Timer Card */}
      {isExpired ? (
        <div className="bg-rose-50 border-2 border-rose-200 rounded-3xl p-6 text-center shadow-xs space-y-3 animate-in zoom-in-95 duration-150">
          <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-2xs">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div>
            <span className="px-2.5 py-0.5 rounded-full bg-rose-200 text-rose-800 text-[10px] font-black uppercase tracking-wider">
              Order Expired
            </span>
            <h2 className="text-xl font-black text-rose-950 mt-1.5 tracking-tight">
              This Advanced Order has expired.
            </h2>
            <p className="text-xs text-rose-800/90 mt-1 max-w-sm mx-auto leading-relaxed">
              The 30-minute confirmation period for this order has ended. To enjoy your meal, please start a new advance order.
            </p>
          </div>
          <div className="pt-2">
            <button
              type="button"
              onClick={onStartNewOrder}
              className="w-full py-3.5 px-4 bg-rose-600 hover:bg-rose-700 active:scale-[0.99] text-white font-extrabold text-xs rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Start New Advanced Order</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
          {/* Header row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-600" />
              <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                Confirmation Window
              </span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold">
              30m Max Window
            </span>
          </div>

          {/* Big Countdown Display */}
          <div className="text-center py-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block">
              Order Expires In
            </span>
            <div className="text-5xl sm:text-6xl font-black text-[#14274E] font-mono tracking-tight my-1">
              {countdownFormatted}
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-100 rounded-full h-2.5 mt-3 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${
                  progressPercent > 30 ? 'bg-amber-500' : 'bg-rose-500 animate-pulse'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-1.5 font-medium">
              Timer is locked to server timestamp and persists through page reloads.
            </p>
          </div>

          {/* Instructions box */}
          <div className="p-3.5 bg-amber-50/80 border border-amber-200/80 rounded-2xl flex items-start gap-2.5 text-xs text-amber-950">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5 leading-relaxed">
              <p className="font-extrabold text-amber-900 text-[11px]">
                How to finalize your order:
              </p>
              <p className="text-[11px] text-amber-900/90">
                Please proceed to the cashier counter and present your{' '}
                <strong className="font-bold underline">Order Reference</strong> before the countdown expires to confirm preparation and payment.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Order Reference Card */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-3">
        <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
          Order Identification
        </span>

        <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-200/70">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase">Order Reference</span>
            <div className="text-2xl font-black text-[#14274E] font-mono tracking-wider">
              {order.orderNumber}
            </div>
          </div>
          <button
            type="button"
            onClick={handleCopyReference}
            className="px-3 py-2 rounded-xl bg-white border border-slate-200 hover:border-slate-300 text-slate-700 font-extrabold text-xs flex items-center gap-1.5 shadow-2xs active:scale-95 transition-all cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-500" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>

        {/* Customer info & Dining Type tags */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60">
            <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
              <User className="w-3 h-3 text-slate-400" />
              Customer
            </span>
            <p className="text-xs font-black text-slate-800 mt-0.5 truncate">{order.customerName}</p>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60">
            <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
              <UtensilsCrossed className="w-3 h-3 text-slate-400" />
              Dining Type
            </span>
            <p className="text-xs font-black text-slate-800 mt-0.5 capitalize">
              {order.diningType === 'take-away' ? 'Takeout' : 'Dine-In'}
            </p>
          </div>
        </div>
      </div>

      {/* Itemized Order Receipt */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-1.5 text-slate-700">
            <Receipt className="w-4 h-4 text-[#14274E]" />
            <h3 className="text-xs font-black uppercase tracking-wider text-[#14274E]">
              Order Summary
            </h3>
          </div>
          <span className="text-[11px] font-bold text-slate-400">
            {order.items.reduce((s, i) => s + i.quantity, 0)} items
          </span>
        </div>

        {/* Item List */}
        <div className="divide-y divide-slate-100">
          {order.items.map((item, idx) => (
            <div key={idx} className="py-2.5 flex items-start justify-between gap-3 text-xs">
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-extrabold text-slate-900 leading-snug">
                    {item.itemName}
                  </span>
                  <span className="text-[11px] font-bold text-slate-400">
                    ×{item.quantity}
                  </span>
                </div>
                {item.notes && (
                  <p className="text-[11px] text-amber-700 italic mt-0.5">
                    Note: &quot;{item.notes}&quot;
                  </p>
                )}
                <span className="text-[10px] text-slate-400">
                  ₱{item.unitPrice.toLocaleString('en-PH', { minimumFractionDigits: 2 })} each
                </span>
              </div>
              <div className="font-black text-slate-900 shrink-0">
                ₱{item.totalPrice.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </div>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="border-t border-slate-200 pt-3 space-y-1 text-xs">
          <div className="flex justify-between text-slate-500">
            <span>Subtotal</span>
            <span>₱{order.subtotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between items-baseline pt-2 border-t border-slate-100 text-sm font-black text-[#14274E]">
            <span>Total Amount</span>
            <span className="text-lg">
              ₱{order.totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* Start New Order Options */}
      {!isExpired && (
        <div className="text-center pt-2">
          {confirmNewOpen ? (
            <div className="p-4 bg-slate-100 rounded-2xl space-y-2 border border-slate-200 animate-in fade-in duration-150">
              <p className="text-xs font-bold text-slate-700">
                Start a new order? Your current order ({order.orderNumber}) will remain saved.
              </p>
              <div className="flex items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setConfirmNewOpen(false)}
                  className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  Keep Current Order
                </button>
                <button
                  type="button"
                  onClick={onStartNewOrder}
                  className="px-3 py-1.5 text-xs font-extrabold bg-[#14274E] text-white rounded-xl hover:bg-[#1f3b73] transition-colors cursor-pointer shadow-xs"
                >
                  Start New Order
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmNewOpen(true)}
              className="text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors py-2 px-3 rounded-xl hover:bg-slate-100 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Start Another Advanced Order</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
