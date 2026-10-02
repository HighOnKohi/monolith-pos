import { useState, useEffect, useRef, type FormEvent } from 'react'
import { KeyRound, ShieldAlert, ArrowRight, Delete, Loader2, ChefHat } from 'lucide-react'
import { startDispatcherShift } from '@/services/dispatcherShiftService'
import monolithLogoYellow from '@/assets/images/monolith-logo-yellow.png'

interface DispatcherStaffGateProps {
  onSuccess?: () => void
}

export function DispatcherStaffGate({ onSuccess }: DispatcherStaffGateProps) {
  const [staffIdInput, setStaffIdInput] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = async (e?: FormEvent) => {
    if (e) e.preventDefault()
    setLocalError(null)

    const parsedId = Number(staffIdInput.trim())
    if (!staffIdInput.trim() || isNaN(parsedId) || parsedId <= 0) {
      setLocalError('Please enter a valid numeric Staff ID.')
      inputRef.current?.focus()
      return
    }

    setIsSubmitting(true)
    try {
      await startDispatcherShift(parsedId)
      onSuccess?.()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Dispatcher Staff ID verification failed.'
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
    }
  }

  const handleBackspace = () => {
    setStaffIdInput((prev) => prev.slice(0, -1))
    setLocalError(null)
  }

  const handleClear = () => {
    setStaffIdInput('')
    setLocalError(null)
    inputRef.current?.focus()
  }

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-900/60 p-4 overflow-y-auto">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden my-auto">
        {/* Header */}
        <div className="bg-[#14274E] px-6 py-6 text-center">
          <div className="flex justify-center mb-2.5">
            <div className="w-12 h-12 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center p-2">
              <img src={monolithLogoYellow} alt="Monolith POS" className="w-full h-full object-contain" />
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-[#E9C46A] text-[10px] font-black uppercase tracking-wider mb-2">
            <ChefHat className="w-3.5 h-3.5" />
            <span>Kitchen Dispatch Line</span>
          </div>

          <h2 className="text-lg font-black text-white tracking-tight">Dispatcher Operational Access</h2>
          <p className="text-xs text-slate-300 mt-1 max-w-xs mx-auto font-medium">
            Enter your registered Dispatcher Staff Code to begin your shift.
          </p>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-4">
          {localError && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="text-xs font-bold text-rose-700 leading-snug">
                {localError}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="dispatcher-staff-id-input" className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-1.5">
                Staff Code (PIN)
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 pointer-events-none text-slate-400">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  id="dispatcher-staff-id-input"
                  ref={inputRef}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={staffIdInput}
                  onChange={(e) => {
                    const cleaned = e.target.value.replace(/[^0-9]/g, '')
                    setStaffIdInput(cleaned)
                    setLocalError(null)
                  }}
                  placeholder="e.g. 1001"
                  autoFocus
                  disabled={isSubmitting}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border-2 border-slate-200 focus:border-[#14274E] focus:bg-white rounded-xl text-center text-xl font-black tracking-widest text-[#14274E] placeholder:text-slate-300 placeholder:font-normal placeholder:tracking-normal outline-none font-mono"
                />
              </div>
            </div>

            {/* Numeric Keypad */}
            <div className="grid grid-cols-3 gap-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => handleKeypadPress(digit)}
                  disabled={isSubmitting}
                  className="py-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-base font-black text-slate-700 cursor-pointer disabled:opacity-50 select-none"
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                onClick={handleClear}
                disabled={isSubmitting || !staffIdInput}
                className="py-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-black text-slate-500 cursor-pointer disabled:opacity-50 select-none"
              >
                CLEAR
              </button>
              <button
                type="button"
                onClick={() => handleKeypadPress('0')}
                disabled={isSubmitting}
                className="py-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-base font-black text-slate-700 cursor-pointer disabled:opacity-50 select-none"
              >
                0
              </button>
              <button
                type="button"
                onClick={handleBackspace}
                disabled={isSubmitting || !staffIdInput}
                className="py-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl flex items-center justify-center text-slate-500 cursor-pointer disabled:opacity-50 select-none"
                aria-label="Backspace"
              >
                <Delete className="w-5 h-5" />
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || !staffIdInput.trim()}
              className="w-full py-3.5 bg-[#14274E] hover:bg-[#1f3b73] text-white rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <span>Start Dispatcher Shift</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
