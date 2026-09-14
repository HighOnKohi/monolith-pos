import { NavLink } from 'react-router-dom'
import { type NavItem } from '@/config/navigation'

export interface NavigationItemProps {
  item: NavItem
  onNavigate?: () => void
  collapsed?: boolean
  isSubItem?: boolean
  isFirstSubItem?: boolean
  isLastSubItem?: boolean
}

export function NavigationItem({
  item,
  onNavigate,
  collapsed,
  isSubItem = false,
  isFirstSubItem = false,
  isLastSubItem = false,
}: NavigationItemProps) {
  const Icon = item.icon

  if (isSubItem && !collapsed) {
    return (
      <NavLink
        to={item.path}
        onClick={onNavigate}
        title={item.title}
        className={({ isActive }) =>
          [
            'Nav-sub-item-btn group/sub flex items-center w-full transition-all duration-150 relative overflow-hidden',
            isActive
              ? 'is-active bg-[#14274E] text-[#E9C46A] shadow-xs'
              : 'text-[#394867] hover:bg-[#E2E8F0] hover:text-[#14274E]',
          ].join(' ')
        }
      >
        {({ isActive }) => (
          <>
            {/* Tree Branch / Line Pointer Connector Inside the Navbar Container */}
            <div className="Nav-sub-line-pointer shrink-0" aria-hidden="true">
              {/* Vertical continuation spine */}
              <div
                className={`Nav-sub-line-v ${isFirstSubItem ? 'is-first' : ''} ${isLastSubItem ? 'is-last' : ''} ${
                  isActive ? 'is-active' : ''
                }`}
              />
              {/* Horizontal branch line pointing to sub-option */}
              <div className={`Nav-sub-line-h ${isActive ? 'is-active' : ''}`} />
            </div>

            {/* Sub-option Icon */}
            <div className="Nav-sub-icon-box shrink-0 mr-2.5">
              <Icon
                className={`w-4 h-4 transition-colors ${
                  isActive ? 'text-[#E9C46A]' : 'text-slate-500 group-hover/sub:text-[#14274E]'
                }`}
                strokeWidth={2}
              />
            </div>

            {/* Sub-option Title Text */}
            <span
              className={`Nav-sub-title text-[13px] leading-tight truncate ${
                isActive ? 'text-[#E9C46A] font-bold' : 'font-semibold'
              }`}
            >
              {item.title}
            </span>
          </>
        )}
      </NavLink>
    )
  }

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
            ? 'is-active bg-[#14274E] text-[#E9C46A]'
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
                ? 'text-[#E9C46A]'
                : 'text-secondary',
            ].join(' ')}
          >
            <Icon className={`Nav-button-icon-svg ${isActive ? 'text-[#E9C46A]' : ''}`} strokeWidth={1.75} />
          </div>
          {!collapsed && (
            <div className="Nav-button-title">
              <p className={`Nav-button-title-main ${isActive ? 'text-[#E9C46A]' : ''}`}>{item.title}</p>
            </div>
          )}
        </>
      )}
    </NavLink>
  )
}
