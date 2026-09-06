import React from 'react'
import {
  BellRing,
  ChefHat,
  Droplets,
  UserCheck,
  UtensilsCrossed,
  Receipt,
  MessageSquare,
  Clock,
  Check,
  X,
} from 'lucide-react'
import type { AssistanceRequest } from '@/types/assistance'
import type { Order } from '@/types/order'

interface NotificationPillsProps {
  assistanceRequests: AssistanceRequest[]
  verifiedOrders: Order[]
  isAssistanceOpen: boolean
  isVerifiedOpen: boolean
  onToggleAssistance: () => void
  onToggleVerified: () => void
  onCloseAll: () => void
  onResolveAssistance: (tableId: number) => void
  onAcknowledgeVerifiedOrder: (orderId: number) => void
}

export const NotificationPills: React.FC<NotificationPillsProps> = ({
  assistanceRequests,
  verifiedOrders,
  isAssistanceOpen,
  isVerifiedOpen,
  onToggleAssistance,
  onToggleVerified,
  onCloseAll,
  onResolveAssistance,
  onAcknowledgeVerifiedOrder,
}) => {
  const getAssistanceIcon = (type: string) => {
    switch (type) {
      case 'WATER':
        return <Droplets className="w-3.5 h-3.5 text-blue-500" />
      case 'WAITER':
        return <UserCheck className="w-3.5 h-3.5 text-amber-500" />
      case 'UTENSILS':
        return <UtensilsCrossed className="w-3.5 h-3.5 text-emerald-500" />
      case 'BILL_OUT':
        return <Receipt className="w-3.5 h-3.5 text-purple-500" />
      default:
        return <MessageSquare className="w-3.5 h-3.5 text-[#14274E]" />
    }
  }

  return (
    <div className="relative flex items-center gap-2">
      {/* 1. Customer Assistance Pill */}
      <button
        onClick={onToggleAssistance}
        className={[
          'cashier-pill-btn cashier-pill-assistance',
          assistanceRequests.length > 0 ? 'has-alert' : '',
          isAssistanceOpen ? 'ring-2 ring-rose-400' : '',
        ].join(' ')}
        title="Customer Assistance Calls"
      >
        <BellRing
          className={[
            'w-3.5 h-3.5',
            assistanceRequests.length > 0 ? 'animate-bounce' : '',
          ].join(' ')}
        />
        <span className="hidden sm:inline">Assistance</span>
        <span
          className={[
            'px-1.5 py-0.2 rounded-full text-[10px] font-extrabold',
            assistanceRequests.length > 0
              ? 'bg-rose-500 text-white'
              : 'bg-slate-100 text-slate-500',
          ].join(' ')}
        >
          {assistanceRequests.length}
        </span>
      </button>

      {/* 2. Kitchen-Verified Orders Pill */}
      <button
        onClick={onToggleVerified}
        className={[
          'cashier-pill-btn cashier-pill-verified',
          verifiedOrders.length > 0 ? 'has-alert' : '',
          isVerifiedOpen ? 'ring-2 ring-sky-400' : '',
        ].join(' ')}
        title="Kitchen-Verified Orders Awaiting Confirmation"
      >
        <ChefHat className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Verified Orders</span>
        <span
          className={[
            'px-1.5 py-0.2 rounded-full text-[10px] font-extrabold',
            verifiedOrders.length > 0
              ? 'bg-sky-500 text-white'
              : 'bg-slate-100 text-slate-500',
          ].join(' ')}
        >
          {verifiedOrders.length}
        </span>
      </button>

      {/* Backdrop when either popover is open */}
      {(isAssistanceOpen || isVerifiedOpen) && (
        <div
          className="fixed inset-0 z-40 bg-black/10 backdrop-blur-[1px]"
          onClick={onCloseAll}
        />
      )}

      {/* ── Assistance Popover ── */}
      {isAssistanceOpen && (
        <div className="cashier-popover">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/70">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-lg bg-rose-100 text-rose-600">
                <BellRing className="w-4 h-4" />
              </span>
              <div>
                <h4 className="text-xs font-bold text-slate-900">
                  Assistance Calls ({assistanceRequests.length})
                </h4>
                <p className="text-[10px] text-slate-500">Live requests from tables</p>
              </div>
            </div>
            <button
              onClick={onCloseAll}
              className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-3 overflow-y-auto max-h-80 divide-y divide-slate-100 space-y-2.5">
            {assistanceRequests.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs flex flex-col items-center gap-1.5">
                <BellRing className="w-6 h-6 text-slate-300" />
                <span className="font-semibold">All tables are attended.</span>
                <span className="text-[10px]">No pending assistance calls.</span>
              </div>
            ) : (
              assistanceRequests.map((req) => (
                <div
                  key={req.id}
                  className="p-3 rounded-xl bg-white border border-rose-100 shadow-xs flex flex-col justify-between gap-2.5"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-[#14274E] text-xs flex items-center gap-1.5 bg-slate-100 px-2 py-0.5 rounded-md">
                        {getAssistanceIcon(req.type)}
                        Table {req.tableNum ?? req.tableId}
                      </span>
                      <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full">
                        {req.type}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(req.requestedAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <p className="text-xs font-semibold text-slate-700">{req.title}</p>
                  {req.notes && (
                    <p className="text-[11px] text-slate-500 italic bg-slate-50 p-1.5 rounded-md">
                      "{req.notes}"
                    </p>
                  )}

                  <button
                    onClick={() => onResolveAssistance(req.tableId)}
                    className="w-full text-xs py-1.5 bg-[#14274E] hover:bg-[#213f7a] text-white rounded-lg font-bold transition-colors cursor-pointer"
                  >
                    Acknowledge &amp; Clear
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── Kitchen-Verified Orders Popover ── */}
      {isVerifiedOpen && (
        <div className="cashier-popover">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/70">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-lg bg-sky-100 text-sky-600">
                <ChefHat className="w-4 h-4" />
              </span>
              <div>
                <h4 className="text-xs font-bold text-slate-900">
                  Kitchen-Verified Orders ({verifiedOrders.length})
                </h4>
                <p className="text-[10px] text-slate-500">Ready for cashier confirmation</p>
              </div>
            </div>
            <button
              onClick={onCloseAll}
              className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-3 overflow-y-auto max-h-80 space-y-2.5">
            {verifiedOrders.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs flex flex-col items-center gap-1.5">
                <ChefHat className="w-6 h-6 text-slate-300" />
                <span className="font-semibold">No verified orders awaiting review.</span>
                <span className="text-[10px]">Orders accepted by chefs will appear here.</span>
              </div>
            ) : (
              verifiedOrders.map((order) => (
                <div
                  key={order.orderId}
                  className="p-3 rounded-xl bg-white border border-sky-100 shadow-xs flex flex-col justify-between gap-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-[#14274E] text-xs bg-slate-100 px-2 py-0.5 rounded-md">
                      Table {order.tableId}
                    </span>
                    <span className="text-[10px] font-bold text-sky-800 bg-sky-50 px-2 py-0.5 rounded-md">
                      Order #{order.orderId}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Type: {order.orderType}</span>
                    <span className="font-black text-[#14274E]">
                      ₱{order.totalBill.toFixed(2)}
                    </span>
                  </div>

                  <button
                    onClick={() => onAcknowledgeVerifiedOrder(order.orderId)}
                    className="w-full text-xs py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Acknowledge Order</span>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
