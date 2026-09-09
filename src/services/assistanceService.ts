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

// In-memory cache of recent active assistance requests (for staff view of notes/type)
const recentRequestsMap = new Map<number, AssistanceRequest>()

export function recordAssistanceRequest(req: AssistanceRequest) {
  recentRequestsMap.set(req.tableId, req)
}

export function removeAssistanceRequest(tableId: number, memberIds?: number[]) {
  recentRequestsMap.delete(tableId)
  memberIds?.forEach((id) => recentRequestsMap.delete(id))
}

export function getAssistanceRequestForTable(
  tableId: number,
  memberIds?: number[],
): AssistanceRequest | null {
  if (recentRequestsMap.has(tableId)) return recentRequestsMap.get(tableId)!
  if (memberIds) {
    for (const mId of memberIds) {
      if (recentRequestsMap.has(mId)) return recentRequestsMap.get(mId)!
    }
  }
  return null
}

/**
 * Resolves all member table IDs in the merge group for a given tableId.
 */
export async function getMergeGroupMemberIds(tableId: number): Promise<number[]> {
  try {
    const { data: target } = await supabase
      .from('Restaurant_Tables')
      .select('TABLE_ID, MERGE_GROUP_ID')
      .eq('TABLE_ID', tableId)
      .maybeSingle()

    if (!target) return [tableId]

    const anchorId = target.MERGE_GROUP_ID ?? target.TABLE_ID
    const { data: secondaries } = await supabase
      .from('Restaurant_Tables')
      .select('TABLE_ID')
      .eq('MERGE_GROUP_ID', anchorId)

    const ids = new Set<number>()
    ids.add(anchorId)
    ;(secondaries ?? []).forEach((s) => ids.add(Number(s.TABLE_ID)))
    return Array.from(ids)
  } catch (err) {
    console.error('[assistanceService] Error resolving merge group:', err)
    return [tableId]
  }
}

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

  recordAssistanceRequest(request)

  // 1. Resolve merge group member tables
  const targetIds = await getMergeGroupMemberIds(tableId)

  // 2. Update Restaurant_Tables STATUS to 'HAS_REQUEST' for all member tables
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
      .in('TABLE_ID', targetIds)
  } catch (err) {
    console.error('[assistanceService] Error updating table status:', err)
  }

  // 3. Broadcast realtime event (including all member table IDs)
  try {
    const channel = supabase.channel('table-assistance')
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        void channel.send({
          type: 'broadcast',
          event: 'assistance_request',
          payload: {
            ...request,
            tableIds: targetIds,
          },
        }).then(() => {
          setTimeout(() => {
            void supabase.removeChannel(channel)
          }, 1500)
        })
      }
    })
  } catch (err) {
    console.error('[assistanceService] Error broadcasting assistance request:', err)
  }

  // 4. Cache in storage for each member table
  targetIds.forEach((id) => {
    try {
      sessionStorage.setItem(`${STORAGE_KEY_PREFIX}${id}`, JSON.stringify(request))
    } catch {
      // Ignore storage issues
    }
  })

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

/**
 * Clears assistance status for a table and all other tables in its merge group.
 * Returns the list of affected table IDs.
 */
export async function resolveTableAssistance(tableId: number): Promise<number[]> {
  const targetIds = await getMergeGroupMemberIds(tableId)

  targetIds.forEach((id) => {
    clearCachedTableAssistance(id)
  })
  removeAssistanceRequest(tableId, targetIds)

  // 1. Revert Restaurant_Tables STATUS to 'OCCUPIED' and clear BILL_OUT_REQUESTED for all group tables
  try {
    await supabase
      .from('Restaurant_Tables')
      .update({
        STATUS: 'OCCUPIED',
        BILL_OUT_REQUESTED: false,
      })
      .in('TABLE_ID', targetIds)
  } catch (err) {
    console.error('[assistanceService] Error resetting table status:', err)
  }

  // 2. Broadcast resolution to all listeners
  try {
    const channel = supabase.channel('table-assistance')
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        void channel.send({
          type: 'broadcast',
          event: 'assistance_resolved',
          payload: {
            tableId,
            tableIds: targetIds,
          },
        }).then(() => {
          setTimeout(() => {
            void supabase.removeChannel(channel)
          }, 1500)
        })
      }
    })
  } catch (err) {
    console.error('[assistanceService] Error broadcasting assistance resolved:', err)
  }

  return targetIds
}
