import { useState, useEffect, useCallback } from 'react'
import {
  Receipt,
  Clock,
  CheckCircle2,
  BellRing,
  UserCheck,
  Droplets,
  UtensilsCrossed,
  MessageSquare,
  ChefHat,
  Check,
  CreditCard,
  Printer,
  RefreshCw,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'
import { fetchAllBillRequests, updateBillRequestStatus } from '@/services/billService'
import { resolveTableAssistance } from '@/services/assistanceService'
import { fetchOrdersByTable } from '@/services/orderService'
import type { BillRequest, PaymentMethod, BillStatus } from '@/types/bill'
import { PAYMENT_METHOD_LABEL } from '@/types/bill'
import type { AssistanceRequest } from '@/types/assistance'
import type { Order } from '@/types/order'

interface SelectedTableBill {
  tableId: number
  billRequestId?: number
  orders: Order[]
  subtotal: number
  tax: number
  total: number
  paymentMethod?: PaymentMethod
}

export default function CashierPage() {
  const [billRequests, setBillRequests] = useState<BillRequest[]>([])
  const [assistanceRequests, setAssistanceRequests] = useState<AssistanceRequest[]>([])
  const [verifiedOrders, setVerifiedOrders] = useState<Order[]>([])
  const [selectedTableBill, setSelectedTableBill] = useState<SelectedTableBill | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // 1. Load initial bill requests, verified orders, and tables with active requests
  const loadInitialData = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true)
    try {
      // Bill Requests
      const bData = await fetchAllBillRequests()
      setBillRequests(bData)

      // Verified Orders from Kitchen awaiting cashier acknowledgment
      const { data: vData } = await supabase
        .from('Restaurant_Orders')
        .select('*')
        .eq('ORDER_STATUS', 'VERIFIED')
        .order('ORDER_ID', { ascending: false })

      if (vData) {
        setVerifiedOrders(
          vData.map((row) => ({
            orderId: Number(row['ORDER_ID']),
            tableId: Number(row['TABLE_ID']),
            orderStatus: row['ORDER_STATUS'],
            orderType: row['ORDER_TYPE'],
            totalBill: Number(row['TOTAL_BILL'] ?? 0),
            createdAt: row['TIME'],
          }))
        )
      }

      // Check for tables that currently have HAS_REQUEST
      const { data: tData } = await supabase
        .from('Restaurant_Tables')
        .select('TABLE_ID, TABLE_NUM, STATUS, BILL_OUT_REQUESTED')
        .eq('STATUS', 'HAS_REQUEST')

      if (tData && tData.length > 0) {
        const active: AssistanceRequest[] = tData.map((t) => ({
          id: `table_req_${t.TABLE_ID}`,
          tableId: Number(t.TABLE_ID),
          tableNum: Number(t.TABLE_NUM),
          type: t.BILL_OUT_REQUESTED ? 'BILL_OUT' : 'WAITER',
          title: t.BILL_OUT_REQUESTED ? 'Bill Out Assistance' : 'Table Assistance Needed',
          status: 'PENDING',
          requestedAt: new Date().toISOString(),
        }))
        setAssistanceRequests(active)
      } else {
        setAssistanceRequests([])
      }
    } catch (err) {
      console.error(err)
    } finally {
      if (!silent) setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadInitialData(false)

    // Constantly fetch updates every 2500ms in background
    const interval = setInterval(() => {
      loadInitialData(true)
    }, 2500)

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadInitialData(true)
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Realtime subscription for Bill Requests
    const billChannel = supabase
      .channel('cashier-bill-requests')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'Bill_Requests' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const row = payload.new as Record<string, unknown>
            if (row['STATUS'] === 'REQUESTED' || row['STATUS'] === 'PROCESSING') {
              setBillRequests((prev) => [
                {
                  requestId: Number(row['REQUEST_ID']),
                  tableId: Number(row['TABLE_ID']),
                  orderId: row['ORDER_ID'] != null ? Number(row['ORDER_ID']) : undefined,
                  paymentMethod: row['PAYMENT_METHOD'] as PaymentMethod,
                  status: row['STATUS'] as BillStatus,
                  requestedAt: String(row['REQUESTED_AT']),
                },
                ...prev,
              ])
            }
          } else if (payload.eventType === 'UPDATE') {
            const row = payload.new as Record<string, unknown>
            const status = row['STATUS'] as string
            const id = Number(row['REQUEST_ID'])
            
            if (status === 'PAID' || status === 'CANCELLED') {
              setBillRequests((prev) => prev.filter((r) => r.requestId !== id))
            } else {
              setBillRequests((prev) =>
                prev.map((r) => (r.requestId === id ? { ...r, status: status as BillStatus } : r))
              )
            }
          } else if (payload.eventType === 'DELETE') {
            const row = payload.old as Record<string, unknown>
            setBillRequests((prev) => prev.filter((r) => r.requestId !== Number(row['REQUEST_ID'])))
          }
        }
      )
      .subscribe()

    // Realtime subscription for Verified Kitchen Orders
    const ordersChannel = supabase
      .channel('cashier-orders-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'Restaurant_Orders' },
        () => {
          loadInitialData(true)
        }
      )
      .subscribe()

    // Realtime subscription for Table Assistance Broadcasts
    const assistChannel = supabase
      .channel('table-assistance')
      .on('broadcast', { event: 'assistance_request' }, (payload) => {
        const req = payload.payload as AssistanceRequest
        setAssistanceRequests((prev) => {
          const filtered = prev.filter((r) => r.tableId !== req.tableId)
          return [req, ...filtered]
        })
      })
      .on('broadcast', { event: 'assistance_resolved' }, (payload) => {
        const { tableId } = payload.payload as { tableId: number }
        setAssistanceRequests((prev) => prev.filter((r) => r.tableId !== tableId))
      })
      .subscribe()

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      supabase.removeChannel(billChannel)
      supabase.removeChannel(ordersChannel)
      supabase.removeChannel(assistChannel)
    }
  }, [loadInitialData])

  // Handlers for Bill Requests
  const handleAcknowledgeBillRequest = async (
    requestId: number,
    currentStatus: BillStatus,
    tableId: number,
    e?: React.MouseEvent
  ) => {
    e?.stopPropagation()
    const nextStatus: BillStatus = currentStatus === 'REQUESTED' ? 'PROCESSING' : 'PAID'
    try {
      await updateBillRequestStatus(requestId, nextStatus, tableId)
      if (nextStatus === 'PAID') {
        setBillRequests((prev) => prev.filter((r) => r.requestId !== requestId))
        if (selectedTableBill?.billRequestId === requestId) {
          setSelectedTableBill(null)
        }
      } else {
        setBillRequests((prev) =>
          prev.map((r) => (r.requestId === requestId ? { ...r, status: nextStatus } : r))
        )
      }
    } catch (err) {
      console.error('Failed to update bill request:', err)
    }
  }

  // Handler for Kitchen-Verified Orders
  const handleAcknowledgeVerifiedOrder = async (orderId: number) => {
    try {
      await supabase
        .from('Restaurant_Orders')
        .update({ ORDER_STATUS: 'PREPARING' })
        .eq('ORDER_ID', orderId)

      setVerifiedOrders((prev) => prev.filter((o) => o.orderId !== orderId))
    } catch (err) {
      console.error('Failed to acknowledge verified order:', err)
    }
  }

  // Select Table for Bill Breakdown
  const handleSelectBillTable = async (req: BillRequest) => {
    try {
      const orders = await fetchOrdersByTable(req.tableId)
      const total = orders.reduce((sum, o) => sum + (o.totalBill || 0), 0)
      const subtotal = total / 1.05
      const tax = total - subtotal

      setSelectedTableBill({
        tableId: req.tableId,
        billRequestId: req.requestId,
        orders,
        subtotal,
        tax,
        total,
        paymentMethod: req.paymentMethod,
      })
    } catch (err) {
      console.error(err)
    }
  }

  // Complete Payment from Current Bill Card
  const handleCompletePayment = async () => {
    if (!selectedTableBill) return
    if (selectedTableBill.billRequestId) {
      await updateBillRequestStatus(
        selectedTableBill.billRequestId,
        'PAID',
        selectedTableBill.tableId
      )
      setBillRequests((prev) =>
        prev.filter((r) => r.requestId !== selectedTableBill.billRequestId)
      )
    }
    setSelectedTableBill(null)
  }

  const handleResolveAssistance = async (tableId: number) => {
    setAssistanceRequests((prev) => prev.filter((r) => r.tableId !== tableId))
    await resolveTableAssistance(tableId)
  }

  const getAssistanceIcon = (type: string) => {
    switch (type) {
      case 'WATER': return <Droplets className="w-4 h-4 text-blue-500" />
      case 'WAITER': return <UserCheck className="w-4 h-4 text-amber-500" />
      case 'UTENSILS': return <UtensilsCrossed className="w-4 h-4 text-emerald-500" />
      case 'BILL_OUT': return <Receipt className="w-4 h-4 text-purple-500" />
      default: return <MessageSquare className="w-4 h-4 text-[#14274E]" />
    }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Cashier Interface"
        description="Check out tables, acknowledge verified orders & process live bill requests."
        action={
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void loadInitialData()}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </Button>
        }
      />

      {/* Real-time Assistance Requests Section */}
      <Card className="border-l-4 border-l-red-500 bg-linear-to-r from-red-50/20 to-transparent">
        <CardHeader
          title="Customer Assistance Calls"
          description="Live requests from tables asking for water, waiter, utensils, or help"
        />
        <div className="p-4">
          {assistanceRequests.length === 0 ? (
            <div className="py-6 text-center text-[#9BA4B4] text-xs font-semibold flex items-center justify-center gap-2">
              <BellRing className="w-4 h-4 text-[#9BA4B4]" />
              <span>No pending table assistance calls. All tables are attended.</span>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {assistanceRequests.map((req) => (
                <div
                  key={req.id}
                  className="p-3.5 rounded-2xl bg-white border-2 border-red-200 shadow-sm flex flex-col justify-between interactive-card"
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-extrabold text-[#14274E] text-sm flex items-center gap-1.5">
                        {getAssistanceIcon(req.type)}
                        Table {req.tableNum ?? req.tableId}
                      </span>
                      <span className="text-[10px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full animate-pulse">
                        CALL
                      </span>
                    </div>
                    <p className="text-xs font-bold text-[#394867]">{req.title}</p>
                    {req.notes && (
                      <p className="text-xs text-[#9BA4B4] italic mt-1 line-clamp-2">
                        "{req.notes}"
                      </p>
                    )}
                    <span className="text-[10px] text-[#9BA4B4] flex items-center gap-1 mt-2">
                      <Clock className="w-3 h-3" />
                      {new Date(req.requestedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="mt-3 pt-2 border-t border-[#9BA4B4]/15">
                    <Button
                      variant="primary"
                      size="sm"
                      className="w-full text-xs py-1.5 interactive-button"
                      onClick={() => handleResolveAssistance(req.tableId)}
                    >
                      Acknowledge & Clear
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Kitchen-Verified Orders Section (Incoming from Kitchen) */}
      <Card className="border-l-4 border-l-blue-500">
        <CardHeader
          title="Kitchen-Verified Orders (Awaiting Cashier Confirmation)"
          description="Orders checked and accepted by kitchen staff, ready for cashier acknowledgement"
        />
        <div className="p-4">
          {verifiedOrders.length === 0 ? (
            <div className="py-6 text-center text-[#9BA4B4] text-xs font-semibold flex items-center justify-center gap-2">
              <ChefHat className="w-4 h-4 text-[#9BA4B4]" />
              <span>No new verified orders from the kitchen awaiting cashier review.</span>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {verifiedOrders.map((order) => (
                <div
                  key={order.orderId}
                  className="p-3.5 rounded-2xl bg-white border-2 border-blue-200 shadow-sm flex flex-col justify-between interactive-card"
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-extrabold text-[#14274E] text-sm">
                        Table {order.tableId}
                      </span>
                      <span className="text-[10px] font-bold text-blue-800 bg-blue-100 px-2 py-0.5 rounded-md">
                        Order #{order.orderId}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-[#394867]">
                      Total: ₱{order.totalBill.toFixed(2)}
                    </p>
                    <p className="text-[11px] text-[#9BA4B4] mt-0.5">
                      Type: {order.orderType}
                    </p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-[#9BA4B4]/15">
                    <Button
                      variant="primary"
                      size="sm"
                      className="w-full text-xs py-1.5 bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-1"
                      onClick={() => handleAcknowledgeVerifiedOrder(order.orderId)}
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Acknowledge Order</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Incoming Bill Requests */}
        <Card className="border-l-4 border-l-[#E9C46A]">
          <CardHeader
            title="Incoming Bill Requests"
            description="Customers requesting checkout (Click row to inspect bill)"
          />
          
          <div className="p-1">
            {isLoading ? (
              <div className="p-6 text-center text-muted">Loading requests...</div>
            ) : billRequests.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="No pending bill requests"
                description="When customers request the bill from their device once served, they appear here."
              />
            ) : (
              <div className="divide-y divide-secondary/10">
                {billRequests.map((req) => {
                  const isSelected = selectedTableBill?.billRequestId === req.requestId
                  return (
                    <div
                      key={req.requestId}
                      onClick={() => handleSelectBillTable(req)}
                      className={[
                        'p-4 transition-colors flex items-center justify-between cursor-pointer',
                        isSelected
                          ? 'bg-[#14274E]/10 ring-1 ring-[#14274E]'
                          : 'hover:bg-secondary/5',
                      ].join(' ')}
                    >
                      <div>
                        <h4 className="font-bold text-primary flex items-center gap-2">
                          Table {req.tableId}
                          <span
                            className={[
                              'text-xs px-2 py-0.5 rounded-full font-bold',
                              req.status === 'PROCESSING'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-blue-100 text-blue-800',
                            ].join(' ')}
                          >
                            {req.status === 'PROCESSING' ? 'Processing' : 'New Request'}
                          </span>
                        </h4>
                        <div className="flex items-center gap-3 text-sm text-muted mt-1">
                          <span className="flex items-center gap-1 font-semibold text-[#14274E]">
                            <Receipt className="w-4 h-4 text-[#E9C46A]" />
                            {PAYMENT_METHOD_LABEL[req.paymentMethod]}
                          </span>
                          <span className="flex items-center gap-1 text-xs">
                            <Clock className="w-3.5 h-3.5" />
                            {new Date(req.requestedAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="primary"
                          size="sm"
                          className="text-xs"
                          onClick={(e) =>
                            handleAcknowledgeBillRequest(
                              req.requestId,
                              req.status,
                              req.tableId,
                              e
                            )
                          }
                        >
                          {req.status === 'REQUESTED' ? 'Acknowledge' : 'Complete / Paid'}
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </Card>

        {/* Current Bill Breakdown & Checkout Card */}
        <Card>
          <CardHeader
            title={
              selectedTableBill
                ? `Current Bill — Table ${selectedTableBill.tableId}`
                : 'Current Bill'
            }
            description={
              selectedTableBill
                ? `Payment method: ${selectedTableBill.paymentMethod ? PAYMENT_METHOD_LABEL[selectedTableBill.paymentMethod] : 'Cash'}`
                : 'Select an incoming bill request from the left to view breakdown'
            }
          />

          <div className="p-5">
            {selectedTableBill ? (
              <div className="space-y-4">
                {/* Orders count */}
                <div className="p-3 bg-[#F1F6F9] rounded-xl text-xs font-bold text-[#394867] flex justify-between">
                  <span>Active Batches: {selectedTableBill.orders.length}</span>
                  <span>Status: Ready for Payment</span>
                </div>

                <div className="space-y-2 py-2 border-t border-b border-secondary/10">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted">Subtotal</span>
                    <span className="font-semibold text-primary">
                      ₱{selectedTableBill.subtotal.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted">Tax (5%)</span>
                    <span className="font-semibold text-primary">
                      ₱{selectedTableBill.tax.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-base font-black pt-1 border-t border-secondary/10">
                    <span className="text-[#14274E]">Grand Total</span>
                    <span className="text-[#14274E] text-lg">
                      ₱{selectedTableBill.total.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="flex-1 flex items-center justify-center gap-1"
                    onClick={() => window.print()}
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print Receipt</span>
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-1"
                    onClick={handleCompletePayment}
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>Complete Payment</span>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="py-16 text-center text-muted text-sm">
                Select a table request above to load its bill summary and complete payment.
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
