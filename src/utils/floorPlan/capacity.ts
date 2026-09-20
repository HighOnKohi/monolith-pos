// ─────────────────────────────────────────────────────────────────────────────
// Centralized Authoritative Table Capacity & Distribution Engine
// ─────────────────────────────────────────────────────────────────────────────

import { TABLE_TYPES, type TableType, type TableLayoutInfo } from '@/services/tableLayoutService'
import { calculateTableDistribution } from './distribution'
import { type TablePosition, detectHardCollision } from './collision'

export interface ChairSuppression {
  top: boolean | boolean[]
  bottom: boolean | boolean[]
  left: boolean | boolean[]
  right: boolean | boolean[]
  radial?: boolean[]
  suppressedCount: number
}

/**
 * Returns the unmerged base capacity of a table.
 */
export function calculateTableBaseCapacity(
  _tableNum: number,
  tableType: TableType,
  customCapacity?: number | null,
): number {
  if (customCapacity != null && customCapacity > 0) {
    return Math.round(customCapacity)
  }
  return TABLE_TYPES[tableType]?.defaultCapacity ?? 4
}

/**
 * Calculates chair suppression for all tables in a layout based on physical contact / adjacency.
 */
export function calculateLayoutSuppression(
  tables: TableLayoutInfo[],
): Map<number, ChairSuppression> {
  const map = new Map<number, ChairSuppression>()
  const cellMap = new Map<string, number>()
  const tableByNum = new Map<number, TableLayoutInfo>()

  for (const t of tables) {
    tableByNum.set(t.TABLE_NUM, t)
    const cfg = TABLE_TYPES[t.TABLE_TYPE] || TABLE_TYPES[1]
    for (let dx = 0; dx < cfg.width; dx++) {
      for (let dy = 0; dy < cfg.height; dy++) {
        cellMap.set(`${t.X_POS + dx},${t.Y_POS + dy}`, t.TABLE_NUM)
      }
    }
  }

  for (const t of tables) {
    let suppressedCount = 0

    // Suppress chairs whenever adjacent to ANY other table (clears up touching chairs dynamically)
    const isTouchingAdjacentTable = (neighborTableNum: number | undefined) => {
      if (!neighborTableNum || neighborTableNum === t.TABLE_NUM) return false
      return true
    }

    if (t.TABLE_TYPE === 1 || t.TABLE_TYPE === 3) {
      const topCell = cellMap.get(`${t.X_POS},${t.Y_POS - 1}`)
      const bottomCell = cellMap.get(`${t.X_POS},${t.Y_POS + 1}`)
      const leftCell = cellMap.get(`${t.X_POS - 1},${t.Y_POS}`)
      const rightCell = cellMap.get(`${t.X_POS + 1},${t.Y_POS}`)

      const top = isTouchingAdjacentTable(topCell)
      const bottom = isTouchingAdjacentTable(bottomCell)
      const left = isTouchingAdjacentTable(leftCell)
      const right = isTouchingAdjacentTable(rightCell)

      if (top) suppressedCount++
      if (bottom) suppressedCount++
      if (left) suppressedCount++
      if (right) suppressedCount++

      map.set(t.TABLE_NUM, { top, bottom, left, right, suppressedCount })
    } else if (t.TABLE_TYPE === 2) {
      const topMask = [0, 1, 2].map((dx) => {
        const c = cellMap.get(`${t.X_POS + dx},${t.Y_POS - 1}`)
        return isTouchingAdjacentTable(c)
      })
      const bottomMask = [0, 1, 2].map((dx) => {
        const c = cellMap.get(`${t.X_POS + dx},${t.Y_POS + 1}`)
        return isTouchingAdjacentTable(c)
      })
      const leftCell = cellMap.get(`${t.X_POS - 1},${t.Y_POS}`)
      const rightCell = cellMap.get(`${t.X_POS + 3},${t.Y_POS}`)
      const left = isTouchingAdjacentTable(leftCell)
      const right = isTouchingAdjacentTable(rightCell)

      suppressedCount += topMask.filter(Boolean).length
      suppressedCount += bottomMask.filter(Boolean).length
      if (left) suppressedCount++
      if (right) suppressedCount++

      map.set(t.TABLE_NUM, { top: topMask, bottom: bottomMask, left, right, suppressedCount })
    } else if (t.TABLE_TYPE === 4) {
      const top1 = cellMap.get(`${t.X_POS},${t.Y_POS - 1}`)
      const top2 = cellMap.get(`${t.X_POS + 1},${t.Y_POS - 1}`)
      const topOcc = isTouchingAdjacentTable(top1) || isTouchingAdjacentTable(top2)

      const tr = cellMap.get(`${t.X_POS + 2},${t.Y_POS}`)
      const trOcc = isTouchingAdjacentTable(tr)

      const br = cellMap.get(`${t.X_POS + 2},${t.Y_POS + 1}`)
      const brOcc = isTouchingAdjacentTable(br)

      const bot1 = cellMap.get(`${t.X_POS},${t.Y_POS + 2}`)
      const bot2 = cellMap.get(`${t.X_POS + 1},${t.Y_POS + 2}`)
      const botOcc = isTouchingAdjacentTable(bot1) || isTouchingAdjacentTable(bot2)

      const bl = cellMap.get(`${t.X_POS - 1},${t.Y_POS + 1}`)
      const blOcc = isTouchingAdjacentTable(bl)

      const tl = cellMap.get(`${t.X_POS - 1},${t.Y_POS}`)
      const tlOcc = isTouchingAdjacentTable(tl)

      const radial = [topOcc, trOcc, brOcc, botOcc, blOcc, tlOcc]
      suppressedCount = radial.filter(Boolean).length
      map.set(t.TABLE_NUM, { radial, top: topOcc, bottom: botOcc, left: tlOcc, right: trOcc, suppressedCount })
    } else if (t.TABLE_TYPE === 5) {
      const topCell = cellMap.get(`${t.X_POS},${t.Y_POS - 1}`)
      const bottomCell = cellMap.get(`${t.X_POS},${t.Y_POS + 3}`)
      const top = isTouchingAdjacentTable(topCell)
      const bottom = isTouchingAdjacentTable(bottomCell)

      const leftMask = [0, 1, 2].map((dy) => {
        const c = cellMap.get(`${t.X_POS - 1},${t.Y_POS + dy}`)
        return isTouchingAdjacentTable(c)
      })
      const rightMask = [0, 1, 2].map((dy) => {
        const c = cellMap.get(`${t.X_POS + 1},${t.Y_POS + dy}`)
        return isTouchingAdjacentTable(c)
      })

      if (top) suppressedCount++
      if (bottom) suppressedCount++
      suppressedCount += leftMask.filter(Boolean).length
      suppressedCount += rightMask.filter(Boolean).length

      map.set(t.TABLE_NUM, { top, bottom, left: leftMask as unknown as boolean, right: rightMask as unknown as boolean, suppressedCount })
    }
  }

  return map
}

