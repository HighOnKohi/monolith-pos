import { useState } from 'react'
import type { Order } from '@/types/order'
import { compressTableOrders } from '@/services/orderService'
import { OrderStatusTracker } from './OrderStatusTracker'
import { ChevronDown, ChevronUp, Clock, Receipt, Utensils } from 'lucide-react'

interface ActiveOrdersProps {
  orders: Order[]
  onRequestBill: () => void
}

export function ActiveOrders({ orders, onRequestBill }: ActiveOrdersProps) {
  const [showBatches, setShowBatches] = useState(false)

  if (orders.length === 0) {
    return (
      <div className="py-20 text-center px-6">
        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xs border border-[#9BA4B4]/20 text-[#9BA4B4]">
          <Receipt className="w-8 h-8" />
        </div>
        <h3 className="text-[#14274E] text-lg font-bold mb-2">No active orders</h3>
        <p className="text-[#9BA4B4] text-sm font-medium max-w-xs mx-auto">
          Dishes and beverages you order will be tracked here in real-time.
        </p>
      </div>
    )
  }

  const compressed = compressTableOrders(orders)
  if (!compressed) return null

  // Check if any order is fully SERVED to highlight bill out, or can bill out anytime after order placed
  const canBillOut = compressed.canBillOut

  return (
    <div className="px-4 py-4 space-y-4 pb-36 max-w-lg mx-auto">
      {/* Table Order Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-[#14274E] tracking-tight">
            Table {compressed.tableId} Orders
          </h2>
          <p className="text-xs text-[#394867] font-semibold mt-0.5">
            {compressed.orderCount} {compressed.orderCount === 1 ? 'batch' : 'batches'} • {compressed.totalItemCount} {compressed.totalItemCount === 1 ? 'item' : 'items'} total
          </p>
        </div>
        {canBillOut && (
          <button
            onClick={onRequestBill}
            className="bg-[#14274E] hover:bg-[#14274E]/90 text-white px-4 py-2 rounded-xl text-xs font-bold active:scale-95 transition-all shadow-sm flex items-center gap-1.5"
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>Request Bill</span>
          </button>
        )}
      </div>

      {/* Progress Tracker for the table's overall active status */}
      <OrderStatusTracker status={compressed.overallStatus} />

      {/* Consolidated Items Summary (Compressed View) */}
      <div className="bg-white rounded-2xl shadow-sm border border-[#9BA4B4]/20 overflow-hidden">
        <div className="px-4 py-3 border-b border-[#9BA4B4]/15 bg-[#F1F6F9]/50 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-[#14274E] flex items-center gap-1.5">
            <Utensils className="w-3.5 h-3.5 text-[#E9C46A]" />
            Consolidated Dishes
          </span>
          <span className="text-xs font-bold text-[#9BA4B4]">
            {compressed.totalItemCount} pcs
          </span>
        </div>

        <div className="divide-y divide-[#9BA4B4]/15 px-4">
          {compressed.items.map((item) => (
            <div key={item.itemId} className="py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-6 h-6 rounded-lg bg-[#14274E]/10 text-[#14274E] font-black text-xs flex items-center justify-center shrink-0">
                  {item.quantity}x
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[#14274E] truncate">
                    {item.name}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {item.servedCount > 0 && (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded">
                        {item.servedCount} Served
                      </span>
                    )}
                    {item.preparingCount > 0 && (
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded">
                        {item.preparingCount} Cooking
                      </span>
                    )}
                    {item.pendingCount > 0 && (
                      <span className="text-[10px] font-bold text-[#394867] bg-[#F1F6F9] px-1.5 py-0.2 rounded">
                        {item.pendingCount} Placed
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="text-sm font-extrabold text-[#14274E]">
                  ₱{item.total.toFixed(2)}
                </span>
                {item.quantity > 1 && (
                  <p className="text-[10px] text-[#9BA4B4]">
                    ₱{item.price.toFixed(2)} ea
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Grand Total Footer */}
        <div className="px-4 py-3 bg-[#F1F6F9]/80 border-t border-[#9BA4B4]/20 flex items-center justify-between">
          <div>
            <span className="text-xs text-[#9BA4B4] font-semibold block">Table Grand Total</span>
            <span className="text-xs text-[#394867]">Includes applicable taxes</span>
          </div>
          <span className="text-xl font-black text-[#14274E]">
            ₱{compressed.totalBill.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Collapsible Order Batches / History */}
      <div className="bg-white rounded-2xl border border-[#9BA4B4]/20 shadow-xs overflow-hidden">
        <button
          onClick={() => setShowBatches((prev) => !prev)}
          className="w-full px-4 py-3 flex items-center justify-between text-left text-xs font-bold text-[#394867] hover:bg-[#F1F6F9] transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-[#9BA4B4]" />
            Order Batches History ({compressed.rawOrders.length})
          </span>
          {showBatches ? (
            <ChevronUp className="w-4 h-4 text-[#9BA4B4]" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[#9BA4B4]" />
          )}
        </button>

        {showBatches && (
          <div className="p-3 bg-[#F1F6F9]/40 divide-y divide-[#9BA4B4]/15 border-t border-[#9BA4B4]/15">
            {compressed.rawOrders.map((order, idx) => (
              <div key={order.orderId} className="py-2.5 first:pt-0 last:pb-0">
                <div className="flex justify-between items-center text-xs mb-1">
                  <span className="font-bold text-[#14274E]">
                    Batch #{compressed.rawOrders.length - idx} (Order #{order.orderId})
                  </span>
                  <span className="font-semibold text-[#14274E]">
                    ₱{order.totalBill.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-[11px] text-[#9BA4B4]">
                  <span>{order.orderType}</span>
                  <span className="bg-white px-2 py-0.5 rounded text-[10px] font-bold text-[#394867] border border-[#9BA4B4]/20">
                    {order.orderStatus}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
