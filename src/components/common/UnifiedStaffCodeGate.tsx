import { useState, useEffect, useRef, type FormEvent } from 'react'
import {
  KeyRound,
  ShieldAlert,
  ArrowRight,
  Delete,
  Loader2,
  Store,
  UtensilsCrossed,
  ChefHat,
  ConciergeBell,
  FolderKanban,
  type LucideIcon,
} from 'lucide-react'
import monolithLogoYellow from '@/assets/images/monolith-logo-yellow.png'

export type StaffRoleGateType = 'CASHIER' | 'SERVICE' | 'DISPATCHER' | 'RECEPTIONIST' | 'ORGANIZER'

interface RoleConfig {
  icon: LucideIcon
  badgeLabel: string
  title: string
  subtitle: string
  submitLabel: string
  roleNote: string
}

const ROLE_CONFIGS: Record<StaffRoleGateType, RoleConfig> = {
  CASHIER: {
    icon: Store,
    badgeLabel: 'Cashier Station',
    title: 'Cashier Operational Access',
    subtitle: 'Enter your Cashier Staff Code to unlock the checkout terminal.',
    submitLabel: 'Start Cashier Shift',
    roleNote: 'CASHIER',
  },
  SERVICE: {
    icon: UtensilsCrossed,
    badgeLabel: 'Service & Floor Ordering',
    title: 'Service Operational Access',
    subtitle: 'Enter your Service Staff Code to begin your service shift and take table orders.',
    submitLabel: 'Start Service Shift',
    roleNote: 'SERVICE',
  },
  DISPATCHER: {
    icon: ChefHat,
    badgeLabel: 'Kitchen Dispatch Line',
    title: 'Dispatcher Operational Access',
    subtitle: 'Enter your registered Dispatcher Staff Code to begin your shift.',
    submitLabel: 'Start Dispatcher Shift',
    roleNote: 'DISPATCHER',
  },
  RECEPTIONIST: {
    icon: ConciergeBell,
    badgeLabel: 'Reception Desk',
    title: 'Receptionist Operational Access',
    subtitle: 'Enter your Receptionist Staff Code to unlock floor seating and guest reception.',
    submitLabel: 'Start Receptionist Shift',
    roleNote: 'RECEPTIONIST',
  },
  ORGANIZER: {
    icon: FolderKanban,
    badgeLabel: 'Management Access',
    title: 'Organizer Authorization',
    subtitle: 'Enter your Organizer Staff Code to access restaurant management interfaces.',
    submitLabel: 'Start Organizer Shift',
    roleNote: 'ORGANIZER',
  },
}

export interface UnifiedStaffCodeGateProps {
  role: StaffRoleGateType
  onSubmit: (staffId: number) => Promise<unknown> | unknown
  loading?: boolean
  error?: string | null
  onClearError?: () => void
  onSuccess?: () => void
  title?: string
  subtitle?: string
  badgeLabel?: string
  submitLabel?: string
}

