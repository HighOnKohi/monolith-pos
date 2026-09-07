import { supabase } from '@/lib/supabase'
import type {
  StaffAccount,
  StaffAccountFormData,
  StaffRole,
  StaffStatus,
  AccountFilterParams,
  AccountSummaryStats,
} from '@/types/account'

const LOCAL_STORAGE_KEY = 'monolith_staff_accounts_fallback'

// Default seed accounts used if the Supabase table has not been migrated yet
const DEFAULT_SEED_ACCOUNTS: StaffAccount[] = [
  {
    accountId: 1,
    fullName: 'Vincent Administrator',
    email: 'taponakawnt123@gmail.com',
    role: 'ADMIN',
    status: 'ACTIVE',
    permissions: [
      'manage_accounts',
      'manage_menu',
      'manage_tables',
      'access_kitchen',
      'access_cashier',
      'access_analytics',
      'view_order_logs',
    ],
    phone: '+63 917 123 4567',
    notes: 'Primary store administrator and owner account.',
    createdAt: '2026-09-05T14:05:22.865Z',
    updatedAt: '2026-09-05T14:05:22.865Z',
    lastLogin: '2026-09-07T19:30:00.000Z',
  },
  {
    accountId: 2,
    fullName: 'Maria Santos',
    email: 'manager.maria@monolithpos.com',
    role: 'MANAGER',
    status: 'ACTIVE',
    permissions: [
      'manage_menu',
      'manage_tables',
      'access_kitchen',
      'access_cashier',
      'access_analytics',
      'view_order_logs',
    ],
    phone: '+63 918 234 5678',
    notes: 'Shift manager and restaurant operations supervisor.',
    createdAt: '2026-09-05T15:10:00.000Z',
    updatedAt: '2026-09-05T15:10:00.000Z',
    lastLogin: '2026-09-07T14:20:00.000Z',
  },
  {
    accountId: 3,
    fullName: 'Juan Dela Cruz',
    email: 'cashier.juan@monolithpos.com',
    role: 'CASHIER',
    status: 'ACTIVE',
    permissions: ['access_cashier', 'manage_tables', 'view_order_logs'],
    phone: '+63 919 345 6789',
    notes: 'Lead cashier for front counter and bill-out checkout.',
    createdAt: '2026-09-05T15:30:00.000Z',
    updatedAt: '2026-09-05T15:30:00.000Z',
    lastLogin: '2026-09-07T18:45:00.000Z',
  },
  {
    accountId: 4,
    fullName: 'Chef Roberto Gonzales',
    email: 'kitchen.roberto@monolithpos.com',
    role: 'KITCHEN',
    status: 'ACTIVE',
    permissions: ['access_kitchen', 'manage_menu'],
    phone: '+63 920 456 7890',
    notes: 'Head chef managing cooking queue and ingredient inventory.',
    createdAt: '2026-09-05T16:00:00.000Z',
    updatedAt: '2026-09-05T16:00:00.000Z',
    lastLogin: '2026-09-07T17:15:00.000Z',
  },
  {
    accountId: 5,
    fullName: 'Elena Reyes',
    email: 'staff.elena@monolithpos.com',
    role: 'STAFF',
    status: 'ACTIVE',
    permissions: ['manage_tables', 'access_kitchen'],
    phone: '+63 921 567 8901',
    notes: 'Floor attendant and table server.',
    createdAt: '2026-09-05T16:30:00.000Z',
    updatedAt: '2026-09-05T16:30:00.000Z',
    lastLogin: '2026-09-06T20:00:00.000Z',
  },
]

// ─── Local Storage Fallback Helpers ───────────────────────────────────────────

function getFallbackAccounts(): StaffAccount[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (raw) {
      return JSON.parse(raw) as StaffAccount[]
    }
  } catch (err) {
    console.warn('[staffAccountService] Could not read local storage:', err)
  }
  return DEFAULT_SEED_ACCOUNTS
}

function saveFallbackAccounts(accounts: StaffAccount[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(accounts))
  } catch (err) {
    console.warn('[staffAccountService] Could not save local storage:', err)
  }
}

// ─── Row Mapper ───────────────────────────────────────────────────────────────

