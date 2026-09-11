// ─────────────────────────────────────────────────────────────────────────────
// TableNode — Individual table element on the floor plan
// ─────────────────────────────────────────────────────────────────────────────

import { memo, useCallback, useMemo } from 'react'
import { Users, RotateCw } from 'lucide-react'
import type { TableData, TableStatus } from '@/services/tableService'
import {
  type MergedSides,
  type SeatInfo,
  getTableSeatsConfig,
} from '@/utils/floorPlan/adjacency'

interface TableNodeProps {
  table: TableData
  x: number
  y: number
  blockSizePx: number
  tableSizeBlocks: number
  widthBlocks?: number
  heightBlocks?: number
  rotation?: number
  isSelected: boolean
  isDragging: boolean
  dragX?: number
  dragY?: number
  isValidDrag: boolean
  isMerged: boolean
  mergedSides?: MergedSides
  visibleSeats?: SeatInfo[]
  effectiveCapacity?: number
  mergeLabel?: string
  onPointerDown: (tableId: number, e: React.PointerEvent) => void
  onPointerMove?: (e: React.PointerEvent) => void
  onPointerUp?: (e: React.PointerEvent) => void
  onClick: (tableId: number) => void
  onRotate?: (tableId: number) => void
}

function statusColor(status: TableStatus): string {
  switch (status) {
    case 'AVAILABLE': return 'var(--fp-status-available, #10b981)'
    case 'OCCUPIED': return 'var(--fp-status-occupied, #3b82f6)'
    case 'RESERVED': return 'var(--fp-status-reserved, #E9C46A)'
    case 'HAS_REQUEST': return 'var(--fp-status-has-request, #ef4444)'
    case 'UNAVAILABLE': return 'var(--fp-status-unavailable, #9BA4B4)'
    default: return '#9BA4B4'
  }
}

function statusLabel(s: TableStatus): string {
  return {
    AVAILABLE: 'Available',
    OCCUPIED: 'Occupied',
    RESERVED: 'Reserved',
    HAS_REQUEST: 'Needs Help',
    UNAVAILABLE: 'Unavailable',
  }[s] ?? s
}

