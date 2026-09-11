// ─────────────────────────────────────────────────────────────────────────────
// Floor Plan Grid Utilities
// All coordinates are in logical BLOCK units unless suffixed with Px.
// ─────────────────────────────────────────────────────────────────────────────

export interface FloorConfig {
  /** Floor width in logical blocks */
  widthBlocks: number
  /** Floor height in logical blocks */
  heightBlocks: number
  /** Uniform table footprint size in blocks (e.g. 2 = 2×2) */
  tableSizeBlocks: number
  /** Minimum spacing between non-merging tables in blocks */
  spacingBlocks: number
  /** Whether snap-to-grid is enabled */
  snapEnabled: boolean
}

export const DEFAULT_FLOOR_CONFIG: FloorConfig = {
  widthBlocks: 20,
  heightBlocks: 16,
  tableSizeBlocks: 2,
  spacingBlocks: 1,
  snapEnabled: true,
}

/**
 * Calculate the pixel size of a single block so the floor fits within the container.
 * Maintains square blocks (same width and height).
 */
export function calculateBlockSizePx(
  containerWidthPx: number,
  containerHeightPx: number,
  floorWidthBlocks: number,
  floorHeightBlocks: number,
): number {
  if (floorWidthBlocks <= 0 || floorHeightBlocks <= 0) return 32
  const bw = containerWidthPx / floorWidthBlocks
  const bh = containerHeightPx / floorHeightBlocks
  return Math.floor(Math.min(bw, bh))
}

/** Convert a block coordinate to pixel offset. */
export function blockToPx(block: number, blockSizePx: number): number {
  return block * blockSizePx
}

/** Convert a pixel offset to the nearest block coordinate. */
export function pxToBlock(px: number, blockSizePx: number): number {
  if (blockSizePx <= 0) return 0
  return Math.round(px / blockSizePx)
}

/** Check whether a table at (x, y) with given size fits inside the floor. */
export function isWithinFloor(
  x: number,
  y: number,
  tableSize: number,
  floorWidth: number,
  floorHeight: number,
): boolean {
  return x >= 0 && y >= 0 && x + tableSize <= floorWidth && y + tableSize <= floorHeight
}

/**
 * Clamp a block position so the table stays within the floor boundaries.
 */
export function clampToFloor(
  x: number,
  y: number,
  tableSize: number,
  floorWidth: number,
  floorHeight: number,
  widthBlocks?: number,
  heightBlocks?: number,
): { x: number; y: number } {
  const w = widthBlocks ?? tableSize
  const h = heightBlocks ?? tableSize
  return {
    x: Math.max(0, Math.min(floorWidth - w, x)),
    y: Math.max(0, Math.min(floorHeight - h, y)),
  }
}

/**
 * Return the floor dimensions in pixels.
 */
export function floorDimensionsPx(
  floorWidthBlocks: number,
  floorHeightBlocks: number,
  blockSizePx: number,
): { widthPx: number; heightPx: number } {
  return {
    widthPx: floorWidthBlocks * blockSizePx,
    heightPx: floorHeightBlocks * blockSizePx,
  }
}
