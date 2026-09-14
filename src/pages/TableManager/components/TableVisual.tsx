import React, { memo } from 'react'
import { Users } from 'lucide-react'
import type { TableType } from '@/services/tableLayoutService'

interface ChairProps {
  rotation?: number // in degrees: 0 = facing down (placed on top), 180 = facing up (placed on bottom), 90 = facing left, 270 = facing right
  size?: number
  className?: string
}

/**
 * Realistic Leather Dining Armchair matching reference aesthetic
 */
export const Chair: React.FC<ChairProps> = memo(({ rotation = 0, size = 20, className = '' }) => {
  return (
    <div
      className={`pointer-events-none transition-opacity duration-200 select-none ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        transform: `rotate(${rotation}deg)`,
        transformOrigin: 'center center',
      }}
    >
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        className="w-full h-full drop-shadow-md"
      >
        {/* Outer Armchair frame */}
        <path
          d="M 16,82 C 12,82 10,75 10,65 L 10,32 C 10,16 26,10 50,10 C 74,10 90,16 90,32 L 90,65 C 90,75 88,82 84,82 C 80,82 78,76 78,70 L 78,38 C 78,28 68,22 50,22 C 32,22 22,28 22,38 L 22,70 C 22,76 20,82 16,82 Z"
          fill="#9C6421"
          stroke="#6E4211"
          strokeWidth="3.5"
          strokeLinejoin="round"
        />

        {/* Armchair side pads */}
        <rect
          x="10"
          y="42"
          width="12"
          height="36"
          rx="5"
          fill="#BA7F2E"
          stroke="#6E4211"
          strokeWidth="2.5"
        />
        <rect
          x="78"
          y="42"
          width="12"
          height="36"
          rx="5"
          fill="#BA7F2E"
          stroke="#6E4211"
          strokeWidth="2.5"
        />

        {/* Seat Cushion Pad */}
        <rect
          x="22"
          y="30"
          width="56"
          height="48"
          rx="8"
          fill="#D49339"
          stroke="#825114"
          strokeWidth="3"
        />

        {/* Seat Cushion highlight */}
        <rect
          x="26"
          y="34"
          width="48"
          height="38"
          rx="5"
          fill="#E8A94B"
          opacity="0.9"
        />
      </svg>
    </div>
  )
})

Chair.displayName = 'Chair'

/**
 * Gold Table Shape Icon corresponding to each table type
 */
export const TableShapeIcon: React.FC<{
  tableType: TableType
  size?: number
  className?: string
}> = memo(({ tableType, size = 20, className = '' }) => {
  switch (tableType) {
    case 1: // Square 1x1
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          className={`shrink-0 drop-shadow-xs ${className}`}
        >
          <rect
            x="3"
            y="3"
            width="18"
            height="18"
            rx="4"
            fill="url(#goldGradSquare)"
            stroke="#9C7A14"
            strokeWidth="1.5"
          />
          <rect
            x="6"
            y="6"
            width="12"
            height="12"
            rx="2.5"
            fill="#FFF1BD"
            opacity="0.45"
          />
          <defs>
            <linearGradient id="goldGradSquare" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
              <stop stopColor="#F5D77F" />
              <stop offset="0.5" stopColor="#D4AF37" />
              <stop offset="1" stopColor="#A88118" />
            </linearGradient>
          </defs>
        </svg>
      )
    case 2: // Rectangle 1x3
      return (
        <svg
          width={Math.round(size * 1.7)}
          height={size}
          viewBox="0 0 38 22"
          fill="none"
          className={`shrink-0 drop-shadow-xs ${className}`}
        >
          <rect
            x="2"
            y="3"
            width="34"
            height="16"
            rx="4"
            fill="url(#goldGradRect)"
            stroke="#9C7A14"
            strokeWidth="1.5"
          />
          <rect
            x="5"
            y="5.5"
            width="28"
            height="11"
            rx="2.5"
            fill="#FFF1BD"
            opacity="0.45"
          />
          <defs>
            <linearGradient id="goldGradRect" x1="2" y1="3" x2="36" y2="19" gradientUnits="userSpaceOnUse">
              <stop stopColor="#F5D77F" />
              <stop offset="0.5" stopColor="#D4AF37" />
              <stop offset="1" stopColor="#A88118" />
            </linearGradient>
          </defs>
        </svg>
      )
    case 3: // Small Circle 1x1
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          className={`shrink-0 drop-shadow-xs ${className}`}
        >
          <circle
            cx="12"
            cy="12"
            r="9"
            fill="url(#goldGradCircleSm)"
            stroke="#9C7A14"
            strokeWidth="1.5"
          />
          <circle
            cx="12"
            cy="12"
            r="6"
            fill="#FFF1BD"
            opacity="0.45"
          />
          <defs>
            <linearGradient id="goldGradCircleSm" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
              <stop stopColor="#F5D77F" />
              <stop offset="0.5" stopColor="#D4AF37" />
              <stop offset="1" stopColor="#A88118" />
            </linearGradient>
          </defs>
        </svg>
      )
    case 4: // Big Circle 2x2
      return (
        <svg
          width={Math.round(size * 1.2)}
          height={Math.round(size * 1.2)}
          viewBox="0 0 28 28"
          fill="none"
          className={`shrink-0 drop-shadow-xs ${className}`}
        >
          <circle
            cx="14"
            cy="14"
            r="12"
            fill="url(#goldGradCircleLg)"
            stroke="#9C7A14"
            strokeWidth="1.5"
          />
          <circle
            cx="14"
            cy="14"
            r="8"
            fill="#FFF1BD"
            opacity="0.45"
          />
          <defs>
            <linearGradient id="goldGradCircleLg" x1="2" y1="2" x2="26" y2="26" gradientUnits="userSpaceOnUse">
              <stop stopColor="#F5D77F" />
              <stop offset="0.5" stopColor="#D4AF37" />
              <stop offset="1" stopColor="#A88118" />
            </linearGradient>
          </defs>
        </svg>
      )
    default:
      return null
  }
})

TableShapeIcon.displayName = 'TableShapeIcon'

export interface TableVisualProps {
  tableType: TableType
  tableNum: number
  cellSize: number
  status?: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'HAS_REQUEST' | 'UNAVAILABLE'
  guestCount?: number
  capacity?: number
  isMerged?: boolean
  mergeGroupId?: number | null
  isSelected?: boolean
  isEditMode?: boolean
  hideChairs?: {
    top?: boolean[] | boolean
    bottom?: boolean[] | boolean
    left?: boolean
    right?: boolean
    radial?: boolean[]
  }
}

export const TableVisual: React.FC<TableVisualProps> = memo(({
  tableType,
  tableNum,
  cellSize,
  status = 'AVAILABLE',
  guestCount = 0,
  capacity = 4,
  isMerged = false,
  mergeGroupId: _mergeGroupId = null,
  isSelected = false,
  isEditMode = false,
  hideChairs = {},
}) => {
  const getStatusDetails = () => {
    switch (status) {
      case 'OCCUPIED':
        return { color: '#3B82F6', text: 'Occupied', ring: 'ring-blue-500', bg: 'bg-blue-600' }
      case 'RESERVED':
        return { color: '#EAB308', text: 'Reserved', ring: 'ring-amber-500', bg: 'bg-amber-600' }
      case 'HAS_REQUEST':
        return { color: '#EF4444', text: 'Bill Out', ring: 'ring-rose-500', bg: 'bg-rose-600' }
      case 'UNAVAILABLE':
        return { color: '#64748B', text: 'Unavailable', ring: 'ring-slate-400', bg: 'bg-slate-500' }
      case 'AVAILABLE':
      default:
        return { color: '#10B981', text: 'Available', ring: 'ring-emerald-500', bg: 'bg-emerald-600' }
    }
  }

  const statusInfo = getStatusDetails()
  // Smaller chairs spaced away from the table
  const chairSize = Math.max(10, Math.round(cellSize * 0.22))
  const chairOffset = -Math.round(chairSize * 1.15)

  // ── 1. Type 1: Square Table (1x1) ──
  if (tableType === 1) {
    const hideTop = Boolean(Array.isArray(hideChairs.top) ? hideChairs.top[0] : hideChairs.top)
    const hideBottom = Boolean(Array.isArray(hideChairs.bottom) ? hideChairs.bottom[0] : hideChairs.bottom)
    const hideLeft = Boolean(hideChairs.left)
    const hideRight = Boolean(hideChairs.right)

    return (
      <div
        className="relative select-none"
        style={{ width: `${cellSize}px`, height: `${cellSize}px` }}
      >
        {/* Top Chair */}
        {!hideTop && (
          <div
            className="absolute left-1/2 -translate-x-1/2 z-0"
            style={{ top: `${chairOffset}px` }}
          >
            <Chair rotation={0} size={chairSize} />
          </div>
        )}

        {/* Bottom Chair */}
        {!hideBottom && (
          <div
            className="absolute left-1/2 -translate-x-1/2 z-0"
            style={{ bottom: `${chairOffset}px` }}
          >
            <Chair rotation={180} size={chairSize} />
          </div>
        )}

        {/* Left Chair */}
        {!hideLeft && (
          <div
            className="absolute top-1/2 -translate-y-1/2 z-0"
            style={{ left: `${chairOffset}px` }}
          >
            <Chair rotation={270} size={chairSize} />
          </div>
        )}

        {/* Right Chair */}
        {!hideRight && (
          <div
            className="absolute top-1/2 -translate-y-1/2 z-0"
            style={{ right: `${chairOffset}px` }}
          >
            <Chair rotation={90} size={chairSize} />
          </div>
        )}

        {/* Tabletop Surface */}
        <div
          className={`relative z-10 w-full h-full rounded-md flex flex-col items-center justify-center shadow-md transition-all duration-150 ${
            isSelected
              ? 'ring-3 ring-blue-500 shadow-blue-500/30'
              : !isEditMode
              ? `ring-2 ${statusInfo.ring}`
              : isMerged
              ? 'ring-2 ring-indigo-400/90 shadow-[0_0_12px_rgba(99,102,241,0.35)]'
              : 'border border-slate-700/80'
          }`}
          style={{
            backgroundColor: '#2D3239',
            backgroundImage: 'radial-gradient(circle at 50% 30%, #3C424C 0%, #252A30 100%)',
          }}
        >
          {/* Centered Table Number */}
          <span className="text-white font-black text-sm sm:text-base tracking-tight leading-none drop-shadow-md">
            {tableNum}
          </span>

          {/* Corner Seat Counter (Bottom-Right for Square Table) */}
          <div className="absolute bottom-1 right-1 px-1 py-0.5 rounded bg-black/40 border border-white/10 text-[8px] font-black text-slate-300 flex items-center gap-0.5 leading-none pointer-events-none">
            <Users className="w-2 h-2 text-slate-400" />
            <span>{guestCount > 0 ? `${guestCount}/${capacity}` : capacity}</span>
          </div>
        </div>
      </div>
    )
  }

  // ── 2. Type 2: Rectangle Table (1x3) ──
  if (tableType === 2) {
    const totalWidth = cellSize * 3
    const totalHeight = cellSize

    const topMask = Array.isArray(hideChairs.top) ? hideChairs.top : [false, false, false]
    const bottomMask = Array.isArray(hideChairs.bottom) ? hideChairs.bottom : [false, false, false]
    const hideLeft = Boolean(hideChairs.left)
    const hideRight = Boolean(hideChairs.right)

    return (
      <div
        className="relative select-none"
        style={{ width: `${totalWidth}px`, height: `${totalHeight}px` }}
      >
        {/* Top Chairs */}
        <div
          className="absolute top-0 w-full flex justify-around px-4 z-0"
          style={{ top: `${chairOffset}px` }}
        >
          {!topMask[0] ? <Chair rotation={0} size={chairSize} /> : <div style={{ width: chairSize }} />}
          {!topMask[1] ? <Chair rotation={0} size={chairSize} /> : <div style={{ width: chairSize }} />}
          {!topMask[2] ? <Chair rotation={0} size={chairSize} /> : <div style={{ width: chairSize }} />}
        </div>

        {/* Bottom Chairs */}
        <div
          className="absolute bottom-0 w-full flex justify-around px-4 z-0"
          style={{ bottom: `${chairOffset}px` }}
        >
          {!bottomMask[0] ? <Chair rotation={180} size={chairSize} /> : <div style={{ width: chairSize }} />}
          {!bottomMask[1] ? <Chair rotation={180} size={chairSize} /> : <div style={{ width: chairSize }} />}
          {!bottomMask[2] ? <Chair rotation={180} size={chairSize} /> : <div style={{ width: chairSize }} />}
        </div>

        {/* Left End Chair */}
        {!hideLeft && (
          <div
            className="absolute top-1/2 -translate-y-1/2 z-0"
            style={{ left: `${chairOffset}px` }}
          >
            <Chair rotation={270} size={chairSize} />
          </div>
        )}

        {/* Right End Chair */}
        {!hideRight && (
          <div
            className="absolute top-1/2 -translate-y-1/2 z-0"
            style={{ right: `${chairOffset}px` }}
          >
            <Chair rotation={90} size={chairSize} />
          </div>
        )}

        {/* Tabletop Surface */}
        <div
          className={`relative z-10 w-full h-full rounded-md flex flex-col items-center justify-center shadow-md transition-all duration-150 ${
            isSelected
              ? 'ring-3 ring-blue-500 shadow-blue-500/30'
              : !isEditMode
              ? `ring-2 ${statusInfo.ring}`
              : isMerged
              ? 'ring-2 ring-indigo-400/90 shadow-[0_0_12px_rgba(99,102,241,0.35)]'
              : 'border border-slate-700/80'
          }`}
          style={{
            backgroundColor: '#2D3239',
            backgroundImage: 'radial-gradient(ellipse at 50% 30%, #3C424C 0%, #252A30 100%)',
          }}
        >
          {/* Centered Table Number */}
          <span className="text-white font-black text-sm sm:text-base tracking-tight leading-none drop-shadow-md">
            {tableNum}
          </span>

          {/* Corner Seat Counter (Bottom-Right for Rectangle Table) */}
          <div className="absolute bottom-1.5 right-2 px-1.5 py-0.5 rounded bg-black/40 border border-white/10 text-[9px] font-black text-slate-300 flex items-center gap-1 leading-none pointer-events-none">
            <Users className="w-2.5 h-2.5 text-slate-400" />
            <span>{guestCount > 0 ? `${guestCount}/${capacity}` : capacity}</span>
          </div>
        </div>
      </div>
    )
  }

  // ── 3. Type 3: Small Circle Table (1x1) ──
  if (tableType === 3) {
    const hideTop = Boolean(Array.isArray(hideChairs.top) ? hideChairs.top[0] : hideChairs.top)
    const hideBottom = Boolean(Array.isArray(hideChairs.bottom) ? hideChairs.bottom[0] : hideChairs.bottom)
    const hideLeft = Boolean(hideChairs.left)
    const hideRight = Boolean(hideChairs.right)

    return (
      <div
        className="relative select-none"
        style={{ width: `${cellSize}px`, height: `${cellSize}px` }}
      >
        {!hideTop && (
          <div
            className="absolute left-1/2 -translate-x-1/2 z-0"
            style={{ top: `${chairOffset}px` }}
          >
            <Chair rotation={0} size={chairSize} />
          </div>
        )}

        {!hideBottom && (
          <div
            className="absolute left-1/2 -translate-x-1/2 z-0"
            style={{ bottom: `${chairOffset}px` }}
          >
            <Chair rotation={180} size={chairSize} />
          </div>
        )}

        {!hideLeft && (
          <div
            className="absolute top-1/2 -translate-y-1/2 z-0"
            style={{ left: `${chairOffset}px` }}
          >
            <Chair rotation={270} size={chairSize} />
          </div>
        )}

        {!hideRight && (
          <div
            className="absolute top-1/2 -translate-y-1/2 z-0"
            style={{ right: `${chairOffset}px` }}
          >
            <Chair rotation={90} size={chairSize} />
          </div>
        )}

        {/* Circular Tabletop Surface */}
        <div
          className={`relative z-10 w-full h-full rounded-full flex flex-col items-center justify-center shadow-md transition-all duration-150 ${
            isSelected
              ? 'ring-3 ring-blue-500 shadow-blue-500/30'
              : !isEditMode
              ? `ring-2 ${statusInfo.ring}`
              : isMerged
              ? 'ring-2 ring-indigo-400/90 shadow-[0_0_12px_rgba(99,102,241,0.35)]'
              : 'border border-slate-700/80'
          }`}
          style={{
            backgroundColor: '#2D3239',
            backgroundImage: 'radial-gradient(circle at 45% 35%, #3C424C 0%, #252A30 100%)',
          }}
        >
          {/* Centered Table Number */}
          <span className="text-white font-black text-sm sm:text-base tracking-tight leading-none drop-shadow-md">
            {tableNum}
          </span>

          {/* Seat Counter Below Table Number for Circle Tables */}
          <div className="flex items-center gap-0.5 mt-0.5 text-[8px] sm:text-[9px] font-bold text-slate-300 pointer-events-none">
            <Users className="w-2 h-2 text-slate-400" />
            <span>{guestCount > 0 ? `${guestCount}/${capacity}` : capacity}</span>
          </div>
        </div>
      </div>
    )
  }

  // ── 4. Type 4: Big Circle Table (2x2) ──
  if (tableType === 4) {
    const totalSize = cellSize * 2
    const radialMask = hideChairs.radial || []
    const radius = (totalSize / 2) + Math.round(chairSize * 0.7)
    const angles = [0, 60, 120, 180, 240, 300]

    return (
      <div
        className="relative select-none"
        style={{ width: `${totalSize}px`, height: `${totalSize}px` }}
      >
        {/* 6 Fixed Radial Chairs around 360 degrees */}
        {angles.map((deg, idx) => {
          if (radialMask[idx]) return null
          const rad = (deg - 90) * (Math.PI / 180)
          const cx = totalSize / 2 + radius * Math.cos(rad) - chairSize / 2
          const cy = totalSize / 2 + radius * Math.sin(rad) - chairSize / 2

          return (
            <div
              key={deg}
              className="absolute z-0"
              style={{
                left: `${cx}px`,
                top: `${cy}px`,
              }}
            >
              <Chair rotation={deg} size={chairSize} />
            </div>
          )
        })}

        {/* Big Circular Tabletop Surface */}
        <div
          className={`relative z-10 w-full h-full rounded-full flex flex-col items-center justify-center shadow-lg transition-all duration-150 ${
            isSelected
              ? 'ring-3 ring-blue-500 shadow-blue-500/30'
              : !isEditMode
              ? `ring-2 ${statusInfo.ring}`
              : isMerged
              ? 'ring-2 ring-indigo-400/90 shadow-[0_0_14px_rgba(99,102,241,0.4)]'
              : 'border border-slate-700/80'
          }`}
          style={{
            backgroundColor: '#2D3239',
            backgroundImage: 'radial-gradient(circle at 45% 35%, #3C424C 0%, #252A30 100%)',
          }}
        >
          {/* Centered Table Number */}
          <span className="text-white font-black text-base sm:text-lg tracking-tight leading-none drop-shadow-md">
            {tableNum}
          </span>

          {/* Seat Counter Below Table Number for Circle Tables */}
          <div className="flex items-center gap-1 mt-0.5 text-[10px] sm:text-xs font-bold text-slate-300 pointer-events-none">
            <Users className="w-2.5 h-2.5 text-slate-400" />
            <span>{guestCount > 0 ? `${guestCount}/${capacity}` : capacity}</span>
          </div>
        </div>
      </div>
    )
  }

  return null
})

TableVisual.displayName = 'TableVisual'
