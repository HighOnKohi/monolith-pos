import { useLocation } from 'react-router-dom'
import { Menu, LogOut, UserCircle, KeyRound } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { navigation } from '@/config/navigation'
import { APP_NAME } from '@/config/app'
import { getActiveStaffSession } from '@/services/staffCodeService'

interface AppHeaderProps {
  onMenuToggle: () => void
}

/** Resolve the current page title from navigation config */
function usePageTitle(): string {
  const { pathname } = useLocation()
  for (const section of navigation) {
    const found = section.items.find((item) => item.path === pathname)
    if (found) return found.title
  }
  return APP_NAME
}

export function AppHeader({ onMenuToggle }: AppHeaderProps) {
  const { user, signOut } = useAuth()
  const pageTitle = usePageTitle()
  const activeStaff = getActiveStaffSession()

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-secondary/15 bg-white px-4 rounded-tr-2xl">
      {/* Left: burger + page title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-secondary hover:bg-background hover:text-primary transition-colors lg:hidden"
          aria-label="Toggle navigation"
        >
          <Menu className="h-5 w-5" />
        </button>
        <span className="text-sm font-semibold text-primary truncate">
          {pageTitle}
        </span>
      </div>

      {/* Right: active staff code + user info + logout */}
      <div className="flex items-center gap-2">
        {/* Active Staff Code for Logging */}
        {activeStaff && (
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 border border-slate-200 text-xs text-[#14274E]"
            title={`Active Staff for Logging: #${activeStaff.codeId} - ${activeStaff.staffName} (${activeStaff.staffRole})`}
          >
            <KeyRound className="w-3.5 h-3.5 text-[#14274E]" />
            <span className="font-mono font-black text-xs">#{activeStaff.codeId}</span>
            <span className="hidden md:inline font-bold text-slate-700 truncate max-w-[120px]">
              {activeStaff.staffName}
            </span>
          </div>
        )}

        {user && (
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted">
            <UserCircle className="h-4 w-4" />
            <span className="max-w-[160px] truncate">{user.email}</span>
          </div>
        )}
        <button
          onClick={() => void signOut()}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-secondary hover:bg-danger/8 hover:text-danger transition-colors"
          aria-label="Log out"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Log out</span>
        </button>
      </div>
    </header>
  )
}
