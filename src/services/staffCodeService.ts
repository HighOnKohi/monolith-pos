import { supabase } from '@/lib/supabase'
import type {
  StaffCodeItem,
  StaffCodeFormData,
  StaffCodeFilterParams,
  StaffCodeSummaryStats,
  StaffRole,
  CodeStatus,
  ShiftStatus,
} from '@/types/account'

const LOCAL_STORAGE_CODES_FALLBACK = 'monolith_staff_codes_fallback'
const LOCAL_STORAGE_ACTIVE_STAFF = 'monolith_active_staff_session'

// ─── Active Staff Session (For Order / Action Logging) ─────────────────────────

export function getActiveStaffSession(): StaffCodeItem | null {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_ACTIVE_STAFF)
    if (raw) return JSON.parse(raw) as StaffCodeItem

    // Check if any role interface is active on this terminal
    const dispId = localStorage.getItem('monolith_dispatcher_staff_id')
    const servId = localStorage.getItem('monolith_service_staff_id')
    const cashId = localStorage.getItem('monolith_cashier_staff_id')
    const fallback = getFallbackCodes()

    const foundId = Number(dispId || servId || cashId)
    if (foundId) {
      const match = fallback.find((c) => c.codeId === foundId)
      if (match) return match
    }
  } catch {
    // ignore
  }
  return null
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

// ─── Local Storage Helpers ───────────────────────────────────────────────────

function getFallbackCodes(): StaffCodeItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_CODES_FALLBACK)
    if (raw) return JSON.parse(raw) as StaffCodeItem[]
  } catch (err) {
    console.warn('[staffCodeService] Error reading fallback storage:', err)
  }
  return []
}

function saveFallbackCodes(codes: StaffCodeItem[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_CODES_FALLBACK, JSON.stringify(codes))
  } catch (err) {
    console.warn('[staffCodeService] Error saving fallback storage:', err)
  }
}

// ─── Row Mapper ───────────────────────────────────────────────────────────────

