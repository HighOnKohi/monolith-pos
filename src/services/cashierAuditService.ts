import { supabase } from '@/lib/supabase'
import type { CashierAuditAction, CashierAuditLog } from '@/types/cashierShift'
import { fetchStaffCodes } from './staffCodeService'

const LOCAL_STORAGE_AUDIT_FALLBACK = 'monolith_cashier_audit_logs_fallback'
const LOCAL_STORAGE_SHIFT_ID_KEY = 'monolith_cashier_shift_id'
const LOCAL_STORAGE_STAFF_ID_KEY = 'monolith_cashier_staff_id'
const LOCAL_STORAGE_BUSINESS_DAY_ID_KEY = 'monolith_active_business_day_id'

export interface LogCashierActionParams {
  action: CashierAuditAction
  businessDayId?: number | null
  shiftId?: number | null
  staffId?: number | null
  shiftType?: 'CASHIER' | 'SERVICE'
  authUserId?: string | null
  entityType?: string | null
  entityId?: string | null
  description?: string | null
  metadata?: Record<string, unknown> | null
}

export interface CashierAuditFilterParams {
  staffId?: number | 'ALL'
  action?: CashierAuditAction | 'ALL'
  startDate?: Date
  endDate?: Date
  search?: string
}

export interface FetchCashierAuditLogsResult {
  logs: CashierAuditLog[]
  totalCount: number
  totalPages: number
  currentPage: number
  pageSize: number
}

// ─── Local Storage Fallback Helpers ──────────────────────────────────────────

function getFallbackAuditLogs(): CashierAuditLog[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_AUDIT_FALLBACK)
    if (raw) return JSON.parse(raw) as CashierAuditLog[]
  } catch (err) {
    console.warn('[cashierAuditService] Error reading audit fallback:', err)
  }
  return []
}

function saveFallbackAuditLog(log: CashierAuditLog): void {
  try {
    const logs = getFallbackAuditLogs()
    logs.unshift(log)
    // Keep up to 500 recent fallback logs
    if (logs.length > 500) logs.length = 500
    localStorage.setItem(LOCAL_STORAGE_AUDIT_FALLBACK, JSON.stringify(logs))
  } catch (err) {
    console.warn('[cashierAuditService] Error saving audit fallback:', err)
  }
}

// ─── Dual Attribution Helper ─────────────────────────────────────────────────

function getActiveAuthUserId(): string | null {
  try {
    // Read cached supabase auth session from localStorage if available
    const keys = Object.keys(localStorage)
    for (const key of keys) {
      if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
        const raw = localStorage.getItem(key)
        if (raw) {
          const parsed = JSON.parse(raw)
          return parsed?.user?.email || parsed?.user?.id || null
        }
      }
    }
  } catch {
    // ignore
  }
  return null
}

function getStoredShiftId(): number | null {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_SHIFT_ID_KEY)
    if (raw) return Number(raw) || null
  } catch {
    // ignore
  }
  return null
}

function getStoredStaffId(): number | null {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_STAFF_ID_KEY)
    if (raw) return Number(raw) || null
  } catch {
    // ignore
  }
  return null
}

function getStoredBusinessDayId(): number | null {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_BUSINESS_DAY_ID_KEY)
    if (raw) return Number(raw) || null
  } catch {
    // ignore
  }
  return null
}

// ─── Audit Logging Core ──────────────────────────────────────────────────────

/**
 * Appends an audit log entry.
 * Primary destination: staff."Audit_Logs" or public."Audit_Logs".
 * Secondary destination: system_history."Action_History" (if available).
 * Resilient fallback: localStorage fallback array.
 */
