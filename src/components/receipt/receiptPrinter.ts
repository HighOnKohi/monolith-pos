// ─── Thermal Receipt Printer ──────────────────────────────────────────────────
//
// Prints the receipt on 80mm thermal paper using a hidden isolated <iframe>.
//
// Architecture (Servio-style):
//   1. Remove any existing print iframe (avoid accumulation)
//   2. Create fresh hidden iframe
//   3. Write complete isolated HTML document with 80mm print CSS
//   4. All user-controlled strings are HTML-escaped to prevent injection
//   5. Wait 300ms for layout to settle, then focus + print
//   6. Fallback to window.print() if iframe printing fails
//   7. Cleanup iframe from DOM after 3s

import type { ReceiptSnapshot } from './types'

const IFRAME_ID = 'monolith-receipt-print-frame'
const BUSINESS_NAME = 'Bill Shaw Restaurant'
const BUSINESS_TAGLINE = 'Siena College Of Taytay'
const RECEIPT_LABEL = 'Official Dining Receipt'
const FOOTER_LINE1 = 'THANK YOU FOR DINING'
const FOOTER_LINE2 = 'WITH US!'
const FOOTER_LINE3 = 'Please come again'
const CUSTOMER_COPY = '*** CUSTOMER COPY ***'

/** Escape a string for safe insertion into HTML to prevent injection attacks. */
function esc(str: string | number | null | undefined): string {
  if (str == null) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Format a number as Philippine peso: ₱1,250.00 */
function peso(amount: number): string {
  return `&#8369;${amount.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

/** Build the full isolated 80mm thermal receipt HTML document. */
function buildReceiptHtml(receipt: ReceiptSnapshot): string {
  const itemRows = receipt.items
    .map((item) => {
      const qtyStr = String(item.quantity).padStart(3, ' ')
      const priceStr = `&#8369;${item.unitPrice.toFixed(2)}`
      const totalStr = `&#8369;${item.lineSubtotal.toFixed(2)}`
      return `
        <tr>
          <td class="item-name">${esc(item.name)}</td>
          <td class="item-qty">${esc(qtyStr)}</td>
          <td class="item-price">${priceStr}</td>
          <td class="item-total">${totalStr}</td>
        </tr>`
    })
    .join('\n')

  const discountRows = receipt.tableDiscounts
    .map(
      (d) => `
        <tr class="discount-row">
          <td colspan="3">${esc(d.label)}</td>
          <td class="item-total">-&#8369;${d.amount.toFixed(2)}</td>
        </tr>`
    )
    .join('\n')

  const discountSummaryRows = receipt.tableDiscounts
    .map(
      (d) => `
      <div class="summary-row discount">
        <span>${esc(d.label)}</span>
        <span>-&#8369;${d.amount.toFixed(2)}</span>
      </div>`
    )
    .join('\n')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Receipt - Table ${esc(receipt.tableNum)}</title>
  <style>
    @page {
      size: 80mm auto;
      margin: 0;
    }

    html, body {
      width: 80mm;
      max-width: 80mm;
      margin: 0;
      padding: 0;
      background: #fff;
      color: #000;
      font-family: 'Courier New', Courier, monospace;
      font-size: 11px;
      line-height: 1.4;
    }

    * {
      box-sizing: border-box;
    }

    .receipt {
      width: 80mm;
      max-width: 80mm;
      padding: 6mm 4mm;
    }

    /* Header */
    .header {
      text-align: center;
      margin-bottom: 4mm;
    }
    .header .biz-name {
      font-size: 15px;
      font-weight: bold;
      letter-spacing: 1px;
      text-transform: uppercase;
    }
    .header .biz-tagline {
      font-size: 10px;
    }
    .header .receipt-label {
      font-size: 10px;
      font-weight: bold;
    }

    /* Separators */
    .sep {
      border: none;
      border-top: 1px dashed #000;
      margin: 3mm 0;
    }
    .sep-double {
      border: none;
      border-top: 2px solid #000;
      margin: 3mm 0;
    }

    /* Transaction metadata */
    .meta-row {
      display: flex;
      justify-content: space-between;
      font-size: 10.5px;
      margin: 1mm 0;
    }
    .meta-row .meta-label {
      color: #333;
    }
    .meta-row .meta-value {
      font-weight: bold;
      text-align: right;
    }
    .meta-row .meta-value.paid {
      text-transform: uppercase;
    }

    /* Items table */
    .items-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10.5px;
      margin: 2mm 0;
    }
    .items-table thead th {
      font-weight: bold;
      font-size: 9.5px;
      text-align: left;
      padding-bottom: 1mm;
      border-bottom: 1px solid #000;
    }
    .items-table thead .item-qty,
    .items-table thead .item-price,
    .items-table thead .item-total {
      text-align: right;
    }
    .items-table tbody tr td {
      padding: 1mm 0;
      vertical-align: top;
    }
    .item-name {
      width: 40%;
      word-break: break-word;
      white-space: normal;
      padding-right: 2mm;
    }
    .item-qty {
      width: 10%;
      text-align: center;
    }
    .item-price {
      width: 24%;
      text-align: right;
      white-space: nowrap;
    }
    .item-total {
      width: 26%;
      text-align: right;
      white-space: nowrap;
    }
    .discount-row td {
      font-size: 9.5px;
      color: #333;
      padding-bottom: 1.5mm;
      font-style: italic;
    }
    .discount-row .item-total {
      font-weight: bold;
    }

    /* Summary section */
    .summary {
      margin: 2mm 0;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      font-size: 10.5px;
      margin: 0.8mm 0;
    }
    .summary-row.discount {
      color: #333;
    }
    .summary-row.total-row {
      font-size: 13px;
      font-weight: bold;
      margin-top: 2mm;
    }
    .summary-row.payment-method-row {
      font-size: 10.5px;
      margin-top: 1mm;
    }

    /* Footer */
    .footer {
      text-align: center;
      margin-top: 4mm;
      font-size: 10px;
    }
    .footer .customer-copy {
      font-weight: bold;
      font-size: 10px;
      letter-spacing: 1px;
      margin-top: 2mm;
    }
  </style>
