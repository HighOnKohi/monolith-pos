import { supabase } from '@/lib/supabase'

export const DEFAULT_MORNING_MENU_CUTOFF = '11:00' // 11:00 AM default
export const LOCAL_STORAGE_CUTOFF_KEY = 'monolith_morning_menu_cutoff'
export const MORNING_MENU_CUTOFF_CHANGED = 'monolith-morning-menu-cutoff-changed'

/**
 * Formats a 24-hour time string ("11:00") into a 12-hour display string ("11:00 AM").
 */
export function formatCutoffDisplay(timeStr?: string): string {
  if (!timeStr) return '11:00 AM'
  const [hoursStr, minutesStr] = timeStr.split(':')
  let hours = parseInt(hoursStr, 10)
  const minutes = minutesStr ? minutesStr.padStart(2, '0') : '00'
  if (isNaN(hours)) return '11:00 AM'

  const ampm = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12
  if (hours === 0) hours = 12
  return `${hours}:${minutes} ${ampm}`
}

/**
 * Determines whether the current local time is before the morning menu cutoff.
 * If true, Morning + Whole Day items are visible.
 * If false, Afternoon + Whole Day items are visible.
 */
export function isMorningMenuTime(cutoffTimeStr?: string): boolean {
  const cutoff = cutoffTimeStr || getStoredMorningMenuCutoff() || DEFAULT_MORNING_MENU_CUTOFF
  const [cutoffH, cutoffM] = cutoff.split(':').map((v) => parseInt(v, 10) || 0)
  const cutoffMinutes = cutoffH * 60 + cutoffM

  const now = new Date()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  return currentMinutes < cutoffMinutes
}

export function getStoredMorningMenuCutoff(): string {
  try {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(LOCAL_STORAGE_CUTOFF_KEY)
      if (stored && /^\d{1,2}:\d{2}$/.test(stored)) {
        return stored
      }
    }
  } catch {
    // ignore
  }
  return DEFAULT_MORNING_MENU_CUTOFF
}

/**
 * Parses timestamp or time string from database into standard "HH:mm" 24h format.
 */
function parseDbCutoffToTimeString(val: unknown): string | null {
  if (!val) return null
  const str = String(val).trim()
  // Check if it's already "HH:mm" or "HH:mm:ss"
  const timeMatch = str.match(/(\d{1,2}):(\d{2})/)
  if (timeMatch) {
    const hh = timeMatch[1].padStart(2, '0')
    const mm = timeMatch[2].padStart(2, '0')
    return `${hh}:${mm}`
  }
  // Try Date parsing
  try {
    const d = new Date(str)
    if (!isNaN(d.getTime())) {
      const hh = String(d.getHours()).padStart(2, '0')
      const mm = String(d.getMinutes()).padStart(2, '0')
      return `${hh}:${mm}`
    }
  } catch {
    // ignore
  }
  return null
}

/**
 * Fetches the Morning Menu Cutoff time from Configuration.system_configurations.
 * Falls back gracefully to localStorage or '11:00' if schema is restricted or unavailable.
 */
