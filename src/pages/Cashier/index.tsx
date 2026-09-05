import { Receipt } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'

export default function CashierPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Cashier Interface"
        description="Check out tables, manage bills & print receipts."
      />

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Active tables */}
        <Card>
          <CardHeader title="Active Tables" description="Tables with open bills" />
          <EmptyState
            icon={Receipt}
            title="No active tables"
            description="Tables with open orders will appear here."
          />
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
            <Button variant="primary" size="sm" disabled className="flex-1">Process Payment</Button>
          </div>
        </Card>
      </div>
    </div>
  )
}
