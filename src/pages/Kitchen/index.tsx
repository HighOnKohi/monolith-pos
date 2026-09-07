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
  PackageX,
  Search,
  CheckCircle,
  XCircle,
  Loader2,
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
  toggleItemAvailability,
  saveKitchenOrderFlags,
  type KitchenOrder,
} from '@/services/kitchenService'
import { CancelOrderModal } from '@/components/kitchen/CancelOrderModal'
import { useMenu } from '@/hooks/useMenu'
import type { OrderStatus } from '@/types/order'

type FilterStage = 'incoming' | 'cooking' | 'ready' | 'served' | 'all' | 'stock'

export default function KitchenPage() {
  const [orders, setOrders] = useState<KitchenOrder[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeStage, setActiveStage] = useState<FilterStage>('incoming')
  const [cancelModalOrder, setCancelModalOrder] = useState<KitchenOrder | null>(null)

  // Menu items & stock state for kitchen availability management
  const { items: menuItems, categories: menuCategories, reload: reloadMenu } = useMenu()
  const [stockSearch, setStockSearch] = useState('')
  const [stockCategory, setStockCategory] = useState('all')
  const [togglingItemId, setTogglingItemId] = useState<string | null>(null)

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

  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null)

  function showToast(text: string, type: 'success' | 'error' | 'info' = 'success') {
    setToastMessage({ text, type })
    setTimeout(() => setToastMessage(null), 5000)
  }

  const handleAcceptOrder = async (orderId: number) => {
    try {
      await acceptKitchenOrder(orderId)
      setOrders((prev) =>
        prev.map((o) => (o.orderId === orderId ? { ...o, orderStatus: 'VERIFIED' } : o))
      )
      showToast(`Order #${orderId} accepted and verified!`, 'success')
    } catch (err: unknown) {
      console.error('Failed to accept order:', err)
      const errObj = err as { code?: string; message?: string }
      const isReplica = errObj?.code === '55000' || errObj?.message?.includes('replica identity')
      if (isReplica) {
        showToast('DB Error 55000: Please run Migration 005 in Supabase SQL Editor (ALTER TABLE "Restaurant_Orders" REPLICA IDENTITY FULL).', 'error')
      } else {
        showToast(errObj?.message || 'Failed to accept order in database.', 'error')
      }
    }
  }

  const handleAdvanceStatus = async (orderId: number, nextStatus: OrderStatus) => {
    try {
      await advanceKitchenOrderStatus(orderId, nextStatus)
      setOrders((prev) =>
        prev.map((o) => (o.orderId === orderId ? { ...o, orderStatus: nextStatus } : o))
      )
      showToast(`Order #${orderId} moved to ${nextStatus}!`, 'success')
    } catch (err: unknown) {
      console.error('Failed to advance order status:', err)
      const errObj = err as { code?: string; message?: string }
      const isReplica = errObj?.code === '55000' || errObj?.message?.includes('replica identity')
      if (isReplica) {
        showToast('DB Error 55000: Please run Migration 005 in Supabase SQL Editor (ALTER TABLE "Restaurant_Orders" REPLICA IDENTITY FULL).', 'error')
      } else {
        showToast(errObj?.message || 'Failed to advance order status in database.', 'error')
      }
    }
  }

  const handleConfirmCancel = async (note: string, flaggedItemIds: string[]) => {
    if (!cancelModalOrder) return
    try {
      await saveKitchenOrderFlags(cancelModalOrder.orderId, flaggedItemIds)
      await cancelKitchenOrder(cancelModalOrder.orderId, note, [])
      setOrders((prev) => prev.filter((o) => o.orderId !== cancelModalOrder.orderId))
      setCancelModalOrder(null)
      reloadMenu()
    } catch (err) {
      console.error('Failed to cancel order:', err)
      throw err
    }
  }

  const handleToggleStock = async (itemId: string, currentSoldOut: boolean) => {
    setTogglingItemId(itemId)
    try {
      await toggleItemAvailability(itemId, currentSoldOut ? 'AVAILABLE' : 'OUT_OF_STOCK')
      reloadMenu()
    } catch (err) {
      console.error('Failed to toggle item availability:', err)
    } finally {
      setTogglingItemId(null)
    }
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

  // Stock summary
  const soldOutCount = menuItems.filter((i) => i.isSoldOut).length

  // Filtered stock items
  const filteredStockItems = menuItems.filter((item) => {
    const matchCat = stockCategory === 'all' || item.categoryId === stockCategory
    const matchSearch =
      stockSearch.trim() === '' ||
      item.name.toLowerCase().includes(stockSearch.toLowerCase())
    return matchCat && matchSearch
  })

  return (
    <div className="kitchen-page-container staff-page space-y-5 animate-fade-in">
      <PageHeader
        title="Kitchen Interface"
        description="Verify stock for incoming orders, accept or cancel with reasons, and manage cooking queue."
        action={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={activeStage === 'stock' ? 'primary' : 'secondary'}
              onClick={() => setActiveStage(activeStage === 'stock' ? 'incoming' : 'stock')}
              className="flex items-center gap-1.5"
            >
              <PackageX className="w-3.5 h-3.5" />
              <span>Dish Stock {soldOutCount > 0 ? `(${soldOutCount} Sold Out)` : ''}</span>
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void loadOrders()}
              className="flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </Button>
          </div>
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

      {/* Main View: Stock Availability OR Orders Queue */}
      {activeStage === 'stock' ? (
        <Card>
          <CardHeader
            title="Kitchen Stock & Dish Availability"
            description="Instantly toggle dishes as In Stock or Sold Out. Updates synchronize in real time to Customer, Cashier, and Menu Manager."
          />
          <div className="p-5 space-y-4">
            {/* Search & Category Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#9BA4B4]" />
                <input
                  type="text"
                  value={stockSearch}
                  onChange={(e) => setStockSearch(e.target.value)}
                  placeholder="Search dishes to update stock..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#9BA4B4]/30 text-xs bg-white text-[#14274E] focus:outline-none focus:border-[#14274E]"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1">
                {menuCategories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setStockCategory(cat.id)}
                    className={[
                      'px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap',
                      stockCategory === cat.id
                        ? 'bg-[#14274E] text-white'
                        : 'bg-[#F1F6F9] text-[#394867] hover:bg-[#9BA4B4]/20',
                    ].join(' ')}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Stock Items Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 pt-2">
              {filteredStockItems.map((item) => {
                const isUpdating = togglingItemId === item.id
                return (
                  <div
                    key={item.id}
                    className={[
                      'p-3 rounded-2xl border-2 transition-all flex flex-col justify-between bg-white shadow-xs',
                      item.isSoldOut
                        ? 'border-red-300 bg-red-50/20'
                        : 'border-[#9BA4B4]/20 hover:border-[#14274E]/30',
                    ].join(' ')}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      {item.imageUrl && (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-12 h-12 rounded-xl object-cover shrink-0 border border-[#9BA4B4]/20"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-bold text-[#14274E] truncate" title={item.name}>
                          {item.name}
                        </h4>
                        <p className="text-[11px] font-semibold text-[#9BA4B4]">
                          ₱{item.price.toFixed(2)}
                        </p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-[#9BA4B4]/15 flex items-center justify-between">
                      <span
                        className={[
                          'text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md flex items-center gap-1',
                          item.isSoldOut
                            ? 'bg-red-100 text-red-800'
                            : 'bg-emerald-100 text-emerald-800',
                        ].join(' ')}
                      >
                        {item.isSoldOut ? (
                          <>
                            <XCircle className="w-3 h-3 text-red-600" />
                            Sold Out
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-3 h-3 text-emerald-600" />
                            Available
                          </>
                        )}
                      </span>

                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => handleToggleStock(item.id, item.isSoldOut)}
                        className={[
                          'py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer disabled:opacity-60',
                          item.isSoldOut
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                            : 'bg-red-600 hover:bg-red-700 text-white shadow-xs',
                        ].join(' ')}
                      >
                        {isUpdating ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : item.isSoldOut ? (
                          'Mark In Stock'
                        ) : (
                          'Mark Sold Out'
                        )}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </Card>
      ) : (
        /* Orders View */
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
                            {order.tableDisplay || `Table ${order.tableNum ?? order.tableId}`}
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

                      {/* Grouped Items List */}
                      <div className="space-y-2 py-2">
                        {Array.from(
                          order.items.reduce((groups, item) => {
                            const group = groups.get(item.itemId)
                            if (group) group.items.push(item)
                             else groups.set(item.itemId, { name: item.name, items: [item] })
                            return groups
                          }, new Map<string, { name?: string; isFlagged?: boolean; items: typeof order.items }>()),
                        ).map(([itemId, group]) => {
                          const activeItems = group.items.filter((item) => item.status !== 'CANCELLED')
                          const status = activeItems[0]?.status ?? 'CANCELLED'
                          const isFlagged = group.items.some((item) => item.isFlagged === true)
                          return (
                            <div
                              key={itemId}
                              className="flex items-center justify-between gap-2 text-xs py-2 px-2 rounded-lg bg-[#F1F6F9]/60"
                            >
                              <div className="min-w-0">
                                <span className="font-bold text-[#14274E]">{group.name}</span>
                                <span className="ml-2 text-[10px] font-black text-[#394867]">x{group.items.length}</span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-[10px] text-[#9BA4B4] font-semibold">{status}</span>
                                {isFlagged && (
                                  <span className="text-[10px] font-black text-amber-600">FLAGGED</span>
                                )}
                                {activeItems.length > 0 && (
                                  <span className="text-[10px] text-slate-400">
                                    {activeItems.length} available
                                  </span>
                                )}
                              </div>
                            </div>
                          )
                        })}
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
    )}

      {/* Cancel Order with Reason & Out-of-Stock Modal */}
      {cancelModalOrder && (
        <CancelOrderModal
          order={cancelModalOrder}
          onClose={() => setCancelModalOrder(null)}
          onConfirm={handleConfirmCancel}
        />
      )}

      {/* Toast Alert Banner */}
      {toastMessage && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl shadow-xl text-xs font-bold text-white flex items-center gap-2 max-w-md text-center ${
            toastMessage.type === 'error' ? 'bg-[#C94A4A]' : 'bg-[#14274E]'
          }`}
        >
          <span>{toastMessage.text}</span>
        </div>
      )}
    </div>
  )
}
