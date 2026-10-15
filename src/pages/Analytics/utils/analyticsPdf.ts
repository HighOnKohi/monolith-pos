import jsPDF from 'jspdf'
import type { AnalyticsSummary } from '@/services/analyticsService'

/**
 * Generates and downloads a comprehensive, multi-page PDF report matching
 * the current analytics dashboard view and metrics.
 */
export function exportAnalyticsPdf(summary: AnalyticsSummary): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 14
  let y = 0
  let pageNumber = 1

  const drawHeader = () => {
    doc.setFillColor(20, 39, 78) // #14274E
    doc.rect(0, 0, pageWidth, 28, 'F')

    doc.setTextColor(255, 255, 255)
    doc.setFontSize(15)
    doc.setFont('helvetica', 'bold')
    doc.text('MONOLITH POS — ANALYTICS REPORT', margin, 11)

    doc.setFontSize(8.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(233, 196, 106) // #E9C46A
    doc.text(`Period: ${summary.dateRange.label}`, margin, 17)

    doc.setTextColor(200, 210, 225)
    const generatedAt = new Date().toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
    doc.text(`Generated: ${generatedAt}`, margin, 22.5)

    y = 35
  }

  const drawFooter = () => {
    const footerY = pageHeight - 10
    doc.setDrawColor(220, 226, 235)
    doc.line(margin, footerY - 3, pageWidth - margin, footerY - 3)

    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(140, 150, 165)
    doc.text('Monolith POS System — Internal Management Analytics Report', margin, footerY)
    doc.text(`Page ${pageNumber}`, pageWidth - margin - 15, footerY)
  }

  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - 18) {
      drawFooter()
      doc.addPage()
      pageNumber++
      drawHeader()
    }
  }

  // Draw Page 1 header
  drawHeader()

  // ── Section 1: Executive Summary & Key Performance Indicators ──
  doc.setTextColor(20, 39, 78)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('Executive Summary & Key Performance Indicators', margin, y)
  y += 5

  // 4 Primary KPI Cards
  const primaryKpis = [
    {
      label: 'TOTAL REVENUE',
      value: `PHP ${summary.revenue.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      sub: 'Gross recorded sales',
    },
    {
      label: 'COMPLETED ORDERS',
      value: `${summary.completedOrders.toLocaleString()}`,
      sub: 'Fulfilled transactions',
    },
    {
      label: 'GUESTS SERVED',
      value: summary.customersServed !== null ? `${summary.customersServed.toLocaleString()}` : '—',
      sub: 'Recorded diner count',
    },
    {
      label: 'AVERAGE ORDER VALUE',
      value: `PHP ${summary.averageOrderValue.toFixed(2)}`,
      sub: 'Per transaction average',
    },
  ]

  const colWidth = (pageWidth - margin * 2 - 6) / 2
  primaryKpis.forEach((kpi, idx) => {
    const col = idx % 2
    const row = Math.floor(idx / 2)
    const cardX = margin + col * (colWidth + 6)
    const cardY = y + row * 16

    doc.setFillColor(248, 250, 252)
    doc.setDrawColor(226, 232, 240)
    doc.roundedRect(cardX, cardY, colWidth, 14, 1.5, 1.5, 'FD')

    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(100, 116, 139)
    doc.text(kpi.label, cardX + 3.5, cardY + 4)

    doc.setFontSize(10.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(20, 39, 78)
    doc.text(kpi.value, cardX + 3.5, cardY + 9)

    doc.setFontSize(6.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(148, 163, 184)
    doc.text(kpi.sub, cardX + 3.5, cardY + 12.5)
  })

  y += 34

  // Secondary stats (Items Sold, Cancelled Orders, Peak Day, Peak Hour)
  const secColWidth = (pageWidth - margin * 2 - 9) / 4
  const secondaryStats = [
    { label: 'Items Sold', val: `${summary.itemsSold.toLocaleString()}` },
    { label: 'Cancelled Orders', val: `${summary.cancelledOrders}` },
    { label: 'Peak Sales Day', val: summary.peakDay ?? '—' },
    { label: 'Peak Hour', val: summary.peakHour ?? '—' },
  ]

  secondaryStats.forEach((st, idx) => {
    const cardX = margin + idx * (secColWidth + 3)
    doc.setFillColor(241, 245, 249)
    doc.roundedRect(cardX, y, secColWidth, 11, 1.2, 1.2, 'F')

    doc.setFontSize(6.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 116, 139)
    doc.text(st.label, cardX + 3, y + 3.8)

    doc.setFontSize(8.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(20, 39, 78)
    doc.text(st.val, cardX + 3, y + 8.5)
  })

  y += 16

  // ── Section 2: Order Source Channel ──
  checkPageBreak(28)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(20, 39, 78)
  doc.text('Order Source Channel Distribution', margin, y)
  y += 4.5

  const oscWidth = (pageWidth - margin * 2 - 6) / 2
  const serviceStaff = summary.orderSourceComparison.service
  const customerInterface = summary.orderSourceComparison.customer

  // Service Staff Card
  doc.setFillColor(255, 247, 237) // Orange tint
  doc.setDrawColor(254, 215, 170)
  doc.roundedRect(margin, y, oscWidth, 15, 1.5, 1.5, 'FD')
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(194, 65, 12)
  doc.text('SERVICE STAFF (POS / CASHIER)', margin + 3.5, y + 4.2)
  doc.setFontSize(9)
  doc.setTextColor(20, 39, 78)
  doc.text(`${serviceStaff.count} Orders (${serviceStaff.percentage}%)`, margin + 3.5, y + 9)
  doc.setFontSize(7)
  doc.setTextColor(100, 116, 139)
  doc.text(`Revenue: PHP ${serviceStaff.revenue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`, margin + 3.5, y + 13)

  // Customer Interface Card
  doc.setFillColor(239, 246, 255) // Blue tint
  doc.setDrawColor(191, 219, 254)
  doc.roundedRect(margin + oscWidth + 6, y, oscWidth, 15, 1.5, 1.5, 'FD')
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(29, 78, 216)
  doc.text('CUSTOMER INTERFACE (TABLE ORDERING)', margin + oscWidth + 9.5, y + 4.2)
  doc.setFontSize(9)
  doc.setTextColor(20, 39, 78)
  doc.text(`${customerInterface.count} Orders (${customerInterface.percentage}%)`, margin + oscWidth + 9.5, y + 9)
  doc.setFontSize(7)
  doc.setTextColor(100, 116, 139)
  doc.text(`Revenue: PHP ${customerInterface.revenue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`, margin + oscWidth + 9.5, y + 13)

  y += 20

  // ── Section 3: Item Performance Ranking ──
  const items = summary.allItems && summary.allItems.length > 0 ? summary.allItems : summary.topItems
  checkPageBreak(25)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(20, 39, 78)
  doc.text('Menu Item Sales Ranking', margin, y)
  y += 4

  // Table Header
  doc.setFillColor(20, 39, 78)
  doc.rect(margin, y, pageWidth - margin * 2, 5.5, 'F')
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text('#', margin + 2.5, y + 3.8)
  doc.text('Item Name', margin + 10, y + 3.8)
  doc.text('Category', margin + 75, y + 3.8)
  doc.text('Price (PHP)', margin + 115, y + 3.8)
  doc.text('Units Sold', margin + 140, y + 3.8)
  doc.text('Revenue (PHP)', margin + 165, y + 3.8)
  y += 5.5

  if (items.length === 0) {
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 116, 139)
    doc.text('No menu items sold in this period.', margin + 3, y + 4)
    y += 7
  } else {
    items.forEach((item, idx) => {
      checkPageBreak(5.5)
      const rowFill = idx % 2 === 0 ? 255 : 248
      doc.setFillColor(rowFill, rowFill, rowFill)
      doc.rect(margin, y, pageWidth - margin * 2, 5.2, 'F')

      doc.setFontSize(7.5)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(40, 50, 70)
      doc.text(`${idx + 1}`, margin + 2.5, y + 3.6)
      doc.text(item.itemName.slice(0, 32), margin + 10, y + 3.6)
      doc.text(item.categoryName.slice(0, 18), margin + 75, y + 3.6)
      doc.text(item.unitPrice.toFixed(2), margin + 115, y + 3.6)
      doc.text(`${item.quantity}`, margin + 140, y + 3.6)
      doc.text(item.revenue.toLocaleString('en-PH', { minimumFractionDigits: 2 }), margin + 165, y + 3.6)
      y += 5.2
    })
  }

  y += 6

  // ── Section 4: Category Performance Ranking ──
  checkPageBreak(25)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(20, 39, 78)
  doc.text('Category Performance Ranking', margin, y)
  y += 4

  doc.setFillColor(57, 72, 103)
  doc.rect(margin, y, pageWidth - margin * 2, 5.5, 'F')
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text('Category Name', margin + 3, y + 3.8)
  doc.text('Items Sold', margin + 90, y + 3.8)
  doc.text('Revenue (PHP)', margin + 130, y + 3.8)
  doc.text('% of Revenue', margin + 165, y + 3.8)
  y += 5.5

  if (summary.categoryStats.length === 0) {
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 116, 139)
    doc.text('No category sales recorded.', margin + 3, y + 4)
    y += 7
  } else {
    summary.categoryStats.forEach((cat, idx) => {
      checkPageBreak(5.5)
      const rowFill = idx % 2 === 0 ? 255 : 248
      doc.setFillColor(rowFill, rowFill, rowFill)
      doc.rect(margin, y, pageWidth - margin * 2, 5.2, 'F')

      doc.setFontSize(7.5)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(40, 50, 70)
      doc.text(cat.categoryName, margin + 3, y + 3.6)
      doc.text(`${cat.itemsSold}`, margin + 90, y + 3.6)
      doc.text(cat.revenue.toLocaleString('en-PH', { minimumFractionDigits: 2 }), margin + 130, y + 3.6)
      doc.text(`${cat.percentageOfRevenue}%`, margin + 165, y + 3.6)
      y += 5.2
    })
  }

  y += 6

  // ── Section 5: Menu Preset Performance (if any) ──
  if (summary.presetStats && summary.presetStats.length > 0) {
    checkPageBreak(25)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(20, 39, 78)
    doc.text('Menu Preset Performance', margin, y)
    y += 4

    doc.setFillColor(57, 72, 103)
    doc.rect(margin, y, pageWidth - margin * 2, 5.5, 'F')
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(255, 255, 255)
    doc.text('Preset Name', margin + 3, y + 3.8)
    doc.text('Items Sold', margin + 110, y + 3.8)
    doc.text('Share of Sales (%)', margin + 155, y + 3.8)
    y += 5.5

    summary.presetStats.forEach((preset, idx) => {
      checkPageBreak(5.5)
      const rowFill = idx % 2 === 0 ? 255 : 248
      doc.setFillColor(rowFill, rowFill, rowFill)
      doc.rect(margin, y, pageWidth - margin * 2, 5.2, 'F')

      doc.setFontSize(7.5)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(40, 50, 70)
      doc.text(preset.presetName, margin + 3, y + 3.6)
      doc.text(`${preset.itemsSold}`, margin + 110, y + 3.6)
      doc.text(`${preset.percentageOfSales}%`, margin + 155, y + 3.6)
      y += 5.2
    })
    y += 6
  }

  // ── Section 6: Event Revenue Summary ──
  checkPageBreak(25)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(20, 39, 78)
  doc.text(`Event Revenue Summary (Total: PHP ${summary.totalEventRevenue.toLocaleString('en-PH', { minimumFractionDigits: 2 })})`, margin, y)
  y += 4

  if (!summary.eventsList || summary.eventsList.length === 0) {
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 116, 139)
    doc.text('No scheduled events recorded.', margin + 3, y + 4)
    y += 7
  } else {
    doc.setFillColor(20, 39, 78)
    doc.rect(margin, y, pageWidth - margin * 2, 5.5, 'F')
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(255, 255, 255)
    doc.text('Event Title', margin + 3, y + 3.8)
    doc.text('Category', margin + 65, y + 3.8)
    doc.text('Duration', margin + 105, y + 3.8)
    doc.text('Pax', margin + 145, y + 3.8)
    doc.text('Revenue (PHP)', margin + 165, y + 3.8)
    y += 5.5

    summary.eventsList.forEach((ev, idx) => {
      checkPageBreak(5.5)
      const rowFill = idx % 2 === 0 ? 255 : 248
      doc.setFillColor(rowFill, rowFill, rowFill)
      doc.rect(margin, y, pageWidth - margin * 2, 5.2, 'F')

      const startFormatted = ev.startAt
        ? new Date(ev.startAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : '—'

      doc.setFontSize(7.5)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(40, 50, 70)
      doc.text(ev.title.slice(0, 26), margin + 3, y + 3.6)
      doc.text(ev.category.slice(0, 16), margin + 65, y + 3.6)
      doc.text(startFormatted, margin + 105, y + 3.6)
      doc.text(`${ev.maxPax}`, margin + 145, y + 3.6)
      doc.text(ev.revenueEarned.toLocaleString('en-PH', { minimumFractionDigits: 2 }), margin + 165, y + 3.6)
      y += 5.2
    })
  }

  // Draw footer on the final page
  drawFooter()

  // Save the PDF file
  const dateStr = summary.dateRange.startDate.toISOString().slice(0, 10)
  doc.save(`monolith-analytics-report-${dateStr}.pdf`)
}
