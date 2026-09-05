import { useState } from 'react'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { navigation } from '@/config/navigation'
import { NavigationItem } from './NavigationItem'

interface AppSidebarProps {
  open: boolean
  onClose: () => void
}

export function AppSidebar({ }: AppSidebarProps) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={[
        'hidden lg:flex flex-col shrink-0 h-full bg-white border-r border-secondary/15 transition-all duration-200',
        collapsed ? 'w-16' : 'w-72',
      ].join(' ')}
      aria-label="Application navigation"
    >
      {/* Sidebar header */}
      <div className="flex h-14 shrink-0 items-center justify-between px-4 border-b border-secondary/15 overflow-hidden">
        {!collapsed && (
          <span className="text-sm font-bold tracking-tight text-primary">Monolith</span>
        )}
      </div>

      {/* Navigation sections */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-5">
        {navigation.map((section) => (
          <div key={section.section}>
            {!collapsed && (
              <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted">
                {section.section}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavigationItem key={item.path} item={item} collapsed={collapsed} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Collapse toggle button */}
      <div className="shrink-0 border-t border-secondary/15 p-2">
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm text-muted hover:bg-background hover:text-primary transition-colors"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed
            ? <PanelLeftOpen className="h-4 w-4 shrink-0" />
            : <><PanelLeftClose className="h-4 w-4 shrink-0" /><span>Collapse</span></>
          }
        </button>
      </div>
    </aside>
  )
}
