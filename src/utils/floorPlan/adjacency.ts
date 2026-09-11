// ─────────────────────────────────────────────────────────────────────────────
// Adjacency Detection for Automatic Table Merging
// ─────────────────────────────────────────────────────────────────────────────

import type { TablePosition } from './collision'

/**
 * Two tables are directly adjacent when they share a full edge
 * (horizontally or vertically) with zero gap between their footprints.
 * Diagonal neighbors do NOT count.
 */
export function isDirectlyAdjacent(
  a: TablePosition,
  b: TablePosition,
  tableSize: number,
): boolean {
  const aW = a.widthBlocks ?? tableSize
  const aH = a.heightBlocks ?? tableSize
  const bW = b.widthBlocks ?? tableSize
  const bH = b.heightBlocks ?? tableSize

  // Horizontal contact: touching along vertical seam with overlapping Y intervals
  const hAdj =
    (a.x + aW === b.x || b.x + bW === a.x) &&
    Math.max(a.y, b.y) < Math.min(a.y + aH, b.y + bH)

  // Vertical contact: touching along horizontal seam with overlapping X intervals
  const vAdj =
    (a.y + aH === b.y || b.y + bH === a.y) &&
    Math.max(a.x, b.x) < Math.min(a.x + aW, b.x + bW)

  return hAdj || vAdj
}

/**
 * Find all tables directly adjacent to a given table.
 */
export function findAdjacentTables(
  target: TablePosition,
  allTables: TablePosition[],
  tableSize: number,
): TablePosition[] {
  return allTables.filter(
    (t) => t.tableId !== target.tableId && isDirectlyAdjacent(target, t, tableSize),
  )
}

export interface MergeGroup {
  /** The anchor table ID (lowest TABLE_NUM in the group for consistency) */
  anchorId: number
  /** All table IDs in this merge group */
  memberIds: number[]
}

/**
 * Calculate all merge groups from table positions using flood-fill.
 * A merge group is a connected component of directly adjacent tables.
 * Single tables with no adjacent neighbors are NOT included in the result.
 */
export function calculateMergeGroups(
  allTables: TablePosition[],
  tableSize: number,
): MergeGroup[] {
  const visited = new Set<number>()
  const groups: MergeGroup[] = []

  for (const table of allTables) {
    if (visited.has(table.tableId)) continue

    // BFS/flood-fill to find all connected tables
    const component: number[] = []
    const queue = [table]

    while (queue.length > 0) {
      const current = queue.shift()!
      if (visited.has(current.tableId)) continue
      visited.add(current.tableId)
      component.push(current.tableId)

      const neighbors = findAdjacentTables(current, allTables, tableSize)
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor.tableId)) {
          queue.push(neighbor)
        }
      }
    }

    // Only include groups with 2+ tables
    if (component.length >= 2) {
      // Use the smallest tableId as anchor for consistency
      const anchorId = Math.min(...component)
      groups.push({
        anchorId,
        memberIds: component.sort((a, b) => a - b),
      })
    }
  }

  return groups
}

/**
 * Check if dragging table `dragId` to position (x, y) would create
 * an adjacency with any other table. Returns the IDs of tables that
 * would become adjacent.
 */
export function previewAdjacency(
  dragId: number,
  x: number,
  y: number,
  allTables: TablePosition[],
  tableSize: number,
): number[] {
  const dragPos: TablePosition = { tableId: dragId, x, y }
  const adjacent = findAdjacentTables(dragPos, allTables, tableSize)
  return adjacent.map((t) => t.tableId)
}

/**
 * Given a set of merge groups and a table ID, find which group it belongs to.
 */
export function findGroupForTable(
  tableId: number,
  groups: MergeGroup[],
): MergeGroup | null {
  return groups.find((g) => g.memberIds.includes(tableId)) ?? null
}

// ─────────────────────────────────────────────────────────────────────────────
// Perimeter Seats & Merged-Side Deductions
// ─────────────────────────────────────────────────────────────────────────────

export type TableSide = 'top' | 'bottom' | 'left' | 'right'

export interface MergedSides {
  top: boolean
  bottom: boolean
  left: boolean
  right: boolean
}

export interface SeatInfo {
  id: string
  side: TableSide
  index: number
  totalOnSide: number
}

/**
 * Maximum seats allowed: strictly 1 seat per side for every 2 blocks of edge length.
 * Formula: 2 * (floor(w / 2) + floor(h / 2))
 */
