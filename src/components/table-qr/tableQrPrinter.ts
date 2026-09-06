// ─── Table QR Printer ─────────────────────────────────────────────────────────
//
// Prints QR codes using isolated hidden iframes (same pattern as receiptPrinter.ts).
// No external PDF library needed — uses browser "Save as PDF" from the print dialog.
//
// Functions:
//   printSingleQr(tableId, tableNum)   — prints one table's QR card
//   printBulkQrPdf(tables)             — prints all tables in a 2-column A4 grid
//
// Both functions use getTableQrUrl() from tableQrUtils.ts as the canonical
// QR source — guaranteeing individual and PDF QR codes always match.
//
// QR generation: Uses the `qrcode` library to render canvas data-URLs at
// high resolution (1024×1024 with error correction M).

import QRCode from 'qrcode'
import { getTableQrUrl, getTableLabel } from './tableQrUtils'

const SINGLE_IFRAME_ID = 'monolith-qr-print-single-frame'
const BULK_IFRAME_ID = 'monolith-qr-print-bulk-frame'
const BUSINESS_NAME = 'Bill Shaw Restaurant'
const SCAN_INSTRUCTION = 'Scan to view our menu and place your order'
const NO_APP = 'No app download required'

interface TableRef {
  TABLE_ID: number
  TABLE_NUM: number
}

/** Escape HTML to prevent injection */
function esc(str: string | number): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Generate a high-resolution QR data URL (PNG, 1024×1024) */
async function generateQrDataUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, {
    errorCorrectionLevel: 'M',
    width: 1024,
    margin: 2,
    color: { dark: '#000000', light: '#ffffff' },
  })
}

/** Remove an iframe from DOM by ID if it exists */
function removeFrame(id: string): void {
  const el = document.getElementById(id)
  if (el) document.body.removeChild(el)
}

/** Create and append a hidden off-screen iframe */
function createHiddenFrame(id: string): HTMLIFrameElement {
  const iframe = document.createElement('iframe')
  iframe.id = id
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.position = 'absolute'
  iframe.style.top = '-10000px'
  iframe.style.left = '-10000px'
  iframe.style.width = '210mm'
  iframe.style.height = '1px'
  iframe.style.border = 'none'
  iframe.style.visibility = 'hidden'
  document.body.appendChild(iframe)
  return iframe
}

/** Build and trigger an iframe print, then clean up */
function triggerIframePrint(id: string, html: string): void {
  removeFrame(id)
  const iframe = createHiddenFrame(id)

  const doc = iframe.contentDocument ?? iframe.contentWindow?.document
  if (!doc) {
    console.warn('[TableQrPrinter] Cannot access iframe document')
    window.print()
    return
  }

  doc.open()
  doc.write(html)
  doc.close()

  setTimeout(() => {
    try {
      iframe.contentWindow?.focus()
      iframe.contentWindow?.print()
    } catch (err) {
      console.warn('[TableQrPrinter] Iframe print failed:', err)
      window.print()
    }
    setTimeout(() => removeFrame(id), 3000)
  }, 400)
}

// ── Single QR Print ───────────────────────────────────────────────────────────

/**
 * Prints a single table's QR code as a clean physical card.
 * Uses an isolated hidden iframe — does NOT print the admin dashboard.
 */
