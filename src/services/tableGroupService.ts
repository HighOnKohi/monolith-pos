import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { TableData, TableStatus } from '@/services/tableService'
import { fetchActiveLabels, type TableLabel } from '@/services/tableLabelService'

export interface TableGroupInfo {
  groupId: number               // Canonical identifier (anchorTableId)
  anchorTableId: number         // Primary table ID
  anchorTableNum: number        // Primary table display number
  memberTableIds: number[]      // All member table IDs (e.g. [1, 2])
  memberTableNums: number[]     // All member table numbers (e.g. [1, 2])
  displayLabel: string          // "Table 1" (primary table)
  shortDisplayLabel: string     // "T1" (primary table)
  isMerged: boolean             // true if memberTableIds.length > 1
  capacity: number              // Combined capacity
  currentGuestCount: number     // Combined seated pax
  status: TableStatus           // Aggregated status
  billOutRequested: boolean     // Any member has bill out requested
  labelId: number | null        // Effective label ID (highest-priority among group members)
  labelName?: string | null
  labelColor?: string | null
  labelPriority?: number | null
}

/**
 * Builds a TableGroupInfo object from a resolved set of member tables.
 */
function buildGroupInfoFromMembers(
  anchorTable: TableData,
  allMembers: TableData[],
  labelsMap?: Map<number, TableLabel> | TableLabel[],
): TableGroupInfo {
  // Sort members by TABLE_NUM ascending
  const sortedMembers = [...allMembers].sort(
    (a, b) => (a.TABLE_NUM || a.TABLE_ID) - (b.TABLE_NUM || b.TABLE_ID),
  )

  const memberTableIds = sortedMembers.map((m) => m.TABLE_ID)
  const memberTableNums = sortedMembers.map((m) => m.TABLE_NUM || m.TABLE_ID)
  const isMerged = sortedMembers.length > 1

  const displayLabel = isMerged
    ? `Table #${anchorTable.TABLE_NUM || anchorTable.TABLE_ID}+`
    : `Table #${anchorTable.TABLE_NUM || anchorTable.TABLE_ID}`
  const shortDisplayLabel = isMerged
    ? `T${anchorTable.TABLE_NUM || anchorTable.TABLE_ID}+`
    : `T${anchorTable.TABLE_NUM || anchorTable.TABLE_ID}`

  const capacity = isMerged
    ? sortedMembers.reduce((sum, m) => sum + (m.GUEST_CAPACITY || 0), 0)
    : anchorTable.GUEST_CAPACITY
  const currentGuestCount = isMerged
    ? Math.max(...sortedMembers.map((m) => m.CURRENT_GUEST_COUNT || 0), 0)
    : (anchorTable.CURRENT_GUEST_COUNT || 0)
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

  // Resolve effective label: use highest priority label among members if labels map provided
  let effectiveLabelId: number | null = null
  let effectiveLabel: TableLabel | null = null

  if (labelsMap) {
    const lMap =
      labelsMap instanceof Map
        ? labelsMap
        : new Map(labelsMap.map((l) => [l.LABEL_ID, l]))

    let bestPriority = Infinity
    for (const m of sortedMembers) {
      if (m.LABEL_ID != null) {
        const lid = Number(m.LABEL_ID)
        const lbl = lMap.get(lid)
        if (lbl) {
          if (lbl.PRIORITY < bestPriority) {
            bestPriority = lbl.PRIORITY
            effectiveLabelId = lbl.LABEL_ID
            effectiveLabel = lbl
          }
        } else if (effectiveLabelId === null) {
          effectiveLabelId = lid
        }
      }
    }
  } else {
    for (const m of sortedMembers) {
      const lid = m.LABEL_ID
      if (lid != null) {
        effectiveLabelId = Number(lid)
        break
      }
    }
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
    labelId: effectiveLabelId,
    labelName: effectiveLabel?.NAME ?? null,
    labelColor: effectiveLabel?.COLOR ?? null,
    labelPriority: effectiveLabel?.PRIORITY ?? null,
  }
}

