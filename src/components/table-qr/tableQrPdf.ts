// ─── Table QR PDF Generator (jsPDF) ──────────────────────────────────────────
//
// Generates a real downloadable PDF artifact (monolith-table-qrcodes.pdf).
// Requirements from Section 14A:
//   - Downloadable PDF artifact (not just browser window.print)
//   - Multi-table layout on standard A4 paper (2-column grid, 4 cards per page)
//   - Natural numeric sorting by TABLE_NUM
//   - High-resolution QR codes generated from canonical getTableQrUrl(TABLE_ID)
//   - Professional layout for cutting and placing on table stands
//   - Multi-page pagination when tables exceed page capacity

import { jsPDF } from 'jspdf'
import QRCode from 'qrcode'
import { getTableQrUrl, getTableLabel, getBulkQrPdfFilename } from './tableQrUtils'

export interface TablePdfItem {
  TABLE_ID: number
  TABLE_NUM: number
}

const DEFAULT_BUSINESS_NAME = 'Bill Shaw Restaurant'

/**
 * Generates and downloads a multi-table QR PDF file.
 */
export async function downloadBulkQrPdf(
  tables: TablePdfItem[],
  businessName = DEFAULT_BUSINESS_NAME,
): Promise<void> {
  if (!tables || tables.length === 0) {
    throw new Error('No tables provided for QR PDF generation')
  }

  // Sort by TABLE_NUM in natural numeric order
  const sorted = [...tables].sort((a, b) => a.TABLE_NUM - b.TABLE_NUM)

  // Generate all QR code images in parallel (PNG 1024x1024)
  const qrDataUrls = await Promise.all(
    sorted.map((t) =>
      QRCode.toDataURL(getTableQrUrl(t.TABLE_ID), {
        errorCorrectionLevel: 'M',
        width: 1024,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      }),
    ),
  )

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  // A4 dimensions: 210mm x 297mm
  const pageWidth = 210
  const pageHeight = 297
  const marginX = 12
  const marginTop = 16
  const marginBottom = 14

  // Card dimensions (2 cols x 2 rows = 4 cards per page)
  const cols = 2
  const rows = 2
  const cardsPerPage = cols * rows
  const colGap = 8
  const rowGap = 8

  const gridWidth = pageWidth - marginX * 2
  const cardWidth = (gridWidth - (cols - 1) * colGap) / cols // ~89mm

  const headerHeight = 14
  const availableHeight = pageHeight - marginTop - marginBottom - headerHeight
  const cardHeight = (availableHeight - (rows - 1) * rowGap) / rows // ~123mm

  const totalPages = Math.ceil(sorted.length / cardsPerPage)

  for (let i = 0; i < sorted.length; i++) {
    const pageIndex = Math.floor(i / cardsPerPage)
    const cardIndexOnPage = i % cardsPerPage

    // Add new page if needed (not on first card of first page)
    if (cardIndexOnPage === 0 && pageIndex > 0) {
      doc.addPage('a4', 'portrait')
    }

    // Render Page Header & Footer on the first card of each page
    if (cardIndexOnPage === 0) {
      // Header: Business Name & Title
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(13)
      doc.setTextColor(20, 39, 78) // #14274E
      doc.text(businessName.toUpperCase(), marginX, marginTop)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)
      doc.setTextColor(100, 110, 125)
      doc.text('Table QR Codes • Scan to Order', marginX, marginTop + 4.5)

      // Thin header rule
      doc.setDrawColor(220, 226, 235)
      doc.setLineWidth(0.3)
      doc.line(marginX, marginTop + 7, pageWidth - marginX, marginTop + 7)

      // Footer: Page count
      doc.setFontSize(7.5)
      doc.setTextColor(150, 155, 165)
      const pageText = `Page ${pageIndex + 1} of ${totalPages}`
      doc.text(pageText, pageWidth - marginX - doc.getTextWidth(pageText), pageHeight - 6)
      doc.text('Monolith POS — Table QR Management', marginX, pageHeight - 6)
    }

    // Determine grid row and column
    const col = cardIndexOnPage % cols
    const row = Math.floor(cardIndexOnPage / cols)

    const cardX = marginX + col * (cardWidth + colGap)
    const cardY = marginTop + headerHeight + row * (cardHeight + rowGap)

    const table = sorted[i]
    const qrDataUrl = qrDataUrls[i]
    const label = getTableLabel(table.TABLE_NUM)

    // ── Draw Card Box ──
    // Subtle background
    doc.setFillColor(254, 254, 255)
    doc.setDrawColor(200, 208, 218)
    doc.setLineWidth(0.4)
    doc.roundedRect(cardX, cardY, cardWidth, cardHeight, 3.5, 3.5, 'FD')

    // Top accent pill for Business Name
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(120, 130, 145)
    const bizText = businessName.toUpperCase()
    doc.text(bizText, cardX + cardWidth / 2, cardY + 9, { align: 'center' })

    // Table Label (e.g., "TABLE 05")
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.setTextColor(20, 39, 78) // #14274E
    doc.text(label, cardX + cardWidth / 2, cardY + 18, { align: 'center' })

    // Decorative divider under Table label
    doc.setDrawColor(230, 234, 242)
    doc.setLineWidth(0.3)
    doc.line(cardX + 16, cardY + 21, cardX + cardWidth - 16, cardY + 21)

    // ── High-Resolution QR Code ──
    const qrSize = 58 // 58mm x 58mm — optimal scan size with ample quiet zone
    const qrX = cardX + (cardWidth - qrSize) / 2
    const qrY = cardY + 24
    doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize, undefined, 'FAST')

    // ── Scan Instructions ──
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(30, 45, 70)
    doc.text('Scan to View Menu & Order', cardX + cardWidth / 2, qrY + qrSize + 7, {
      align: 'center',
    })

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(120, 130, 145)
    doc.text('Point camera at QR code • No app required', cardX + cardWidth / 2, qrY + qrSize + 11.5, {
      align: 'center',
    })

    // Cutting guide dash marks on corner (helpful when trimming paper)
    doc.setDrawColor(215, 220, 228)
    doc.setLineDashPattern([1, 1], 0)
    doc.setLineWidth(0.2)
    // small cutting tick at top-left and bottom-right
    doc.line(cardX - 1.5, cardY, cardX - 0.2, cardY)
    doc.line(cardX, cardY - 1.5, cardX, cardY - 0.2)
    doc.setLineDashPattern([], 0) // reset
  }

  // Save the downloadable PDF file
  doc.save(getBulkQrPdfFilename())
}
