import { NavLink } from 'react-router-dom'
import { type NavItem } from '@/config/navigation'

interface NavigationItemProps {
  item: NavItem
  onNavigate?: () => void
}

export function NavigationItem({ item, onNavigate }: NavigationItemProps) {
  const Icon = item.icon

  return (
    <NavLink
      to={item.path}
      onClick={onNavigate}
      className={({ isActive }) =>
        [
          'flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors duration-150',
          isActive
            ? 'bg-primary/8 text-primary'
            : 'text-secondary hover:bg-secondary/8 hover:text-primary',
        ].join(' ')
      }
    >
      {({ isActive }) => (
        <>
          <div
            className={[
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border',
              isActive
                ? 'border-primary/20 bg-primary/8 text-primary'
                : 'border-secondary/20 bg-background text-secondary',
            ].join(' ')}
          >
            <Icon className="h-4 w-4" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight truncate">{item.title}</p>
            <p className="text-xs text-muted leading-tight truncate mt-0.5">
              {item.description}
            </p>
          </div>
        </>
      )}
    </NavLink>
  )
}
