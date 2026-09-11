import React, { useState, useEffect } from 'react'
import { X, Ticket, Clock, User, Phone, CheckCircle, AlertCircle, ShoppingBag } from 'lucide-react'
import type { TicketCartItem, TicketCustomerInfo } from '@/types/ticket'

interface TicketCustomerInfoModalProps {
  isOpen: boolean
  ticketId: number
  cartItems: TicketCartItem[]
  subtotal: number
  tax?: number
  total: number
  onClose: () => void
  onSubmit: (info: TicketCustomerInfo) => Promise<void>
  isSubmitting: boolean
}

export const TicketCustomerInfoModal: React.FC<TicketCustomerInfoModalProps> = ({
  isOpen,
  ticketId,
  cartItems,
  total,
  onClose,
  onSubmit,
  isSubmitting,
}) => {
  const [name, setName] = useState('')
  const [contactInfo, setContactInfo] = useState('')
  const [timeOfArrival, setTimeOfArrival] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setName('')
      setContactInfo('')
      setErrorMsg(null)
      // Default time of arrival: 20 minutes from now
      const defaultTime = new Date(Date.now() + 20 * 60 * 1000)
      const hh = String(defaultTime.getHours()).padStart(2, '0')
      const mm = String(defaultTime.getMinutes()).padStart(2, '0')
      setTimeOfArrival(`${hh}:${mm}`)
    }
  }, [isOpen])

  if (!isOpen) return null

  // Derive current AM/PM period from 24-hour time string
  const currentPeriod: 'AM' | 'PM' = (() => {
    if (!timeOfArrival || !timeOfArrival.includes(':')) return 'AM'
    const hh = parseInt(timeOfArrival.split(':')[0], 10)
    if (isNaN(hh)) return 'AM'
    return hh >= 12 ? 'PM' : 'AM'
  })()

  // Handle AM/PM period toggle
  const handleTogglePeriod = (targetPeriod: 'AM' | 'PM') => {
    if (!timeOfArrival || !timeOfArrival.includes(':')) return
    const parts = timeOfArrival.split(':')
    let hh = parseInt(parts[0], 10)
    const mm = parts[1] || '00'
    if (isNaN(hh)) return

    const current = hh >= 12 ? 'PM' : 'AM'
    if (current === targetPeriod) return

    if (targetPeriod === 'PM') {
      if (hh < 12) hh += 12
    } else {
      if (hh >= 12) hh -= 12
    }

    const formattedHH = String(hh).padStart(2, '0')
    setTimeOfArrival(`${formattedHH}:${mm}`)
  }

  // Quick toggle between AM and PM
  const handleFlipPeriod = () => {
    handleTogglePeriod(currentPeriod === 'AM' ? 'PM' : 'AM')
  }

  // Stackable arrival time preset handler
  const handleQuickTimePreset = (minutesToAdd: number) => {
    let baseDate = new Date()

    if (minutesToAdd === 0) {
      // "Now" resets to current time
      baseDate = new Date()
    } else if (timeOfArrival && timeOfArrival.includes(':')) {
      // Parse current time from input
      const parts = timeOfArrival.split(':')
      const hh = parseInt(parts[0], 10)
      const mm = parseInt(parts[1], 10)
      if (!isNaN(hh) && !isNaN(mm)) {
        baseDate.setHours(hh, mm, 0, 0)
        baseDate = new Date(baseDate.getTime() + minutesToAdd * 60 * 1000)
      } else {
        baseDate = new Date(Date.now() + minutesToAdd * 60 * 1000)
      }
    } else {
      baseDate = new Date(Date.now() + minutesToAdd * 60 * 1000)
    }

    const hh = String(baseDate.getHours()).padStart(2, '0')
    const mm = String(baseDate.getMinutes()).padStart(2, '0')
    setTimeOfArrival(`${hh}:${mm}`)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setErrorMsg('Please enter customer name.')
      return
    }

    if (!timeOfArrival) {
      setErrorMsg('Please specify time of arrival.')
      return
    }

    try {
      setErrorMsg(null)
      await onSubmit({
        name: name.trim(),
        contactInfo: contactInfo.trim(),
        timeOfArrival: timeOfArrival.includes(':') && timeOfArrival.split(':').length === 2
          ? `${timeOfArrival}:00`
          : timeOfArrival,
      })
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to punch order. Please try again.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs animate-backdrop-fade">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[94vh] sm:max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-6 bg-[#14274E] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 sm:p-2.5 bg-white/10 rounded-2xl backdrop-blur-md">
              <Ticket className="w-5 h-5 sm:w-6 sm:h-6 text-[#E9C46A]" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black tracking-tight">Complete Ticket Order</h3>
              <p className="text-[11px] sm:text-xs text-slate-300 font-medium">Ticket #{ticketId}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 sm:p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto overscroll-contain space-y-3.5 sm:space-y-4 flex-1">
          {errorMsg && (
            <div className="p-3 sm:p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Cart Snapshot Summary Box */}
          <div className="p-3.5 rounded-2xl bg-[#F8FAFD] border border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-600">
              <span className="flex items-center gap-1.5">
                <ShoppingBag className="w-3.5 h-3.5 text-[#14274E]" />
                {cartItems.reduce((s, i) => s + i.quantity, 0)} Items Selected
              </span>
              <span className="text-[#14274E] font-black text-sm">
                ₱{total.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 line-clamp-1">
              {cartItems.map((ci) => `${ci.quantity}x ${ci.name}`).join(', ')}
            </div>
          </div>

          {/* Field 1: Customer Name */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-extrabold text-[#14274E]">
              <User className="w-3.5 h-3.5 text-slate-400" />
              Customer / Registered Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. John Doe / Maria Santos"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-base sm:text-sm text-[#14274E] font-medium focus:bg-white focus:outline-none focus:border-[#14274E] focus:ring-2 focus:ring-[#14274E]/10 transition-all"
            />
          </div>

          {/* Field 2: Contact Info */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-extrabold text-[#14274E]">
              <Phone className="w-3.5 h-3.5 text-slate-400" />
              Contact Information
            </label>
            <input
              type="text"
              value={contactInfo}
              onChange={(e) => setContactInfo(e.target.value)}
              placeholder="e.g. 09171234567"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-base sm:text-sm text-[#14274E] font-medium focus:bg-white focus:outline-none focus:border-[#14274E] focus:ring-2 focus:ring-[#14274E]/10 transition-all"
            />
          </div>

          {/* Field 3: Time of Arrival */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs font-extrabold text-[#14274E]">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Time of Arrival <span className="text-rose-500">*</span>
              </label>
              <button
                type="button"
                onClick={handleFlipPeriod}
                className="text-[11px] font-bold text-slate-400 hover:text-[#14274E] transition-colors cursor-pointer"
                title="Click to toggle AM/PM"
              >
                {(() => {
                  if (!timeOfArrival || !timeOfArrival.includes(':')) return ''
                  const parts = timeOfArrival.split(':')
                  const hh = parseInt(parts[0], 10)
                  const mm = parts[1] || '00'
                  if (isNaN(hh)) return ''
                  const h12 = hh % 12 === 0 ? 12 : hh % 12
                  return `${h12}:${mm} ${currentPeriod}`
                })()}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="time"
                required
                value={timeOfArrival}
                onChange={(e) => setTimeOfArrival(e.target.value)}
                className="ticket-time-input flex-1 px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-base sm:text-sm text-[#14274E] font-bold focus:bg-white focus:outline-none focus:border-[#14274E] focus:ring-2 focus:ring-[#14274E]/10 transition-all cursor-pointer"
              />

              {/* AM / PM Segmented Toggle */}
              <div className="flex items-center p-1 bg-slate-100 rounded-2xl sm:rounded-xl border border-slate-200/80 shrink-0 select-none shadow-xs">
                <button
                  type="button"
                  onClick={() => handleTogglePeriod('AM')}
                  className={`px-4 sm:px-4 py-2.5 sm:py-2 rounded-xl sm:rounded-lg text-sm sm:text-xs font-black transition-all cursor-pointer min-h-[42px] sm:min-h-0 flex items-center justify-center ${
                    currentPeriod === 'AM'
                      ? 'bg-[#14274E] text-[#E9C46A] shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'
                  }`}
                  aria-pressed={currentPeriod === 'AM'}
                  title="Switch to AM"
                >
                  AM
                </button>
                <button
                  type="button"
                  onClick={() => handleTogglePeriod('PM')}
                  className={`px-4 sm:px-4 py-2.5 sm:py-2 rounded-xl sm:rounded-lg text-sm sm:text-xs font-black transition-all cursor-pointer min-h-[42px] sm:min-h-0 flex items-center justify-center ${
                    currentPeriod === 'PM'
                      ? 'bg-[#14274E] text-[#E9C46A] shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'
                  }`}
                  aria-pressed={currentPeriod === 'PM'}
                  title="Switch to PM"
                >
                  PM
                </button>
              </div>
            </div>

            {/* Quick time arrival stackable presets */}
            <div className="pt-2 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-[10px] font-bold text-slate-400">Stackable Time Adjusters:</span>
                <button
                  type="button"
                  onClick={() => handleQuickTimePreset(0)}
                  className="px-3.5 sm:px-2.5 py-1.5 sm:py-0.5 rounded-xl sm:rounded-lg bg-slate-100 hover:bg-[#14274E] hover:text-[#E9C46A] text-slate-600 text-xs sm:text-[10px] font-extrabold transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                  title="Reset to current time"
                >
                  <span>Now (Reset)</span>
                </button>
              </div>

              {/* Add Time (+) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs sm:text-[10px] font-bold text-emerald-700">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 sm:w-1.5 h-2 sm:h-1.5 rounded-full bg-emerald-500" />
                    Add Time (+)
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-1.5 sm:gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleQuickTimePreset(5)}
                    className="py-2.5 sm:py-1 px-1 rounded-xl sm:rounded-lg bg-emerald-50/70 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 text-xs sm:text-[11px] font-extrabold sm:font-bold transition-all cursor-pointer text-center active:scale-95 min-h-[38px] sm:min-h-0 flex items-center justify-center"
                    title="Add 5 minutes to arrival time"
                  >
                    <span className="sm:hidden">+5m</span>
                    <span className="hidden sm:inline">+5 mins</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickTimePreset(10)}
                    className="py-2.5 sm:py-1 px-1 rounded-xl sm:rounded-lg bg-emerald-50/70 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 text-xs sm:text-[11px] font-extrabold sm:font-bold transition-all cursor-pointer text-center active:scale-95 min-h-[38px] sm:min-h-0 flex items-center justify-center"
                    title="Add 10 minutes to arrival time"
                  >
                    <span className="sm:hidden">+10m</span>
                    <span className="hidden sm:inline">+10 mins</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickTimePreset(15)}
                    className="py-2.5 sm:py-1 px-1 rounded-xl sm:rounded-lg bg-emerald-50/70 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 text-xs sm:text-[11px] font-extrabold sm:font-bold transition-all cursor-pointer text-center active:scale-95 min-h-[38px] sm:min-h-0 flex items-center justify-center"
                    title="Add 15 minutes to arrival time"
                  >
                    <span className="sm:hidden">+15m</span>
                    <span className="hidden sm:inline">+15 mins</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickTimePreset(30)}
                    className="py-2.5 sm:py-1 px-1 rounded-xl sm:rounded-lg bg-emerald-50/70 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 text-xs sm:text-[11px] font-extrabold sm:font-bold transition-all cursor-pointer text-center active:scale-95 min-h-[38px] sm:min-h-0 flex items-center justify-center"
                    title="Add 30 minutes to arrival time"
                  >
                    <span className="sm:hidden">+30m</span>
                    <span className="hidden sm:inline">+30 mins</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickTimePreset(60)}
                    className="py-2.5 sm:py-1 px-1 rounded-xl sm:rounded-lg bg-emerald-50/70 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 text-xs sm:text-[11px] font-extrabold sm:font-bold transition-all cursor-pointer text-center active:scale-95 min-h-[38px] sm:min-h-0 flex items-center justify-center"
                    title="Add 1 hour to arrival time"
                  >
                    <span className="sm:hidden">+1h</span>
                    <span className="hidden sm:inline">+1 hour</span>
                  </button>
                </div>
              </div>

              {/* Reduce Time (-) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs sm:text-[10px] font-bold text-rose-700">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 sm:w-1.5 h-2 sm:h-1.5 rounded-full bg-rose-500" />
                    Reduce Time (-)
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-1.5 sm:gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleQuickTimePreset(-5)}
                    className="py-2.5 sm:py-1 px-1 rounded-xl sm:rounded-lg bg-rose-50/70 hover:bg-rose-100 text-rose-800 border border-rose-200/80 text-xs sm:text-[11px] font-extrabold sm:font-bold transition-all cursor-pointer text-center active:scale-95 min-h-[38px] sm:min-h-0 flex items-center justify-center"
                    title="Subtract 5 minutes from arrival time"
                  >
                    <span className="sm:hidden">-5m</span>
                    <span className="hidden sm:inline">-5 mins</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickTimePreset(-10)}
                    className="py-2.5 sm:py-1 px-1 rounded-xl sm:rounded-lg bg-rose-50/70 hover:bg-rose-100 text-rose-800 border border-rose-200/80 text-xs sm:text-[11px] font-extrabold sm:font-bold transition-all cursor-pointer text-center active:scale-95 min-h-[38px] sm:min-h-0 flex items-center justify-center"
                    title="Subtract 10 minutes from arrival time"
                  >
                    <span className="sm:hidden">-10m</span>
                    <span className="hidden sm:inline">-10 mins</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickTimePreset(-15)}
                    className="py-2.5 sm:py-1 px-1 rounded-xl sm:rounded-lg bg-rose-50/70 hover:bg-rose-100 text-rose-800 border border-rose-200/80 text-xs sm:text-[11px] font-extrabold sm:font-bold transition-all cursor-pointer text-center active:scale-95 min-h-[38px] sm:min-h-0 flex items-center justify-center"
                    title="Subtract 15 minutes from arrival time"
                  >
                    <span className="sm:hidden">-15m</span>
                    <span className="hidden sm:inline">-15 mins</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickTimePreset(-30)}
                    className="py-2.5 sm:py-1 px-1 rounded-xl sm:rounded-lg bg-rose-50/70 hover:bg-rose-100 text-rose-800 border border-rose-200/80 text-xs sm:text-[11px] font-extrabold sm:font-bold transition-all cursor-pointer text-center active:scale-95 min-h-[38px] sm:min-h-0 flex items-center justify-center"
                    title="Subtract 30 minutes from arrival time"
                  >
                    <span className="sm:hidden">-30m</span>
                    <span className="hidden sm:inline">-30 mins</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickTimePreset(-60)}
                    className="py-2.5 sm:py-1 px-1 rounded-xl sm:rounded-lg bg-rose-50/70 hover:bg-rose-100 text-rose-800 border border-rose-200/80 text-xs sm:text-[11px] font-extrabold sm:font-bold transition-all cursor-pointer text-center active:scale-95 min-h-[38px] sm:min-h-0 flex items-center justify-center"
                    title="Subtract 1 hour from arrival time"
                  >
                    <span className="sm:hidden">-1h</span>
                    <span className="hidden sm:inline">-1 hour</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3.5 border-t border-slate-100 flex items-center justify-end gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 sm:flex-initial px-4 py-3 sm:py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 text-sm sm:text-xs font-bold transition-colors cursor-pointer text-center min-h-[44px] sm:min-h-0"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-2 sm:flex-initial px-5 py-3 sm:py-2.5 rounded-xl bg-[#14274E] hover:bg-[#203c73] disabled:opacity-50 text-white text-sm sm:text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm min-h-[44px] sm:min-h-0"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Punching Ticket...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-4.5 h-4.5 sm:w-4 sm:h-4 text-[#E9C46A]" />
                  <span>Punch Order (Ticket #{ticketId})</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