function mapDbRowToStaffAccount(row: Record<string, unknown>): StaffAccount {
  return {
    accountId: Number(row['ACCOUNT_ID']),
    authUserId: row['AUTH_USER_ID'] ? String(row['AUTH_USER_ID']) : null,
    fullName: String(row['FULL_NAME'] || 'Unnamed Staff'),
    email: String(row['EMAIL'] || ''),
    role: (row['ROLE'] as StaffRole) || 'STAFF',
    status: (row['STATUS'] as StaffStatus) || 'ACTIVE',
    permissions: Array.isArray(row['PERMISSIONS'])
      ? (row['PERMISSIONS'] as StaffAccount['permissions'])
      : [],
    phone: row['PHONE'] ? String(row['PHONE']) : null,
    notes: row['NOTES'] ? String(row['NOTES']) : null,
    createdAt: String(row['CREATED_AT'] || new Date().toISOString()),
    updatedAt: String(row['UPDATED_AT'] || new Date().toISOString()),
    lastLogin: row['LAST_LOGIN'] ? String(row['LAST_LOGIN']) : null,
  }
}

// ─── Service API ──────────────────────────────────────────────────────────────

export interface FetchStaffAccountsResult {
  accounts: StaffAccount[]
  totalCount: number
  totalPages: number
  currentPage: number
  pageSize: number
  summaryStats: AccountSummaryStats
  isUsingFallback: boolean
}

/**
 * Fetches staff accounts with filtering, search, pagination, and KPI summary stats.
 */
export async function fetchStaffAccounts(
  filters: AccountFilterParams = {},
  page = 1,
  pageSize = 25,
): Promise<FetchStaffAccountsResult> {
  const {
    searchQuery = '',
    role = 'ALL',
    status = 'ALL',
    sortBy = 'fullName',
    sortOrder = 'asc',
  } = filters

  try {
    // 1. Try querying Supabase Staff_Accounts table
    const { data: dbRows, error } = await supabase
      .from('Staff_Accounts')
      .select('*')
      .order(
        sortBy === 'fullName'
          ? 'FULL_NAME'
          : sortBy === 'role'
            ? 'ROLE'
            : sortBy === 'status'
              ? 'STATUS'
              : 'CREATED_AT',
        { ascending: sortOrder === 'asc' },
      )

    if (error) {
      throw error
    }

    const allAccounts: StaffAccount[] = (dbRows ?? []).map(mapDbRowToStaffAccount)

    // Calculate overall stats before client-side query filters
    const summaryStats = calculateSummaryStats(allAccounts)

    // Apply filters
    const filtered = filterAccountsList(allAccounts, searchQuery, role, status)

    // Pagination
    const totalCount = filtered.length
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
    const validPage = Math.min(Math.max(1, page), totalPages)
    const startIndex = (validPage - 1) * pageSize
    const pagedAccounts = filtered.slice(startIndex, startIndex + pageSize)

    return {
      accounts: pagedAccounts,
      totalCount,
      totalPages,
      currentPage: validPage,
      pageSize,
      summaryStats,
      isUsingFallback: false,
    }
  } catch (err: unknown) {
    console.warn(
      '[staffAccountService] Supabase Staff_Accounts unavailable, using fallback storage:',
      (err as { message?: string })?.message || err,
    )

    // Fallback: Read from localStorage or default seed accounts
    const fallbackAll = getFallbackAccounts()
    const summaryStats = calculateSummaryStats(fallbackAll)

    // Sort
    const sorted = [...fallbackAll].sort((a, b) => {
      let cmp = 0
      if (sortBy === 'fullName') cmp = a.fullName.localeCompare(b.fullName)
      else if (sortBy === 'role') cmp = a.role.localeCompare(b.role)
      else if (sortBy === 'status') cmp = a.status.localeCompare(b.status)
      else cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      return sortOrder === 'asc' ? cmp : -cmp
    })

    const filtered = filterAccountsList(sorted, searchQuery, role, status)
    const totalCount = filtered.length
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
    const validPage = Math.min(Math.max(1, page), totalPages)
    const startIndex = (validPage - 1) * pageSize
    const pagedAccounts = filtered.slice(startIndex, startIndex + pageSize)

    return {
      accounts: pagedAccounts,
      totalCount,
      totalPages,
      currentPage: validPage,
      pageSize,
      summaryStats,
      isUsingFallback: true,
    }
  }
}

/**
 * Creates a new staff account.
 */
