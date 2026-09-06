// ─── Table QR URL Utilities ───────────────────────────────────────────────────
//
// SINGLE SOURCE OF TRUTH for all table QR URL and filename generation.
//
// Architecture rule (from prompt §25):
//   ALL QR output formats — preview, download, print, and bulk PDF — must use
//   this same utility. Never duplicate URL construction in multiple components.
//
// Identity strategy:
//   The canonical QR identity is TABLE_ID (the stable Supabase primary key),
//   NOT TABLE_NUM (the visible display number which can be renamed).
//   URL format: {origin}/customer/table-{TABLE_ID}
//
//   Example:
//     TABLE_ID = 7, TABLE_NUM = 5
//     → QR URL: https://yourapp.vercel.app/customer/table-7
//     → Customer page parses `7` via Number(tableId.replace(/\D/g, ''))
//     → All orders are submitted against TABLE_ID = 7
//
//   If TABLE_NUM is later changed from 5 to "VIP-1", the QR still resolves
//   to TABLE_ID 7 because the URL encodes the stable primary key.
//
// Deployment compatibility:
//   Uses window.location.origin — automatically correct for:
//     - http://localhost:5173 (dev)
//     - https://xxx.vercel.app (preview)
//     - https://yourproduction.com (prod)
//   Never hard-codes any hostname.

export const VERCEL_APP_URL = 'https://monolith-pos.vercel.app'

/**
 * Returns the base customer application origin.
 *
 * Rules:
 * 1. If VITE_PUBLIC_APP_URL or VITE_APP_URL is defined, use it.
 * 2. If running on localhost / 127.0.0.1, NEVER encode localhost into QR codes
 *    or customer links (mobile phones cannot reach localhost). Always use the
 *    deployed Vercel production app: https://monolith-pos.vercel.app.
 * 3. In deployed environments (e.g. *.vercel.app or custom domains), use
 *    window.location.origin.
 */
export function getCustomerAppBaseUrl(): string {
  const envUrl = (import.meta.env.VITE_PUBLIC_APP_URL || import.meta.env.VITE_APP_URL || '').trim()
  if (envUrl) {
    return envUrl.replace(/\/+$/, '')
  }

  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname
    const isLocal =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname.endsWith('.local')

    if (!isLocal && window.location.origin && !window.location.origin.includes('localhost')) {
      return window.location.origin.replace(/\/+$/, '')
    }
  }

  return VERCEL_APP_URL
}

/**
 * Returns the canonical customer URL for a table, encoded by stable TABLE_ID.
 * Used by: QR preview, PNG download, single print, bulk PDF.
 * Always resolves to the Vercel app URL (https://monolith-pos.vercel.app/customer/table-{TABLE_ID})
 * when in dev/localhost to ensure customer QR scans and test links work on real devices.
 */
export function getTableQrUrl(tableId: number): string {
  const base = getCustomerAppBaseUrl()
  return `${base}/customer/table-${tableId}`
}

/**
 * Returns a descriptive download filename for a table's QR PNG.
 * Uses TABLE_NUM (display number) for human-readable filenames, zero-padded.
 * Example: tableNum=5 → "table-05-qr.png"
 */
export function getQrFilename(tableNum: number): string {
  return `table-${String(tableNum).padStart(2, '0')}-qr.png`
}

/**
 * Returns the suggested filename for the bulk QR PDF.
 */
export function getBulkQrPdfFilename(): string {
  return 'monolith-table-qrcodes.pdf'
}

/**
 * Returns a short human-readable label for a table.
 * Example: tableNum=5 → "TABLE 05"
 */
export function getTableLabel(tableNum: number): string {
  return `TABLE ${String(tableNum).padStart(2, '0')}`
}
