import { useState } from 'react'
import type { TimeSeriesPoint } from '@/services/analyticsService'

interface AreaChartProps {
  data: TimeSeriesPoint[]
  height?: number
}

export function AreaChart({ data, height = 240 }: AreaChartProps) {
  const [activePoint, setActivePoint] = useState<TimeSeriesPoint | null>(null)
  const [tooltipPos, setTooltipPos] = useState<{
    x: number
    y: number
    alignX: 'left' | 'center' | 'right'
    alignY: 'top' | 'bottom'
  } | null>(null)

  if (!data || data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-slate-400 text-xs italic">
        No revenue data recorded for this period.
      </div>
    )
  }

  const maxRevenue = Math.max(...data.map((d) => d.revenue), 100)
  const yTicksCount = 4
  const yTickStep = maxRevenue / yTicksCount

  // SVG dimensions
  const svgWidth = 640
  const svgHeight = height
  const padLeft = 60
  const padRight = 20
  const padTop = 20
  const padBottom = 35

  const chartWidth = svgWidth - padLeft - padRight
  const chartHeight = svgHeight - padTop - padBottom

  // Coordinates calculation
  const points = data.map((d, index) => {
    const x = padLeft + (index / Math.max(data.length - 1, 1)) * chartWidth
    const y = padTop + chartHeight - (d.revenue / maxRevenue) * chartHeight
    return { x, y, data: d }
  })

  // Build SVG path
  const linePath = points.reduce((acc, p, idx) => {
    return idx === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`
  }, '')

  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1].x} ${padTop + chartHeight} L ${points[0].x} ${padTop + chartHeight} Z`
      : ''

  // Format currency for Y axis ticks
  const formatYTick = (val: number) => {
    if (val >= 1000000) return `₱${(val / 1000000).toFixed(1)}M`
    if (val >= 1000) return `₱${(val / 1000).toFixed(0)}k`
    return `₱${Math.round(val)}`
  }

  // Label sampling for X axis so labels don't collide
  const step = Math.ceil(data.length / 8)

  return (
    <div className="relative w-full overflow-visible select-none">
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="w-full h-auto max-h-[300px] overflow-visible"
        onMouseLeave={() => {
          setActivePoint(null)
          setTooltipPos(null)
        }}
      >
        <defs>
          <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#14274E" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#14274E" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Y Axis Grid lines and labels */}
        {Array.from({ length: yTicksCount + 1 }).map((_, i) => {
          const val = yTickStep * (yTicksCount - i)
          const yPos = padTop + (i / yTicksCount) * chartHeight
          return (
            <g key={i}>
              <line
                x1={padLeft}
                y1={yPos}
                x2={svgWidth - padRight}
                y2={yPos}
                stroke="#E2E8F0"
                strokeDasharray={i === yTicksCount ? 'none' : '3 3'}
                strokeWidth="1"
              />
              <text
                x={padLeft - 8}
                y={yPos + 3.5}
                textAnchor="end"
                className="fill-slate-400 font-medium text-[9px]"
              >
                {formatYTick(val)}
              </text>
            </g>
          )
        })}

        {/* Gradient fill area */}
        <path d={areaPath} fill="url(#revenueGradient)" />

        {/* Line stroke */}
        <path d={linePath} fill="none" stroke="#14274E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Interactive points & hover anchors */}
        {points.map((p, i) => (
          <g key={i}>
            {/* Visible dot if point has value or is active */}
            {(p.data.revenue > 0 || activePoint === p.data) && (
              <circle
                cx={p.x}
                cy={p.y}
                r={activePoint === p.data ? 5 : 3}
                fill={activePoint === p.data ? '#E9C46A' : '#14274E'}
                stroke="#FFFFFF"
                strokeWidth="2"
                className="transition-all duration-100"
              />
            )}

            {/* Invisible large target for easy hovering */}
            <rect
              x={p.x - chartWidth / (data.length * 2)}
              y={padTop}
              width={chartWidth / data.length}
              height={chartHeight}
              fill="transparent"
              className="cursor-pointer"
              onMouseEnter={(e) => {
                setActivePoint(p.data)
                const rect = e.currentTarget.ownerSVGElement?.getBoundingClientRect()
                if (rect) {
                  const px = (p.x / svgWidth) * rect.width
                  const py = (p.y / svgHeight) * rect.height
                  // Collision avoidance: right edge, left edge, top edge
                  const alignX = p.x > svgWidth - 110 ? 'right' : p.x < padLeft + 70 ? 'left' : 'center'
                  const alignY = p.y < padTop + 50 ? 'bottom' : 'top'
                  setTooltipPos({ x: px, y: py, alignX, alignY })
                }
              }}
            />
          </g>
        ))}

        {/* Active hover crosshair line */}
        {activePoint && (
          <line
            x1={points.find((p) => p.data === activePoint)?.x}
            y1={padTop}
            x2={points.find((p) => p.data === activePoint)?.x}
            y2={padTop + chartHeight}
            stroke="#9BA4B4"
            strokeDasharray="2 2"
            strokeWidth="1.5"
          />
        )}

        {/* X Axis Labels */}
        {points.map((p, idx) => {
          if (idx % step !== 0 && idx !== points.length - 1) return null
          return (
            <text
              key={idx}
              x={p.x}
              y={svgHeight - 10}
              textAnchor="middle"
              className="fill-slate-500 font-semibold text-[9.5px]"
            >
              {p.data.key}
            </text>
          )
        })}
      </svg>

      {/* Floating HTML tooltip */}
      {activePoint && tooltipPos && (
        <div
          className="absolute z-40 pointer-events-none bg-[#14274E] text-white px-3 py-2 rounded-xl shadow-2xl border border-slate-700 text-xs whitespace-nowrap transition-all duration-75"
          style={{
            left: `${tooltipPos.x}px`,
            top: `${tooltipPos.y}px`,
            transform: `translate(${
              tooltipPos.alignX === 'right' ? '-100%' : tooltipPos.alignX === 'left' ? '0%' : '-50%'
            }, ${tooltipPos.alignY === 'bottom' ? '12px' : 'calc(-100% - 10px)'})`,
          }}
        >
          <div className="text-[10px] font-bold text-[#E9C46A]">{activePoint.key}</div>
          <div className="font-extrabold text-sm text-white">
            ₱{activePoint.revenue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-300">
            {activePoint.orderCount} {activePoint.orderCount === 1 ? 'order' : 'orders'}
          </div>
        </div>
      )}
    </div>
  )
}