export const TableNode = memo(function TableNode({
  table,
  x,
  y,
  blockSizePx,
  tableSizeBlocks,
  widthBlocks,
  heightBlocks,
  rotation = 0,
  isSelected,
  isDragging,
  dragX,
  dragY,
  isValidDrag,
  isMerged,
  mergedSides,
  visibleSeats: propVisibleSeats,
  effectiveCapacity: propEffectiveCapacity,
  mergeLabel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onClick,
  onRotate,
}: TableNodeProps) {
  const wBlocks = widthBlocks ?? tableSizeBlocks
  const hBlocks = heightBlocks ?? tableSizeBlocks
  const widthPx = wBlocks * blockSizePx
  const heightPx = hBlocks * blockSizePx
  const displayX = isDragging && dragX !== undefined ? dragX * blockSizePx : x * blockSizePx
  const displayY = isDragging && dragY !== undefined ? dragY * blockSizePx : y * blockSizePx

  const seatsConfig = useMemo(() => {
    if (propVisibleSeats !== undefined && propEffectiveCapacity !== undefined) {
      return { visibleSeats: propVisibleSeats, effectiveCapacity: propEffectiveCapacity }
    }
    const defaultSides: MergedSides = mergedSides ?? { top: false, bottom: false, left: false, right: false }
    return getTableSeatsConfig(table.GUEST_CAPACITY, defaultSides, wBlocks, hBlocks, rotation)
  }, [propVisibleSeats, propEffectiveCapacity, mergedSides, table.GUEST_CAPACITY, wBlocks, hBlocks, rotation])

  const effectiveCap = seatsConfig.effectiveCapacity
  const visibleSeats = seatsConfig.visibleSeats

  const hasRequest = table.STATUS === 'HAS_REQUEST'
  const paxFull = table.CURRENT_GUEST_COUNT >= effectiveCap && effectiveCap > 0

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation()
      onPointerDown(table.TABLE_ID, e)
    },
    [table.TABLE_ID, onPointerDown],
  )

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (!isDragging) onClick(table.TABLE_ID)
    },
    [table.TABLE_ID, isDragging, onClick],
  )

  const classes = [
    'fp-table-node',
    isSelected ? 'fp-table-selected' : '',
    isDragging ? 'fp-table-dragging' : '',
    isDragging && !isValidDrag ? 'fp-table-invalid' : '',
    isMerged ? 'fp-table-merged' : '',
    hasRequest ? 'fp-table-has-request' : '',
  ].filter(Boolean).join(' ')

  return (
    <div
      className={classes}
      style={{
        position: 'absolute',
        left: `${displayX}px`,
        top: `${displayY}px`,
        width: `${widthPx}px`,
        height: `${heightPx}px`,
        '--table-status-color': statusColor(table.STATUS),
        zIndex: isDragging ? 100 : isSelected ? 10 : 1,
        cursor: isDragging ? 'grabbing' : 'grab',
        touchAction: 'none',
      } as React.CSSProperties}
      onPointerDown={handlePointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label={`Table ${table.TABLE_NUM} — ${statusLabel(table.STATUS)}`}
    >
      {/* Attached Seats */}
      <div className="fp-table-seats" aria-hidden="true">
        {visibleSeats.map((seat) => {
          let seatStyle: React.CSSProperties = {}
          const { side, index, totalOnSide } = seat
          const frac = totalOnSide > 1 ? (index + 0.5) / totalOnSide : 0.5

          if (side === 'top') {
            seatStyle = {
              top: '-8.5px',
              left: `${frac * 100}%`,
              transform: 'translateX(-50%)',
              width: totalOnSide > 1 ? `clamp(18px, ${Math.floor(75 / totalOnSide)}%, 42px)` : '44%',
              height: '9px',
            }
          } else if (side === 'bottom') {
            seatStyle = {
              bottom: '-8.5px',
              left: `${frac * 100}%`,
              transform: 'translateX(-50%)',
              width: totalOnSide > 1 ? `clamp(18px, ${Math.floor(75 / totalOnSide)}%, 42px)` : '44%',
              height: '9px',
            }
          } else if (side === 'left') {
            seatStyle = {
              left: '-8.5px',
              top: `${frac * 100}%`,
              transform: 'translateY(-50%)',
              width: '9px',
              height: totalOnSide > 1 ? `clamp(18px, ${Math.floor(75 / totalOnSide)}%, 42px)` : '44%',
            }
          } else if (side === 'right') {
            seatStyle = {
              right: '-8.5px',
              top: `${frac * 100}%`,
              transform: 'translateY(-50%)',
              width: '9px',
              height: totalOnSide > 1 ? `clamp(18px, ${Math.floor(75 / totalOnSide)}%, 42px)` : '44%',
            }
          }

          return (
            <div
              key={seat.id}
              className={`fp-seat fp-seat-${seat.side}`}
              style={seatStyle}
              title={`Seat on ${seat.side}`}
            />
          )
        })}
      </div>

      {/* Selected badge */}
      {isSelected && (
        <div className="fp-table-selected-badge">
          SELECTED
        </div>
      )}

      {/* Rotate button when selected */}
      {isSelected && !isDragging && onRotate && (
        <button
          type="button"
          className="fp-table-rotate-btn"
          title="Rotate table 90° (R)"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            onRotate(table.TABLE_ID)
          }}
        >
          <RotateCw className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Assistance ping */}
      {hasRequest && (
        <div className="fp-table-ping">
          <span className="fp-ping-ring" />
          <span className="fp-ping-dot" />
        </div>
      )}

      {/* Table number */}
      <div className="fp-table-num">{table.TABLE_NUM}</div>

      {/* Capacity indicator */}
      <div className={`fp-table-pax ${paxFull ? 'fp-pax-full' : ''}`}>
        <Users className="fp-pax-icon" />
        <span>{table.CURRENT_GUEST_COUNT}/{effectiveCap}</span>
      </div>

      {/* Status Pill */}
      <div className={`fp-table-status-pill fp-status-pill-${table.STATUS.toLowerCase().replace('_', '-')}`}>
        {statusLabel(table.STATUS)}
      </div>

      {/* Merge label */}
      {mergeLabel && (
        <div className="fp-table-merge-label">{mergeLabel}</div>
      )}
    </div>
  )
})

export default TableNode