export async function logCashierAction(params: LogCashierActionParams): Promise<CashierAuditLog> {
  const resolvedShiftId = params.shiftId !== undefined ? params.shiftId : getStoredShiftId()
  const resolvedStaffId = params.staffId !== undefined ? params.staffId : getStoredStaffId()
  const resolvedBusinessDayId = params.businessDayId !== undefined ? params.businessDayId : getStoredBusinessDayId()
  const resolvedAuthUserId = params.authUserId !== undefined ? params.authUserId : getActiveAuthUserId()

  const logEntry: CashierAuditLog = {
    logId: Date.now(),
    businessDayId: resolvedBusinessDayId,
    shiftId: resolvedShiftId,
    staffId: resolvedStaffId,
    authUserId: resolvedAuthUserId,
    action: params.action,
    entityType: params.entityType ?? null,
    entityId: params.entityId ? String(params.entityId) : null,
    description: params.description ?? null,
    metadata: params.metadata ?? {},
    createdAt: new Date().toISOString(),
  }

  // Always save to fallback store immediately for instant local reflection
  saveFallbackAuditLog(logEntry)

  // 1. Attempt writing to staff."Audit_Logs" or public."Audit_Logs"
  try {
    const isServiceShift =
      params.shiftType === 'SERVICE' ||
      params.metadata?.['shift_type'] === 'SERVICE' ||
      (Boolean(localStorage.getItem('monolith_service_shift_id')) &&
        params.action !== 'CASHIER_SHIFT_STARTED' &&
        params.action !== 'CASHIER_SHIFT_ENDED')

    // Audit_Logs.SHIFT_ID foreign key constraint references staff."Cashier_Shifts".
    // Service shifts must not be inserted into SHIFT_ID column, but kept in METADATA.
    const safeShiftId =
      !isServiceShift && resolvedShiftId && resolvedShiftId < 1000000000000
        ? resolvedShiftId
        : null

    const safeStaffId = resolvedStaffId && resolvedStaffId < 1000000000000 ? resolvedStaffId : null

    const meta = { ...(params.metadata ?? {}) }
    if (params.shiftType) {
      meta['shift_type'] = params.shiftType
    } else if (isServiceShift) {
      meta['shift_type'] = 'SERVICE'
    }
    if (resolvedShiftId) {
      if (isServiceShift) {
        meta['service_shift_id'] = resolvedShiftId
      } else {
        meta['shift_id'] = resolvedShiftId
      }
    }
    if (resolvedBusinessDayId) {
      meta['business_day_id'] = resolvedBusinessDayId
    }

    const payload: Record<string, unknown> = {
      AUTH_USER_ID: resolvedAuthUserId,
      ACTION: params.action,
      ENTITY_TYPE: params.entityType ?? null,
      ENTITY_ID: params.entityId ? String(params.entityId) : null,
      DESCRIPTION: params.description ?? null,
      METADATA: meta,
      CREATED_AT: logEntry.createdAt,
    }

    if (safeShiftId) payload.SHIFT_ID = safeShiftId
    if (safeStaffId) payload.STAFF_ID = safeStaffId

    const { data, error } = await supabase
      .schema('staff')
      .from('Audit_Logs')
      .insert([payload])
      .select('LOG_ID')
      .single()

    if (!error && data?.LOG_ID) {
      logEntry.logId = Number(data.LOG_ID)
    } else {
      const isFkOrColError =
        error?.code === '23503' ||
        error?.code === '42703' ||
        error?.message?.includes('foreign key') ||
        error?.message?.includes('fkey') ||
        error?.message?.includes('column')

      const sanitizedPayload = {
        AUTH_USER_ID: resolvedAuthUserId,
        ACTION: params.action,
        ENTITY_TYPE: params.entityType ?? null,
        ENTITY_ID: params.entityId ? String(params.entityId) : null,
        DESCRIPTION: params.description ?? null,
        METADATA: meta,
        CREATED_AT: logEntry.createdAt,
      }

      if (isFkOrColError) {
        const { data: retryStaff } = await supabase
          .schema('staff')
          .from('Audit_Logs')
          .insert([sanitizedPayload])
          .select('LOG_ID')
          .single()

        if (retryStaff?.LOG_ID) {
          logEntry.logId = Number(retryStaff.LOG_ID)
        }
      }

      if (logEntry.logId >= 1000000000000) {
        // If still not saved to DB, try public view with sanitized payload
        const { data: pubData } = await supabase
          .from('Audit_Logs')
          .insert([sanitizedPayload])
          .select('LOG_ID')
          .single()

        if (pubData?.LOG_ID) {
          logEntry.logId = Number(pubData.LOG_ID)
        }
      }
    }
  } catch (err) {
    console.warn('[cashierAuditService] Supabase Audit_Logs insert failed, retained in fallback:', err)
  }

  // 2. Dual-write to system_history."Action_History" if it exists
  try {
    await supabase.from('Action_History').insert([
      {
        STAFF_CODE: resolvedStaffId,
        ACTION_TYPE: params.action,
        MODULE: 'CASHIER',
        DESCRIPTION: params.description || `Cashier Action: ${params.action}`,
        TARGET_ENTITY: params.entityType ?? 'POS',
        TARGET_ID: params.entityId ? String(params.entityId) : null,
        METADATA: {
          shift_id: resolvedShiftId,
          auth_user: resolvedAuthUserId,
          ...params.metadata,
        },
      },
    ])
  } catch {
    // Non-fatal
  }

  return logEntry
}

// ─── Query Audit Logs ────────────────────────────────────────────────────────

/**
 * Fetches cashier audit logs with filtering, sorting, and pagination.
 */
