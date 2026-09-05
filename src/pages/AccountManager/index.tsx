import { Users } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'

export default function AccountManagerPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Account Manager"
        description="Staff credentials and access permissions."
        action={<Button size="sm" disabled>Add Staff</Button>}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader title="Staff Accounts" description="All registered staff members" />
            <EmptyState
              icon={Users}
              title="No staff accounts"
              description="Add staff members to get started."
            />
          </Card>
        </div>

        <div className="space-y-3">
          <Card>
            <CardHeader title="Roles" description="Access role definitions" />
            <EmptyState title="No roles" description="Roles will appear here." />
          </Card>
          <Card>
            <CardHeader title="Permissions" description="Role-based access control" />
            <EmptyState title="No permissions configured" description="Permissions will be set per role." />
          </Card>
        </div>
      </div>
    </div>
  )
}
