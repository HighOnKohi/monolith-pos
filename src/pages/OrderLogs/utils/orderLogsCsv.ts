import type { OrderLogRow } from '@/services/orderLogsService'

/**
 * Escapes a field for RFC 4180 CSV compliance.
 */
function escapeCsv(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '""'
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return `"${str}"`
}

/**
 * Exports filtered Order Logs records to a downloadable CSV file.
 */
export function exportOrderLogsToCsv(orders: OrderLogRow[], filterLabel?: string): void {
  const headers = [
    'Order ID',
    'Date & Time Placed',
    'Table',
    'Merged Session',
    'Party Size (Pax)',
    'Order Type',
    'Source Channel',
    'Order Status',
    'Total Bill (PHP)',
    'Subtotal Bill (PHP)',
    'Payment Status',
    'Payment Method',
    'Completed At',
    'Kitchen Prep Time (mins)',
    'Serving Time (mins)',
    'Kitchen Note',
    'Server Note',
  ]

  const rows = orders.map((o) => [
    escapeCsv(`#${o.orderId}`),
    escapeCsv(o.createdAt),
    escapeCsv(o.orderType === 'TICKET' ? `Ticket #${o.orderId}` : `Table ${o.tableNum}`),
    escapeCsv(o.orderType === 'TICKET' ? 'N/A' : (o.mergedGroupLabel || 'Single Table')),
    escapeCsv(o.guestCount),
    escapeCsv(o.orderType),
    escapeCsv(o.requestedFrom),
    escapeCsv(o.orderStatus),
    escapeCsv(o.totalBill.toFixed(2)),
    escapeCsv(o.subtotalBill.toFixed(2)),
    escapeCsv(o.paymentStatus),
    escapeCsv(o.paymentMethod),
    escapeCsv(o.completedAt || 'N/A'),
    escapeCsv(o.prepDurationMinutes !== null ? `${o.prepDurationMinutes}m` : 'N/A'),
    escapeCsv(o.servingDurationMinutes !== null ? `${o.servingDurationMinutes}m` : 'N/A'),
    escapeCsv(o.kitchenNote || ''),
    escapeCsv(o.serverNote || ''),
  ])

  const csvContent = [
    `# Monolith POS - Order Logs Audit Export`,
    `# Filter / Range: ${filterLabel || 'All records'}`,
    `# Generated: ${new Date().toLocaleString('en-PH')}`,
    headers.join(','),
    ...rows.map((r) => r.join(',')),
  ].join('\r\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const dateStamp = new Date().toISOString().slice(0, 10)
  link.setAttribute('href', url)
  link.setAttribute('download', `monolith_order_logs_${dateStamp}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
