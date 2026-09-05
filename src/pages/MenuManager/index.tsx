import { BookOpen } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'

export default function MenuManagerPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Menu Manager"
        description="Menu items, categories, pricing & recipes."
        action={<Button size="sm" disabled>Add Item</Button>}
      />

      <div className="grid gap-5 lg:grid-cols-4">
        {/* Categories sidebar */}
        <Card className="lg:col-span-1">
          <CardHeader title="Categories" />
          <EmptyState
            icon={BookOpen}
            title="No categories"
            description="Add a category to organize your menu."
          />
        </Card>

        {/* Menu items */}
        <div className="space-y-3 lg:col-span-3">
          <Card>
            <CardHeader
              title="Menu Items"
              description="All items in selected category"
              action={<Button size="sm" variant="ghost" disabled>Manage</Button>}
            />
            <EmptyState title="No items" description="Add items to this category." />
          </Card>
        </div>
      </div>
    </div>
  )
}
