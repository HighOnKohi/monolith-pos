import React, { useEffect, useState, useMemo } from 'react'
import {
  X,
  Users,
  DollarSign,
  Clock,
  Lightbulb,
  CheckCircle2,
  TrendingUp,
  LayoutGrid,
  ChefHat,
  Sparkles,
  ArrowRight,
  Info,
  Layers,
  AlertTriangle,
  Coffee,
  Sun,
  Moon,
} from 'lucide-react'
import type { AnalyticsSummary } from '@/services/analyticsService'

export type CustomerInsightTab = 'ratio' | 'spend' | 'peak'

interface CustomerInsightsModalProps {
  isOpen: boolean
  onClose: () => void
  initialTab?: CustomerInsightTab
  summary: AnalyticsSummary
}

export function CustomerInsightsModal({
  isOpen,
  onClose,
  initialTab = 'ratio',
  summary,
}: CustomerInsightsModalProps) {
  const [activeTab, setActiveTab] = useState<CustomerInsightTab>(initialTab)

  // Sync initialTab when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab)
    }
  }, [isOpen, initialTab])

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // --- Fully Dynamic Intelligence Engines ---
  const ratioData = useMemo(() => computeDynamicRatioInsights(summary), [summary])
  const spendData = useMemo(() => computeDynamicSpendInsights(summary), [summary])
  const peakData = useMemo(() => computeDynamicPeakInsights(summary), [summary])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
      <div
        className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="bg-[#14274E] text-white px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-amber-300">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-extrabold text-base tracking-tight">Customer Insights & Action Playbook</h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Dynamic Playbook
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Tailored recommendations calculated dynamically from your active dining and sales data
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection Bar */}
        <div className="bg-slate-100/80 px-5 pt-3 border-b border-slate-200 flex gap-2 overflow-x-auto shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('ratio')}
            className={`px-3.5 py-2 rounded-t-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer border-t-2 ${
              activeTab === 'ratio'
                ? 'bg-white text-[#14274E] border-[#14274E] shadow-xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-200/50'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-indigo-600" />
            <span>Customer-to-Order Ratio</span>
            <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 text-[10px]">
              {ratioData.ratioFormatted} / order
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('spend')}
            className={`px-3.5 py-2 rounded-t-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer border-t-2 ${
              activeTab === 'spend'
                ? 'bg-white text-[#14274E] border-[#14274E] shadow-xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-200/50'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
            <span>Spend per Customer</span>
            <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 text-[10px]">
              ₱{spendData.avgSpend.toFixed(0)}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('peak')}
            className={`px-3.5 py-2 rounded-t-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer border-t-2 ${
              activeTab === 'peak'
                ? 'bg-white text-[#14274E] border-[#14274E] shadow-xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-200/50'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>Peak Ordering & Seating</span>
            <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 text-[10px]">
              {peakData.peakHourClean}
            </span>
          </button>
        </div>

        {/* Tab Content Body (Scrollable) */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-slate-800 flex-1">
          {/* TAB 1: Customer-to-Order Ratio */}
          {activeTab === 'ratio' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Dynamic Stat Highlight Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-50/80 to-blue-50/80 border border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-[11px] font-bold text-indigo-800 uppercase tracking-wider">
                    Current Dining Profile
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-3xl font-black text-[#14274E] tracking-tight">
                      {ratioData.ratioFormatted} diners
                    </span>
                    <span className="text-xs font-semibold text-slate-600">per average order</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    Computed from <strong className="text-slate-900">{ratioData.totalDiners} total diners</strong> across{' '}
                    <strong className="text-slate-900">{summary.completedOrders} completed orders</strong>.
                  </p>
                </div>
                <div className="sm:text-right shrink-0 bg-white/80 backdrop-blur-xs p-3 rounded-xl border border-indigo-100/80 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Traffic Pattern</span>
                  <p className="text-xs font-bold text-indigo-700 mt-0.5 flex items-center sm:justify-end gap-1">
                    <Users className="w-3.5 h-3.5" />
                    {ratioData.archetypeTitle}
                  </p>
                  <span className="text-[10px] text-slate-500">{ratioData.archetypeShare}</span>
                </div>
              </div>

              {/* Dynamic Plain-English Meaning */}
              <div className="p-4 bg-amber-50/60 border border-amber-200/80 rounded-2xl flex items-start gap-3">
                <Lightbulb className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h3 className="font-bold text-xs text-amber-900 uppercase tracking-wide">
                    What does this mean for your business?
                  </h3>
                  <p className="text-xs text-amber-950/90 leading-relaxed">
                    {ratioData.diagnosisText}
                  </p>
                </div>
              </div>

              {/* Dynamic Action Plan */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-extrabold text-sm text-[#14274E] tracking-tight flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Customized Action Playbook (For Your {ratioData.ratioFormatted} Ratio)
                  </h3>
                  <span className="text-[11px] font-semibold text-slate-500">3 Tailored Steps</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  {ratioData.actions.map((act, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs hover:border-indigo-300 transition-colors flex flex-col justify-between space-y-3"
                    >
                      <div className="space-y-2">
                        <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
                          <act.Icon className="w-4 h-4" />
                        </div>
                        <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">
                          {act.category}
                        </span>
                        <h4 className="font-bold text-xs text-slate-900 leading-snug">{act.title}</h4>
                        <p className="text-[11px] text-slate-600 leading-relaxed">{act.description}</p>
                      </div>
                      <div className="pt-2 border-t border-slate-100 text-[10px] font-bold text-emerald-700 flex items-center gap-1">
                        <span>Expected Impact:</span>
                        <span className="font-semibold text-slate-600">{act.impact}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Average Spend per Customer */}
          {activeTab === 'spend' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Dynamic Stat Highlight Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50/80 to-teal-50/80 border border-emerald-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                    Average Guest Revenue
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-3xl font-black text-[#14274E] tracking-tight">
                      ₱{spendData.avgSpend.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className="text-xs font-semibold text-slate-600">per customer visit</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    Total Revenue (<strong className="text-slate-900">₱{summary.revenue.toLocaleString('en-PH', { minimumFractionDigits: 0 })}</strong>) ÷ Total Diners (<strong className="text-slate-900">{spendData.totalDiners}</strong>).
                  </p>
                </div>
                <div className="sm:text-right shrink-0 bg-white/80 backdrop-blur-xs p-3 rounded-xl border border-emerald-100/80 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Average Order Value</span>
                  <p className="text-base font-extrabold text-[#14274E] mt-0.5">
                    ₱{summary.averageOrderValue.toFixed(0)} <span className="text-[11px] font-normal text-slate-500">/ order</span>
                  </p>
                  <span className="text-[10px] text-emerald-700 font-semibold">
                    ~{(summary.averageOrderValue / (spendData.avgSpend || 1)).toFixed(1)} diners per ticket
                  </span>
                </div>
              </div>

              {/* Dynamic Plain-English Meaning */}
              <div className="p-4 bg-emerald-50/60 border border-emerald-200/80 rounded-2xl flex items-start gap-3">
                <Lightbulb className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h3 className="font-bold text-xs text-emerald-900 uppercase tracking-wide">
                    How should you interpret this number?
                  </h3>
                  <p className="text-xs text-emerald-950/90 leading-relaxed">
                    {spendData.diagnosisText}
                  </p>
                </div>
              </div>

              {/* Dynamic Action Plan */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-extrabold text-sm text-[#14274E] tracking-tight flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                    How to Lift Spend Beyond ₱{spendData.avgSpend.toFixed(0)} (Tailored Levers)
                  </h3>
                  <span className="text-[11px] font-semibold text-slate-500">3 Growth Levers</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  {spendData.actions.map((act, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs hover:border-emerald-300 transition-colors flex flex-col justify-between space-y-3"
                    >
                      <div className="space-y-2">
                        <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                          <act.Icon className="w-4 h-4" />
                        </div>
                        <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                          {act.category}
                        </span>
                        <h4 className="font-bold text-xs text-slate-900 leading-snug">{act.title}</h4>
                        <p className="text-[11px] text-slate-600 leading-relaxed">{act.description}</p>
                      </div>
                      <div className="pt-2 border-t border-slate-100 text-[10px] font-bold text-emerald-700 flex items-center gap-1">
                        <span>Upsell Target:</span>
                        <span className="font-semibold text-slate-600">{act.impact}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Peak Ordering & Seating */}
          {activeTab === 'peak' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Dynamic Stat Highlight Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50/80 to-orange-50/80 border border-amber-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">
                    Busiest Service Window
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-3xl font-black text-[#14274E] tracking-tight">
                      {peakData.peakHourRaw}
                    </span>
                    <span className="text-xs font-semibold text-slate-600">{peakData.timeOfDayLabel} Peak</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    Busiest Day: <strong className="text-slate-900">{peakData.peakDay}</strong>
                    {peakData.peakCustomerInfo ? (
                      <span>
                        {' '}· Highest Traffic: <strong className="text-slate-900">{peakData.peakCustomerInfo}</strong>
                      </span>
                    ) : null}
                  </p>
                </div>
                <div className="sm:text-right shrink-0 bg-white/80 backdrop-blur-xs p-3 rounded-xl border border-amber-100/80 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Kitchen Readiness Status</span>
                  <p className="text-xs font-bold text-amber-700 mt-0.5 flex items-center sm:justify-end gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    Prep cutoff: {peakData.prepCutoffTime}
                  </p>
                  <span className="text-[10px] text-slate-500">Must be 100% prepped before rush</span>
                </div>
              </div>

              {/* Dynamic Plain-English Meaning */}
              <div className="p-4 bg-orange-50/60 border border-orange-200/80 rounded-2xl flex items-start gap-3">
                <Lightbulb className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h3 className="font-bold text-xs text-orange-900 uppercase tracking-wide">
                    What does this tell you about your daily operations?
                  </h3>
                  <p className="text-xs text-orange-950/90 leading-relaxed">
                    {peakData.diagnosisText}
                  </p>
                </div>
              </div>

              {/* Dynamic Action Plan */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-extrabold text-sm text-[#14274E] tracking-tight flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-amber-600" />
                    Surge Management &amp; Off-Peak Playbook ({peakData.timeOfDayLabel} Rush)
                  </h3>
                  <span className="text-[11px] font-semibold text-slate-500">3 Operational Pillars</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  {peakData.actions.map((act, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs hover:border-amber-300 transition-colors flex flex-col justify-between space-y-3"
                    >
                      <div className="space-y-2">
                        <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                          <act.Icon className="w-4 h-4" />
                        </div>
                        <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">
                          {act.category}
                        </span>
                        <h4 className="font-bold text-xs text-slate-900 leading-snug">{act.title}</h4>
                        <p className="text-[11px] text-slate-600 leading-relaxed">{act.description}</p>
                      </div>
                      <div className="pt-2 border-t border-slate-100 text-[10px] font-bold text-amber-700 flex items-center gap-1">
                        <span>Operational Target:</span>
                        <span className="font-semibold text-slate-600">{act.impact}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Quick-Action Footer Advice */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-slate-500 shrink-0" />
              <span>
                Want to review other metrics? Switch tabs above or close this guide to inspect specific KPI cards.
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {activeTab !== 'ratio' && (
                <button
                  type="button"
                  onClick={() => setActiveTab('ratio')}
                  className="text-indigo-600 hover:text-indigo-800 font-bold px-2 py-1 rounded hover:bg-indigo-50 transition-colors cursor-pointer"
                >
                  Ratio Guide
                </button>
              )}
              {activeTab !== 'spend' && (
                <button
                  type="button"
                  onClick={() => setActiveTab('spend')}
                  className="text-emerald-600 hover:text-emerald-800 font-bold px-2 py-1 rounded hover:bg-emerald-50 transition-colors cursor-pointer"
                >
                  Spend Guide
                </button>
              )}
              {activeTab !== 'peak' && (
                <button
                  type="button"
                  onClick={() => setActiveTab('peak')}
                  className="text-amber-600 hover:text-amber-800 font-bold px-2 py-1 rounded hover:bg-amber-50 transition-colors cursor-pointer"
                >
                  Peak Guide
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Modal Action Footer */}
        <div className="bg-slate-50 px-5 py-3.5 border-t border-slate-200 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-[#14274E] hover:bg-[#1f3b73] text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            Got It, Close Guide
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// DYNAMIC INTELLIGENCE ENGINES: Rule-Based Recommendations
// ─────────────────────────────────────────────────────────────────────────────

function computeDynamicRatioInsights(summary: AnalyticsSummary) {
  const ratio = summary.customerToOrderRatio ?? 1.8
  const ratioFormatted = ratio.toFixed(1)
  const totalDiners = summary.customersServed ?? Math.round(summary.completedOrders * ratio)

  if (ratio < 2.1) {
    // Solo and Couples Dominant
    return {
      ratio,
      ratioFormatted,
      totalDiners,
      archetypeTitle: 'Couples & Solo Diners Dominate',
      archetypeShare: 'Party size under 2 represents ~70–80% of foot traffic',
      diagnosisText: `With an average party size of ${ratioFormatted} diners, over 70% of your guests arrive as pairs or individuals. Seating a pair at a rigid 4-seater table wastes 50% of the table's chairs as "dead seats", cutting your true capacity in half during rush hours.`,
      actions: [
        {
          Icon: LayoutGrid,
          category: 'Floor & Seating Layout',
          title: 'Shift to Modular 2-Top Tables',
          description:
            'Convert fixed 4-seaters into modular 2-seater tables. Keep them separated during peak rush to serve twice as many pairs, and simply push two together when a rare party of 4 arrives.',
          impact: '+25–35% peak capacity',
        },
        {
          Icon: Sparkles,
          category: 'Menu Bundling',
          title: 'Launch "Duo Set Combos"',
          description: `Formulate pre-set pairings tailored for 2 guests (2 entrees + 1 shared starter + 2 specialty drinks). Small groups decide faster when choices are bundled, shortening ordering time.`,
          impact: '+15% higher ticket size',
        },
        {
          Icon: Clock,
          category: 'Turnover Pace',
          title: 'Accelerate 2-Top Turns (35–45 min)',
          description:
            '1–2 diner parties eat significantly faster than large tables. Present the guest check promptly as dessert finishes, or offer QR table payment so pairs can depart immediately without waiting.',
          impact: 'Releases tables 15m faster',
        },
      ],
    }
  } else if (ratio < 3.2) {
    // Balanced Mix: Couples, Small Families, Office Lunch Groups
    return {
      ratio,
      ratioFormatted,
      totalDiners,
      archetypeTitle: 'Balanced Small Groups & Pairs',
      archetypeShare: 'Party size averages 2 to 3 guests per table',
      diagnosisText: `Your average party size of ${ratioFormatted} indicates a balanced dining floor of small groups, work colleagues, and pairs. Your seating capacity needs both flexibility for 2-tops and comfortable 4-top configurations without leaving isolated single chairs.`,
      actions: [
        {
          Icon: LayoutGrid,
          category: 'Floor & Seating Layout',
          title: 'Balanced 2-Top & 4-Top Ratio',
          description:
            'Maintain a 60/40 mix of flexible 2-seater and 4-seater tables. Avoid permanent large booths that cannot be separated during slower periods.',
          impact: 'Optimizes seat occupancy',
        },
        {
          Icon: Sparkles,
          category: 'Shared Appetizers',
          title: 'Promote Center-of-Table Starters',
          description: `Small groups of 2–3 love sharing. Train floor servers to recommend shared appetizers (like ${summary.topItem?.itemName ?? 'popular starters'}) as the table sits down before entrées.`,
          impact: '+₱150–₱250 per ticket',
        },
        {
          Icon: Clock,
          category: 'Kitchen Pacing',
          title: 'Synchronize Dish Delivery',
          description:
            'With 2–3 diners per table, ensure all entrees finish at the pass simultaneously so guests eat together rather than waiting for staggered plates.',
          impact: 'Higher dining satisfaction',
        },
      ],
    }
  } else {
    // Large Groups & Family Feast Dominant
    return {
      ratio,
      ratioFormatted,
      totalDiners,
      archetypeTitle: 'Family Gatherings & Large Groups',
      archetypeShare: 'Parties average 3.5+ guests per dining party',
      diagnosisText: `Your average party size of ${ratioFormatted} shows that large families, celebrations, or banquets represent your primary audience. Long dining durations (60–90 mins) mean table turns are lower, so maximizing the ticket spend per group is critical.`,
      actions: [
        {
          Icon: LayoutGrid,
          category: 'Floor & Seating Layout',
          title: 'Dedicate 6-Top & Banquet Seating',
          description:
            'Group tables into dedicated 6-to-8 seater sections or booth seating. Ensure aisles are wide enough for high-volume family service and high chairs.',
          impact: 'Accommodates large groups easily',
        },
        {
          Icon: Sparkles,
          category: 'Family Platters & Pitchers',
          title: 'Offer Family-Style Feast Bundles',
          description:
            'Create "Family Feasts for 4–6" with sharing platters and beverage pitchers (iced tea / juice carafes) rather than individual single-serve drinks.',
          impact: '+25–40% ticket size',
        },
        {
          Icon: Users,
          category: 'Service Staffing',
          title: 'Dedicated Table Expediter',
          description:
            'Assign a dedicated runner to large tables to quickly clear appetizer plates and bus empty glasses so the table feels spacious and comfortable throughout dessert.',
          impact: 'Smoother dining flow',
        },
      ],
    }
  }
}

