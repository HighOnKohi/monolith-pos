import React, { memo } from 'react'
import { Users, GitMerge, Check, RotateCw } from 'lucide-react'
import type { TableType } from '@/services/tableLayoutService'

interface ChairProps {
  rotation?: number // in degrees: 0 = facing down (placed on top), 180 = facing up (placed on bottom), 90 = facing left, 270 = facing right
  size?: number
  className?: string
}

/**
 * Modern Minimalist Dining Chair matching Monolith POS aesthetic
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
        className="w-full h-full drop-shadow-xs"
      >
        {/* Modern Contoured Chair Backrest Frame */}
        <path
          d="M 18,74 C 14,74 12,68 12,60 L 12,36 C 12,18 28,12 50,12 C 72,12 88,18 88,36 L 88,60 C 88,68 86,74 82,74 C 78,74 76,68 76,62 L 76,40 C 76,28 66,22 50,22 C 34,22 24,28 24,40 L 24,62 C 24,68 22,74 18,74 Z"
          fill="#334155"
          stroke="#1E293B"
          strokeWidth="3.5"
          strokeLinejoin="round"
        />

        {/* Seat Cushion Pad */}
        <rect
          x="22"
          y="32"
          width="56"
          height="48"
          rx="10"
          fill="#F1F5F9"
          stroke="#94A3B8"
          strokeWidth="3.5"
        />

        {/* Inner Highlight Layer */}
        <rect
          x="26"
          y="36"
          width="48"
          height="40"
          rx="7"
          fill="#FFFFFF"
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
    case 2: // Rectangle Horizontal 3x1
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
            x="4.5"
            y="5.5"
            width="29"
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
    case 5: // Rectangle Vertical 1x3
      return (
        <svg
          width={size}
          height={Math.round(size * 1.7)}
          viewBox="0 0 22 38"
          fill="none"
          className={`shrink-0 drop-shadow-xs ${className}`}
        >
          <rect
            x="3"
            y="2"
            width="16"
            height="34"
            rx="4"
            fill="url(#goldGradRectVert)"
            stroke="#9C7A14"
            strokeWidth="1.5"
          />
          <rect
            x="5.5"
            y="4.5"
            width="11"
            height="29"
            rx="2.5"
            fill="#FFF1BD"
            opacity="0.45"
          />
          <defs>
            <linearGradient id="goldGradRectVert" x1="3" y1="2" x2="19" y2="36" gradientUnits="userSpaceOnUse">
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
            fill="url(#goldGradCircleSmall)"
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
            <linearGradient id="goldGradCircleSmall" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
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
          width={Math.round(size * 1.35)}
          height={Math.round(size * 1.35)}
          viewBox="0 0 28 28"
          fill="none"
          className={`shrink-0 drop-shadow-xs ${className}`}
        >
          <circle
            cx="14"
            cy="14"
            r="12"
            fill="url(#goldGradCircleBig)"
            stroke="#9C7A14"
            strokeWidth="1.5"
          />
          <circle
            cx="14"
            cy="14"
            r="8.5"
            fill="#FFF1BD"
            opacity="0.45"
          />
          <defs>
            <linearGradient id="goldGradCircleBig" x1="2" y1="2" x2="26" y2="26" gradientUnits="userSpaceOnUse">
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
  isQrPrintMode?: boolean
  isPrintSelected?: boolean
  labelName?: string | null
  labelColor?: string | null
  onTogglePrintSelect?: () => void
  onRotate?: () => void
  hideChairs?: {
    top?: boolean[] | boolean
    bottom?: boolean[] | boolean
    left?: boolean | boolean[]
    right?: boolean | boolean[]
    radial?: boolean[]
  }
}

/**
 * Picks active chair slot indices up to target capacity from unblocked perimeter spots.
 */
