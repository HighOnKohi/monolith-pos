import { useState } from 'react'
import type { Order, OrderStatus } from '@/types/order'
import { Clock, ChefHat, Flame, UtensilsCrossed, Undo2, Loader2, AlertTriangle, X } from 'lucide-react'

/**
 * Status phase definitions for the 4 customer-facing cards.
 * Each maps one or more internal OrderStatus values to a single visual card.
 */
const STATUS_PHASES = [
  {
    key: 'requested' as const,
    label: 'Requested',
    matchStatuses: ['REQUESTED', 'VERIFIED'] as OrderStatus[],
    icon: Clock,
    colors: {
      card: 'bg-amber-50 border-amber-200/80',
      iconBg: 'bg-amber-500',
      iconText: 'text-white',
      badge: 'bg-amber-100 text-amber-800 border-amber-300/60',
      title: 'text-amber-950',
      subtitle: 'text-amber-800/80',
      itemBg: 'bg-amber-50/60',
      dot: 'bg-amber-400',
      emptyText: 'text-amber-400',
    },
    emptyLabel: 'No pending requests',
    activeDesc: 'Waiting for kitchen confirmation',
    canUndo: true,
  },
  {
    key: 'cooking' as const,
    label: 'Cooking',
    matchStatuses: ['PREPARING'] as OrderStatus[],
    icon: ChefHat,
    colors: {
      card: 'bg-orange-50 border-orange-200/80',
      iconBg: 'bg-orange-500',
      iconText: 'text-white',
      badge: 'bg-orange-100 text-orange-800 border-orange-300/60',
      title: 'text-orange-950',
      subtitle: 'text-orange-800/80',
      itemBg: 'bg-orange-50/60',
      dot: 'bg-orange-400',
      emptyText: 'text-orange-400',
    },
    emptyLabel: 'Nothing cooking right now',
    activeDesc: 'Chefs are preparing your dishes',
    canUndo: false,
  },
  {
    key: 'ready' as const,
    label: 'Ready',
    matchStatuses: ['READY'] as OrderStatus[],
    icon: Flame,
    colors: {
      card: 'bg-indigo-50 border-indigo-200/80',
      iconBg: 'bg-indigo-500',
      iconText: 'text-white',
      badge: 'bg-indigo-100 text-indigo-800 border-indigo-300/60',
      title: 'text-indigo-950',
      subtitle: 'text-indigo-800/80',
      itemBg: 'bg-indigo-50/60',
      dot: 'bg-indigo-400',
      emptyText: 'text-indigo-400',
    },
    emptyLabel: 'No dishes ready yet',
    activeDesc: 'Ready to be served to your table',
    canUndo: false,
  },
  {
    key: 'served' as const,
    label: 'Served',
    matchStatuses: ['SERVED', 'COMPLETED'] as OrderStatus[],
    icon: UtensilsCrossed,
    colors: {
      card: 'bg-emerald-50 border-emerald-200/80',
      iconBg: 'bg-emerald-500',
      iconText: 'text-white',
      badge: 'bg-emerald-100 text-emerald-800 border-emerald-300/60',
      title: 'text-emerald-950',
      subtitle: 'text-emerald-800/80',
      itemBg: 'bg-emerald-50/60',
      dot: 'bg-emerald-500',
      emptyText: 'text-emerald-400',
    },
    emptyLabel: 'No dishes served yet',
    activeDesc: 'Delivered to your table — enjoy!',
    canUndo: false,
  },
]

interface StatusCardItem {
  itemId: string
  name: string
  price: number
  quantity: number
  isFlagged?: boolean
}

/** Groups items per order for undo tracking */
interface RequestedOrderGroup {
  orderId: number
  orderStatus: OrderStatus
  items: StatusCardItem[]
}

interface OrderStatusTrackerProps {
  orders: Order[]
  onCancelOrder?: (orderId: number) => Promise<boolean>
}

/**
 * Groups order items by their status phase and renders a card for each.
 * Items are attributed to a phase based on the order-level status.
 * Orders in "Requested" phase can be undone by the customer.
 */
