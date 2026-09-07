import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { TableData, TableStatus } from '@/services/tableService'

export interface TableGroupInfo {
  groupId: number               // Canonical identifier (anchorTableId)
  anchorTableId: number         // Primary table ID
  anchorTableNum: number        // Primary table display number
  memberTableIds: number[]      // All member table IDs (e.g. [1, 2])
  memberTableNums: number[]     // All member table numbers (e.g. [1, 2])
  displayLabel: string          // "Table 1 + Table 2" or "Table 1"
  shortDisplayLabel: string     // "T1+2" or "T1"
  isMerged: boolean             // true if memberTableIds.length > 1
  capacity: number              // Combined capacity
  currentGuestCount: number     // Combined seated pax
  status: TableStatus           // Aggregated status
  billOutRequested: boolean     // Any member has bill out requested
}

/**
 * Builds a TableGroupInfo object from a resolved set of member tables.
 */
function buildGroupInfoFromMembers(
  anchorTable: TableData,
  allMembers: TableData[],
): TableGroupInfo {
  // Sort members by TABLE_NUM ascending
  const sortedMembers = [...allMembers].sort(
    (a, b) => (a.TABLE_NUM || a.TABLE_ID) - (b.TABLE_NUM || b.TABLE_ID),
  )

  const memberTableIds = sortedMembers.map((m) => m.TABLE_ID)
  const memberTableNums = sortedMembers.map((m) => m.TABLE_NUM || m.TABLE_ID)
  const isMerged = sortedMembers.length > 1

  const displayLabel = isMerged
    ? sortedMembers.map((m) => `Table ${m.TABLE_NUM || m.TABLE_ID}`).join(' + ')
    : `Table ${anchorTable.TABLE_NUM || anchorTable.TABLE_ID}`

  const shortDisplayLabel = isMerged
    ? `T${sortedMembers.map((m) => m.TABLE_NUM || m.TABLE_ID).join('+')}`
    : `T${anchorTable.TABLE_NUM || anchorTable.TABLE_ID}`

  const capacity = isMerged
    ? (anchorTable.GUEST_CAPACITY || sortedMembers.reduce((sum, m) => sum + (m.GUEST_CAPACITY || 0), 0))
    : anchorTable.GUEST_CAPACITY
  const currentGuestCount = sortedMembers.reduce(
    (sum, m) => sum + (m.CURRENT_GUEST_COUNT || 0),
    0,
  )
  const billOutRequested = sortedMembers.some((m) => Boolean(m.BILL_OUT_REQUESTED))

  // Aggregate status
  let status: TableStatus = 'AVAILABLE'
  if (sortedMembers.some((m) => m.STATUS === 'HAS_REQUEST')) {
    status = 'HAS_REQUEST'
  } else if (sortedMembers.some((m) => m.STATUS === 'OCCUPIED') || currentGuestCount > 0) {
    status = 'OCCUPIED'
  } else if (sortedMembers.some((m) => m.STATUS === 'RESERVED')) {
    status = 'RESERVED'
  } else if (sortedMembers.every((m) => m.STATUS === 'UNAVAILABLE')) {
    status = 'UNAVAILABLE'
  }

  return {
    groupId: anchorTable.TABLE_ID,
    anchorTableId: anchorTable.TABLE_ID,
    anchorTableNum: anchorTable.TABLE_NUM || anchorTable.TABLE_ID,
    memberTableIds,
    memberTableNums,
    displayLabel,
    shortDisplayLabel,
    isMerged,
    capacity,
    currentGuestCount,
    status,
    billOutRequested,
  }
}

/**
 * Fast synchronous resolver when all table records are already in memory.
 * Ideal for Cashier, Table Manager, and Kitchen pages.
 */
export function resolveTableGroupByList(
  targetTableId: number,
  allTables: TableData[],
): TableGroupInfo {
  const target = allTables.find((t) => t.TABLE_ID === targetTableId)
  if (!target) {
    return {
      groupId: targetTableId,
      anchorTableId: targetTableId,
      anchorTableNum: targetTableId,
      memberTableIds: [targetTableId],
      memberTableNums: [targetTableId],
      displayLabel: `Table ${targetTableId}`,
      shortDisplayLabel: `T${targetTableId}`,
      isMerged: false,
      capacity: 4,
      currentGuestCount: 0,
      status: 'AVAILABLE',
      billOutRequested: false,
    }
  }

  if (target.MERGE_GROUP_ID !== null && target.MERGE_GROUP_ID !== undefined) {
    // Secondary member: resolve anchor
    const anchor = allTables.find((t) => t.TABLE_ID === target.MERGE_GROUP_ID) ?? target
    const secondaries = allTables.filter((t) => t.MERGE_GROUP_ID === anchor.TABLE_ID)
    const membersMap = new Map<number, TableData>()
    membersMap.set(anchor.TABLE_ID, anchor)
    secondaries.forEach((s) => membersMap.set(s.TABLE_ID, s))
    return buildGroupInfoFromMembers(anchor, Array.from(membersMap.values()))
  }

  // Check if target is an anchor with secondaries pointing to it
  const secondaries = allTables.filter((t) => t.MERGE_GROUP_ID === target.TABLE_ID)
  if (secondaries.length > 0) {
    const membersMap = new Map<number, TableData>()
    membersMap.set(target.TABLE_ID, target)
    secondaries.forEach((s) => membersMap.set(s.TABLE_ID, s))
    return buildGroupInfoFromMembers(target, Array.from(membersMap.values()))
  }

  // Standalone table
  return buildGroupInfoFromMembers(target, [target])
}

