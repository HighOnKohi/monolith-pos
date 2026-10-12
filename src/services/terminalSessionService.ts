import { supabase } from '@/lib/supabase'
import type { StaffRole } from '@/types/account'

const LOCAL_STORAGE_DEVICE_ID = 'monolith_terminal_device_id'
const LOCAL_STORAGE_DEVICE_NAME = 'monolith_terminal_device_name'
const LOCAL_STORAGE_PREFIX = 'monolith_session_'
const BROADCAST_CHANNEL_NAME = 'monolith_staff_sessions_local'
const SUPABASE_CHANNEL_NAME = 'monolith-staff-session-broadcast'

export interface TerminalSessionInfo {
  staffId: number
  staffName: string
  staffRole: StaffRole
  shiftId: number
  startedAt: string
  deviceId: string
  deviceName: string
}

export interface SessionSyncEvent {
  type: 'SHIFT_STARTED' | 'SHIFT_ENDED' | 'FORCE_LOGOUT'
  staffId: number
  staffRole?: StaffRole
  deviceId: string
  timestamp: string
}

// ─── Device ID Management ───────────────────────────────────────────────────

/**
 * Returns a persistent, unique device/terminal ID for this PC/browser.
 */
export function getDeviceId(): string {
  if (typeof window === 'undefined') return 'server_instance'
  let id = localStorage.getItem(LOCAL_STORAGE_DEVICE_ID)
  if (!id) {
    id = `term_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    localStorage.setItem(LOCAL_STORAGE_DEVICE_ID, id)
  }
  return id
}

/**
 * Returns a friendly device name (e.g. "Workstation-A3F").
 */
export function getDeviceName(): string {
  if (typeof window === 'undefined') return 'POS Terminal'
  let name = localStorage.getItem(LOCAL_STORAGE_DEVICE_NAME)
  if (!name) {
    const id = getDeviceId()
    const suffix = id.slice(-4).toUpperCase()
    name = `Terminal (${suffix})`
    localStorage.setItem(LOCAL_STORAGE_DEVICE_NAME, name)
  }
  return name
}

// ─── Role Session Storage ───────────────────────────────────────────────────

export function getTerminalSession(role: StaffRole): TerminalSessionInfo | null {
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_PREFIX}${role.toLowerCase()}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as TerminalSessionInfo
    // Verify device ownership
    if (parsed.deviceId && parsed.deviceId !== getDeviceId()) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function saveTerminalSession(session: TerminalSessionInfo): void {
  try {
    const roleKey = `${LOCAL_STORAGE_PREFIX}${session.staffRole.toLowerCase()}`
    localStorage.setItem(roleKey, JSON.stringify(session))

    // Set legacy role keys for backward compatibility with order / audit logging
    if (session.staffRole === 'SERVICE') {
      localStorage.setItem('monolith_service_staff_id', String(session.staffId))
      localStorage.setItem('monolith_service_shift_id', String(session.shiftId))
    } else if (session.staffRole === 'CASHIER') {
      localStorage.setItem('monolith_cashier_staff_id', String(session.staffId))
      localStorage.setItem('monolith_cashier_shift_id', String(session.shiftId))
    } else if (session.staffRole === 'DISPATCHER') {
      localStorage.setItem('monolith_dispatcher_staff_id', String(session.staffId))
      localStorage.setItem('monolith_dispatcher_shift_id', String(session.shiftId))
      localStorage.setItem('monolith_dispatcher_shift_start', session.startedAt)
    } else if (session.staffRole === 'ORGANIZER') {
      localStorage.setItem('monolith_organizer_staff_id', String(session.staffId))
      sessionStorage.setItem('monolith_organizer_staff_id', String(session.staffId))
      localStorage.setItem('monolith_organizer_shift_start', session.startedAt)
      sessionStorage.setItem('monolith_organizer_shift_start', session.startedAt)
    } else if (session.staffRole === 'RECEPTIONIST') {
      localStorage.setItem('monolith_receptionist_staff_id', String(session.staffId))
      sessionStorage.setItem('monolith_receptionist_staff_id', String(session.staffId))
      localStorage.setItem('monolith_receptionist_shift_start', session.startedAt)
      sessionStorage.setItem('monolith_receptionist_shift_start', session.startedAt)
    }

    localStorage.setItem(
      'monolith_active_staff_session',
      JSON.stringify({
        codeId: session.staffId,
        staffName: session.staffName,
        staffRole: session.staffRole,
        shiftStatus: 'ONGOING',
        shiftStart: session.startedAt,
      }),
    )

    // Broadcast session start
    broadcastSessionEvent({
      type: 'SHIFT_STARTED',
      staffId: session.staffId,
      staffRole: session.staffRole,
      deviceId: session.deviceId,
      timestamp: session.startedAt,
    })
  } catch (err) {
    console.warn('[terminalSessionService] Error saving terminal session:', err)
  }
}

export function clearTerminalSession(role: StaffRole, staffId?: number): void {
  try {
    const roleKey = `${LOCAL_STORAGE_PREFIX}${role.toLowerCase()}`
    const existing = getTerminalSession(role)
    const effectiveStaffId = staffId || existing?.staffId

    localStorage.removeItem(roleKey)

    if (role === 'SERVICE') {
      localStorage.removeItem('monolith_service_staff_id')
      localStorage.removeItem('monolith_service_shift_id')
      localStorage.removeItem('monolith_service_shifts_fallback')
    } else if (role === 'CASHIER') {
      localStorage.removeItem('monolith_cashier_staff_id')
      localStorage.removeItem('monolith_cashier_shift_id')
      localStorage.removeItem('monolith_cashier_shifts_fallback')
    } else if (role === 'DISPATCHER') {
      localStorage.removeItem('monolith_dispatcher_staff_id')
      localStorage.removeItem('monolith_dispatcher_shift_id')
      localStorage.removeItem('monolith_dispatcher_shift_start')
    } else if (role === 'ORGANIZER') {
      localStorage.removeItem('monolith_organizer_staff_id')
      sessionStorage.removeItem('monolith_organizer_staff_id')
      localStorage.removeItem('monolith_organizer_shift_start')
      sessionStorage.removeItem('monolith_organizer_shift_start')
    } else if (role === 'RECEPTIONIST') {
      localStorage.removeItem('monolith_receptionist_staff_id')
      sessionStorage.removeItem('monolith_receptionist_staff_id')
      localStorage.removeItem('monolith_receptionist_shift_start')
      sessionStorage.removeItem('monolith_receptionist_shift_start')
    }

    localStorage.removeItem('monolith_active_staff_session')

    if (effectiveStaffId) {
      broadcastSessionEvent({
        type: 'SHIFT_ENDED',
        staffId: effectiveStaffId,
        staffRole: role,
        deviceId: getDeviceId(),
        timestamp: new Date().toISOString(),
      })
    }
  } catch (err) {
    console.warn('[terminalSessionService] Error clearing terminal session:', err)
  }
}

// ─── Realtime Communication ─────────────────────────────────────────────────

let localBroadcastChannel: BroadcastChannel | null = null

function getLocalBroadcastChannel(): BroadcastChannel | null {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    if (!localBroadcastChannel) {
      localBroadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME)
    }
    return localBroadcastChannel
  }
  return null
}

export function broadcastSessionEvent(event: SessionSyncEvent): void {
  // 1. Same-PC broadcast
  try {
    const ch = getLocalBroadcastChannel()
    ch?.postMessage(event)
  } catch {
    // ignore
  }

  // 2. Cross-PC Supabase broadcast
  try {
    const liveChannel = supabase.channel(SUPABASE_CHANNEL_NAME)
    void liveChannel.send({
      type: 'broadcast',
      event: 'staff_session_update',
      payload: event,
    })
  } catch {
    // ignore
  }
}

/**
 * Subscribes to shift session events from other tabs and other PCs.
 */
export function subscribeToSessionEvents(
  callback: (event: SessionSyncEvent) => void,
): () => void {
  // 1. Same-PC listener
  const ch = getLocalBroadcastChannel()
  const handleLocalMessage = (ev: MessageEvent) => {
    if (ev.data) callback(ev.data as SessionSyncEvent)
  }
  ch?.addEventListener('message', handleLocalMessage)

  // 2. Cross-PC listener via Supabase
  const liveChannel = supabase
    .channel(SUPABASE_CHANNEL_NAME)
    .on('broadcast', { event: 'staff_session_update' }, (payload) => {
      if (payload.payload) {
        callback(payload.payload as SessionSyncEvent)
      }
    })
    .subscribe()

  return () => {
    ch?.removeEventListener('message', handleLocalMessage)
    void supabase.removeChannel(liveChannel)
  }
}

// ─── Cross-PC Conflict Prevention ───────────────────────────────────────────

/**
 * Checks if a staff code is already in an ongoing shift.
 * If ongoing in the DB and not owned by this PC's terminal session, returns { isConflict: true, staffName }.
 */
export async function checkStaffActiveOnOtherTerminal(
  staffId: number,
  role: StaffRole,
): Promise<{
  isConflict: boolean
  staffName?: string
  startedAt?: string
}> {
  try {
    let dbRow: Record<string, unknown> | null = null
    const { data: schemaRow } = await supabase
      .schema('staff')
      .from('Staff_Codes')
      .select('*')
      .eq('CODE_ID', staffId)
      .maybeSingle()

    if (schemaRow) {
      dbRow = schemaRow as Record<string, unknown>
    } else {
      const { data: pubRow } = await supabase
        .from('Staff_Codes')
        .select('*')
        .eq('CODE_ID', staffId)
        .maybeSingle()
      if (pubRow) dbRow = pubRow as Record<string, unknown>
    }

    if (!dbRow) return { isConflict: false }

    const shiftStatus = String(dbRow['SHIFT_STATUS'] || 'ENDED').toUpperCase()
    if (shiftStatus !== 'ONGOING') {
      return { isConflict: false }
    }

    // Check if this terminal already holds the active session for this staff
    const currentSession = getTerminalSession(role)
    if (currentSession && currentSession.staffId === staffId && currentSession.deviceId === getDeviceId()) {
      return { isConflict: false }
    }

    // If shift is ongoing in DB but this device does NOT have it, another terminal owns it!
    return {
      isConflict: true,
      staffName: String(dbRow['STAFF_NAME'] || 'Staff'),
      startedAt: dbRow['SHIFT_START'] ? String(dbRow['SHIFT_START']) : undefined,
    }
  } catch (err) {
    console.warn('[terminalSessionService] checkStaffActiveOnOtherTerminal error:', err)
    return { isConflict: false }
  }
}

// ─── Sanitization & Self-Healing ────────────────────────────────────────────

/**
 * Verifies local storage sessions against the database.
 * If a shift was ended in the database (or business day ended), purges stale local storage.
 */
export async function sanitizeTerminalSessions(): Promise<void> {
  const roles: StaffRole[] = ['SERVICE', 'CASHIER', 'DISPATCHER', 'ORGANIZER', 'RECEPTIONIST']

  for (const role of roles) {
    const session = getTerminalSession(role)
    const legacyStaffId = Number(
      localStorage.getItem(`monolith_${role.toLowerCase()}_staff_id`) ||
        sessionStorage.getItem(`monolith_${role.toLowerCase()}_staff_id`),
    )
    const targetId = session?.staffId || legacyStaffId

    if (targetId) {
      try {
        let dbRow: Record<string, unknown> | null = null
        const { data: schemaRow } = await supabase
          .schema('staff')
          .from('Staff_Codes')
          .select('SHIFT_STATUS')
          .eq('CODE_ID', targetId)
          .maybeSingle()

        if (schemaRow) dbRow = schemaRow as Record<string, unknown>
        else {
          const { data: pubRow } = await supabase
            .from('Staff_Codes')
            .select('SHIFT_STATUS')
            .eq('CODE_ID', targetId)
            .maybeSingle()
          if (pubRow) dbRow = pubRow as Record<string, unknown>
        }

        const shiftStatus = String(dbRow?.['SHIFT_STATUS'] || 'ENDED').toUpperCase()
        if (shiftStatus === 'ENDED') {
          // Purge stale local session
          clearTerminalSession(role, targetId)
        }
      } catch {
        // network issue - don't purge aggressively
      }
    }
  }
}
