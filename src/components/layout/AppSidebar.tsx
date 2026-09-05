import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { X } from 'lucide-react'
import { navigation } from '@/config/navigation'
import { NavigationItem } from './NavigationItem'

interface AppSidebarProps {
  open: boolean
  onClose: () => void
}

export function AppSidebar({ open, onClose }: AppSidebarProps) {
  const location = useLocation()

  // Close sidebar on route change (mobile)
  useEffect(() => {
    onClose()
  }, [location.pathname, onClose])

  // Prevent body scroll when mobile drawer is open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-primary/20 backdrop-blur-xs lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={[
          // Base
          'fixed top-0 left-0 z-40 flex h-full w-72 flex-col',
          'bg-white border-r border-secondary/15',
          // Transition
          'transition-transform duration-250 ease-in-out',
          // Mobile: slide in/out. Desktop: always visible.
          open ? 'translate-x-0' : '-translate-x-full',
          'lg:translate-x-0 lg:static lg:z-auto lg:flex',
        ].join(' ')}
        aria-label="Application navigation"
      >
        {/* Sidebar header */}
        <div className="flex h-14 shrink-0 items-center justify-between px-4 border-b border-secondary/15">
          <span className="text-sm font-bold tracking-tight text-primary">Monolith</span>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-background hover:text-primary transition-colors lg:hidden"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation sections */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-5">
          {navigation.map((section) => (
            <div key={section.section}>
              {/* Section label */}
              <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted">
                {section.section}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <NavigationItem key={item.path} item={item} />
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>
    </>
  )
}
