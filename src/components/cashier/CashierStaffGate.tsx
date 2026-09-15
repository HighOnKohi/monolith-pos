import { useState, useEffect, useRef, type FormEvent } from 'react'
import { KeyRound, ShieldAlert, ArrowRight, UserCheck, Delete, Loader2 } from 'lucide-react'
import { useCashierSession } from '@/hooks/useCashierSession'
import monolithLogoYellow from '@/assets/images/monolith-logo-yellow.png'

interface CashierStaffGateProps {
  onSuccess?: () => void
}

export function CashierStaffGate({ onSuccess }: CashierStaffGateProps) {
  const { startShift, loading, error, clearError } = useCashierSession()
  const [staffIdInput, setStaffIdInput] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-focus on load
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = async (e?: FormEvent) => {
    if (e) e.preventDefault()
    clearError()
    setLocalError(null)

    const parsedId = Number(staffIdInput.trim())
    if (!staffIdInput.trim() || isNaN(parsedId) || parsedId <= 0) {
      setLocalError('Please enter a valid numeric Staff ID.')
      inputRef.current?.focus()
      return
    }

    setIsSubmitting(true)
    try {
      await startShift(parsedId)
      onSuccess?.()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Staff ID verification failed.'
      setLocalError(msg)
      inputRef.current?.focus()
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleKeypadPress = (digit: string) => {
    if (staffIdInput.length < 8) {
      setStaffIdInput((prev) => prev + digit)
      setLocalError(null)
      clearError()
    }
  }

  const handleBackspace = () => {
    setStaffIdInput((prev) => prev.slice(0, -1))
    setLocalError(null)
    clearError()
  }

  const handleClear = () => {
    setStaffIdInput('')
    setLocalError(null)
    clearError()
    inputRef.current?.focus()
  }

  const handleQuickSelect = (id: number) => {
    setStaffIdInput(String(id))
    setLocalError(null)
    clearError()
    inputRef.current?.focus()
  }

  const displayedError = localError || error

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4 animate-fade-in overflow-y-auto">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden my-auto">
        {/* Header Header */}
        <div className="bg-[#14274E] px-8 pt-8 pb-7 text-center relative overflow-hidden">
          {/* Subtle decorative glow */}
          <div className="absolute -top-12 -right-12 w-36 h-36 rounded-full bg-blue-500/10 blur-2xl pointer-events-none" />
          <div className="absolute -bottom-8 -left-8 w-28 h-28 rounded-full bg-[#E9C46A]/15 blur-xl pointer-events-none" />

          <div className="flex justify-center mb-3">
            <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/15 flex items-center justify-center shadow-lg p-2.5">
              <img src={monolithLogoYellow} alt="Monolith POS" className="w-full h-full object-contain" />
            </div>
          </div>

          <h2 className="text-xl font-black text-white tracking-tight">Cashier Operational Access</h2>
          <p className="text-xs font-semibold text-slate-300 mt-1 max-w-xs mx-auto">
            Please verify your Staff ID to begin your shift and unlock the cashier terminal.
          </p>
        </div>

        {/* Form Body */}
        <div className="p-6 sm:p-8 space-y-5">
          {/* Error Banner */}
          {displayedError && (
            <div className="bg-rose-50 border border-rose-200/80 rounded-2xl p-3.5 flex items-start gap-3 animate-shake">
              <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="text-xs font-bold text-rose-700 leading-snug">
                {displayedError}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="staff-id-input" className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-2">
                Enter Cashier Staff ID
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-4 pointer-events-none text-slate-400">
                  <KeyRound className="w-5 h-5" />
                </div>
                <input
                  id="staff-id-input"
                  ref={inputRef}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={staffIdInput}
                  onChange={(e) => {
                    const cleaned = e.target.value.replace(/[^0-9]/g, '')
                    setStaffIdInput(cleaned)
                    setLocalError(null)
                    clearError()
                  }}
                  placeholder="e.g. 1003"
                  autoFocus
                  disabled={loading || isSubmitting}
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-2 border-slate-200 focus:border-[#14274E] focus:bg-white rounded-2xl text-center text-xl font-black tracking-widest text-[#14274E] placeholder:text-slate-300 placeholder:font-normal placeholder:tracking-normal outline-hidden transition-all shadow-inner"
                />
              </div>
            </div>

            {/* Numeric Keypad for Touch Terminals */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => handleKeypadPress(digit)}
                  disabled={loading || isSubmitting}
                  className="py-3 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200/80 rounded-xl text-lg font-black text-slate-700 shadow-2xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                onClick={handleClear}
                disabled={loading || isSubmitting || !staffIdInput}
                className="py-3 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200/80 rounded-xl text-xs font-black text-slate-500 shadow-2xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
              >
                CLEAR
              </button>
              <button
                type="button"
                onClick={() => handleKeypadPress('0')}
                disabled={loading || isSubmitting}
                className="py-3 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200/80 rounded-xl text-lg font-black text-slate-700 shadow-2xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
              >
                0
              </button>
              <button
                type="button"
                onClick={handleBackspace}
                disabled={loading || isSubmitting || !staffIdInput}
                className="py-3 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200/80 rounded-xl flex items-center justify-center text-slate-500 shadow-2xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                aria-label="Backspace"
              >
                <Delete className="w-5 h-5" />
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || isSubmitting || !staffIdInput.trim()}
              className="w-full py-4 bg-[#14274E] hover:bg-[#1f3b73] active:bg-[#0f1d3b] text-white rounded-2xl font-black text-sm tracking-wide shadow-lg shadow-[#14274E]/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99]"
            >
              {isSubmitting || loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying Staff ID...</span>
                </>
              ) : (
                <>
                  <span>Start Cashier Shift</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Demo / Quick Select Helpers */}
          <div className="pt-2 border-t border-slate-100">
            <p className="text-[11px] font-bold text-slate-400 mb-2 flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5" />
              <span>Quick Select Authorized Staff:</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => handleQuickSelect(1003)}
                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-[11px] font-bold text-emerald-800 transition-colors cursor-pointer"
              >
                1003 — Juan (Cashier)
              </button>
              <button
                type="button"
                onClick={() => handleQuickSelect(1001)}
                className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg text-[11px] font-bold text-blue-800 transition-colors cursor-pointer"
              >
                1001 — Admin
              </button>
              <button
                type="button"
                onClick={() => handleQuickSelect(1002)}
                className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg text-[11px] font-bold text-amber-800 transition-colors cursor-pointer"
              >
                1002 — Maria (Manager)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