export async function createStaffAccount(
  data: StaffAccountFormData,
): Promise<{ account: StaffAccount; inviteSent: boolean }> {
  const trimmedEmail = data.email.trim().toLowerCase()
  const trimmedName = data.fullName.trim()

  if (!trimmedName) throw new Error('Full name is required.')
  if (!trimmedEmail) throw new Error('Email address is required.')

  const nowIso = new Date().toISOString()

  try {
    const { data: inserted, error } = await supabase
      .from('Staff_Accounts')
      .insert({
        FULL_NAME: trimmedName,
        EMAIL: trimmedEmail,
        ROLE: data.role,
        STATUS: data.status,
        PERMISSIONS: data.permissions,
        PHONE: data.phone?.trim() || null,
        NOTES: data.notes?.trim() || null,
        CREATED_AT: nowIso,
        UPDATED_AT: nowIso,
      })
      .select()
      .single()

    if (error) throw error

    const newAccount = mapDbRowToStaffAccount(inserted)

    // Optionally send password reset / setup link
    let inviteSent = false
    if (data.sendInviteEmail) {
      try {
        await supabase.auth.resetPasswordForEmail(trimmedEmail, {
          redirectTo: window.location.origin,
        })
        inviteSent = true
      } catch (authErr) {
        console.warn('[staffAccountService] Could not send invite email:', authErr)
      }
    }

    return { account: newAccount, inviteSent }
  } catch (err) {
    console.warn('[staffAccountService] Supabase insert failed, applying to fallback cache:', err)

    // Fallback store
    const current = getFallbackAccounts()
    if (current.some((a) => a.email.toLowerCase() === trimmedEmail)) {
      throw new Error(`An account with email "${trimmedEmail}" already exists.`)
    }

    const maxId = current.reduce((max, a) => Math.max(max, a.accountId), 0)
    const fallbackNew: StaffAccount = {
      accountId: maxId + 1,
      fullName: trimmedName,
      email: trimmedEmail,
      role: data.role,
      status: data.status,
      permissions: data.permissions,
      phone: data.phone?.trim() || null,
      notes: data.notes?.trim() || null,
      createdAt: nowIso,
      updatedAt: nowIso,
      lastLogin: null,
    }

    saveFallbackAccounts([fallbackNew, ...current])
    return { account: fallbackNew, inviteSent: false }
  }
}

/**
 * Updates an existing staff account. Enforces administrator safety guards.
 */
export async function updateStaffAccount(
  accountId: number,
  data: Partial<StaffAccountFormData>,
  currentAdminEmail?: string,
): Promise<StaffAccount> {
  const allAccountsResult = await fetchStaffAccounts()
  const target = allAccountsResult.accounts.find((a) => a.accountId === accountId)
  if (!target) throw new Error('Account not found.')

  // Administrator Protection Guards:
  // 1. Cannot demote self from ADMIN
  if (
    currentAdminEmail &&
    target.email.toLowerCase() === currentAdminEmail.toLowerCase() &&
    data.role &&
    data.role !== 'ADMIN'
  ) {
    throw new Error('You cannot remove your own Administrator privileges.')
  }

  // 2. Cannot demote the final active administrator
  if (target.role === 'ADMIN' && data.role && data.role !== 'ADMIN') {
    const remainingAdmins = allAccountsResult.accounts.filter(
      (a) => a.role === 'ADMIN' && a.status === 'ACTIVE' && a.accountId !== accountId,
    )
    if (remainingAdmins.length === 0) {
      throw new Error('Cannot change role: The system must have at least one active Administrator.')
    }
  }

  const nowIso = new Date().toISOString()

  try {
    const updatePayload: Record<string, unknown> = {
      UPDATED_AT: nowIso,
    }
    if (data.fullName !== undefined) updatePayload['FULL_NAME'] = data.fullName.trim()
    if (data.role !== undefined) updatePayload['ROLE'] = data.role
    if (data.status !== undefined) updatePayload['STATUS'] = data.status
    if (data.permissions !== undefined) updatePayload['PERMISSIONS'] = data.permissions
    if (data.phone !== undefined) updatePayload['PHONE'] = data.phone?.trim() || null
    if (data.notes !== undefined) updatePayload['NOTES'] = data.notes?.trim() || null

    const { data: updated, error } = await supabase
      .from('Staff_Accounts')
      .update(updatePayload)
      .eq('ACCOUNT_ID', accountId)
      .select()
      .single()

    if (error) throw error

    return mapDbRowToStaffAccount(updated)
  } catch (err) {
    console.warn('[staffAccountService] Supabase update failed, applying to fallback cache:', err)

    const fallbackList = getFallbackAccounts()
    const updatedList = fallbackList.map((acc) => {
      if (acc.accountId !== accountId) return acc
      return {
        ...acc,
        fullName: data.fullName !== undefined ? data.fullName.trim() : acc.fullName,
        role: data.role ?? acc.role,
        status: data.status ?? acc.status,
        permissions: data.permissions ?? acc.permissions,
        phone: data.phone !== undefined ? data.phone?.trim() || null : acc.phone,
        notes: data.notes !== undefined ? data.notes?.trim() || null : acc.notes,
        updatedAt: nowIso,
      }
    })

    saveFallbackAccounts(updatedList)
    const result = updatedList.find((a) => a.accountId === accountId)!
    return result
  }
}

