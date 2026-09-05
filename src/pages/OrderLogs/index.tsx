import { ClipboardList } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'

export default function OrderLogsPage() {
  return (
    <div className="order-logs-page-container staff-page space-y-5">
      <PageHeader
        title="Order Logs"
        description="Audit trails of completed and active orders."
      />

      {/* Filters */}
      <Card>
        <CardHeader title="Filters" description="Narrow down order records" />
        <div className="flex flex-wrap gap-2">
          {['All', 'Completed', 'Cancelled', 'Today', 'This Week'].map((f) => (
            <button
              key={f}
              disabled
              className="rounded-lg border border-secondary/20 px-3 py-1 text-xs font-medium text-muted disabled:opacity-50"
            >
              {f}
            </button>
          ))}
        </div>
      </Card>

      {/* Log table */}
      <Card>
        <CardHeader title="Order Log" description="Complete audit trail" />
        <EmptyState
          icon={ClipboardList}
          title="No order logs"
          description="Completed and active orders will appear here."
        />
      </Card>

      {/* Order details panel */}
      <Card>
        <CardHeader title="Order Details" description="Select an order to view its details" />
        <EmptyState title="No order selected" description="Click an order from the log to view its details." />
      </Card>
    </div>
  )
}
