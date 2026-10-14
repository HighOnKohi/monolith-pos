import React, { useState, useEffect, useId } from 'react'
import {
  CreditCard,
  Banknote,
  Split,
  Printer,
  X,
  AlertCircle,
} from 'lucide-react'

export interface CashierPaymentModalProps {
  isOpen: boolean
  onClose: () => void
  tableLabel: string
  totalAmount: number
  subtotalAmount: number
  invoiceId: number
  onConfirmPayment: (
    paymentMethod: 'Card' | 'Cash' | 'Both',
    amountReceived: number,
    changeGiven: number,
  ) => Promise<void>
}

export const CashierPaymentModal: React.FC<CashierPaymentModalProps> = ({
  isOpen,
  onClose,
  tableLabel,
  totalAmount,
  onConfirmPayment,
}) => {
  const [paymentMethod, setPaymentMethod] = useState<'Card' | 'Cash' | 'Both'>('Cash')
  const [cashReceived, setCashReceived] = useState<string>('')
  const [cardAmount, setCardAmount] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cashReceivedInputId = useId()
  const splitCardInputId = useId()
  const splitCashInputId = useId()

  // Reset or initialize amounts when modal opens or total changes
  useEffect(() => {
    if (isOpen) {
      setError(null)
      setIsSubmitting(false)
      if (paymentMethod === 'Card') {
        setCashReceived('')
        setCardAmount(totalAmount.toFixed(2))
      } else if (paymentMethod === 'Cash') {
        setCashReceived('')
        setCardAmount('')
      } else if (paymentMethod === 'Both') {
        // For both, default both to 0 / empty
        setCardAmount('')
        setCashReceived('')
      }
    }
  }, [isOpen, totalAmount, paymentMethod])

  if (!isOpen) return null

  // Compute values based on method
  let totalReceived = 0
  let changeGiven = 0
  let isCovered = false

  if (paymentMethod === 'Card') {
    totalReceived = totalAmount
    changeGiven = 0
    isCovered = true
  } else if (paymentMethod === 'Cash') {
    const cashVal = parseFloat(cashReceived) || 0
    totalReceived = cashVal
    changeGiven = Math.max(0, cashVal - totalAmount)
    isCovered = cashVal >= totalAmount
  } else if (paymentMethod === 'Both') {
    const cardVal = parseFloat(cardAmount) || 0
    const cashVal = parseFloat(cashReceived) || 0
    totalReceived = cardVal + cashVal
    const remainingAfterCard = Math.max(0, totalAmount - cardVal)
    changeGiven = Math.max(0, cashVal - remainingAfterCard)
    isCovered = totalReceived >= totalAmount && (cardVal > 0 || cashVal > 0)
  }

  const renderQuickButtons = (
    currentValueStr: string,
    setValue: (val: string) => void,
    fullTargetAmount: number = totalAmount,
    isCompact: boolean = false,
    maxAmount?: number,
  ) => {
    const addAmount = (increment: number) => {
      const cur = parseFloat(currentValueStr) || 0
      const next = cur + increment
      if (maxAmount !== undefined && next > maxAmount) {
        setValue(maxAmount.toFixed(2))
      } else {
        setValue(next.toFixed(2))
      }
    }
    const subAmount = (decrement: number) => {
      const cur = parseFloat(currentValueStr) || 0
      setValue(Math.max(0, cur - decrement).toFixed(2))
    }
    const setFull = () => {
      setValue(fullTargetAmount.toFixed(2))
    }
    const setEmpty = () => {
      setValue('0.00')
    }

    const increments = [1, 5, 20, 50, 100, 500, 1000]
    const decrements = [1, 5, 20, 50, 100, 500, 1000]

    const btnHeight = isCompact ? 'h-10 text-xs sm:text-sm font-black' : 'h-11 sm:h-12 text-sm sm:text-base font-black'

    return (
      <div className="space-y-1.5 pt-1">
        {/* Row 1: Plus increments + Full on the rightmost (Light Transparent Green, no peso icon, bigger numbers) */}
        <div className="grid grid-cols-8 gap-1.5">
          {increments.map((amt) => (
            <button
              key={`inc-${amt}`}
              type="button"
              onClick={() => addAmount(amt)}
              className={`${btnHeight} px-1 bg-emerald-500/15 hover:bg-emerald-500/25 active:bg-emerald-500/35 active:scale-95 text-emerald-800 border border-emerald-500/30 rounded-xl transition-all cursor-pointer text-center shadow-2xs flex items-center justify-center`}
            >
              +{amt}
            </button>
          ))}
          <button
            type="button"
            onClick={setFull}
            className={`${btnHeight} px-1 bg-emerald-500/25 hover:bg-emerald-500/35 active:bg-emerald-500/45 active:scale-95 text-emerald-900 border border-emerald-500/40 ring-1 ring-emerald-500/30 rounded-xl transition-all cursor-pointer text-center shadow-2xs flex items-center justify-center uppercase tracking-wide text-xs sm:text-sm`}
          >
            Full
          </button>
        </div>

        {/* Row 2: Minus increments + Empty on the rightmost (Light Transparent Red, no peso icon, bigger numbers) */}
        <div className="grid grid-cols-8 gap-1.5">
          {decrements.map((amt) => (
            <button
              key={`dec-${amt}`}
              type="button"
              onClick={() => subAmount(amt)}
              className={`${btnHeight} px-1 bg-rose-500/15 hover:bg-rose-500/25 active:bg-rose-500/35 active:scale-95 text-rose-800 border border-rose-500/30 rounded-xl transition-all cursor-pointer text-center shadow-2xs flex items-center justify-center`}
            >
              -{amt}
            </button>
          ))}
          <button
            type="button"
            onClick={setEmpty}
            className={`${btnHeight} px-1 bg-rose-500/25 hover:bg-rose-500/35 active:bg-rose-500/45 active:scale-95 text-rose-900 border border-rose-500/40 ring-1 ring-rose-500/30 rounded-xl transition-all cursor-pointer text-center shadow-2xs flex items-center justify-center uppercase tracking-wide text-xs sm:text-sm`}
          >
            Empty
          </button>
        </div>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (paymentMethod === 'Both') {
      const cardVal = parseFloat(cardAmount) || 0
      if (cardVal > totalAmount) {
        setError(`Card payment cannot exceed the total bill of ₱${totalAmount.toFixed(2)}.`)
        return
      }
    }
    if (!isCovered) {
      setError('Payment received must be equal to or greater than the total bill.')
      return
    }
    setError(null)
    setIsSubmitting(true)
    try {
      await onConfirmPayment(paymentMethod, totalReceived, changeGiven)
      onClose()
    } catch (err) {
      console.error('[CashierPaymentModal] Payment confirmation failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to finalize payment. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-xs animate-fade-in overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose()
      }}
    >
      {/* Dual Floating Containers Layout */}
      <form
        onSubmit={handleSubmit}
        className="flex flex-col lg:flex-row items-start gap-4 w-full max-w-5xl my-auto animate-scale-up"
      >
        {/* Container 1: Manage Receipt (Payment Setup & Quick Buttons) */}
        <div className="flex-1 min-w-0 w-full bg-white rounded-3xl shadow-2xl border border-slate-200/80 flex flex-col h-[650px] max-h-[92vh] overflow-hidden">
          {/* Header (No icon, Manage Receipt title, table label) */}
          <div className="px-6 py-4 bg-[#14274E] text-white flex items-center justify-between shrink-0">
            <div>
              <h3 className="text-lg font-black tracking-tight text-white">
                Manage Receipt
              </h3>
              <p className="text-xs text-slate-300 font-medium">
                {tableLabel}
              </p>
            </div>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Container 1 Content Body */}
          <div className="p-5 sm:p-6 space-y-4 flex-1 overflow-y-auto">
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{error}</span>
              </div>
            )}

            {/* PAYMENT METHOD Container */}
            <div className="p-3.5 bg-slate-50/80 border border-slate-200/90 rounded-2xl space-y-2">
              <h4 className="text-sm font-black uppercase tracking-wider text-slate-800">
                PAYMENT METHOD
              </h4>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('Cash')}
                  className={`py-2 px-3 rounded-2xl border text-xs font-black flex flex-col items-center gap-1 transition-all cursor-pointer ${
                    paymentMethod === 'Cash'
                      ? 'bg-orange-500 text-white border-transparent shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Banknote className="w-4 h-4" />
                  <span>Cash</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('Card')}
                  className={`py-2 px-3 rounded-2xl border text-xs font-black flex flex-col items-center gap-1 transition-all cursor-pointer ${
                    paymentMethod === 'Card'
                      ? 'bg-blue-600 text-white border-transparent shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Card</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('Both')}
                  className={`py-2 px-3 rounded-2xl border text-xs font-black flex flex-col items-center gap-1 transition-all cursor-pointer ${
                    paymentMethod === 'Both'
                      ? 'bg-violet-600 text-white border-transparent shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Split className="w-4 h-4" />
                  <span>Both</span>
                </button>
              </div>
            </div>

            {/* PAYMENT RECEIVED Input Sections */}
            {paymentMethod === 'Cash' && (
              <div className="p-4 bg-slate-50/80 border border-slate-200/90 rounded-2xl space-y-3">
                <h4 className="text-sm font-black uppercase tracking-wider text-slate-800">
                  PAYMENT RECEIVED
                </h4>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-xl">
                    ₱
                  </span>
                  <input
                    id={cashReceivedInputId}
                    type="number"
                    step="0.01"
                    min={0}
                    autoFocus
                    required
                    placeholder={totalAmount.toFixed(2)}
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                    className="w-full pl-9 pr-4 py-3 bg-white border border-slate-200 rounded-2xl font-black text-xl text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#14274E] focus:border-transparent transition-all"
                  />
                </div>
                {renderQuickButtons(cashReceived, setCashReceived, totalAmount, false)}
              </div>
            )}

            {paymentMethod === 'Both' && (
              <div className="space-y-3">
                {/* Field 1: CARD PAYMENT RECEIVED */}
                <div className="p-3.5 bg-slate-50/80 border border-slate-200/90 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-blue-600 text-white font-black text-xs sm:text-sm uppercase tracking-wider shadow-xs">
                      <CreditCard className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                      <span>CARD</span>
                    </span>
                    <span className="text-xs sm:text-sm font-black text-slate-600 uppercase tracking-wider">
                      PAYMENT RECEIVED
                    </span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                      ₱
                    </span>
                    <input
                      id={splitCardInputId}
                      type="number"
                      step="0.01"
                      min={0}
                      max={totalAmount}
                      value={cardAmount}
                      onChange={(e) => {
                        const val = e.target.value
                        if (val === '') {
                          setCardAmount('')
                          return
                        }
                        const num = parseFloat(val)
                        if (!isNaN(num) && num > totalAmount) {
                          setCardAmount(totalAmount.toFixed(2))
                        } else {
                          setCardAmount(val)
                        }
                      }}
                      placeholder="0.00"
                      className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-base text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#14274E]"
                    />
                  </div>
                  {renderQuickButtons(cardAmount, setCardAmount, totalAmount, true, totalAmount)}
                </div>

                {/* Field 2: CASH PAYMENT RECEIVED */}
                <div className="p-3.5 bg-slate-50/80 border border-slate-200/90 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-orange-500 text-white font-black text-xs sm:text-sm uppercase tracking-wider shadow-xs">
                      <Banknote className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                      <span>CASH</span>
                    </span>
                    <span className="text-xs sm:text-sm font-black text-slate-600 uppercase tracking-wider">
                      PAYMENT RECEIVED
                    </span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                      ₱
                    </span>
                    <input
                      id={splitCashInputId}
                      type="number"
                      step="0.01"
                      min={0}
                      value={cashReceived}
                      onChange={(e) => setCashReceived(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-base text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#14274E]"
                    />
                  </div>
                  {renderQuickButtons(
                    cashReceived,
                    setCashReceived,
                    Math.max(0, totalAmount - (parseFloat(cardAmount) || 0)),
                    true,
                  )}
                </div>
              </div>
            )}

            {paymentMethod === 'Card' && (
              <div className="p-8 bg-slate-50/80 border border-slate-200/90 rounded-2xl text-center space-y-3 my-auto">
                <div className="w-14 h-14 rounded-2xl bg-[#14274E]/10 flex items-center justify-center text-[#14274E] mx-auto">
                  <CreditCard className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h4 className="flex items-baseline justify-center gap-2 text-slate-800 uppercase tracking-wider">
                    <span className="text-base sm:text-lg font-black text-[#14274E]">(CARD)</span>
                    <span className="text-xs sm:text-sm font-bold text-slate-500">PAYMENT RECEIVED</span>
                  </h4>
                  <p className="text-xs text-slate-600 font-medium max-w-sm mx-auto">
                    Full amount of <strong className="text-slate-900 font-black">₱{totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong> will be charged to the POS card terminal.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Container 2: Floating Summary Container (Simple Calculation Layout, No Payment Method Badge) */}
        <div className="w-full lg:w-80 shrink-0 self-start bg-white rounded-3xl shadow-2xl border border-slate-200/80 p-5 sm:p-6 space-y-4">
          {/* Title inside the container (no payment method label) */}
          <div className="pb-3 border-b border-slate-200">
            <h4 className="text-sm font-black uppercase tracking-wider text-slate-800">
              SUMMARY
            </h4>
          </div>

          {/* Simple Calculation Design: TOTAL, RECEIVED (CASH), RECEIVED (CARD), CHANGE */}
          <div className="space-y-2.5 py-1 text-xs">
            <div className="flex justify-between items-baseline font-bold text-slate-600">
              <span className="uppercase tracking-wider">TOTAL</span>
              <span className="text-base sm:text-lg font-black font-mono text-[#14274E]">
                ₱{totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            {paymentMethod === 'Cash' && (
              <div className="flex justify-between items-baseline font-bold text-slate-600">
                <span className="uppercase tracking-wider">RECEIVED (CASH)</span>
                <span className="text-base sm:text-lg font-black font-mono text-slate-900">
                  ₱{(parseFloat(cashReceived) || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            )}

            {paymentMethod === 'Both' && (
              <>
                <div className="flex justify-between items-baseline font-bold text-slate-600">
                  <span className="uppercase tracking-wider">RECEIVED (CASH)</span>
                  <span className="text-base sm:text-lg font-black font-mono text-slate-900">
                    ₱{(parseFloat(cashReceived) || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-baseline font-bold text-slate-600">
                  <span className="uppercase tracking-wider">RECEIVED (CARD)</span>
                  <span className="text-base sm:text-lg font-black font-mono text-slate-900">
                    ₱{(parseFloat(cardAmount) || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </>
            )}

            {paymentMethod === 'Card' && (
              <div className="flex justify-between items-baseline font-bold text-slate-600">
                <span className="uppercase tracking-wider">RECEIVED (CARD)</span>
                <span className="text-base sm:text-lg font-black font-mono text-slate-900">
                  ₱{totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            )}

            {paymentMethod !== 'Card' && (
              <div className="flex justify-between items-baseline pt-2.5 border-t-2 border-slate-300">
                <span className="font-black uppercase tracking-wider text-slate-800">
                  CHANGE
                </span>
                <span
                  className={`text-xl font-black font-mono ${
                    isCovered ? 'text-emerald-600' : 'text-slate-400'
                  }`}
                >
                  ₱{changeGiven.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            )}
          </div>

          {/* Action Buttons: Confirm & Print Receipt + Cancel */}
          <div className="pt-3 space-y-2 border-t border-slate-100">
            <button
              type="submit"
              disabled={!isCovered || isSubmitting}
              className={`w-full py-3 px-4 rounded-2xl text-xs font-black flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer ${
                isCovered && !isSubmitting
                  ? 'bg-[#14274E] text-[#D6A75C] hover:bg-[#1a3264]'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Printer className="w-4 h-4" />
              <span>{isSubmitting ? 'Processing Payment...' : 'Confirm & Print Receipt'}</span>
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="w-full py-2.5 px-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-black transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
