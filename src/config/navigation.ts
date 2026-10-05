import {
  UtensilsCrossed,
  Receipt,
  ChefHat,
  LayoutGrid,
  BookOpen,
  FolderKanban,
  BarChart2,
  CalendarDays,
  Users,
  ClipboardList,
  ConciergeBell,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NavItem {
  title: string
  description: string
  path: string
  icon: LucideIcon
}

export interface NavGroup {
  title: string
  icon: LucideIcon
  children: NavItem[]
}

export interface NavSection {
  section: string
  items: NavItem[]
  groups?: NavGroup[]
}

// ─── Navigation Config ────────────────────────────────────────────────────────
//
// Single source of truth for all application interfaces.
// Used by: AppSidebar, NavigationItem, active-route highlighting.
// Do not define navigation items anywhere else.

export const navigation: NavSection[] = [
  {
    section: 'Front Ops',
    items: [
      {
        title: 'Receptionist Interface',
        description: 'Floor view, seating, and table status.',
        path: '/reception',
        icon: ConciergeBell,
      },
    ],
    groups: [
      {
        title: 'Kitchen Interfaces',
        icon: ChefHat,
        children: [
          { title: 'Order Viewer', description: 'View live orders.', path: '/order-viewer', icon: ClipboardList },
          { title: 'Dispatcher Interface', description: 'Manage the cooking queue.', path: '/dispatcher', icon: UtensilsCrossed },
        ],
      },
      {
        title: 'Counter Interfaces',
        icon: Receipt,
        children: [
          { title: 'Service Interface', description: 'Manage service orders and bills.', path: '/service', icon: LayoutGrid },
          { title: 'Cashier Interface', description: 'Cashier tools.', path: '/cashier', icon: Receipt },
        ],
      },
    ],
  },
  {
    section: 'Management',
    items: [
      {
        title: 'Layout Manager',
        description: 'Restaurant layout, tables & QR code generator.',
        path: '/tables',
        icon: LayoutGrid,
      },
      {
        title: 'Menu Catalog',
        description: 'Master library of all dishes, drinks & categories.',
        path: '/catalog',
        icon: FolderKanban,
      },
      {
        title: 'Menu Manager',
        description: 'Menu presets, sets & active schedule.',
        path: '/menu',
        icon: BookOpen,
      },
      {
        title: 'Events',
        description: 'Schedule and manage restaurant events and reservations.',
        path: '/events',
        icon: CalendarDays,
      },
    ],
  },
  {
    section: 'Admin',
    items: [
      {
        title: 'Admin Panel',
        description: 'Business day control, daily summaries & operational management.',
        path: '/admin',
        icon: ShieldCheck,
      },
      {
        title: 'Staff Manager',
        description: 'Staff credentials and access permissions.',
        path: '/accounts',
        icon: Users,
      },
      {
        title: 'Order Logs',
        description: 'Audit trails of completed and active orders.',
        path: '/order-logs',
        icon: ClipboardList,
      },
      {
        title: 'Analytics',
        description: 'Revenue, order volumes & sales insights.',
        path: '/analytics',
        icon: BarChart2,
      },
    ],
  },
]
