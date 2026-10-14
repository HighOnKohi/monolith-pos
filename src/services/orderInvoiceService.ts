import { supabase } from '@/lib/supabase'
import { jsPDF } from 'jspdf'

export interface OrderInvoiceRecord {
  INVOICE_ID: number
  TABLE_NUM: number
  MERGE_GROUP_NUM: number | null
  GUEST_COUNT: number
  CASHIER_NAME: number | null
  ITEM_ID_LIST: number[]
  PERCENT_DISCOUNT_LIST: number[]
  INT_DISCOUNT_LIST: number[]
  DATE_GENERATED: string
  SUBTOTAL: number
  TOTAL: number
}

export interface OrderReceiptRecord {
  RECEIPT_ID: number
  INVOICE_ID: number
  DATE_PAID: string
  PAYMENT_TYPE: string
  AMOUNT_RECEIVED: number
  CHANGE_GIVEN: number
}

export interface InvoiceItemDetail {
  itemId: number
  name: string
  price: number
  percentDiscount: number
  intDiscount: number
}

export interface CreateInvoiceParams {
  tableNum: number
  mergeGroupNum?: number | null
  guestCount: number
  cashierStaffId?: number | null
  cashierNameStr?: string
  items: Array<{
    itemId: number
    name: string
    price: number
    percentDiscount: number
    intDiscount: number
  }>
  subtotal: number
  total: number
}

export interface CreateReceiptParams {
  invoiceId: number
  paymentType: 'Card' | 'Cash' | 'Both'
  amountReceived: number
  changeGiven: number
}

/**
 * Creates an official Order_Invoices row in orders schema.
 * ITEM_ID_LIST, PERCENT_DISCOUNT_LIST, and INT_DISCOUNT_LIST are parallel arrays
 * aligned strictly by item index.
 */
export async function createOrderInvoice(params: CreateInvoiceParams): Promise<OrderInvoiceRecord> {
  const itemIdList: number[] = []
  const percentDiscountList: number[] = []
  const intDiscountList: number[] = []

  for (const item of params.items) {
    itemIdList.push(Number(item.itemId) || 0)
    percentDiscountList.push(Math.round(Number(item.percentDiscount) || 0))
    intDiscountList.push(Number((Number(item.intDiscount) || 0).toFixed(2)))
  }

  const payload = {
    TABLE_NUM: Number(params.tableNum) || 1,
    MERGE_GROUP_NUM: params.mergeGroupNum ? Number(params.mergeGroupNum) : null,
    GUEST_COUNT: Math.max(1, Number(params.guestCount) || 1),
    CASHIER_NAME: params.cashierStaffId ? Number(params.cashierStaffId) : null,
    ITEM_ID_LIST: itemIdList,
    PERCENT_DISCOUNT_LIST: percentDiscountList,
    INT_DISCOUNT_LIST: intDiscountList,
    DATE_GENERATED: new Date().toISOString(),
    SUBTOTAL: Number(params.subtotal.toFixed(2)),
    TOTAL: Number(params.total.toFixed(2)),
  }

  const { data, error } = await supabase
    .schema('orders')
    .from('Order_Invoices')
    .insert([payload])
    .select()
    .single()

  if (error || !data) {
    console.error('[orderInvoiceService] Failed to create Order_Invoice:', error)
    throw new Error(error?.message || 'Failed to create invoice record in database.')
  }

  return data as OrderInvoiceRecord
}

/**
 * Creates an official Order_Receipts row in orders schema.
 */
export async function createOrderReceipt(params: CreateReceiptParams): Promise<OrderReceiptRecord> {
  const payload = {
    INVOICE_ID: Number(params.invoiceId),
    DATE_PAID: new Date().toISOString(),
    PAYMENT_TYPE: params.paymentType,
    AMOUNT_RECEIVED: Number(params.amountReceived.toFixed(2)),
    CHANGE_GIVEN: Number(params.changeGiven.toFixed(2)),
  }

  const { data, error } = await supabase
    .schema('orders')
    .from('Order_Receipts')
    .insert([payload])
    .select()
    .single()

  if (error || !data) {
    console.error('[orderInvoiceService] Failed to create Order_Receipt:', error)
    throw new Error(error?.message || 'Failed to create receipt record in database.')
  }

  return data as OrderReceiptRecord
}

/**
 * Fetch invoice by ID from orders.Order_Invoices
 */
export async function fetchInvoiceById(invoiceId: number): Promise<OrderInvoiceRecord | null> {
  const { data, error } = await supabase
    .schema('orders')
    .from('Order_Invoices')
    .select('*')
    .eq('INVOICE_ID', invoiceId)
    .maybeSingle()

  if (error) {
    console.warn(`[orderInvoiceService] Error fetching invoice #${invoiceId}:`, error)
    return null
  }
  return data as OrderInvoiceRecord | null
}

/**
 * Fetch receipt by ID from orders.Order_Receipts
 */
