import jsPDF from 'jspdf'
import type { AnalyticsSummary } from '@/services/analyticsService'

/**
 * Generates and downloads a clean, professional PDF report of the current analytics data.
 */
export function exportAnalyticsPdf(summary: AnalyticsSummary): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 14
  let y = 18

  // ── Header & Branding ──
  doc.setFillColor(20, 39, 78) // #14274E
  doc.rect(0, 0, pageWidth, 28, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('MONOLITH POS — ANALYTICS REPORT', margin, 12)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(233, 196, 106) // #E9C46A
  doc.text(`Period: ${summary.dateRange.label}`, margin, 18)

  doc.setTextColor(200, 210, 225)
  const generatedAt = new Date().toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
  doc.text(`Generated: ${generatedAt}`, margin, 23)

  y = 36

  // ── Section 1: Summary Key Performance Indicators ──
  doc.setTextColor(20, 39, 78)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Executive Summary & Key Performance Indicators', margin, y)
  y += 6

  // KPI Grid
  const kpis = [
    { label: 'Total Revenue', value: `PHP ${summary.revenue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` },
    { label: 'Completed Orders', value: `${summary.completedOrders}` },
    { label: 'Customers Served', value: summary.customersServed !== null ? `${summary.customersServed}` : 'Unavailable*' },
    { label: 'Average Order Value', value: `PHP ${summary.averageOrderValue.toFixed(2)}` },
    { label: 'Average Spend / Customer', value: summary.averageSpendPerCustomer !== null ? `PHP ${summary.averageSpendPerCustomer.toFixed(2)}` : 'Unavailable*' },
    { label: 'Average Serving Time', value: summary.averageServingTimeMinutes !== null ? `${summary.averageServingTimeMinutes}m` : 'Unavailable*' },
    { label: 'Items Sold', value: `${summary.itemsSold}` },
    { label: 'Cancelled Orders', value: `${summary.cancelledOrders}` },
  ]

  const colWidth = (pageWidth - margin * 2) / 2
  kpis.forEach((kpi, index) => {
    const col = index % 2
    const row = Math.floor(index / 2)
    const cardX = margin + col * colWidth
    const cardY = y + row * 13

    doc.setFillColor(241, 246, 249) // #F1F6F9
    doc.roundedRect(cardX, cardY, colWidth - 3, 11, 1.5, 1.5, 'F')

    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 116, 139)
    doc.text(kpi.label, cardX + 3, cardY + 4)

    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(20, 39, 78)
    doc.text(kpi.value, cardX + 3, cardY + 9)
  })

  y += Math.ceil(kpis.length / 2) * 13 + 4

  // Notes on unavailable data if applicable
  if (summary.customersServed === null || summary.averageServingTimeMinutes === null) {
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(120, 130, 145)
    doc.text(
      '* Note: Serving time or customer count data is incomplete for some historical records.',
      margin,
      y,
    )
    y += 7
  }

  // ── Section 2: Top Selling Items ──
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(20, 39, 78)
  doc.text('Top Selling Menu Items', margin, y)
  y += 5

  // Table header
  doc.setFillColor(20, 39, 78)
  doc.rect(margin, y, pageWidth - margin * 2, 6, 'F')
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text('#', margin + 3, y + 4.2)
  doc.text('Item Name', margin + 12, y + 4.2)
  doc.text('Category', margin + 85, y + 4.2)
  doc.text('Qty Sold', margin + 125, y + 4.2)
  doc.text('Revenue (PHP)', margin + 155, y + 4.2)
  y += 6

  if (summary.topItems.length === 0) {
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 116, 139)
    doc.text('No items sold in the selected date range.', margin + 3, y + 5)
    y += 8
  } else {
    summary.topItems.slice(0, 8).forEach((item, idx) => {
      const rowFill = idx % 2 === 0 ? 255 : 246
      doc.setFillColor(rowFill, rowFill, rowFill)
      doc.rect(margin, y, pageWidth - margin * 2, 5.5, 'F')

      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(40, 50, 70)

      doc.text(`${idx + 1}`, margin + 3, y + 3.8)
      doc.text(item.itemName.slice(0, 38), margin + 12, y + 3.8)
      doc.text(item.categoryName.slice(0, 20), margin + 85, y + 3.8)
      doc.text(`${item.quantity}`, margin + 125, y + 3.8)
      doc.text(item.revenue.toLocaleString('en-PH', { minimumFractionDigits: 2 }), margin + 155, y + 3.8)
      y += 5.5
    })
  }

  y += 5

  // ── Section 3: Category Performance & Status Breakdown (2 columns) ──
  const midColWidth = (pageWidth - margin * 2 - 6) / 2

  // Category Header
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(20, 39, 78)
  doc.text('Category Breakdown', margin, y)

  // Status Header
  doc.text('Order Status Distribution', margin + midColWidth + 6, y)
  y += 5

  const subStartY = y

  // Left table: Category Performance
  doc.setFillColor(57, 72, 103) // #394867
  doc.rect(margin, y, midColWidth, 6, 'F')
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text('Category', margin + 3, y + 4.2)
  doc.text('Qty', margin + 45, y + 4.2)
  doc.text('Revenue (PHP)', margin + 60, y + 4.2)
  y += 6

  if (summary.categoryStats.length === 0) {
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 116, 139)
    doc.text('No category data available.', margin + 3, y + 4)
    y += 6
  } else {
    summary.categoryStats.forEach((cat, idx) => {
      const rowFill = idx % 2 === 0 ? 255 : 246
      doc.setFillColor(rowFill, rowFill, rowFill)
      doc.rect(margin, y, midColWidth, 5.2, 'F')

      doc.setFontSize(7.5)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(40, 50, 70)
      doc.text(cat.categoryName.slice(0, 20), margin + 3, y + 3.6)
      doc.text(`${cat.itemsSold}`, margin + 45, y + 3.6)
      doc.text(cat.revenue.toLocaleString('en-PH', { minimumFractionDigits: 2 }), margin + 60, y + 3.6)
      y += 5.2
    })
  }

  // Right table: Status Breakdown
  let rightY = subStartY
  doc.setFillColor(57, 72, 103)
  doc.rect(margin + midColWidth + 6, rightY, midColWidth, 6, 'F')
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text('Status', margin + midColWidth + 9, rightY + 4.2)
  doc.text('Count', margin + midColWidth + 50, rightY + 4.2)
  doc.text('Share (%)', margin + midColWidth + 68, rightY + 4.2)
  rightY += 6

  summary.statusBreakdown.forEach((st, idx) => {
    const rowFill = idx % 2 === 0 ? 255 : 246
    doc.setFillColor(rowFill, rowFill, rowFill)
    doc.rect(margin + midColWidth + 6, rightY, midColWidth, 5.2, 'F')

    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(40, 50, 70)
    doc.text(st.status, margin + midColWidth + 9, rightY + 3.6)
    doc.text(`${st.count}`, margin + midColWidth + 50, rightY + 3.6)
    doc.text(`${st.percentage}%`, margin + midColWidth + 68, rightY + 3.6)
    rightY += 5.2
  })

  y = Math.max(y, rightY) + 6

  // ── Footer ──
  const footerY = 286
  doc.setDrawColor(220, 226, 235)
  doc.line(margin, footerY - 3, pageWidth - margin, footerY - 3)

  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(140, 150, 165)
  doc.text('Monolith POS System — Internal Management Analytics Report', margin, footerY)
  doc.text('Page 1 of 1', pageWidth - margin - 15, footerY)

  // Save the PDF file
  const dateStr = summary.dateRange.startDate.toISOString().slice(0, 10)
  doc.save(`monolith-analytics-report-${dateStr}.pdf`)
}
