import React, { useState, useEffect } from 'react'
import { X, Ticket, Clock, User, Phone, CheckCircle, AlertCircle, ShoppingBag } from 'lucide-react'
import type { TicketCartItem, TicketCustomerInfo } from '@/types/ticket'

interface TicketCustomerInfoModalProps {
  isOpen: boolean
  ticketId: number
  cartItems: TicketCartItem[]
  subtotal: number
  tax: number
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-backdrop-fade">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 sm:p-6 bg-[#14274E] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-2xl backdrop-blur-md">
              <Ticket className="w-6 h-6 text-[#E9C46A]" />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight">Complete Ticket Order</h3>
              <p className="text-xs text-slate-300 font-medium">Ticket #{ticketId}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
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
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs sm:text-sm text-[#14274E] font-medium focus:bg-white focus:outline-none focus:border-[#14274E] focus:ring-2 focus:ring-[#14274E]/10 transition-all"
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
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs sm:text-sm text-[#14274E] font-medium focus:bg-white focus:outline-none focus:border-[#14274E] focus:ring-2 focus:ring-[#14274E]/10 transition-all"
            />
          </div>

          {/* Field 3: Time of Arrival */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-extrabold text-[#14274E]">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              Time of Arrival <span className="text-rose-500">*</span>
            </label>
            <input
              type="time"
              required
              value={timeOfArrival}
              onChange={(e) => setTimeOfArrival(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs sm:text-sm text-[#14274E] font-bold focus:bg-white focus:outline-none focus:border-[#14274E] focus:ring-2 focus:ring-[#14274E]/10 transition-all cursor-pointer"
            />

            {/* Quick time arrival stackable presets */}
            <div className="pt-1">
              <span className="text-[10px] font-bold text-slate-400 block mb-1">Stackable Time Adjusters:</span>
              <div className="grid grid-cols-4 gap-1.5">
                <button
                  type="button"
                  onClick={() => handleQuickTimePreset(0)}
                  className="py-1 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition-all cursor-pointer"
                  title="Reset to current time"
                >
                  Now
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickTimePreset(15)}
                  className="py-1 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition-all cursor-pointer"
                  title="Add 15 minutes to arrival time"
                >
                  +15 mins
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickTimePreset(30)}
                  className="py-1 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition-all cursor-pointer"
                  title="Add 30 minutes to arrival time"
                >
                  +30 mins
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickTimePreset(60)}
                  className="py-1 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition-all cursor-pointer"
                  title="Add 1 hour to arrival time"
                >
                  +1 hour
                </button>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-bold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-[#14274E] hover:bg-[#203c73] disabled:opacity-50 text-white text-xs font-black flex items-center gap-2 transition-all cursor-pointer shadow-sm"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Punching Ticket...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 text-[#E9C46A]" />
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
