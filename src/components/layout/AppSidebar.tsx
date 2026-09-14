import { useState, useRef, useEffect } from 'react'
import { ChevronDown, PanelLeftClose, PanelLeftOpen, X, LogOut, ShieldCheck } from 'lucide-react'
import { navigation, type NavGroup } from '@/config/navigation'
import { NavigationItem } from './NavigationItem'
import monolithLogoYellow from '@/assets/images/monolith-logo-yellow.png'
import { useAuth } from '@/hooks/useAuth'

interface AppSidebarProps {
  open: boolean
  onClose: () => void
}

function LogoUserMenu({
  collapsed,
  onCloseSidebar,
}: {
  collapsed: boolean
  onCloseSidebar?: () => void
}) {
  const [openMenu, setOpenMenu] = useState(false)
  const { user, signOut } = useAuth()
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!openMenu) return
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [openMenu])

  const handleLogOut = async () => {
    setOpenMenu(false)
    if (onCloseSidebar) onCloseSidebar()
    await signOut()
  }

  return (
    <div className="relative z-50" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpenMenu((v) => !v)}
        className="flex items-center gap-2.5 p-1 rounded-2xl hover:bg-slate-100/80 active:scale-95 transition-all text-left group cursor-pointer focus:outline-none"
        title="Account & Log Out"
        aria-expanded={openMenu}
      >
        <div className="Sidebar-header-logo group-hover:scale-105 group-hover:shadow-md transition-all">
          <img
            src={monolithLogoYellow}
            alt="Monolith Logo"
            className="w-8 h-8 object-contain drop-shadow-xs"
          />
        </div>
        {!collapsed && (
          <div className="flex flex-col min-w-0 pr-1">
            <span className="Sidebar-header-title leading-tight">Monolith</span>
            {user?.email && (
              <span className="text-[10px] font-bold text-slate-400 truncate max-w-[140px]">
                {user.email}
              </span>
            )}
          </div>
        )}
      </button>

      {/* Popover Menu */}
      {openMenu && (
        <div
          className={`absolute z-50 w-60 rounded-2xl bg-white border border-slate-200/90 shadow-2xl p-2 animate-in fade-in zoom-in-95 duration-150 ${
            collapsed
              ? 'left-16 top-0'
              : 'left-1 top-full mt-2'
          }`}
        >
          {user?.email && (
            <div className="px-3 py-2.5 border-b border-slate-100 mb-1.5 bg-slate-50/70 rounded-xl">
              <div className="flex items-center gap-1.5 mb-0.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#14274E]" />
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Signed in as
                </p>
              </div>
              <p className="text-xs font-black text-[#14274E] truncate" title={user.email}>
                {user.email}
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={handleLogOut}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-rose-600 hover:bg-rose-50 active:bg-rose-100 transition-colors text-xs font-black cursor-pointer text-left group"
          >
            <div className="w-7 h-7 rounded-lg bg-rose-100/70 group-hover:bg-rose-100 flex items-center justify-center shrink-0 transition-colors">
              <LogOut className="w-3.5 h-3.5 text-rose-600" />
            </div>
            <span>Log Out</span>
          </button>
        </div>
      )}
    </div>
  )
}

function NavigationGroup({ group, collapsed, onNavigate }: { group: NavGroup; collapsed: boolean; onNavigate?: () => void }) {
  const [expanded, setExpanded] = useState(true)
  const Icon = group.icon

  return (
    <div className={`Nav-group ${expanded ? 'is-expanded' : 'is-collapsed-group'} ${collapsed ? 'is-sidebar-collapsed' : ''}`}>
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="Nav-button Nav-group-button"
        title={collapsed ? group.title : undefined}
        aria-expanded={expanded}
      >
        <div className="Nav-button-icon"><Icon className="Nav-button-icon-svg" strokeWidth={1.75} /></div>
        {!collapsed && <span className="Nav-button-title-main">{group.title}</span>}
        {!collapsed && <ChevronDown className={['Nav-group-chevron', expanded ? '' : 'is-collapsed'].join(' ')} />}
      </button>
      <div className={['Nav-group-children-wrapper', expanded ? '' : 'is-collapsed'].join(' ')}>
        <div className="Nav-group-children-inner">
          <div className={['Nav-group-children', collapsed ? 'is-collapsed' : ''].join(' ')}>
            {group.children.map((item, index) => (
              <NavigationItem
                key={item.path}
                item={item}
                collapsed={collapsed}
                onNavigate={onNavigate}
                isSubItem={true}
                isFirstSubItem={index === 0}
                isLastSubItem={index === group.children.length - 1}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function SidebarContent({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  return (
    <nav className="Sidebar-nav-buttons-container">
      {navigation.map((section) => (
        <div className="Nav-category" key={section.section}>
          <p className={['Nav-category-header', collapsed ? 'is-hidden' : ''].join(' ')}>{section.section}</p>
          <div className="Nav-category-buttons">
            {section.groups?.map((group) => <NavigationGroup key={group.title} group={group} collapsed={collapsed} onNavigate={onNavigate} />)}
            {section.items.map((item) => <NavigationItem key={item.path} item={item} collapsed={collapsed} onNavigate={onNavigate} />)}
          </div>
        </div>
      ))}
    </nav>
  )
}

export function AppSidebar({ open, onClose }: AppSidebarProps) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <>
      {open && <>
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs lg:hidden animate-backdrop-fade" onClick={onClose} />
        <aside className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-white shadow-2xl flex flex-col lg:hidden animate-slide-right app-sidebar border-r border-slate-200" aria-label="Mobile application navigation">
          <div className="Sidebar-header flex items-center justify-between pr-3">
            <LogoUserMenu collapsed={false} onCloseSidebar={onClose} />
            <button onClick={onClose} className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer" aria-label="Close sidebar"><X className="w-5 h-5" /></button>
          </div>
          <SidebarContent collapsed={false} onNavigate={onClose} />
        </aside>
      </>}
      <aside className={['app-sidebar hidden lg:flex flex-col shrink-0 h-full bg-white border-r border-secondary/15 transition-all duration-200', collapsed ? 'sidebar-collapsed' : 'sidebar-expanded'].join(' ')} aria-label="Application navigation">
        <div className="Sidebar-header">
          <LogoUserMenu collapsed={collapsed} />
        </div>
        <SidebarContent collapsed={collapsed} />
        <div className="Sidebar-footer"><button onClick={() => setCollapsed((value) => !value)} className="Sidebar-footer-button" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>{collapsed ? <PanelLeftOpen className="Sidebar-footer-icon" /> : <><PanelLeftClose className="Sidebar-footer-icon" /><span>Collapse</span></>}</button></div>
      </aside>
    </>
  )
}
