import React, { useMemo } from 'react'
import { FileText, Printer, Check, X } from 'lucide-react'

export interface InvoiceModalItem {
  itemId: number
  name: string
  price: number
  percentDiscount: number
  intDiscount: number
}

export interface CashierInvoiceModalProps {
  isOpen: boolean
  onClose: () => void
  tableLabel: string
  tableNum: number
  mergeGroupNum?: number | null
  guestCount: number
  cashierName: string
  items: InvoiceModalItem[]
  subtotal: number
  vatAmount: number
  total: number
  invoiceId?: number | null
  isConfirmed: boolean
  isConfirming: boolean
  onConfirmInvoice: () => Promise<void>
  onPrintPdf: () => void
}

function formatPeso(amount: number): string {
  return `₱${amount.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export const CashierInvoiceModal: React.FC<CashierInvoiceModalProps> = ({
  isOpen,
  onClose,
  tableLabel,
  guestCount,
  cashierName,
  items,
  subtotal,
  vatAmount,
  total,
  invoiceId,
  isConfirmed,
  isConfirming,
  onConfirmInvoice,
  onPrintPdf,
}) => {
  if (!isOpen) return null

  // Group items by name to format cleanly in fine-dining A4 layout
  const { groupedLines, grossTotal, totalDiscounts } = useMemo(() => {
    let gross = 0
    let discountSum = 0
    const map = new Map<
      string,
      {
        name: string
        qty: number
        unitPrice: number
        totalDiscount: number
        grossTotal: number
        netTotal: number
      }
    >()

    items.forEach((it) => {
      gross += it.price
      const disc = Math.min(it.price, it.intDiscount)
      discountSum += disc
      const existing = map.get(it.name)
      if (existing) {
        existing.qty += 1
        existing.totalDiscount += disc
        existing.grossTotal += it.price
        existing.netTotal += it.price - disc
      } else {
        map.set(it.name, {
          name: it.name,
          qty: 1,
          unitPrice: it.price,
          totalDiscount: disc,
          grossTotal: it.price,
          netTotal: it.price - disc,
        })
      }
    })

    return {
      groupedLines: Array.from(map.values()),
      grossTotal: gross,
      totalDiscounts: discountSum,
    }
  }, [items])

  const now = new Date()
  const formattedDate = now.toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  const formattedTime = now.toLocaleTimeString('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

  return (
    <div
      className="receipt-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Invoice Preview"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isConfirming) onClose()
      }}
    >
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/90 w-full max-w-3xl my-6 overflow-hidden flex flex-col max-h-[92vh] animate-scale-up">
        {/* ── Modal Window Header (Just "Invoice", no subtitle) ── */}
        <div className="px-6 py-4 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#14274E]/10 flex items-center justify-center text-[#14274E] shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <h2 className="text-base font-black text-slate-900 tracking-tight">
              Invoice
            </h2>
          </div>
          <button
            type="button"
            disabled={isConfirming}
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close invoice"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── A4 Sheet Scrollable Viewport ── */}
        <div className="p-6 sm:p-8 bg-slate-100/70 overflow-y-auto flex-1 flex justify-center">
          {/* A4 Paper Document (Monochrome, no colored texts) */}
          <div className="w-full max-w-2xl bg-white border border-slate-300 shadow-sm p-8 sm:p-12 font-mono text-xs sm:text-sm text-black space-y-5">
            {/* 1. Business Header */}
            <div className="text-center space-y-1">
              <h1 className="text-lg sm:text-xl font-bold tracking-wider uppercase text-black">
                BILL SHAW RESTAURANT
              </h1>
              <p className="text-xs text-black">Siena College Of Taytay</p>
              <p className="text-xs font-bold tracking-widest uppercase text-black pt-1">
                OFFICIAL DINING INVOICE
              </p>
            </div>

            {/* Dashed line */}
            <div className="border-t border-dashed border-black my-2" />

            {/* 2. Transaction Metadata (2 Columns, no colored text) */}
            <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs text-black">
              <div className="flex justify-between">
                <span>Table:</span>
                <span className="font-bold">{tableLabel}</span>
              </div>
              <div className="flex justify-between">
                <span>Invoice #:</span>
                <span className="font-bold">{invoiceId ? `INV-${invoiceId}` : 'INV-DRAFT'}</span>
              </div>
              <div className="flex justify-between">
                <span>Date:</span>
                <span className="font-bold">{formattedDate}</span>
              </div>
              <div className="flex justify-between">
                <span>Time:</span>
                <span className="font-bold">{formattedTime}</span>
              </div>
              <div className="flex justify-between">
                <span>Guests:</span>
                <span className="font-bold">{guestCount} pax</span>
              </div>
              <div className="flex justify-between">
                <span>Server:</span>
                <span className="font-bold">{cashierName || 'Cashier'}</span>
              </div>
              <div className="flex justify-between">
                <span>Status:</span>
                <span className="font-bold">{isConfirmed ? 'CONFIRMED' : 'PENDING PAYMENT'}</span>
              </div>
            </div>

            {/* Dashed line */}
            <div className="border-t border-dashed border-black my-2" />

            {/* 3. Items Table Header */}
            <div>
              <div className="flex font-bold text-xs uppercase pb-2 border-b border-black text-black">
                <span className="w-1/2">ITEM</span>
                <span className="w-1/6 text-center">QTY</span>
                <span className="w-1/6 text-right">PRICE</span>
                <span className="w-1/6 text-right">TOTAL</span>
              </div>

              {/* Line Items */}
              <div className="divide-y divide-black/15 text-xs text-black">
                {groupedLines.map((line, idx) => (
                  <div key={idx} className="py-2 space-y-0.5">
                    <div className="flex items-start">
                      <span className="w-1/2 font-bold">{line.name}</span>
                      <span className="w-1/6 text-center font-bold">{line.qty}</span>
                      <span className="w-1/6 text-right">{formatPeso(line.unitPrice)}</span>
                      <span className="w-1/6 text-right font-bold">{formatPeso(line.grossTotal)}</span>
                    </div>
                    {line.totalDiscount > 0 && (
                      <div className="flex text-[11px] text-black pl-3 italic">
                        <span className="w-1/2">└ Less Discount</span>
                        <span className="w-1/6"></span>
                        <span className="w-1/6"></span>
                        <span className="w-1/6 text-right">-{formatPeso(line.totalDiscount)}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Dashed line */}
            <div className="border-t border-dashed border-black my-2" />

            {/* 4. Summary Section */}
            <div className="space-y-1.5 text-xs text-black">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatPeso(grossTotal)}</span>
              </div>

              {totalDiscounts > 0 && (
                <div className="flex justify-between font-bold">
                  <span>Total Discount</span>
                  <span>-{formatPeso(totalDiscounts)}</span>
                </div>
              )}

              <div className="flex justify-between">
                <span>Taxable Subtotal</span>
                <span>{formatPeso(subtotal)}</span>
              </div>

              <div className="flex justify-between">
                <span>VAT (5%)</span>
                <span>{formatPeso(vatAmount)}</span>
              </div>
            </div>

            {/* Double line separator */}
            <div className="border-t-2 border-b border-black py-0.5 my-2" />

            {/* 5. Grand Total */}
            <div className="flex justify-between items-baseline text-base sm:text-lg font-bold text-black py-1">
              <span className="tracking-wider">TOTAL DUE</span>
              <span>{formatPeso(total)}</span>
            </div>

            {/* Dashed line */}
            <div className="border-t border-dashed border-black my-2" />

            {/* 6. Footer */}
            <div className="text-center text-xs text-black space-y-1 pt-2">
              <p className="font-bold uppercase tracking-wider">THANK YOU FOR DINING WITH US!</p>
              <p>Please present this invoice upon settlement</p>
              <p className="font-bold pt-1 tracking-widest">*** GUEST INVOICE / CHECK ***</p>
            </div>
          </div>
        </div>

        {/* ── Modal Action Buttons ── */}
        <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            disabled={isConfirming}
            onClick={onClose}
            className="py-2.5 px-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-black transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onPrintPdf}
              className="py-2.5 px-4 rounded-2xl text-xs font-black border border-[#14274E]/30 text-[#14274E] bg-white hover:bg-slate-50 flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
            >
              <Printer className="w-4 h-4" />
              <span>Print PDF</span>
            </button>

            <button
              type="button"
              disabled={isConfirming}
              onClick={() => void onConfirmInvoice()}
              className={`py-2.5 px-5 rounded-2xl text-xs font-black flex items-center gap-1.5 shadow-sm transition-all cursor-pointer ${
                isConfirmed
                  ? 'bg-slate-800 text-white hover:bg-slate-900'
                  : 'bg-[#14274E] text-[#D6A75C] hover:bg-[#1a3264]'
              }`}
            >
              <Check className="w-4 h-4" />
              <span>
                {isConfirming
                  ? 'Confirming...'
                  : isConfirmed
                    ? 'Confirmed'
                    : 'Confirm'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