function computeDynamicSpendInsights(summary: AnalyticsSummary) {
  const avgSpend =
    summary.averageSpendPerCustomer ??
    (summary.customersServed ? summary.revenue / summary.customersServed : 0)
  const totalDiners = summary.customersServed ?? Math.max(1, Math.round(summary.completedOrders * 1.8))
  const aov = summary.averageOrderValue

  // Compute dynamic upsell targets based on current spending
  const upsellTarget = Math.max(80, Math.round((avgSpend * 0.15) / 10) * 10)
  const addonUpgradePrice = Math.max(100, Math.round((avgSpend * 0.18) / 25) * 25)
  const loyaltyThreshold = Math.ceil((avgSpend * 1.25) / 100) * 100
  const topDish = summary.topItem?.itemName ?? 'Signature Main'

  let diagnosisText = ''
  if (avgSpend > 1200) {
    diagnosisText = `Your guests spend an impressive ₱${avgSpend.toFixed(0)} on average. This high spend confirms premium dining value. The opportunity here is driving repeat dining frequency and beverage pairings to push tickets even higher.`
  } else if (avgSpend >= 600) {
    diagnosisText = `Every guest contributes an average of ₱${avgSpend.toFixed(0)} per visit. Increasing this by just ₱${upsellTarget} through high-margin drink and dessert add-ons will generate tens of thousands in pure profit without needing extra tables.`
  } else {
    diagnosisText = `Your current average spend is ₱${avgSpend.toFixed(0)} per diner, suggesting guests primarily purchase single entrees without add-ons. Introducing bundled meals and dessert upgrades will rapidly elevate per-diner contribution.`
  }

  return {
    avgSpend,
    totalDiners,
    diagnosisText,
    actions: [
      {
        Icon: Sparkles,
        category: 'High-Margin Upselling',
        title: `Mandate Beverage Pairings (+₱${upsellTarget})`,
        description: `Beverages carry up to 80% gross profit. Train cashiers and servers to suggest a signature drink or craft brew alongside ${topDish} at order placement.`,
        impact: `+₱${upsellTarget} / guest`,
      },
      {
        Icon: ChefHat,
        category: 'Fixed-Price Bundling',
        title: `Offer "+₱${addonUpgradePrice} Soup & Dessert Add-On"`,
        description: `Guests often hesitate at full standalone dessert prices, but easily say yes to a fixed "+₱${addonUpgradePrice}" meal upgrade bundled with their main dish.`,
        impact: 'Converts 25–35% of solo checks',
      },
      {
        Icon: DollarSign,
        category: 'Tiered Loyalty Perks',
        title: `Set Spend Threshold at ₱${loyaltyThreshold.toLocaleString('en-PH')}`,
        description: `Since current average spend is ₱${avgSpend.toFixed(0)}, incentivize tables to reach ₱${loyaltyThreshold.toLocaleString('en-PH')} (e.g., complimentary chef dessert voucher on their return visit) to stretch ticket sizes.`,
        impact: '+20% ticket lift',
      },
    ],
  }
}

