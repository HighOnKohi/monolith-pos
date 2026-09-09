import {
  UtensilsCrossed,
  Receipt,
  QrCode,
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

export interface NavSection {
  section: string
  items: NavItem[]
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
        title: 'Kitchen Interface',
        description: 'View live orders & start cooking queue.',
        path: '/kitchen',
        icon: UtensilsCrossed,
      },
      {
        title: 'Cashier Interface',
        description: 'Check out tables, manage bills & print receipts.',
        path: '/cashier',
        icon: Receipt,
      },
      {
        title: 'Customer Interface',
        description: 'Preview the diner QR ordering experience.',
        path: '/customer',
        icon: QrCode,
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