/**
 * Calculates the effective capacity for an individual table.
 * Preserves the table's base capacity, deducting touching edge seats dynamically.
 */
export function calculateTableEffectiveCapacity(
  table: TableLayoutInfo,
  suppressionMap: Map<number, ChairSuppression>,
  baseCapacities?: Map<number, number>,
): number {
  const baseCap = baseCapacities?.get(table.TABLE_NUM) ?? calculateTableBaseCapacity(table.TABLE_NUM, table.TABLE_TYPE)
  const supp = suppressionMap.get(table.TABLE_NUM)
  const suppCount = supp?.suppressedCount ?? 0
  return Math.max(1, baseCap - suppCount)
}

/**
 * Calculates total effective capacity of a merged group.
 */
export function calculateMergedGroupCapacity(
  groupId: number,
  layout: TableLayoutInfo[],
  suppressionMap: Map<number, ChairSuppression>,
  baseCapacities?: Map<number, number>,
): number {
  const members = layout.filter((t) => t.MERGE_GROUP_ID === groupId)
  return members.reduce((sum, t) => sum + calculateTableEffectiveCapacity(t, suppressionMap, baseCapacities), 0)
}

/**
 * Calculates authoritative total layout capacity across all tables.
 */
export function calculateLayoutCapacity(
  layout: TableLayoutInfo[],
  suppressionMap: Map<number, ChairSuppression>,
  baseCapacities?: Map<number, number>,
): number {
  return layout.reduce((sum, t) => sum + calculateTableEffectiveCapacity(t, suppressionMap, baseCapacities), 0)
}

