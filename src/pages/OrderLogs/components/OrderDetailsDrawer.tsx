import React, { useEffect, useState } from 'react'
import {
  X,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Tag,
  Ticket,
} from 'lucide-react'
import {
  fetchOrderDetails,
  type OrderLogRow,
  type OrderLogDetails,
} from '@/services/orderLogsService'
import type { OrderStatus } from '@/types/order'

interface OrderDetailsDrawerProps {
  order: OrderLogRow | null
  isOpen: boolean
  onClose: () => void
}

export const OrderDetailsDrawer: React.FC<OrderDetailsDrawerProps> = ({
  order,
  isOpen,
  onClose,
}) => {
  const [details, setDetails] = useState<OrderLogDetails | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<'items' | 'timeline' | 'payment'>('items')

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Load detailed order data when drawer opens
  useEffect(() => {
    if (!isOpen || !order) {
      setDetails(null)
      setError(null)
      return
    }

    let isMounted = true
    setLoading(true)
    setError(null)

    fetchOrderDetails(order.orderId)
      .then((data) => {
        if (isMounted) {
          setDetails(data)
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err?.message || 'Failed to load order details.')
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [isOpen, order])

  if (!isOpen || !order) return null

  // Format date helper
  const formatTime = (iso?: string | null) => {
    if (!iso) return '—'
    const d = new Date(iso)
    if (isNaN(d.getTime())) return iso
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    })
  }

  const renderStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200/80">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Completed</span>
          </span>
        )
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-50 text-rose-700 border border-rose-200/80">
            <XCircle className="w-3.5 h-3.5" />
            <span>Cancelled</span>
          </span>
        )
      case 'SERVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-50 text-blue-700 border border-blue-200/80">
            <Clock className="w-3.5 h-3.5" />
            <span>Served</span>
          </span>
        )
      case 'READY':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-50 text-amber-700 border border-amber-200/80">
            <Clock className="w-3.5 h-3.5" />
            <span>Ready</span>
          </span>
        )
      case 'PREPARING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-indigo-50 text-indigo-700 border border-indigo-200/80">
            <Clock className="w-3.5 h-3.5" />
            <span>Preparing</span>
          </span>
        )
      case 'VERIFIED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-teal-50 text-teal-700 border border-teal-200/80">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Confirmed</span>
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-slate-100 text-slate-700 border border-slate-200">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Order Placed</span>
          </span>
        )
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-2xs transition-opacity animate-in fade-in duration-200"
      />

      {/* Slide-over panel */}
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-xl bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-250">
          {/* ── Drawer Header ── */}
          <div className="p-4 sm:p-5 border-b border-slate-200/80 bg-slate-50/60 flex items-start justify-between gap-3 shrink-0">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xl font-black text-[#14274E]">
                  Order #{order.orderId}
                </span>
                {renderStatusBadge(order.orderStatus)}
                {order.orderType === 'TICKET' ? (
                  <span className="text-xs font-bold text-amber-900 bg-amber-50 px-2.5 py-0.5 rounded-md border border-amber-200/80 inline-flex items-center gap-1">
                    <Ticket className="w-3.5 h-3.5 text-amber-600" />
                    <span>Ticket Order</span>
                  </span>
                ) : order.isMerged ? (
                  <span className="text-xs font-bold text-indigo-900 bg-indigo-50 px-2.5 py-0.5 rounded-md border border-indigo-200/80">
                    {order.mergedGroupLabel || `Table ${order.tableNum}`}
                  </span>
                ) : (
                  <span className="text-xs font-bold text-slate-700 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                    Table {order.tableNum}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Placed on {formatTime(order.createdAt)}
              </p>
              {order.serverNote && (
                <p className="text-xs text-slate-700 font-semibold">
                  {order.serverNote}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-all cursor-pointer"
              title="Close drawer (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* ── Order Overview Strip ── */}
          <div className="grid grid-cols-3 gap-2 p-4 bg-slate-100/50 border-b border-slate-200/70 text-xs shrink-0">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400">Total Bill</span>
              <p className="font-black text-slate-900 text-base">
                ₱{order.totalBill.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </p>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400">Source & Type</span>
              <p className="font-bold text-slate-700 truncate">
                {order.orderType} · {order.requestedFrom}
              </p>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400">Serving Time</span>
              <p className="font-bold text-slate-700">
                {order.servingDurationMinutes !== null
                  ? `${order.servingDurationMinutes} mins`
                  : 'In-progress'}
              </p>
            </div>
          </div>

          {/* ── Section Navigation Tabs ── */}
          <div className="flex items-center border-b border-slate-200 text-xs font-bold shrink-0 bg-white">
            <button
              type="button"
              onClick={() => setActiveSection('items')}
              className={`flex-1 py-3 text-center border-b-2 transition-all cursor-pointer ${
                activeSection === 'items'
                  ? 'border-[#14274E] text-[#14274E] bg-slate-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Order Items ({details?.items.length ?? order.itemCount})
            </button>

            <button
              type="button"
              onClick={() => setActiveSection('timeline')}
              className={`flex-1 py-3 text-center border-b-2 transition-all cursor-pointer ${
                activeSection === 'timeline'
                  ? 'border-[#14274E] text-[#14274E] bg-slate-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Timeline & Audit
            </button>

            <button
              type="button"
              onClick={() => setActiveSection('payment')}
              className={`flex-1 py-3 text-center border-b-2 transition-all cursor-pointer ${
                activeSection === 'payment'
                  ? 'border-[#14274E] text-[#14274E] bg-slate-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Payment & Billing
            </button>
          </div>

          {/* ── Scrollable Body ── */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {loading ? (
              <div className="py-16 flex flex-col items-center justify-center gap-3">
                <div className="w-8 h-8 rounded-full border-3 border-[#14274E] border-t-transparent animate-spin" />
                <p className="text-xs font-bold text-slate-500">Loading order details...</p>
              </div>
            ) : error ? (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 space-y-1">
                <p className="font-bold">Error loading order</p>
                <p>{error}</p>
              </div>
            ) : (
              <>
                {/* ── Cancellation Banner (Prominent if Cancelled) ── */}
                {order.orderStatus === 'CANCELLED' && (
                  <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2.5">
                    <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <p className="font-black text-rose-900 text-sm">Order Cancelled</p>
                      <p className="text-rose-700/90 leading-relaxed font-medium">
                        <strong>Reason:</strong>{' '}
                        {order.kitchenNote || order.serverNote || 'Cancelled by staff.'}
                      </p>
                    </div>
                  </div>
                )}

                {/* ── TAB 1: Order Items ── */}
                {activeSection === 'items' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-black text-[#14274E] uppercase tracking-wider">
                        Ordered Line Items
                      </h3>
                      <span className="text-[11px] text-slate-400 font-bold">
                        {details?.items.length ?? 0} distinct items
                      </span>
                    </div>

                    <div className="space-y-2">
                      {details?.items.map((it) => (
                        <div
                          key={it.itemId}
                          className="p-3 rounded-xl border border-slate-200/80 bg-white flex items-start justify-between gap-3"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-extrabold text-sm text-slate-800">
                                {it.itemName}
                              </span>
                              <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                {it.categoryName}
                              </span>
                            </div>

                            {it.notes && (
                              <p className="text-[11px] text-amber-700 font-medium italic">
                                Note: {it.notes}
                              </p>
                            )}

                            <div className="text-[11px] text-slate-400">
                              ₱{it.price.toLocaleString('en-PH', { minimumFractionDigits: 2 })} each
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="font-black text-slate-900 text-sm">
                              ₱{(it.price * it.quantity).toLocaleString('en-PH', {
                                minimumFractionDigits: 2,
                              })}
                            </span>
                            <p className="text-[11px] font-bold text-indigo-600">
                              Qty: {it.quantity}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Special Instructions */}
                    {(order.kitchenNote || order.serverNote) && (
                      <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1 text-xs">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                          Special Instructions & Notes
                        </span>
                        {order.kitchenNote && (
                          <p className="text-slate-700">
                            <strong>Kitchen Note:</strong> {order.kitchenNote}
                          </p>
                        )}
                        {order.serverNote && (
                          <p className="text-slate-700">
                            <strong>Server Note:</strong> {order.serverNote}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* ── TAB 2: Timeline & Audit ── */}
                {activeSection === 'timeline' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-black text-[#14274E] uppercase tracking-wider">
                        Order Lifecycle Events
                      </h3>
                      <span className="text-[11px] text-slate-400 font-bold">
                        Chronological History
                      </span>
                    </div>

                    <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                      {details?.timeline.map((evt, idx) => {
                        const isCancelled = evt.newStatus === 'CANCELLED'
                        const isCompleted = evt.newStatus === 'COMPLETED'
                        return (
                          <div key={idx} className="relative group">
                            {/* Dot */}
                            <div
                              className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                isCancelled
                                  ? 'bg-rose-50 border-rose-500 text-rose-600'
                                  : isCompleted
                                    ? 'bg-emerald-50 border-emerald-500 text-emerald-600'
                                    : 'bg-indigo-50 border-indigo-500 text-indigo-600'
                              }`}
                            >
                              <div
                                className={`w-1.5 h-1.5 rounded-full ${
                                  isCancelled
                                    ? 'bg-rose-500'
                                    : isCompleted
                                      ? 'bg-emerald-500'
                                      : 'bg-indigo-500'
                                }`}
                              />
                            </div>

                            <div className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-2xs space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="font-black text-xs text-slate-900">
                                  {evt.eventType.replace(/_/g, ' ')}
                                </span>
                                <span className="text-[10px] font-semibold text-slate-400">
                                  {formatTime(evt.timestamp)}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                                {evt.actor && (
                                  <span>
                                    Actor: <strong>{evt.actor}</strong>
                                  </span>
                                )}
                                <span>•</span>
                                <span>
                                  Status: <strong>{evt.newStatus}</strong>
                                </span>
                              </div>

                              {evt.reason && (
                                <p
                                  className={`text-xs p-2 rounded-lg mt-1 ${
                                    isCancelled
                                      ? 'bg-rose-50 text-rose-800 font-bold border border-rose-100'
                                      : 'bg-slate-50 text-slate-700'
                                  }`}
                                >
                                  {evt.reason}
                                </p>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* ── TAB 3: Payment & Billing ── */}
                {activeSection === 'payment' && (
                  <div className="space-y-4">
                    <div className="p-4 bg-white rounded-xl border border-slate-200/80 space-y-3">
                      <h4 className="text-xs font-black text-[#14274E] uppercase tracking-wider">
                        Payment Summary
                      </h4>

                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between text-slate-600">
                          <span>Subtotal Bill</span>
                          <span className="font-bold text-slate-800">
                            ₱{order.subtotalBill.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          </span>
                        </div>

                        {details?.discounts && details.discounts.length > 0 && (
                          <div className="pt-2 border-t border-slate-100 space-y-1.5">
                            {details.discounts.map((disc, i) => (
                              <div key={i} className="flex justify-between text-emerald-700">
                                <span className="flex items-center gap-1 font-semibold">
                                  <Tag className="w-3 h-3" />
                                  <span>{disc.type}</span>
                                </span>
                                <span className="font-bold">
                                  -₱{disc.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="flex justify-between text-slate-600">
                          <span>Payment Status</span>
                          <span
                            className={`font-black ${
                              order.paymentStatus === 'PAID' ? 'text-emerald-700' : 'text-amber-600'
                            }`}
                          >
                            {order.paymentStatus === 'PAID' ? 'PAID' : 'UNPAID'}
                          </span>
                        </div>

                        <div className="flex justify-between text-slate-600">
                          <span>Payment Method</span>
                          <span className="font-bold text-slate-800">{order.paymentMethod}</span>
                        </div>

                        <div className="pt-2 border-t border-slate-200 flex justify-between text-sm">
                          <span className="font-black text-[#14274E]">Net Total Bill</span>
                          <span className="font-black text-lg text-[#14274E]">
                            ₱{order.totalBill.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Operational Timings Card */}
                    <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-2.5 text-xs">
                      <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">
                        Operational Timings
                      </h4>

                      <div className="space-y-1.5 text-slate-600">
                        <div className="flex justify-between">
                          <span>Order Placed</span>
                          <span className="font-semibold text-slate-800">
                            {formatTime(order.createdAt)}
                          </span>
                        </div>

                        <div className="flex justify-between">
                          <span>Kitchen Ready</span>
                          <span className="font-semibold text-slate-800">
                            {formatTime(order.readyAt)}
                          </span>
                        </div>

                        <div className="flex justify-between">
                          <span>Food Served</span>
                          <span className="font-semibold text-slate-800">
                            {formatTime(order.servedAt)}
                          </span>
                        </div>

                        <div className="flex justify-between">
                          <span>Bill Completed</span>
                          <span className="font-semibold text-slate-800">
                            {formatTime(order.completedAt)}
                          </span>
                        </div>

                        <div className="pt-2 border-t border-slate-200 flex justify-between text-slate-800 font-bold">
                          <span>Serving Time</span>
                          <span className="text-indigo-600">
                            {order.servingDurationMinutes !== null
                              ? `${order.servingDurationMinutes} mins`
                              : 'N/A'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
