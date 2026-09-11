// ─────────────────────────────────────────────────────────────────────────────
// Snap-to-Grid Utilities
// ─────────────────────────────────────────────────────────────────────────────

import { clampToFloor } from './grid'

/**
 * Snap a block coordinate to the nearest valid grid position.
 * Grid positions are multiples of `gridStep` (default 1 block).
 */
export function snapToGrid(value: number, gridStep: number = 1): number {
  if (gridStep <= 0) return value
  return Math.round(value / gridStep) * gridStep
}

/**
 * Snap an (x, y) block position to the nearest valid grid position,
 * clamped within floor boundaries.
 */
export function snapPosition(
  x: number,
  y: number,
  tableSize: number,
  floorWidth: number,
  floorHeight: number,
  snapEnabled: boolean,
  gridStep: number = 1,
  widthBlocks?: number,
  heightBlocks?: number,
): { x: number; y: number } {
  let sx = x
  let sy = y

  if (snapEnabled) {
    sx = snapToGrid(x, gridStep)
    sy = snapToGrid(y, gridStep)
  }

  return clampToFloor(sx, sy, tableSize, floorWidth, floorHeight, widthBlocks, heightBlocks)
}

/**
 * Convert a pixel cursor position to a snapped block position.
 * Used during drag operations.
 */
export function cursorToSnappedBlock(
  cursorPx: number,
  offsetPx: number,
  blockSizePx: number,
  tableSize: number,
  floorExtent: number,
  snapEnabled: boolean,
): number {
  if (blockSizePx <= 0) return 0
  const raw = (cursorPx - offsetPx) / blockSizePx
  const snapped = snapEnabled ? snapToGrid(raw) : Math.round(raw * 2) / 2
  return Math.max(0, Math.min(floorExtent - tableSize, snapped))
}