export async function fetchMorningMenuCutoff(): Promise<string> {
  try {
    const { data, error } = await supabase
      .schema('Configuration')
      .from('system_configurations')
      .select('CONFIGURATION_ID, MORNING_MENU_TIME_CUTOFF')
      .order('CONFIGURATION_ID', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (!error && data?.MORNING_MENU_TIME_CUTOFF) {
      const parsedTime = parseDbCutoffToTimeString(data.MORNING_MENU_TIME_CUTOFF)
      if (parsedTime) {
        if (typeof window !== 'undefined') {
          localStorage.setItem(LOCAL_STORAGE_CUTOFF_KEY, parsedTime)
        }
        return parsedTime
      }
    }
  } catch (err) {
    console.warn('[configurationService] Error fetching morning cutoff from DB:', err)
  }

  return getStoredMorningMenuCutoff()
}

/**
 * Updates the Morning Menu Cutoff time in Configuration.system_configurations and localStorage.
 */
export async function updateMorningMenuCutoff(timeStr: string): Promise<void> {
  const normalized = timeStr.trim()
  if (!/^\d{1,2}:\d{2}$/.test(normalized)) {
    throw new Error('Invalid time format. Please use HH:mm (e.g. 11:00).')
  }

  // Update local storage and notify immediately
  if (typeof window !== 'undefined') {
    localStorage.setItem(LOCAL_STORAGE_CUTOFF_KEY, normalized)
    window.dispatchEvent(new CustomEvent(MORNING_MENU_CUTOFF_CHANGED, { detail: normalized }))
    try {
      const bc = new BroadcastChannel('monolith_config_events')
      bc.postMessage({ type: 'morning_cutoff_changed', cutoff: normalized })
      bc.close()
    } catch {
      // ignore
    }
  }

  // Build timestamp for PostgreSQL timestamp without time zone: "2000-01-01 HH:mm:00"
  const [hh, mm] = normalized.split(':').map((s) => s.padStart(2, '0'))
  const timestampValue = `2000-01-01 ${hh}:${mm}:00`

  try {
    // Check if an existing row exists
    const { data: existingRows } = await supabase
      .schema('Configuration')
      .from('system_configurations')
      .select('CONFIGURATION_ID')
      .limit(1)

    if (existingRows && existingRows.length > 0) {
      const configId = existingRows[0].CONFIGURATION_ID
      const { error: updateErr } = await supabase
        .schema('Configuration')
        .from('system_configurations')
        .update({ MORNING_MENU_TIME_CUTOFF: timestampValue })
        .eq('CONFIGURATION_ID', configId)

      if (updateErr) throw updateErr
    } else {
      const { error: insertErr } = await supabase
        .schema('Configuration')
        .from('system_configurations')
        .insert([{ MORNING_MENU_TIME_CUTOFF: timestampValue }])

      if (insertErr) throw insertErr
    }
  } catch (err) {
    console.warn('[configurationService] Database update for MORNING_MENU_TIME_CUTOFF:', err)
    // Non-blocking so the app functions seamlessly with the persisted setting
  }
}

// ─── Discount Rate Configurations (PWD & Senior Citizen) ─────────────────────────

export interface DiscountConfigurations {
  pwdPercent: number
  seniorPercent: number
}

export const DEFAULT_DISCOUNT_CONFIG: DiscountConfigurations = {
  pwdPercent: 20,
  seniorPercent: 20,
}

export const LOCAL_STORAGE_DISCOUNT_CONFIG_KEY = 'monolith_discount_config'
export const DISCOUNT_CONFIG_CHANGED_EVENT = 'monolith-discount-config-changed'

/**
 * Retrieves the currently configured PWD and Senior Citizen discount percentages.
 * Defaults to 20% each (standard Philippine statutory rate).
 */
export function getDiscountPercentages(): DiscountConfigurations {
  try {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(LOCAL_STORAGE_DISCOUNT_CONFIG_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        return {
          pwdPercent:
            typeof parsed.pwdPercent === 'number' && parsed.pwdPercent >= 0
              ? Math.min(100, parsed.pwdPercent)
              : 20,
          seniorPercent:
            typeof parsed.seniorPercent === 'number' && parsed.seniorPercent >= 0
              ? Math.min(100, parsed.seniorPercent)
              : 20,
        }
      }
    }
  } catch {
    // ignore
  }
  return DEFAULT_DISCOUNT_CONFIG
}

/**
 * Updates the configured discount percentages for PWD and Senior Citizen.
 * Emits custom event and broadcast channel message so checkout screens sync live.
 */
export function updateDiscountPercentages(pwdPercent: number, seniorPercent: number): void {
  const config: DiscountConfigurations = {
    pwdPercent: Math.max(0, Math.min(100, Math.round(pwdPercent))),
    seniorPercent: Math.max(0, Math.min(100, Math.round(seniorPercent))),
  }

  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_DISCOUNT_CONFIG_KEY, JSON.stringify(config))
      window.dispatchEvent(
        new CustomEvent(DISCOUNT_CONFIG_CHANGED_EVENT, { detail: config }),
      )
      try {
        const bc = new BroadcastChannel('monolith_config_events')
        bc.postMessage({ type: 'discount_config_changed', config })
        bc.close()
      } catch {
        // ignore
      }
    }
  } catch (err) {
    console.warn('[configurationService] Error saving discount percentages:', err)
  }
}
