import jsPDF from 'jspdf'
import type { OrderLogRow, OrderLogsSummary } from '@/services/orderLogsService'

export interface OrderLogsPdfParams {
  orders: OrderLogRow[]
  summary: OrderLogsSummary
  filterDescription: string
}

/**
 * Generates and downloads a clean, multi-page PDF report of the filtered Order Logs.
 */
export function exportOrderLogsPdf(params: OrderLogsPdfParams): void {
  const { orders, summary, filterDescription } = params

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 12
  let y = 18

  // Helper for page headers
  function drawHeader() {
    doc.setFillColor(20, 39, 78) // #14274E
    doc.rect(0, 0, pageWidth, 26, 'F')

    doc.setTextColor(255, 255, 255)
    doc.setFontSize(15)
    doc.setFont('helvetica', 'bold')
    doc.text('MONOLITH POS — ORDER AUDIT LOG', margin, 11)

    doc.setFontSize(8.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(233, 196, 106) // #E9C46A
    doc.text(`Active Filters: ${filterDescription.slice(0, 75)}`, margin, 17)

    doc.setTextColor(200, 210, 225)
    const generatedAt = new Date().toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
    doc.text(`Generated: ${generatedAt}`, margin, 22)
  }

  drawHeader()
  y = 34

  // ── Section 1: Summary KPIs ──
  doc.setTextColor(20, 39, 78)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('Filtered Results Summary', margin, y)
  y += 5

  const kpis = [
    { label: 'Total Orders', value: `${summary.totalOrders}` },
    { label: 'Completed Orders', value: `${summary.completedOrders}` },
    { label: 'Cancelled Orders', value: `${summary.cancelledOrders}` },
    { label: 'Total Revenue', value: `PHP ${summary.totalRevenue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` },
    { label: 'Average Order Value', value: `PHP ${summary.averageOrderValue.toFixed(2)}` },
    { label: 'Avg. Serving Time', value: summary.averageServingTimeMinutes !== null ? `${summary.averageServingTimeMinutes}m` : 'N/A' },
    { label: 'Tables Served', value: `${summary.customersServed} diners` },
    { label: 'Payment Breakdown', value: `${summary.paidOrders} Paid / ${summary.unpaidOrders} Unpaid` },
  ]

  const colWidth = (pageWidth - margin * 2) / 2
  kpis.forEach((kpi, index) => {
    const col = index % 2
    const row = Math.floor(index / 2)
    const cardX = margin + col * colWidth
    const cardY = y + row * 11

    doc.setFillColor(241, 246, 249) // #F1F6F9
    doc.roundedRect(cardX, cardY, colWidth - 2.5, 9.5, 1.2, 1.2, 'F')

    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 116, 139)
    doc.text(kpi.label, cardX + 2.5, cardY + 3.5)

    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(20, 39, 78)
    doc.text(kpi.value, cardX + 2.5, cardY + 7.5)
  })

  y += Math.ceil(kpis.length / 2) * 11 + 6

  // ── Section 2: Orders List Table ──
  doc.setTextColor(20, 39, 78)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text(`Historical Orders (${orders.length} shown)`, margin, y)
  y += 4.5

  function drawTableHeader(curY: number) {
    doc.setFillColor(20, 39, 78)
    doc.rect(margin, curY, pageWidth - margin * 2, 6, 'F')
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(255, 255, 255)

    doc.text('Order #', margin + 2, curY + 4.2)
    doc.text('Date & Time', margin + 18, curY + 4.2)
    doc.text('Table', margin + 55, curY + 4.2)
    doc.text('Pax', margin + 92, curY + 4.2)
    doc.text('Type', margin + 102, curY + 4.2)
    doc.text('Source', margin + 120, curY + 4.2)
    doc.text('Status', margin + 138, curY + 4.2)
    doc.text('Total (PHP)', margin + 162, curY + 4.2)
  }

  drawTableHeader(y)
  y += 6

  if (orders.length === 0) {
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 116, 139)
    doc.text('No orders match the selected filters.', margin + 2, y + 6)
  } else {
    orders.forEach((ord, idx) => {
      // Check page break
      if (y + 6.5 > pageHeight - 14) {
        doc.addPage()
        drawHeader()
        y = 34
        drawTableHeader(y)
        y += 6
      }

      const rowFill = idx % 2 === 0 ? 255 : 248
      doc.setFillColor(rowFill, rowFill, rowFill)
      doc.rect(margin, y, pageWidth - margin * 2, 5.5, 'F')

      doc.setFontSize(7.5)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(40, 50, 70)

      const timeFormatted = ord.createdAt ? ord.createdAt.replace('T', ' ').slice(0, 16) : '—'
      const tableLabel = ord.orderType === 'TICKET' ? `Ticket #${ord.orderId}` : (ord.mergedGroupLabel || `Table ${ord.tableNum}`)

      doc.text(`#${ord.orderId}`, margin + 2, y + 3.8)
      doc.text(timeFormatted, margin + 18, y + 3.8)
      doc.text(tableLabel.slice(0, 18), margin + 55, y + 3.8)
      doc.text(`${ord.guestCount}`, margin + 92, y + 3.8)
      doc.text(ord.orderType, margin + 102, y + 3.8)
      doc.text(ord.requestedFrom, margin + 120, y + 3.8)

      // Status with specific color
      if (ord.orderStatus === 'COMPLETED') doc.setTextColor(16, 185, 129) // green
      else if (ord.orderStatus === 'CANCELLED') doc.setTextColor(225, 29, 72) // rose
      else doc.setTextColor(59, 130, 246) // blue
      doc.text(ord.orderStatus, margin + 138, y + 3.8)

      doc.setTextColor(40, 50, 70)
      doc.text(ord.totalBill.toLocaleString('en-PH', { minimumFractionDigits: 2 }), margin + 162, y + 3.8)

      y += 5.5
    })
  }

  const dateStamp = new Date().toISOString().slice(0, 10)
  doc.save(`monolith_order_logs_${dateStamp}.pdf`)
}