export async function printSingleQr(tableId: number, tableNum: number): Promise<void> {
  const url = getTableQrUrl(tableId)
  const label = getTableLabel(tableNum)
  const qrDataUrl = await generateQrDataUrl(url)

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>QR Code — ${esc(label)}</title>
  <style>
    @page {
      size: A5;
      margin: 0;
    }
    html, body {
      margin: 0;
      padding: 0;
      width: 148mm;
      height: 210mm;
      background: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .qr-card {
      width: 140mm;
      padding: 10mm;
      text-align: center;
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      border: 1.5pt solid #cccccc;
      border-radius: 6pt;
    }
    .biz-name {
      font-size: 13pt;
      font-weight: 700;
      letter-spacing: 0.5pt;
      text-transform: uppercase;
      color: #111;
      margin-bottom: 4mm;
    }
    .table-label {
      font-size: 28pt;
      font-weight: 900;
      color: #14274E;
      letter-spacing: 2pt;
      margin-bottom: 6mm;
    }
    .qr-image {
      width: 72mm;
      height: 72mm;
      display: block;
      margin: 0 auto 6mm;
    }
    .instruction {
      font-size: 10pt;
      color: #333;
      line-height: 1.5;
      margin-bottom: 2mm;
    }
    .no-app {
      font-size: 8.5pt;
      color: #888;
    }
    .sep {
      border: none;
      border-top: 0.5pt dashed #ccc;
      margin: 4mm 0;
    }
  </style>
</head>
<body>
  <div class="qr-card">
    <div class="biz-name">${esc(BUSINESS_NAME)}</div>
    <hr class="sep" />
    <div class="table-label">${esc(label)}</div>
    <img class="qr-image" src="${qrDataUrl}" alt="QR code for ${esc(label)}" />
    <div class="instruction">${esc(SCAN_INSTRUCTION)}</div>
    <div class="no-app">${esc(NO_APP)}</div>
  </div>
</body>
</html>`

  triggerIframePrint(SINGLE_IFRAME_ID, html)
}

// ── Bulk QR PDF Print ─────────────────────────────────────────────────────────

/**
 * Prints ALL tables' QR codes in a 2-column A4 grid.
 * Staff can "Save as PDF" from the browser print dialog.
 * Tables are sorted by TABLE_NUM (natural numeric order).
 * Each QR uses getTableQrUrl(TABLE_ID) — same canonical source as individual QRs.
 */
export async function printBulkQrPdf(tables: TableRef[]): Promise<void> {
  // Sort by TABLE_NUM ascending (natural numeric order, not lexicographic)
  const sorted = [...tables].sort((a, b) => a.TABLE_NUM - b.TABLE_NUM)

  // Generate all QR data URLs in parallel
  const qrDataUrls = await Promise.all(
    sorted.map((t) => generateQrDataUrl(getTableQrUrl(t.TABLE_ID))),
  )

  // Build grid rows — 2 cards per row
  const cardRows: string[] = []
  for (let i = 0; i < sorted.length; i += 2) {
    const left = sorted[i]
    const leftQr = qrDataUrls[i]
    const right = sorted[i + 1]
    const rightQr = qrDataUrls[i + 1]

    const leftCard = buildBulkCard(left.TABLE_NUM, leftQr)
    const rightCard = right ? buildBulkCard(right.TABLE_NUM, rightQr) : '<div class="qr-bulk-card empty"></div>'

    cardRows.push(`<div class="qr-grid-row">${leftCard}${rightCard}</div>`)
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Monolith — Table QR Codes</title>
  <style>
    @page {
      size: A4;
      margin: 10mm;
    }
    html, body {
      margin: 0;
      padding: 0;
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      background: #fff;
      color: #111;
    }
    .page-title {
      text-align: center;
      font-size: 11pt;
      font-weight: 700;
      color: #14274E;
      text-transform: uppercase;
      letter-spacing: 1pt;
      margin-bottom: 6mm;
      padding-bottom: 3mm;
      border-bottom: 1pt solid #ddd;
    }
    .qr-grid-row {
      display: flex;
      gap: 6mm;
      margin-bottom: 6mm;
      page-break-inside: avoid;
    }
    .qr-bulk-card {
      flex: 1;
      border: 1pt solid #ccc;
      border-radius: 4pt;
      padding: 5mm;
      text-align: center;
      page-break-inside: avoid;
    }
    .qr-bulk-card.empty {
      border: none;
      background: transparent;
    }
    .card-biz {
      font-size: 7pt;
      text-transform: uppercase;
      letter-spacing: 0.5pt;
      color: #666;
      margin-bottom: 2mm;
    }
    .card-label {
      font-size: 16pt;
      font-weight: 900;
      color: #14274E;
      letter-spacing: 1pt;
      margin-bottom: 3mm;
    }
    .card-qr {
      width: 56mm;
      height: 56mm;
      display: block;
      margin: 0 auto 2mm;
    }
    .card-instruction {
      font-size: 7.5pt;
      color: #444;
      line-height: 1.4;
    }
  </style>
</head>
<body>
  <div class="page-title">${esc(BUSINESS_NAME)} — Table QR Codes</div>
  ${cardRows.join('\n')}
</body>
</html>`

  triggerIframePrint(BULK_IFRAME_ID, html)
}

function buildBulkCard(tableNum: number, qrDataUrl: string): string {
  const label = getTableLabel(tableNum)
  return `
    <div class="qr-bulk-card">
      <div class="card-biz">${esc(BUSINESS_NAME)}</div>
      <div class="card-label">${esc(label)}</div>
      <img class="card-qr" src="${qrDataUrl}" alt="QR code for ${esc(label)}" />
      <div class="card-instruction">Scan to view menu &amp; order</div>
    </div>`
}
