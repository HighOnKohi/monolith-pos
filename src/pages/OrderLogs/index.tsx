import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import {
  fetchOrderLogs,
  type OrderLogRow,
  type OrderLogsResponse,
  type PaymentStatusFilter,
  type PaymentMethodFilter,
  type OrderSourceFilter,
  type SortField,
  type SortOrder,
} from '@/services/orderLogsService'
import type { OrderStatus } from '@/types/order'
import { OrderLogsHeader } from './components/OrderLogsHeader'
import { OrderLogsSummaryCards } from './components/OrderLogsSummaryCards'
import { OrderLogsFilterBar, type DatePreset } from './components/OrderLogsFilterBar'
import { OrderLogsTable } from './components/OrderLogsTable'
import { OrderLogsPagination } from './components/OrderLogsPagination'
import { OrderDetailsDrawer } from './components/OrderDetailsDrawer'
import { exportOrderLogsToCsv } from './utils/orderLogsCsv'
import { exportOrderLogsPdf } from './utils/orderLogsPdf'

export default function OrderLogsPage() {
  // ── Filter & Search State ──
  const [search, setSearch] = useState<string>('')
  const [datePreset, setDatePreset] = useState<DatePreset>('last7days')
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>()
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>()
  const [orderStatus, setOrderStatus] = useState<OrderStatus | 'ALL'>('ALL')
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatusFilter>('ALL')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodFilter>('ALL')
  const [orderSource, setOrderSource] = useState<OrderSourceFilter>('ALL')
  const [tableId, setTableId] = useState<number | 'ALL'>('ALL')

  // ── Pagination & Sort State ──
  const [page, setPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(25)
  const [sortBy, setSortBy] = useState<SortField>('TIME')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  // ── Drawer & Selection State ──
  const [selectedOrder, setSelectedOrder] = useState<OrderLogRow | null>(null)
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false)

  // ── Query Data State ──
  const [data, setData] = useState<OrderLogsResponse | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [availableTables, setAvailableTables] = useState<Array<{ id: number; num: number }>>([])

  // ── Calculate Date Range from Preset ──
  const dateRange = useMemo<{ start?: Date; end?: Date }>(() => {
    const now = new Date()
    switch (datePreset) {
      case 'today': {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
        return { start, end }
      }
      case 'yesterday': {
        const y = new Date(now)
        y.setDate(y.getDate() - 1)
        const start = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 0, 0, 0, 0)
        const end = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 23, 59, 59, 999)
        return { start, end }
      }
      case 'last7days': {
        const start = new Date(now)
        start.setDate(start.getDate() - 6)
        start.setHours(0, 0, 0, 0)
        const end = new Date(now)
        end.setHours(23, 59, 59, 999)
        return { start, end }
      }
      case 'last30days': {
        const start = new Date(now)
        start.setDate(start.getDate() - 29)
        start.setHours(0, 0, 0, 0)
        const end = new Date(now)
        end.setHours(23, 59, 59, 999)
        return { start, end }
      }
      case 'custom': {
        return { start: customStartDate, end: customEndDate }
      }
      case 'all':
      default:
        return { start: undefined, end: undefined }
    }
  }, [datePreset, customStartDate, customEndDate])

  // ── Load Available Tables ──
  useEffect(() => {
    supabase
      .from('Restaurant_Tables')
      .select('TABLE_ID, TABLE_NUM')
      .order('TABLE_NUM', { ascending: true })
      .then(({ data: tables }) => {
        if (tables) {
          setAvailableTables(
            tables.map((t) => ({
              id: Number(t.TABLE_ID),
              num: Number(t.TABLE_NUM) || Number(t.TABLE_ID),
            })),
          )
        }
      })
  }, [])

  // ── Primary Data Fetcher ──
  const loadOrderLogs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const resp = await fetchOrderLogs({
        search,
        startDate: dateRange.start,
        endDate: dateRange.end,
        orderStatus,
        paymentStatus,
        paymentMethod,
        orderSource,
        tableId,
        page,
        pageSize,
        sortBy,
        sortOrder,
      })
      setData(resp)
    } catch (err) {
      console.error('[OrderLogsPage] Load error:', err)
      setError((err as Error).message || 'Failed to load order logs.')
    } finally {
      setLoading(false)
    }
  }, [
    search,
    dateRange,
    orderStatus,
    paymentStatus,
    paymentMethod,
    orderSource,
    tableId,
    page,
    pageSize,
    sortBy,
    sortOrder,
  ])

  useEffect(() => {
    loadOrderLogs()
  }, [loadOrderLogs])

  // ── Realtime Subscriptions ──
  useEffect(() => {
    const channel = supabase
      .channel('order_logs_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'Restaurant_Orders' },
        () => {
          loadOrderLogs()
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'Order_Events' },
        () => {
          loadOrderLogs()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadOrderLogs])

  // ── Reset Page on Filter Change ──
  const handleSearchChange = (val: string) => {
    setSearch(val)
    setPage(1)
  }

  const handleDatePresetChange = (preset: DatePreset) => {
    setDatePreset(preset)
    setPage(1)
  }

  const handleCustomDateChange = (start?: Date, end?: Date) => {
    setCustomStartDate(start)
    setCustomEndDate(end)
    setPage(1)
  }

  const handleOrderStatusChange = (status: OrderStatus | 'ALL') => {
    setOrderStatus(status)
    setPage(1)
  }

  const handlePaymentStatusChange = (ps: PaymentStatusFilter) => {
    setPaymentStatus(ps)
    setPage(1)
  }

  const handlePaymentMethodChange = (pm: PaymentMethodFilter) => {
    setPaymentMethod(pm)
    setPage(1)
  }

  const handleOrderSourceChange = (source: OrderSourceFilter) => {
    setOrderSource(source)
    setPage(1)
  }

  const handleTableIdChange = (tId: number | 'ALL') => {
    setTableId(tId)
    setPage(1)
  }

  const handleClearFilters = () => {
    setSearch('')
    setDatePreset('all')
    setCustomStartDate(undefined)
    setCustomEndDate(undefined)
    setOrderStatus('ALL')
    setPaymentStatus('ALL')
    setPaymentMethod('ALL')
    setOrderSource('ALL')
    setTableId('ALL')
    setPage(1)
  }

  const hasActiveFilters =
    search.trim().length > 0 ||
    datePreset !== 'all' ||
    orderStatus !== 'ALL' ||
    paymentStatus !== 'ALL' ||
    paymentMethod !== 'ALL' ||
    orderSource !== 'ALL' ||
    tableId !== 'ALL'

  // ── Sort Toggle Handler ──
  const handleSortChange = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
    setPage(1)
  }

  // ── Drawer Handlers ──
  const handleSelectOrder = (order: OrderLogRow) => {
    setSelectedOrder(order)
    setDrawerOpen(true)
  }

  const handleCloseDrawer = () => {
    setDrawerOpen(false)
  }

  // ── Export Handlers ──
  const handleExportCsv = () => {
    if (!data) return
    const filterDesc = [
      datePreset !== 'all' ? `Date: ${datePreset}` : 'All Time',
      orderStatus !== 'ALL' ? `Status: ${orderStatus}` : null,
      paymentStatus !== 'ALL' ? `Payment: ${paymentStatus}` : null,
      orderSource !== 'ALL' ? `Source: ${orderSource}` : null,
    ]
      .filter(Boolean)
      .join(', ')

    exportOrderLogsToCsv(data.orders, filterDesc)
  }

  const handleExportPdf = () => {
    if (!data) return
    const filterDesc = [
      datePreset !== 'all' ? `Date: ${datePreset}` : 'All Time',
      orderStatus !== 'ALL' ? `Status: ${orderStatus}` : null,
      paymentStatus !== 'ALL' ? `Payment: ${paymentStatus}` : null,
      orderSource !== 'ALL' ? `Source: ${orderSource}` : null,
    ]
      .filter(Boolean)
      .join(', ')

    exportOrderLogsPdf({
      orders: data.orders,
      summary: data.summary,
      filterDescription: filterDesc || 'All Historical Records',
    })
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="order-logs-page-container staff-page space-y-4 pb-12">
      {/* Header with Title & Action Buttons */}
      <OrderLogsHeader
        onRefresh={loadOrderLogs}
        onPrint={handlePrint}
        onExportCsv={handleExportCsv}
        onExportPdf={handleExportPdf}
        loading={loading}
      />

      {/* Summary KPI Cards across all filtered results */}
      {data && (
        <div className="no-print">
          <OrderLogsSummaryCards summary={data.summary} loading={loading} />
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="no-print">
        <OrderLogsFilterBar
          search={search}
          onSearchChange={handleSearchChange}
          datePreset={datePreset}
          onDatePresetChange={handleDatePresetChange}
          customStartDate={customStartDate}
          customEndDate={customEndDate}
          onCustomDateChange={handleCustomDateChange}
          orderStatus={orderStatus}
          onOrderStatusChange={handleOrderStatusChange}
          paymentStatus={paymentStatus}
          onPaymentStatusChange={handlePaymentStatusChange}
          paymentMethod={paymentMethod}
          onPaymentMethodChange={handlePaymentMethodChange}
          orderSource={orderSource}
          onOrderSourceChange={handleOrderSourceChange}
          tableId={tableId}
          onTableIdChange={handleTableIdChange}
          availableTables={availableTables}
          onClearFilters={handleClearFilters}
          hasActiveFilters={hasActiveFilters}
        />
      </div>

      {/* Main Order Logs Table */}
      {error ? (
        <div className="bg-white rounded-2xl p-8 border border-rose-200 text-center space-y-3">
          <p className="text-sm font-black text-rose-800">Error Loading Order Logs</p>
          <p className="text-xs text-rose-600">{error}</p>
          <button
            type="button"
            onClick={loadOrderLogs}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            Retry Loading
          </button>
        </div>
      ) : (
        <OrderLogsTable
          orders={data?.orders ?? []}
          loading={loading && !data}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSortChange={handleSortChange}
          onSelectOrder={handleSelectOrder}
          selectedOrderId={selectedOrder?.orderId}
        />
      )}

      {/* Pagination Controls */}
      {data && (
        <div className="no-print">
          <OrderLogsPagination
            currentPage={data.currentPage}
            totalPages={data.totalPages}
            totalCount={data.totalCount}
            pageSize={pageSize}
            onPageChange={(p) => setPage(p)}
            onPageSizeChange={(s) => {
              setPageSize(s)
              setPage(1)
            }}
          />
        </div>
      )}

      {/* Slide-Over Order Details Drawer */}
      <OrderDetailsDrawer
        order={selectedOrder}
        isOpen={drawerOpen}
        onClose={handleCloseDrawer}
      />
    </div>
  )
}