function mapDbRowToStaffCode(row: Record<string, unknown>): StaffCodeItem {
  const codeId = Number(row['CODE_ID'])
  const staffName = String(row['STAFF_NAME'] || 'Unnamed Staff')
  
  // Normalize role to DISPATCHER | SERVICE | CASHIER
  let rawRole = String(row['STAFF_ROLE'] || 'DISPATCHER').toUpperCase()
  let staffRole: StaffRole = 'DISPATCHER'
  if (rawRole === 'CASHIER') staffRole = 'CASHIER'
  else if (rawRole === 'SERVICE' || rawRole === 'STAFF' || rawRole === 'SERVER') staffRole = 'SERVICE'
  else if (rawRole === 'DISPATCHER' || rawRole === 'KITCHEN' || rawRole === 'ADMIN' || rawRole === 'MANAGER') staffRole = 'DISPATCHER'

  const rawCodeStatus = String(row['CODE_STATUS'] || row['STATUS'] || 'ACTIVE').toUpperCase()
  const codeStatus: CodeStatus = rawCodeStatus === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE'

  const rawShiftStatus = String(row['SHIFT_STATUS'] || 'ENDED').toUpperCase()
  const shiftStatus: ShiftStatus = rawShiftStatus === 'ONGOING' ? 'ONGOING' : 'ENDED'

  const shiftStart = row['SHIFT_START'] ? String(row['SHIFT_START']) : null
  const shiftEnd = row['SHIFT_END'] ? String(row['SHIFT_END']) : null
  const createdAt = row['CREATED_AT'] ? String(row['CREATED_AT']) : undefined
  const updatedAt = row['UPDATED_AT'] ? String(row['UPDATED_AT']) : undefined

  return {
    codeId,
    staffName,
    staffRole,
    codeStatus,
    status: codeStatus,
    shiftStatus,
    shiftStart,
    shiftEnd,
    createdAt,
    updatedAt,
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
    shiftStatus = 'ALL',
    sortBy = 'codeId',
    sortOrder = 'asc',
  } = filters

  try {
    // 1. Try querying Supabase Staff_Codes in schema 'staff' or public
    let dbRows: Record<string, unknown>[] | null = null
    const { data: schemaData, error: schemaError } = await supabase
      .schema('staff')
      .from('Staff_Codes')
      .select('*')
      .order('CODE_ID', { ascending: sortOrder === 'asc' })

    if (!schemaError && schemaData) {
      dbRows = schemaData as Record<string, unknown>[]
    } else {
      const { data: pubData, error: pubError } = await supabase
        .from('Staff_Codes')
        .select('*')
        .order('CODE_ID', { ascending: sortOrder === 'asc' })

      if (pubError && !dbRows) throw pubError
      if (pubData) dbRows = pubData as Record<string, unknown>[]
    }

    const allCodes: StaffCodeItem[] = (dbRows ?? []).map(mapDbRowToStaffCode)
    saveFallbackCodes(allCodes)

    const summaryStats = calculateSummaryStats(allCodes)
    const filtered = filterCodesList(allCodes, searchQuery, role, status, shiftStatus, sortBy, sortOrder)

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
    const filtered = filterCodesList(fallbackAll, searchQuery, role, status, shiftStatus, sortBy, sortOrder)

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

  const staffRole: StaffRole = data.staffRole || 'DISPATCHER'
  const codeStatus: CodeStatus = data.codeStatus || data.status || 'ACTIVE'
  const shiftStatus: ShiftStatus = 'ENDED'

  const payload = {
    CODE_ID: codeId,
    STAFF_NAME: staffName,
    STAFF_ROLE: staffRole,
    CODE_STATUS: codeStatus,
    SHIFT_STATUS: shiftStatus,
  }

  try {
    let inserted: Record<string, unknown> | null = null
    const { data: schemaInserted, error: schemaErr } = await supabase
      .schema('staff')
      .from('Staff_Codes')
      .insert([payload])
      .select()
      .single()

    if (!schemaErr && schemaInserted) {
      inserted = schemaInserted as Record<string, unknown>
    } else {
      const { data: pubInserted, error: pubErr } = await supabase
        .from('Staff_Codes')
        .insert([payload])
        .select()
        .single()

      if (pubErr) throw pubErr
      if (pubInserted) inserted = pubInserted as Record<string, unknown>
    }

    const codeItem = mapDbRowToStaffCode(inserted || payload)
    updateFallbackCache(codeItem)
    return codeItem
  } catch (err: unknown) {
    console.warn('[staffCodeService] Insert failed in Supabase, applying to fallback cache:', err)
    const fallbackAll = getFallbackCodes()
    if (fallbackAll.some((c) => c.codeId === codeId)) {
      throw new Error(`Staff code #${codeId} is already in use. Please pick another code.`)
    }

    const newCode: StaffCodeItem = {
      codeId,
      staffName,
      staffRole,
      codeStatus,
      status: codeStatus,
      shiftStatus,
      shiftStart: null,
      shiftEnd: null,
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

  const staffRole: StaffRole = data.staffRole || 'DISPATCHER'
  const codeStatus: CodeStatus = data.codeStatus || data.status || 'ACTIVE'

  const updatePayload = {
    STAFF_NAME: staffName,
    STAFF_ROLE: staffRole,
    CODE_STATUS: codeStatus,
  }

  try {
    if (newCodeId !== originalCodeId) {
      // Need to delete and re-insert if PK changes
      await supabase.schema('staff').from('Staff_Codes').delete().eq('CODE_ID', originalCodeId)
      await supabase.from('Staff_Codes').delete().eq('CODE_ID', originalCodeId)
      return await createStaffCode(data)
    }

    let updated: Record<string, unknown> | null = null
    const { data: schemaUpdated, error: schemaErr } = await supabase
      .schema('staff')
      .from('Staff_Codes')
      .update(updatePayload)
      .eq('CODE_ID', originalCodeId)
      .select()
      .single()

    if (!schemaErr && schemaUpdated) {
      updated = schemaUpdated as Record<string, unknown>
    } else {
      const { data: pubUpdated, error: pubErr } = await supabase
        .from('Staff_Codes')
        .update(updatePayload)
        .eq('CODE_ID', originalCodeId)
        .select()
        .single()

      if (pubErr) throw pubErr
      if (pubUpdated) updated = pubUpdated as Record<string, unknown>
    }

    const codeItem = mapDbRowToStaffCode(updated || { CODE_ID: originalCodeId, ...updatePayload })
    updateFallbackCache(codeItem)
    return codeItem
  } catch (err) {
    console.warn('[staffCodeService] Update failed in Supabase, updating fallback cache:', err)
    const fallbackAll = getFallbackCodes()
    const idx = fallbackAll.findIndex((c) => c.codeId === originalCodeId)
    const existing = idx >= 0 ? fallbackAll[idx] : null

    const updatedItem: StaffCodeItem = {
      codeId: newCodeId,
      staffName,
      staffRole,
      codeStatus,
      status: codeStatus,
      shiftStatus: existing?.shiftStatus || 'ENDED',
      shiftStart: existing?.shiftStart || null,
      shiftEnd: existing?.shiftEnd || null,
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
  currentStatus: CodeStatus | string,
): Promise<StaffCodeItem> {
  const newStatus: CodeStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'

  try {
    let updated: Record<string, unknown> | null = null
    const { data: schemaUpdated, error: schemaErr } = await supabase
      .schema('staff')
      .from('Staff_Codes')
      .update({ CODE_STATUS: newStatus, STATUS: newStatus })
      .eq('CODE_ID', codeId)
      .select()
      .single()

    if (!schemaErr && schemaUpdated) {
      updated = schemaUpdated as Record<string, unknown>
    } else {
      const { data: pubUpdated, error: pubErr } = await supabase
        .from('Staff_Codes')
        .update({ CODE_STATUS: newStatus, STATUS: newStatus })
        .eq('CODE_ID', codeId)
        .select()
        .single()

      if (pubErr) throw pubErr
      if (pubUpdated) updated = pubUpdated as Record<string, unknown>
    }

    const codeItem = mapDbRowToStaffCode(updated || { CODE_ID: codeId, CODE_STATUS: newStatus })
    updateFallbackCache(codeItem)
    return codeItem
  } catch (err) {
    console.warn('[staffCodeService] Status toggle Supabase error, updating local:', err)
    const fallbackAll = getFallbackCodes()
    const item = fallbackAll.find((c) => c.codeId === codeId)
    if (item) {
      item.codeStatus = newStatus
      item.status = newStatus
      saveFallbackCodes(fallbackAll)
      return item
    }
    return {
      codeId,
      staffName: 'Staff Member',
      staffRole: 'DISPATCHER',
      codeStatus: newStatus,
      status: newStatus,
      shiftStatus: 'ENDED',
    }
  }
}

/**
 * Manually ends an ongoing shift for a staff code.
 */
export async function endStaffShiftManually(codeId: number): Promise<StaffCodeItem> {
  const now = new Date().toISOString()
  const payload = {
    SHIFT_STATUS: 'ENDED',
    SHIFT_END: now,
  }

  try {
    let updated: Record<string, unknown> | null = null
    const { data: schemaUpdated, error: schemaErr } = await supabase
      .schema('staff')
      .from('Staff_Codes')
      .update(payload)
      .eq('CODE_ID', codeId)
      .select()
      .single()

    if (!schemaErr && schemaUpdated) {
      updated = schemaUpdated as Record<string, unknown>
    } else {
      const { data: pubUpdated, error: pubErr } = await supabase
        .from('Staff_Codes')
        .update(payload)
        .eq('CODE_ID', codeId)
        .select()
        .single()

      if (pubErr) throw pubErr
      if (pubUpdated) updated = pubUpdated as Record<string, unknown>
    }

    // Clean up local storage if this terminal was running a shift for this code
    const cashierStaffId = Number(localStorage.getItem('monolith_cashier_staff_id'))
    if (cashierStaffId === codeId) {
      localStorage.removeItem('monolith_cashier_shift_id')
      localStorage.removeItem('monolith_cashier_staff_id')
    }
    const serviceStaffId = Number(localStorage.getItem('monolith_service_staff_id'))
    if (serviceStaffId === codeId) {
      localStorage.removeItem('monolith_service_shift_id')
      localStorage.removeItem('monolith_service_staff_id')
    }
    const dispatcherStaffId = Number(localStorage.getItem('monolith_dispatcher_staff_id'))
    if (dispatcherStaffId === codeId) {
      localStorage.removeItem('monolith_dispatcher_shift_id')
      localStorage.removeItem('monolith_dispatcher_staff_id')
    }

    const codeItem = mapDbRowToStaffCode(updated || { CODE_ID: codeId, ...payload })
    updateFallbackCache(codeItem)
    return codeItem
  } catch (err) {
    console.warn('[staffCodeService] Manual end shift Supabase error, updating fallback:', err)
    const fallbackAll = getFallbackCodes()
    const item = fallbackAll.find((c) => c.codeId === codeId)
    if (item) {
      item.shiftStatus = 'ENDED'
      item.shiftEnd = now
      saveFallbackCodes(fallbackAll)
      return item
    }
    return {
      codeId,
      staffName: 'Staff Member',
      staffRole: 'DISPATCHER',
      codeStatus: 'ACTIVE',
      status: 'ACTIVE',
      shiftStatus: 'ENDED',
      shiftEnd: now,
    }
  }
}

/**
 * Deletes a staff code from the database.
 */
export async function deleteStaffCode(codeId: number): Promise<void> {
  try {
    const { error: schemaErr } = await supabase.schema('staff').from('Staff_Codes').delete().eq('CODE_ID', codeId)
    if (schemaErr) {
      const { error: pubErr } = await supabase.from('Staff_Codes').delete().eq('CODE_ID', codeId)
      if (pubErr) throw pubErr
    }
  } catch (err) {
    console.warn('[staffCodeService] Delete error from Supabase, removing from fallback:', err)
  } finally {
    const fallbackAll = getFallbackCodes().filter((c) => c.codeId !== codeId)
    saveFallbackCodes(fallbackAll)
  }
}

/**
 * Suggests the next available numeric staff code (e.g. 1001, 1002...).
 */
export async function suggestNextCode(): Promise<number> {
  try {
    const { data } = await supabase
      .schema('staff')
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

// ─── Filter & Stats Helpers ───────────────────────────────────────────────────

function filterCodesList(
  codes: StaffCodeItem[],
  searchQuery: string,
  role: StaffRole | 'ALL',
  status: CodeStatus | 'ALL',
  shiftStatus: ShiftStatus | 'ALL',
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
    list = list.filter((c) => c.codeStatus === status)
  }

  if (shiftStatus && shiftStatus !== 'ALL') {
    list = list.filter((c) => c.shiftStatus === shiftStatus)
  }

  list.sort((a, b) => {
    let comparison = 0
    if (sortBy === 'staffName') {
      comparison = a.staffName.localeCompare(b.staffName)
    } else if (sortBy === 'staffRole') {
      comparison = a.staffRole.localeCompare(b.staffRole)
    } else if (sortBy === 'status') {
      comparison = a.codeStatus.localeCompare(b.codeStatus)
    } else if (sortBy === 'shiftStatus') {
      comparison = a.shiftStatus.localeCompare(b.shiftStatus)
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
    dispatcherCount: 0,
    serviceCount: 0,
    cashierCount: 0,
    ongoingShiftsCount: 0,
  }

  for (const c of codes) {
    if (c.codeStatus === 'ACTIVE') {
      stats.activeCount++
    } else {
      stats.inactiveCount++
    }

    if (c.shiftStatus === 'ONGOING') {
      stats.ongoingShiftsCount++
    }

    switch (c.staffRole) {
      case 'DISPATCHER':
        stats.dispatcherCount++
        break
      case 'SERVICE':
        stats.serviceCount++
        break
      case 'CASHIER':
        stats.cashierCount++
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
