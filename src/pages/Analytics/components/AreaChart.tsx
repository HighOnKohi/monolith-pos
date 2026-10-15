import { useState, useRef } from 'react'
import type { RevenueChartPoint } from '../utils/revenueTimelineBuilder'
import type { TimeSeriesPoint } from '@/services/analyticsService'

// Allow either RevenueChartPoint or legacy TimeSeriesPoint
type ChartPointItem = RevenueChartPoint | TimeSeriesPoint

interface AreaChartProps {
  data: ChartPointItem[]
  height?: number
}

export function AreaChart({ data, height = 250 }: AreaChartProps) {
  const [activePoint, setActivePoint] = useState<ChartPointItem | null>(null)
  const [tooltipPos, setTooltipPos] = useState<{
    x: number
    y: number
    alignX: 'left' | 'center' | 'right'
    alignY: 'top' | 'bottom'
  } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  if (!data || data.length === 0) {
    return (
      <div className="h-52 flex items-center justify-center text-slate-400 text-xs italic">
        No revenue data recorded for this period.
      </div>
    )
  }

  const maxRevenue = Math.max(...data.map((d) => d.revenue), 100)
  const yTicksCount = 4
  const yTickStep = maxRevenue / yTicksCount

  // Minimum spacing per point: ensures every point has at least 52px of breathing room
  // If total points exceed normal container width, it smoothly overflows horizontally to scroll!
  const padLeft = 52
  const padRight = 24
  const padTop = 24
  const padBottom = 42
  const minPointSpacing = 52
  const baseWidth = 1000

  const svgWidth = Math.max(
    baseWidth,
    padLeft + padRight + Math.max(data.length - 1, 1) * minPointSpacing,
  )
  const svgHeight = height

  const chartWidth = svgWidth - padLeft - padRight
  const chartHeight = svgHeight - padTop - padBottom

  // Coordinates calculation
  const points = data.map((d, index) => {
    const x =
      data.length === 1
        ? padLeft + chartWidth / 2
        : padLeft + (index / (data.length - 1)) * chartWidth
    const y = padTop + chartHeight - (d.revenue / maxRevenue) * chartHeight
    return { x, y, data: d }
  })

  // Build SVG paths
  const linePath = points.reduce((acc, p, idx) => {
    return idx === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`
  }, '')

  const actualMaxRevenue = Math.max(...data.map((d) => d.revenue), 0)
  const highestRevenueIndex =
    actualMaxRevenue > 0 ? data.findIndex((d) => d.revenue === actualMaxRevenue) : -1

  // Gradient fill area
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

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-x-auto overflow-y-visible select-none pb-2 scrollbar-thin scrollbar-thumb-slate-200 hover:scrollbar-thumb-slate-300"
    >
      <div style={{ minWidth: `${svgWidth}px`, width: '100%' }}>
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto max-h-[300px] overflow-visible"
          onMouseLeave={() => {
            setActivePoint(null)
            setTooltipPos(null)
          }}
        >
          <defs>
            <linearGradient id="revenueLineGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#14274E" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#14274E" stopOpacity="0.01" />
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
                  stroke="#F1F5F9"
                  strokeWidth="1"
                />
                <text
                  x={padLeft - 10}
                  y={yPos + 3.5}
                  textAnchor="end"
                  className="fill-slate-400 font-semibold text-[10px]"
                >
                  {formatYTick(val)}
                </text>
              </g>
            )
          })}

          {/* Subtle vertical indicator on Week, Year, or Latest milestones */}
          {points.map((p, idx) => {
            const item = p.data as RevenueChartPoint
            if (!item.isMilestone) return null
            return (
              <line
                key={`milestone-line-${idx}`}
                x1={p.x}
                y1={padTop}
                x2={p.x}
                y2={padTop + chartHeight}
                stroke="#E2E8F0"
                strokeDasharray="3 3"
                strokeWidth="1.2"
              />
            )
          })}

          {/* Gradient fill area */}
          <path d={areaPath} fill="url(#revenueLineGradient)" />

          {/* Line stroke spanning full width */}
          <path
            d={linePath}
            fill="none"
            stroke="#14274E"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Peak / Highest Highlight Ring (Visible in every filter) */}
          {points.map((p, idx) => {
            const item = p.data as RevenueChartPoint
            const isHighest = idx === highestRevenueIndex || Boolean(item.isPeak)
            if (!isHighest) return null
            return (
              <g key={`highest-halo-${idx}`}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r="13"
                  fill="#E9C46A"
                  fillOpacity="0.16"
                />
                <circle
                  cx={p.x}
                  cy={p.y}
                  r="8.5"
                  fill="none"
                  stroke="#E9C46A"
                  strokeWidth="2.5"
                  opacity="0.95"
                />
              </g>
            )
          })}

          {/* Active hover crosshair line */}
          {activePoint && (
            <line
              x1={points.find((p) => p.data === activePoint)?.x}
              y1={padTop}
              x2={points.find((p) => p.data === activePoint)?.x}
              y2={padTop + chartHeight}
              stroke="#94A3B8"
              strokeDasharray="2 2"
              strokeWidth="1.5"
            />
          )}

          {/* Interactive points & hover anchors */}
          {points.map((p, i) => {
            const item = p.data as RevenueChartPoint
            const isMilestone = item.isMilestone
            const isHighest = i === highestRevenueIndex || Boolean(item.isPeak)
            const isHovered = activePoint === p.data

            return (
              <g key={i}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isHovered ? 6.5 : isHighest ? 5.5 : isMilestone ? 4.5 : 3.5}
                  fill={isHovered ? '#E9C46A' : isHighest ? '#E9C46A' : '#14274E'}
                  stroke={isHovered ? '#FFFFFF' : isHighest ? '#14274E' : isMilestone ? '#2563EB' : '#FFFFFF'}
                  strokeWidth={isHovered ? 2.5 : isHighest ? 2 : isMilestone ? 1.5 : 1.5}
                  className="transition-all duration-100"
                />

                {/* Invisible large target for easy hovering */}
                <rect
                  x={p.x - chartWidth / (data.length * 2)}
                  y={padTop}
                  width={Math.max(chartWidth / data.length, 20)}
                  height={chartHeight + padBottom}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={(e) => {
                    setActivePoint(p.data)
                    const svgRect = e.currentTarget.ownerSVGElement?.getBoundingClientRect()
                    const containerRect = containerRef.current?.getBoundingClientRect()
                    if (svgRect && containerRect) {
                      const px = (p.x / svgWidth) * svgRect.width - (containerRef.current?.scrollLeft || 0)
                      const py = (p.y / svgHeight) * svgRect.height
                      const alignX =
                        px > containerRect.width - 140 ? 'right' : px < 100 ? 'left' : 'center'
                      const alignY = py < padTop + 60 ? 'bottom' : 'top'
                      setTooltipPos({ x: px, y: py, alignX, alignY })
                    }
                  }}
                />
              </g>
            )
          })}

          {/* X Axis Labels at the Footer of the Graph */}
          {points.map((p, idx) => {
            const item = p.data as RevenueChartPoint
            const isLatest = item.milestoneShort === 'Latest'
            const isWeek = item.milestoneShort === 'Week'
            const isYear = item.milestoneShort === 'Year'
            const isHighest = idx === highestRevenueIndex || Boolean(item.isPeak)

            const footerTag = isHighest
              ? 'Peak'
              : isLatest
                ? 'Latest'
                : isWeek
                  ? 'Week'
                  : isYear
                    ? 'Year'
                    : null

            return (
              <g key={`x-label-${idx}`}>
                {/* Date or Month or Year on Line 1 */}
                <text
                  x={p.x}
                  y={svgHeight - (footerTag ? 16 : 12)}
                  textAnchor="middle"
                  className={`font-semibold text-[10px] ${
                    footerTag
                      ? 'fill-[#14274E] font-black'
                      : 'fill-slate-500'
                  }`}
                >
                  {p.data.key}
                </text>

                {/* Tag below the date on Line 2: Week, Year, Latest, or Peak */}
                {footerTag && (
                  <text
                    x={p.x}
                    y={svgHeight - 4}
                    textAnchor="middle"
                    className={`font-bold text-[8.5px] uppercase tracking-wider ${
                      isHighest
                        ? 'fill-[#D97706]'
                        : isLatest
                          ? 'fill-[#2563EB]'
                          : 'fill-[#14274E]'
                    }`}
                  >
                    {footerTag}
                  </text>
                )}
              </g>
            )
          })}
        </svg>

        {/* Clean Floating HTML Tooltip */}
        {activePoint && tooltipPos && (
          <div
            className="absolute z-40 pointer-events-none bg-[#14274E] text-white px-3.5 py-2 rounded-xl shadow-xl border border-slate-700 text-xs whitespace-nowrap transition-all duration-75"
            style={{
              left: `${tooltipPos.x}px`,
              top: `${tooltipPos.y}px`,
              transform: `translate(${
                tooltipPos.alignX === 'right' ? '-100%' : tooltipPos.alignX === 'left' ? '0%' : '-50%'
              }, ${tooltipPos.alignY === 'bottom' ? '12px' : 'calc(-100% - 12px)'})`,
            }}
          >
            <div className="flex items-center gap-2 text-[11px] font-bold text-[#E9C46A] mb-1">
              <span>
                {(activePoint as RevenueChartPoint).sublabel || activePoint.key}
              </span>
              {((activePoint as RevenueChartPoint).isPeak ||
                (actualMaxRevenue > 0 && activePoint.revenue === actualMaxRevenue)) && (
                <span className="px-1.5 py-0.5 rounded bg-[#E9C46A] text-[#14274E] text-[9px] font-black">
                  Peak
                </span>
              )}
              {(activePoint as RevenueChartPoint).milestoneShort && (
                <span
                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                    (activePoint as RevenueChartPoint).milestoneShort === 'Latest'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700 text-[#E9C46A]'
                  }`}
                >
                  {(activePoint as RevenueChartPoint).milestoneShort}
                </span>
              )}
            </div>

            <div className="font-black text-sm text-white">
              ₱{activePoint.revenue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