export function UnifiedStaffCodeGate({
  role,
  onSubmit,
  loading = false,
  error = null,
  onClearError,
  onSuccess,
  title,
  subtitle,
  badgeLabel,
  submitLabel,
}: UnifiedStaffCodeGateProps) {
  const config = ROLE_CONFIGS[role]
  const RoleIcon = config.icon

  const [staffIdInput, setStaffIdInput] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = async (e?: FormEvent) => {
    if (e) e.preventDefault()
    onClearError?.()
    setLocalError(null)

    const parsedId = Number(staffIdInput.trim())
    if (!staffIdInput.trim() || isNaN(parsedId) || parsedId <= 0) {
      setLocalError('Please enter a valid numeric Staff ID.')
      inputRef.current?.focus()
      return
    }

    setIsSubmitting(true)
    try {
      await onSubmit(parsedId)
      onSuccess?.()
    } catch (err) {
      const defaultMsg = `${config.roleNote.charAt(0) + config.roleNote.slice(1).toLowerCase()} Staff ID verification failed.`
      const msg = err instanceof Error ? err.message : defaultMsg
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
      onClearError?.()
    }
  }

  const handleBackspace = () => {
    setStaffIdInput((prev) => prev.slice(0, -1))
    setLocalError(null)
    onClearError?.()
  }

  const handleClear = () => {
    setStaffIdInput('')
    setLocalError(null)
    onClearError?.()
    inputRef.current?.focus()
  }

  const displayedError = localError || error
  const busy = loading || isSubmitting

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-900/60 p-4 overflow-y-auto">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-[#14274E] px-6 py-6 text-center">
          <div className="flex justify-center mb-2.5">
            <div className="w-12 h-12 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center p-2 shadow-inner">
              <img src={monolithLogoYellow} alt="Monolith POS" className="w-full h-full object-contain drop-shadow-xs" />
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-[#E9C46A] border border-[#E9C46A]/20 text-[10px] font-black uppercase tracking-wider mb-2">
            <RoleIcon className="w-3.5 h-3.5 text-[#E9C46A]" />
            <span>{badgeLabel || config.badgeLabel}</span>
          </div>

          <h2 className="text-lg font-black text-white tracking-tight">{title || config.title}</h2>
          <p className="text-xs text-slate-300 mt-1 max-w-xs mx-auto font-medium">
            {subtitle || config.subtitle}
          </p>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-4">
          {displayedError && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-start gap-2.5 animate-in fade-in slide-in-from-top-1 duration-150">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="text-xs font-bold text-rose-700 leading-snug">
                {displayedError}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="unified-staff-id-input" className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-1.5">
                Staff Code (PIN)
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 pointer-events-none text-slate-400">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  id="unified-staff-id-input"
                  ref={inputRef}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={staffIdInput}
                  onChange={(e) => {
                    const cleaned = e.target.value.replace(/[^0-9]/g, '')
                    setStaffIdInput(cleaned)
                    setLocalError(null)
                    onClearError?.()
                  }}
                  placeholder="e.g. 1001"
                  autoFocus
                  disabled={busy}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border-2 border-slate-200 focus:border-[#14274E] focus:bg-white rounded-xl text-center text-xl font-black tracking-widest text-[#14274E] placeholder:text-slate-300 placeholder:font-normal placeholder:tracking-normal outline-none font-mono transition-all"
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
                  disabled={busy}
                  className="py-3 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200 rounded-xl text-base font-black text-slate-700 cursor-pointer disabled:opacity-50 select-none transition-colors"
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                onClick={handleClear}
                disabled={busy || !staffIdInput}
                className="py-3 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200 rounded-xl text-xs font-black text-slate-500 cursor-pointer disabled:opacity-50 select-none transition-colors"
              >
                CLEAR
              </button>
              <button
                type="button"
                onClick={() => handleKeypadPress('0')}
                disabled={busy}
                className="py-3 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200 rounded-xl text-base font-black text-slate-700 cursor-pointer disabled:opacity-50 select-none transition-colors"
              >
                0
              </button>
              <button
                type="button"
                onClick={handleBackspace}
                disabled={busy || !staffIdInput}
                className="py-3 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200 rounded-xl flex items-center justify-center text-slate-500 cursor-pointer disabled:opacity-50 select-none transition-colors"
                aria-label="Backspace"
              >
                <Delete className="w-5 h-5" />
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={busy || !staffIdInput.trim()}
              className="w-full py-3.5 bg-[#14274E] hover:bg-[#1f3b73] active:bg-[#14274E] text-white rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs transition-all active:scale-[0.99]"
            >
              {busy ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <span>{submitLabel || config.submitLabel}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="pt-2 border-t border-slate-100 text-center">
            <span className="text-[11px] font-medium text-slate-400">
              Only staff codes registered with role <strong className="text-[#14274E] font-bold">{config.roleNote}</strong> can access this station.
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