export async function fetchCashierAuditLogs(
  filters: CashierAuditFilterParams = {},
  page = 1,
  pageSize = 25,
): Promise<FetchCashierAuditLogsResult> {
  const { staffId = 'ALL', action = 'ALL', startDate, endDate, search = '' } = filters

  let dbLogs: CashierAuditLog[] = []
  let usedFallback = false

  try {
    let query = supabase
      .schema('staff')
      .from('Audit_Logs')
      .select('*')
      .order('CREATED_AT', { ascending: false })

    if (staffId !== 'ALL') {
      query = query.eq('STAFF_ID', staffId)
    }
    if (action !== 'ALL') {
      query = query.eq('ACTION', action)
    }
    if (startDate) {
      query = query.gte('CREATED_AT', startDate.toISOString())
    }
    if (endDate) {
      query = query.lte('CREATED_AT', endDate.toISOString())
    }

    const { data, error } = await query

    if (error) {
      // Try public view
      let pubQuery = supabase
        .from('Audit_Logs')
        .select('*')
        .order('CREATED_AT', { ascending: false })

      if (staffId !== 'ALL') pubQuery = pubQuery.eq('STAFF_ID', staffId)
      if (action !== 'ALL') pubQuery = pubQuery.eq('ACTION', action)
      if (startDate) pubQuery = pubQuery.gte('CREATED_AT', startDate.toISOString())
      if (endDate) pubQuery = pubQuery.lte('CREATED_AT', endDate.toISOString())

      const { data: pubData, error: pubErr } = await pubQuery
      if (pubErr) throw pubErr

      dbLogs = (pubData ?? []).map(mapDbRowToAuditLog)
    } else {
      dbLogs = (data ?? []).map(mapDbRowToAuditLog)
    }
  } catch (err) {
    console.warn('[cashierAuditService] Using fallback audit logs:', err)
    usedFallback = true
    dbLogs = getFallbackAuditLogs()
  }

  // If DB returned rows, also merge any local fallback logs that haven't synced
  if (!usedFallback) {
    const fallbackLogs = getFallbackAuditLogs()
    const dbLogIds = new Set(dbLogs.map((l) => l.logId))
    for (const fb of fallbackLogs) {
      if (!dbLogIds.has(fb.logId)) {
        dbLogs.push(fb)
      }
    }
    dbLogs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }

  // Enrich with staff names from Staff_Codes
  try {
    const staffResult = await fetchStaffCodes({}, 1, 100)
    const staffMap = new Map(staffResult.codes.map((s) => [s.codeId, s]))
    dbLogs = dbLogs.map((log) => {
      if (log.staffId && staffMap.has(log.staffId)) {
        const staff = staffMap.get(log.staffId)!
        return {
          ...log,
          staffName: staff.staffName,
          staffRole: staff.staffRole,
        }
      }
      return log
    })
  } catch {
    // non-fatal
  }

  // Client-side filtering for search query (description, action, entity, staff name)
  let filtered = dbLogs
  if (search.trim()) {
    const q = search.trim().toLowerCase()
    filtered = filtered.filter(
      (log) =>
        log.action.toLowerCase().includes(q) ||
        (log.description && log.description.toLowerCase().includes(q)) ||
        (log.entityType && log.entityType.toLowerCase().includes(q)) ||
        (log.entityId && log.entityId.toLowerCase().includes(q)) ||
        (log.staffName && log.staffName.toLowerCase().includes(q)) ||
        String(log.staffId || '').includes(q) ||
        String(log.shiftId || '').includes(q),
    )
  }

  if (usedFallback) {
    if (staffId !== 'ALL') filtered = filtered.filter((l) => l.staffId === staffId)
    if (action !== 'ALL') filtered = filtered.filter((l) => l.action === action)
    if (startDate) filtered = filtered.filter((l) => new Date(l.createdAt) >= startDate)
    if (endDate) filtered = filtered.filter((l) => new Date(l.createdAt) <= endDate)
  }

  const totalCount = filtered.length
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const validPage = Math.min(Math.max(1, page), totalPages)
  const startIndex = (validPage - 1) * pageSize
  const paginated = filtered.slice(startIndex, startIndex + pageSize)

  return {
    logs: paginated,
    totalCount,
    totalPages,
    currentPage: validPage,
    pageSize,
  }
}

function mapDbRowToAuditLog(row: Record<string, unknown>): CashierAuditLog {
  return {
    logId: Number(row['LOG_ID']),
    shiftId: row['SHIFT_ID'] != null ? Number(row['SHIFT_ID']) : null,
    staffId: row['STAFF_ID'] != null ? Number(row['STAFF_ID']) : null,
    authUserId: row['AUTH_USER_ID'] ? String(row['AUTH_USER_ID']) : null,
    action: String(row['ACTION'] || 'UNKNOWN'),
    entityType: row['ENTITY_TYPE'] ? String(row['ENTITY_TYPE']) : null,
    entityId: row['ENTITY_ID'] ? String(row['ENTITY_ID']) : null,
    description: row['DESCRIPTION'] ? String(row['DESCRIPTION']) : null,
    metadata: (row['METADATA'] as Record<string, unknown>) || null,
    createdAt: String(row['CREATED_AT'] || new Date().toISOString()),
  }
}
