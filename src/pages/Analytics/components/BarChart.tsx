import { useState } from 'react'
import type { TimeSeriesPoint } from '@/services/analyticsService'

interface BarChartProps {
  data: TimeSeriesPoint[]
  height?: number
}

export function BarChart({ data, height = 240 }: BarChartProps) {
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
        No order data recorded for this period.
      </div>
    )
  }

  const maxOrders = Math.max(...data.map((d) => d.orderCount), 4)
  const yTicksCount = 4
  const yTickStep = Math.ceil(maxOrders / yTicksCount)
  const adjustedMax = yTickStep * yTicksCount

  // SVG dimensions
  const svgWidth = 640
  const svgHeight = height
  const padLeft = 45
  const padRight = 20
  const padTop = 20
  const padBottom = 35

  const chartWidth = svgWidth - padLeft - padRight
  const chartHeight = svgHeight - padTop - padBottom

  const slotWidth = chartWidth / data.length
  const barWidth = Math.max(Math.min(slotWidth * 0.65, 28), 3)

  // Label sampling for X axis
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
                {val}
              </text>
            </g>
          )
        })}

        {/* Vertical Bars */}
        {data.map((d, index) => {
          const barHeight = (d.orderCount / adjustedMax) * chartHeight
          const x = padLeft + index * slotWidth + (slotWidth - barWidth) / 2
          const y = padTop + chartHeight - barHeight
          const isHovered = activePoint === d

          return (
            <g key={index}>
              {/* Visible Bar */}
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(barHeight, d.orderCount > 0 ? 2 : 0)}
                rx={Math.min(barWidth / 2, 3)}
                fill={isHovered ? '#E9C46A' : '#394867'}
                className="transition-colors duration-150 cursor-pointer"
              />

              {/* Invisible touch target */}
              <rect
                x={padLeft + index * slotWidth}
                y={padTop}
                width={slotWidth}
                height={chartHeight}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={(e) => {
                  setActivePoint(d)
                  const rect = e.currentTarget.ownerSVGElement?.getBoundingClientRect()
                  if (rect) {
                    const centerX = x + barWidth / 2
                    const px = (centerX / svgWidth) * rect.width
                    const py = (y / svgHeight) * rect.height
                    const alignX = centerX > svgWidth - 110 ? 'right' : centerX < padLeft + 70 ? 'left' : 'center'
                    const alignY = y < padTop + 50 ? 'bottom' : 'top'
                    setTooltipPos({ x: px, y: py, alignX, alignY })
                  }
                }}
              />
            </g>
          )
        })}

        {/* X Axis Labels */}
        {data.map((d, idx) => {
          if (idx % step !== 0 && idx !== data.length - 1) return null
          const x = padLeft + idx * slotWidth + slotWidth / 2
          return (
            <text
              key={idx}
              x={x}
              y={svgHeight - 10}
              textAnchor="middle"
              className="fill-slate-500 font-semibold text-[9.5px]"
            >
              {d.key}
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
            {activePoint.orderCount} {activePoint.orderCount === 1 ? 'order' : 'orders'}
          </div>
          <div className="text-[10px] text-slate-300">
            ₱{activePoint.revenue.toLocaleString('en-PH', { minimumFractionDigits: 2 })} revenue
          </div>
        </div>
      )}
    </div>
  )
}
