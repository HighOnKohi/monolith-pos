import { useState } from 'react'
import { X, AlertTriangle, PackageX, Clock, Ban, MessageSquare, Loader2 } from 'lucide-react'
import type { KitchenOrder } from '@/services/kitchenService'

interface CancelOrderModalProps {
  order: KitchenOrder
  onClose: () => void
  onConfirm: (reason: string, outOfStockItemIds: string[]) => Promise<void>
}

const REASONS = [
  { id: 'OUT_OF_STOCK', label: 'Item Out of Stock', icon: PackageX },
  { id: 'OVERLOADED', label: 'Kitchen Capacity Overloaded', icon: Clock },
  { id: 'INGREDIENT_UNAVAILABLE', label: 'Key Ingredient Unavailable', icon: Ban },
  { id: 'OTHER', label: 'Other Reason', icon: MessageSquare },
]

export function CancelOrderModal({ order, onClose, onConfirm }: CancelOrderModalProps) {
  const [selectedReason, setSelectedReason] = useState('OUT_OF_STOCK')
  const [customNote, setCustomNote] = useState('')
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>(
    order.items?.map((i) => i.itemId) ?? []
  )
  const [isSubmitting, setIsSubmitting] = useState(false)

  const toggleItem = (id: string) => {
    setSelectedItemIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  const handleConfirm = async () => {
    setIsSubmitting(true)
    try {
      const reasonLabel =
        REASONS.find((r) => r.id === selectedReason)?.label || 'Order Cancelled'
      const finalReason = customNote
        ? `${reasonLabel}: ${customNote}`
        : reasonLabel

      await onConfirm(
        finalReason,
        selectedReason === 'OUT_OF_STOCK' ? selectedItemIds : []
      )
      onClose()
    } catch (err) {
      console.error(err)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#14274E]/45 backdrop-blur-md animate-backdrop-fade"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl z-10 animate-modal-pop max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-[#9BA4B4]/20">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center shadow-2xs">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-[#14274E]">
                Reject / Cancel Order #{order.orderId}
              </h3>
              <p className="text-xs text-[#394867] font-semibold">
                Table {order.tableNum ?? order.tableId} • Kitchen Stock Check
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-[#F1F6F9] text-[#9BA4B4] active:scale-90 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Reason Selection */}
        <div className="mt-4">
          <label className="text-xs font-bold text-[#394867] uppercase tracking-wider block mb-2">
            Why can't this order be processed?
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {REASONS.map((r) => {
              const Icon = r.icon
              const isSelected = selectedReason === r.id
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelectedReason(r.id)}
                  className={[
                    'p-3 rounded-2xl border text-left flex items-center gap-2.5 transition-all interactive-card cursor-pointer',
                    isSelected
                      ? 'border-red-500 bg-red-50/70 text-red-900 ring-2 ring-red-200 shadow-xs'
                      : 'border-[#9BA4B4]/30 hover:border-[#9BA4B4]/60 bg-white text-[#394867] shadow-2xs',
                  ].join(' ')}
                >
                  <Icon className={['w-4 h-4 shrink-0', isSelected ? 'text-red-600' : 'text-[#9BA4B4]'].join(' ')} />
                  <span className="text-xs font-bold leading-snug">{r.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Out of Stock Item Selector */}
        {selectedReason === 'OUT_OF_STOCK' && (
          <div className="mt-4 p-4 rounded-2xl bg-amber-50/80 border border-amber-200">
            <label className="text-xs font-black text-amber-900 uppercase tracking-wide block mb-1">
              Select dish(es) out of stock:
            </label>
            <p className="text-[11px] text-amber-800 mb-2">
              Marked items will be set to <strong>OUT OF STOCK</strong> globally and cannot be ordered by any customer.
            </p>

            <div className="space-y-1.5">
              {order.items?.map((it) => {
                const isChecked = selectedItemIds.includes(it.itemId)
                return (
                  <label
                    key={it.orderItemId}
                    className="flex items-center gap-2.5 p-2 rounded-xl bg-white border border-amber-200/80 cursor-pointer hover:bg-amber-100/30 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleItem(it.itemId)}
                      className="w-4 h-4 rounded text-red-600 focus:ring-red-500"
                    />
                    <span className="text-xs font-bold text-[#14274E]">
                      {it.quantity}x {it.name}
                    </span>
                  </label>
                )
              })}
            </div>
          </div>
        )}

        {/* Notes input */}
        <div className="mt-4">
          <label className="text-xs font-bold text-[#394867] uppercase tracking-wider block mb-1">
            Explanation / Note to table (optional)
          </label>
          <input
            type="text"
            value={customNote}
            onChange={(e) => setCustomNote(e.target.value)}
            placeholder="e.g. Fresh salmon delivery was delayed, sorry for the inconvenience"
            className="w-full px-3.5 py-2.5 rounded-xl border border-[#9BA4B4]/40 text-xs text-[#14274E] placeholder-[#9BA4B4] focus:outline-hidden focus:border-red-500"
          />
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 px-4 rounded-xl border border-[#9BA4B4]/40 text-xs font-bold text-[#394867] hover:bg-[#F1F6F9] active:scale-95 transition-all cursor-pointer"
          >
            Back / Keep Order
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleConfirm}
            className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-extrabold interactive-button flex items-center justify-center gap-2 shadow-sm disabled:opacity-60 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Cancelling...</span>
              </>
            ) : (
              <span>Confirm & Reject Order</span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