export async function fetchReceiptById(receiptId: number): Promise<OrderReceiptRecord | null> {
  const { data, error } = await supabase
    .schema('orders')
    .from('Order_Receipts')
    .select('*')
    .eq('RECEIPT_ID', receiptId)
    .maybeSingle()

  if (error) {
    console.warn(`[orderInvoiceService] Error fetching receipt #${receiptId}:`, error)
    return null
  }
  return data as OrderReceiptRecord | null
}

/**
 * Fetch receipt by invoice ID from orders.Order_Receipts
 */
export async function fetchReceiptByInvoiceId(invoiceId: number): Promise<OrderReceiptRecord | null> {
  const { data, error } = await supabase
    .schema('orders')
    .from('Order_Receipts')
    .select('*')
    .eq('INVOICE_ID', invoiceId)
    .maybeSingle()

  if (error) {
    console.warn(`[orderInvoiceService] Error fetching receipt for invoice #${invoiceId}:`, error)
    return null
  }
  return data as OrderReceiptRecord | null
}

/**
 * Helper to fetch menu item details (name, price) for an array of item IDs
 */
export async function fetchItemDetailsForIds(itemIds: number[]): Promise<Map<number, { name: string; price: number }>> {
  const result = new Map<number, { name: string; price: number }>()
  if (!itemIds || itemIds.length === 0) return result

  const uniqueIds = Array.from(new Set(itemIds))
  const { data, error } = await supabase
    .from('Menu_Items')
    .select('ITEM_ID, ITEM_NAME, ITEM_PRICE')
    .in('ITEM_ID', uniqueIds)

  if (!error && data) {
    for (const row of data) {
      result.set(Number(row.ITEM_ID), {
        name: String(row.ITEM_NAME || `Item #${row.ITEM_ID}`),
        price: Number(row.ITEM_PRICE || 0),
      })
    }
  }

  return result
}

/**
 * Generates and downloads an authentic A4 fine-dining receipt-format Invoice PDF using jsPDF.
 */