export function getMaxSeatsForDimensions(widthBlocks: number, heightBlocks: number): number {
  const maxTop = Math.floor(widthBlocks / 2)
  const maxLeft = Math.floor(heightBlocks / 2)
  return 2 * (maxTop + maxLeft)
}

/**
 * Distribute seats across table sides (top, bottom, left, right).
 * Prioritizes balanced opposing seats and longer edges, capped at 1 seat per 2 blocks on each side.
 * Supports rotation (e.g. 2-pax tables rotate seats between Top/Bottom and Left/Right).
 */
export function distributeSeatsToSides(
  seats: number,
  widthBlocks: number = 2,
  heightBlocks: number = 2,
  rotation: number = 0,
): Record<TableSide, number> {
  const maxTop = Math.max(1, Math.floor(widthBlocks / 2))
  const maxBottom = Math.max(1, Math.floor(widthBlocks / 2))
  const maxLeft = Math.max(1, Math.floor(heightBlocks / 2))
  const maxRight = Math.max(1, Math.floor(heightBlocks / 2))

  const sideCounts: Record<TableSide, number> = {
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  }

  const normRot = ((rotation % 360) + 360) % 360

  // If table is 2x2 standard (or any square table where width === height):
  if (widthBlocks <= 2 && heightBlocks <= 2) {
    if (seats <= 1) {
      if (normRot === 90) sideCounts.right = seats
      else if (normRot === 180) sideCounts.bottom = seats
      else if (normRot === 270) sideCounts.left = seats
      else sideCounts.top = seats
    } else if (seats === 2) {
      // 2-pax table:
      // At 0° or 180°: Top & Bottom
      // At 90° or 270°: Left & Right
      if (normRot === 90 || normRot === 270) {
        sideCounts.left = 1
        sideCounts.right = 1
      } else {
        sideCounts.top = 1
        sideCounts.bottom = 1
      }
    } else if (seats === 3) {
      if (normRot === 90) {
        sideCounts.right = 1
        sideCounts.left = 1
        sideCounts.top = 1
      } else if (normRot === 180) {
        sideCounts.bottom = 1
        sideCounts.top = 1
        sideCounts.right = 1
      } else if (normRot === 270) {
        sideCounts.left = 1
        sideCounts.right = 1
        sideCounts.bottom = 1
      } else {
        sideCounts.top = 1
        sideCounts.bottom = 1
        sideCounts.left = 1
      }
    } else {
      sideCounts.top = 1
      sideCounts.bottom = 1
      sideCounts.left = 1
      sideCounts.right = 1
    }
    return sideCounts
  }

  // Preference order: prioritize wider edges first
  const order: TableSide[] = widthBlocks >= heightBlocks
    ? ['top', 'bottom', 'left', 'right']
    : ['left', 'right', 'top', 'bottom']

  const maxSides: Record<TableSide, number> = {
    top: maxTop,
    bottom: maxBottom,
    left: maxLeft,
    right: maxRight,
  }

  let remaining = seats
  while (remaining > 0) {
    let allocated = false
    for (const side of order) {
      if (remaining > 0 && sideCounts[side] < maxSides[side]) {
        sideCounts[side]++
        remaining--
        allocated = true
      }
    }
    if (!allocated) break
  }

  return sideCounts
}

/**
 * Detect which sides of a table are touching another table in its merge group
 * (or any directly adjacent table if no mergeGroups filter is given).
 */
export function getTableMergedSides(
  tableId: number,
  allPositions: TablePosition[],
  tableSizeBlocks: number,
  mergeGroups?: MergeGroup[],
): MergedSides {
  const current = allPositions.find((p) => p.tableId === tableId)
  if (!current) {
    return { top: false, bottom: false, left: false, right: false }
  }

  let allowedNeighborIds: Set<number> | null = null
  if (mergeGroups) {
    const group = findGroupForTable(tableId, mergeGroups)
    if (!group || group.memberIds.length <= 1) {
      return { top: false, bottom: false, left: false, right: false }
    }
    allowedNeighborIds = new Set(group.memberIds.filter((id) => id !== tableId))
  }

  const result: MergedSides = { top: false, bottom: false, left: false, right: false }
  const cW = current.widthBlocks ?? tableSizeBlocks
  const cH = current.heightBlocks ?? tableSizeBlocks

  for (const other of allPositions) {
    if (other.tableId === tableId) continue
    if (allowedNeighborIds && !allowedNeighborIds.has(other.tableId)) continue

    const oW = other.widthBlocks ?? tableSizeBlocks
    const oH = other.heightBlocks ?? tableSizeBlocks

    // Other is directly above current
    if (other.y + oH === current.y && Math.max(current.x, other.x) < Math.min(current.x + cW, other.x + oW)) {
      result.top = true
    }
    // Other is directly below current
    if (current.y + cH === other.y && Math.max(current.x, other.x) < Math.min(current.x + cW, other.x + oW)) {
      result.bottom = true
    }
    // Other is directly to the left of current
    if (other.x + oW === current.x && Math.max(current.y, other.y) < Math.min(current.y + cH, other.y + oH)) {
      result.left = true
    }
    // Other is directly to the right of current
    if (current.x + cW === other.x && Math.max(current.y, other.y) < Math.min(current.y + cH, other.y + oH)) {
      result.right = true
    }
  }

  return result
}