/**
 * Fast synchronous resolver when all table records are already in memory.
 * Ideal for Cashier, Table Manager, and Kitchen pages.
 */
export function resolveTableGroupByList(
  targetTableId: number,
  allTables: TableData[],
  labelsMap?: Map<number, TableLabel> | TableLabel[],
): TableGroupInfo {
  const target = allTables.find((t) => t.TABLE_ID === targetTableId || t.TABLE_NUM === targetTableId)
  if (!target) {
    return {
      groupId: targetTableId,
      anchorTableId: targetTableId,
      anchorTableNum: targetTableId,
      memberTableIds: [targetTableId],
      memberTableNums: [targetTableId],
      displayLabel: `Table #${targetTableId}`,
      shortDisplayLabel: `T${targetTableId}`,
      isMerged: false,
      capacity: 4,
      currentGuestCount: 0,
      status: 'AVAILABLE',
      billOutRequested: false,
      labelId: null,
      labelName: null,
      labelColor: null,
      labelPriority: null,
    }
  }

  // 1. Identify primary anchor table
  let anchor: TableData = target
  if (target.MERGE_GROUP_ID != null) {
    const foundAnchor = allTables.find(
      (t) => t.TABLE_ID === target.MERGE_GROUP_ID || t.TABLE_NUM === target.MERGE_GROUP_ID,
    )
    if (foundAnchor) {
      anchor = foundAnchor
    }
  }

  // 2. Collect all members belonging to this anchor group:
  // - The anchor table itself
  // - Any table pointing to the anchor via MERGE_GROUP_ID (by TABLE_ID or TABLE_NUM)
  const membersMap = new Map<number, TableData>()
  membersMap.set(anchor.TABLE_ID, anchor)

  allTables.forEach((t) => {
    if (
      t.TABLE_ID === anchor.TABLE_ID ||
      t.TABLE_NUM === anchor.TABLE_NUM ||
      t.MERGE_GROUP_ID === anchor.TABLE_ID ||
      t.MERGE_GROUP_ID === anchor.TABLE_NUM
    ) {
      membersMap.set(t.TABLE_ID, t)
    }
  })

  // Ensure target itself is in the members map
  membersMap.set(target.TABLE_ID, target)

  const members = Array.from(membersMap.values())
  return buildGroupInfoFromMembers(anchor, members, labelsMap)
}

/**
 * Asynchronous resolver that queries Supabase to resolve a table's complete merge group.
 * Ideal for Customer interface entry point and external hooks.
 */
export async function resolveTableGroup(targetTableId: number): Promise<TableGroupInfo> {
  const [{ data: allTablesData, error: allErr }, activeLabels] = await Promise.all([
    supabase
      .schema('tables')
      .from('Restaurant_Tables')
      .select('*')
      .order('TABLE_NUM'),
    fetchActiveLabels().catch(() => []),
  ])

  if (allErr || !allTablesData || allTablesData.length === 0) {
    return {
      groupId: targetTableId,
      anchorTableId: targetTableId,
      anchorTableNum: targetTableId,
      memberTableIds: [targetTableId],
      memberTableNums: [targetTableId],
      displayLabel: `Table #${targetTableId}`,
      shortDisplayLabel: `T${targetTableId}`,
      isMerged: false,
      capacity: 4,
      currentGuestCount: 0,
      status: 'AVAILABLE',
      billOutRequested: false,
      labelId: null,
      labelName: null,
      labelColor: null,
      labelPriority: null,
    }
  }

  return resolveTableGroupByList(targetTableId, allTablesData as TableData[], activeLabels)
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
        { event: '*', schema: 'tables', table: 'Restaurant_Tables' },
        () => {
          loadGroup()
        },
      )
      .subscribe()

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        loadGroup()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      isMountedRef.current = false
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

