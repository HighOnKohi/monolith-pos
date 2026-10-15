import { useState } from 'react'
import { Info } from 'lucide-react'

interface SourceStats {
  count: number
  percentage: number
  revenue: number
}

interface OrderSourcePieChartProps {
  comparison: {
    service: SourceStats
    customer: SourceStats
    totalCount: number
    totalRevenue: number
  }
}

export function OrderSourcePieChart({ comparison }: OrderSourcePieChartProps) {
  const [hoveredSlice, setHoveredSlice] = useState<'service' | 'customer' | null>(null)

  const { service, customer, totalCount } = comparison

  if (totalCount === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-xs italic bg-slate-50/50 rounded-2xl border border-slate-100 p-6">
        <Info className="w-6 h-6 text-slate-300 mb-2" />
        No completed order history recorded for this period.
      </div>
    )
  }

  // Calculate percentages
  const sPct = service.percentage / 100
  const cPct = customer.percentage / 100

  // SVG parameters
  const svgWidth = 620
  const svgHeight = 250
  const cx = 310
  const cy = 125
  const radius = 54
  const strokeWidth = 22
  const circumference = 2 * Math.PI * radius

  // Gap between slices for visual separation
  const hasBoth = service.count > 0 && customer.count > 0
  const gap = hasBoth ? 5 : 0

  const serviceDash = Math.max(0, sPct * circumference - gap)
  const customerDash = Math.max(0, cPct * circumference - gap)

  const serviceOffset = -gap / 2
  const customerOffset = -(sPct * circumference + gap / 2)

  // Only show callout boxes if percentage > 0
  const showServiceBox = service.percentage > 0
  const showCustomerBox = customer.percentage > 0

  // Color Definitions:
  // Service Staff = Orange (#F97316 / #EA580C)
  // Customer Interface = Blue (#14274E)
  const COLOR_SERVICE = '#F97316'
  const COLOR_SERVICE_DARK = '#EA580C'
  const COLOR_CUSTOMER = '#14274E'

  return (
    <div className="flex flex-col items-center justify-between h-full gap-3 w-full select-none">
      {/* Title Header */}
      <div className="w-full flex items-center justify-between pb-2 border-b border-slate-100">
        <div>
          <h3 className="text-sm font-black text-[#14274E] tracking-tight">
            Order Source Channel
          </h3>
          <p className="text-[11px] text-slate-400 font-medium">
            Service staff vs. customer interface channel split
          </p>
        </div>
        <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">
          {totalCount} Total Orders
        </span>
      </div>

      {/* ── Visual Diagram: Donut with Angled Leader Lines to Percentage Callout Boxes ── */}
      <div className="w-full flex justify-center items-center py-1">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto max-h-[290px] overflow-visible"
        >
          <defs>
            {/* Box shadow filters for callout cards */}
            <filter id="boxShadow" x="-10%" y="-10%" width="125%" height="125%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#0F172A" floodOpacity="0.06" />
            </filter>
            <filter id="boxShadowHoverService" x="-15%" y="-15%" width="135%" height="135%">
              <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor={COLOR_SERVICE} floodOpacity="0.22" />
            </filter>
            <filter id="boxShadowHoverCustomer" x="-15%" y="-15%" width="135%" height="135%">
              <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor={COLOR_CUSTOMER} floodOpacity="0.22" />
            </filter>
          </defs>

          {/* ────────────────────────────────────────────────────────── */}
          {/* 1. TOP-RIGHT CALLOUT BOX & LEADER LINE (SERVICE STAFF = ORANGE) */}
          {/* Only shown if service.percentage > 0                        */}
          {/* ────────────────────────────────────────────────────────── */}
          {showServiceBox && (
            <>
              {/* Angled Leader Line from Service Slice to Top-Right Box */}
              <polyline
                points="362,110 415,110 460,86"
                fill="none"
                stroke={COLOR_SERVICE}
                strokeWidth={hoveredSlice === 'service' ? '3.5' : '2.5'}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="transition-all duration-200"
              />
              {/* Small anchor dot on donut perimeter */}
              <circle
                cx="362"
                cy="110"
                r={hoveredSlice === 'service' ? 4.5 : 3.5}
                fill={COLOR_SERVICE}
                stroke="#FFFFFF"
                strokeWidth="1.5"
                className="transition-all duration-200"
              />

              {/* Top-Right Callout Box */}
              <g
                className="cursor-pointer transition-transform duration-200"
                onMouseEnter={() => setHoveredSlice('service')}
                onMouseLeave={() => setHoveredSlice(null)}
              >
                {/* Card Background Rectangle */}
                <rect
                  x="395"
                  y="16"
                  width="210"
                  height="70"
                  rx="12"
                  fill="#FFFFFF"
                  stroke={COLOR_SERVICE}
                  strokeWidth={hoveredSlice === 'service' ? '3' : '2.5'}
                  filter={hoveredSlice === 'service' ? 'url(#boxShadowHoverService)' : 'url(#boxShadow)'}
                  className="transition-all duration-200"
                />

                {/* Header: Dot + Label + Big Percentage */}
                <circle cx="414" cy="38" r="4.5" fill={COLOR_SERVICE} />
                <text
                  x="425"
                  y="42"
                  fill="#0F172A"
                  fontSize="12.5"
                  fontWeight="800"
                  fontFamily="inherit"
                >
                  Service Staff
                </text>
                <text
                  x="590"
                  y="44"
                  textAnchor="end"
                  fill={COLOR_SERVICE_DARK}
                  fontSize="22"
                  fontWeight="900"
                  fontFamily="inherit"
                >
                  {service.percentage}%
                </text>

                {/* Subtext: Order Count only (no price) */}
                <text
                  x="414"
                  y="65"
                  fill="#64748B"
                  fontSize="11"
                  fontWeight="600"
                  fontFamily="inherit"
                >
                  {service.count} {service.count === 1 ? 'order' : 'orders'} recorded
                </text>
              </g>
            </>
          )}

          {/* ────────────────────────────────────────────────────────── */}
          {/* 2. BOTTOM-LEFT CALLOUT BOX & LEADER LINE (CUSTOMER = BLUE) */}
          {/* Only shown if customer.percentage > 0                       */}
          {/* ────────────────────────────────────────────────────────── */}
          {showCustomerBox && (
            <>
              {/* Angled Leader Line from Bottom-Left Box to Customer Slice */}
              <polyline
                points="125,148 165,180 270,180"
                fill="none"
                stroke={COLOR_CUSTOMER}
                strokeWidth={hoveredSlice === 'customer' ? '3.5' : '2.5'}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="transition-all duration-200"
              />
              {/* Small anchor dot on donut perimeter */}
              <circle
                cx="270"
                cy="180"
                r={hoveredSlice === 'customer' ? 4.5 : 3.5}
                fill={COLOR_CUSTOMER}
                stroke="#FFFFFF"
                strokeWidth="1.5"
                className="transition-all duration-200"
              />

              {/* Bottom-Left Callout Box */}
              <g
                className="cursor-pointer transition-transform duration-200"
                onMouseEnter={() => setHoveredSlice('customer')}
                onMouseLeave={() => setHoveredSlice(null)}
              >
                {/* Card Background Rectangle */}
                <rect
                  x="15"
                  y="78"
                  width="210"
                  height="70"
                  rx="12"
                  fill="#FFFFFF"
                  stroke={COLOR_CUSTOMER}
                  strokeWidth={hoveredSlice === 'customer' ? '3' : '2.5'}
                  filter={hoveredSlice === 'customer' ? 'url(#boxShadowHoverCustomer)' : 'url(#boxShadow)'}
                  className="transition-all duration-200"
                />

                {/* Header: Dot + Label + Big Percentage */}
                <circle cx="34" cy="100" r="4.5" fill={COLOR_CUSTOMER} />
                <text
                  x="45"
                  y="104"
                  fill="#0F172A"
                  fontSize="12.5"
                  fontWeight="800"
                  fontFamily="inherit"
                >
                  Customer Interface
                </text>
                <text
                  x="210"
                  y="106"
                  textAnchor="end"
                  fill={COLOR_CUSTOMER}
                  fontSize="22"
                  fontWeight="900"
                  fontFamily="inherit"
                >
                  {customer.percentage}%
                </text>

                {/* Subtext: Order Count only (no price) */}
                <text
                  x="34"
                  y="127"
                  fill="#64748B"
                  fontSize="11"
                  fontWeight="600"
                  fontFamily="inherit"
                >
                  {customer.count} {customer.count === 1 ? 'order' : 'orders'} recorded
                </text>
              </g>
            </>
          )}

          {/* ────────────────────────────────────────────────────────── */}
          {/* 3. CENTER DONUT RING                                       */}
          {/* ────────────────────────────────────────────────────────── */}
          <g transform={`rotate(-90 ${cx} ${cy})`}>
            {/* Background Track */}
            <circle
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke="#F1F5F9"
              strokeWidth={strokeWidth}
            />

            {/* Service Staff Slice (Orange #F97316) */}
            {service.count > 0 && (
              <circle
                cx={cx}
                cy={cy}
                r={radius}
                fill="none"
                stroke={COLOR_SERVICE}
                strokeWidth={hoveredSlice === 'service' ? strokeWidth + 4 : strokeWidth}
                strokeDasharray={`${serviceDash} ${circumference}`}
                strokeDashoffset={serviceOffset}
                className="transition-all duration-300 cursor-pointer"
                onMouseEnter={() => setHoveredSlice('service')}
                onMouseLeave={() => setHoveredSlice(null)}
              />
            )}

            {/* Customer Interface Slice (Blue #14274E) */}
            {customer.count > 0 && (
              <circle
                cx={cx}
                cy={cy}
                r={radius}
                fill="none"
                stroke={COLOR_CUSTOMER}
                strokeWidth={hoveredSlice === 'customer' ? strokeWidth + 4 : strokeWidth}
                strokeDasharray={`${customerDash} ${circumference}`}
                strokeDashoffset={customerOffset}
                className="transition-all duration-300 cursor-pointer"
                onMouseEnter={() => setHoveredSlice('customer')}
                onMouseLeave={() => setHoveredSlice(null)}
              />
            )}
          </g>

          {/* ────────────────────────────────────────────────────────── */}
          {/* 4. DONUT CENTER HOLE (CLEAN SUMMARY - NO DOMINANT LABEL)    */}
          {/* ────────────────────────────────────────────────────────── */}
          <g className="pointer-events-none">
            <circle cx={cx} cy={cy} r={radius - strokeWidth / 2 - 2} fill="#FFFFFF" />

            {hoveredSlice === 'service' ? (
              <>
                <text
                  x={cx}
                  y={cy - 9}
                  textAnchor="middle"
                  fill={COLOR_SERVICE_DARK}
                  fontSize="8.5"
                  fontWeight="800"
                  letterSpacing="0.06em"
                  fontFamily="inherit"
                >
                  SERVICE
                </text>
                <text
                  x={cx}
                  y={cy + 7}
                  textAnchor="middle"
                  fill={COLOR_SERVICE_DARK}
                  fontSize="15"
                  fontWeight="900"
                  fontFamily="inherit"
                >
                  {service.count}
                </text>
                <text
                  x={cx}
                  y={cy + 19}
                  textAnchor="middle"
                  fill="#64748B"
                  fontSize="8"
                  fontWeight="700"
                  letterSpacing="0.04em"
                  fontFamily="inherit"
                >
                  ORDERS
                </text>
              </>
            ) : hoveredSlice === 'customer' ? (
              <>
                <text
                  x={cx}
                  y={cy - 9}
                  textAnchor="middle"
                  fill={COLOR_CUSTOMER}
                  fontSize="8.5"
                  fontWeight="800"
                  letterSpacing="0.06em"
                  fontFamily="inherit"
                >
                  CUSTOMER
                </text>
                <text
                  x={cx}
                  y={cy + 7}
                  textAnchor="middle"
                  fill={COLOR_CUSTOMER}
                  fontSize="15"
                  fontWeight="900"
                  fontFamily="inherit"
                >
                  {customer.count}
                </text>
                <text
                  x={cx}
                  y={cy + 19}
                  textAnchor="middle"
                  fill="#64748B"
                  fontSize="8"
                  fontWeight="700"
                  letterSpacing="0.04em"
                  fontFamily="inherit"
                >
                  ORDERS
                </text>
              </>
            ) : (
              <>
                <text
                  x={cx}
                  y={cy - 9}
                  textAnchor="middle"
                  fill="#64748B"
                  fontSize="8.5"
                  fontWeight="800"
                  letterSpacing="0.06em"
                  fontFamily="inherit"
                >
                  TOTAL
                </text>
                <text
                  x={cx}
                  y={cy + 7}
                  textAnchor="middle"
                  fill={COLOR_CUSTOMER}
                  fontSize="15"
                  fontWeight="900"
                  fontFamily="inherit"
                >
                  {totalCount}
                </text>
                <text
                  x={cx}
                  y={cy + 19}
                  textAnchor="middle"
                  fill="#94A3B8"
                  fontSize="8"
                  fontWeight="700"
                  letterSpacing="0.04em"
                  fontFamily="inherit"
                >
                  ORDERS
                </text>
              </>
            )}
          </g>
        </svg>
      </div>
    </div>
  )
}
