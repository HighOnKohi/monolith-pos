import { supabase } from '@/lib/supabase'
import type { AssistanceRequest, AssistanceType } from '@/types/assistance'

const ASSISTANCE_TITLES: Record<AssistanceType, string> = {
  WATER: 'Water Refill',
  WAITER: 'Call Waiter',
  UTENSILS: 'Utensils or Napkins',
  BILL_OUT: 'Bill Out Request',
  OTHER: 'Special Assistance',
}

const STORAGE_KEY_PREFIX = 'monolith_active_assist_'

export async function sendAssistanceRequest(
  tableId: number,
  type: AssistanceType,
  notes?: string,
  tableNum?: number,
): Promise<AssistanceRequest> {
  const request: AssistanceRequest = {
    id: `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    tableId,
    tableNum: tableNum ?? tableId,
    type,
    title: ASSISTANCE_TITLES[type],
    notes: notes?.trim() || undefined,
    status: 'PENDING',
    requestedAt: new Date().toISOString(),
  }

  // 1. Update Restaurant_Tables STATUS to 'HAS_REQUEST'
  try {
    const updatePayload: Record<string, unknown> = {
      STATUS: 'HAS_REQUEST',
    }
    if (type === 'BILL_OUT') {
      updatePayload['BILL_OUT_REQUESTED'] = true
    }

    await supabase
      .from('Restaurant_Tables')
      .update(updatePayload)
      .eq('TABLE_ID', tableId)
  } catch (err) {
    console.error('[assistanceService] Error updating table status:', err)
  }

  // 2. Broadcast realtime event
  try {
    const channel = supabase.channel('table-assistance')
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channel.send({
          type: 'broadcast',
          event: 'assistance_request',
          payload: request,
        })
      }
    })
  } catch (err) {
    console.error('[assistanceService] Error broadcasting assistance request:', err)
  }

  // 3. Cache in local storage for customer feedback
  try {
    sessionStorage.setItem(`${STORAGE_KEY_PREFIX}${tableId}`, JSON.stringify(request))
  } catch {
    // Ignore storage issues
  }

  return request
}

export function getCachedTableAssistance(tableId: number): AssistanceRequest | null {
  try {
    const data = sessionStorage.getItem(`${STORAGE_KEY_PREFIX}${tableId}`)
    if (!data) return null
    return JSON.parse(data) as AssistanceRequest
  } catch {
    return null
  }
}

export function clearCachedTableAssistance(tableId: number) {
  try {
    sessionStorage.removeItem(`${STORAGE_KEY_PREFIX}${tableId}`)
  } catch {
    // Ignore
  }
}

export async function resolveTableAssistance(tableId: number): Promise<void> {
  clearCachedTableAssistance(tableId)

  // 1. Revert Restaurant_Tables STATUS to 'OCCUPIED' or 'AVAILABLE'
  try {
    await supabase
      .from('Restaurant_Tables')
      .update({
        STATUS: 'OCCUPIED',
        BILL_OUT_REQUESTED: false,
      })
      .eq('TABLE_ID', tableId)
  } catch (err) {
    console.error('[assistanceService] Error resetting table status:', err)
  }

  // 2. Broadcast resolution
  try {
    const channel = supabase.channel('table-assistance')
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channel.send({
          type: 'broadcast',
          event: 'assistance_resolved',
          payload: { tableId },
        })
      }
    })
  } catch (err) {
    console.error('[assistanceService] Error broadcasting assistance resolved:', err)
  }
}
