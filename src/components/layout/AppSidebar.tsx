import { useState } from 'react'
import { PanelLeftClose, PanelLeftOpen, X } from 'lucide-react'
import { navigation } from '@/config/navigation'
import { NavigationItem } from './NavigationItem'
import monolithLogoYellow from '@/assets/images/monolith-logo-yellow.png'

interface AppSidebarProps {
  open: boolean
  onClose: () => void
}

export function AppSidebar({ open, onClose }: AppSidebarProps) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <>
      {/* Mobile Drawer (visible on < lg when open is true) */}
      {open && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs lg:hidden animate-backdrop-fade"
            onClick={onClose}
          />
          <aside
            className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-white shadow-2xl flex flex-col lg:hidden animate-slide-right app-sidebar border-r border-slate-200"
            aria-label="Mobile application navigation"
          >
            <div className="Sidebar-header flex items-center justify-between pr-3">
              <div className="flex items-center gap-2">
                <div className="Sidebar-header-logo">
                  <img src={monolithLogoYellow} alt="Monolith Logo" className="w-8 h-8 object-contain drop-shadow-xs" />
                </div>
                <span className="Sidebar-header-title">Monolith</span>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="Close sidebar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="Sidebar-nav-buttons-container flex-1 overflow-y-auto px-2 py-3">
              {navigation.map((section) => (
                <div className="Nav-category" key={section.section}>
                  <p className="Nav-category-header">{section.section}</p>
                  <div className="Nav-category-buttons">
                    {section.items.map((item) => (
                      <div key={item.path} onClick={onClose}>
                        <NavigationItem item={item} collapsed={false} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </nav>
          </aside>
        </>
      )}

      {/* Desktop Persistent Sidebar (hidden on < lg, untouched on desktop) */}
      <aside
        className={[
          'app-sidebar hidden lg:flex flex-col shrink-0 h-full bg-white border-r border-secondary/15 transition-all duration-200',
          collapsed ? 'sidebar-collapsed' : 'sidebar-expanded',
        ].join(' ')}
        aria-label="Application navigation"
      >
      <div className="Sidebar-header">
        <div className="Sidebar-header-logo">
          <img src={monolithLogoYellow} alt="Monolith Logo" className="w-8 h-8 object-contain drop-shadow-xs" />
        </div>
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
  </>
  )
}
