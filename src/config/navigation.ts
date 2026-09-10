import {
  UtensilsCrossed,
  Receipt,
  ChefHat,
  LayoutGrid,
  BookOpen,
  BarChart2,
  CalendarDays,
  Users,
  ClipboardList,
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
    items: [],
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
        title: 'Table Manager',
        description: 'Restaurant layout, tables & QR code generator.',
        path: '/tables',
        icon: LayoutGrid,
      },
      {
        title: 'Menu Manager',
        description: 'Menu items, categories, pricing & recipes.',
        path: '/menu',
        icon: BookOpen,
      },
      {
        title: 'Analytics',
        description: 'Revenue, order volumes & sales insights.',
        path: '/analytics',
        icon: BarChart2,
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
        title: 'Account Manager',
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
    ],
  },
]
