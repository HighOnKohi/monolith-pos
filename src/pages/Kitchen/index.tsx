import { UtensilsCrossed } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'

export default function KitchenPage() {
  return (
    <div className="kitchen-page-container space-y-5">
      <PageHeader
        title="Kitchen Interface"
        description="View live orders & start cooking queue."
      />

      {/* Status summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {['Pending', 'In Progress', 'Ready', 'Completed'].map((label) => (
          <Card key={label}>
            <p className="text-xs text-muted">{label}</p>
            <p className="mt-1 text-2xl font-bold text-primary">—</p>
          </Card>
        ))}
      </div>

      {/* Orders area */}
      <Card>
        <CardHeader title="Live Orders" description="Active cooking queue" />
        <EmptyState
          icon={UtensilsCrossed}
          title="No active orders"
          description="Orders will appear here when customers place them."
        />
      </Card>
    </div>
  )
}
