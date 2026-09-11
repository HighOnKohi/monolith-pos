import { useEffect } from 'react'
import {
  X,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingBag,
  Users,
  Clock,
  Award,
  Package,
  CheckCircle2,
  Lightbulb,
  ArrowRight,
  Sparkles,
} from 'lucide-react'
import type { AnalyticsSummary } from '@/services/analyticsService'

export type KpiMetricType =
  | 'revenue'
  | 'orders'
  | 'tables'
  | 'aov'
  | 'spend'
  | 'serving_time'
  | 'top_item'
  | 'items_sold'

interface MetricDetailModalProps {
  isOpen: boolean
  onClose: () => void
  metricKey: KpiMetricType | null
  summary: AnalyticsSummary
  onSelectMetric: (key: KpiMetricType) => void
  onOpenCustomerInsights?: (tab: 'ratio' | 'spend' | 'peak') => void
}

export function MetricDetailModal({
  isOpen,
  onClose,
  metricKey,
  summary,
  onSelectMetric,
  onOpenCustomerInsights,
}: MetricDetailModalProps) {
  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !metricKey) return null

  // Metric metadata & configuration calculated dynamically
  const config = getMetricConfig(metricKey, summary)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
      <div
        className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-5 py-4 flex items-center justify-between text-white shrink-0"
          style={{ backgroundColor: config.themeColor }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center text-white shrink-0">
              <config.Icon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/70">
                  Performance Diagnostic
                </span>
                {config.changePercent !== undefined && config.changePercent !== null && (
                  <span
                    className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      config.changePercent > 0
                        ? 'bg-emerald-500/30 text-emerald-100 border border-emerald-400/40'
                        : config.changePercent < 0
                          ? 'bg-rose-500/30 text-rose-100 border border-rose-400/40'
                          : 'bg-white/20 text-white'
                    }`}
                  >
                    {config.changePercent > 0 ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : (
                      <TrendingDown className="w-3 h-3" />
                    )}
                    {config.changePercent > 0 ? `+${config.changePercent}%` : `${config.changePercent}%`}
                  </span>
                )}
              </div>
              <h2 className="text-base sm:text-lg font-black tracking-tight">{config.title}</h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-white/80 hover:text-white hover:bg-white/15 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-slate-800 flex-1">
          {/* Main Stat Banner */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Current Selected Value
              </span>
              <div className="text-3xl sm:text-4xl font-black text-[#14274E] tracking-tight mt-0.5">
                {config.displayValue}
              </div>
              <p className="text-xs text-slate-500 mt-1">{config.subtitle}</p>
            </div>
            {config.formula && (
              <div className="bg-white p-3 rounded-xl border border-slate-200/80 sm:max-w-xs shrink-0 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Calculation Formula
                </span>
                <p className="text-[11px] font-mono font-bold text-slate-800 mt-0.5 leading-snug">
                  {config.formula}
                </p>
              </div>
            )}
          </div>

          {/* Meaning & Takeaway */}
          <div className="p-4 bg-blue-50/60 border border-blue-200/70 rounded-2xl flex items-start gap-3">
            <Lightbulb className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs leading-relaxed text-blue-950">
              <h3 className="font-bold text-blue-900 uppercase tracking-wide text-[11px]">
                Business Context &amp; Diagnostic
              </h3>
              <p>{config.meaning}</p>
            </div>
          </div>

          {/* Sub-Metrics Breakdown Grid */}
          {config.subMetrics && config.subMetrics.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5">
                Metric Breakdown &amp; Contributing Factors
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {config.subMetrics.map((sm, i) => (
                  <div
                    key={i}
                    className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-2xs flex flex-col justify-between"
                  >
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">
                      {sm.label}
                    </span>
                    <p className="text-base sm:text-lg font-black text-[#14274E] mt-1">{sm.value}</p>
                    {sm.subtext && (
                      <span className="text-[10px] text-slate-500 mt-0.5 truncate">{sm.subtext}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Custom Serving Time Distribution Bar (if applicable) */}
          {metricKey === 'serving_time' && summary.servingTimeBreakdown && (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700">Kitchen Turnaround Distribution</span>
                <span className="text-[11px] text-slate-500">
                  {summary.servingTimeBreakdown.totalSampled} orders sampled
                </span>
              </div>
              <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden flex">
                <div
                  className="bg-emerald-500 transition-all"
                  style={{ width: `${summary.servingTimeBreakdown.under15MinPct}%` }}
                  title={`Fast (<15m): ${summary.servingTimeBreakdown.under15MinPct}%`}
                />
                <div
                  className="bg-amber-500 transition-all"
                  style={{ width: `${summary.servingTimeBreakdown.between15And30MinPct}%` }}
                  title={`Standard (15-30m): ${summary.servingTimeBreakdown.between15And30MinPct}%`}
                />
                <div
                  className="bg-rose-500 transition-all"
                  style={{ width: `${summary.servingTimeBreakdown.over30MinPct}%` }}
                  title={`Slow (>30m): ${summary.servingTimeBreakdown.over30MinPct}%`}
                />
              </div>
              <div className="grid grid-cols-3 text-center text-[10px] pt-1 font-semibold">
                <div className="text-emerald-700">
                  &lt; 15 min ({summary.servingTimeBreakdown.under15MinPct}%)
                </div>
                <div className="text-amber-700">
                  15–30 min ({summary.servingTimeBreakdown.between15And30MinPct}%)
                </div>
                <div className="text-rose-700">
                  &gt; 30 min ({summary.servingTimeBreakdown.over30MinPct}%)
                </div>
              </div>
            </div>
          )}

          {/* Actionable Recommendations ("What To Do") */}
          <div>
            <div className="flex items-center gap-1.5 mb-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Actionable Operations Guide (&quot;What To Do&quot;)
              </h3>
            </div>
            <div className="space-y-2">
              {config.actions.map((act, index) => (
                <div
                  key={index}
                  className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-2xs flex items-start gap-2.5 text-xs"
                >
                  <div className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 font-bold text-[11px] mt-0.5">
                    {index + 1}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900">{act.title}</h4>
                    <p className="text-slate-600 text-[11px] leading-relaxed mt-0.5">{act.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Link to Customer Insights if relevant */}
          {(metricKey === 'tables' || metricKey === 'spend' || metricKey === 'aov') && onOpenCustomerInsights && (
            <div className="p-3 bg-gradient-to-r from-amber-50 to-indigo-50 border border-amber-200/80 rounded-xl flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-slate-800">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="font-semibold">
                  Want deeper floor seating &amp; guest spend strategies?
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose()
                  onOpenCustomerInsights(metricKey === 'tables' ? 'ratio' : 'spend')
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#14274E] text-white font-bold text-[11px] rounded-lg shadow-2xs hover:bg-[#1f3b73] transition-colors cursor-pointer shrink-0"
              >
                <span>View Full Playbook</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Related Metric Switcher */}
          <div className="pt-2 border-t border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
              Inspect Another Metric
            </span>
            <div className="flex flex-wrap gap-1.5">
              {ALL_METRICS.filter((m) => m.key !== metricKey).map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => onSelectMetric(m.key)}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] transition-colors cursor-pointer"
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-5 py-3.5 border-t border-slate-200 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

const ALL_METRICS: { key: KpiMetricType; label: string }[] = [
  { key: 'revenue', label: 'Revenue' },
  { key: 'orders', label: 'Completed Orders' },
  { key: 'tables', label: 'Tables Served' },
  { key: 'aov', label: 'Avg. Order Value' },
  { key: 'spend', label: 'Spend / Customer' },
  { key: 'serving_time', label: 'Avg. Serving Time' },
  { key: 'top_item', label: 'Top Selling Item' },
  { key: 'items_sold', label: 'Items Sold' },
]

function getMetricConfig(metricKey: KpiMetricType, summary: AnalyticsSummary) {
  switch (metricKey) {
    case 'revenue': {
      const discountRate =
        summary.subtotalRevenue > 0
          ? (summary.totalDiscounts / summary.subtotalRevenue) * 100
          : 0
      const isGrowing = (summary.revenueChangePercent ?? 0) >= 0

      let meaning = ''
      if (summary.totalDiscounts === 0) {
        meaning = `Net revenue of ₱${summary.revenue.toLocaleString('en-PH', { minimumFractionDigits: 0 })} matches gross sales because no promotions or discounts were redeemed in this period. Full margins were retained across all orders.`
      } else {
        meaning = `Net revenue represents your actual retained earnings after deducting ₱${summary.totalDiscounts.toLocaleString('en-PH', { minimumFractionDigits: 0 })} in discounts (${discountRate.toFixed(1)}% discount rate) from ₱${summary.subtotalRevenue.toLocaleString('en-PH', { minimumFractionDigits: 0 })} gross sales.`
      }

      const actions = [
        discountRate > 10
          ? {
              title: `High Discount Warning (${discountRate.toFixed(1)}%)`,
              detail: `Discounts exceed the 10% healthy benchmark. Audit manual staff discounts and ensure promos aren't eroding net operating margin.`,
            }
          : {
              title: `Disciplined Margin Retention (${discountRate.toFixed(1)}% discounts)`,
              detail: `Discounts are well-controlled within the healthy <10% margin threshold. Continue restricting discounts to off-peak hours.`,
            },
        isGrowing
          ? {
              title: 'Protect High-Margin Dishtypes',
              detail: `Revenue is trending up (+${summary.revenueChangePercent}%). Keep food costs under 30% by monitoring supplier ingredient prices on top-selling items.`,
            }
          : {
              title: 'Drive Traffic Recovery',
              detail: `Revenue is down (${summary.revenueChangePercent}% vs prior period). Stimulate sales with bundle offers and social media highlights on slow weekdays.`,
            },
        {
          title: 'Direct Promos Away from Peak Hours',
          detail: `Avoid discounting during your busiest peak window (${summary.peakHour ?? 'rush hours'}); use promos strictly to fill idle tables during afternoon lulls.`,
        },
      ]

      return {
        title: 'Net Revenue',
        Icon: DollarSign,
        themeColor: '#14274E',
        displayValue: `₱${summary.revenue.toLocaleString('en-PH', { minimumFractionDigits: 0 })}`,
        subtitle: `Total revenue generated across ${summary.completedOrders} orders`,
        changePercent: summary.revenueChangePercent,
        formula: 'Net Revenue = Subtotal Revenue - Discounts Granted',
        meaning,
        subMetrics: [
          {
            label: 'Subtotal Sales',
            value: `₱${summary.subtotalRevenue.toLocaleString('en-PH', { minimumFractionDigits: 0 })}`,
            subtext: 'Before discounts',
          },
          {
            label: 'Discounts Granted',
            value: `₱${summary.totalDiscounts.toLocaleString('en-PH', { minimumFractionDigits: 0 })}`,
            subtext: `${discountRate.toFixed(1)}% discount rate`,
          },
          {
            label: 'Revenue / Order',
            value: `₱${summary.averageOrderValue.toFixed(0)}`,
            subtext: 'Average ticket size',
          },
        ],
        actions,
      }
    }

    case 'orders': {
      const dineIn = summary.orderTypeBreakdown.find((b) => b.label.toLowerCase().includes('dine'))
      const takeout = summary.orderTypeBreakdown.find((b) => b.label.toLowerCase().includes('take'))
      const ticket = summary.orderTypeBreakdown.find((b) => b.label.toLowerCase().includes('ticket'))
      const dineInPct = dineIn?.percentage ?? (summary.completedOrders > 0 ? 0 : 70)
      const takeoutPct = takeout?.percentage ?? (summary.completedOrders > 0 ? 0 : 30)
      const ticketPct = ticket?.percentage ?? 0
      const cancelRate =
        summary.completedOrders + summary.cancelledOrders > 0
          ? (summary.cancelledOrders / (summary.completedOrders + summary.cancelledOrders)) * 100
          : 0

      return {
        title: 'Completed Orders',
        Icon: ShoppingBag,
        themeColor: '#2A9D8F',
        displayValue: `${summary.completedOrders} orders`,
        subtitle: `Total successfully fulfilled dining checks & ticket orders in period`,
        changePercent: summary.ordersChangePercent,
        formula: 'Completed Orders = Table Orders (Dine-in + Takeout) + Ticket Orders',
        meaning: `Completed orders measure total fulfillment and throughput. Breakdown: ${dineInPct}% Dine-In table service, ${takeoutPct}% Takeout${ticketPct > 0 ? `, and ${ticketPct}% Ticketing Interface` : ''}.`,
        subMetrics: [
          {
            label: 'Dine-In Orders',
            value: dineIn ? `${dineIn.count} (${dineIn.percentage}%)` : '—',
            subtext: 'Table service volume',
          },
          {
            label: 'Takeout Orders',
            value: takeout ? `${takeout.count} (${takeout.percentage}%)` : '—',
            subtext: 'Carry-out volume',
          },
          ...(ticket && ticket.count > 0 ? [{
            label: 'Ticket Sales',
            value: `${ticket.count} (${ticket.percentage}%)`,
            subtext: 'Ticketing interface orders',
          }] : []),
          {
            label: 'Cancelled Orders',
            value: `${summary.cancelledOrders} (${cancelRate.toFixed(1)}%)`,
            subtext: 'Voided or cancelled',
          },
        ],
        actions: [
          takeoutPct > 35
            ? {
                title: `High Takeout Volume (${takeoutPct}%)`,
                detail: `Designate a dedicated pickup staging shelf and maintain higher packaging inventory so carry-out boxes don't clutter the main cashier counter.`,
              }
            : {
                title: `Dine-In Focused Operation (${dineInPct}%)`,
                detail: `Ensure floor runners and bussers are well-staffed during meal rushes since table turns drive the vast majority of your revenue.`,
              },
          cancelRate > 3
            ? {
                title: `Investigate Order Cancellations (${summary.cancelledOrders} orders)`,
                detail: `Cancellation rate is ${cancelRate.toFixed(1)}%. Review kitchen ticket wait times or delayed 86-ing communication to eliminate guest walkouts.`,
              }
            : {
                title: `Clean Fulfillment (${cancelRate.toFixed(1)}% cancels)`,
                detail: `Minimal cancelled tickets indicate good menu inventory availability and consistent guest retention.`,
              },
          {
            title: 'Promote Table QR Mobile Ordering',
            detail: `Encourage seated diners to browse and submit checks via QR ordering to eliminate cashier bottlenecks during surges.`,
          },
        ],
      }
    }

    case 'tables': {
      const ratio = summary.customerToOrderRatio ?? 1.8
      return {
        title: 'Tables & Diners Served',
        Icon: Users,
        themeColor: '#E76F51',
        displayValue: summary.customersServed !== null ? `${summary.customersServed.toLocaleString()} diners` : '—',
        subtitle: `${ratio.toFixed(1)} diners per average order`,
        changePercent: summary.customersChangePercent,
        formula: 'Diners Served = Sum of guest counts across all closed table orders',
        meaning: `Measures total guest headcount accommodated. An average party of ${ratio.toFixed(1)} diners indicates that ${ratio < 2.2 ? 'couples and solo diners dominate your floor' : 'multi-person family and group gatherings dominate your floor'}.`,
        subMetrics: [
          {
            label: 'Average Party Size',
            value: `${ratio.toFixed(1)} diners`,
            subtext: 'Diners per order',
          },
          {
            label: 'Spend / Diner',
            value: summary.averageSpendPerCustomer !== null ? `₱${summary.averageSpendPerCustomer.toFixed(0)}` : '—',
            subtext: 'Contribution per guest',
          },
          {
            label: 'Peak Diner Date',
            value: summary.peakCustomerPeriod ? summary.peakCustomerPeriod.period : '—',
            subtext: summary.peakCustomerPeriod ? `${summary.peakCustomerPeriod.count} diners` : 'Highest volume day',
          },
        ],
        actions: [
          ratio < 2.2
            ? {
                title: 'Eliminate Dead Seats with 2-Tops',
                detail: `Since parties average ${ratio.toFixed(1)} diners, seating them at fixed 4-tops leaves 50% empty chairs. Split into modular 2-seaters to seat +30% more guests.`,
              }
            : {
                title: 'Configure Dedicated Group Seating',
                detail: `With party sizes averaging ${ratio.toFixed(1)}, ensure sufficient 4-top and 6-top tables to accommodate group seatings comfortably.`,
              },
          {
            title: 'Turn Small Tables in 35–45 Minutes',
            detail: `Smaller tables finish dining quickly. Train floor staff to clear plates and present dessert menus promptly to capture high table turns.`,
          },
          {
            title: 'Review Full Customer Playbook',
            detail: `Click below to access our deep-dive analysis on seating layouts, duo menus, and shift prep cutoffs.`,
          },
        ],
      }
    }

    case 'aov': {
      const targetAov = Math.ceil((summary.averageOrderValue * 1.15) / 50) * 50
      return {
        title: 'Average Order Value (AOV)',
        Icon: TrendingUp,
        themeColor: '#E9C46A',
        displayValue: `₱${summary.averageOrderValue.toFixed(0)}`,
        subtitle: `Computed from ₱${summary.revenue.toLocaleString('en-PH', { minimumFractionDigits: 0 })} across ${summary.completedOrders} orders`,
        formula: 'AOV = Total Net Revenue ÷ Total Completed Orders',
        meaning: `AOV measures how much an entire table ticket spends per transaction. Lifting your current AOV of ₱${summary.averageOrderValue.toFixed(0)} toward ₱${targetAov.toLocaleString('en-PH')} is the fastest path to expanding operating profit without adding floor space.`,
        subMetrics: [
          {
            label: 'Total Net Revenue',
            value: `₱${summary.revenue.toLocaleString('en-PH', { minimumFractionDigits: 0 })}`,
            subtext: 'Total period sales',
          },
          {
            label: 'Completed Orders',
            value: `${summary.completedOrders}`,
            subtext: 'Total transactions',
          },
          {
            label: 'Items per Order',
            value: summary.completedOrders > 0 ? (summary.itemsSold / summary.completedOrders).toFixed(1) : '—',
            subtext: 'Attachment rate',
          },
        ],
        actions: [
          {
            title: `Bundle Combos to Reach ₱${targetAov.toLocaleString('en-PH')}`,
            detail: `Create bundle meals (appetizer + 2 entrees + 2 drinks) priced right around ₱${targetAov.toLocaleString('en-PH')} to nudge tickets above your average.`,
          },
          {
            title: 'Target 3.0+ Items per Ticket',
            detail: `Current attachment is ${(summary.completedOrders > 0 ? (summary.itemsSold / summary.completedOrders) : 2.2).toFixed(1)} items per ticket. Train cashiers to prompt for a drink or side add-on before finishing orders.`,
          },
          {
            title: 'Dessert Cart / Post-Meal Upsell',
            detail: `Train waitstaff to present the dessert card directly to tables right as main course plates are cleared.`,
          },
        ],
      }
    }

    case 'spend': {
      const avgSpendVal =
        summary.averageSpendPerCustomer ??
        (summary.customersServed ? summary.revenue / summary.customersServed : 0)
      const targetSpend = Math.max(80, Math.round((avgSpendVal * 0.15) / 10) * 10)
      return {
        title: 'Average Spend per Customer',
        Icon: Users,
        themeColor: '#394867',
        displayValue: `₱${avgSpendVal.toFixed(0)}`,
        subtitle: `Revenue contributed per individual diner visit`,
        formula: 'Spend per Customer = Total Net Revenue ÷ Total Diners Served',
        meaning: `Tracks the individual monetary contribution of every person dining with you. Increasing spend by +₱${targetSpend} per diner multiplies directly into bottom-line profit.`,
        subMetrics: [
          {
            label: 'Total Diners',
            value: summary.customersServed !== null ? `${summary.customersServed}` : '—',
            subtext: 'Headcount',
          },
          {
            label: 'Average Order Value',
            value: `₱${summary.averageOrderValue.toFixed(0)}`,
            subtext: 'Ticket total',
          },
          {
            label: 'Diners per Order',
            value: `${(summary.customerToOrderRatio ?? 1.8).toFixed(1)}`,
            subtext: 'Party size ratio',
          },
        ],
        actions: [
          {
            title: `Upsell High-Margin Beverages (+₱${targetSpend})`,
            detail: `Drinks yield up to 80% margins. Mandate suggestive selling for signature specialty drinks on every entrée order.`,
          },
          {
            title: 'Affordable Fixed-Price Add-Ons',
            detail: `Offer a "+₱150 Soup & Dessert" upgrade option to capture solo diners and pairs who would not order full-price separate desserts.`,
          },
          {
            title: 'Open Customer Insights Playbook',
            detail: `Access the full interactive playbook for customized table seating configurations and shift scheduling guides.`,
          },
        ],
      }
    }

    case 'serving_time': {
      const prep = summary.averagePrepTimeMinutes ?? 25
      const delivery = summary.averageDeliveryTimeMinutes ?? 10
      const total = summary.averageServingTimeMinutes ?? 35
      const isRunnerBottleneck = delivery > prep * 0.7

      let diagnosis = ''
      if (total < 20) {
        diagnosis = `Your average serving time of ${total}m is exceptionally fast! Tables receive food quickly, boosting dining satisfaction and table turnover.`
      } else if (isRunnerBottleneck) {
        diagnosis = `Runner Bottleneck Detected: Delivery time (~${delivery}m) is unusually high compared to cooking time (~${prep}m). Cooked plates are cooling on the pass while waiting for available runners.`
      } else {
        diagnosis = `Kitchen Prep is the Primary Bottleneck: Food preparation (~${prep}m) represents the bulk of customer wait time (~${total}m). Implementing earlier station mise-en-place will shorten wait times.`
      }

      return {
        title: 'Average Serving Time',
        Icon: Clock,
        themeColor: '#6366F1',
        displayValue: summary.averageServingTimeMinutes !== null ? `${summary.averageServingTimeMinutes}m` : '—',
        subtitle: `Average time from order placement to dishes served at table`,
        formula: 'Serving Time = Timestamp when marked Served - Timestamp Placed',
        meaning: diagnosis,
        subMetrics: [
          {
            label: 'Kitchen Prep Time',
            value: summary.averagePrepTimeMinutes !== null ? `~${summary.averagePrepTimeMinutes}m` : '—',
            subtext: 'Cooking & assembly',
          },
          {
            label: 'Delivery Time',
            value: summary.averageDeliveryTimeMinutes !== null ? `~${summary.averageDeliveryTimeMinutes}m` : '—',
            subtext: 'Runner to table',
          },
          {
            label: 'Fastest Order',
            value: summary.fastestServingTimeMinutes !== null ? `${summary.fastestServingTimeMinutes}m` : '—',
            subtext: 'Best turnaround',
          },
        ],
        actions: [
          isRunnerBottleneck
            ? {
                title: 'Assign Dedicated Peak Runners',
                detail: `Plates spend ~${delivery}m waiting on the pass. Assign a dedicated floor runner during peak rush to deliver dishes the second the bell rings.`,
              }
            : {
                title: 'Enforce Station Mise-en-Place',
                detail: `Pre-portion ingredients for high-volume dishes like ${summary.topItem?.itemName ?? 'bestsellers'} before the rush to cut cooking time down by ~30%.`,
              },
          {
            title: 'Alert Diners When Tickets Exceed 20m',
            detail: `Proactively notify tables when elaborate tickets are in progress and offer complimentary water or bread to maintain high guest satisfaction.`,
          },
          {
            title: 'Expedite Table Turn After Plates Cleared',
            detail: `Once dishes are served promptly, present the bill when guests decline dessert so tables can be released for the next waiting party.`,
          },
        ],
      }
    }

    case 'top_item': {
      const top = summary.topItem
      const isDominant = (top?.percentageOfSales ?? 0) > 30

      return {
        title: 'Top Selling Item',
        Icon: Award,
        themeColor: '#F59E0B',
        displayValue: top ? top.itemName : '—',
        subtitle: top
          ? `${top.quantity} units sold · ₱${top.revenue.toLocaleString('en-PH', { minimumFractionDigits: 0 })} revenue`
          : 'No item data available',
        formula: 'Top Item = Item with highest total quantity sold in period',
        meaning: top
          ? isDominant
            ? `High Single-Dish Reliance: ${top.itemName} represents ${top.percentageOfSales}% of all items sold and ${top.percentageOfRevenue}% of total revenue. It is your signature anchor, but stockouts pose an immediate revenue risk.`
            : `Healthy Menu Balance: ${top.itemName} leads your sales at ${top.percentageOfSales}% of total volume, while remaining well-supported by other menu categories.`
          : 'No sales recorded in this period.',
        subMetrics: [
          {
            label: 'Units Sold',
            value: top ? `${top.quantity} units` : '—',
            subtext: top ? `${top.percentageOfSales}% of all items` : '',
          },
          {
            label: 'Item Revenue',
            value: top ? `₱${top.revenue.toLocaleString('en-PH', { minimumFractionDigits: 0 })}` : '—',
            subtext: top ? `${top.percentageOfRevenue}% of total revenue` : '',
          },
          {
            label: 'Unit Price',
            value: top ? `₱${top.unitPrice}` : '—',
            subtext: top?.categoryName ?? 'Category',
          },
        ],
        actions: [
          {
            title: `Maintain 3-Day Buffer on ${top?.itemName ?? 'Top Item'}`,
            detail: `Ensure raw ingredients and prep supplies for your #1 dish are never exhausted during peak shifts.`,
          },
          {
            title: `Bundle with High-Margin Drinks`,
            detail: `Pair ${top?.itemName ?? 'this item'} with a signature iced tea or craft soda bundle to capture additional high-margin beverage revenue.`,
          },
          {
            title: 'Pin to Top of Digital Menu',
            detail: `Position this item prominently with a "Chef\'s Recommendation" badge on table QR menus to accelerate guest ordering speed.`,
          },
        ],
      }
    }

    case 'items_sold': {
      const itemsPerOrder =
        summary.completedOrders > 0 ? (summary.itemsSold / summary.completedOrders).toFixed(1) : '—'
      return {
        title: 'Total Items Sold',
        Icon: Package,
        themeColor: '#10B981',
        displayValue: `${summary.itemsSold} items`,
        subtitle: `Across ${summary.categoryStats.length} active menu categories`,
        formula: 'Items Sold = Sum of quantities of all individual menu items fulfilled',
        meaning: `Measures total kitchen and bar throughput. With an average attachment rate of ${itemsPerOrder} items per order across ${summary.categoryStats.length} categories, your team is consistently fulfilling multi-item checks.`,
        subMetrics: [
          {
            label: 'Items per Order',
            value: `${itemsPerOrder} items`,
            subtext: 'Average attachment rate',
          },
          {
            label: 'Active Categories',
            value: `${summary.categoryStats.length}`,
            subtext: 'Menu categories sold',
          },
          {
            label: 'Completed Orders',
            value: `${summary.completedOrders}`,
            subtext: 'Orders served',
          },
        ],
        actions: [
          {
            title: 'Drive Attachment to 3.0+ Items',
            detail: `Encourage guests to add a side, appetizer, or drink so every check averages 3 or more total items.`,
          },
          {
            title: 'Prune Slow-Moving Items',
            detail: `Check the Least Selling Items list in Analytics to retire dishes with low demand, reducing prep waste and inventory holding costs.`,
          },
          {
            title: 'Balance Workstation Volume',
            detail: `Ensure item volume is evenly split across grill, fry, and cold prep stations so one line cook is never overwhelmed.`,
          },
        ],
      }
    }
  }
}