/**
 * Automatically resolves layout capacity overflow so that total capacity strictly fits within maxPax.
 * Reduces capacities starting with tables with highest capacity down to minimum 1 seat.
 */
export function resolveLayoutCapacityOverflow(
  layout: TableLayoutInfo[],
  suppressionMap: Map<number, ChairSuppression>,
  baseCapacities: Map<number, number>,
  maxPax: number,
): Map<number, number> {
  const resolved = new Map<number, number>()
  for (const t of layout) {
    const base = baseCapacities.get(t.TABLE_NUM) ?? calculateTableBaseCapacity(t.TABLE_NUM, t.TABLE_TYPE)
    resolved.set(t.TABLE_NUM, Math.max(1, base))
  }

  let totalEffective = layout.reduce((sum, t) => {
    const supp = suppressionMap.get(t.TABLE_NUM)?.suppressedCount ?? 0
    const eff = Math.max(1, (resolved.get(t.TABLE_NUM) ?? 4) - supp)
    return sum + eff
  }, 0)

  if (totalEffective <= maxPax) {
    return resolved
  }

  // Iteratively reduce from tables that can be reduced (> 1)
  const sortedTables = [...layout].sort((a, b) => {
    const capA = resolved.get(a.TABLE_NUM) ?? 4
    const capB = resolved.get(b.TABLE_NUM) ?? 4
    return capB - capA
  })

  while (totalEffective > maxPax) {
    let reducedAny = false
    for (const t of sortedTables) {
      if (totalEffective <= maxPax) break
      const currentBase = resolved.get(t.TABLE_NUM)!
      if (currentBase > 1) {
        resolved.set(t.TABLE_NUM, currentBase - 1)
        totalEffective--
        reducedAny = true
      }
    }
    if (!reducedAny) break
  }

  return resolved
}

/**
 * Automatically distributes tables on the grid to match the requested maximum pax.
 * Reuses calculateTableDistribution and places tables in non-overlapping grid coordinates.
 */
export function distributePresetTables(
  maxPax: number,
  gridWidth: number = 20,
  gridHeight: number = 16,
): { layoutTables: TableLayoutInfo[]; baseCapacities: Map<number, number> } {
  const targetPax = Math.max(1, Math.round(maxPax))
  const distribution = calculateTableDistribution(targetPax, [4, 2], targetPax)

  const layoutTables: TableLayoutInfo[] = []
  const baseCapacities = new Map<number, number>()
  const existingPositions: TablePosition[] = []

  let tableNum = 1

  // Place tables in order: 4-tops (Type 1), then 2-tops (Type 1 with cap 2 or Type 3)
  for (const cap of distribution.capacities) {
    // Type 1 is 1x1 square
    const tableType: TableType = cap >= 4 ? 1 : 1
    const width = 1
    const height = 1

    let placedX = -1
    let placedY = -1

    // Scan grid with spacing 1 to avoid accidental auto-merges
    for (let y = 1; y <= gridHeight - height - 1; y += 2) {
      for (let x = 1; x <= gridWidth - width - 1; x += 2) {
        const candidate: TablePosition = { tableId: tableNum, x, y, widthBlocks: width, heightBlocks: height }
        if (!detectHardCollision(candidate, 1, existingPositions)) {
          placedX = x
          placedY = y
          break
        }
      }
      if (placedX !== -1) break
    }

    // Fallback: tight scan if floor is dense
    if (placedX === -1) {
      for (let y = 0; y <= gridHeight - height; y++) {
        for (let x = 0; x <= gridWidth - width; x++) {
          const candidate: TablePosition = { tableId: tableNum, x, y, widthBlocks: width, heightBlocks: height }
          if (!detectHardCollision(candidate, 1, existingPositions)) {
            placedX = x
            placedY = y
            break
          }
        }
        if (placedX !== -1) break
      }
    }

    if (placedX === -1) {
      // Floor completely full
      break
    }

    existingPositions.push({ tableId: tableNum, x: placedX, y: placedY, widthBlocks: width, heightBlocks: height })

    layoutTables.push({
      INFO_ID: `preset-table-${tableNum}-${Date.now()}`,
      LAYOUT_PRESET_ID: 0,
      TABLE_NUM: tableNum,
      MERGE_GROUP_ID: null,
      TABLE_TYPE: tableType,
      X_POS: placedX,
      Y_POS: placedY,
      TABLE_CAPACITY: cap,
    })

    baseCapacities.set(tableNum, cap)
    tableNum++
  }

  return { layoutTables, baseCapacities }
}

