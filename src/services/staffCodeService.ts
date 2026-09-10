import { supabase } from '@/lib/supabase'
import type {
  StaffCodeItem,
  StaffCodeFormData,
  StaffCodeFilterParams,
  StaffCodeSummaryStats,
  StaffRole,
  StaffStatus,
  StaffAccount,
} from '@/types/account'

const LOCAL_STORAGE_CODES_FALLBACK = 'monolith_staff_codes_fallback'
const LOCAL_STORAGE_STATUS_MAP = 'monolith_staff_codes_status_map'
const LOCAL_STORAGE_ACTIVE_STAFF = 'monolith_active_staff_session'

// Default seed codes if database is temporarily unavailable
const DEFAULT_SEED_CODES: StaffCodeItem[] = [
  {
    codeId: 1001,
    staffName: 'Vincent Administrator',
    staffRole: 'ADMIN',
    status: 'ACTIVE',
  },
  {
    codeId: 1002,
    staffName: 'Maria Santos',
    staffRole: 'MANAGER',
    status: 'ACTIVE',
  },
  {
    codeId: 1003,
    staffName: 'Juan Dela Cruz',
    staffRole: 'CASHIER',
    status: 'ACTIVE',
  },
  {
    codeId: 1004,
    staffName: 'Chef Roberto Gonzales',
    staffRole: 'KITCHEN',
    status: 'ACTIVE',
  },
  {
    codeId: 1005,
    staffName: 'Elena Reyes',
    staffRole: 'STAFF',
    status: 'ACTIVE',
  },
]

// ─── Local Storage Helpers ───────────────────────────────────────────────────

function getFallbackCodes(): StaffCodeItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_CODES_FALLBACK)
    if (raw) return JSON.parse(raw) as StaffCodeItem[]
  } catch (err) {
    console.warn('[staffCodeService] Error reading fallback storage:', err)
  }
  return DEFAULT_SEED_CODES
}

function saveFallbackCodes(codes: StaffCodeItem[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_CODES_FALLBACK, JSON.stringify(codes))
  } catch (err) {
    console.warn('[staffCodeService] Error saving fallback storage:', err)
  }
}

function getLocalStatusMap(): Record<number, StaffStatus> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_STATUS_MAP)
    if (raw) return JSON.parse(raw) as Record<number, StaffStatus>
  } catch {
    // ignore
  }
  return {}
}

function saveLocalStatus(codeId: number, status: StaffStatus): void {
  try {
    const map = getLocalStatusMap()
    map[codeId] = status
    localStorage.setItem(LOCAL_STORAGE_STATUS_MAP, JSON.stringify(map))
  } catch {
    // ignore
  }
}

// ─── Active Staff Session (For Order / Action Logging) ─────────────────────────

export function getActiveStaffSession(): StaffCodeItem | null {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_ACTIVE_STAFF)
    if (raw) return JSON.parse(raw) as StaffCodeItem
  } catch {
    // ignore
  }
  // Default to Admin 1001 if nothing selected yet
  return DEFAULT_SEED_CODES[0]
}

export function setActiveStaffSession(staff: StaffCodeItem | null): void {
  try {
    if (staff) {
      localStorage.setItem(LOCAL_STORAGE_ACTIVE_STAFF, JSON.stringify(staff))
    } else {
      localStorage.removeItem(LOCAL_STORAGE_ACTIVE_STAFF)
    }
  } catch {
    // ignore
  }
}

// ─── Mapper ───────────────────────────────────────────────────────────────────

function mapDbRowToStaffCode(row: Record<string, unknown>): StaffCodeItem {
  const codeId = Number(row['CODE_ID'])
  const staffName = String(row['STAFF_NAME'] || 'Unnamed Staff')
  const staffRole = (String(row['STAFF_ROLE'] || 'STAFF').toUpperCase() as StaffRole) || 'STAFF'

  // If DB column STATUS exists, use it; otherwise check local override, or default to ACTIVE
  const statusMap = getLocalStatusMap()
  let status: StaffStatus = 'ACTIVE'
  if (row['STATUS']) {
    status = (String(row['STATUS']).toUpperCase() as StaffStatus) || 'ACTIVE'
  } else if (statusMap[codeId]) {
    status = statusMap[codeId]
  }

  return {
    codeId,
    staffName,
    staffRole,
    status,
  }
}

// ─── API Result Interface ─────────────────────────────────────────────────────

export interface FetchStaffCodesResult {
  codes: StaffCodeItem[]
  totalCount: number
  totalPages: number
  currentPage: number
  pageSize: number
  summaryStats: StaffCodeSummaryStats
  isUsingFallback: boolean
}

