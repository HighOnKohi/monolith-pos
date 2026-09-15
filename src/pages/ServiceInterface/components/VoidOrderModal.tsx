import { useState, useEffect } from 'react'
import { X, ShieldAlert, Trash2, Lock, Loader2, AlertTriangle } from 'lucide-react'
import type { Order } from '@/types/order'

interface VoidOrderModalProps {
  isOpen: boolean
  order: Order | null
  tableLabel: string
  initialItemId?: number | null
  onClose: () => void
  onConfirmVoid: (orderId: number, orderItemIds: number[], password: string) => Promise<void>
}

export function VoidOrderModal({
  isOpen,
  order,
  tableLabel,
  initialItemId,
  onClose,
  onConfirmVoid,
}: VoidOrderModalProps) {
  const [selectedItemIds, setSelectedItemIds] = useState<number[]>([])
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const activeItems = (order?.items ?? []).filter((item) => item.status !== 'CANCELLED')

  useEffect(() => {
    if (!isOpen || !order) return
    setError(null)
    setPassword('')
    setSubmitting(false)

    if (initialItemId && activeItems.some((i) => i.orderItemId === initialItemId)) {
      setSelectedItemIds([initialItemId])
    } else {
      // Pre-select all active items if opening for entire order
      setSelectedItemIds(activeItems.map((i) => i.orderItemId))
    }
  }, [isOpen, order, initialItemId])

  if (!isOpen || !order) return null

  const isAllSelected = activeItems.length > 0 && selectedItemIds.length === activeItems.length

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedItemIds([])
    } else {
      setSelectedItemIds(activeItems.map((i) => i.orderItemId))
    }
  }

  const toggleItem = (orderItemId: number) => {
    setSelectedItemIds((prev) =>
      prev.includes(orderItemId) ? prev.filter((id) => id !== orderItemId) : [...prev, orderItemId],
    )
  }

  const selectedTotal = activeItems
    .filter((i) => selectedItemIds.includes(i.orderItemId))
    .reduce((sum, i) => sum + (Number(i.price) || 0), 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedItemIds.length === 0) {
      setError('Please select at least one item to void.')
      return
    }
    if (!password.trim()) {
      setError('Admin password is required.')
      return
    }

    setError(null)
    setSubmitting(true)

    try {
      await onConfirmVoid(order.orderId, selectedItemIds, password.trim())
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to void selected items.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4 animate-backdrop-fade"
      onClick={() => !submitting && onClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden animate-modal-pop"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-[#14274E]">Void Order / Items</h3>
              <p className="text-[11px] font-bold text-slate-500">
                {tableLabel} · Order #{order.orderId} (Pending)
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)}>
          <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
            {/* Explanatory banner */}
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-900 text-xs font-medium leading-relaxed">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                Voiding items requires administrator authorization. Select the item(s) to remove from this pending order.
              </span>
            </div>

            {/* Item Selection List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-extrabold text-slate-700">Select Items to Void:</span>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={toggleSelectAll}
                  className="text-xs font-bold text-rose-600 hover:text-rose-700 cursor-pointer"
                >
                  {isAllSelected ? 'Deselect All' : 'Select All / Entire Order'}
                </button>
              </div>

              <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden">
                {activeItems.map((item) => {
                  const isChecked = selectedItemIds.includes(item.orderItemId)
                  return (
                    <label
                      key={item.orderItemId}
                      className={`flex items-center justify-between p-3 cursor-pointer transition-colors ${
                        isChecked ? 'bg-rose-50/60' : 'hover:bg-slate-100/50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={submitting}
                          onChange={() => toggleItem(item.orderItemId)}
                          className="h-4 w-4 rounded text-rose-600 focus:ring-rose-500 border-slate-300 cursor-pointer"
                        />
                        <div>
                          <p className="text-xs font-bold text-slate-800">
                            {item.name || `Item #${item.itemId}`}
                          </p>
                          <p className="text-[10px] text-slate-400 font-semibold">
                            Portion ID: #{item.orderItemId}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-black text-[#14274E]">
                        ₱{(Number(item.price) || 0).toFixed(2)}
                      </span>
                    </label>
                  )
                })}
              </div>

              <div className="flex items-center justify-between text-[11px] font-bold px-1 pt-1 text-slate-500">
                <span>
                  {selectedItemIds.length} of {activeItems.length} item(s) selected
                </span>
                <span className="text-rose-700 font-black">
                  Void Value: ₱{selectedTotal.toFixed(2)}
                </span>
              </div>

              {isAllSelected && (
                <p className="text-[11px] font-extrabold text-rose-600 bg-rose-50 border border-rose-200 p-2 rounded-lg text-center">
                  Notice: Voiding all items will completely delete and cancel Order #{order.orderId}.
                </p>
              )}
            </div>

            {/* Admin Password Input */}
            <div className="space-y-1.5 pt-1">
              <label className="block text-xs font-bold text-slate-700">
                Administrator Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  required
                  disabled={submitting}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    if (error) setError(null)
                  }}
                  placeholder="Enter administrator password"
                  autoComplete="current-password"
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 focus:border-[#14274E] focus:ring-2 focus:ring-[#14274E]/10 outline-hidden transition-all bg-white"
                />
              </div>
              <p className="text-[10px] text-slate-400 font-semibold">
                Use your system administrator credentials to authorize this void action.
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold animate-shake">
                {error}
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 border-t border-slate-100 bg-slate-50">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || selectedItemIds.length === 0 || !password.trim()}
              className="px-4 py-2 rounded-xl text-xs font-black text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isAllSelected ? 'Void Entire Order' : 'Void Selected Items'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
