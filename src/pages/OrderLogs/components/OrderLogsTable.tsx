import React from 'react'
import {
  Clock,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Eye,
  ShoppingBag,
  Users,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Smartphone,
  Store,
} from 'lucide-react'
import type { OrderLogRow, SortField, SortOrder } from '@/services/orderLogsService'
import type { OrderStatus } from '@/types/order'

interface OrderLogsTableProps {
  orders: OrderLogRow[]
  loading?: boolean
  sortBy: SortField
  sortOrder: SortOrder
  onSortChange: (field: SortField) => void
  onSelectOrder: (order: OrderLogRow) => void
  selectedOrderId?: number | null
}

export const OrderLogsTable: React.FC<OrderLogsTableProps> = ({
  orders,
  loading = false,
  sortBy,
  sortOrder,
  onSortChange,
  onSelectOrder,
  selectedOrderId,
}) => {
  // Helper to render sort indicator
  const renderSortIcon = (field: SortField) => {
    if (sortBy !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-300 opacity-60 ml-1" />
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-[#14274E] ml-1" />
    ) : (
      <ArrowDown className="w-3 h-3 text-[#14274E] ml-1" />
    )
  }

  // Format order timestamp nicely
  const formatDateTime = (iso: string) => {
    if (!iso) return '—'
    const d = new Date(iso)
    if (isNaN(d.getTime())) return iso
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

  // Order status badge styling
  const renderStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200/80">
            <CheckCircle2 className="w-3 h-3" />
            <span>Completed</span>
          </span>
        )
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-rose-50 text-rose-700 border border-rose-200/80">
            <XCircle className="w-3 h-3" />
            <span>Cancelled</span>
          </span>
        )
      case 'SERVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-blue-50 text-blue-700 border border-blue-200/80">
            <Clock className="w-3 h-3" />
            <span>Served</span>
          </span>
        )
      case 'READY':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-50 text-amber-700 border border-amber-200/80">
            <Clock className="w-3 h-3" />
            <span>Ready</span>
          </span>
        )
      case 'PREPARING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200/80">
            <Clock className="w-3 h-3" />
            <span>Preparing</span>
          </span>
        )
      case 'VERIFIED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-teal-50 text-teal-700 border border-teal-200/80">
            <CheckCircle2 className="w-3 h-3" />
            <span>Confirmed</span>
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-slate-100 text-slate-700 border border-slate-200">
            <AlertCircle className="w-3 h-3" />
            <span>Order Placed</span>
          </span>
        )
    }
  }

  // Payment status badge
  const renderPaymentBadge = (isPaid: boolean, method: string) => {
    if (isPaid) {
      return (
        <div className="flex flex-col">
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Paid</span>
          </span>
          <span className="text-[10px] text-slate-400 font-medium">{method}</span>
        </div>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
        <span>Unpaid</span>
      </span>
    )
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-8 border border-slate-200/80 shadow-xs flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 rounded-full border-3 border-indigo-600 border-t-transparent animate-spin" />
        <p className="text-xs font-bold text-slate-500">Loading order records...</p>
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-12 border border-slate-200/80 shadow-xs flex flex-col items-center justify-center text-center gap-2">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
          <ShoppingBag className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-black text-slate-700">No Orders Found</h3>
        <p className="text-xs text-slate-400 max-w-sm">
          No order records match your active search and filter criteria. Try adjusting dates or resetting filters.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
      {/* ── Desktop Table View (visible on md+) ── */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-black text-slate-500 uppercase tracking-wider select-none">
              <th
                onClick={() => onSortChange('ORDER_ID')}
                className="py-3 px-4 cursor-pointer hover:text-slate-800 transition-colors"
              >
                <div className="flex items-center">
                  <span>Order #</span>
                  {renderSortIcon('ORDER_ID')}
                </div>
              </th>

              <th
                onClick={() => onSortChange('TIME')}
                className="py-3 px-4 cursor-pointer hover:text-slate-800 transition-colors"
              >
                <div className="flex items-center">
                  <span>Date & Time</span>
                  {renderSortIcon('TIME')}
                </div>
              </th>

              <th className="py-3 px-4">Table / Session</th>

              <th className="py-3 px-4">Type & Source</th>

              <th className="py-3 px-3 text-center">Pax</th>

              <th
                onClick={() => onSortChange('TOTAL_BILL')}
                className="py-3 px-4 cursor-pointer hover:text-slate-800 transition-colors"
              >
                <div className="flex items-center">
                  <span>Total</span>
                  {renderSortIcon('TOTAL_BILL')}
                </div>
              </th>

              <th
                onClick={() => onSortChange('ORDER_STATUS')}
                className="py-3 px-4 cursor-pointer hover:text-slate-800 transition-colors"
              >
                <div className="flex items-center">
                  <span>Status</span>
                  {renderSortIcon('ORDER_STATUS')}
                </div>
              </th>

              <th className="py-3 px-4">Payment</th>

              <th className="py-3 px-4">Serving Time</th>

              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
            {orders.map((order) => {
              const isSelected = selectedOrderId === order.orderId
              return (
                <tr
                  key={order.orderId}
                  onClick={() => onSelectOrder(order)}
                  className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${
                    isSelected ? 'bg-indigo-50/40' : ''
                  }`}
                >
                  {/* Order # */}
                  <td className="py-3 px-4">
                    <span className="font-extrabold text-[#14274E] text-xs">
                      #{order.orderId}
                    </span>
                  </td>

                  {/* Date & Time */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    <div className="flex flex-col">
                      <span className="text-slate-800 font-semibold">
                        {formatDateTime(order.createdAt)}
                      </span>
                      {order.completedAt && (
                        <span className="text-[10px] text-slate-400">
                          Completed: {formatDateTime(order.completedAt).slice(7)}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Table */}
                  <td className="py-3 px-4">
                    {order.isMerged ? (
                      <div className="flex flex-col">
                        <span className="inline-flex items-center gap-1 font-bold text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded-md text-[11px] border border-indigo-100 w-fit">
                          {order.mergedGroupLabel || `Table ${order.tableNum} (Merged)`}
                        </span>
                      </div>
                    ) : (
                      <span className="font-extrabold text-slate-800">
                        Table {order.tableNum}
                      </span>
                    )}
                  </td>

                  {/* Type & Source */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      {order.requestedFrom === 'Customer' ? (
                        <span
                          className="p-1 rounded-md bg-emerald-50 text-emerald-600"
                          title="Ordered via Customer App"
                        >
                          <Smartphone className="w-3 h-3" />
                        </span>
                      ) : (
                        <span
                          className="p-1 rounded-md bg-slate-100 text-slate-600"
                          title="Punched via Cashier Station"
                        >
                          <Store className="w-3 h-3" />
                        </span>
                      )}
                      <span className="text-[11px] text-slate-600 font-medium">
                        {order.orderType === 'TAKEOUT' ? 'Takeout' : 'Dine-in'} ·{' '}
                        {order.requestedFrom}
                      </span>
                    </div>
                  </td>

                  {/* Pax */}
                  <td className="py-3 px-3 text-center font-bold text-slate-700">
                    <span className="inline-flex items-center gap-0.5 text-slate-600">
                      <Users className="w-3 h-3 text-slate-400" />
                      <span>{order.guestCount}</span>
                    </span>
                  </td>

                  {/* Total */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span className="font-black text-slate-900">
                      ₱{order.totalBill.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    {renderStatusBadge(order.orderStatus)}
                  </td>

                  {/* Payment */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    {renderPaymentBadge(order.paymentStatus === 'PAID', order.paymentMethod)}
                  </td>

                  {/* Serving Time */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    {order.servingDurationMinutes !== null ? (
                      <div className="flex items-center gap-1 text-slate-700 font-bold">
                        <Clock className="w-3 h-3 text-indigo-500" />
                        <span>{order.servingDurationMinutes}m</span>
                        {order.prepDurationMinutes !== null && (
                          <span className="text-[10px] text-slate-400 font-normal">
                            (prep {order.prepDurationMinutes}m)
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-400 font-normal text-xs">—</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onSelectOrder(order)
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-[#14274E] hover:text-white text-slate-700 rounded-xl text-[11px] font-bold transition-all cursor-pointer"
                    >
                      <Eye className="w-3 h-3" />
                      <span>View</span>
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ── Mobile Card List View (visible on < md) ── */}
      <div className="md:hidden divide-y divide-slate-100">
        {orders.map((order) => {
          const isSelected = selectedOrderId === order.orderId
          return (
            <div
              key={order.orderId}
              onClick={() => onSelectOrder(order)}
              className={`p-4 space-y-2.5 active:bg-slate-50 transition-colors cursor-pointer ${
                isSelected ? 'bg-indigo-50/40' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-[#14274E]">
                    #{order.orderId}
                  </span>
                  <span className="text-xs font-extrabold text-slate-700">
                    {order.isMerged
                      ? (order.mergedGroupLabel || `Table ${order.tableNum}`)
                      : `Table ${order.tableNum}`}
                  </span>
                </div>
                {renderStatusBadge(order.orderStatus)}
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>{formatDateTime(order.createdAt)}</span>
                <span className="font-black text-slate-900 text-sm">
                  ₱{order.totalBill.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <span>
                    {order.orderType} · {order.requestedFrom}
                  </span>
                  <span>•</span>
                  <span>{order.guestCount} pax</span>
                </div>

                <div className="flex items-center gap-2">
                  {order.servingDurationMinutes !== null && (
                    <span className="font-bold text-indigo-700">
                      ⏱ {order.servingDurationMinutes}m
                    </span>
                  )}
                  <span className="font-bold text-slate-800">
                    {order.paymentStatus === 'PAID' ? '✓ Paid' : 'Unpaid'}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