// ─── Service Methods ──────────────────────────────────────────────────────────

/**
 * Fetches staff codes from Supabase Staff_Codes table with filtering, search, pagination, and KPI summary stats.
 */
export async function fetchStaffCodes(
  filters: StaffCodeFilterParams = {},
  page = 1,
  pageSize = 25,
): Promise<FetchStaffCodesResult> {
  const {
    searchQuery = '',
    role = 'ALL',
    status = 'ALL',
    sortBy = 'codeId',
    sortOrder = 'asc',
  } = filters

  try {
    // 1. Try querying Supabase Staff_Codes
    const { data: dbRows, error } = await supabase
      .from('Staff_Codes')
      .select('*')
      .order('CODE_ID', { ascending: sortOrder === 'asc' })

    if (error) {
      throw error
    }

    const allCodes: StaffCodeItem[] = (dbRows ?? []).map(mapDbRowToStaffCode)
    saveFallbackCodes(allCodes)

    // Calculate overall stats before client-side query filters
    const summaryStats = calculateSummaryStats(allCodes)

    // Apply filters
    const filtered = filterCodesList(allCodes, searchQuery, role, status, sortBy, sortOrder)

    // Pagination
    const totalCount = filtered.length
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
    const validPage = Math.min(Math.max(1, page), totalPages)
    const startIndex = (validPage - 1) * pageSize
    const paginated = filtered.slice(startIndex, startIndex + pageSize)

    return {
      codes: paginated,
      totalCount,
      totalPages,
      currentPage: validPage,
      pageSize,
      summaryStats,
      isUsingFallback: false,
    }
  } catch (err) {
    console.warn(
      '[staffCodeService] Supabase Staff_Codes query unavailable, using fallback storage:',
      err,
    )

    const fallbackAll = getFallbackCodes()
    const summaryStats = calculateSummaryStats(fallbackAll)
    const filtered = filterCodesList(fallbackAll, searchQuery, role, status, sortBy, sortOrder)

    const totalCount = filtered.length
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
    const validPage = Math.min(Math.max(1, page), totalPages)
    const startIndex = (validPage - 1) * pageSize
    const paginated = filtered.slice(startIndex, startIndex + pageSize)

    return {
      codes: paginated,
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
 * Creates a new staff code in the database.
 */
export async function createStaffCode(data: StaffCodeFormData): Promise<StaffCodeItem> {
  const codeId = Number(data.codeId)
  if (!codeId || isNaN(codeId) || codeId <= 0) {
    throw new Error('Staff code must be a valid positive number.')
  }

  const staffName = data.staffName.trim()
  if (!staffName) {
    throw new Error('Staff name is required.')
  }

  const staffRole = data.staffRole || 'STAFF'
  const status = data.status || 'ACTIVE'

  saveLocalStatus(codeId, status)

  // Try inserting with STATUS
  try {
    const { data: inserted, error } = await supabase
      .from('Staff_Codes')
      .insert({
        CODE_ID: codeId,
        STAFF_NAME: staffName,
        STAFF_ROLE: staffRole,
        STATUS: status,
      })
      .select()
      .single()

    if (error) {
      // If error is 42703 (STATUS column does not exist yet), retry without STATUS column
      if (error.code === '42703') {
        const { data: insertedWithoutStatus, error: retryError } = await supabase
          .from('Staff_Codes')
          .insert({
            CODE_ID: codeId,
            STAFF_NAME: staffName,
            STAFF_ROLE: staffRole,
          })
          .select()
          .single()

        if (retryError) throw retryError
        const codeItem = mapDbRowToStaffCode(insertedWithoutStatus)
        codeItem.status = status
        updateFallbackCache(codeItem)
        return codeItem
      }
      throw error
    }

    const codeItem = mapDbRowToStaffCode(inserted)
    updateFallbackCache(codeItem)
    return codeItem
  } catch (err: unknown) {
    console.warn('[staffCodeService] Insert failed in Supabase, applying to fallback cache:', err)
    // Check if code is already taken in fallback
    const fallbackAll = getFallbackCodes()
    if (fallbackAll.some((c) => c.codeId === codeId)) {
      throw new Error(`Staff code #${codeId} is already in use. Please pick another code.`)
    }

    const newCode: StaffCodeItem = {
      codeId,
      staffName,
      staffRole,
      status,
    }
    fallbackAll.push(newCode)
    saveFallbackCodes(fallbackAll)
    return newCode
  }
}

/**
 * Updates an existing staff code.
 */
export async function updateStaffCode(
  originalCodeId: number,
  data: StaffCodeFormData,
): Promise<StaffCodeItem> {
  const newCodeId = Number(data.codeId)
  if (!newCodeId || isNaN(newCodeId) || newCodeId <= 0) {
    throw new Error('Staff code must be a valid positive number.')
  }

  const staffName = data.staffName.trim()
  if (!staffName) {
    throw new Error('Staff name is required.')
  }

  const staffRole = data.staffRole || 'STAFF'
  const status = data.status || 'ACTIVE'

  saveLocalStatus(newCodeId, status)

  try {
    // If the codeId itself changed, we need to update PK or insert new & delete old
    if (newCodeId !== originalCodeId) {
      await supabase.from('Staff_Codes').delete().eq('CODE_ID', originalCodeId)
      return await createStaffCode(data)
    }

    // Try updating with STATUS
    const { data: updated, error } = await supabase
      .from('Staff_Codes')
      .update({
        STAFF_NAME: staffName,
        STAFF_ROLE: staffRole,
        STATUS: status,
      })
      .eq('CODE_ID', originalCodeId)
      .select()
      .single()

    if (error) {
      if (error.code === '42703') {
        const { data: updatedWithoutStatus, error: retryError } = await supabase
          .from('Staff_Codes')
          .update({
            STAFF_NAME: staffName,
            STAFF_ROLE: staffRole,
          })
          .eq('CODE_ID', originalCodeId)
          .select()
          .single()

        if (retryError) throw retryError
        const codeItem = mapDbRowToStaffCode(updatedWithoutStatus)
        codeItem.status = status
        updateFallbackCache(codeItem)
        return codeItem
      }
      throw error
    }

    const codeItem = mapDbRowToStaffCode(updated)
    updateFallbackCache(codeItem)
    return codeItem
  } catch (err) {
    console.warn('[staffCodeService] Update failed in Supabase, updating fallback cache:', err)
    const fallbackAll = getFallbackCodes()
    const idx = fallbackAll.findIndex((c) => c.codeId === originalCodeId)
    const updatedItem: StaffCodeItem = {
      codeId: newCodeId,
      staffName,
      staffRole,
      status,
    }
    if (idx >= 0) {
      fallbackAll[idx] = updatedItem
    } else {
      fallbackAll.push(updatedItem)
    }
    saveFallbackCodes(fallbackAll)
    return updatedItem
  }
}

/**
 * Toggles a staff code's status between ACTIVE and INACTIVE.
 */
export async function toggleStaffCodeStatus(
  codeId: number,
  currentStatus: StaffStatus,
): Promise<StaffCodeItem> {
  const newStatus: StaffStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
  saveLocalStatus(codeId, newStatus)

  try {
    const { data: updated, error } = await supabase
      .from('Staff_Codes')
      .update({ STATUS: newStatus })
      .eq('CODE_ID', codeId)
      .select()
      .single()

    if (error) {
      if (error.code === '42703') {
        // STATUS column doesn't exist yet; status is persisted in localStatusMap
        const fallbackAll = getFallbackCodes()
        const found = fallbackAll.find((c) => c.codeId === codeId)
        if (found) {
          found.status = newStatus
          saveFallbackCodes(fallbackAll)
          return found
        }
        return {
          codeId,
          staffName: 'Staff Member',
          staffRole: 'STAFF',
          status: newStatus,
        }
      }
      throw error
    }

    const codeItem = mapDbRowToStaffCode(updated)
    codeItem.status = newStatus
    updateFallbackCache(codeItem)
    return codeItem
  } catch (err) {
    console.warn('[staffCodeService] Status toggle Supabase error, updating local:', err)
    const fallbackAll = getFallbackCodes()
    const item = fallbackAll.find((c) => c.codeId === codeId)
    if (item) {
      item.status = newStatus
      saveFallbackCodes(fallbackAll)
      return item
    }
    return {
      codeId,
      staffName: 'Staff Member',
      staffRole: 'STAFF',
      status: newStatus,
    }
  }
}

/**
 * Deletes a staff code from the database.
 */
export async function deleteStaffCode(codeId: number): Promise<void> {
  try {
    const { error } = await supabase.from('Staff_Codes').delete().eq('CODE_ID', codeId)
    if (error) throw error
  } catch (err) {
    console.warn('[staffCodeService] Delete error from Supabase, removing from fallback:', err)
  } finally {
    const fallbackAll = getFallbackCodes().filter((c) => c.codeId !== codeId)
    saveFallbackCodes(fallbackAll)
  }
}

/**
 * Suggests the next available numeric staff code (e.g. 1001, 1002, 1006...).
 */
export async function suggestNextCode(): Promise<number> {
  try {
    const { data } = await supabase
      .from('Staff_Codes')
      .select('CODE_ID')
      .order('CODE_ID', { ascending: false })
      .limit(1)

    if (data && data.length > 0) {
      return Number(data[0].CODE_ID) + 1
    }
  } catch {
    // ignore
  }

  const fallbackAll = getFallbackCodes()
  if (fallbackAll.length > 0) {
    const maxCode = Math.max(...fallbackAll.map((c) => c.codeId))
    return maxCode + 1
  }

  return 1001
}

/**
 * Fetches the single primary store staff account from Staff_Accounts (Vincent Administrator).
 */
export async function getPrimaryStaffAccount(): Promise<StaffAccount | null> {
  try {
    const { data, error } = await supabase
      .from('Staff_Accounts')
      .select('*')
      .order('ACCOUNT_ID', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (error || !data) return null

    return {
      accountId: Number(data.ACCOUNT_ID),
      authUserId: data.AUTH_USER_ID ? String(data.AUTH_USER_ID) : null,
      fullName: String(data.FULL_NAME || 'Store Administrator'),
      email: String(data.EMAIL || ''),
      role: (data.ROLE as StaffRole) || 'ADMIN',
      status: (data.STATUS as StaffStatus) || 'ACTIVE',
      permissions: Array.isArray(data.PERMISSIONS) ? data.PERMISSIONS : [],
      phone: data.PHONE ? String(data.PHONE) : null,
      notes: data.NOTES ? String(data.NOTES) : null,
      createdAt: String(data.CREATED_AT || new Date().toISOString()),
      updatedAt: String(data.UPDATED_AT || new Date().toISOString()),
      lastLogin: data.LAST_LOGIN ? String(data.LAST_LOGIN) : null,
    }
  } catch {
    return null
  }
}

// ─── Filter & Stats Helpers ───────────────────────────────────────────────────

function filterCodesList(
  codes: StaffCodeItem[],
  searchQuery: string,
  role: StaffRole | 'ALL',
  status: StaffStatus | 'ALL',
  sortBy: StaffCodeFilterParams['sortBy'],
  sortOrder: StaffCodeFilterParams['sortOrder'],
): StaffCodeItem[] {
  let list = [...codes]

  if (searchQuery && searchQuery.trim().length > 0) {
    const q = searchQuery.toLowerCase().trim()
    list = list.filter(
      (c) =>
        c.staffName.toLowerCase().includes(q) ||
        String(c.codeId).includes(q) ||
        c.staffRole.toLowerCase().includes(q),
    )
  }

  if (role && role !== 'ALL') {
    list = list.filter((c) => c.staffRole === role)
  }

  if (status && status !== 'ALL') {
    list = list.filter((c) => c.status === status)
  }

  list.sort((a, b) => {
    let comparison = 0
    if (sortBy === 'staffName') {
      comparison = a.staffName.localeCompare(b.staffName)
    } else if (sortBy === 'staffRole') {
      comparison = a.staffRole.localeCompare(b.staffRole)
    } else if (sortBy === 'status') {
      comparison = a.status.localeCompare(b.status)
    } else {
      comparison = a.codeId - b.codeId
    }
    return sortOrder === 'desc' ? -comparison : comparison
  })

  return list
}

function calculateSummaryStats(codes: StaffCodeItem[]): StaffCodeSummaryStats {
  const stats: StaffCodeSummaryStats = {
    totalCodes: codes.length,
    activeCount: 0,
    inactiveCount: 0,
    adminCount: 0,
    managerCount: 0,
    cashierCount: 0,
    kitchenCount: 0,
    floorStaffCount: 0,
  }

  for (const c of codes) {
    if (c.status === 'ACTIVE') {
      stats.activeCount++
    } else {
      stats.inactiveCount++
    }

    switch (c.staffRole) {
      case 'ADMIN':
        stats.adminCount++
        break
      case 'MANAGER':
        stats.managerCount++
        break
      case 'CASHIER':
        stats.cashierCount++
        break
      case 'KITCHEN':
        stats.kitchenCount++
        break
      case 'STAFF':
      default:
        stats.floorStaffCount++
        break
    }
  }

  return stats
}

function updateFallbackCache(item: StaffCodeItem): void {
  const all = getFallbackCodes()
  const idx = all.findIndex((c) => c.codeId === item.codeId)
  if (idx >= 0) {
    all[idx] = item
  } else {
    all.push(item)
  }
  saveFallbackCodes(all)
}
