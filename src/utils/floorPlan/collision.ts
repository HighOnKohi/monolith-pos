// ─────────────────────────────────────────────────────────────────────────────
// Collision Detection Utilities
// ─────────────────────────────────────────────────────────────────────────────

export interface TablePosition {
  tableId: number
  x: number  // block coordinate
  y: number  // block coordinate
  widthBlocks?: number
  heightBlocks?: number
  rotation?: number
}

/**
 * Check whether two tables overlap, considering spacing.
 * Uses widthBlocks/heightBlocks when available, defaulting to tableSize.
 */
export function tablesOverlap(
  a: TablePosition,
  b: TablePosition,
  tableSize: number,
  spacing: number = 0,
): boolean {
  const aW = (a.widthBlocks ?? tableSize) + spacing
  const aH = (a.heightBlocks ?? tableSize) + spacing
  const bW = (b.widthBlocks ?? tableSize) + spacing
  const bH = (b.heightBlocks ?? tableSize) + spacing
  return (
    a.x < b.x + bW &&
    a.x + aW > b.x &&
    a.y < b.y + bH &&
    a.y + aH > b.y
  )
}

/**
 * Check if a table at (x, y) collides with any existing table,
 * respecting the minimum spacing requirement.
 */
export function detectCollision(
  pos: TablePosition,
  tableSize: number,
  existingTables: TablePosition[],
  spacing: number = 0,
  excludeId?: number,
  adjacentIds?: Set<number>,
): boolean {
  for (const other of existingTables) {
    if (other.tableId === pos.tableId) continue
    if (excludeId !== undefined && other.tableId === excludeId) continue

    const effectiveSpacing = adjacentIds?.has(other.tableId) ? 0 : spacing

    if (tablesOverlap(pos, other, tableSize, effectiveSpacing)) {
      return true
    }
  }
  return false
}

/**
 * Check if a table at (x, y) has a pure overlap (ignoring spacing) with any other table.
 */
export function detectHardCollision(
  pos: TablePosition,
  tableSize: number,
  existingTables: TablePosition[],
  excludeId?: number,
): boolean {
  for (const other of existingTables) {
    if (other.tableId === pos.tableId) continue
    if (excludeId !== undefined && other.tableId === excludeId) continue
    if (tablesOverlap(pos, other, tableSize, 0)) return true
  }
  return false
}

/**
 * Full placement validation: within floor + no collisions.
 */
export function isValidPlacement(
  x: number,
  y: number,
  tableId: number,
  tableSize: number,
  floorWidth: number,
  floorHeight: number,
  existingTables: TablePosition[],
  _spacing: number = 0,
  widthBlocks?: number,
  heightBlocks?: number,
): boolean {
  const w = widthBlocks ?? tableSize
  const h = heightBlocks ?? tableSize
  // Floor boundary check
  if (x < 0 || y < 0 || x + w > floorWidth || y + h > floorHeight) {
    return false
  }

  // Collision check (hard overlap only)
  return !detectHardCollision({ tableId, x, y, widthBlocks: w, heightBlocks: h }, tableSize, existingTables, tableId)
}

/**
 * Find the nearest valid position for a table, spiraling outward from the desired position.
 */
export function findNearestValidPosition(
  desiredX: number,
  desiredY: number,
  tableId: number,
  tableSize: number,
  floorWidth: number,
  floorHeight: number,
  existingTables: TablePosition[],
  widthBlocks?: number,
  heightBlocks?: number,
): { x: number; y: number } | null {
  // Try the desired position first
  if (isValidPlacement(desiredX, desiredY, tableId, tableSize, floorWidth, floorHeight, existingTables, 0, widthBlocks, heightBlocks)) {
    return { x: desiredX, y: desiredY }
  }

  // Spiral search outward
  for (let radius = 1; radius <= Math.max(floorWidth, floorHeight); radius++) {
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue
        const nx = desiredX + dx
        const ny = desiredY + dy
        if (isValidPlacement(nx, ny, tableId, tableSize, floorWidth, floorHeight, existingTables, 0, widthBlocks, heightBlocks)) {
          return { x: nx, y: ny }
        }
      }
    }
  }

  return null
}

/**
 * Find the first available position on the floor for a new table.
 * Scans row by row, left to right, respecting spacing.
 */
export function findFirstAvailablePosition(
  tableSize: number,
  floorWidth: number,
  floorHeight: number,
  existingTables: TablePosition[],
  spacing: number = 1,
  widthBlocks?: number,
  heightBlocks?: number,
): { x: number; y: number } | null {
  const w = widthBlocks ?? tableSize
  const h = heightBlocks ?? tableSize
  const stepX = Math.max(1, w + spacing)
  const stepY = Math.max(1, h + spacing)
  for (let y = 0; y + h <= floorHeight; y += Math.min(stepY, 2)) {
    for (let x = 0; x + w <= floorWidth; x += Math.min(stepX, 2)) {
      const pos: TablePosition = { tableId: -1, x, y, widthBlocks: w, heightBlocks: h }
      if (!detectHardCollision(pos, tableSize, existingTables)) {
        return { x, y }
      }
    }
  }
  return null
}
