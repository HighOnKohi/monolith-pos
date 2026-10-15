import { useState, useMemo, useRef } from 'react'
import type { TimeSeriesPoint } from '@/services/analyticsService'
import type { RevenueChartPoint } from '../utils/revenueTimelineBuilder'
import { Eye, EyeOff } from 'lucide-react'

interface CustomerDiningItemChartProps {
  data: (TimeSeriesPoint | RevenueChartPoint)[]
  height?: number
}

export function CustomerDiningItemChart({ data, height = 250 }: CustomerDiningItemChartProps) {
  const [activePoint, setActivePoint] = useState<(TimeSeriesPoint | RevenueChartPoint) | null>(null)
  const [hoveredSeries, setHoveredSeries] = useState<'pax' | 'items' | 'avg' | null>(null)
  const [showPax, setShowPax] = useState(true)
  const [showItems, setShowItems] = useState(true)
  const [showAvg, setShowAvg] = useState(true)

  const [tooltipPos, setTooltipPos] = useState<{
    x: number
    y: number
    alignX: 'left' | 'center' | 'right'
    alignY: 'top' | 'bottom'
  } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  // Summary computations
  const { totalPax, totalItems, totalAvg } = useMemo(() => {
    let pSum = 0
    let iSum = 0
    for (const d of data ?? []) {
      pSum += d.customerCount ?? 0
      iSum += d.itemCount ?? 0
    }
    const avgSum = Math.round((pSum + iSum) / 2)
    return { totalPax: pSum, totalItems: iSum, totalAvg: avgSum }
  }, [data])

  if (!data || data.length === 0) {
    return (
      <div className="h-52 flex items-center justify-center text-slate-400 text-xs italic bg-slate-50/50 rounded-xl border border-slate-100">
        No customer dining or item order data recorded for this period.
      </div>
    )
  }

  // Calculate highest points for all 3 lines
  const maxPaxRaw = Math.max(...data.map((d) => d.customerCount ?? 0), 0)
  const highestPaxIndex =
    maxPaxRaw > 0 ? data.findIndex((d) => (d.customerCount ?? 0) === maxPaxRaw) : -1

  const maxItemsRaw = Math.max(...data.map((d) => d.itemCount ?? 0), 0)
  const highestItemsIndex =
    maxItemsRaw > 0 ? data.findIndex((d) => (d.itemCount ?? 0) === maxItemsRaw) : -1

  const maxAvgRaw = Math.max(
    ...data.map((d) => ((d.customerCount ?? 0) + (d.itemCount ?? 0)) / 2),
    0,
  )
  // The Average line is the definitive determiner of the Peak Hour!
  const highestAvgIndex =
    maxAvgRaw > 0
      ? data.findIndex((d) => ((d.customerCount ?? 0) + (d.itemCount ?? 0)) / 2 === maxAvgRaw)
      : -1

  // Dynamic axis max based on currently visible lines
  const visibleMaxRaw = Math.max(
    showPax ? maxPaxRaw : 0,
    showItems ? maxItemsRaw : 0,
    showAvg ? maxAvgRaw : 0,
    2,
  )

  const yTicksCount = 4
  const tickStep = Math.ceil(visibleMaxRaw / yTicksCount) || 1
  const adjustedMax = tickStep * yTicksCount

  // SVG layout dimensions with minimum spacing so points never collide and overflow horizontally
  const padLeft = 45
  const padRight = 30
  const padTop = 24
  const padBottom = 38
  const minPointSpacing = 52
  const baseWidth = 1000

  const svgWidth = Math.max(
    baseWidth,
    padLeft + padRight + Math.max(data.length - 1, 1) * minPointSpacing,
  )
  const svgHeight = height

  const chartWidth = svgWidth - padLeft - padRight
  const chartHeight = svgHeight - padTop - padBottom

  // Coordinates calculation for all 3 lines
  const points = data.map((d, index) => {
    const x =
      data.length === 1
        ? padLeft + chartWidth / 2
        : padLeft + (index / (data.length - 1)) * chartWidth
    const paxVal = d.customerCount ?? 0
    const itemsVal = d.itemCount ?? 0
    const avgVal = Math.round(((paxVal + itemsVal) / 2) * 10) / 10

    const yPax = padTop + chartHeight - (paxVal / adjustedMax) * chartHeight
    const yItems = padTop + chartHeight - (itemsVal / adjustedMax) * chartHeight
    const yAvg = padTop + chartHeight - (avgVal / adjustedMax) * chartHeight

    return { x, yPax, yItems, yAvg, paxVal, itemsVal, avgVal, data: d }
  })

  // 1. Pax line & area SVG paths
  const paxLinePath = points.reduce((acc, p, idx) => {
    return idx === 0 ? `M ${p.x} ${p.yPax}` : `${acc} L ${p.x} ${p.yPax}`
  }, '')

  const paxAreaPath =
    points.length > 0
      ? `${paxLinePath} L ${points[points.length - 1].x} ${padTop + chartHeight} L ${points[0].x} ${padTop + chartHeight} Z`
      : ''

  // 2. Items line & area SVG paths
  const itemsLinePath = points.reduce((acc, p, idx) => {
    return idx === 0 ? `M ${p.x} ${p.yItems}` : `${acc} L ${p.x} ${p.yItems}`
  }, '')

  const itemsAreaPath =
    points.length > 0
      ? `${itemsLinePath} L ${points[points.length - 1].x} ${padTop + chartHeight} L ${points[0].x} ${padTop + chartHeight} Z`
      : ''

  // 3. Average line & area SVG paths
  const avgLinePath = points.reduce((acc, p, idx) => {
    return idx === 0 ? `M ${p.x} ${p.yAvg}` : `${acc} L ${p.x} ${p.yAvg}`
  }, '')

  const avgAreaPath =
    points.length > 0
      ? `${avgLinePath} L ${points[points.length - 1].x} ${padTop + chartHeight} L ${points[0].x} ${padTop + chartHeight} Z`
      : ''

  // Opacity helper: when hovering a series, the other two series fade
  const paxOpacityClass =
    hoveredSeries === 'items' || hoveredSeries === 'avg'
      ? 'opacity-20'
      : 'opacity-100'

  const itemsOpacityClass =
    hoveredSeries === 'pax' || hoveredSeries === 'avg'
      ? 'opacity-20'
      : 'opacity-100'

  const avgOpacityClass =
    hoveredSeries === 'pax' || hoveredSeries === 'items'
      ? 'opacity-20'
      : 'opacity-100'

  const togglePax = () => {
    if (showPax && !showItems && !showAvg) {
      setShowPax(false)
      setShowItems(true)
    } else {
      setShowPax((v) => !v)
    }
  }

  const toggleItems = () => {
    if (showItems && !showPax && !showAvg) {
      setShowItems(false)
      setShowPax(true)
    } else {
      setShowItems((v) => !v)
    }
  }

  const toggleAvg = () => {
    if (showAvg && !showPax && !showItems) {
      setShowAvg(false)
      setShowPax(true)
    } else {
      setShowAvg((v) => !v)
    }
  }

  return (
    <div className="flex flex-col gap-2.5">
      {/* ── Interactive Controls: Toggle Series Visibility & Legend ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-1 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Seated Guests Toggle Button */}
          <button
            type="button"
            onClick={togglePax}
            onMouseEnter={() => setHoveredSeries('pax')}
            onMouseLeave={() => setHoveredSeries(null)}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer select-none ${
              showPax
                ? 'bg-[#14274E]/10 border-[#14274E]/30 text-[#14274E] shadow-2xs'
                : 'bg-slate-50 border-slate-200 text-slate-400 opacity-60 hover:opacity-90'
            }`}
            title={showPax ? 'Click to hide Seated Guests' : 'Click to show Seated Guests'}
          >
            {showPax ? (
              <span className="w-2.5 h-2.5 rounded-full bg-[#14274E] shrink-0" />
            ) : (
              <EyeOff className="w-3 h-3 text-slate-400 shrink-0" />
            )}
            <span>Seated Guests</span>
            <span className="text-[11px] font-mono opacity-80 font-normal">({totalPax})</span>
          </button>

          {/* Items Ordered Toggle Button */}
          <button
            type="button"
            onClick={toggleItems}
            onMouseEnter={() => setHoveredSeries('items')}
            onMouseLeave={() => setHoveredSeries(null)}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer select-none ${
              showItems
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-800 shadow-2xs'
                : 'bg-slate-50 border-slate-200 text-slate-400 opacity-60 hover:opacity-90'
            }`}
            title={showItems ? 'Click to hide Items Ordered' : 'Click to show Items Ordered'}
          >
            {showItems ? (
              <span className="w-2.5 h-2.5 rounded-full bg-[#D97706] shrink-0" />
            ) : (
              <EyeOff className="w-3 h-3 text-slate-400 shrink-0" />
            )}
            <span>Items Ordered</span>
            <span className="text-[11px] font-mono opacity-80 font-normal">({totalItems})</span>
          </button>

          {/* Average (Peak Determiner) Toggle Button */}
          <button
            type="button"
            onClick={toggleAvg}
            onMouseEnter={() => setHoveredSeries('avg')}
            onMouseLeave={() => setHoveredSeries(null)}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer select-none ${
              showAvg
                ? 'bg-teal-500/10 border-teal-500/30 text-teal-800 shadow-2xs'
                : 'bg-slate-50 border-slate-200 text-slate-400 opacity-60 hover:opacity-90'
            }`}
            title={showAvg ? 'Click to hide Average line' : 'Click to show Average line'}
          >
            {showAvg ? (
              <span className="w-2.5 h-2.5 rounded-full bg-[#0D9488] shrink-0" />
            ) : (
              <EyeOff className="w-3 h-3 text-slate-400 shrink-0" />
            )}
            <span>Average</span>
            <span className="text-[11px] font-mono opacity-80 font-normal">({totalAvg})</span>
          </button>

          {/* Quick "Show All" pill if any is hidden */}
          {(!showPax || !showItems || !showAvg) && (
            <button
              type="button"
              onClick={() => {
                setShowPax(true)
                setShowItems(true)
                setShowAvg(true)
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              <Eye className="w-3 h-3" />
              <span>Show All</span>
            </button>
          )}
        </div>

        {/* Dynamic Hover Hint */}
        <div className="hidden sm:flex items-center text-[11px] text-slate-400 italic font-medium">
          {hoveredSeries === 'pax' ? (
            <span className="text-[#14274E] font-semibold">Hovering Seated Guests (Others faded)</span>
          ) : hoveredSeries === 'items' ? (
            <span className="text-amber-700 font-semibold">Hovering Items Ordered (Others faded)</span>
          ) : hoveredSeries === 'avg' ? (
            <span className="text-teal-700 font-semibold">Hovering Average (Others faded)</span>
          ) : (
            <span>Hover points to inspect & cross-fade series</span>
          )}
        </div>
      </div>

      {/* ── Scrollable Line Graph Container with Minimum Spacing ── */}
      <div
        ref={containerRef}
        className="relative w-full overflow-x-auto overflow-y-visible select-none pb-2 scrollbar-thin scrollbar-thumb-slate-200 hover:scrollbar-thumb-slate-300"
      >
        <div style={{ minWidth: `${svgWidth}px`, width: '100%' }}>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full h-auto max-h-[300px] overflow-visible"
            onMouseLeave={() => {
              setActivePoint(null)
              setHoveredSeries(null)
              setTooltipPos(null)
            }}
          >
            <defs>
              <linearGradient id="paxLineGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#14274E" stopOpacity="0.16" />
                <stop offset="100%" stopColor="#14274E" stopOpacity="0.01" />
              </linearGradient>

              <linearGradient id="itemsLineGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#D97706" stopOpacity="0.16" />
                <stop offset="100%" stopColor="#D97706" stopOpacity="0.01" />
              </linearGradient>

              <linearGradient id="avgLineGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0D9488" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#0D9488" stopOpacity="0.01" />
              </linearGradient>
            </defs>

            {/* Y Axis Grid lines and labels (Single clear unified scale) */}
            {Array.from({ length: yTicksCount + 1 }).map((_, i) => {
              const val = tickStep * (yTicksCount - i)
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
                    x={padLeft - 8}
                    y={yPos + 3.5}
                    textAnchor="end"
                    className="fill-slate-400 font-bold text-[9.5px]"
                  >
                    {val}
                  </text>
                </g>
              )
            })}

            {/* Area Fills */}
            {showAvg && (
              <path
                d={avgAreaPath}
                fill="url(#avgLineGradient)"
                className={`transition-opacity duration-200 ${avgOpacityClass}`}
              />
            )}
            {showPax && (
              <path
                d={paxAreaPath}
                fill="url(#paxLineGradient)"
                className={`transition-opacity duration-200 ${paxOpacityClass}`}
              />
            )}
            {showItems && (
              <path
                d={itemsAreaPath}
                fill="url(#itemsLineGradient)"
                className={`transition-opacity duration-200 ${itemsOpacityClass}`}
              />
            )}

            {/* Line Strokes */}
            {showAvg && (
              <path
                d={avgLinePath}
                fill="none"
                stroke="#0D9488"
                strokeWidth={hoveredSeries === 'avg' ? '3.5' : '2.5'}
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`transition-all duration-200 ${avgOpacityClass}`}
              />
            )}
            {showPax && (
              <path
                d={paxLinePath}
                fill="none"
                stroke="#14274E"
                strokeWidth={hoveredSeries === 'pax' ? '3.5' : '2.5'}
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`transition-all duration-200 ${paxOpacityClass}`}
              />
            )}
            {showItems && (
              <path
                d={itemsLinePath}
                fill="none"
                stroke="#D97706"
                strokeWidth={hoveredSeries === 'items' ? '3.5' : '2.5'}
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`transition-all duration-200 ${itemsOpacityClass}`}
              />
            )}

            {/* ── Highlight Highest Dot for all 3 lines (Halo rings) ── */}
            {points.map((p, i) => {
              const isHighestPax = showPax && i === highestPaxIndex && maxPaxRaw > 0
              const isHighestItems = showItems && i === highestItemsIndex && maxItemsRaw > 0
              const isHighestAvg = showAvg && i === highestAvgIndex && maxAvgRaw > 0

              return (
                <g key={`halos-${i}`}>
                  {/* Seated Guests Peak Highlight */}
                  {isHighestPax && (
                    <g className={paxOpacityClass}>
                      <circle
                        cx={p.x}
                        cy={p.yPax}
                        r="12"
                        fill="#14274E"
                        fillOpacity="0.12"
                      />
                      <circle
                        cx={p.x}
                        cy={p.yPax}
                        r="8.5"
                        fill="none"
                        stroke="#14274E"
                        strokeWidth="2"
                        strokeDasharray="3 2"
                        opacity="0.9"
                      />
                    </g>
                  )}

                  {/* Items Ordered Peak Highlight */}
                  {isHighestItems && (
                    <g className={itemsOpacityClass}>
                      <circle
                        cx={p.x}
                        cy={p.yItems}
                        r="12"
                        fill="#D97706"
                        fillOpacity="0.14"
                      />
                      <circle
                        cx={p.x}
                        cy={p.yItems}
                        r="8.5"
                        fill="none"
                        stroke="#D97706"
                        strokeWidth="2"
                        opacity="0.95"
                      />
                    </g>
                  )}

                  {/* Average / Overall Peak Hour Highlight */}
                  {isHighestAvg && (
                    <g className={avgOpacityClass}>
                      <circle
                        cx={p.x}
                        cy={p.yAvg}
                        r="14"
                        fill="#0D9488"
                        fillOpacity="0.18"
                      />
                      <circle
                        cx={p.x}
                        cy={p.yAvg}
                        r="9.5"
                        fill="none"
                        stroke="#0D9488"
                        strokeWidth="2.5"
                        opacity="0.95"
                      />
                    </g>
                  )}
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

            {/* Visible Dots for all 3 lines */}
            {points.map((p, i) => {
              const isHighestPax = showPax && i === highestPaxIndex && maxPaxRaw > 0
              const isHighestItems = showItems && i === highestItemsIndex && maxItemsRaw > 0
              const isHighestAvg = showAvg && i === highestAvgIndex && maxAvgRaw > 0

              return (
                <g key={`dots-${i}`}>
                  {/* Average Dot */}
                  {showAvg && (
                    <circle
                      cx={p.x}
                      cy={p.yAvg}
                      r={
                        activePoint === p.data
                          ? hoveredSeries === 'avg'
                            ? 6.5
                            : 5
                          : isHighestAvg
                            ? 5.5
                            : 3.5
                      }
                      fill={
                        activePoint === p.data && hoveredSeries === 'avg'
                          ? '#E9C46A'
                          : isHighestAvg
                            ? '#0D9488'
                            : '#0D9488'
                      }
                      stroke="#FFFFFF"
                      strokeWidth={isHighestAvg ? 2 : 1.5}
                      className={`transition-all duration-150 ${avgOpacityClass}`}
                    />
                  )}

                  {/* Pax Dot */}
                  {showPax && (
                    <circle
                      cx={p.x}
                      cy={p.yPax}
                      r={
                        activePoint === p.data
                          ? hoveredSeries === 'pax'
                            ? 6.5
                            : 5
                          : isHighestPax
                            ? 5.5
                            : 3.5
                      }
                      fill={
                        activePoint === p.data && hoveredSeries === 'pax'
                          ? '#E9C46A'
                          : isHighestPax
                            ? '#14274E'
                            : '#14274E'
                      }
                      stroke="#FFFFFF"
                      strokeWidth={isHighestPax ? 2 : 1.5}
                      className={`transition-all duration-150 ${paxOpacityClass}`}
                    />
                  )}

                  {/* Items Dot */}
                  {showItems && (
                    <circle
                      cx={p.x}
                      cy={p.yItems}
                      r={
                        activePoint === p.data
                          ? hoveredSeries === 'items'
                            ? 6.5
                            : 5
                          : isHighestItems
                            ? 5.5
                            : 3.5
                      }
                      fill={
                        activePoint === p.data && hoveredSeries === 'items'
                          ? '#E9C46A'
                          : isHighestItems
                            ? '#D97706'
                            : '#D97706'
                      }
                      stroke="#FFFFFF"
                      strokeWidth={isHighestItems ? 2 : 1.5}
                      className={`transition-all duration-150 ${itemsOpacityClass}`}
                    />
                  )}
                </g>
              )
            })}

            {/* Hover Targets: Dedicated circles for Pax, Items, Avg + column hit zone */}
            {points.map((p, i) => {
              const updateTooltip = () => {
                setActivePoint(p.data)
                const svgRect = svgRef.current?.getBoundingClientRect()
                const containerRect = containerRef.current?.getBoundingClientRect()
                if (svgRect && containerRect) {
                  const px =
                    (p.x / svgWidth) * svgRect.width - (containerRef.current?.scrollLeft || 0)
                  const targetY =
                    hoveredSeries === 'pax'
                      ? p.yPax
                      : hoveredSeries === 'items'
                        ? p.yItems
                        : hoveredSeries === 'avg'
                          ? p.yAvg
                          : p.yAvg
                  const py = (targetY / svgHeight) * svgRect.height
                  const alignX =
                    px > containerRect.width - 140 ? 'right' : px < 100 ? 'left' : 'center'
                  const alignY = py < padTop + 50 ? 'bottom' : 'top'
                  setTooltipPos({ x: px, y: py, alignX, alignY })
                }
              }

              return (
                <g key={`hit-${i}`}>
                  {/* General column hit zone */}
                  <rect
                    x={p.x - chartWidth / (data.length * 2)}
                    y={padTop}
                    width={Math.max(chartWidth / data.length, 20)}
                    height={chartHeight + padBottom}
                    fill="transparent"
                    className="cursor-pointer"
                    onMouseEnter={() => {
                      updateTooltip()
                    }}
                  />

                  {/* Specific Pax target: hovering fades Items and Avg */}
                  {showPax && (
                    <circle
                      cx={p.x}
                      cy={p.yPax}
                      r={14}
                      fill="transparent"
                      className="cursor-pointer"
                      onMouseEnter={() => {
                        setHoveredSeries('pax')
                        updateTooltip()
                      }}
                    />
                  )}

                  {/* Specific Items target: hovering fades Pax and Avg */}
                  {showItems && (
                    <circle
                      cx={p.x}
                      cy={p.yItems}
                      r={14}
                      fill="transparent"
                      className="cursor-pointer"
                      onMouseEnter={() => {
                        setHoveredSeries('items')
                        updateTooltip()
                      }}
                    />
                  )}

                  {/* Specific Avg target: hovering fades Pax and Items */}
                  {showAvg && (
                    <circle
                      cx={p.x}
                      cy={p.yAvg}
                      r={14}
                      fill="transparent"
                      className="cursor-pointer"
                      onMouseEnter={() => {
                        setHoveredSeries('avg')
                        updateTooltip()
                      }}
                    />
                  )}
                </g>
              )
            })}

            {/* X Axis Labels at the Footer of the Graph */}
            {points.map((p, idx) => {
              const item = p.data as any
              const isLatest = item.milestoneShort === 'Latest'
              const isWeek = item.milestoneShort === 'Week'
              const isYear = item.milestoneShort === 'Year'
              // The Average line is the definitive determiner of the Peak!
              const isPeak = idx === highestAvgIndex && maxAvgRaw > 0

              const footerTag = isPeak
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
                      className={`font-black text-[8.5px] uppercase tracking-wider ${
                        isPeak
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

          {/* Floating HTML tooltip */}
          {activePoint && tooltipPos && (
            <div
              className="absolute z-40 pointer-events-none bg-[#14274E] text-white px-3.5 py-2.5 rounded-xl shadow-xl border border-slate-700 text-xs whitespace-nowrap transition-all duration-75"
              style={{
                left: `${tooltipPos.x}px`,
                top: `${tooltipPos.y}px`,
                transform: `translate(${
                  tooltipPos.alignX === 'right'
                    ? '-100%'
                    : tooltipPos.alignX === 'left'
                      ? '0%'
                      : '-50%'
                }, ${tooltipPos.alignY === 'bottom' ? '12px' : 'calc(-100% - 10px)'})`,
              }}
            >
              <div className="flex items-center gap-1.5 mb-1 pb-1 border-b border-slate-700/80">
                <span className="text-[11px] font-bold text-[#E9C46A]">
                  {(activePoint as any).sublabel || activePoint.key}
                </span>
                {data.indexOf(activePoint) === highestAvgIndex && maxAvgRaw > 0 && (
                  <span className="text-[9px] font-black bg-[#E9C46A] text-[#14274E] px-1.5 py-0.5 rounded uppercase tracking-wide">
                    Peak Hour
                  </span>
                )}
              </div>
              <div className="space-y-1.5 text-[11px] pt-0.5">
                {showPax && (
                  <div
                    className={`flex items-center justify-between gap-4 transition-opacity duration-150 ${
                      hoveredSeries === 'items' || hoveredSeries === 'avg'
                        ? 'opacity-30'
                        : 'opacity-100 font-bold'
                    }`}
                  >
                    <span className="flex items-center gap-1.5 text-slate-200">
                      <span className="w-2 h-2 rounded-full bg-slate-300" />
                      Seated Guests:
                    </span>
                    <span className="text-white flex items-center gap-1">
                      {activePoint.customerCount ?? 0} pax
                      {data.indexOf(activePoint) === highestPaxIndex && maxPaxRaw > 0 && (
                        <span className="text-[8.5px] px-1 py-0.2 bg-blue-500/30 text-blue-300 rounded font-bold">
                          Highest
                        </span>
                      )}
                    </span>
                  </div>
                )}
                {showItems && (
                  <div
                    className={`flex items-center justify-between gap-4 transition-opacity duration-150 ${
                      hoveredSeries === 'pax' || hoveredSeries === 'avg'
                        ? 'opacity-30'
                        : 'opacity-100 font-bold'
                    }`}
                  >
                    <span className="flex items-center gap-1.5 text-amber-300">
                      <span className="w-2 h-2 rounded-full bg-amber-400" />
                      Items Ordered:
                    </span>
                    <span className="text-amber-300 flex items-center gap-1">
                      {activePoint.itemCount ?? 0} items
                      {data.indexOf(activePoint) === highestItemsIndex && maxItemsRaw > 0 && (
                        <span className="text-[8.5px] px-1 py-0.2 bg-amber-400/30 text-amber-200 rounded font-bold">
                          Highest
                        </span>
                      )}
                    </span>
                  </div>
                )}
                {showAvg && (
                  <div
                    className={`flex items-center justify-between gap-4 pt-1 border-t border-slate-700/60 transition-opacity duration-150 ${
                      hoveredSeries === 'pax' || hoveredSeries === 'items'
                        ? 'opacity-30'
                        : 'opacity-100 font-bold'
                    }`}
                  >
                    <span className="flex items-center gap-1.5 text-teal-300">
                      <span className="w-2 h-2 rounded-full bg-teal-400" />
                      Average:
                    </span>
                    <span className="text-teal-300 flex items-center gap-1">
                      {Math.round(
                        (((activePoint.customerCount ?? 0) + (activePoint.itemCount ?? 0)) / 2) * 10,
                      ) / 10}
                      {data.indexOf(activePoint) === highestAvgIndex && maxAvgRaw > 0 && (
                        <span className="text-[8.5px] px-1 py-0.2 bg-teal-400/30 text-teal-200 rounded font-bold">
                          Peak
                        </span>
                      )}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