/**
 * Resolves capacity when a specific table is moved or unmerged.
 * If the resulting layout capacity exceeds maxPax, deducts from the moved/unmerged table first.
 * If overflow still remains after reducing the moved table to 1 seat, iteratively reduces other tables.
 * Returns both the updated base capacities map and the updated layout with TABLE_CAPACITY set.
 */
export function deductMovedTableOnOverflow(
  movedTableNum: number,
  layout: TableLayoutInfo[],
  suppressionMap: Map<number, ChairSuppression>,
  baseCapacities: Map<number, number>,
  maxPax: number,
): {
  updatedBaseCapacities: Map<number, number>
  updatedLayout: TableLayoutInfo[]
} {
  const newBaseCaps = new Map<number, number>()
  for (const t of layout) {
    const base = baseCapacities.get(t.TABLE_NUM) ?? t.TABLE_CAPACITY ?? calculateTableBaseCapacity(t.TABLE_NUM, t.TABLE_TYPE)
    newBaseCaps.set(t.TABLE_NUM, Math.max(1, base))
  }

  const currentTotal = calculateLayoutCapacity(layout, suppressionMap, newBaseCaps)
  if (currentTotal <= maxPax) {
    return {
      updatedBaseCapacities: newBaseCaps,
      updatedLayout: layout.map((t) => ({
        ...t,
        TABLE_CAPACITY: newBaseCaps.get(t.TABLE_NUM) ?? t.TABLE_CAPACITY,
      })),
    }
  }

  let overflow = currentTotal - maxPax

  // 1. First deduct from the moved/unmerged table
  const movedTableType = layout.find((t) => t.TABLE_NUM === movedTableNum)?.TABLE_TYPE ?? 1
  const movedCap = newBaseCaps.get(movedTableNum) ?? calculateTableBaseCapacity(movedTableNum, movedTableType)
  const maxDeductible = Math.max(0, movedCap - 1)
  const deduction = Math.min(overflow, maxDeductible)

  if (deduction > 0) {
    newBaseCaps.set(movedTableNum, movedCap - deduction)
    overflow -= deduction
  }

  // 2. If overflow still remains, deduct from other tables using resolveLayoutCapacityOverflow
  if (overflow > 0) {
    const finalResolved = resolveLayoutCapacityOverflow(layout, suppressionMap, newBaseCaps, maxPax)
    for (const [num, cap] of finalResolved.entries()) {
      newBaseCaps.set(num, cap)
    }
  }

  const updatedLayout = layout.map((t) => ({
    ...t,
    TABLE_CAPACITY: newBaseCaps.get(t.TABLE_NUM) ?? t.TABLE_CAPACITY,
  }))

  return {
    updatedBaseCapacities: newBaseCaps,
    updatedLayout,
  }
}