function pickDynamicChairSlots(
  priorityOrder: number[],
  unblockedMask: boolean[],
  targetCapacity: number,
): Set<number> {
  const activeSlots = new Set<number>()
  const unblockedSlots = priorityOrder.filter((slot) => unblockedMask[slot])
  const maxToTake = Math.max(0, Math.min(targetCapacity, unblockedSlots.length))

  for (let i = 0; i < maxToTake; i++) {
    activeSlots.add(unblockedSlots[i])
  }

  return activeSlots
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
  isQrPrintMode = false,
  isPrintSelected = false,
  labelName = null,
  labelColor = null,
  onTogglePrintSelect,
  onRotate,
  hideChairs = {},
}) => {
  const getStatusDetails = () => {
    switch (status) {
      case 'OCCUPIED':
        return { color: '#3B82F6', text: 'Occupied', ring: 'ring-blue-500', bg: 'bg-blue-600' }
      case 'RESERVED':
        return { color: '#F59E0B', text: 'Reserved', ring: 'ring-amber-500', bg: 'bg-amber-600' }
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
  const chairSize = Math.max(10, Math.round(cellSize * 0.22))
  const chairOffset = -Math.round(chairSize * 1.15)

  // Border & background style for tabletop with status-colored or label-colored border and soft status tint
  const getTabletopStyle = () => {
    if (isQrPrintMode) {
      return {
        backgroundColor: '#FFFFFF',
      }
    }
    const borderColor = labelColor
      ? labelColor
      : isEditMode
        ? isSelected ? '#14274E' : '#475569'
        : statusInfo.color

    let bg = '#FFFFFF'
    if (status === 'OCCUPIED') bg = '#EFF6FF'
    else if (status === 'RESERVED') bg = '#FFFBEB'
    else if (status === 'HAS_REQUEST') bg = '#FEF2F2'
    else if (status === 'UNAVAILABLE') bg = '#F8FAFC'

    return {
      backgroundColor: bg,
      borderColor,
      borderWidth: labelColor ? '4px' : '3.5px',
      borderStyle: 'solid' as const,
      boxShadow: labelColor
        ? `0 0 0 2px ${labelColor}33, 0 4px 12px ${labelColor}25`
        : isSelected
          ? '0 4px 14px rgba(79, 70, 229, 0.25)'
          : undefined,
    }
  }

  // Common Header Badges (VIP / Label & Status Indicator)
  const renderTabletopBadges = () => (
    <>
      {/* Table Label / VIP Floating Badge */}
      {labelName && (
        <div
          className="absolute -top-3 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider shadow-md z-30 whitespace-nowrap flex items-center gap-1 border-2 border-white pointer-events-none animate-in fade-in zoom-in-95 duration-150"
          style={{
            backgroundColor: labelColor || '#8B0000',
            color: '#FFFFFF',
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          <span>{labelName}</span>
        </div>
      )}

      {/* Top Left Status & Merge Indicator */}
      <div className="absolute top-1 left-1.5 flex items-center gap-1 pointer-events-none z-20">
        <span
          className="w-2.5 h-2.5 rounded-full ring-1.5 ring-white shadow-xs shrink-0"
          style={{ backgroundColor: statusInfo.color }}
          title={`Status: ${statusInfo.text}`}
        />
        {status === 'HAS_REQUEST' && (
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping absolute top-0 left-0" />
        )}
        {!isQrPrintMode && isMerged && (
          <div className="p-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center pointer-events-none shadow-xs">
            <GitMerge className="w-2 h-2 text-indigo-600" />
          </div>
        )}
      </div>
    </>
  )

  const getTabletopClasses = () => {
    if (isQrPrintMode) {
      return isPrintSelected
        ? 'bg-white border-2 border-[#14274E] ring-3 ring-[#14274E]/30 shadow-lg cursor-pointer'
        : 'bg-white/95 border-2 border-dashed border-slate-300 opacity-70 hover:opacity-100 hover:border-slate-400 cursor-pointer'
    }
    if (isSelected) {
      return 'ring-4 ring-indigo-500/70 shadow-lg scale-102'
    }
    return 'shadow-md'
  }

  // ── 1. Type 1: Square Table (1x1) ──
  if (tableType === 1) {
    const hideTop = Boolean(Array.isArray(hideChairs.top) ? hideChairs.top[0] : hideChairs.top)
    const hideBottom = Boolean(Array.isArray(hideChairs.bottom) ? hideChairs.bottom[0] : hideChairs.bottom)
    const hideLeft = Boolean(hideChairs.left)
    const hideRight = Boolean(hideChairs.right)

    const unblockedMask = [!hideTop, !hideBottom, !hideLeft, !hideRight]
    const priorityOrder = [0, 1, 2, 3]
    const activeSlots = pickDynamicChairSlots(priorityOrder, unblockedMask, capacity)

    return (
      <div
        className="relative select-none"
        style={{ width: `${cellSize}px`, height: `${cellSize}px` }}
        onClick={(e) => {
          if (isQrPrintMode && onTogglePrintSelect) {
            e.stopPropagation()
            onTogglePrintSelect()
          }
        }}
      >
        {/* Top Chair */}
        {activeSlots.has(0) && (
          <div
            className="absolute left-1/2 -translate-x-1/2 z-0"
            style={{ top: `${chairOffset}px` }}
          >
            <Chair rotation={0} size={chairSize} />
          </div>
        )}

        {/* Bottom Chair */}
        {activeSlots.has(1) && (
          <div
            className="absolute left-1/2 -translate-x-1/2 z-0"
            style={{ bottom: `${chairOffset}px` }}
          >
            <Chair rotation={180} size={chairSize} />
          </div>
        )}

        {/* Left Chair */}
        {activeSlots.has(2) && (
          <div
            className="absolute top-1/2 -translate-y-1/2 z-0"
            style={{ left: `${chairOffset}px` }}
          >
            <Chair rotation={270} size={chairSize} />
          </div>
        )}

        {/* Right Chair */}
        {activeSlots.has(3) && (
          <div
            className="absolute top-1/2 -translate-y-1/2 z-0"
            style={{ right: `${chairOffset}px` }}
          >
            <Chair rotation={90} size={chairSize} />
          </div>
        )}

        {/* Tabletop Surface */}
        <div
          className={`relative z-10 w-full h-full rounded-xl flex flex-col items-center justify-center transition-all duration-150 ${getTabletopClasses()}`}
          style={getTabletopStyle()}
        >
          {renderTabletopBadges()}

          {/* QR Print Mode Checkbox */}
          {isQrPrintMode && (
            <div
              className={`absolute top-1 right-1 w-4 h-4 rounded-md flex items-center justify-center transition-all ${
                isPrintSelected
                  ? 'bg-[#14274E] text-[#E9C46A] shadow-xs'
                  : 'bg-white border-2 border-slate-400 text-transparent'
              }`}
            >
              <Check className="w-2.5 h-2.5 stroke-[3.5]" />
            </div>
          )}

          {/* Centered Table Number */}
          <span className="font-black text-sm sm:text-base tracking-tight leading-none text-[#14274E]">
            {tableNum}
          </span>

          {/* Corner Seat Counter */}
          <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded-full text-[8px] font-black flex items-center gap-0.5 leading-none pointer-events-none bg-slate-100/90 text-slate-700 border border-slate-200">
            <Users className="w-2 h-2 text-slate-500" />
            <span>{guestCount > 0 ? `${guestCount}/${capacity}` : capacity}</span>
          </div>
        </div>
      </div>
    )
  }

  // ── 2. Type 2: Rectangle Table (3x1 Horizontal) ──
  if (tableType === 2) {
    const totalWidth = cellSize * 3
    const totalHeight = cellSize

    const topMask = Array.isArray(hideChairs.top) ? hideChairs.top : [false, false, false]
    const bottomMask = Array.isArray(hideChairs.bottom) ? hideChairs.bottom : [false, false, false]
    const hideLeft = Boolean(hideChairs.left)
    const hideRight = Boolean(hideChairs.right)

    const unblockedMask = [
      !topMask[0],
      !topMask[1],
      !topMask[2],
      !bottomMask[0],
      !bottomMask[1],
      !bottomMask[2],
      !hideLeft,
      !hideRight,
    ]
    const priorityOrder = [1, 4, 6, 7, 0, 3, 2, 5]
    const activeSlots = pickDynamicChairSlots(priorityOrder, unblockedMask, capacity)

    return (
      <div
        className="relative select-none"
        style={{ width: `${totalWidth}px`, height: `${totalHeight}px` }}
        onClick={(e) => {
          if (isQrPrintMode && onTogglePrintSelect) {
            e.stopPropagation()
            onTogglePrintSelect()
          }
        }}
      >
        {/* Top Chairs */}
        <div
          className="absolute top-0 w-full flex justify-around px-4 z-0"
          style={{ top: `${chairOffset}px` }}
        >
          {activeSlots.has(0) ? <Chair rotation={0} size={chairSize} /> : <div style={{ width: chairSize }} />}
          {activeSlots.has(1) ? <Chair rotation={0} size={chairSize} /> : <div style={{ width: chairSize }} />}
          {activeSlots.has(2) ? <Chair rotation={0} size={chairSize} /> : <div style={{ width: chairSize }} />}
        </div>

        {/* Bottom Chairs */}
        <div
          className="absolute bottom-0 w-full flex justify-around px-4 z-0"
          style={{ bottom: `${chairOffset}px` }}
        >
          {activeSlots.has(3) ? <Chair rotation={180} size={chairSize} /> : <div style={{ width: chairSize }} />}
          {activeSlots.has(4) ? <Chair rotation={180} size={chairSize} /> : <div style={{ width: chairSize }} />}
          {activeSlots.has(5) ? <Chair rotation={180} size={chairSize} /> : <div style={{ width: chairSize }} />}
        </div>

        {/* Left End Chair */}
        {activeSlots.has(6) && (
          <div
            className="absolute top-1/2 -translate-y-1/2 z-0"
            style={{ left: `${chairOffset}px` }}
          >
            <Chair rotation={270} size={chairSize} />
          </div>
        )}

        {/* Right End Chair */}
        {activeSlots.has(7) && (
          <div
            className="absolute top-1/2 -translate-y-1/2 z-0"
            style={{ right: `${chairOffset}px` }}
          >
            <Chair rotation={90} size={chairSize} />
          </div>
        )}

        {/* Tabletop Surface */}
        <div
          className={`relative z-10 w-full h-full rounded-xl flex flex-col items-center justify-center transition-all duration-150 ${getTabletopClasses()}`}
          style={getTabletopStyle()}
        >
          {renderTabletopBadges()}

          {/* QR Print Mode Checkbox */}
          {isQrPrintMode && (
            <div
              className={`absolute top-1.5 right-2 w-4 h-4 rounded-md flex items-center justify-center transition-all ${
                isPrintSelected
                  ? 'bg-[#14274E] text-[#E9C46A] shadow-xs'
                  : 'bg-white border-2 border-slate-400 text-transparent'
              }`}
            >
              <Check className="w-2.5 h-2.5 stroke-[3.5]" />
            </div>
          )}

          {/* Floating Rotate Corner Button */}
          {isEditMode && isSelected && onRotate && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onRotate()
              }}
              className="absolute -top-3 -right-3 z-30 w-7 h-7 rounded-full bg-[#14274E] text-[#E9C46A] hover:bg-[#203c73] hover:scale-110 active:scale-95 shadow-lg border-2 border-white flex items-center justify-center cursor-pointer transition-all"
              title="Rotate Table 90°"
            >
              <RotateCw className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>
          )}

          {/* Centered Table Number */}
          <span className="font-black text-sm sm:text-base tracking-tight leading-none text-[#14274E]">
            {tableNum}
          </span>

          {/* Corner Seat Counter */}
          <div className="absolute bottom-1.5 right-2 px-1.5 py-0.5 rounded-full text-[9px] font-black flex items-center gap-1 leading-none pointer-events-none bg-slate-100/90 text-slate-700 border border-slate-200">
            <Users className="w-2.5 h-2.5 text-slate-500" />
            <span>{guestCount > 0 ? `${guestCount}/${capacity}` : capacity}</span>
          </div>
        </div>
      </div>
    )
  }

  // ── 5. Type 5: Rectangle Table (Vertical 1x3) ──
  if (tableType === 5) {
    const totalWidth = cellSize
    const totalHeight = cellSize * 3

    const leftMask = Array.isArray(hideChairs.left) ? hideChairs.left : [false, false, false]
    const rightMask = Array.isArray(hideChairs.right) ? hideChairs.right : [false, false, false]
    const hideTop = Boolean(hideChairs.top)
    const hideBottom = Boolean(hideChairs.bottom)

    const unblockedMask = [
      !leftMask[0],
      !leftMask[1],
      !leftMask[2],
      !rightMask[0],
      !rightMask[1],
      !rightMask[2],
      !hideTop,
      !hideBottom,
    ]
    const priorityOrder = [1, 4, 6, 7, 0, 3, 2, 5]
    const activeSlots = pickDynamicChairSlots(priorityOrder, unblockedMask, capacity)

    return (
      <div
        className="relative select-none"
        style={{ width: `${totalWidth}px`, height: `${totalHeight}px` }}
        onClick={(e) => {
          if (isQrPrintMode && onTogglePrintSelect) {
            e.stopPropagation()
            onTogglePrintSelect()
          }
        }}
      >
        {/* Left Flank Chairs */}
        <div
          className="absolute left-0 h-full flex flex-col justify-around py-4 z-0"
          style={{ left: `${chairOffset}px` }}
        >
          {activeSlots.has(0) ? <Chair rotation={270} size={chairSize} /> : <div style={{ height: chairSize }} />}
          {activeSlots.has(1) ? <Chair rotation={270} size={chairSize} /> : <div style={{ height: chairSize }} />}
          {activeSlots.has(2) ? <Chair rotation={270} size={chairSize} /> : <div style={{ height: chairSize }} />}
        </div>

        {/* Right Flank Chairs */}
        <div
          className="absolute right-0 h-full flex flex-col justify-around py-4 z-0"
          style={{ right: `${chairOffset}px` }}
        >
          {activeSlots.has(3) ? <Chair rotation={90} size={chairSize} /> : <div style={{ height: chairSize }} />}
          {activeSlots.has(4) ? <Chair rotation={90} size={chairSize} /> : <div style={{ height: chairSize }} />}
          {activeSlots.has(5) ? <Chair rotation={90} size={chairSize} /> : <div style={{ height: chairSize }} />}
        </div>

        {/* Top End Chair */}
        {activeSlots.has(6) && (
          <div
            className="absolute left-1/2 -translate-x-1/2 z-0"
            style={{ top: `${chairOffset}px` }}
          >
            <Chair rotation={0} size={chairSize} />
          </div>
        )}

        {/* Bottom End Chair */}
        {activeSlots.has(7) && (
          <div
            className="absolute left-1/2 -translate-x-1/2 z-0"
            style={{ bottom: `${chairOffset}px` }}
          >
            <Chair rotation={180} size={chairSize} />
          </div>
        )}

        {/* Tabletop Surface */}
        <div
          className={`relative z-10 w-full h-full rounded-xl flex flex-col items-center justify-center transition-all duration-150 ${getTabletopClasses()}`}
          style={getTabletopStyle()}
        >
          {renderTabletopBadges()}

          {/* Floating Rotate Corner Button */}
          {isEditMode && isSelected && onRotate && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onRotate()
              }}
              className="absolute -top-3 -right-3 z-30 w-7 h-7 rounded-full bg-[#14274E] text-[#E9C46A] hover:bg-[#203c73] hover:scale-110 active:scale-95 shadow-lg border-2 border-white flex items-center justify-center cursor-pointer transition-all"
              title="Rotate Table 90°"
            >
              <RotateCw className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>
          )}

          {/* QR Print Mode Checkbox */}
          {isQrPrintMode && (
            <div
              className={`absolute top-1.5 right-2 w-4 h-4 rounded-md flex items-center justify-center transition-all ${
                isPrintSelected
                  ? 'bg-[#14274E] text-[#E9C46A] shadow-xs'
                  : 'bg-white border-2 border-slate-400 text-transparent'
              }`}
            >
              <Check className="w-2.5 h-2.5 stroke-[3.5]" />
            </div>
          )}

          {/* Centered Table Number */}
          <span className="font-black text-sm sm:text-base tracking-tight leading-none text-[#14274E]">
            {tableNum}
          </span>

          {/* Corner Seat Counter */}
          <div className="absolute bottom-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-black flex items-center gap-1 leading-none pointer-events-none bg-slate-100/90 text-slate-700 border border-slate-200">
            <Users className="w-2.5 h-2.5 text-slate-500" />
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

    const unblockedMask = [!hideTop, !hideBottom, !hideLeft, !hideRight]
    const priorityOrder = [0, 1, 2, 3]
    const activeSlots = pickDynamicChairSlots(priorityOrder, unblockedMask, capacity)

    return (
      <div
        className="relative select-none"
        style={{ width: `${cellSize}px`, height: `${cellSize}px` }}
        onClick={(e) => {
          if (isQrPrintMode && onTogglePrintSelect) {
            e.stopPropagation()
            onTogglePrintSelect()
          }
        }}
      >
        {activeSlots.has(0) && (
          <div
            className="absolute left-1/2 -translate-x-1/2 z-0"
            style={{ top: `${chairOffset}px` }}
          >
            <Chair rotation={0} size={chairSize} />
          </div>
        )}

        {activeSlots.has(1) && (
          <div
            className="absolute left-1/2 -translate-x-1/2 z-0"
            style={{ bottom: `${chairOffset}px` }}
          >
            <Chair rotation={180} size={chairSize} />
          </div>
        )}

        {activeSlots.has(2) && (
          <div
            className="absolute top-1/2 -translate-y-1/2 z-0"
            style={{ left: `${chairOffset}px` }}
          >
            <Chair rotation={270} size={chairSize} />
          </div>
        )}

        {activeSlots.has(3) && (
          <div
            className="absolute top-1/2 -translate-y-1/2 z-0"
            style={{ right: `${chairOffset}px` }}
          >
            <Chair rotation={90} size={chairSize} />
          </div>
        )}

        {/* Circular Tabletop Surface */}
        <div
          className={`relative z-10 w-full h-full rounded-full flex flex-col items-center justify-center transition-all duration-150 ${getTabletopClasses()}`}
          style={getTabletopStyle()}
        >
          {renderTabletopBadges()}

          {/* QR Print Mode Checkbox (Tucked in Top-Right Quadrant) */}
          {isQrPrintMode && (
            <div
              className={`absolute top-1.5 right-2 w-4 h-4 rounded-full flex items-center justify-center transition-all ${
                isPrintSelected
                  ? 'bg-[#14274E] text-[#E9C46A] shadow-xs'
                  : 'bg-white border-2 border-slate-400 text-transparent'
              }`}
            >
              <Check className="w-2.5 h-2.5 stroke-[3.5]" />
            </div>
          )}

          {/* Centered Table Number */}
          <span className="font-black text-sm sm:text-base tracking-tight leading-none text-[#14274E]">
            {tableNum}
          </span>

          {/* Seat Counter Below Table Number */}
          <div className="px-1.5 py-0.5 rounded-full text-[8px] font-black flex items-center gap-0.5 leading-none pointer-events-none mt-1 bg-slate-100/90 text-slate-700 border border-slate-200 shadow-2xs">
            <Users className="w-2 h-2 text-slate-500" />
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
    const radius = totalSize / 2 + Math.round(chairSize * 0.7)
    const angles = [0, 60, 120, 180, 240, 300]

    const unblockedMask = angles.map((_, i) => !radialMask[i])
    const priorityOrder = [0, 3, 2, 5, 1, 4]
    const activeSlots = pickDynamicChairSlots(priorityOrder, unblockedMask, capacity)

    return (
      <div
        className="relative select-none"
        style={{ width: `${totalSize}px`, height: `${totalSize}px` }}
        onClick={(e) => {
          if (isQrPrintMode && onTogglePrintSelect) {
            e.stopPropagation()
            onTogglePrintSelect()
          }
        }}
      >
        {/* Dynamic Radial Chairs */}
        {angles.map((deg, idx) => {
          if (!activeSlots.has(idx)) return null
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
          className={`relative z-10 w-full h-full rounded-full flex flex-col items-center justify-center transition-all duration-150 ${getTabletopClasses()}`}
          style={getTabletopStyle()}
        >
          {renderTabletopBadges()}

          {/* QR Print Mode Checkbox (Tucked in Top-Right Quadrant) */}
          {isQrPrintMode && (
            <div
              className={`absolute top-3 right-4 w-4.5 h-4.5 rounded-full flex items-center justify-center transition-all ${
                isPrintSelected
                  ? 'bg-[#14274E] text-[#E9C46A] shadow-xs'
                  : 'bg-white border-2 border-slate-400 text-transparent'
              }`}
            >
              <Check className="w-3 h-3 stroke-[3.5]" />
            </div>
          )}

          {/* Centered Table Number */}
          <span className="font-black text-lg sm:text-xl tracking-tight leading-none text-[#14274E]">
            {tableNum}
          </span>

          {/* Seat Counter Below Table Number */}
          <div className="px-2 py-0.5 rounded-full text-[9px] font-black flex items-center gap-1 leading-none pointer-events-none mt-1.5 bg-slate-100/90 text-slate-700 border border-slate-200 shadow-2xs">
            <Users className="w-2.5 h-2.5 text-slate-500" />
            <span>{guestCount > 0 ? `${guestCount}/${capacity}` : capacity}</span>
          </div>
        </div>
      </div>
    )
  }

  return null
})

TableVisual.displayName = 'TableVisual'
