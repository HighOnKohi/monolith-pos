import React, { useState } from 'react'
import {
  Printer,
  Send,
  Trash2,
  Clock,
  Receipt,
  Percent,
  Plus,
  Minus,
  MessageSquare,
  ExternalLink,
} from 'lucide-react'
import type { Order } from '@/types/order'
import type { CartItem, DiningType } from '@/types/cart'
import type { BillRequest } from '@/types/bill'
import { PAYMENT_METHOD_LABEL } from '@/types/bill'
import type { TableItem } from './TableSelectorModal'

export type CashierRightTab = 'bill' | 'punch' | 'orders'

interface CashierRightPanelProps {
  selectedTable: TableItem | null
  activeTab: CashierRightTab
  onTabChange: (tab: CashierRightTab) => void
  onOpenTableSelector: () => void
  // Current Bill State
  tableOrders: Order[]
  activeBillRequest: BillRequest | null
  onAcknowledgeBillRequest: (req: BillRequest) => void
  onCompletePayment: () => void
  onPrintReceipt: () => void
  // Punch Order State
  punchCart: CartItem[]
  diningType: DiningType
  onDiningTypeChange: (type: DiningType) => void
  onIncreasePunchQty: (itemId: string) => void
  onDecreasePunchQty: (itemId: string) => void
  onRemovePunchItem: (itemId: string) => void
  onUpdatePunchNotes: (itemId: string, notes: string) => void
  onSendOrderToKitchen: () => void
  onClearPunchCart: () => void
  isSubmittingOrder: boolean
}

