// ─────────────────────────────────────────────────────────────────────────────
// MergeGroupOverlay — Visual overlay for adjacency-merged table groups
// ─────────────────────────────────────────────────────────────────────────────

import { memo, useMemo } from 'react'
import type { MergeGroup } from '@/utils/floorPlan/adjacency'
import type { EditorTable } from './useFloorPlanState'

interface MergeGroupOverlayProps {
  group: MergeGroup
  positions: EditorTable[]
  blockSizePx: number
  tableSizeBlocks: number
  isSelected: boolean
  combinedCapacity?: number
  onClick: (groupAnchorId: number) => void
}

export const MergeGroupOverlay = memo(function MergeGroupOverlay({
  group,
  positions,
  blockSizePx,
  tableSizeBlocks,
  isSelected,
  combinedCapacity,
  onClick,
}: MergeGroupOverlayProps) {
  const bounds = useMemo(() => {
    const members = positions.filter((p) => group.memberIds.includes(p.tableId))
    if (members.length === 0) return null

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

    for (const m of members) {
      const px = m.x * blockSizePx
      const py = m.y * blockSizePx
      const mW = (m.widthBlocks ?? tableSizeBlocks) * blockSizePx
      const mH = (m.heightBlocks ?? tableSizeBlocks) * blockSizePx
      if (px < minX) minX = px
      if (py < minY) minY = py
      if (px + mW > maxX) maxX = px + mW
      if (py + mH > maxY) maxY = py + mH
    }

    return { left: minX, top: minY, width: maxX - minX, height: maxY - minY }
  }, [group, positions, blockSizePx, tableSizeBlocks])

  if (!bounds) return null

  const anchorPos = positions.find((p) => p.tableId === group.anchorId)
  const anchorNum = anchorPos?.tableNum ?? group.anchorId
  const label = `Table ${anchorNum}${combinedCapacity ? ` (${combinedCapacity}p)` : ''}`

  const pad = 4
  return (
    <div
      className={`fp-merge-overlay ${isSelected ? 'fp-merge-selected' : ''}`}
      style={{
        position: 'absolute',
        left: `${bounds.left - pad}px`,
        top: `${bounds.top - pad}px`,
        width: `${bounds.width + pad * 2}px`,
        height: `${bounds.height + pad * 2}px`,
        pointerEvents: 'none',
      }}
      onClick={() => onClick(group.anchorId)}
    >
      <div className="fp-merge-label">{label}</div>
    </div>
  )
})

export default MergeGroupOverlay