export function OrderStatusTracker({ orders, onCancelOrder }: OrderStatusTrackerProps) {
  const [cancellingOrderId, setCancellingOrderId] = useState<number | null>(null)
  const [confirmingOrderId, setConfirmingOrderId] = useState<number | null>(null)

  // Build grouped items per phase from raw orders
  const phaseItems: Record<string, StatusCardItem[]> = {}
  const requestedOrderGroups: RequestedOrderGroup[] = []

  for (const phase of STATUS_PHASES) {
    const items: Record<string, StatusCardItem> = {}

    for (const order of orders) {
      if (order.orderStatus === 'CANCELLED') continue
      if (!phase.matchStatuses.includes(order.orderStatus)) continue

      // For the Requested phase, track items per order for undo
      const orderItems: StatusCardItem[] = []

      for (const item of order.items ?? []) {
        const st = (item.status || 'PENDING').toUpperCase()
        if (st === 'CANCELLED') continue

        const id = item.itemId
        if (!items[id]) {
          items[id] = {
            itemId: id,
            name: item.name || `Item #${id}`,
            price: item.price || 0,
            quantity: 0,
            isFlagged: false,
          }
        }
        items[id].quantity += 1
        if (item.isFlagged) items[id].isFlagged = true

        // Track per-order items for undo grouping
        if (phase.canUndo) {
          const existing = orderItems.find((oi) => oi.itemId === id)
          if (existing) {
            existing.quantity += 1
          } else {
            orderItems.push({
              itemId: id,
              name: item.name || `Item #${id}`,
              price: item.price || 0,
              quantity: 1,
              isFlagged: item.isFlagged,
            })
          }
        }
      }

      // Group orders for undo display
      if (phase.canUndo && orderItems.length > 0) {
        requestedOrderGroups.push({
          orderId: order.orderId,
          orderStatus: order.orderStatus,
          items: orderItems,
        })
      }
    }

    phaseItems[phase.key] = Object.values(items)
  }

  const handleCancelOrder = async (orderId: number) => {
    if (!onCancelOrder) return
    setCancellingOrderId(orderId)
    try {
      await onCancelOrder(orderId)
    } finally {
      setCancellingOrderId(null)
      setConfirmingOrderId(null)
    }
  }

  return (
    <div className="space-y-3">
      {STATUS_PHASES.map((phase) => {
        const items = phaseItems[phase.key]
        const totalItems = items.reduce((sum, it) => sum + it.quantity, 0)
        const hasItems = items.length > 0
        const Icon = phase.icon
        const isActive = hasItems

        // For the Requested card, we show per-order groups with undo buttons
        const showPerOrderUndo = phase.canUndo && onCancelOrder && requestedOrderGroups.length > 0

        return (
          <div
            key={phase.key}
            className={[
              'rounded-2xl border p-4 transition-all duration-300 shadow-xs',
              isActive ? phase.colors.card : 'bg-white/60 border-[#9BA4B4]/15',
              isActive ? '' : 'opacity-60',
            ].join(' ')}
          >
            {/* Card Header */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2.5">
                <div
                  className={[
                    'w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-xs transition-all',
                    isActive ? phase.colors.iconBg : 'bg-[#9BA4B4]/20',
                    isActive ? phase.colors.iconText : 'text-[#9BA4B4]',
                  ].join(' ')}
                >
                  <Icon className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h4
                    className={[
                      'text-sm font-extrabold tracking-tight',
                      isActive ? phase.colors.title : 'text-[#9BA4B4]',
                    ].join(' ')}
                  >
                    {phase.label}
                  </h4>
                  <p
                    className={[
                      'text-[10px] font-medium mt-0.5',
                      isActive ? phase.colors.subtitle : 'text-[#9BA4B4]/70',
                    ].join(' ')}
                  >
                    {isActive ? phase.activeDesc : phase.emptyLabel}
                  </p>
                </div>
              </div>

              {/* Item Count Badge */}
              {hasItems && (
                <span
                  className={[
                    'text-[10px] font-black px-2.5 py-1 rounded-full border uppercase tracking-wider',
                    phase.colors.badge,
                  ].join(' ')}
                >
                  {totalItems} {totalItems === 1 ? 'item' : 'items'}
                </span>
              )}
            </div>

            {/* Items List — Per-order groups with undo for Requested phase */}
            {showPerOrderUndo ? (
              <div className="mt-2.5 space-y-2.5">
                {requestedOrderGroups.map((group) => {
                  const isCancelling = cancellingOrderId === group.orderId
                  const isConfirming = confirmingOrderId === group.orderId
                  const canUndo = group.orderStatus === 'REQUESTED'

                  return (
                    <div
                      key={group.orderId}
                      className={[
                        'rounded-xl border overflow-hidden transition-all',
                        isCancelling ? 'opacity-50 pointer-events-none' : '',
                        'border-amber-200/60 bg-white/50',
                      ].join(' ')}
                    >
                      {/* Order batch header with undo button */}
                      <div className="flex items-center justify-between px-3 py-2 bg-amber-100/40 border-b border-amber-200/40">
                        <span className="text-[10px] font-black text-amber-900 uppercase tracking-wider">
                          Order #{group.orderId}
                        </span>
                        {canUndo && (
                          <>
                            {isConfirming ? (
                              <div className="flex items-center gap-1.5 animate-fade-in">
                                <span className="text-[10px] font-bold text-red-700">Cancel this order?</span>
                                <button
                                  onClick={() => void handleCancelOrder(group.orderId)}
                                  disabled={isCancelling}
                                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-600 text-white text-[10px] font-black hover:bg-red-700 active:scale-95 transition-all cursor-pointer shadow-xs disabled:opacity-60"
                                >
                                  {isCancelling ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <AlertTriangle className="w-3 h-3" />
                                  )}
                                  {isCancelling ? 'Cancelling...' : 'Yes, Undo'}
                                </button>
                                <button
                                  onClick={() => setConfirmingOrderId(null)}
                                  className="p-1 rounded-lg text-amber-700 hover:bg-amber-200/60 transition-colors cursor-pointer"
                                  aria-label="Keep order"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmingOrderId(group.orderId)}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-red-700 hover:bg-red-50 active:scale-95 transition-all cursor-pointer border border-red-200/60"
                              >
                                <Undo2 className="w-3 h-3" />
                                Undo Order
                              </button>
                            )}
                          </>
                        )}
                        {!canUndo && (
                          <span className="text-[10px] font-semibold text-amber-700/70 italic">
                            Verified — cannot undo
                          </span>
                        )}
                      </div>

                      {/* Order items */}
                      <div className="px-3 py-1.5 space-y-1">
                        {group.items.map((item) => (
                          <div
                            key={item.itemId}
                            className="flex items-center justify-between gap-3 py-1.5 rounded-lg transition-colors"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="w-6 h-6 rounded-lg bg-white/80 text-[#14274E] font-black text-xs flex items-center justify-center shrink-0 shadow-2xs border border-black/5">
                                {item.quantity}x
                              </span>
                              <span className="text-sm font-bold text-[#14274E] truncate">
                                {item.name}
                              </span>
                            </div>
                            <span className="text-xs font-bold text-[#14274E]/70 shrink-0">
                              ₱{(item.price * item.quantity).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : hasItems ? (
              <div className="mt-2.5 space-y-1.5">
                {items.map((item) => (
                  <div
                    key={item.itemId}
                    className={[
                      'flex items-center justify-between gap-3 py-2 px-3 rounded-xl transition-colors',
                      phase.colors.itemBg,
                    ].join(' ')}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-6 h-6 rounded-lg bg-white/80 text-[#14274E] font-black text-xs flex items-center justify-center shrink-0 shadow-2xs border border-black/5">
                        {item.quantity}x
                      </span>
                      <span className="text-sm font-bold text-[#14274E] truncate">
                        {item.name}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-[#14274E]/70 shrink-0">
                      ₱{(item.price * item.quantity).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
