import { useState, useEffect } from 'react'
import { Receipt, Clock, CheckCircle2, BellRing, UserCheck, Droplets, UtensilsCrossed, MessageSquare } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'
import { fetchAllBillRequests } from '@/services/billService'
import { resolveTableAssistance } from '@/services/assistanceService'
import type { BillRequest, PaymentMethod, BillStatus } from '@/types/bill'
import { PAYMENT_METHOD_LABEL } from '@/types/bill'
import type { AssistanceRequest } from '@/types/assistance'

export default function CashierPage() {
  const [billRequests, setBillRequests] = useState<BillRequest[]>([])
  const [assistanceRequests, setAssistanceRequests] = useState<AssistanceRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // 1. Load initial bill requests and tables with active requests
  useEffect(() => {
    fetchAllBillRequests()
      .then(setBillRequests)
      .catch(console.error)
      .finally(() => setIsLoading(false))

    // Check for tables that currently have HAS_REQUEST
    supabase
      .from('Restaurant_Tables')
      .select('TABLE_ID, TABLE_NUM, STATUS, BILL_OUT_REQUESTED')
      .eq('STATUS', 'HAS_REQUEST')
      .then(
        ({ data }) => {
          if (data && data.length > 0) {
            const active: AssistanceRequest[] = data.map((t) => ({
              id: `table_req_${t.TABLE_ID}`,
              tableId: Number(t.TABLE_ID),
              tableNum: Number(t.TABLE_NUM),
              type: t.BILL_OUT_REQUESTED ? 'BILL_OUT' : 'WAITER',
              title: t.BILL_OUT_REQUESTED ? 'Bill Out Assistance' : 'Table Assistance Needed',
              status: 'PENDING',
              requestedAt: new Date().toISOString(),
            }))
            setAssistanceRequests(active)
          }
        },
        (err: unknown) => console.error(err)
      )

    // 2. Realtime subscription for Bill Requests
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

    // 3. Realtime subscription for Table Assistance Broadcasts & Postgres changes
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

    // Listen to Restaurant_Tables changes
    const tableChangeChannel = supabase
      .channel('cashier-tables-changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'Restaurant_Tables' },
        (payload) => {
          const row = payload.new as Record<string, unknown>
          const tableId = Number(row['TABLE_ID'])
          const status = String(row['STATUS'])
          if (status !== 'HAS_REQUEST') {
            setAssistanceRequests((prev) => prev.filter((r) => r.tableId !== tableId))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(billChannel)
      supabase.removeChannel(assistChannel)
      supabase.removeChannel(tableChangeChannel)
    }
  }, [])

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
    <div className="cashier-page-container space-y-5">
      <PageHeader
        title="Cashier Interface"
        description="Check out tables, manage bills, print receipts & handle customer calls."
      />

      {/* Real-time Assistance Requests Banner / Section */}
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
                  className="p-3.5 rounded-2xl bg-white border-2 border-red-200 shadow-sm flex flex-col justify-between"
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
                      className="w-full text-xs py-1.5"
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

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Incoming Bill Requests */}
        <Card className="border-l-4 border-l-[#E9C46A]">
          <CardHeader title="Incoming Bill Requests" description="Customers requesting to pay" />
          
          <div className="p-1">
            {isLoading ? (
              <div className="p-6 text-center text-muted">Loading requests...</div>
            ) : billRequests.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="No pending bill requests"
                description="When customers request the bill from their device, they will appear here."
              />
            ) : (
              <div className="divide-y divide-secondary/10">
                {billRequests.map((req) => (
                  <div key={req.requestId} className="p-4 hover:bg-secondary/5 transition-colors flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-primary flex items-center gap-2">
                        Table {req.tableId}
                        <span className="text-xs bg-[#F1F6F9] px-2 py-0.5 rounded-full text-[#9BA4B4]">
                          {req.status === 'PROCESSING' ? 'Processing' : 'New Request'}
                        </span>
                      </h4>
                      <div className="flex items-center gap-3 text-sm text-muted mt-1">
                        <span className="flex items-center gap-1">
                          <Receipt className="w-4 h-4" />
                          {PAYMENT_METHOD_LABEL[req.paymentMethod]}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {new Date(req.requestedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                    <Button variant="primary" size="sm">
                      {req.status === 'REQUESTED' ? 'Acknowledge' : 'Process'}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Current bill + payment actions */}
        <Card>
          <CardHeader title="Current Bill" description="Select a table to view its bill" />
          <div className="space-y-2 py-4">
            {['Subtotal', 'Tax', 'Total'].map((label) => (
              <div key={label} className="flex justify-between text-sm">
                <span className="text-muted">{label}</span>
                <span className="font-medium text-primary">—</span>
              </div>
            ))}
          </div>
          <div className="flex gap-2 pt-2 border-t border-secondary/10">
            <Button variant="secondary" size="sm" disabled className="flex-1">Print Receipt</Button>
            <Button variant="primary" size="sm" disabled className="flex-1">Complete Payment</Button>
          </div>
        </Card>
      </div>
    </div>
  )
}
