// ─────────────────────────────────────────────────────────────────────────────
// Layout Serialization / Deserialization
// ─────────────────────────────────────────────────────────────────────────────

import type { FloorConfig } from './grid'
import type { TablePosition } from './collision'
import type { MergeGroup } from './adjacency'

export interface SerializedLayout {
  floor: {
    widthBlocks: number
    heightBlocks: number
    tableSizeBlocks: number
    spacingBlocks: number
    snapEnabled: boolean
  }
  tables: Array<{
    tableId: number
    x: number
    y: number
  }>
  mergeGroups: Array<{
    anchorId: number
    memberIds: number[]
  }>
}

/**
 * Serialize the current floor plan state into a JSON-compatible object.
 * All values are in logical block coordinates.
 */
export function serializeLayout(
  config: FloorConfig,
  positions: TablePosition[],
  mergeGroups: MergeGroup[],
): SerializedLayout {
  return {
    floor: {
      widthBlocks: config.widthBlocks,
      heightBlocks: config.heightBlocks,
      tableSizeBlocks: config.tableSizeBlocks,
      spacingBlocks: config.spacingBlocks,
      snapEnabled: config.snapEnabled,
    },
    tables: positions.map((p) => ({
      tableId: p.tableId,
      x: p.x,
      y: p.y,
    })),
    mergeGroups: mergeGroups.map((g) => ({
      anchorId: g.anchorId,
      memberIds: [...g.memberIds],
    })),
  }
}

/**
 * Deserialize a stored layout, resolving table positions against the
 * current set of existing table IDs.
 *
 * Tables referenced in the layout but missing from `existingTableIds`
 * are skipped (the table may have been deleted since the layout was saved).
 */
export function deserializeLayout(
  data: SerializedLayout,
  existingTableIds: Set<number>,
): {
  config: FloorConfig
  positions: TablePosition[]
  mergeGroups: MergeGroup[]
} {
  const config: FloorConfig = {
    widthBlocks: data.floor.widthBlocks,
    heightBlocks: data.floor.heightBlocks,
    tableSizeBlocks: data.floor.tableSizeBlocks,
    spacingBlocks: data.floor.spacingBlocks,
    snapEnabled: data.floor.snapEnabled,
  }

  const positions: TablePosition[] = data.tables
    .filter((t) => existingTableIds.has(t.tableId))
    .map((t) => ({ tableId: t.tableId, x: t.x, y: t.y }))

  const mergeGroups: MergeGroup[] = data.mergeGroups
    .map((g) => ({
      anchorId: g.anchorId,
      memberIds: g.memberIds.filter((id) => existingTableIds.has(id)),
    }))
    .filter((g) => g.memberIds.length >= 2)

  return { config, positions, mergeGroups }
}

/**
 * Generate an initial grid layout for tables that have no saved positions.
 * Places tables in a left-to-right, top-to-bottom grid pattern.
 */
export function generateInitialLayout(
  tableIds: number[],
  floorWidth: number,
  tableSize: number,
  spacing: number,
): TablePosition[] {
  const step = tableSize + spacing
  const cols = Math.max(1, Math.floor(floorWidth / step))
  const positions: TablePosition[] = []

  for (let i = 0; i < tableIds.length; i++) {
    const col = i % cols
    const row = Math.floor(i / cols)
    positions.push({
      tableId: tableIds[i],
      x: col * step,
      y: row * step,
    })
  }

  return positions
}