/**
 * Calculate the visible seats and effective capacity for a table.
 * Any side that is merged with an adjacent table deducts its seats.
 */
export function getTableSeatsConfig(
  baseCapacity: number,
  mergedSides: MergedSides,
  widthBlocks: number = 2,
  heightBlocks: number = 2,
  rotation: number = 0,
): { visibleSeats: SeatInfo[]; effectiveCapacity: number } {
  const sideCounts = distributeSeatsToSides(baseCapacity, widthBlocks, heightBlocks, rotation)
  const visibleSeats: SeatInfo[] = []
  const sides: TableSide[] = ['top', 'bottom', 'left', 'right']

  for (const side of sides) {
    if (mergedSides[side]) continue

    const count = sideCounts[side]
    for (let i = 0; i < count; i++) {
      visibleSeats.push({
        id: `${side}-${i}`,
        side,
        index: i,
        totalOnSide: count,
      })
    }
  }

  return {
    visibleSeats,
    effectiveCapacity: visibleSeats.length,
  }
}

export function calculateEffectiveCapacity(
  table: { TABLE_ID: number; GUEST_CAPACITY: number },
  allPositions: TablePosition[],
  tableSizeBlocks: number,
  mergeGroups?: MergeGroup[],
): number {
  const pos = allPositions.find((p) => p.tableId === table.TABLE_ID)
  const mergedSides = getTableMergedSides(table.TABLE_ID, allPositions, tableSizeBlocks, mergeGroups)
  return getTableSeatsConfig(
    table.GUEST_CAPACITY,
    mergedSides,
    pos?.widthBlocks ?? tableSizeBlocks,
    pos?.heightBlocks ?? tableSizeBlocks,
    pos?.rotation ?? 0,
  ).effectiveCapacity
}

export function calculateGroupCombinedCapacity(
  group: MergeGroup,
  tables: Array<{ TABLE_ID: number; GUEST_CAPACITY: number }>,
  allPositions: TablePosition[],
  tableSizeBlocks: number,
): number {
  return group.memberIds.reduce((sum, id) => {
    const table = tables.find((t) => t.TABLE_ID === id)
    if (!table) return sum
    return sum + calculateEffectiveCapacity(table, allPositions, tableSizeBlocks, [group])
  }, 0)
}

/**
 * Disburse available seating budget across unmerging tables when floor capacity is full.
 * Example: 2 tables unmerged with budget 6 => 1x 4-pax, 1x 2-pax.
 * Example: 3 tables unmerged with budget 6 => 3x 2-pax.
 */
export function disburseCapacities(
  tablesToDisburse: Array<{ TABLE_ID: number; GUEST_CAPACITY: number }>,
  budget: number,
): Array<{ tableId: number; newCapacity: number }> {
  const count = tablesToDisburse.length
  if (count === 0) return []

  const minPerTable = budget >= count * 2 ? 2 : 1
  let remaining = budget
  const allocations = new Array(count).fill(minPerTable)
  remaining -= minPerTable * count

  // First allocate surplus to bring tables up to 4
  for (let i = 0; i < count && remaining >= 2; i++) {
    const spaceTo4 = 4 - allocations[i]
    if (spaceTo4 > 0 && remaining >= spaceTo4) {
      allocations[i] += spaceTo4
      remaining -= spaceTo4
    }
  }

  // Allocate any remaining odd/fractional pax
  for (let i = 0; i < count && remaining > 0; i++) {
    allocations[i]++
    remaining--
  }

  return tablesToDisburse.map((t, i) => ({
    tableId: t.TABLE_ID,
    newCapacity: allocations[i],
  }))
}