</head>
<body>
<div class="receipt">

  <!-- Header -->
  <div class="header">
    <div class="biz-name">${esc(BUSINESS_NAME)}</div>
    <div class="biz-tagline">${esc(BUSINESS_TAGLINE)}</div>
    <div class="receipt-label">${esc(RECEIPT_LABEL)}</div>
  </div>

  <hr class="sep" />

  <!-- Transaction Metadata -->
  <div class="meta-row">
    <span class="meta-label">Table:</span>
    <span class="meta-value">#${esc(receipt.tableNum)}</span>
  </div>
  <div class="meta-row">
    <span class="meta-label">Receipt #:</span>
    <span class="meta-value">${esc(receipt.receiptId)}</span>
  </div>
  <div class="meta-row">
    <span class="meta-label">Date:</span>
    <span class="meta-value">${esc(receipt.transactionDate)}</span>
  </div>
  <div class="meta-row">
    <span class="meta-label">Time:</span>
    <span class="meta-value">${esc(receipt.transactionTime)}</span>
  </div>
  <div class="meta-row">
    <span class="meta-label">Payment:</span>
    <span class="meta-value">${esc(receipt.paymentMethod)}</span>
  </div>
  <div class="meta-row">
    <span class="meta-label">Status:</span>
    <span class="meta-value paid">COMPLETED / PAID</span>
  </div>

  <hr class="sep" />

  <!-- Items Table -->
  <table class="items-table">
    <thead>
      <tr>
        <th class="item-name">ITEM</th>
        <th class="item-qty">QTY</th>
        <th class="item-price">PRICE</th>
        <th class="item-total">TOTAL</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
      ${receipt.tableDiscounts.length > 0 ? discountRows : ''}
    </tbody>
  </table>

  <hr class="sep" />

  <!-- Summary -->
  <div class="summary">
    <div class="summary-row">
      <span>Subtotal</span>
      <span>${peso(receipt.baseSubtotal)}</span>
    </div>
    ${discountSummaryRows}
    ${receipt.totalDiscount > 0
      ? `<div class="summary-row discount">
           <span>Total Discount</span>
           <span>-${peso(receipt.totalDiscount)}</span>
         </div>`
      : ''}
    <div class="summary-row">
      <span>VAT (5%)</span>
      <span>${peso(receipt.taxAmount)}</span>
    </div>
  </div>

  <hr class="sep-double" />

  <div class="summary-row total-row">
    <span>TOTAL PAID</span>
    <span>${peso(receipt.grandTotal)}</span>
  </div>

  <div class="summary-row payment-method-row">
    <span>Payment Method</span>
    <span>${esc(receipt.paymentMethod)}</span>
  </div>

  <hr class="sep" />

  <!-- Footer -->
  <div class="footer">
    <div>${esc(FOOTER_LINE1)}</div>
    <div>${esc(FOOTER_LINE2)}</div>
    <br/>
    <div>${esc(FOOTER_LINE3)}</div>
    <br/>
    <div class="customer-copy">${esc(CUSTOMER_COPY)}</div>
  </div>

</div>
</body>
</html>`
}

/**
 * Prints the receipt using a hidden iframe for thermal printing.
 * Falls back to window.print() if iframe approach fails.
 *
 * @param receipt - The ReceiptSnapshot to print
 */
export function triggerPrint(receipt: ReceiptSnapshot): void {
  // 1. Remove any existing print iframe to avoid DOM accumulation
  const existing = document.getElementById(IFRAME_ID)
  if (existing) {
    document.body.removeChild(existing)
  }

  // 2. Create fresh hidden iframe
  const iframe = document.createElement('iframe')
  iframe.id = IFRAME_ID
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.position = 'absolute'
  iframe.style.top = '-10000px'
  iframe.style.left = '-10000px'
  iframe.style.width = '80mm'
  iframe.style.height = '1px'
  iframe.style.border = 'none'
  iframe.style.visibility = 'hidden'
  document.body.appendChild(iframe)

  // 3. Write isolated receipt HTML into iframe
  const html = buildReceiptHtml(receipt)
  const doc = iframe.contentDocument ?? iframe.contentWindow?.document
  if (!doc) {
    console.warn('[ReceiptPrinter] Could not access iframe document, falling back to window.print()')
    window.print()
    return
  }
  doc.open()
  doc.write(html)
  doc.close()

  // 4. Wait for iframe layout/rendering, then print
  setTimeout(() => {
    try {
      const iframeWindow = iframe.contentWindow
      if (!iframeWindow) throw new Error('No iframe contentWindow')
      iframeWindow.focus()
      iframeWindow.print()
    } catch (err) {
      console.warn('[ReceiptPrinter] Iframe print failed, falling back to window.print():', err)
      window.print()
    }

    // 5. Cleanup: remove iframe after print dialog has a chance to open
    setTimeout(() => {
      const el = document.getElementById(IFRAME_ID)
      if (el) {
        document.body.removeChild(el)
      }
    }, 3000)
  }, 300)
}