/**
 * Activates or deactivates a staff account. Protects the final active administrator.
 */
export async function toggleStaffStatus(
  accountId: number,
  newStatus: StaffStatus,
  currentAdminEmail?: string,
): Promise<StaffAccount> {
  const allAccountsResult = await fetchStaffAccounts()
  const target = allAccountsResult.accounts.find((a) => a.accountId === accountId)
  if (!target) throw new Error('Account not found.')

  // Cannot deactivate self
  if (
    currentAdminEmail &&
    target.email.toLowerCase() === currentAdminEmail.toLowerCase() &&
    newStatus !== 'ACTIVE'
  ) {
    throw new Error('You cannot deactivate your own logged-in account.')
  }

  // Cannot deactivate final active admin
  if (target.role === 'ADMIN' && newStatus !== 'ACTIVE') {
    const remainingAdmins = allAccountsResult.accounts.filter(
      (a) => a.role === 'ADMIN' && a.status === 'ACTIVE' && a.accountId !== accountId,
    )
    if (remainingAdmins.length === 0) {
      throw new Error('Cannot deactivate: The system must have at least one active Administrator.')
    }
  }

  return updateStaffAccount(accountId, { status: newStatus }, currentAdminEmail)
}

/**
 * Sends a password reset email to a staff member using Supabase Auth.
 */
export async function sendStaffPasswordReset(email: string): Promise<void> {
  if (!email || !email.includes('@')) {
    throw new Error('Valid email address is required.')
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: `${window.location.origin}/login`,
  })

  if (error) {
    console.error('[staffAccountService] Password reset request error:', error)
    throw new Error(error.message || 'Failed to send password reset email.')
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function filterAccountsList(
  accounts: StaffAccount[],
  searchQuery: string,
  role: StaffRole | 'ALL',
  status: StaffStatus | 'ALL',
): StaffAccount[] {
  const query = searchQuery.trim().toLowerCase()

  return accounts.filter((acc) => {
    if (query) {
      const nameMatch = acc.fullName.toLowerCase().includes(query)
      const emailMatch = acc.email.toLowerCase().includes(query)
      const phoneMatch = acc.phone?.toLowerCase().includes(query) ?? false
      const roleMatch = acc.role.toLowerCase().includes(query)
      if (!nameMatch && !emailMatch && !phoneMatch && !roleMatch) return false
    }

    if (role !== 'ALL' && acc.role !== role) return false
    if (status !== 'ALL' && acc.status !== status) return false

    return true
  })
}

function calculateSummaryStats(accounts: StaffAccount[]): AccountSummaryStats {
  let active = 0
  let inactive = 0
  let admin = 0
  let manager = 0
  let cashier = 0
  let kitchen = 0
  let floor = 0

  for (const acc of accounts) {
    if (acc.status === 'ACTIVE') active++
    else inactive++

    if (acc.role === 'ADMIN') admin++
    else if (acc.role === 'MANAGER') manager++
    else if (acc.role === 'CASHIER') cashier++
    else if (acc.role === 'KITCHEN') kitchen++
    else if (acc.role === 'STAFF') floor++
  }

  return {
    totalStaff: accounts.length,
    activeCount: active,
    inactiveCount: inactive,
    adminCount: admin,
    managerCount: manager,
    cashierCount: cashier,
    kitchenCount: kitchen,
    floorStaffCount: floor,
  }
}