/**
 * Asynchronous resolver that queries Supabase to resolve a table's complete merge group.
 * Ideal for Customer interface entry point and external hooks.
 */
export async function resolveTableGroup(targetTableId: number): Promise<TableGroupInfo> {
  const { data: targetData, error: targetErr } = await supabase
    .from('Restaurant_Tables')
    .select('*')
    .eq('TABLE_ID', targetTableId)
    .maybeSingle()

  if (targetErr || !targetData) {
    return {
      groupId: targetTableId,
      anchorTableId: targetTableId,
      anchorTableNum: targetTableId,
      memberTableIds: [targetTableId],
      memberTableNums: [targetTableId],
      displayLabel: `Table ${targetTableId}`,
      shortDisplayLabel: `T${targetTableId}`,
      isMerged: false,
      capacity: 4,
      currentGuestCount: 0,
      status: 'AVAILABLE',
      billOutRequested: false,
    }
  }

  const target = targetData as TableData

  // Case 1: Target is a secondary table pointing to an anchor
  if (target.MERGE_GROUP_ID !== null && target.MERGE_GROUP_ID !== undefined) {
    const anchorId = target.MERGE_GROUP_ID
    const { data: membersData } = await supabase
      .from('Restaurant_Tables')
      .select('*')
      .or(`TABLE_ID.eq.${anchorId},MERGE_GROUP_ID.eq.${anchorId}`)
      .order('TABLE_NUM')

    const members = (membersData as TableData[]) ?? [target]
    const anchor = members.find((m) => m.TABLE_ID === anchorId) ?? target
    return buildGroupInfoFromMembers(anchor, members)
  }

  // Case 2: Target may be the anchor for secondaries
  const { data: secondariesData } = await supabase
    .from('Restaurant_Tables')
    .select('*')
    .eq('MERGE_GROUP_ID', target.TABLE_ID)
    .order('TABLE_NUM')

  const secondaries = (secondariesData as TableData[]) ?? []
  if (secondaries.length > 0) {
    return buildGroupInfoFromMembers(target, [target, ...secondaries])
  }

  // Case 3: Standalone unmerged table
  return buildGroupInfoFromMembers(target, [target])
}

/**
 * React hook to resolve and continuously sync a table's group state.
 * Subscribes to Realtime updates on Restaurant_Tables so merges/unmerges
 * automatically update the group state in real time.
 */
export function useTableGroup(tableId: number | null) {
  const [groupInfo, setGroupInfo] = useState<TableGroupInfo | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const isMountedRef = useRef(true)

  const loadGroup = useCallback(async () => {
    if (!tableId) {
      setGroupInfo(null)
      setIsLoading(false)
      return
    }

    try {
      const resolved = await resolveTableGroup(tableId)
      if (isMountedRef.current) {
        setGroupInfo((prev) => {
          if (
            prev &&
            prev.groupId === resolved.groupId &&
            prev.anchorTableId === resolved.anchorTableId &&
            prev.isMerged === resolved.isMerged &&
            prev.displayLabel === resolved.displayLabel &&
            prev.memberTableIds.join(',') === resolved.memberTableIds.join(',') &&
            prev.status === resolved.status &&
            prev.billOutRequested === resolved.billOutRequested &&
            prev.capacity === resolved.capacity &&
            prev.currentGuestCount === resolved.currentGuestCount
          ) {
            return prev
          }
          return resolved
        })
      }
    } catch (err) {
      console.error('[useTableGroup] Failed to resolve table group:', err)
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false)
      }
    }
  }, [tableId])

  useEffect(() => {
    isMountedRef.current = true
    loadGroup()

    if (!tableId) return

    // Realtime subscription for changes to Restaurant_Tables
    const channel = supabase
      .channel(`table-group-sync-${tableId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'Restaurant_Tables' },
        () => {
          loadGroup()
        },
      )
      .subscribe()

    // Background poll every 8 seconds as safety net
    const pollInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadGroup()
      }
    }, 8000)

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        loadGroup()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      isMountedRef.current = false
      clearInterval(pollInterval)
      document.removeEventListener('visibilitychange', handleVisibility)
      supabase.removeChannel(channel)
    }
  }, [tableId, loadGroup])

  return {
    groupInfo,
    isLoading,
    reload: loadGroup,
  }
}
