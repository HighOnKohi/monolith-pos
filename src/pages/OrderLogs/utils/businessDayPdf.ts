import jsPDF from 'jspdf'
import type { DailySummary } from '@/types/businessDay'

const money = (val: number) =>
  `PHP ${val.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function formatTime(isoString?: string | null): string {
  if (!isoString) return 'Active'
  try {
    const d = new Date(isoString)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return '—'
  }
}

/**
 * Generates and downloads a clean, multi-page, structured PDF of the Business Day Report Summary.
 * Visual layout matches the Monolith POS Order Audit Log report style.
 */
export function exportBusinessDayPdf(summary: DailySummary): void {
  const { businessDay } = summary

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 12
  let y = 18

  // Helper for drawing header on each page
  function drawHeader() {
    doc.setFillColor(20, 39, 78) // #14274E (navy)
    doc.rect(0, 0, pageWidth, 26, 'F')

    doc.setTextColor(255, 255, 255)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('MONOLITH POS — BUSINESS DAY SUMMARY REPORT', margin, 10.5)

    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(233, 196, 106) // #E9C46A (gold accent)
    const dayDate = new Date(businessDay.businessDate).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
    doc.text(
      `Business Date: ${dayDate}  •  Day ID #${businessDay.businessDayId}  •  Status: ${businessDay.status}`,
      margin,
      16.5,
    )

    doc.setTextColor(200, 210, 225)
    const startTime = formatTime(businessDay.startedAt)
    const endTime = businessDay.endedAt ? formatTime(businessDay.endedAt) : 'Open / In Progress'
    const adminInfo = businessDay.startedBy ? `Started by: ${businessDay.startedBy}` : ''
    const generatedAt = new Date().toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
    doc.text(`Operating Window: ${startTime} – ${endTime} ${adminInfo ? `(${adminInfo})` : ''}`, margin, 21.5)

    doc.setFontSize(7.5)
    doc.text(`Generated: ${generatedAt}`, pageWidth - margin - 45, 21.5)
  }

  // Draw initial page header
  drawHeader()
  y = 33

  // ── Section 1: Financial & Operational KPIs ──
  doc.setTextColor(20, 39, 78)
  doc.setFontSize(10.5)
  doc.setFont('helvetica', 'bold')
  doc.text('Daily Operational & Financial Summary', margin, y)
  y += 4.5

  const kpis = [
    { label: 'Gross Revenue', value: money(summary.grossRevenue) },
    { label: 'Subtotal Revenue', value: money(summary.subtotalRevenue) },
    { label: 'Completed Orders', value: `${summary.completedOrdersCount} orders` },
    { label: 'Cancelled / Voided', value: `${summary.cancelledOrdersCount} orders` },
    { label: 'Customers Served', value: `${summary.customersServed} guests` },
    { label: 'Average Order Value', value: money(summary.averageOrderValue) },
    { label: 'Avg Spend / Guest', value: money(summary.averageSpendPerCustomer) },
    { label: 'Total Discounts & Adjustments', value: money(summary.totalDiscounts) },
  ]

  const colWidth = (pageWidth - margin * 2) / 2
  kpis.forEach((kpi, index) => {
    const col = index % 2
    const row = Math.floor(index / 2)
    const cardX = margin + col * colWidth
    const cardY = y + row * 11

    doc.setFillColor(241, 246, 249) // #F1F6F9
    doc.roundedRect(cardX, cardY, colWidth - 2.5, 9.5, 1.2, 1.2, 'F')

    doc.setFontSize(7.2)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 116, 139)
    doc.text(kpi.label, cardX + 2.5, cardY + 3.5)

    doc.setFontSize(8.8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(20, 39, 78)
    doc.text(kpi.value, cardX + 2.5, cardY + 7.5)
  })

  y += Math.ceil(kpis.length / 2) * 11 + 5.5

  // ── Section 2: Payment Methods Breakdown ──
  doc.setTextColor(20, 39, 78)
  doc.setFontSize(10.5)
  doc.setFont('helvetica', 'bold')
  doc.text('Payment Methods Breakdown', margin, y)
  y += 4

  // Table header for payment methods
  doc.setFillColor(20, 39, 78)
  doc.rect(margin, y, pageWidth - margin * 2, 5.5, 'F')
  doc.setFontSize(7.2)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text('Payment Method', margin + 3, y + 3.8)
  doc.text('Transactions', margin + 60, y + 3.8)
  doc.text('Total Settled (PHP)', margin + 110, y + 3.8)
  doc.text('Revenue Share (%)', margin + 155, y + 3.8)
  y += 5.5

  if (!summary.paymentBreakdown || summary.paymentBreakdown.length === 0) {
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 116, 139)
    doc.text('No payment transactions recorded for this business day.', margin + 3, y + 4)
    y += 6
  } else {
    summary.paymentBreakdown.forEach((pm, idx) => {
      const rowFill = idx % 2 === 0 ? 255 : 248
      doc.setFillColor(rowFill, rowFill, rowFill)
      doc.rect(margin, y, pageWidth - margin * 2, 5, 'F')

      doc.setFontSize(7.5)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(40, 50, 70)
      doc.text(pm.method, margin + 3, y + 3.5)
      doc.text(`${pm.count} tx`, margin + 60, y + 3.5)
      doc.text(pm.total.toLocaleString('en-PH', { minimumFractionDigits: 2 }), margin + 110, y + 3.5)
      doc.text(`${pm.percentage.toFixed(1)}%`, margin + 155, y + 3.5)
      y += 5
    })
  }

  y += 5.5

  // ── Section 3: Cashier Shift Performance ──
  if (summary.cashierPerformance && summary.cashierPerformance.length > 0) {
    // Check if we need page break before cashier section
    if (y + 25 > pageHeight - 14) {
      doc.addPage()
      drawHeader()
      y = 33
    }

    doc.setTextColor(20, 39, 78)
    doc.setFontSize(10.5)
    doc.setFont('helvetica', 'bold')
    doc.text('Cashier Shift Performance', margin, y)
    y += 4

    doc.setFillColor(20, 39, 78)
    doc.rect(margin, y, pageWidth - margin * 2, 5.5, 'F')
    doc.setFontSize(7.2)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(255, 255, 255)
    doc.text('Cashier Staff', margin + 3, y + 3.8)
    doc.text('Staff ID', margin + 45, y + 3.8)
    doc.text('Role', margin + 65, y + 3.8)
    doc.text('Orders', margin + 95, y + 3.8)
    doc.text('Diners', margin + 115, y + 3.8)
    doc.text('Discounts', margin + 135, y + 3.8)
    doc.text('Total Sales (PHP)', margin + 160, y + 3.8)
    y += 5.5

    summary.cashierPerformance.forEach((c, idx) => {
      const rowFill = idx % 2 === 0 ? 255 : 248
      doc.setFillColor(rowFill, rowFill, rowFill)
      doc.rect(margin, y, pageWidth - margin * 2, 5, 'F')

      doc.setFontSize(7.5)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(40, 50, 70)
      doc.text(c.staffName.slice(0, 22), margin + 3, y + 3.5)
      doc.text(`#${c.staffId}`, margin + 45, y + 3.5)
      doc.text(c.staffRole.slice(0, 16), margin + 65, y + 3.5)
      doc.text(`${c.transactionsCount}`, margin + 95, y + 3.5)
      doc.text(`${c.customersServed}`, margin + 115, y + 3.5)
      doc.text(c.discountsTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 }), margin + 135, y + 3.5)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(16, 110, 80)
      doc.text(c.totalSales.toLocaleString('en-PH', { minimumFractionDigits: 2 }), margin + 160, y + 3.5)
      y += 5
    })

    y += 5.5
  }

  // ── Section 4: Day Transactions Audit Table ──
  const transactions = summary.transactionsList || []

  function drawTxTableHeader(curY: number) {
    doc.setFillColor(20, 39, 78)
    doc.rect(margin, curY, pageWidth - margin * 2, 5.5, 'F')
    doc.setFontSize(7.2)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(255, 255, 255)

    doc.text('Order #', margin + 3, curY + 3.8)
    doc.text('Time', margin + 22, curY + 3.8)
    doc.text('Table', margin + 50, curY + 3.8)
    doc.text('Cashier', margin + 82, curY + 3.8)
    doc.text('Method', margin + 120, curY + 3.8)
    doc.text('Discount', margin + 145, curY + 3.8)
    doc.text('Total (PHP)', margin + 165, curY + 3.8)
  }

  if (transactions.length > 0) {
    // If not enough room for header + at least 2 rows, start on new page
    if (y + 18 > pageHeight - 14) {
      doc.addPage()
      drawHeader()
      y = 33
    }

    doc.setTextColor(20, 39, 78)
    doc.setFontSize(10.5)
    doc.setFont('helvetica', 'bold')
    doc.text(`Settled Transactions Audit (${transactions.length} orders)`, margin, y)
    y += 4

    drawTxTableHeader(y)
    y += 5.5

    transactions.forEach((tx, idx) => {
      // Check page break
      if (y + 5.5 > pageHeight - 14) {
        doc.addPage()
        drawHeader()
        y = 33
        drawTxTableHeader(y)
        y += 5.5
      }

      const rowFill = idx % 2 === 0 ? 255 : 248
      doc.setFillColor(rowFill, rowFill, rowFill)
      doc.rect(margin, y, pageWidth - margin * 2, 5, 'F')

      doc.setFontSize(7.2)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(40, 50, 70)

      const timeFormatted = formatTime(tx.time)
      doc.text(`#${tx.orderId}`, margin + 3, y + 3.5)
      doc.text(timeFormatted, margin + 22, y + 3.5)
      doc.text((tx.tableLabel || 'Table').slice(0, 16), margin + 50, y + 3.5)
      doc.text((tx.cashierName || 'Cashier').slice(0, 20), margin + 82, y + 3.5)
      doc.text((tx.paymentMethod || 'CASH').slice(0, 14), margin + 120, y + 3.5)
      doc.text(
        tx.discount > 0 ? tx.discount.toLocaleString('en-PH', { minimumFractionDigits: 2 }) : '—',
        margin + 145,
        y + 3.5,
      )
      doc.text(tx.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 }), margin + 165, y + 3.5)

      y += 5
    })
  }

  // ── Footer with page numbers on all pages ──
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(7.2)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(140, 150, 165)
    doc.text(
      `Monolith POS • Business Day Report • Day #${businessDay.businessDayId} (${businessDay.businessDate})`,
      margin,
      pageHeight - 6,
    )
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin - 18, pageHeight - 6)
  }

  const dateClean = businessDay.businessDate.replace(/[^0-9-]/g, '')
  doc.save(`monolith_business_day_${dateClean}_report.pdf`)
}
