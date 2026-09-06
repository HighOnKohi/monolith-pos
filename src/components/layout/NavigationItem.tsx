import { NavLink } from 'react-router-dom'
import { type NavItem } from '@/config/navigation'

interface NavigationItemProps {
  item: NavItem
  onNavigate?: () => void
  collapsed?: boolean
}

export function NavigationItem({ item, onNavigate, collapsed }: NavigationItemProps) {
  const Icon = item.icon

  return (
    <NavLink
      to={item.path}
      onClick={onNavigate}
      title={collapsed ? item.title : undefined}
      className={({ isActive }) =>
        [
          'Nav-button flex items-center transition-colors duration-150',
          collapsed ? 'justify-center gap-0' : 'gap-3',
          isActive
            ? 'is-active bg-primary/8 text-primary'
            : 'text-secondary hover:bg-secondary/8 hover:text-primary',
        ].join(' ')
      }
    >
      {({ isActive }) => (
        <>
          <div
            className={[
              'Nav-button-icon',
              isActive
                ? 'text-primary'
                : 'text-secondary',
            ].join(' ')}
          >
            <Icon className="Nav-button-icon-svg" strokeWidth={1.75} />
          </div>
          {!collapsed && (
            <div className="Nav-button-title">
              <p className="Nav-button-title-main">{item.title}</p>
            </div>
          )}
        </>
      )}
    </NavLink>
  )
}