function computeDynamicPeakInsights(summary: AnalyticsSummary) {
  const peakHourRaw = summary.peakHour || '1:00 PM (8 orders)'
  const peakDay = summary.peakDay || 'Monday'
  const peakCustomerInfo = summary.peakCustomerPeriod
    ? `${summary.peakCustomerPeriod.period} (${summary.peakCustomerPeriod.count} diners)`
    : null

  // Extract clean hour and determine time of day
  const peakHourClean = peakHourRaw.split(' ')[0] + (peakHourRaw.includes('PM') ? ' PM' : peakHourRaw.includes('AM') ? ' AM' : '')
  const hourMatch = peakHourRaw.match(/(\d+)(?::\d+)?\s*(AM|PM)/i)

  let hour24 = 13 // default to 1 PM
  if (hourMatch) {
    let h = parseInt(hourMatch[1], 10)
    const meridian = hourMatch[2].toUpperCase()
    if (meridian === 'PM' && h < 12) h += 12
    if (meridian === 'AM' && h === 12) h = 0
    hour24 = h
  }

  // Determine time of day classification
  let timeOfDayLabel = 'Lunch'
  let prepCutoffTime = '11:00 AM'
  let surgeWindow = '12:00 PM – 2:30 PM'
  let offPeakWindow = '2:30 PM – 5:30 PM'
  let offPeakPromoTitle = '2:30–5:30 PM "Happy Hour / Merienda"'
  let offPeakPromoDetail = 'Offer 15% off specialty coffee, pastries, and snacks to monetize slow afternoon hours between lunch and dinner.'

  if (hour24 >= 6 && hour24 < 11) {
    timeOfDayLabel = 'Breakfast / Morning'
    prepCutoffTime = '6:30 AM'
    surgeWindow = '7:30 AM – 9:30 AM'
    offPeakWindow = '10:00 AM – 11:30 AM'
    offPeakPromoTitle = 'Mid-Morning Coffee Perk (10:00–11:30 AM)'
    offPeakPromoDetail = 'Run coffee & pastry combos for remote workers before the lunch rush kicks off.'
  } else if (hour24 >= 11 && hour24 < 15) {
    timeOfDayLabel = 'Lunch'
    prepCutoffTime = '11:00 AM'
    surgeWindow = '12:00 PM – 2:30 PM'
    offPeakWindow = '2:30 PM – 5:30 PM'
    offPeakPromoTitle = '2:30–5:30 PM "Happy Hour / Merienda"'
    offPeakPromoDetail = 'Run a 15% afternoon discount on desserts and coffee to monetize idle tables between lunch and dinner.'
  } else if (hour24 >= 15 && hour24 < 18) {
    timeOfDayLabel = 'Afternoon Snack / Merienda'
    prepCutoffTime = '1:30 PM'
    surgeWindow = '3:00 PM – 5:00 PM'
    offPeakWindow = '11:00 AM – 1:00 PM'
    offPeakPromoTitle = 'Express Lunch Combos (11:30 AM – 1:30 PM)'
    offPeakPromoDetail = 'Attract corporate workers with fast 15-minute lunch specials to boost low morning/noon foot traffic.'
  } else if (hour24 >= 18 && hour24 < 22) {
    timeOfDayLabel = 'Dinner Rush'
    prepCutoffTime = '5:00 PM'
    surgeWindow = '6:30 PM – 9:00 PM'
    offPeakWindow = '2:00 PM – 5:00 PM'
    offPeakPromoTitle = 'Early Bird Dinner Specials (5:00–6:00 PM)'
    offPeakPromoDetail = 'Pull diners away from the 7:30 PM bottleneck with a 10% discount for early evening arrivals.'
  } else {
    timeOfDayLabel = 'Late Night'
    prepCutoffTime = '8:30 PM'
    surgeWindow = '10:00 PM – 1:00 AM'
    offPeakWindow = '4:00 PM – 7:00 PM'
    offPeakPromoTitle = 'Twilight Bar Specials'
    offPeakPromoDetail = 'Feature late night bar bites and beverage bucket combos for night owls.'
  }

  const diagnosisText = `Your sales and dining traffic are heavily concentrated during the ${timeOfDayLabel} window (peak: ${peakHourRaw}), with ${peakDay} driving your highest weekly volume. Without structured station prep by ${prepCutoffTime}, line cooks get overwhelmed, causing ticket delays and server stress.`

  return {
    peakHourRaw,
    peakHourClean,
    peakDay,
    peakCustomerInfo,
    timeOfDayLabel,
    prepCutoffTime,
    surgeWindow,
    diagnosisText,
    actions: [
      {
        Icon: Users,
        category: 'Staff Scheduling',
        title: `Stagger Breaks Outside ${surgeWindow}`,
        description: `Ensure 100% floor and kitchen station staffing during the ${surgeWindow} rush. Schedule staff meal breaks before ${prepCutoffTime} or after the surge so stations are never undermanned.`,
        impact: 'Zero station bottleneck during rush',
      },
      {
        Icon: ChefHat,
        category: 'Kitchen Mise-en-Place',
        title: `${prepCutoffTime} Hard Kitchen Prep Cutoff`,
        description: `Pre-portion ingredients for ${summary.topItem?.itemName ?? 'bestsellers'}, par-cook bases, and refill sauces strictly before ${prepCutoffTime}. Line cooks must only assemble and fire orders during peak.`,
        impact: 'Cuts order wait time by ~35%',
      },
      {
        Icon: Sparkles,
        category: 'Off-Peak Monetization',
        title: offPeakPromoTitle,
        description: offPeakPromoDetail,
        impact: '+₱5,000–₱8,000 off-peak daily lift',
      },
    ],
  }
}
