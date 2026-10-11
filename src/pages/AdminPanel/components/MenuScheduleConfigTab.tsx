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
} from 'lucide-react'
import {
  fetchMorningMenuCutoff,
  updateMorningMenuCutoff,
  formatCutoffDisplay,
  isMorningMenuTime,
  DEFAULT_MORNING_MENU_CUTOFF,
} from '@/services/configurationService'

export function MenuScheduleConfigTab() {
  const [cutoffTime, setCutoffTime] = useState(DEFAULT_MORNING_MENU_CUTOFF)
  const [selectedTime, setSelectedTime] = useState(DEFAULT_MORNING_MENU_CUTOFF)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [currentTimeStr, setCurrentTimeStr] = useState('')

  // Load configured cutoff on mount
  useEffect(() => {
    let mounted = true
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
    </div>
  )
}
