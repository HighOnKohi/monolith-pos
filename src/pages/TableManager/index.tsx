import { LayoutGrid, QrCode } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'

export default function TableManagerPage() {
  return (
    <div className="table-manager-page-container space-y-5">
      <PageHeader
        title="Table Manager"
        description="Restaurant layout, tables & QR code generator."
        action={<Button size="sm" disabled>Add Table</Button>}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Restaurant layout */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader title="Restaurant Layout" description="Visual floor plan" />
            <EmptyState
              icon={LayoutGrid}
              title="No layout configured"
              description="Add tables to build your restaurant floor plan."
            />
          </Card>
        </div>

        {/* QR code actions */}
        <Card>
          <CardHeader title="QR Code Generator" description="Generate per-table QR codes" />
          <EmptyState
            icon={QrCode}
            title="Select a table"
            description="Select a table from the layout to generate its QR code."
          />
        </Card>
      </div>

      {/* Table list */}
      <Card>
        <CardHeader title="All Tables" description="Manage individual tables" />
        <EmptyState title="No tables" description="Add tables to get started." />
      </Card>
    </div>
  )
}
