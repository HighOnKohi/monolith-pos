import { BarChart2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'

export default function AnalyticsPage() {
  return (
    <div className="analytics-page-container space-y-5">
      <PageHeader
        title="Analytics"
        description="Revenue, order volumes & sales insights."
      />

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {['Revenue', 'Orders', 'Avg. Order', 'Top Item'].map((label) => (
          <Card key={label}>
            <p className="text-xs text-muted">{label}</p>
            <p className="mt-1 text-2xl font-bold text-primary">—</p>
          </Card>
        ))}
      </div>

      {/* Chart placeholders */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Revenue Over Time" description="Daily revenue trend" />
          <EmptyState icon={BarChart2} title="No data" description="Revenue chart will appear here." />
        </Card>
        <Card>
          <CardHeader title="Order Volumes" description="Orders per day" />
          <EmptyState icon={BarChart2} title="No data" description="Order volume chart will appear here." />
        </Card>
      </div>

      <Card>
        <CardHeader title="Sales Insights" description="Top-selling items & categories" />
        <EmptyState title="No insights" description="Sales data will appear here once orders are processed." />
      </Card>
    </div>
  )
}
