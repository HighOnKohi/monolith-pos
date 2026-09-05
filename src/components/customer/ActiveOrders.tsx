import type { Order } from '@/types/order'
import { OrderStatusTracker } from './OrderStatusTracker'

interface ActiveOrdersProps {
  orders: Order[]
  onRequestBill: () => void
}

export function ActiveOrders({ orders, onRequestBill }: ActiveOrdersProps) {
  if (orders.length === 0) {
    return (
      <div className="py-16 text-center px-6">
        <h3 className="text-[#14274E] text-lg font-bold mb-2">No active orders</h3>
        <p className="text-[#9BA4B4] text-sm font-medium">
          Orders you place will appear here.
        </p>
      </div>
    )
  }

  // Check if any order is fully SERVED to enable Bill Out button
  const canBillOut = orders.some((o) => o.orderStatus === 'SERVED')

  return (
    <div className="px-4 py-4 space-y-4 pb-36">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-extrabold text-[#14274E]">Your Orders</h2>
        {canBillOut && (
          <button
            onClick={onRequestBill}
            className="bg-[#14274E] text-white px-4 py-2 rounded-xl text-sm font-bold active:scale-95 transition-transform"
          >
            Request Bill
          </button>
        )}
      </div>

      {orders.map((order) => (
        <div key={order.orderId} className="bg-white rounded-3xl p-1 shadow-sm border border-[#9BA4B4]/20">
          <div className="flex justify-between items-center p-4 pb-2">
            <span className="font-extrabold text-[#14274E]">Order #{order.orderId}</span>
            <span className="text-xs font-bold text-[#9BA4B4] uppercase tracking-wider bg-[#F1F6F9] px-2 py-1 rounded-md">
              {order.orderType}
            </span>
          </div>
          <div className="p-2">
            <OrderStatusTracker status={order.orderStatus} />
          </div>
          <div className="flex justify-between items-center px-5 py-3 border-t border-[#9BA4B4]/15 mt-1">
            <span className="text-sm font-bold text-[#9BA4B4]">Total</span>
            <span className="font-extrabold text-[#14274E]">₱{order.totalBill.toFixed(2)}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
