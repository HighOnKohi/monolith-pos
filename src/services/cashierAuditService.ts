import { supabase } from '@/lib/supabase'
import type { CashierAuditAction, CashierAuditLog } from '@/types/cashierShift'
import { fetchStaffCodes } from './staffCodeService'

const LOCAL_STORAGE_AUDIT_FALLBACK = 'monolith_action_history_fallback'
const LOCAL_STORAGE_SHIFT_ID_KEY = 'monolith_cashier_shift_id'
const LOCAL_STORAGE_STAFF_ID_KEY = 'monolith_cashier_staff_id'
const LOCAL_STORAGE_BUSINESS_DAY_ID_KEY = 'monolith_active_business_day_id'

export interface LogCashierActionParams {
  action: CashierAuditAction
  businessDayId?: number | null
  shiftId?: number | null
  staffId?: number | null
  shiftType?: 'CASHIER' | 'SERVICE' | 'ORGANIZER' | 'DISPATCHER'
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
    const raw =
      localStorage.getItem(LOCAL_STORAGE_SHIFT_ID_KEY) ||
      localStorage.getItem('monolith_service_shift_id')
    if (raw) return Number(raw) || null
  } catch {
    // ignore
  }
  return null
}

function getStoredStaffId(): number | null {
  try {
    const raw =
      localStorage.getItem(LOCAL_STORAGE_STAFF_ID_KEY) ||
      localStorage.getItem('monolith_service_staff_id') ||
      sessionStorage.getItem('monolith_organizer_staff_id') ||
      localStorage.getItem('monolith_dispatcher_staff_id')
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

// ─── Audit Logging Core (system_history.Action_History) ──────────────────────

/**
 * Appends an audit log entry directly to system_history."Action_History".
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

  // Save to fallback store for resilient local continuity
  saveFallbackAuditLog(logEntry)

  // Write directly to system_history."Action_History"
  try {
    const safeStaffId = resolvedStaffId && resolvedStaffId < 1000000000000 ? resolvedStaffId : null

    const meta: Record<string, unknown> = { ...(params.metadata ?? {}) }
    if (params.shiftType) {
      meta['shift_type'] = params.shiftType
    }
    if (resolvedShiftId) {
      meta['shift_id'] = resolvedShiftId
    }
    if (resolvedBusinessDayId) {
      meta['business_day_id'] = resolvedBusinessDayId
    }
    if (resolvedAuthUserId) {
      meta['auth_user'] = resolvedAuthUserId
    }

    const payload: Record<string, unknown> = {
      STAFF_ID: safeStaffId,
      ACTION_TYPE: params.action,
      DESCRIPTION: params.description || `Action: ${params.action}`,
      CREATED_AT: logEntry.createdAt,
    }

    // Write directly to system_history."Action_History"
    const { data, error } = await supabase
      .schema('system_history')
      .from('Action_History')
      .insert([payload])
      .select('LOG_ID')
      .maybeSingle()

    if (!error && data?.LOG_ID) {
      logEntry.logId = Number(data.LOG_ID)
    } else if (error) {
      // Try public view fallback
      const { data: pubData } = await supabase
        .from('Action_History')
        .insert([payload])
        .select('LOG_ID')
        .maybeSingle()

      if (pubData?.LOG_ID) {
        logEntry.logId = Number(pubData.LOG_ID)
      }
    }
  } catch (err) {
    console.warn('[cashierAuditService] Action_History insert non-blocking warning:', err)
  }

  return logEntry
}

// ─── Query Audit Logs ────────────────────────────────────────────────────────

/**
 * Fetches audit logs from system_history."Action_History" with filtering, sorting, and pagination.
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
      .schema('system_history')
      .from('Action_History')
      .select('*')
      .order('CREATED_AT', { ascending: false })

    if (staffId !== 'ALL') {
      query = query.eq('STAFF_ID', staffId)
    }
    if (action !== 'ALL') {
      query = query.eq('ACTION_TYPE', action)
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
        .from('Action_History')
        .select('*')
        .order('CREATED_AT', { ascending: false })

      if (staffId !== 'ALL') pubQuery = pubQuery.eq('STAFF_ID', staffId)
      if (action !== 'ALL') pubQuery = pubQuery.eq('ACTION_TYPE', action)
      if (startDate) pubQuery = pubQuery.gte('CREATED_AT', startDate.toISOString())
      if (endDate) pubQuery = pubQuery.lte('CREATED_AT', endDate.toISOString())

      const { data: pubData, error: pubErr } = await pubQuery
      if (pubErr) throw pubErr

      dbLogs = (pubData ?? []).map(mapDbRowToActionHistory)
    } else {
      dbLogs = (data ?? []).map(mapDbRowToActionHistory)
    }
  } catch (err) {
    console.warn('[cashierAuditService] Using fallback action history logs:', err)
    usedFallback = true
    dbLogs = getFallbackAuditLogs()
  }

  // If DB returned rows, merge local fallback logs
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

  // Enrich with staff names from Staff_Codes if not already populated
  try {
    const staffResult = await fetchStaffCodes({}, 1, 100)
    const staffMap = new Map(staffResult.codes.map((s) => [s.codeId, s]))
    dbLogs = dbLogs.map((log) => {
      if (log.staffId && staffMap.has(log.staffId)) {
        const staff = staffMap.get(log.staffId)!
        return {
          ...log,
          staffName: log.staffName || staff.staffName,
          staffRole: log.staffRole || staff.staffRole,
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

function mapDbRowToActionHistory(row: Record<string, unknown>): CashierAuditLog {
  const meta =
    typeof row['METADATA'] === 'string'
      ? JSON.parse(row['METADATA'])
      : ((row['METADATA'] as Record<string, unknown>) ?? {})

  const staffId = row['STAFF_ID'] != null ? Number(row['STAFF_ID']) : (row['STAFF_CODE'] != null ? Number(row['STAFF_CODE']) : null)

  return {
    logId: Number(row['LOG_ID']),
    businessDayId: Number(meta['business_day_id'] ?? row['BUSINESS_DAY_ID'] ?? 0) || null,
    shiftId: Number(meta['shift_id'] ?? meta['service_shift_id'] ?? row['SHIFT_ID'] ?? 0) || null,
    staffId,
    staffName: row['STAFF_NAME'] ? String(row['STAFF_NAME']) : undefined,
    staffRole: row['STAFF_ROLE'] ? String(row['STAFF_ROLE']) : undefined,
    authUserId: (meta['auth_user'] || meta['auth_user_id'] || row['AUTH_USER_ID'] || null) as string | null,
    action: String(row['ACTION_TYPE'] || row['ACTION'] || 'UNKNOWN'),
    entityType: row['TARGET_ENTITY']
      ? String(row['TARGET_ENTITY'])
      : row['ENTITY_TYPE']
        ? String(row['ENTITY_TYPE'])
        : null,
    entityId: row['TARGET_ID']
      ? String(row['TARGET_ID'])
      : row['ENTITY_ID']
        ? String(row['ENTITY_ID'])
        : null,
    description: row['DESCRIPTION'] ? String(row['DESCRIPTION']) : null,
    metadata: meta,
    createdAt: String(row['CREATED_AT'] || new Date().toISOString()),
  }
}
