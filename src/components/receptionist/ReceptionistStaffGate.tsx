import { useState, useEffect, useRef, type FormEvent } from 'react'
import { KeyRound, ShieldAlert, ArrowRight, Delete, Loader2, ConciergeBell } from 'lucide-react'
import { useReceptionistSession } from '@/contexts/ReceptionistSessionContext'
import monolithLogoYellow from '@/assets/images/monolith-logo-yellow.png'

interface ReceptionistStaffGateProps {
  onSuccess?: () => void
}

export function ReceptionistStaffGate({ onSuccess }: ReceptionistStaffGateProps) {
  const { authenticate, clearError, error } = useReceptionistSession()
  const [staffIdInput, setStaffIdInput] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

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
      await authenticate(parsedId)
      onSuccess?.()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Receptionist Staff ID verification failed.'
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

  const displayedError = localError || error

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

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/20 text-teal-200 text-[10px] font-black uppercase tracking-wider mb-2 border border-teal-400/30">
            <ConciergeBell className="w-3.5 h-3.5 text-teal-300" />
            <span>Reception Desk</span>
          </div>

          <h2 className="text-lg font-black text-white tracking-tight">Receptionist Operational Access</h2>
          <p className="text-xs text-slate-300 mt-1 max-w-xs mx-auto font-medium">
            Enter your Receptionist Staff Code to unlock floor seating and guest reception.
          </p>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-4">
          {displayedError && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="text-xs font-bold text-rose-700 leading-snug">
                {displayedError}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="receptionist-staff-id-input" className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-1.5">
                Staff Code (PIN)
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 pointer-events-none text-slate-400">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  ref={inputRef}
                  id="receptionist-staff-id-input"
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={staffIdInput}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '')
                    setStaffIdInput(val)
                    setLocalError(null)
                    clearError()
                  }}
                  placeholder="Enter Receptionist PIN..."
                  disabled={isSubmitting}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm font-bold tracking-widest text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 disabled:opacity-50 transition-all text-center"
                />
              </div>
            </div>

            {/* Quick Numeric Keypad */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => handleKeypadPress(digit)}
                  disabled={isSubmitting}
                  className="h-11 rounded-xl bg-slate-50 hover:bg-slate-100 active:bg-slate-200 font-bold text-base text-slate-700 border border-slate-200/80 transition-all cursor-pointer flex items-center justify-center disabled:opacity-50 shadow-2xs"
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                onClick={handleClear}
                disabled={isSubmitting || !staffIdInput}
                className="h-11 rounded-xl bg-rose-50/80 hover:bg-rose-100 active:bg-rose-200 font-black text-xs text-rose-600 border border-rose-200/80 transition-all cursor-pointer flex items-center justify-center disabled:opacity-40"
              >
                CLEAR
              </button>
              <button
                type="button"
                onClick={() => handleKeypadPress('0')}
                disabled={isSubmitting}
                className="h-11 rounded-xl bg-slate-50 hover:bg-slate-100 active:bg-slate-200 font-bold text-base text-slate-700 border border-slate-200/80 transition-all cursor-pointer flex items-center justify-center disabled:opacity-50 shadow-2xs"
              >
                0
              </button>
              <button
                type="button"
                onClick={handleBackspace}
                disabled={isSubmitting || !staffIdInput}
                className="h-11 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 font-bold text-slate-600 border border-slate-200 transition-all cursor-pointer flex items-center justify-center disabled:opacity-40"
              >
                <Delete className="w-4 h-4" />
              </button>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !staffIdInput.trim()}
              className="w-full py-3.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-2 active:scale-[0.99]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying Code...</span>
                </>
              ) : (
                <>
                  <span>Start Receptionist Shift</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="pt-2 border-t border-slate-100 text-center">
            <span className="text-[11px] font-medium text-slate-400">
              Only staff codes with role <strong className="text-teal-600">RECEPTIONIST</strong> can access floor seating and reception.
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