export function generateInvoicePdf(
  invoice: {
    INVOICE_ID?: number | string
    TABLE_NUM: number
    MERGE_GROUP_NUM?: number | null
    GUEST_COUNT: number
    DATE_GENERATED?: string
    SUBTOTAL: number
    TOTAL: number
  },
  items: InvoiceItemDetail[],
  cashierName?: string,
): jsPDF {
  // Group line items by name for clean restaurant format
  let grossTotal = 0
  let totalDiscounts = 0
  const groupedMap = new Map<
    string,
    { name: string; qty: number; unitPrice: number; discount: number; grossTotal: number; netTotal: number }
  >()

  for (const it of items) {
    grossTotal += it.price
    const disc = Math.min(it.price, it.intDiscount || 0)
    totalDiscounts += disc
    const existing = groupedMap.get(it.name)
    if (existing) {
      existing.qty += 1
      existing.discount += disc
      existing.grossTotal += it.price
      existing.netTotal += it.price - disc
    } else {
      groupedMap.set(it.name, {
        name: it.name,
        qty: 1,
        unitPrice: it.price,
        discount: disc,
        grossTotal: it.price,
        netTotal: it.price - disc,
      })
    }
  }

  const groupedLines = Array.from(groupedMap.values())

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4', // Full A4 fit
  })

  const pageWidth = 210
  const leftX = 20
  const rightX = 190
  let y = 22

  // Ensure pure monochrome text (no colored text)
  doc.setTextColor(0, 0, 0)

  // 1. Business Header
  doc.setFont('courier', 'bold')
  doc.setFontSize(16)
  doc.text('BILL SHAW RESTAURANT', pageWidth / 2, y, { align: 'center' })
  y += 6

  doc.setFont('courier', 'normal')
  doc.setFontSize(10)
  doc.text('Siena College Of Taytay', pageWidth / 2, y, { align: 'center' })
  y += 5.5

  doc.setFont('courier', 'bold')
  doc.setFontSize(11)
  doc.text('OFFICIAL DINING INVOICE', pageWidth / 2, y, { align: 'center' })
  y += 5

  // Dashed separator line
  doc.setFont('courier', 'normal')
  doc.setFontSize(9)
  doc.text('--------------------------------------------------------------------------------', pageWidth / 2, y, { align: 'center' })
  y += 6

  // 2. Transaction Metadata (2 Columns on A4)
  const invoiceDateStr = invoice.DATE_GENERATED ? new Date(invoice.DATE_GENERATED) : new Date()
  const dateFormatted = invoiceDateStr.toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  const timeFormatted = invoiceDateStr.toLocaleTimeString('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

  const tableLabel = invoice.MERGE_GROUP_NUM
    ? `Group ${invoice.MERGE_GROUP_NUM}`
    : `Table #${invoice.TABLE_NUM}`

  const printMetaRow = (leftKey: string, leftVal: string, rightKey: string, rightVal: string) => {
    doc.setFont('courier', 'normal')
    doc.text(leftKey, leftX, y)
    doc.setFont('courier', 'bold')
    doc.text(leftVal, leftX + 25, y)

    doc.setFont('courier', 'normal')
    doc.text(rightKey, 120, y)
    doc.setFont('courier', 'bold')
    doc.text(rightVal, rightX, y, { align: 'right' })
    y += 5.5
  }

  printMetaRow('Table:', tableLabel, 'Invoice #:', `INV-${invoice.INVOICE_ID || 'DRAFT'}`)
  printMetaRow('Date:', dateFormatted, 'Time:', timeFormatted)
  printMetaRow('Guests:', `${invoice.GUEST_COUNT} pax`, 'Server:', cashierName || 'Cashier')
  printMetaRow('Status:', isConfirmedStatusText(invoice), '', '')

  function isConfirmedStatusText(inv: typeof invoice) {
    return inv.INVOICE_ID ? 'CONFIRMED' : 'PENDING PAYMENT'
  }

  // Dashed separator
  doc.setFont('courier', 'normal')
  doc.setFontSize(9)
  doc.text('--------------------------------------------------------------------------------', pageWidth / 2, y, { align: 'center' })
  y += 6

  // 3. Items Header
  doc.setFont('courier', 'bold')
  doc.setFontSize(9.5)
  doc.text('ITEM', leftX, y)
  doc.text('QTY', 120, y, { align: 'center' })
  doc.text('PRICE', 155, y, { align: 'right' })
  doc.text('TOTAL', rightX, y, { align: 'right' })
  y += 3

  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(0.3)
  doc.line(leftX, y, rightX, y)
  y += 5.5

  // 4. Line Items
  doc.setFont('courier', 'normal')
  doc.setFontSize(9.5)
  for (const line of groupedLines) {
    if (y > 255) {
      doc.addPage()
      doc.setTextColor(0, 0, 0)
      y = 22
    }

    const truncatedName = line.name.length > 38 ? line.name.substring(0, 36) + '..' : line.name
    doc.setFont('courier', 'bold')
    doc.text(truncatedName, leftX, y)
    doc.text(String(line.qty), 120, y, { align: 'center' })
    doc.setFont('courier', 'normal')
    doc.text(`P${line.unitPrice.toFixed(2)}`, 155, y, { align: 'right' })
    doc.setFont('courier', 'bold')
    doc.text(`P${line.grossTotal.toFixed(2)}`, rightX, y, { align: 'right' })
    y += 5

    if (line.discount > 0) {
      doc.setFont('courier', 'italic')
      doc.text('  └ Less Discount', leftX, y)
      doc.text(`-P${line.discount.toFixed(2)}`, rightX, y, { align: 'right' })
      doc.setFont('courier', 'normal')
      y += 5
    }
  }

  // Dashed separator
  doc.setFont('courier', 'normal')
  doc.setFontSize(9)
  doc.text('--------------------------------------------------------------------------------', pageWidth / 2, y, { align: 'center' })
  y += 5.5

  // 5. Summary Section
  const taxableSubtotal = invoice.SUBTOTAL
  const vatAmount = Math.max(0, invoice.TOTAL - taxableSubtotal)

  const printSummaryRow = (label: string, valStr: string, isBold: boolean = false) => {
    doc.setFont('courier', isBold ? 'bold' : 'normal')
    doc.setFontSize(9.5)
    doc.text(label, leftX, y)
    doc.text(valStr, rightX, y, { align: 'right' })
    y += 5
  }

  printSummaryRow('Subtotal', `P${grossTotal.toFixed(2)}`)
  if (totalDiscounts > 0) {
    printSummaryRow('Total Discount', `-P${totalDiscounts.toFixed(2)}`, true)
  }
  printSummaryRow('Taxable Subtotal', `P${taxableSubtotal.toFixed(2)}`)
  printSummaryRow('VAT (5%)', `P${vatAmount.toFixed(2)}`)

  // Double line separator
  doc.setLineWidth(0.4)
  doc.line(leftX, y, rightX, y)
  y += 1.2
  doc.line(leftX, y, rightX, y)
  y += 6

  // Grand Total
  doc.setFont('courier', 'bold')
  doc.setFontSize(13)
  doc.text('TOTAL DUE', leftX, y)
  doc.text(`P${invoice.TOTAL.toFixed(2)}`, rightX, y, { align: 'right' })
  y += 6

  // Dashed separator
  doc.setFont('courier', 'normal')
  doc.setFontSize(9)
  doc.text('--------------------------------------------------------------------------------', pageWidth / 2, y, { align: 'center' })
  y += 6

  // 6. Footer
  doc.setFont('courier', 'bold')
  doc.setFontSize(9.5)
  doc.text('THANK YOU FOR DINING WITH US!', pageWidth / 2, y, { align: 'center' })
  y += 4.5
  doc.setFont('courier', 'normal')
  doc.setFontSize(8.5)
  doc.text('Please present this invoice upon settlement', pageWidth / 2, y, { align: 'center' })
  y += 4.5
  doc.setFont('courier', 'bold')
  doc.text('*** GUEST INVOICE / CHECK ***', pageWidth / 2, y, { align: 'center' })

  // Save PDF file
  const fileName = `Invoice_INV-${invoice.INVOICE_ID || 'DRAFT'}_Table-${invoice.TABLE_NUM}.pdf`
  doc.save(fileName)

  return doc
}
