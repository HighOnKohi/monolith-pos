import { useState, useEffect } from 'react'
import {
  Clock,
  Sun,
  Sunset,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Save,
  Loader2,
  Sparkles,
  Info,
  Percent,
  HeartHandshake,
} from 'lucide-react'
import {
  fetchMorningMenuCutoff,
  updateMorningMenuCutoff,
  formatCutoffDisplay,
  isMorningMenuTime,
  DEFAULT_MORNING_MENU_CUTOFF,
  getDiscountPercentages,
  updateDiscountPercentages,
  DEFAULT_DISCOUNT_CONFIG,
} from '@/services/configurationService'

export function MenuScheduleConfigTab() {
  const [cutoffTime, setCutoffTime] = useState(DEFAULT_MORNING_MENU_CUTOFF)
  const [selectedTime, setSelectedTime] = useState(DEFAULT_MORNING_MENU_CUTOFF)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [currentTimeStr, setCurrentTimeStr] = useState('')

  // Discount percentage state (PWD & Senior Citizen)
  const [pwdDiscount, setPwdDiscount] = useState(20)
  const [seniorDiscount, setSeniorDiscount] = useState(20)
  const [discountFeedback, setDiscountFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [isSavingDiscount, setIsSavingDiscount] = useState(false)

  // Load configured cutoff and discounts on mount
  useEffect(() => {
    let mounted = true
    const discounts = getDiscountPercentages()
    setPwdDiscount(discounts.pwdPercent)
    setSeniorDiscount(discounts.seniorPercent)

    async function load() {
      setIsLoading(true)
      try {
        const val = await fetchMorningMenuCutoff()
        if (mounted) {
          setCutoffTime(val)
          setSelectedTime(val)
        }
      } catch (err) {
        console.warn('Failed to load cutoff:', err)
      } finally {
        if (mounted) setIsLoading(false)
      }
    }
    void load()

    // Realtime clock display
    const updateTime = () => {
      const now = new Date()
      setCurrentTimeStr(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      )
    }
    updateTime()
    const timer = setInterval(updateTime, 1000)

    return () => {
      mounted = false
      clearInterval(timer)
    }
  }, [])

  const isCurrentlyMorning = isMorningMenuTime(cutoffTime)

  const handleSave = async () => {
    setIsSaving(true)
    setFeedback(null)
    try {
      await updateMorningMenuCutoff(selectedTime)
      setCutoffTime(selectedTime)
      setFeedback({
        text: `Morning Menu Cutoff updated to ${formatCutoffDisplay(selectedTime)} successfully!`,
        type: 'success',
      })
      setTimeout(() => setFeedback(null), 4000)
    } catch (err) {
      setFeedback({
        text: err instanceof Error ? err.message : 'Failed to update morning menu cutoff.',
        type: 'error',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleResetDefault = () => {
    setSelectedTime(DEFAULT_MORNING_MENU_CUTOFF)
  }

  const handleSaveDiscounts = () => {
    setIsSavingDiscount(true)
    setDiscountFeedback(null)
    try {
      const p = Math.max(0, Math.min(100, Math.round(Number(pwdDiscount) || 0)))
      const s = Math.max(0, Math.min(100, Math.round(Number(seniorDiscount) || 0)))
      setPwdDiscount(p)
      setSeniorDiscount(s)
      updateDiscountPercentages(p, s)
      setDiscountFeedback({
        text: `Discount rates saved: PWD (${p}%), Senior Citizen (${s}%). Active across Cashier interface!`,
        type: 'success',
      })
      setTimeout(() => setDiscountFeedback(null), 4000)
    } catch (err) {
      setDiscountFeedback({
        text: err instanceof Error ? err.message : 'Failed to update discount percentages.',
        type: 'error',
      })
    } finally {
      setIsSavingDiscount(false)
    }
  }

  const handleResetDiscounts = () => {
    setPwdDiscount(DEFAULT_DISCOUNT_CONFIG.pwdPercent)
    setSeniorDiscount(DEFAULT_DISCOUNT_CONFIG.seniorPercent)
  }

  const quickPresets = [
    { label: '10:00 AM', value: '10:00' },
    { label: '10:30 AM', value: '10:30' },
    { label: '11:00 AM (Default)', value: '11:00' },
    { label: '11:30 AM', value: '11:30' },
    { label: '12:00 PM', value: '12:00' },
  ]

  return (
    <div className="space-y-6">
      {/* ── Main Schedule Configuration Card ── */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs overflow-hidden">
        {/* Card Header */}
        <div className="p-6 bg-gradient-to-r from-[#14274E] via-[#1a3366] to-[#14274E] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-[#E9C46A] shrink-0">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-tight">Morning Menu Cutoff</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-[#E9C46A] text-[#14274E]">
                  Configuration
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium mt-0.5">
                Determine the exact daily time when Morning Menu items end and Afternoon Menu items begin.
              </p>
            </div>
          </div>

          {/* Current Serving Live Badge */}
          <div className="bg-white/10 backdrop-blur-md border border-white/20 px-4 py-2.5 rounded-2xl flex items-center gap-3 shrink-0">
            <div className="text-right">
              <div className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">
                Current Time ({currentTimeStr})
              </div>
              <div className="text-xs font-black text-white flex items-center justify-end gap-1.5 mt-0.5">
                {isCurrentlyMorning ? (
                  <>
                    <Sun className="w-3.5 h-3.5 text-yellow-400 animate-spin-slow" />
                    <span className="text-yellow-300">Serving Morning Menu</span>
                  </>
                ) : (
                  <>
                    <Sunset className="w-3.5 h-3.5 text-orange-400" />
                    <span className="text-orange-300">Serving Afternoon Menu</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Card Body */}
        <div className="p-6 sm:p-8 space-y-6">
          {feedback && (
            <div
              className={`p-4 rounded-2xl flex items-center gap-3 text-xs font-bold border transition-all ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                  : 'bg-rose-50 text-rose-900 border-rose-200'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{feedback.text}</span>
            </div>
          )}

          {/* Time Picker & Controls */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-7 space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">
                  Cutoff Time (HH:mm)
                </label>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <input
                      type="time"
                      value={selectedTime}
                      onChange={(e) => setSelectedTime(e.target.value)}
                      disabled={isLoading || isSaving}
                      className="px-4 py-3 bg-slate-50 border-2 border-slate-300 focus:border-[#14274E] focus:bg-white rounded-2xl text-lg font-black text-[#14274E] outline-none transition-all shadow-2xs font-mono"
                    />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-base font-black text-[#14274E]">
                      {formatCutoffDisplay(selectedTime)}
                    </span>
                    <span className="text-[11px] text-slate-400 font-semibold">
                      Active: {formatCutoffDisplay(cutoffTime)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1.5">
                  Quick Select Preset:
                </label>
                <div className="flex flex-wrap gap-2">
                  {quickPresets.map((preset) => {
                    const isSelected = selectedTime === preset.value
                    return (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => setSelectedTime(preset.value)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                          isSelected
                            ? 'bg-[#14274E] text-[#E9C46A] border-[#14274E] shadow-2xs'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {preset.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isLoading || isSaving || selectedTime === cutoffTime}
                  className="px-6 py-2.5 rounded-xl bg-[#14274E] hover:bg-[#1f3b73] active:bg-[#0f1d3b] text-white text-xs font-black tracking-wide flex items-center gap-2 shadow-sm shadow-[#14274E]/25 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-[#E9C46A]" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 text-[#E9C46A]" />
                      <span>Save Morning Cutoff</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleResetDefault}
                  disabled={isLoading || isSaving || selectedTime === DEFAULT_MORNING_MENU_CUTOFF}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset to 11:00 AM</span>
                </button>
              </div>
            </div>

            {/* Visual Schedule Timeline Diagram */}
            <div className="lg:col-span-5 bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
              <div className="flex items-center gap-2 text-xs font-black text-[#14274E]">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>Daily Menu Schedule Timeline</span>
              </div>

              {/* Timeline bar */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-[11px] font-black text-slate-600">
                  <span>12:00 AM</span>
                  <span className="text-[#14274E] bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300 font-mono">
                    {formatCutoffDisplay(selectedTime)} Cutoff
                  </span>
                  <span>11:59 PM</span>
                </div>

                <div className="h-4 rounded-full w-full bg-slate-200 overflow-hidden flex border border-slate-300">
                  <div
                    className="h-full bg-gradient-to-r from-yellow-400 to-yellow-500 flex items-center justify-center text-[9px] font-black text-yellow-950 transition-all duration-300"
                    style={{ width: '45%' }}
                    title="Morning Shift"
                  >
                    Morning Shift
                  </div>
                  <div
                    className="h-full bg-gradient-to-r from-orange-500 to-orange-600 flex items-center justify-center text-[9px] font-black text-white transition-all duration-300"
                    style={{ width: '55%' }}
                    title="Afternoon Shift"
                  >
                    Afternoon Shift
                  </div>
                </div>

                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 flex items-center justify-between text-[11px] font-bold text-emerald-900">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Whole Day Items</span>
                  </div>
                  <span className="text-emerald-700 font-black">Persist 24/7 (Both Shifts)</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200/80 text-[11px] text-slate-500 space-y-1">
                <div className="flex items-start gap-1.5">
                  <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <span>
                    When the clock reaches <strong>{formatCutoffDisplay(selectedTime)}</strong>, the menu
                    automatically switches from the Morning dishes to the Afternoon dishes without requiring a reload.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── PWD & Senior Citizen Discount Configuration Card ── */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs overflow-hidden">
        {/* Card Header */}
        <div className="p-6 bg-gradient-to-r from-[#1b2a47] via-[#223963] to-[#1b2a47] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-[#E9C46A] shrink-0">
              <Percent className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-tight">PWD & Senior Citizen Discount Rates</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-[#E9C46A] text-[#14274E]">
                  Statutory & POS Policy
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium mt-0.5">
                Configure the percentage discount applied at cashier checkout when customers present a valid PWD or Senior Citizen ID.
              </p>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-md border border-white/20 px-4 py-2 rounded-2xl flex items-center gap-2.5 shrink-0">
            <HeartHandshake className="w-4 h-4 text-[#E9C46A]" />
            <span className="text-xs font-black text-white">Active in Cashier Checkout</span>
          </div>
        </div>

        {/* Card Body */}
        <div className="p-6 sm:p-8 space-y-6">
          {discountFeedback && (
            <div
              className={`p-4 rounded-2xl flex items-center gap-3 text-xs font-bold border transition-all ${
                discountFeedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                  : 'bg-rose-50 text-rose-900 border-rose-200'
              }`}
            >
              {discountFeedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{discountFeedback.text}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Input controls */}
            <div className="lg:col-span-7 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* PWD Discount Field */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
                      PWD Discount (%)
                    </label>
                    <span className="text-xs font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200 font-mono">
                      {pwdDiscount}%
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={pwdDiscount}
                      onChange={(e) => setPwdDiscount(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                      className="w-full px-4 py-2.5 bg-white border-2 border-slate-300 focus:border-[#14274E] rounded-xl text-base font-black text-[#14274E] outline-none transition-all shadow-2xs font-mono"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-black text-sm">
                      %
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[10, 15, 20, 25, 30].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setPwdDiscount(val)}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                          pwdDiscount === val
                            ? 'bg-[#14274E] text-white border-[#14274E]'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {val}%{val === 20 ? ' (Law)' : ''}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Senior Citizen Discount Field */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
                      Senior Citizen (%)
                    </label>
                    <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 font-mono">
                      {seniorDiscount}%
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={seniorDiscount}
                      onChange={(e) => setSeniorDiscount(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                      className="w-full px-4 py-2.5 bg-white border-2 border-slate-300 focus:border-[#14274E] rounded-xl text-base font-black text-[#14274E] outline-none transition-all shadow-2xs font-mono"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-black text-sm">
                      %
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[10, 15, 20, 25, 30].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setSeniorDiscount(val)}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                          seniorDiscount === val
                            ? 'bg-[#14274E] text-white border-[#14274E]'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {val}%{val === 20 ? ' (Law)' : ''}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleSaveDiscounts}
                  disabled={isSavingDiscount}
                  className="px-6 py-2.5 rounded-xl bg-[#14274E] hover:bg-[#1f3b73] active:bg-[#0f1d3b] text-white text-xs font-black tracking-wide flex items-center gap-2 shadow-sm shadow-[#14274E]/25 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSavingDiscount ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-[#E9C46A]" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 text-[#E9C46A]" />
                      <span>Save Discount Rates</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleResetDiscounts}
                  disabled={isSavingDiscount || (pwdDiscount === 20 && seniorDiscount === 20)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset to Standard 20%</span>
                </button>
              </div>
            </div>

            {/* Live Calculation Preview Card */}
            <div className="lg:col-span-5 bg-gradient-to-br from-slate-50 to-slate-100 p-5 rounded-2xl border border-slate-200 space-y-4">
              <div className="flex items-center gap-2 text-xs font-black text-[#14274E]">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>Checkout Deduction Example (₱500.00 Order)</span>
              </div>

              <div className="space-y-2 text-xs">
                {/* PWD sample */}
                <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <div className="font-black text-slate-800">PWD Discount ({pwdDiscount}%)</div>
                    <div className="text-[11px] text-slate-500">Gross: ₱500.00</div>
                  </div>
                  <div className="text-right">
                    <div className="text-rose-600 font-black">-₱{(500 * (pwdDiscount / 100)).toFixed(2)}</div>
                    <div className="text-[11px] font-bold text-emerald-700">
                      Net: ₱{(500 * (1 - pwdDiscount / 100)).toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Senior sample */}
                <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <div className="font-black text-slate-800">Senior Citizen Discount ({seniorDiscount}%)</div>
                    <div className="text-[11px] text-slate-500">Gross: ₱500.00</div>
                  </div>
                  <div className="text-right">
                    <div className="text-rose-600 font-black">-₱{(500 * (seniorDiscount / 100)).toFixed(2)}</div>
                    <div className="text-[11px] font-bold text-emerald-700">
                      Net: ₱{(500 * (1 - seniorDiscount / 100)).toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200/80 text-[11px] text-slate-500 space-y-1">
                <div className="flex items-start gap-1.5">
                  <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <span>
                    When a cashier toggles PWD or Senior Citizen discount on an order, this configured rate is instantly applied to the order subtotal.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

