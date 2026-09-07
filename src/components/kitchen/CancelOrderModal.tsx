import { useState } from 'react'
import { X, AlertTriangle, Flag, Loader2 } from 'lucide-react'
import type { KitchenOrder } from '@/services/kitchenService'

interface CancelOrderModalProps {
  order: KitchenOrder
  onClose: () => void
  onConfirm: (note: string, flaggedItemIds: string[]) => Promise<void>
}

export function CancelOrderModal({ order, onClose, onConfirm }: CancelOrderModalProps) {
  const groupedItems = Array.from(
    order.items.reduce(
      (groups, item) => {
        const group = groups.get(item.itemId)
        if (group) {
          group.items.push(item)
        } else {
          groups.set(item.itemId, { name: item.name, items: [item] })
        }
        return groups
      },
      new Map<string, { name?: string; items: typeof order.items }>(),
    ),
  )

  const [note, setNote] = useState(order.kitchenNote ?? '')
  const [flaggedItemIds, setFlaggedItemIds] = useState<string[]>(() =>
    groupedItems
      .filter(([, group]) => group.items.some((item) => item.isFlagged))
      .map(([itemId]) => itemId),
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const toggleFlag = (itemId: string) => {
    setFlaggedItemIds((current) =>
      current.includes(itemId)
        ? current.filter((id) => id !== itemId)
        : [...current, itemId],
    )
  }

  const handleConfirm = async () => {
    setIsSubmitting(true)
    setErrorMsg(null)
    try {
      await onConfirm(note, flaggedItemIds)
      onClose()
    } catch (err: unknown) {
      console.error('[CancelOrderModal] Rejection failed:', err)
      setErrorMsg(err instanceof Error ? err.message : 'Database error while rejecting order')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/20"
        onClick={onClose}
      />

      <div className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#9BA4B4]/20 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-100 text-red-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-[#14274E]">
                Reject Order #{order.orderId}
              </h3>
              <p className="text-xs font-semibold text-[#394867]">
                Table {order.tableNum ?? order.tableId}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-[#9BA4B4] hover:bg-[#F1F6F9]"
            aria-label="Close reject order dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#394867]">
            Flag items that need attention
          </p>
          <div className="space-y-1.5">
            {groupedItems.map(([itemId, group]) => {
              const isFlagged = flaggedItemIds.includes(itemId)
              return (
                <div
                  key={itemId}
                  className="flex items-center justify-between rounded-xl border border-[#9BA4B4]/20 bg-[#F1F6F9]/60 px-3 py-2"
                >
                  <span className="text-xs font-bold text-[#14274E]">
                    {group.name || `Item #${itemId}`}
                    <span className="ml-2 text-[#9BA4B4]">x{group.items.length}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleFlag(itemId)}
                    aria-pressed={isFlagged}
                    title={isFlagged ? 'Remove item flag' : 'Flag item'}
                    className={[
                      'flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-black transition-colors',
                      isFlagged
                        ? 'bg-amber-100 text-amber-700'
                        : 'text-[#9BA4B4] hover:bg-amber-50 hover:text-amber-600',
                    ].join(' ')}
                  >
                    <Flag className="h-3.5 w-3.5" fill={isFlagged ? 'currentColor' : 'none'} />
                    {isFlagged ? 'Flagged' : 'Flag'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-[#394867]">
            Explanation for cashier
          </label>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Explain why this order is being rejected"
            rows={3}
            className="w-full resize-none rounded-xl border border-[#9BA4B4]/40 px-3.5 py-2.5 text-xs text-[#14274E] placeholder-[#9BA4B4] focus:border-red-500 focus:outline-none"
          />
        </div>

        {errorMsg && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-300 bg-red-50 p-3 text-xs font-semibold text-red-800">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-[#9BA4B4]/40 px-4 py-2.5 text-xs font-bold text-[#394867] hover:bg-[#F1F6F9]"
          >
            Back / Keep Order
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => void handleConfirm()}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-xs font-extrabold text-white hover:bg-red-700 disabled:opacity-60"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isSubmitting ? 'Rejecting...' : 'Confirm & Reject Order'}
          </button>
        </div>
      </div>
    </div>
  )
}
