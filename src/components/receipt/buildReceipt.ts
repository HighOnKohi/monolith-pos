// ─── Receipt Snapshot Builder ─────────────────────────────────────────────────
//
// Converts the current Cashier panel state into a ReceiptSnapshot.
//
// CRITICAL: This function MUST be called BEFORE any bill-out DB operations
// clear the active orders. Once the table resets, the data is gone.
//
// The calculations here exactly mirror the formulas used in CashierRightPanel.tsx
// to ensure the receipt total matches what was displayed to the cashier.

import type { Order } from '@/types/order'
import type { BillRequest, PaymentMethod } from '@/types/bill'
import { PAYMENT_METHOD_LABEL } from '@/types/bill'
import type { ReceiptSnapshot, ReceiptLineItem, ReceiptDiscount } from './types'

export type DiscountType = 'none' | 'senior' | 'pwd' | 'custom'

export interface ReceiptBuildParams {
  tableOrders: Order[]
  discountType: DiscountType
  customPercent: number
  activeBillRequest: BillRequest | null
  tableId: number
  tableNum: number | string
}

/**
 * Formats a Date as "September 6, 2026"
 */
function formatReceiptDate(d: Date): string {
  return d.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/**
 * Formats a Date as "12:45:31 PM"
 */
function formatReceiptTime(d: Date): string {
  return d.toLocaleTimeString('en-PH', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  })
}

/**
 * Builds a complete ReceiptSnapshot from the current cashier panel state.
 * Call this BEFORE bill-out DB operations.
 */
export function buildReceiptSnapshot(params: ReceiptBuildParams): ReceiptSnapshot {
  const { tableOrders, discountType, customPercent, activeBillRequest, tableId, tableNum } = params

  // ── 1. Aggregate line items across all orders for this table ──
  const itemAggMap: Record<
    string,
    { itemId: string; name: string; price: number; quantity: number; total: number }
  > = {}

  for (const ord of tableOrders) {
    for (const it of ord.items ?? []) {
      const id = it.itemId
      const qty = it.quantity || 1
      const pr = it.price || 0
      const nm = it.name || `Item #${id}`

      if (!itemAggMap[id]) {
        itemAggMap[id] = { itemId: id, name: nm, price: pr, quantity: 0, total: 0 }
      }
      itemAggMap[id].quantity += qty
      itemAggMap[id].total += pr * qty
    }
  }

  const items: ReceiptLineItem[] = Object.values(itemAggMap).map((agg) => ({
    itemId: agg.itemId,
    name: agg.name,
    quantity: agg.quantity,
    unitPrice: agg.price,
    lineSubtotal: agg.total,
  }))

  // ── 2. Calculate totals — exactly mirroring CashierRightPanel formulas ──
  const rawOrdersTotal = tableOrders.reduce((sum, o) => sum + (o.totalBill || 0), 0)

  // Prices in DB include 5% VAT: strip VAT to get base subtotal
  const baseSubtotal = rawOrdersTotal > 0 ? rawOrdersTotal / 1.05 : 0

  // Apply order-level discount
  let discountRate = 0
  let discountLabel = ''
  if (discountType === 'senior') {
    discountRate = 0.20
    discountLabel = 'Senior Citizen Discount (20%)'
  } else if (discountType === 'pwd') {
    discountRate = 0.20
    discountLabel = 'PWD Discount (20%)'
  } else if (discountType === 'custom') {
    const clampedPct = Math.min(100, Math.max(0, customPercent))
    discountRate = clampedPct / 100
    discountLabel = `Custom Discount (${clampedPct}%)`
  }

  const discountAmount = baseSubtotal * discountRate

  const tableDiscounts: ReceiptDiscount[] = discountAmount > 0
    ? [{ label: discountLabel, amount: discountAmount }]
    : []

  const totalDiscount = discountAmount
  const taxableSubtotal = Math.max(0, baseSubtotal - discountAmount)
  const taxAmount = taxableSubtotal * 0.05
  const grandTotal = taxableSubtotal + taxAmount

  // ── 3. Resolve payment method ──
  const paymentMethodKey: PaymentMethod = activeBillRequest?.paymentMethod ?? 'CASH'
  const paymentMethod = PAYMENT_METHOD_LABEL[paymentMethodKey] ?? 'Cash'

  // ── 4. Build snapshot ──
  const now = new Date()
  return {
    receiptId: `RCPT-${tableId}-${Date.now()}`,
    tableNum,
    tableId,
    transactionDate: formatReceiptDate(now),
    transactionTime: formatReceiptTime(now),
    paymentMethod,
    status: 'PAID',
    items,
    baseSubtotal,
    tableDiscounts,
    totalDiscount,
    taxAmount,
    grandTotal,
  }
}
