// ─── Receipt Snapshot Types ───────────────────────────────────────────────────
//
// The ReceiptSnapshot is captured BEFORE the bill-out DB operation clears
// the active order. This ensures receipt data survives the table reset.
//
// Architecture note: The snapshot is pure client-side state — no new DB table
// is required. All required data exists in React state at payment time.

export interface ReceiptLineItem {
  itemId: string
  name: string
  quantity: number
  unitPrice: number
  /** quantity × unitPrice — before any discounts */
  lineSubtotal: number
}

export interface ReceiptDiscount {
  /** Human-readable label, e.g. "Senior Citizen Discount (20%)" */
  label: string
  /** Positive number representing the reduction amount */
  amount: number
}

export interface ReceiptSnapshot {
  /** Unique identifier for this receipt (timestamp-based) */
  receiptId: string
  /** Table number shown on receipt (e.g. 5) */
  tableNum: number | string
  tableId: number
  /** Formatted date: "September 6, 2026" */
  transactionDate: string
  /** Formatted time: "12:45:31 PM" */
  transactionTime: string
  /** Human-readable payment method: "Cash" | "Credit Card" | "InstaPay QR" */
  paymentMethod: string
  status: 'PAID'
  items: ReceiptLineItem[]
  /** Sum of all item lineSubtotals (before discounts) */
  baseSubtotal: number
  /** Order-level discounts applied (Senior, PWD, Custom) */
  tableDiscounts: ReceiptDiscount[]
  /** Total discount amount (sum of all tableDiscounts) */
  totalDiscount: number
  /** VAT amount */
  taxAmount: number
  /** The actual final amount charged to the customer */
  grandTotal: number
}
