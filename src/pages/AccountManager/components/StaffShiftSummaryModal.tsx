import React, { useState, useEffect, useCallback } from 'react'
import {
  X,
  Clock,
  Trash2,
  AlertTriangle,
  Receipt,
  Loader2,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { validateManagerStaff } from '@/services/staffCodeService'
import { voidOrderItems, deleteOrder } from '@/services/orderService'
import type { StaffCodeItem } from '@/types/account'
import { ROLE_DEFINITIONS } from '@/types/account'

interface ShiftRecord {
  SHIFT_HISTORY_ID: number
  STAFF_CODE: number
  STAFF_NAME: string
  STAFF_ROLE: string
  TOTAL_ORDERS_PUNCHED?: number
  TOTAL_SHIFT_EARNING?: number
  SHIFT_STARTED?: string
  SHIFT_ENDED?: string
}

interface PunchedOrder {
  ORDER_ID: number
  TABLE_ID?: number
  ORDER_STATUS: string
  TOTAL_PRICE?: number
  DATE_CREATED?: string
  items?: Array<{
    ORDER_ITEM_ID: number
    ITEM_ID: number
    NAME?: string
    PRICE?: number
    QUANTITY?: number
  }>
}

interface StaffShiftSummaryModalProps {
  isOpen: boolean
  staff: StaffCodeItem | null
  onClose: () => void
  onActionDeleted?: () => void
}

export function StaffShiftSummaryModal({
  isOpen,
  staff,
  onClose,
  onActionDeleted,
}: StaffShiftSummaryModalProps) {
  const [activeTab, setActiveTab] = useState<'orders' | 'shifts'>('orders')
  const [shifts, setShifts] = useState<ShiftRecord[]>([])
  const [orders, setOrders] = useState<PunchedOrder[]>([])
  const [loading, setLoading] = useState(true)

  // Void Action Modal State
  const [targetOrder, setTargetOrder] = useState<PunchedOrder | null>(null)
  const [managerCode, setManagerCode] = useState('')
  const [authError, setAuthError] = useState<string | null>(null)
  const [isVoiding, setIsVoiding] = useState(false)
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null)

  const loadStaffData = useCallback(async () => {
    if (!staff) return
    setLoading(true)

    try {
      // 1. Fetch shift history records
      const { data: shiftData } = await supabase
        .schema('system_history')
        .from('Shift_History')
        .select('*')
        .eq('STAFF_CODE', staff.codeId)
        .order('SHIFT_HISTORY_ID', { ascending: false })
        .limit(20)

      setShifts((shiftData as ShiftRecord[]) || [])

      // 2. Fetch punched orders by this staff member
      // Primary: schema 'orders' table 'Orders'
      let fetchedOrders: PunchedOrder[] = []
      const { data: ordersData, error: ordersErr } = await supabase
        .schema('orders')
        .from('Orders')
        .select('ORDER_ID, TABLE_ID, ORDER_STATUS, TOTAL_PRICE, DATE_CREATED, Order_Items ( ORDER_ITEM_ID, ITEM_ID, QUANTITY )')
        .eq('STAFF_ID', staff.codeId)
        .order('ORDER_ID', { ascending: false })
        .limit(50)

      if (!ordersErr && ordersData) {
        fetchedOrders = (ordersData as unknown[]).map((row: any) => ({
          ORDER_ID: row.ORDER_ID,
          TABLE_ID: row.TABLE_ID,
          ORDER_STATUS: row.ORDER_STATUS,
          TOTAL_PRICE: Number(row.TOTAL_PRICE) || 0,
          DATE_CREATED: row.DATE_CREATED,
          items: (row.Order_Items || []).map((oi: any) => ({
            ORDER_ITEM_ID: oi.ORDER_ITEM_ID,
            ITEM_ID: oi.ITEM_ID,
            QUANTITY: oi.QUANTITY,
          })),
        }))
      } else {
        // Fallback: public schema
        const { data: pubOrders } = await supabase
          .from('Orders')
          .select('ORDER_ID, TABLE_ID, ORDER_STATUS, TOTAL_PRICE, DATE_CREATED')
          .eq('STAFF_ID', staff.codeId)
          .order('ORDER_ID', { ascending: false })
          .limit(50)

        if (pubOrders) {
          fetchedOrders = pubOrders as PunchedOrder[]
        }
      }

      setOrders(fetchedOrders)
    } catch (err) {
      console.warn('[StaffShiftSummaryModal] Load error:', err)
    } finally {
      setLoading(false)
    }
  }, [staff])

  useEffect(() => {
    if (isOpen && staff) {
      void loadStaffData()
      setTargetOrder(null)
      setManagerCode('')
      setAuthError(null)
      setFeedbackToast(null)
    }
  }, [isOpen, staff, loadStaffData])

  if (!isOpen || !staff) return null

  // Handle Void / Deletion of a punched order action with Manager Code
  const handleConfirmVoidAction = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!targetOrder) return

    const codeNum = Number(managerCode.trim())
    if (!managerCode.trim() || isNaN(codeNum) || codeNum <= 0) {
      setAuthError('Please enter a valid numeric Manager staff code.')
      return
    }

    setIsVoiding(true)
    setAuthError(null)

    try {
      // 1. Verify Manager Staff Code
      const authRes = await validateManagerStaff(codeNum)
      if (!authRes.valid) {
        setAuthError(authRes.error || 'Only MANAGER staff codes can authorize deleting actions.')
        setIsVoiding(false)
        return
      }

      // 2. Void/Delete the order and its items
      const orderId = targetOrder.ORDER_ID
      const tableId = targetOrder.TABLE_ID || 1

      if (targetOrder.items && targetOrder.items.length > 0) {
        const itemIds = targetOrder.items.map((i) => i.ORDER_ITEM_ID)
        await voidOrderItems(orderId, itemIds, tableId, undefined, {
          staffId: codeNum,
          reason: `Manager #${codeNum} (${authRes.staff?.staffName}) voided order action #${orderId} due to glitch.`,
        })
      } else {
        await deleteOrder(orderId, {
          staffId: codeNum,
          reason: `Manager #${codeNum} (${authRes.staff?.staffName}) deleted order action #${orderId} due to glitch.`,
        })
      }

      setOrders((prev) => prev.filter((o) => o.ORDER_ID !== orderId))
      setFeedbackToast(
        `Order action #${orderId} has been successfully voided and removed by Manager ${authRes.staff?.staffName}.`,
      )
      setTimeout(() => setFeedbackToast(null), 4000)
      setTargetOrder(null)
      setManagerCode('')

      if (onActionDeleted) {
        onActionDeleted()
      }
    } catch (err) {
      console.error('[StaffShiftSummaryModal] Void action error:', err)
      setAuthError(err instanceof Error ? err.message : 'Failed to void order action.')
    } finally {
      setIsVoiding(false)
    }
  }

  const roleMeta = ROLE_DEFINITIONS[staff.staffRole] || ROLE_DEFINITIONS.DISPATCHER

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl flex flex-col max-h-[88vh] overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-[#14274E] via-[#1a3366] to-[#14274E] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-[#E9C46A] shrink-0 font-bold">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-white">{staff.staffName}</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-[#E9C46A] text-[#14274E]">
                  Code #{staff.codeId}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${roleMeta.badgeBg} ${roleMeta.badgeText} ${roleMeta.badgeBorder}`}
                >
                  {roleMeta.label}
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium mt-0.5">
                Staff shift overview and table actions punched by this staff member.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sub-Tab Navigation inside Modal */}
        <div className="px-6 pt-3 pb-2 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('orders')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'orders'
                  ? 'bg-[#14274E] text-white shadow-2xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Punched Orders &amp; Actions ({orders.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('shifts')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'shifts'
                  ? 'bg-[#14274E] text-white shadow-2xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Shift History ({shifts.length})</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => void loadStaffData()}
            disabled={loading}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Feedback Banner */}
        {feedbackToast && (
          <div className="mx-6 mt-3 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{feedbackToast}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 className="w-7 h-7 animate-spin text-[#14274E]" />
              <span className="text-xs font-bold">Loading staff actions...</span>
            </div>
          ) : activeTab === 'orders' ? (
            /* Punched Orders Tab */
            orders.length === 0 ? (
              <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-2">
                <Receipt className="w-10 h-10 text-slate-300" />
                <span className="text-sm font-bold text-slate-600">No punched orders recorded</span>
                <span className="text-xs text-slate-400">
                  Orders punched by this staff member on tables will appear here.
                </span>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3 bg-amber-50/80 border border-amber-200/70 rounded-xl flex items-start gap-2 text-amber-900 text-xs font-medium leading-relaxed">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    To resolve system glitches, actions can be deleted/voided. Deleting an action strictly requires entering a <strong>Manager Staff Code</strong>.
                  </span>
                </div>

                <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
                  {orders.map((ord) => {
                    const isCancelled = ord.ORDER_STATUS === 'CANCELLED'
                    return (
                      <div
                        key={ord.ORDER_ID}
                        className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-sm text-[#14274E]">
                              Order #{ord.ORDER_ID}
                            </span>
                            <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                              Table {ord.TABLE_ID ? `#${ord.TABLE_ID}` : 'N/A'}
                            </span>
                            <span
                              className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${
                                isCancelled
                                  ? 'bg-rose-100 text-rose-800'
                                  : ord.ORDER_STATUS === 'COMPLETED'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {ord.ORDER_STATUS}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-xs text-slate-400 font-medium">
                            {ord.DATE_CREATED && (
                              <span>
                                {new Date(ord.DATE_CREATED).toLocaleString([], {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            )}
                            <span className="font-bold text-slate-700 font-mono">
                              ₱{(Number(ord.TOTAL_PRICE) || 0).toFixed(2)}
                            </span>
                            {ord.items && ord.items.length > 0 && (
                              <span>{ord.items.length} item(s)</span>
                            )}
                          </div>
                        </div>

                        {/* Void Action Button */}
                        <button
                          type="button"
                          disabled={isCancelled}
                          onClick={() => {
                            setTargetOrder(ord)
                            setManagerCode('')
                            setAuthError(null)
                          }}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer shadow-2xs ${
                            isCancelled
                              ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 border border-slate-200'
                              : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 active:scale-95'
                          }`}
                          title="Void / delete this order action with Manager authorization"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                          <span>{isCancelled ? 'Already Voided' : 'Void / Delete Action'}</span>
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          ) : (
            /* Shift History Tab */
            shifts.length === 0 ? (
              <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-2">
                <Clock className="w-10 h-10 text-slate-300" />
                <span className="text-sm font-bold text-slate-600">No shift records found</span>
                <span className="text-xs text-slate-400">
                  Completed shifts for this staff code will be listed here.
                </span>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
                  {shifts.map((s) => (
                    <div
                      key={s.SHIFT_HISTORY_ID}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm text-[#14274E]">
                            Shift #{s.SHIFT_HISTORY_ID}
                          </span>
                          <span className="text-xs font-bold text-slate-500">
                            {s.SHIFT_STARTED ? new Date(s.SHIFT_STARTED).toLocaleDateString() : 'N/A'}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500">
                          <span>
                            {s.SHIFT_STARTED
                              ? new Date(s.SHIFT_STARTED).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : 'N/A'}{' '}
                            —{' '}
                            {s.SHIFT_ENDED
                              ? new Date(s.SHIFT_ENDED).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : 'Active'}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="font-mono font-black text-emerald-700 text-sm">
                          ₱{(Number(s.TOTAL_SHIFT_EARNING) || 0).toFixed(2)}
                        </div>
                        <div className="text-[11px] font-bold text-slate-400">
                          {Number(s.TOTAL_ORDERS_PUNCHED) || 0} orders punched
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-xs font-black text-slate-700 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>

      {/* ── Manager Authorization Modal for Voiding Specific Action ── */}
      {targetOrder && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          onClick={() => !isVoiding && setTargetOrder(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-rose-50/70">
              <div className="flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-rose-600" />
                <h3 className="text-sm font-black text-[#14274E]">
                  Delete Action (Order #{targetOrder.ORDER_ID})
                </h3>
              </div>
              <button
                type="button"
                disabled={isVoiding}
                onClick={() => setTargetOrder(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmVoidAction} className="p-5 space-y-4">
              <p className="text-xs text-slate-500 font-medium">
                To delete this action due to a system glitch, please enter a valid <strong>Manager Staff Code</strong>.
              </p>

              <div className="space-y-1.5">
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                  Manager Staff Code <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  autoFocus
                  disabled={isVoiding}
                  value={managerCode}
                  onChange={(e) => {
                    setManagerCode(e.target.value)
                    if (authError) setAuthError(null)
                  }}
                  placeholder="Enter 4-digit Manager code"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:border-[#14274E] focus:ring-2 focus:ring-[#14274E]/10 outline-none font-mono font-black"
                />
              </div>

              {authError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
                  {authError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isVoiding}
                  onClick={() => setTargetOrder(null)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isVoiding || !managerCode.trim()}
                  className="px-4 py-2 rounded-xl text-xs font-black text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  {isVoiding ? 'Verifying...' : 'Authorize & Delete'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
