import { useState, useMemo } from 'react'
import { Users, Package, TrendingUp, Layers } from 'lucide-react'
import type { TimeSeriesPoint } from '@/services/analyticsService'

interface CustomerDiningItemChartProps {
  data: TimeSeriesPoint[]
  height?: number
}

type MetricView = 'both' | 'pax' | 'items'

export function CustomerDiningItemChart({ data, height = 260 }: CustomerDiningItemChartProps) {
  const [activePoint, setActivePoint] = useState<TimeSeriesPoint | null>(null)
  const [metricView, setMetricView] = useState<MetricView>('both')
  const [tooltipPos, setTooltipPos] = useState<{
    x: number
    y: number
    alignX: 'left' | 'center' | 'right'
    alignY: 'top' | 'bottom'
  } | null>(null)

  // Summary computations
  const { totalPax, totalItems, avgItemsPerPax } = useMemo(() => {
    let pSum = 0
    let iSum = 0
    for (const d of data ?? []) {
      pSum += d.customerCount ?? 0
      iSum += d.itemCount ?? 0
    }
    const ratio = pSum > 0 ? (iSum / pSum).toFixed(1) : '—'
    return { totalPax: pSum, totalItems: iSum, avgItemsPerPax: ratio }
  }, [data])

  if (!data || data.length === 0) {
    return (
      <div className="h-52 flex items-center justify-center text-slate-400 text-xs italic bg-slate-50/50 rounded-xl border border-slate-100">
        No customer dining or item order data recorded for this period.
      </div>
    )
  }

  // Dual axis maximums
  const maxPaxRaw = Math.max(...data.map((d) => d.customerCount ?? 0), 2)
  const maxItemsRaw = Math.max(...data.map((d) => d.itemCount ?? 0), 2)

  const yTicksCount = 4
  const paxTickStep = Math.ceil(maxPaxRaw / yTicksCount) || 1
  const adjustedMaxPax = paxTickStep * yTicksCount

  const itemsTickStep = Math.ceil(maxItemsRaw / yTicksCount) || 1
  const adjustedMaxItems = itemsTickStep * yTicksCount

  // SVG layout dimensions
  const svgWidth = 680
  const svgHeight = height
  const padLeft = 46
  const padRight = 46
  const padTop = 22
  const padBottom = 34

  const chartWidth = svgWidth - padLeft - padRight
  const chartHeight = svgHeight - padTop - padBottom

  // Coordinates calculation
  const points = data.map((d, index) => {
    const x = padLeft + (index / Math.max(data.length - 1, 1)) * chartWidth
    const paxVal = d.customerCount ?? 0
    const itemsVal = d.itemCount ?? 0

    const yPax = padTop + chartHeight - (paxVal / adjustedMaxPax) * chartHeight
    const yItems = padTop + chartHeight - (itemsVal / adjustedMaxItems) * chartHeight

    return { x, yPax, yItems, data: d }
  })

  // Pax line & area SVG paths
  const paxLinePath = points.reduce((acc, p, idx) => {
    return idx === 0 ? `M ${p.x} ${p.yPax}` : `${acc} L ${p.x} ${p.yPax}`
  }, '')

  const paxAreaPath =
    points.length > 0
      ? `${paxLinePath} L ${points[points.length - 1].x} ${padTop + chartHeight} L ${points[0].x} ${padTop + chartHeight} Z`
      : ''

  // Items line & area SVG paths
  const itemsLinePath = points.reduce((acc, p, idx) => {
    return idx === 0 ? `M ${p.x} ${p.yItems}` : `${acc} L ${p.x} ${p.yItems}`
  }, '')

  const itemsAreaPath =
    points.length > 0
      ? `${itemsLinePath} L ${points[points.length - 1].x} ${padTop + chartHeight} L ${points[0].x} ${padTop + chartHeight} Z`
      : ''

  // Label sampling for X axis
  const step = Math.ceil(data.length / 8)

  return (
    <div className="flex flex-col gap-3">
      {/* ── Header Summary Bar & Metric Filters ── */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2 border-b border-slate-100">
        {/* KPI Badges */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Seated Pax Badge */}
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-100/80 text-xs font-bold text-[#14274E]">
            <span className="w-2 h-2 rounded-full bg-[#14274E]" />
            <Users className="w-3.5 h-3.5 text-indigo-600" />
            <span>Seated Pax:</span>
            <strong className="text-indigo-900 font-black">{totalPax.toLocaleString()} diners</strong>
          </div>

          {/* Items Ordered Badge */}
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-100/80 text-xs font-bold text-amber-900">
            <span className="w-2 h-2 rounded-full bg-[#D97706]" />
            <Package className="w-3.5 h-3.5 text-amber-600" />
            <span>Items Ordered:</span>
            <strong className="text-amber-950 font-black">{totalItems.toLocaleString()} items</strong>
          </div>

          {/* Ratio Badge */}
          <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs font-medium text-slate-600">
            <TrendingUp className="w-3.5 h-3.5 text-slate-500" />
            <span>Avg:</span>
            <strong className="text-slate-800 font-bold">{avgItemsPerPax} items/diner</strong>
          </div>
        </div>

        {/* View Toggle */}
        <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 text-[11px] font-bold text-slate-600 no-print">
          <button
            type="button"
            onClick={() => setMetricView('both')}
            className={`px-2.5 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1 ${
              metricView === 'both' ? 'bg-white text-[#14274E] shadow-xs' : 'hover:text-slate-900'
            }`}
          >
            <Layers className="w-3 h-3 text-indigo-500" />
            <span>Both</span>
          </button>
          <button
            type="button"
            onClick={() => setMetricView('pax')}
            className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
              metricView === 'pax' ? 'bg-white text-[#14274E] shadow-xs' : 'hover:text-slate-900'
            }`}
          >
            Seated Pax
          </button>
          <button
            type="button"
            onClick={() => setMetricView('items')}
            className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
              metricView === 'items' ? 'bg-white text-[#14274E] shadow-xs' : 'hover:text-slate-900'
            }`}
          >
            Items Ordered
          </button>
        </div>
      </div>

      {/* ── SVG Chart ── */}
      <div className="relative w-full overflow-visible select-none">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto max-h-[320px] overflow-visible"
          onMouseLeave={() => {
            setActivePoint(null)
            setTooltipPos(null)
          }}
        >
          <defs>
            {/* Seated Pax Gradient */}
            <linearGradient id="paxGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#14274E" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#14274E" stopOpacity="0.01" />
            </linearGradient>

            {/* Items Ordered Gradient */}
            <linearGradient id="itemsGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#E9C46A" stopOpacity="0.32" />
              <stop offset="100%" stopColor="#E9C46A" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Horizontal Grid lines & Dual Y-Axis Labels */}
          {Array.from({ length: yTicksCount + 1 }).map((_, i) => {
            const paxVal = paxTickStep * (yTicksCount - i)
            const itemsVal = itemsTickStep * (yTicksCount - i)
            const yPos = padTop + (i / yTicksCount) * chartHeight

            return (
              <g key={i}>
                {/* Horizontal Guide */}
                <line
                  x1={padLeft}
                  y1={yPos}
                  x2={svgWidth - padRight}
                  y2={yPos}
                  stroke="#E2E8F0"
                  strokeDasharray={i === yTicksCount ? 'none' : '3 3'}
                  strokeWidth="1"
                />

                {/* Left Y Axis (Seated Pax - Navy) */}
                {(metricView === 'both' || metricView === 'pax') && (
                  <text
                    x={padLeft - 8}
                    y={yPos + 3.5}
                    textAnchor="end"
                    className="fill-[#14274E] font-bold text-[9px]"
                  >
                    {paxVal}
                  </text>
                )}

                {/* Right Y Axis (Items Ordered - Amber) */}
                {(metricView === 'both' || metricView === 'items') && (
                  <text
                    x={svgWidth - padRight + 8}
                    y={yPos + 3.5}
                    textAnchor="start"
                    className="fill-[#D97706] font-bold text-[9px]"
                  >
                    {itemsVal}
                  </text>
                )}
              </g>
            )
          })}

          {/* Left Y Axis Title */}
          {(metricView === 'both' || metricView === 'pax') && (
            <text
              x={padLeft - 10}
              y={padTop - 8}
              textAnchor="end"
              className="fill-[#14274E] font-extrabold text-[9px]"
            >
              Pax
            </text>
          )}

          {/* Right Y Axis Title */}
          {(metricView === 'both' || metricView === 'items') && (
            <text
              x={svgWidth - padRight + 8}
              y={padTop - 8}
              textAnchor="start"
              className="fill-[#D97706] font-extrabold text-[9px]"
            >
              Items
            </text>
          )}

          {/* ── Metric 2: Items Ordered Area & Stroke (Warm Amber / Gold) ── */}
          {(metricView === 'both' || metricView === 'items') && (
            <>
              <path d={itemsAreaPath} fill="url(#itemsGradient)" />
              <path
                d={itemsLinePath}
                fill="none"
                stroke="#D97706"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          )}

          {/* ── Metric 1: Seated Pax Area & Stroke (Navy / Indigo) ── */}
          {(metricView === 'both' || metricView === 'pax') && (
            <>
              <path d={paxAreaPath} fill="url(#paxGradient)" />
              <path
                d={paxLinePath}
                fill="none"
                stroke="#14274E"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          )}

          {/* ── Interactive Points & Hover Anchors ── */}
          {points.map((p, i) => {
            const isHovered = activePoint === p.data

            return (
              <g key={i}>
                {/* Items Dot */}
                {(metricView === 'both' || metricView === 'items') &&
                  (p.data.itemCount > 0 || isHovered) && (
                    <circle
                      cx={p.x}
                      cy={p.yItems}
                      r={isHovered ? 5 : 3}
                      fill={isHovered ? '#D97706' : '#F59E0B'}
                      stroke="#FFFFFF"
                      strokeWidth="2"
                      className="transition-all duration-100"
                    />
                  )}

                {/* Pax Dot */}
                {(metricView === 'both' || metricView === 'pax') &&
                  ((p.data.customerCount ?? 0) > 0 || isHovered) && (
                    <circle
                      cx={p.x}
                      cy={p.yPax}
                      r={isHovered ? 5.5 : 3.5}
                      fill={isHovered ? '#E9C46A' : '#14274E'}
                      stroke="#FFFFFF"
                      strokeWidth="2"
                      className="transition-all duration-100"
                    />
                  )}

                {/* Invisible large target for hovering */}
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
                      const py = Math.min(
                        (p.yPax / svgHeight) * rect.height,
                        (p.yItems / svgHeight) * rect.height,
                      )
                      const alignX =
                        p.x > svgWidth - 130 ? 'right' : p.x < padLeft + 70 ? 'left' : 'center'
                      const alignY = py < padTop + 60 ? 'bottom' : 'top'
                      setTooltipPos({ x: px, y: py, alignX, alignY })
                    }
                  }}
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

        {/* ── Floating HTML Tooltip ── */}
        {activePoint && tooltipPos && (
          <div
            className="absolute z-40 pointer-events-none bg-[#14274E] text-white px-3.5 py-2.5 rounded-xl shadow-2xl border border-slate-700 text-xs whitespace-nowrap transition-all duration-75 min-w-[160px]"
            style={{
              left: `${tooltipPos.x}px`,
              top: `${tooltipPos.y}px`,
              transform: `translate(${
                tooltipPos.alignX === 'right' ? '-100%' : tooltipPos.alignX === 'left' ? '0%' : '-50%'
              }, ${tooltipPos.alignY === 'bottom' ? '12px' : 'calc(-100% - 12px)'})`,
            }}
          >
            <div className="text-[11px] font-extrabold text-[#E9C46A] mb-1 pb-1 border-b border-slate-700/80 flex items-center justify-between">
              <span>{activePoint.key}</span>
              <span className="text-[9px] text-slate-400 font-medium">
                {activePoint.orderCount} {activePoint.orderCount === 1 ? 'order' : 'orders'}
              </span>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5 text-slate-300 text-[11px]">
                  <span className="w-2 h-2 rounded-full bg-indigo-400" />
                  Seated Pax:
                </span>
                <strong className="text-white font-black text-xs">
                  {activePoint.customerCount != null ? `${activePoint.customerCount} diners` : '—'}
                </strong>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5 text-slate-300 text-[11px]">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  Items Ordered:
                </span>
                <strong className="text-[#E9C46A] font-black text-xs">
                  {activePoint.itemCount} items
                </strong>
              </div>

              {activePoint.customerCount && activePoint.customerCount > 0 ? (
                <div className="pt-1 mt-1 border-t border-slate-700/60 flex items-center justify-between text-[10px] text-slate-300">
                  <span>Items / Diner:</span>
                  <span className="font-bold text-indigo-300">
                    {(activePoint.itemCount / activePoint.customerCount).toFixed(1)}
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
