import { QrCode } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'

export default function CustomerPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Customer Interface"
        description="Preview the diner QR ordering experience."
      />

      <div className="grid gap-5 md:grid-cols-3">
        <Card>
          <CardHeader title="QR Ordering Preview" description="Diner-facing QR entry point" />
          <EmptyState icon={QrCode} title="QR preview not available" description="Configure a table to generate its QR code." />
        </Card>

        <Card>
          <CardHeader title="Menu Preview" description="Items visible to customers" />
          <EmptyState title="No menu items" description="Add menu items in the Menu Manager." />
        </Card>

        <Card>
          <CardHeader title="Cart Preview" description="Customer's current cart" />
          <EmptyState title="Empty cart" description="Items added by the customer will appear here." />
        </Card>
      </div>
    </div>
  )
}