export const CashierRightPanel: React.FC<CashierRightPanelProps> = ({
  selectedTable,
  activeTab,
  onTabChange,
  onOpenTableSelector,
  tableOrders,
  activeBillRequest,
  onAcknowledgeBillRequest,
  onCompletePayment,
  onPrintReceipt,
  punchCart,
  diningType,
  onDiningTypeChange,
  onIncreasePunchQty,
  onDecreasePunchQty,
  onRemovePunchItem,
  onUpdatePunchNotes,
  onSendOrderToKitchen,
  onClearPunchCart,
  isSubmittingOrder,
}) => {
  // Discount state
  const [discountType, setDiscountType] = useState<'none' | 'senior' | 'pwd' | 'custom'>('none')
  const [customPercent, setCustomPercent] = useState<number>(10)

  const tableNum = selectedTable ? (selectedTable.TABLE_NUM || selectedTable.TABLE_ID) : 1

  // 1. Calculate Bill totals from tableOrders
  const rawOrdersTotal = tableOrders.reduce((sum, o) => sum + (o.totalBill || 0), 0)
  const baseSubtotal = rawOrdersTotal > 0 ? rawOrdersTotal / 1.05 : 0

  let discountAmount = 0
  if (discountType === 'senior' || discountType === 'pwd') {
    discountAmount = baseSubtotal * 0.20
  } else if (discountType === 'custom') {
    discountAmount = baseSubtotal * (Math.min(100, Math.max(0, customPercent)) / 100)
  }

  const taxableSubtotal = Math.max(0, baseSubtotal - discountAmount)
  const billTax = taxableSubtotal * 0.05
  const grandTotal = taxableSubtotal + billTax

  // 2. Calculate Punch Cart totals
  const punchSubtotal = punchCart.reduce((sum, ci) => sum + ci.item.price * ci.quantity, 0)
  const punchTax = punchSubtotal * 0.05
  const punchTotal = punchSubtotal + punchTax

  // Aggregate all ordered items for line item receipt
  const aggregatedItems: Array<{
    itemId: string
    name: string
    price: number
    quantity: number
    total: number
  }> = []

  const itemAggMap: Record<string, { itemId: string; name: string; price: number; quantity: number; total: number }> = {}
  for (const ord of tableOrders) {
    for (const it of ord.items ?? []) {
      const id = it.itemId
      const qty = it.quantity || 1
      const pr = it.price || 0
      const nm = it.name || `Dish #${id}`
      if (!itemAggMap[id]) {
        itemAggMap[id] = { itemId: id, name: nm, price: pr, quantity: 0, total: 0 }
      }
      itemAggMap[id].quantity += qty
      itemAggMap[id].total += pr * qty
    }
  }
  for (const key of Object.keys(itemAggMap)) {
    aggregatedItems.push(itemAggMap[key])
  }

  return (
    <div className="cashier-right-panel">
      {/* ── Panel Header matching reference image ── */}
      <div className="p-4 border-b border-slate-100 bg-white shrink-0">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h3 className="text-sm font-black text-[#14274E] flex items-center gap-1.5">
              <span>Table {tableNum} Bill</span>
              {activeBillRequest && (
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 animate-pulse">
                  Bill Requested
                </span>
              )}
            </h3>
            <p className="text-[11px] text-slate-400 font-medium">
              Table #{tableNum} • {tableOrders.length} active orders • {selectedTable?.GUEST_CAPACITY || 4} Guests
            </p>
          </div>

          <button
            onClick={onOpenTableSelector}
            className="p-1.5 text-slate-400 hover:text-[#14274E] rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
            title="Switch Table"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>

        {/* ── Segmented Pill Tabs matching reference image ── */}
        <div className="cashier-tabs-nav mt-3">
          <button
            onClick={() => onTabChange('bill')}
            className={[
              'cashier-tab-btn',
              activeTab === 'bill' ? 'is-active' : '',
            ].join(' ')}
          >
            Current Bill
          </button>
          <button
            onClick={() => onTabChange('punch')}
            className={[
              'cashier-tab-btn relative',
              activeTab === 'punch' ? 'is-active' : '',
            ].join(' ')}
          >
            Punch Order
            {punchCart.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[9px] bg-amber-400 text-amber-950 font-black">
                {punchCart.reduce((s, c) => s + c.quantity, 0)}
              </span>
            )}
          </button>
          <button
            onClick={() => onTabChange('orders')}
            className={[
              'cashier-tab-btn',
              activeTab === 'orders' ? 'is-active' : '',
            ].join(' ')}
          >
            Table Orders ({tableOrders.length})
          </button>
        </div>
      </div>

      {/* ── Tab 1: Current Bill ── */}
      {activeTab === 'bill' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Customer Bill Request Alert Banner */}
          {activeBillRequest && (
            <div className="mx-4 mt-3 p-3 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-xl bg-amber-100 text-amber-800">
                  <Receipt className="w-4 h-4" />
                </div>
                <div>
                  <h5 className="text-xs font-black text-amber-950">
                    {PAYMENT_METHOD_LABEL[activeBillRequest.paymentMethod]} Requested
                  </h5>
                  <p className="text-[10px] text-amber-700">
                    Status: {activeBillRequest.status}
                  </p>
                </div>
              </div>
              {activeBillRequest.status === 'REQUESTED' && (
                <button
                  onClick={() => onAcknowledgeBillRequest(activeBillRequest)}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-amber-600 hover:bg-amber-700 text-white cursor-pointer transition-colors"
                >
                  Acknowledge
                </button>
              )}
            </div>
          )}

          {/* Line Items List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400 px-1 border-b border-slate-100 pb-1.5">
              <span>Item Description</span>
              <div className="flex gap-4">
                <span>Qty</span>
                <span>Price</span>
              </div>
            </div>

            {aggregatedItems.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                <Receipt className="w-8 h-8 text-slate-300" />
                <span className="font-semibold text-slate-600">No active orders for Table {tableNum}</span>
                <span className="text-[11px] text-slate-400">
                  Punch an order using the "Punch Order" tab or dishes grid.
                </span>
                <button
                  onClick={() => onTabChange('punch')}
                  className="mt-2 text-xs font-bold text-[#14274E] underline cursor-pointer"
                >
                  Start punching order →
                </button>
              </div>
            ) : (
              aggregatedItems.map((item) => (
                <div
                  key={item.itemId}
                  className="flex items-center justify-between text-xs py-1.5 px-1 border-b border-slate-100/60"
                >
                  <div className="flex-1 pr-2">
                    <p className="font-bold text-[#14274E] line-clamp-1">{item.name}</p>
                    <p className="text-[10px] text-slate-400">₱{item.price.toFixed(2)} each</p>
                  </div>
                  <div className="flex items-center gap-4 text-right">
                    <span className="font-bold text-slate-600 w-6 text-center">x{item.quantity}</span>
                    <span className="font-black text-[#14274E] w-14">
                      ₱{item.total.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Bill Calculation & Discounts */}
          <div className="p-4 border-t border-slate-100 bg-slate-50/70 shrink-0 space-y-2.5">
            {/* Discount Selectors */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                <span className="flex items-center gap-1">
                  <Percent className="w-3 h-3 text-slate-400" />
                  Apply Discount
                </span>
                <span className="text-slate-400">
                  {discountType !== 'none' ? `-${(discountAmount).toFixed(2)}` : '0.00'}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                <button
                  onClick={() => setDiscountType('none')}
                  className={[
                    'py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer',
                    discountType === 'none'
                      ? 'bg-[#14274E] text-white border-[#14274E]'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100',
                  ].join(' ')}
                >
                  None
                </button>
                <button
                  onClick={() => setDiscountType('senior')}
                  className={[
                    'py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer',
                    discountType === 'senior'
                      ? 'bg-[#14274E] text-white border-[#14274E]'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100',
                  ].join(' ')}
                >
                  Senior (20%)
                </button>
                <button
                  onClick={() => setDiscountType('pwd')}
                  className={[
                    'py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer',
                    discountType === 'pwd'
                      ? 'bg-[#14274E] text-white border-[#14274E]'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100',
                  ].join(' ')}
                >
                  PWD (20%)
                </button>
                <button
                  onClick={() => setDiscountType('custom')}
                  className={[
                    'py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer',
                    discountType === 'custom'
                      ? 'bg-[#14274E] text-white border-[#14274E]'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100',
                  ].join(' ')}
                >
                  Custom
                </button>
              </div>

              {discountType === 'custom' && (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-slate-500 font-bold">Custom %:</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={customPercent}
                    onChange={(e) => setCustomPercent(Number(e.target.value) || 0)}
                    className="w-16 px-2 py-0.5 text-xs font-bold border border-slate-300 rounded-md outline-none focus:border-[#14274E]"
                  />
                </div>
              )}
            </div>

            {/* Financial Summary */}
            <div className="space-y-1.5 pt-2 border-t border-slate-200/80 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal</span>
                <span>₱{baseSubtotal.toFixed(2)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-emerald-600 font-bold">
                  <span>Discount</span>
                  <span>-₱{discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-500">
                <span>Tax (5% VAT)</span>
                <span>₱{billTax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-base font-black text-[#14274E] pt-1.5 border-t border-slate-200">
                <span>Grand Total</span>
                <span>₱{grandTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Footer action buttons matching reference image */}
            <div className="space-y-2 pt-1">
              <button
                disabled={aggregatedItems.length === 0}
                onClick={onCompletePayment}
                className="w-full py-2.5 rounded-xl bg-[#14274E] hover:bg-[#203c73] disabled:opacity-50 text-white text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
              >
                <span>Complete Payment / Settle Bill →</span>
              </button>

              <button
                onClick={onPrintReceipt}
                className="w-full py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Official Receipt</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 2: Punch Order ── */}
      {activeTab === 'punch' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Dining Type Selector */}
          <div className="p-4 border-b border-slate-100 flex items-center justify-between shrink-0">
            <span className="text-xs font-bold text-slate-600">Dining Type:</span>
            <div className="flex bg-slate-100 p-0.5 rounded-xl">
              <button
                onClick={() => onDiningTypeChange('dine-in')}
                className={[
                  'px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer',
                  diningType === 'dine-in'
                    ? 'bg-[#14274E] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900',
                ].join(' ')}
              >
                Dine-in
              </button>
              <button
                onClick={() => onDiningTypeChange('take-away')}
                className={[
                  'px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer',
                  diningType === 'take-away'
                    ? 'bg-[#14274E] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900',
                ].join(' ')}
              >
                Takeout
              </button>
            </div>
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {punchCart.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                <Plus className="w-8 h-8 text-slate-300" />
                <span className="font-semibold text-slate-600">Punch Cart is empty</span>
                <span className="text-[11px] text-slate-400">
                  Select dishes from the menu grid on the left to punch an order for Table {tableNum}.
                </span>
              </div>
            ) : (
              punchCart.map((ci) => (
                <div
                  key={ci.item.id}
                  className="p-3 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <img
                      src={ci.item.imageUrl}
                      alt={ci.item.name}
                      className="w-10 h-10 rounded-lg object-cover shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <h5 className="text-xs font-bold text-[#14274E] truncate">
                        {ci.item.name}
                      </h5>
                      <span className="text-[11px] font-black text-[#14274E]">
                        ₱{(ci.item.price * ci.quantity).toFixed(2)}
                      </span>
                    </div>

                    {/* Stepper */}
                    <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg p-0.5">
                      <button
                        onClick={() => onDecreasePunchQty(ci.item.id)}
                        className="w-5 h-5 rounded flex items-center justify-center bg-white text-slate-600 hover:bg-slate-200 text-xs font-bold cursor-pointer"
                      >
                        <Minus className="w-2.5 h-2.5" />
                      </button>
                      <span className="text-xs font-bold w-4 text-center">
                        {ci.quantity}
                      </span>
                      <button
                        onClick={() => onIncreasePunchQty(ci.item.id)}
                        className="w-5 h-5 rounded flex items-center justify-center bg-[#14274E] text-white hover:bg-[#203c73] text-xs font-bold cursor-pointer"
                      >
                        <Plus className="w-2.5 h-2.5" />
                      </button>
                    </div>

                    <button
                      onClick={() => onRemovePunchItem(ci.item.id)}
                      className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Cooking notes input */}
                  <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                    <MessageSquare className="w-3 h-3 text-slate-400 shrink-0" />
                    <input
                      type="text"
                      placeholder="Special cooking notes (e.g. less spicy, no onion)"
                      value={ci.notes || ''}
                      onChange={(e) => onUpdatePunchNotes(ci.item.id, e.target.value)}
                      className="w-full bg-transparent border-none outline-none text-[11px] text-slate-700 placeholder:text-slate-400"
                    />
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Punch Cart Summary & Action Buttons */}
          <div className="p-4 border-t border-slate-100 bg-slate-50/70 shrink-0 space-y-2.5">
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal ({punchCart.reduce((s, c) => s + c.quantity, 0)} items)</span>
                <span>₱{punchSubtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Tax (5%)</span>
                <span>₱{punchTax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-base font-black text-[#14274E] pt-1.5 border-t border-slate-200">
                <span>Order Total</span>
                <span>₱{punchTotal.toFixed(2)}</span>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <button
                disabled={punchCart.length === 0 || isSubmittingOrder}
                onClick={onSendOrderToKitchen}
                className="w-full py-2.5 rounded-xl bg-[#14274E] hover:bg-[#203c73] disabled:opacity-50 text-white text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
              >
                <Send className="w-3.5 h-3.5" />
                <span>
                  {isSubmittingOrder
                    ? 'Submitting Order...'
                    : `Send Order to Kitchen (Table ${tableNum}) →`}
                </span>
              </button>

              <button
                disabled={punchCart.length === 0}
                onClick={onClearPunchCart}
                className="w-full py-2 rounded-xl border border-rose-200 bg-rose-50/50 hover:bg-rose-100/60 disabled:opacity-40 text-rose-600 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Punch Cart</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 3: Table Orders Progression ── */}
      {activeTab === 'orders' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {tableOrders.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
              <Clock className="w-8 h-8 text-slate-300" />
              <span className="font-semibold text-slate-600">No active batches</span>
              <span className="text-[11px] text-slate-400">
                Orders submitted for Table {tableNum} will show their live kitchen status here.
              </span>
            </div>
          ) : (
            tableOrders.map((ord) => (
              <div
                key={ord.orderId}
                className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-[#14274E]">
                    Order #{ord.orderId}
                  </span>
                  <span
                    className={[
                      'text-[10px] font-extrabold px-2 py-0.5 rounded-full',
                      ord.orderStatus === 'REQUESTED'
                        ? 'bg-amber-100 text-amber-800'
                        : ord.orderStatus === 'VERIFIED'
                        ? 'bg-blue-100 text-blue-800'
                        : ord.orderStatus === 'PREPARING'
                        ? 'bg-purple-100 text-purple-800'
                        : ord.orderStatus === 'READY'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-100 text-slate-700',
                    ].join(' ')}
                  >
                    {ord.orderStatus}
                  </span>
                </div>

                <div className="divide-y divide-slate-100 text-xs">
                  {ord.items?.map((it) => (
                    <div key={it.orderItemId} className="py-1 flex justify-between">
                      <span className="text-slate-700 font-medium">
                        {it.name} <span className="text-slate-400">x{it.quantity}</span>
                      </span>
                      <span className="font-semibold text-slate-900">
                        ₱{((it.price || 0) * (it.quantity || 1)).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="pt-1 border-t border-slate-100 flex justify-between text-xs font-bold text-[#14274E]">
                  <span>Batch Total:</span>
                  <span>₱{ord.totalBill.toFixed(2)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
