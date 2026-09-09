// ─── Staff Account Types & Definitions ────────────────────────────────────────

export type StaffRole = 'ADMIN' | 'MANAGER' | 'CASHIER' | 'KITCHEN' | 'STAFF'

export type StaffStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'

export type StaffPermission =
  | 'manage_accounts'
  | 'manage_menu'
  | 'manage_tables'
  | 'manage_events'
  | 'access_kitchen'
  | 'access_cashier'
  | 'access_analytics'
  | 'view_order_logs'

export interface StaffAccount {
  accountId: number
  authUserId?: string | null
  fullName: string
  email: string
  role: StaffRole
  status: StaffStatus
  permissions: StaffPermission[]
  phone?: string | null
  notes?: string | null
  createdAt: string
  updatedAt: string
  lastLogin?: string | null
}

export interface StaffAccountFormData {
  fullName: string
  email: string
  role: StaffRole
  status: StaffStatus
  permissions: StaffPermission[]
  phone?: string
  notes?: string
  sendInviteEmail?: boolean
}

export interface AccountFilterParams {
  searchQuery?: string
  role?: StaffRole | 'ALL'
  status?: StaffStatus | 'ALL'
  sortBy?: 'fullName' | 'role' | 'status' | 'createdAt'
  sortOrder?: 'asc' | 'desc'
}

export interface AccountSummaryStats {
  totalStaff: number
  activeCount: number
  inactiveCount: number
  adminCount: number
  managerCount: number
  cashierCount: number
  kitchenCount: number
  floorStaffCount: number
}

// ─── Role Metadata & Visual Tokens ────────────────────────────────────────────

export interface RoleMeta {
  role: StaffRole
  label: string
  description: string
  badgeBg: string
  badgeText: string
  badgeBorder: string
  defaultPermissions: StaffPermission[]
}

export const ROLE_DEFINITIONS: Record<StaffRole, RoleMeta> = {
  ADMIN: {
    role: 'ADMIN',
    label: 'Administrator',
    description: 'Full store-wide access including account, financial, and system management.',
    badgeBg: 'bg-purple-50',
    badgeText: 'text-purple-700',
    badgeBorder: 'border-purple-200/80',
    defaultPermissions: [
      'manage_accounts',
      'manage_menu',
      'manage_tables',
      'manage_events',
      'access_kitchen',
      'access_cashier',
      'access_analytics',
      'view_order_logs',
    ],
  },
  MANAGER: {
    role: 'MANAGER',
    label: 'Manager',
    description: 'Shift supervisor overseeing menu, tables, operational queues, and analytics.',
    badgeBg: 'bg-blue-50',
    badgeText: 'text-blue-700',
    badgeBorder: 'border-blue-200/80',
    defaultPermissions: [
      'manage_menu',
      'manage_tables',
      'manage_events',
      'access_kitchen',
      'access_cashier',
      'access_analytics',
      'view_order_logs',
    ],
  },
  CASHIER: {
    role: 'CASHIER',
    label: 'Cashier',
    description: 'Front counter operations, table bill-out, payment receipt settlement.',
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-700',
    badgeBorder: 'border-emerald-200/80',
    defaultPermissions: ['access_cashier', 'manage_tables', 'view_order_logs'],
  },
  KITCHEN: {
    role: 'KITCHEN',
    label: 'Kitchen Staff',
    description: 'Live order preparation, cooking line display, and dish stock availability.',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-700',
    badgeBorder: 'border-amber-200/80',
    defaultPermissions: ['access_kitchen', 'manage_menu'],
  },
  STAFF: {
    role: 'STAFF',
    label: 'Floor Staff',
    description: 'Dining floor attendants managing guest seating and table service.',
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-700',
    badgeBorder: 'border-slate-200',
    defaultPermissions: ['manage_tables', 'access_kitchen'],
  },
}

// ─── Permission Metadata ──────────────────────────────────────────────────────

export interface PermissionMeta {
  key: StaffPermission
  label: string
  description: string
  category: 'Front Ops' | 'Management' | 'Administration'
}

export const PERMISSION_DEFINITIONS: Record<StaffPermission, PermissionMeta> = {
  manage_accounts: {
    key: 'manage_accounts',
    label: 'Manage Accounts & Roles',
    description: 'Create, edit, and deactivate staff user accounts and manage access permissions.',
    category: 'Administration',
  },
  manage_menu: {
    key: 'manage_menu',
    label: 'Menu & Pricing Management',
    description: 'Create menu items, adjust prices, edit recipes, and manage category groups.',
    category: 'Management',
  },
  manage_tables: {
    key: 'manage_tables',
    label: 'Table & Floor Layout',
    description: 'Arrange restaurant layout, generate QR codes, seat guests, and merge tables.',
    category: 'Management',
  },
  access_kitchen: {
    key: 'access_kitchen',
    label: 'Kitchen Display System',
    description: 'Advance live cooking orders, flag items, and toggle dish stock availability.',
    category: 'Front Ops',
  },
  access_cashier: {
    key: 'access_cashier',
    label: 'Cashier Station & Settlement',
    description: 'Process table checkouts, apply Senior/PWD discounts, and settle bills.',
    category: 'Front Ops',
  },
  access_analytics: {
    key: 'access_analytics',
    label: 'Business Analytics & Reports',
    description: 'Inspect revenue KPIs, order volume trends, and kitchen preparation speed metrics.',
    category: 'Management',
  },
  manage_events: {
    key: 'manage_events',
    label: 'Events Management',
    description: 'Create, edit, cancel, and delete scheduled restaurant events and reservations.',
    category: 'Management',
  },
  view_order_logs: {
    key: 'view_order_logs',
    label: 'Order Audit Logs',
    description: 'Search historical orders, inspect chronological event milestones, and export reports.',
    category: 'Administration',
  },
}
