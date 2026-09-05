import { useState, useEffect, useCallback } from 'react'
import {
  UtensilsCrossed,
  Clock,
  CheckCircle2,
  ChefHat,
  Flame,
  Check,
  Ban,
  RefreshCw,
  BellRing,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'
import {
  fetchKitchenOrders,
  acceptKitchenOrder,
  advanceKitchenOrderStatus,
  cancelKitchenOrder,
  type KitchenOrder,
} from '@/services/kitchenService'
import { CancelOrderModal } from '@/components/kitchen/CancelOrderModal'
import type { OrderStatus } from '@/types/order'

type FilterStage = 'incoming' | 'cooking' | 'ready' | 'served' | 'all'

export default function KitchenPage() {
  const [orders, setOrders] = useState<KitchenOrder[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeStage, setActiveStage] = useState<FilterStage>('incoming')
  const [cancelModalOrder, setCancelModalOrder] = useState<KitchenOrder | null>(null)

  const loadOrders = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true)
    try {
      const data = await fetchKitchenOrders()
      setOrders(data)
    } catch (err) {
      console.error('Failed to load kitchen orders:', err)
    } finally {
      if (!silent) setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadOrders(false)

    // Constantly fetch updates in background every 2500ms
    const interval = setInterval(() => {
      loadOrders(true)
    }, 2500)

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadOrders(true)
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Realtime subscription for restaurant orders in the kitchen
    const channel = supabase
      .channel('kitchen-orders-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'Restaurant_Orders' },
        () => {
          // Re-fetch to guarantee complete joined items & status synchronization
          loadOrders(true)
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'Order_Items' },
        () => {
          loadOrders(true)
        }
      )
      .subscribe()

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      supabase.removeChannel(channel)
    }
  }, [loadOrders])

  const handleAcceptOrder = async (orderId: number) => {
    try {
      await acceptKitchenOrder(orderId)
      setOrders((prev) =>
        prev.map((o) => (o.orderId === orderId ? { ...o, orderStatus: 'VERIFIED' } : o))
      )
    } catch (err) {
      console.error('Failed to accept order:', err)
    }
  }

  const handleAdvanceStatus = async (orderId: number, nextStatus: OrderStatus) => {
    try {
      await advanceKitchenOrderStatus(orderId, nextStatus)
      setOrders((prev) =>
        prev.map((o) => (o.orderId === orderId ? { ...o, orderStatus: nextStatus } : o))
      )
    } catch (err) {
      console.error('Failed to advance order status:', err)
    }
  }

  const handleConfirmCancel = async (reason: string, outOfStockItemIds: string[]) => {
    if (!cancelModalOrder) return
    await cancelKitchenOrder(cancelModalOrder.orderId, reason, outOfStockItemIds)
    setOrders((prev) => prev.filter((o) => o.orderId !== cancelModalOrder.orderId))
  }

  // Count summaries
  const incomingCount = orders.filter((o) => o.orderStatus === 'REQUESTED').length
  const cookingCount = orders.filter(
    (o) => o.orderStatus === 'VERIFIED' || o.orderStatus === 'PREPARING'
  ).length
  const readyCount = orders.filter((o) => o.orderStatus === 'READY').length
  const servedCount = orders.filter((o) => o.orderStatus === 'SERVED').length

  // Filtered orders
  const displayedOrders = orders.filter((order) => {
    if (activeStage === 'incoming') return order.orderStatus === 'REQUESTED'
    if (activeStage === 'cooking')
      return order.orderStatus === 'VERIFIED' || order.orderStatus === 'PREPARING'
    if (activeStage === 'ready') return order.orderStatus === 'READY'
    if (activeStage === 'served') return order.orderStatus === 'SERVED'
    return true
  })

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Kitchen Interface"
        description="Verify stock for incoming orders, accept or cancel with reasons, and manage cooking queue."
        action={
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void loadOrders()}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </Button>
        }
      />

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <button
          onClick={() => setActiveStage('incoming')}
          className={[
            'p-4 rounded-2xl border-2 text-left transition-all relative overflow-hidden interactive-card cursor-pointer',
            activeStage === 'incoming'
              ? 'border-red-500 bg-red-50/50 shadow-sm ring-2 ring-red-200 -translate-y-0.5'
              : 'border-[#9BA4B4]/20 bg-white hover:border-[#9BA4B4]/50 shadow-2xs',
          ].join(' ')}
        >
          {incomingCount > 0 && (
            <span className="absolute top-2 right-2 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600" />
            </span>
          )}
          <p className="text-xs font-bold text-[#9BA4B4] uppercase flex items-center gap-1">
            <BellRing className="w-3.5 h-3.5 text-red-500" />
            New Requests
          </p>
          <p className="mt-1 text-2xl font-black text-[#14274E]">{incomingCount}</p>
        </button>

        <button
          onClick={() => setActiveStage('cooking')}
          className={[
            'p-4 rounded-2xl border-2 text-left transition-all interactive-card cursor-pointer',
            activeStage === 'cooking'
              ? 'border-amber-500 bg-amber-50/50 shadow-sm ring-2 ring-amber-200 -translate-y-0.5'
              : 'border-[#9BA4B4]/20 bg-white hover:border-[#9BA4B4]/50 shadow-2xs',
          ].join(' ')}
        >
          <p className="text-xs font-bold text-[#9BA4B4] uppercase flex items-center gap-1">
            <ChefHat className="w-3.5 h-3.5 text-amber-500" />
            In Preparation
          </p>
          <p className="mt-1 text-2xl font-black text-[#14274E]">{cookingCount}</p>
        </button>

        <button
          onClick={() => setActiveStage('ready')}
          className={[
            'p-4 rounded-2xl border-2 text-left transition-all interactive-card cursor-pointer',
            activeStage === 'ready'
              ? 'border-indigo-500 bg-indigo-50/50 shadow-sm ring-2 ring-indigo-200 -translate-y-0.5'
              : 'border-[#9BA4B4]/20 bg-white hover:border-[#9BA4B4]/50 shadow-2xs',
          ].join(' ')}
        >
          <p className="text-xs font-bold text-[#9BA4B4] uppercase flex items-center gap-1">
            <Flame className="w-3.5 h-3.5 text-indigo-500" />
            Ready for Pickup
          </p>
          <p className="mt-1 text-2xl font-black text-[#14274E]">{readyCount}</p>
        </button>

        <button
          onClick={() => setActiveStage('served')}
          className={[
            'p-4 rounded-2xl border-2 text-left transition-all interactive-card cursor-pointer',
            activeStage === 'served'
              ? 'border-emerald-500 bg-emerald-50/50 shadow-sm ring-2 ring-emerald-200 -translate-y-0.5'
              : 'border-[#9BA4B4]/20 bg-white hover:border-[#9BA4B4]/50 shadow-2xs',
          ].join(' ')}
        >
          <p className="text-xs font-bold text-[#9BA4B4] uppercase flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            Served Today
          </p>
          <p className="mt-1 text-2xl font-black text-[#14274E]">{servedCount}</p>
        </button>
      </div>

      {/* Orders View */}
      <Card>
        <CardHeader
          title={
            activeStage === 'incoming'
              ? 'Incoming Order Requests (Stock Review Required)'
              : activeStage === 'cooking'
              ? 'Kitchen Cooking Queue'
              : activeStage === 'ready'
              ? 'Ready for Service'
              : activeStage === 'served'
              ? 'Served Orders'
              : 'All Orders'
          }
          description="Check inventory and update order status in real time"
        />

        <div className="p-5">
          {isLoading ? (
            <div className="py-16 text-center text-muted text-sm">
              Loading orders from database...
            </div>
          ) : displayedOrders.length === 0 ? (
            <EmptyState
              icon={UtensilsCrossed}
              title={
                activeStage === 'incoming'
                  ? 'No incoming order requests'
                  : 'No orders in this queue'
              }
              description={
                activeStage === 'incoming'
                  ? 'When customers place an order, it will appear here first for stock verification.'
                  : 'Orders will move into this queue as the kitchen progresses them.'
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {displayedOrders.map((order) => {
                const isIncoming = order.orderStatus === 'REQUESTED'
                const isVerified = order.orderStatus === 'VERIFIED'
                const isPreparing = order.orderStatus === 'PREPARING'
                const isReady = order.orderStatus === 'READY'
                const isServed = order.orderStatus === 'SERVED'

                return (
                  <div
                    key={order.orderId}
                    className={[
                      'rounded-2xl border-2 p-4 flex flex-col justify-between transition-all bg-white shadow-xs interactive-card',
                      isIncoming
                        ? 'border-red-400 ring-2 ring-red-100'
                        : isPreparing
                        ? 'border-amber-300'
                        : isReady
                        ? 'border-indigo-400'
                        : 'border-[#9BA4B4]/25',
                    ].join(' ')}
                  >
                    <div>
                      {/* Card Header */}
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#9BA4B4]/15">
                        <div className="flex items-center gap-2">
                          <span className="text-base font-black text-[#14274E]">
                            Table {order.tableNum ?? order.tableId}
                          </span>
                          <span className="text-[10px] font-bold text-[#9BA4B4] bg-[#F1F6F9] px-2 py-0.5 rounded-md">
                            #{order.orderId}
                          </span>
                        </div>
                        <span
                          className={[
                            'text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md',
                            isIncoming
                              ? 'bg-red-500 text-white animate-pulse'
                              : isVerified
                              ? 'bg-blue-100 text-blue-800'
                              : isPreparing
                              ? 'bg-amber-500 text-white'
                              : isReady
                              ? 'bg-indigo-600 text-white'
                              : 'bg-emerald-100 text-emerald-800',
                          ].join(' ')}
                        >
                          {isIncoming ? 'Action Needed' : order.orderStatus}
                        </span>
                      </div>

                      {/* Order timestamp */}
                      <div className="text-[11px] text-[#9BA4B4] flex items-center gap-1 mb-3">
                        <Clock className="w-3.5 h-3.5" />
                        <span>
                          {order.createdAt
                            ? new Date(order.createdAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : 'Just now'}{' '}
                          • {order.orderType}
                        </span>
                      </div>

                      {/* Items List */}
                      <div className="space-y-2 py-2">
                        {order.items?.map((item) => (
                          <div
                            key={item.orderItemId}
                            className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-[#F1F6F9]/60"
                          >
                            <span className="font-bold text-[#14274E]">
                              <span className="text-red-600 font-black mr-1.5">
                                {item.quantity}x
                              </span>
                              {item.name}
                            </span>
                            <span className="text-[10px] text-[#9BA4B4] font-semibold">
                              {item.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Action Bar */}
                    <div className="mt-4 pt-3 border-t border-[#9BA4B4]/15">
                      {isIncoming && (
                        <div className="flex gap-2">
                          <Button
                            variant="danger"
                            size="sm"
                            className="flex-1 text-xs py-2"
                            onClick={() => setCancelModalOrder(order)}
                          >
                            <Ban className="w-3.5 h-3.5 mr-1" />
                            Reject / OOS
                          </Button>
                          <Button
                            variant="primary"
                            size="sm"
                            className="flex-1 text-xs py-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={() => handleAcceptOrder(order.orderId)}
                          >
                            <Check className="w-3.5 h-3.5 mr-1" />
                            Accept Order
                          </Button>
                        </div>
                      )}

                      {isVerified && (
                        <Button
                          variant="primary"
                          size="sm"
                          className="w-full text-xs py-2 bg-amber-500 hover:bg-amber-600 text-white"
                          onClick={() => handleAdvanceStatus(order.orderId, 'PREPARING')}
                        >
                          <ChefHat className="w-3.5 h-3.5 mr-1" />
                          Start Cooking
                        </Button>
                      )}

                      {isPreparing && (
                        <Button
                          variant="primary"
                          size="sm"
                          className="w-full text-xs py-2 bg-indigo-600 hover:bg-indigo-700 text-white"
                          onClick={() => handleAdvanceStatus(order.orderId, 'READY')}
                        >
                          <Flame className="w-3.5 h-3.5 mr-1" />
                          Mark Ready for Delivery
                        </Button>
                      )}

                      {isReady && (
                        <Button
                          variant="primary"
                          size="sm"
                          className="w-full text-xs py-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={() => handleAdvanceStatus(order.orderId, 'SERVED')}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                          Mark Food Served
                        </Button>
                      )}

                      {isServed && (
                        <p className="text-center text-xs font-bold text-emerald-700 py-1">
                          ✓ Order Served & Completed
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </Card>

      {/* Cancel Order with Reason & Out-of-Stock Modal */}
      {cancelModalOrder && (
        <CancelOrderModal
          order={cancelModalOrder}
          onClose={() => setCancelModalOrder(null)}
          onConfirm={handleConfirmCancel}
        />
      )}
    </div>
  )
}
