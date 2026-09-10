import { useState } from 'react'
import { User, ArrowRight, AlertCircle } from 'lucide-react'
import logo from '@/assets/images/monolith-logo-nobg.png'

interface CustomerNameGateProps {
  isOpen: boolean
  initialName?: string
  onSaveName: (name: string) => void
  onCancel?: () => void
}

export function CustomerNameGate({
  isOpen,
  initialName = '',
  onSaveName,
  onCancel,
}: CustomerNameGateProps) {
  const [name, setName] = useState(initialName)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()

    if (!trimmed) {
      setError('Please enter your name before continuing.')
      return
    }

    if (trimmed.length < 2) {
      setError('Name must be at least 2 characters long.')
      return
    }

    if (trimmed.length > 50) {
      setError('Name cannot exceed 50 characters.')
      return
    }

    setError(null)
    onSaveName(trimmed)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden text-center p-6 sm:p-8 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Logo & Header */}
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-[#F1F6F9] border border-slate-200/60 flex items-center justify-center shadow-2xs mb-3">
            <img src={logo} alt="Monolith logo" className="w-10 h-10 object-contain" />
          </div>
          <span className="px-2.5 py-0.5 rounded-full bg-[#14274E]/10 text-[#14274E] text-[10px] font-extrabold uppercase tracking-widest mb-1.5">
            Advance Order
          </span>
          <h2 className="text-xl font-black text-[#14274E] tracking-tight">
            Before You Start Your Order
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">
            Please enter your name so our kitchen and cashier team can identify and prepare your meal.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-6 space-y-4 text-left">
          <div>
            <label className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
              Your Name <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  if (error) setError(null)
                }}
                placeholder="e.g. Alex Chen"
                autoFocus
                maxLength={50}
                className={`w-full pl-10 pr-4 py-3 bg-slate-50 border rounded-2xl text-sm font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all ${
                  error
                    ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-500/20'
                    : 'border-slate-200 focus:border-[#14274E] focus:ring-[#14274E]/15'
                }`}
              />
            </div>
            {error && (
              <div className="flex items-center gap-1.5 text-rose-600 text-xs font-semibold mt-2 animate-in fade-in duration-150">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          <div className="pt-2 flex flex-col gap-2">
            <button
              type="submit"
              className="w-full py-3.5 px-4 bg-[#14274E] hover:bg-[#1f3b73] active:scale-[0.99] text-white font-extrabold text-sm rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Continue to Menu</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="w-full py-2 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
              >
                Close
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
