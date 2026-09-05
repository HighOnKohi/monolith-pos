import { useState, useEffect } from 'react'
import { Receipt, Clock, CheckCircle2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'
import { fetchAllBillRequests } from '@/services/billService'
import type { BillRequest, PaymentMethod, BillStatus } from '@/types/bill'
import { PAYMENT_METHOD_LABEL } from '@/types/bill'

export default function CashierPage() {
  const [billRequests, setBillRequests] = useState<BillRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // 1. Fetch initial pending requests
    fetchAllBillRequests()
      .then(setBillRequests)
      .catch(console.error)
      .finally(() => setIsLoading(false))

    // 2. Subscribe to realtime updates
    const channel = supabase
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
              // Remove if completed
              setBillRequests((prev) => prev.filter((r) => r.requestId !== id))
            } else {
              // Update status
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

    return () => { supabase.removeChannel(channel) }
  }, [])

  return (
    <div className="cashier-page-container space-y-5">
      <PageHeader
        title="Cashier Interface"
        description="Check out tables, manage bills & print receipts."
      />

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
                title="No pending requests"
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