export interface AutoAssignTableResult {
  table: TableData
  groupInfo: TableGroupInfo
  capacity: number
  isExactOrBetter: boolean
  isMerged: boolean
}

/**
 * Automatically finds the best available table or merged group for the requested party size (pax).
 * Prioritizes available tables/groups with capacity >= paxSize, choosing the closest
 * capacity match (smallest fitting capacity) to optimize restaurant seating efficiency,
 * breaking ties by lowest table number.
 * If no single table or group can fit the full pax size, falls back to the largest
 * available table/group.
 */
export function findBestTableForPax(
  allTables: TableData[],
  paxSize: number,
  currentTableId?: number | null,
  options?: { excludeMerged?: boolean },
): AutoAssignTableResult | null {
  if (allTables.length === 0 || paxSize <= 0) return null

  const processedAnchorIds = new Set<number>()
  const candidates: Array<{
    anchorTable: TableData
    groupInfo: TableGroupInfo
    capacity: number
    isMerged: boolean
  }> = []

  for (const table of allTables) {
    const groupInfo = resolveTableGroupByList(table.TABLE_ID, allTables)
    if (processedAnchorIds.has(groupInfo.anchorTableId)) continue
    processedAnchorIds.add(groupInfo.anchorTableId)

    // Optionally exclude any merged group
    if (options?.excludeMerged && groupInfo.isMerged) continue

    // Check availability: group is AVAILABLE, or this group contains currentTableId
    const isCurrentlyHeld =
      currentTableId != null && groupInfo.memberTableIds.includes(currentTableId)
    const isAvailable = groupInfo.status === 'AVAILABLE' || isCurrentlyHeld

    if (!isAvailable) continue

    const anchor = allTables.find((t) => t.TABLE_ID === groupInfo.anchorTableId) || table
    candidates.push({
      anchorTable: anchor,
      groupInfo,
      capacity: groupInfo.capacity,
      isMerged: groupInfo.isMerged,
    })
  }

  if (candidates.length === 0) return null

  // Candidates with capacity >= paxSize
  const fitting = candidates.filter((c) => c.capacity >= paxSize)

  if (fitting.length === 0) {
    return null
  }

  fitting.sort((a, b) => {
    const capDiff = a.capacity - b.capacity
    if (capDiff !== 0) return capDiff
    return (
      (a.anchorTable.TABLE_NUM || a.anchorTable.TABLE_ID) -
      (b.anchorTable.TABLE_NUM || b.anchorTable.TABLE_ID)
    )
  })

  return {
    table: fitting[0].anchorTable,
    groupInfo: fitting[0].groupInfo,
    capacity: fitting[0].capacity,
    isExactOrBetter: true,
    isMerged: fitting[0].isMerged,
  }
}

/**
 * Calculates the maximum seating capacity among all currently available tables/groups.
 */
export function getMaxAvailableTableCapacity(
  allTables: TableData[],
  currentTableId?: number | null,
  options?: { excludeMerged?: boolean },
): number {
  if (allTables.length === 0) return 0
  const processedAnchorIds = new Set<number>()
  let maxCap = 0

  for (const table of allTables) {
    const groupInfo = resolveTableGroupByList(table.TABLE_ID, allTables)
    if (processedAnchorIds.has(groupInfo.anchorTableId)) continue
    processedAnchorIds.add(groupInfo.anchorTableId)

    // Optionally exclude any merged group
    if (options?.excludeMerged && groupInfo.isMerged) continue

    const isCurrentlyHeld =
      currentTableId != null && groupInfo.memberTableIds.includes(currentTableId)
    const isAvailable = groupInfo.status === 'AVAILABLE' || isCurrentlyHeld

    if (isAvailable && groupInfo.capacity > maxCap) {
      maxCap = groupInfo.capacity
    }
  }

  return maxCap
}

