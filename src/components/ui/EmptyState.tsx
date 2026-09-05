import { type LucideIcon, InboxIcon } from 'lucide-react'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
}

export function EmptyState({
  icon: Icon = InboxIcon,
  title,
  description,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-background">
        <Icon className="h-6 w-6 text-muted" strokeWidth={1.5} />
      </div>
      <div>
        <p className="text-sm font-medium text-secondary">{title}</p>
        {description ? (
          <p className="mt-1 text-xs text-muted">{description}</p>
        ) : null}
      </div>
    </div>
  )
}
