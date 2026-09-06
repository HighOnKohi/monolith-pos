import React from 'react'
import { Printer, X, CheckCircle } from 'lucide-react'
import type { ReceiptSnapshot } from './types'
import { triggerPrint } from './receiptPrinter'

interface ReceiptPreviewModalProps {
  receipt: ReceiptSnapshot
  onClose: () => void
}

/** Format a number as Philippine peso for screen display: ₱1,250.00 */
function formatPeso(amount: number): string {
  return `₱${amount.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export const ReceiptPreviewModal: React.FC<ReceiptPreviewModalProps> = ({ receipt, onClose }) => {
  const handlePrint = () => {
    triggerPrint(receipt)
  }

  return (
    <div
      className="receipt-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Receipt Preview"
      onClick={(e) => {
        // Close if clicking outside the receipt card
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="receipt-modal-card">
        {/* ── Modal Header ── */}
        <div className="receipt-modal-header">
          <div className="flex items-center gap-2">
            <div className="receipt-success-badge">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-sm font-black text-[#14274E]">Payment Complete</h2>
              <p className="text-[11px] text-slate-500">Table #{receipt.tableNum} has been settled</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close receipt"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Receipt Paper ── */}
        <div className="receipt-paper-wrapper">
          <div className="receipt-paper" role="document" aria-label="Receipt">

            {/* Business Header */}
            <div className="receipt-header">
              <div className="receipt-biz-name">Monolith Restaurant</div>
              <div className="receipt-biz-tagline">Point of Sale System</div>
              <div className="receipt-label-text">Official Dining Receipt</div>
            </div>

            <div className="receipt-sep-dashed" />

            {/* Transaction Metadata */}
            <div className="receipt-meta-section">
              <div className="receipt-meta-row">
                <span className="receipt-meta-key">Table</span>
                <span className="receipt-meta-val">#{receipt.tableNum}</span>
              </div>
              <div className="receipt-meta-row">
                <span className="receipt-meta-key">Receipt #</span>
                <span className="receipt-meta-val receipt-meta-small">{receipt.receiptId}</span>
              </div>
              <div className="receipt-meta-row">
                <span className="receipt-meta-key">Date</span>
                <span className="receipt-meta-val">{receipt.transactionDate}</span>
              </div>
              <div className="receipt-meta-row">
                <span className="receipt-meta-key">Time</span>
                <span className="receipt-meta-val">{receipt.transactionTime}</span>
              </div>
              <div className="receipt-meta-row">
                <span className="receipt-meta-key">Payment</span>
                <span className="receipt-meta-val">{receipt.paymentMethod}</span>
              </div>
              <div className="receipt-meta-row">
                <span className="receipt-meta-key">Status</span>
                <span className="receipt-meta-val receipt-status-paid">COMPLETED / PAID</span>
              </div>
            </div>

            <div className="receipt-sep-dashed" />

            {/* Items Table Header */}
            <div className="receipt-items-header">
              <span className="receipt-item-name-col">ITEM</span>
              <span className="receipt-item-qty-col">QTY</span>
              <span className="receipt-item-price-col">PRICE</span>
              <span className="receipt-item-total-col">TOTAL</span>
            </div>

            <div className="receipt-sep-thin" />

            {/* Line Items */}
            <div className="receipt-items-list">
              {receipt.items.map((item) => (
                <div key={item.itemId} className="receipt-item-row">
                  <span className="receipt-item-name-col receipt-item-name">{item.name}</span>
                  <span className="receipt-item-qty-col receipt-item-qty">{item.quantity}</span>
                  <span className="receipt-item-price-col">{formatPeso(item.unitPrice)}</span>
                  <span className="receipt-item-total-col">{formatPeso(item.lineSubtotal)}</span>
                </div>
              ))}
            </div>

            <div className="receipt-sep-dashed" />

            {/* Summary Section */}
            <div className="receipt-summary">
              <div className="receipt-summary-row">
                <span>Subtotal</span>
                <span>{formatPeso(receipt.baseSubtotal)}</span>
              </div>

              {/* Order-level discounts */}
              {receipt.tableDiscounts.map((d, i) => (
                <div key={i} className="receipt-summary-row receipt-discount-row">
                  <span>{d.label}</span>
                  <span>-{formatPeso(d.amount)}</span>
                </div>
              ))}

              {receipt.totalDiscount > 0 && (
                <div className="receipt-summary-row receipt-total-discount-row">
                  <span>Total Discount</span>
                  <span>-{formatPeso(receipt.totalDiscount)}</span>
                </div>
              )}

              <div className="receipt-summary-row receipt-tax-row">
                <span>VAT (5%)</span>
                <span>{formatPeso(receipt.taxAmount)}</span>
              </div>
            </div>

            <div className="receipt-sep-double" />

            {/* Grand Total */}
            <div className="receipt-grand-total-row">
              <span>TOTAL PAID</span>
              <span>{formatPeso(receipt.grandTotal)}</span>
            </div>

            <div className="receipt-summary-row receipt-payment-method-row">
              <span>Payment Method</span>
              <span>{receipt.paymentMethod}</span>
            </div>

            <div className="receipt-sep-dashed" />

            {/* Footer */}
            <div className="receipt-footer">
              <p>THANK YOU FOR DINING</p>
              <p>WITH US!</p>
              <p className="receipt-footer-sub">Please come again</p>
              <p className="receipt-customer-copy">*** CUSTOMER COPY ***</p>
            </div>
          </div>
        </div>

        {/* ── Action Buttons ── */}
        <div className="receipt-modal-actions">
          <button
            onClick={handlePrint}
            className="receipt-print-btn"
            id="receipt-print-button"
          >
            <Printer className="w-4 h-4" />
            <span>Print Receipt</span>
          </button>
          <button
            onClick={onClose}
            className="receipt-done-btn"
            id="receipt-done-button"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
