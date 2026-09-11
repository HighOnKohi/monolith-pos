import { useCallback, useEffect, useState, useMemo } from 'react'
import { LayoutGrid, Ticket, ListFilter, RefreshCw, ChefHat } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { fetchOrderViewerData, fetchTicketOrderViewerData, subscribeToOrderUpdates } from '@/services/dispatcherService'

interface ViewerOrder {
  orderId: number
  tableDisplay: string
  registeredName?: string | null
  items: Array<{
    name: string
    quantity: number
    isGroup?: boolean
    includedItems?: Array<{ id: number; name: string; quantity: number }>
  }>
}

type ViewerMode = 'tables' | 'tickets'

export default function OrderViewer() {
  const [mode, setMode] = useState<ViewerMode>('tables')
  const [isTableCompact, setIsTableCompact] = useState(false)
  const [tableOrders, setTableOrders] = useState<ViewerOrder[]>([])
  const [ticketOrders, setTicketOrders] = useState<ViewerOrder[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true)
    try {
      const [tData, tkData] = await Promise.all([
        fetchOrderViewerData(),
        fetchTicketOrderViewerData(),
      ])
      setTableOrders(tData)
      setTicketOrders(tkData)
    } catch (error) {
      console.error('Failed to load order viewer orders:', error)
    } finally {
      if (!silent) setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    // Initial load
    void loadData(false)

    // 1. Instant event listener for same-tab & cross-tab updates via BroadcastChannel/DOM bus
    const unsubscribeBus = subscribeToOrderUpdates(() => {
      void loadData(true)
    })

    // 2. Tab focus / visibility change handler
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        void loadData(true)
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityOrFocus)
    window.addEventListener('focus', handleVisibilityOrFocus)

    // 3. Supabase Postgres Changes listeners for multi-device realtime
    const ordersChannel = supabase
      .channel('order-viewer-table-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Restaurant_Orders' }, () => void loadData(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Order_Items' }, () => void loadData(true))
      .subscribe()

    const ticketsChannel = supabase
      .channel('order-viewer-ticket-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Ticket_Orders' }, () => void loadData(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Ticket_Order_Items' }, () => void loadData(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Ticket_Order_Group_Items' }, () => void loadData(true))
      .subscribe()

    return () => {
      unsubscribeBus()
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus)
      window.removeEventListener('focus', handleVisibilityOrFocus)
      void supabase.removeChannel(ordersChannel)
      void supabase.removeChannel(ticketsChannel)
    }
  }, [loadData])

  // Aggregate tickets dishes into item-centric list
  const ticketDishes = useMemo(() => {
    const map = new Map<
      string,
      {
        total: number
        isGroup?: boolean
        includedItemsMap: Map<number, { id: number; name: string; quantity: number }>
        tickets: Array<{ id: number; name?: string | null; qty: number }>
      }
    >()
    ticketOrders.forEach((order) => {
      order.items.forEach((item) => {
        if (!map.has(item.name)) {
          map.set(item.name, {
            total: 0,
            isGroup: item.isGroup,
            includedItemsMap: new Map(),
            tickets: [],
          })
        }
        const entry = map.get(item.name)!
        entry.total += item.quantity
        entry.tickets.push({
          id: order.orderId,
          name: order.registeredName,
          qty: item.quantity,
        })
        if (item.includedItems) {
          item.includedItems.forEach((inc) => {
            if (!entry.includedItemsMap.has(inc.id)) {
              entry.includedItemsMap.set(inc.id, { id: inc.id, name: inc.name, quantity: 0 })
            }
            entry.includedItemsMap.get(inc.id)!.quantity += inc.quantity
          })
        }
      })
    })

    return Array.from(map.entries())
      .map(([name, data]) => ({
        name,
        totalQuantity: data.total,
        isGroup: data.isGroup,
        includedItems: Array.from(data.includedItemsMap.values()),
        tickets: data.tickets,
      }))
      .sort((a, b) => b.totalQuantity - a.totalQuantity)
  }, [ticketOrders])

  // Table compact items summary
  const tableCompactItems = useMemo(() => {
    const map = new Map<string, number>()
    tableOrders.forEach((order) => {
      order.items.forEach((item) => {
        map.set(item.name, (map.get(item.name) || 0) + item.quantity)
      })
    })

    return Array.from(map.entries())
      .map(([name, quantity]) => ({ name, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
  }, [tableOrders])

  const totalTicketDishesCount = ticketDishes.reduce((sum, d) => sum + d.totalQuantity, 0)
  const totalTableDishesCount = tableCompactItems.reduce((sum, d) => sum + d.quantity, 0)

  return (
    <main className="order-viewer-page staff-page">
      {/* Header */}
      <header className="order-viewer-header flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <ChefHat className="w-7 h-7 text-[#14274E]" />
            <h1 className="text-xl sm:text-2xl font-black text-[#14274E]">Orders to Cook</h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 font-semibold mt-0.5">
            Active cooking items update automatically in real-time.
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Mode Switcher: Tables vs Tickets */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 gap-1">
            <button
              onClick={() => setMode('tables')}
              className={[
                'px-3.5 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer',
                mode === 'tables'
                  ? 'bg-[#14274E] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900',
              ].join(' ')}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Tables ({tableOrders.length})</span>
            </button>

            <button
              onClick={() => setMode('tickets')}
              className={[
                'px-3.5 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer',
                mode === 'tickets'
                  ? 'bg-[#14274E] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900',
              ].join(' ')}
            >
              <Ticket className="w-3.5 h-3.5 text-[#E9C46A]" />
              <span>Tickets ({totalTicketDishesCount} dishes)</span>
            </button>
          </div>

          {/* Compact List Toggle Button (for tables mode) */}
          {mode === 'tables' && (
            <button
              onClick={() => setIsTableCompact((prev) => !prev)}
              className={[
                'px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border',
                isTableCompact
                  ? 'bg-[#14274E] text-[#E9C46A] border-[#14274E] shadow-sm'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50',
              ].join(' ')}
              title="Toggle Compact Combined List"
            >
              <ListFilter className="w-4 h-4" />
              <span>{isTableCompact ? 'Per Order View' : 'Compact List'}</span>
            </button>
          )}

          <button
            onClick={() => void loadData()}
            disabled={isLoading}
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className={['w-4 h-4', isLoading ? 'animate-spin' : ''].join(' ')} />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <section className="order-viewer-orders">
        {mode === 'tickets' ? (
          /* ── TICKETS: Item-Centric List of Dishes to Cook ── */
          ticketDishes.length === 0 ? (
            <p className="order-viewer-empty">
              No ticket dishes currently need cooking.
            </p>
          ) : (
            <div className="col-span-full w-full bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div>
                  <h3 className="text-lg font-black text-[#14274E]">
                    Ticket Dishes Needed to Cook
                  </h3>
                  <p className="text-xs text-slate-500 font-semibold">
                    Combined item list of all ticket dishes currently being prepared.
                  </p>
                </div>
                <span className="px-3.5 py-1.5 rounded-xl bg-amber-100 text-amber-900 font-black text-sm">
                  {totalTicketDishesCount} Total Dishes
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                {ticketDishes.map((dish) => (
                  <div
                    key={dish.name}
                    className="p-4 rounded-2xl bg-[#F8FAFD] border border-slate-200/90 flex flex-col justify-between gap-3 shadow-2xs"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-base sm:text-lg font-black text-[#14274E] leading-snug">
                            {dish.name}
                          </span>
                          {dish.isGroup && (
                            <span className="px-2 py-0.5 rounded-md bg-[#14274E]/10 text-[#14274E] font-black text-[10px] uppercase">
                              Group Meal
                            </span>
                          )}
                        </div>
                        <strong className="text-xl font-black text-[#14274E] shrink-0 bg-white px-3 py-1 rounded-xl border border-slate-200 shadow-2xs">
                          ×{dish.totalQuantity}
                        </strong>
                      </div>

                      {/* If group item, show constituent items individually under it with the same big name size */}
                      {dish.isGroup && dish.includedItems && dish.includedItems.length > 0 && (
                        <div className="space-y-2 pt-2 border-t border-slate-200/70">
                          <div className="text-[11px] font-black text-slate-500 uppercase tracking-wider">
                            Included Items
                          </div>
                          <div className="space-y-1.5">
                            {dish.includedItems.map((inc) => (
                              <div
                                key={inc.id || inc.name}
                                className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs"
                              >
                                <span className="text-base font-extrabold text-[#14274E] leading-snug">
                                  {inc.name}
                                </span>
                                <strong className="text-lg font-black text-[#14274E] shrink-0">
                                  ×{inc.quantity}
                                </strong>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Source ticket badges */}
                    <div className="pt-2 border-t border-slate-200/60 flex flex-wrap gap-1.5 text-[11px] text-slate-500">
                      {dish.tickets.map((t, idx) => (
                        <span
                          key={`${t.id}-${idx}`}
                          className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 font-semibold flex items-center gap-1"
                        >
                          <span>{t.name ? t.name : `Ticket #${t.id}`}:</span>
                          <strong className="text-[#14274E]">×{t.qty}</strong>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        ) : (
          /* ── TABLES: Orders or Compact View ── */
          tableOrders.length === 0 ? (
            <p className="order-viewer-empty">
              No table orders currently need cooking.
            </p>
          ) : isTableCompact ? (
            <div className="col-span-full w-full bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div>
                  <h3 className="text-lg font-black text-[#14274E]">
                    Compact Cooking List (TABLES)
                  </h3>
                  <p className="text-xs text-slate-500 font-semibold">
                    Combined quantities of all dishes currently needing cooking across active tables.
                  </p>
                </div>
                <span className="px-3.5 py-1.5 rounded-xl bg-amber-100 text-amber-900 font-black text-sm">
                  {totalTableDishesCount} Total Dishes
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                {tableCompactItems.map((item) => (
                  <div
                    key={item.name}
                    className="p-4 rounded-xl bg-[#F8FAFD] border border-slate-200/80 flex items-center justify-between gap-3 shadow-2xs"
                  >
                    <span className="text-base font-extrabold text-[#14274E] leading-snug">
                      {item.name}
                    </span>
                    <strong className="text-xl font-black text-[#14274E] shrink-0 bg-white px-3 py-1 rounded-lg border border-slate-200">
                      ×{item.quantity}
                    </strong>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            tableOrders.map((order) => (
              <article className="order-viewer-card" key={order.orderId}>
                <div className="order-viewer-card-header flex items-center justify-between">
                  <div className="flex flex-col">
                    <strong>{order.tableDisplay}</strong>
                  </div>
                  <span>Order #{order.orderId}</span>
                </div>
                <div className="order-viewer-items">
                  {order.items.map((item) => (
                    <div className="order-viewer-item" key={item.name}>
                      <span>{item.name}</span>
                      <strong>×{item.quantity}</strong>
                    </div>
                  ))}
                </div>
              </article>
            ))
          )
        )}
      </section>
    </main>
  )
}
