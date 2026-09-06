import { useState } from 'react'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { navigation } from '@/config/navigation'
import { NavigationItem } from './NavigationItem'

interface AppSidebarProps {
  open: boolean
  onClose: () => void
}

export function AppSidebar(props: AppSidebarProps) {
  void props
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={[
        'app-sidebar hidden lg:flex flex-col shrink-0 h-full bg-white border-r border-secondary/15 transition-all duration-200',
        collapsed ? 'sidebar-collapsed' : 'sidebar-expanded',
      ].join(' ')}
      aria-label="Application navigation"
    >
      <div className="Sidebar-header">
        <span className="Sidebar-header-logo">M</span>
        {!collapsed && <span className="Sidebar-header-title">Monolith</span>}
      </div>

      <nav className="Sidebar-nav-buttons-container">
        {navigation.map((section) => (
          <div className="Nav-category" key={section.section}>
            <p className={['Nav-category-header', collapsed ? 'is-hidden' : ''].join(' ')}>
              {section.section}
            </p>
            <div className="Nav-category-buttons">
              {section.items.map((item) => (
                <NavigationItem key={item.path} item={item} collapsed={collapsed} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* ======== SIDEBAR BOTTOM BUTTONS — edit buttons here ======== */}
      <div className="Sidebar-footer">
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="Sidebar-footer-button"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed
            ? <PanelLeftOpen className="Sidebar-footer-icon" />
            : <><PanelLeftClose className="Sidebar-footer-icon" /><span>Collapse</span></>
          }
        </button>
      </div>
    </aside>
  )
}
