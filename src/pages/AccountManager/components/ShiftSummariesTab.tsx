import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Clock,
  Trash2,
  ShieldCheck,
  AlertTriangle,
  Search,
  Filter,
  DollarSign,
  Receipt,
  ChefHat,
  Store,
  UtensilsCrossed,
  FolderKanban,
  ConciergeBell,
  X,
  Loader2,
  RefreshCw,
  KeyRound,
  CheckCircle2,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { validateManagerStaff } from '@/services/staffCodeService'
import type { StaffRole } from '@/types/account'
import { ROLE_DEFINITIONS } from '@/types/account'

export interface ShiftHistoryRecord {
  SHIFT_HISTORY_ID: number
  STAFF_CODE: number
  STAFF_NAME: string
  STAFF_ROLE: string
  TOTAL_ORDERS_PUNCHED?: number
  TOTAL_ORDERS_PUNCHED_VALUE?: number
  ORDERS_ACCEPTED?: number
  ORDERS_COOKED?: number
  ORDERS_CANCELLED?: number
  ORDERS_COMPLETED?: number
  TOTAL_TABLES_HANDLED?: number
  TOTAL_SHIFT_EARNING?: number
  SHIFT_STARTED?: string
  SHIFT_ENDED?: string
}

function formatShiftDateTime(dateStr?: string | null): string {
  if (!dateStr) return 'N/A'
  try {
    const d = new Date(dateStr)
    return d.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}

function computeDuration(startStr?: string | null, endStr?: string | null): string {
  if (!startStr || !endStr) return 'N/A'
  try {
    const s = new Date(startStr).getTime()
    const e = new Date(endStr).getTime()
    const diffMs = Math.max(0, e - s)
    const hours = Math.floor(diffMs / (1000 * 60 * 60))
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
    return `${hours}h ${mins}m`
  } catch {
    return 'N/A'
  }
}

export function ShiftSummariesTab() {
  const [shifts, setShifts] = useState<ShiftHistoryRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('ALL')

  // Deletion Modal State
  const [targetShift, setTargetShift] = useState<ShiftHistoryRecord | null>(null)
  const [managerCode, setManagerCode] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [successToast, setSuccessToast] = useState<string | null>(null)

  const loadShiftHistory = useCallback(async () => {
    setLoading(true)
    try {
      let rows: ShiftHistoryRecord[] = []

      // Primary schema: system_history
      const { data: schemaData, error: schemaErr } = await supabase
        .schema('system_history')
        .from('Shift_History')
        .select('*')
        .order('SHIFT_HISTORY_ID', { ascending: false })
        .limit(200)

      if (!schemaErr && schemaData) {
        rows = schemaData as ShiftHistoryRecord[]
      } else {
        // Fallback: public
        const { data: pubData, error: pubErr } = await supabase
          .from('Shift_History')
          .select('*')
          .order('SHIFT_HISTORY_ID', { ascending: false })
          .limit(200)

        if (!pubErr && pubData) {
          rows = pubData as ShiftHistoryRecord[]
        }
      }

      setShifts(rows)
    } catch (err) {
      console.warn('[ShiftSummariesTab] Error loading shift history:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadShiftHistory()
  }, [loadShiftHistory])

  // Delete execution with Manager authorization
  const handleConfirmDelete = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!targetShift) return

    const codeNum = Number(managerCode.trim())
    if (!managerCode.trim() || isNaN(codeNum) || codeNum <= 0) {
      setAuthError('Please enter a valid numeric Manager staff code.')
      return
    }

    setIsDeleting(true)
    setAuthError(null)

    try {
      // 1. Verify Manager Staff Code
      const authRes = await validateManagerStaff(codeNum)
      if (!authRes.valid) {
        setAuthError(authRes.error || 'Manager authorization failed.')
        setIsDeleting(false)
        return
      }

      // 2. Delete the record from system_history.Shift_History
      const shiftId = targetShift.SHIFT_HISTORY_ID
      const { error: delErr } = await supabase
        .schema('system_history')
        .from('Shift_History')
        .delete()
        .eq('SHIFT_HISTORY_ID', shiftId)

      if (delErr) {
        // Try public schema fallback
        await supabase.from('Shift_History').delete().eq('SHIFT_HISTORY_ID', shiftId)
      }

      setShifts((prev) => prev.filter((s) => s.SHIFT_HISTORY_ID !== shiftId))
      setSuccessToast(
        `Shift registry #${shiftId} for ${targetShift.STAFF_NAME} deleted by Manager ${authRes.staff?.staffName}.`,
      )
      setTimeout(() => setSuccessToast(null), 4000)
      setTargetShift(null)
      setManagerCode('')
    } catch (err) {
      console.error('[ShiftSummariesTab] Deletion error:', err)
      setAuthError(err instanceof Error ? err.message : 'Failed to delete shift registry.')
    } finally {
      setIsDeleting(false)
    }
  }

  // Filter shifts
  const filteredShifts = useMemo(() => {
    return shifts.filter((s) => {
      if (roleFilter !== 'ALL' && s.STAFF_ROLE !== roleFilter) {
        return false
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchName = (s.STAFF_NAME || '').toLowerCase().includes(q)
        const matchCode = String(s.STAFF_CODE || '').includes(q)
        const matchId = String(s.SHIFT_HISTORY_ID || '').includes(q)
        if (!matchName && !matchCode && !matchId) return false
      }
      return true
    })
  }, [shifts, searchQuery, roleFilter])

  // Summary Metrics
  const totalEarningsSum = useMemo(() => {
    return filteredShifts.reduce((acc, s) => acc + (Number(s.TOTAL_SHIFT_EARNING) || 0), 0)
  }, [filteredShifts])

  const totalOrdersSum = useMemo(() => {
    return filteredShifts.reduce(
      (acc, s) =>
        acc +
        (Number(s.TOTAL_ORDERS_PUNCHED) ||
          Number(s.ORDERS_COMPLETED) ||
          Number(s.ORDERS_ACCEPTED) ||
          0),
      0,
    )
  }, [filteredShifts])

  const renderRoleIcon = (roleStr?: string) => {
    const role = (roleStr || '').toUpperCase() as StaffRole
    if (role === 'MANAGER') return <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
    if (role === 'CASHIER') return <Store className="w-3.5 h-3.5 text-emerald-600" />
    if (role === 'SERVICE') return <UtensilsCrossed className="w-3.5 h-3.5 text-amber-600" />
    if (role === 'ORGANIZER') return <FolderKanban className="w-3.5 h-3.5 text-purple-600" />
    if (role === 'RECEPTIONIST') return <ConciergeBell className="w-3.5 h-3.5 text-pink-600" />
    return <ChefHat className="w-3.5 h-3.5 text-blue-600" />
  }

  return (
    <div className="space-y-6">
      {/* ── KPI Summary Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Recorded Shifts
            </div>
            <div className="text-2xl font-black text-[#14274E] mt-0.5">
              {filteredShifts.length}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Total Orders Processed
            </div>
            <div className="text-2xl font-black text-amber-600 mt-0.5">
              {totalOrdersSum}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Receipt className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Total Shift Earnings
            </div>
            <div className="text-2xl font-black text-emerald-600 mt-0.5">
              ₱{totalEarningsSum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Success Notification */}
      {successToast && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center gap-2.5 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      {/* ── Search & Filter Controls ── */}
      <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search shift by staff name, code (e.g. 1024), or registry ID..."
            className="w-full pl-10 pr-9 py-2 rounded-xl border border-slate-200 bg-slate-50/50 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#14274E] focus:bg-white transition-all font-medium"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Filter className="w-3.5 h-3.5" />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-2.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 hover:bg-white focus:outline-none focus:border-[#14274E] cursor-pointer"
            >
              <option value="ALL">All Roles</option>
              <option value="MANAGER">{ROLE_DEFINITIONS.MANAGER.label}</option>
              <option value="CASHIER">{ROLE_DEFINITIONS.CASHIER.label}</option>
              <option value="SERVICE">{ROLE_DEFINITIONS.SERVICE.label}</option>
              <option value="DISPATCHER">{ROLE_DEFINITIONS.DISPATCHER.label}</option>
              <option value="ORGANIZER">{ROLE_DEFINITIONS.ORGANIZER.label}</option>
              <option value="RECEPTIONIST">{ROLE_DEFINITIONS.RECEPTIONIST.label}</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => void loadShiftHistory()}
            disabled={loading}
            className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
            title="Refresh Shift Summaries"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Shift Summaries Table ── */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="p-4 sm:px-6 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#14274E]" />
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
              Shift Registry History ({filteredShifts.length})
            </h3>
          </div>
          <p className="text-[11px] text-slate-400 font-medium hidden sm:block">
            Deleting shift registries is strictly protected by Manager code authorization (for glitch resolution).
          </p>
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
            <Loader2 className="w-7 h-7 animate-spin text-[#14274E]" />
            <span className="text-xs font-bold">Loading shift summaries...</span>
          </div>
        ) : filteredShifts.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-2">
            <Clock className="w-10 h-10 text-slate-300" />
            <span className="text-sm font-bold text-slate-600">No shift registries found</span>
            <span className="text-xs text-slate-400">
              {searchQuery || roleFilter !== 'ALL'
                ? 'Try resetting your search query or role filter.'
                : 'Completed staff shifts will be recorded here.'}
            </span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-black uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Shift ID</th>
                  <th className="py-3 px-4">Staff Member</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Shift Timeline</th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4 text-center">Orders</th>
                  <th className="py-3 px-4 text-right">Shift Earnings</th>
                  <th className="py-3 px-4 text-center">Glitch Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredShifts.map((shift) => {
                  const roleMeta =
                    ROLE_DEFINITIONS[shift.STAFF_ROLE as StaffRole] || ROLE_DEFINITIONS.DISPATCHER
                  const duration = computeDuration(shift.SHIFT_STARTED, shift.SHIFT_ENDED)
                  const ordersCount =
                    Number(shift.TOTAL_ORDERS_PUNCHED) ||
                    Number(shift.ORDERS_COMPLETED) ||
                    Number(shift.ORDERS_ACCEPTED) ||
                    0
                  const earnings = Number(shift.TOTAL_SHIFT_EARNING) || 0

                  return (
                    <tr
                      key={shift.SHIFT_HISTORY_ID}
                      className="hover:bg-slate-50/70 transition-colors font-medium text-slate-700"
                    >
                      <td className="py-3.5 px-4 font-mono font-black text-slate-400">
                        #{shift.SHIFT_HISTORY_ID}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-extrabold text-[#14274E]">
                          {shift.STAFF_NAME || 'Staff Member'}
                        </div>
                        <div className="text-[10px] font-mono font-bold text-slate-400">
                          Code: #{shift.STAFF_CODE}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black border ${roleMeta.badgeBg} ${roleMeta.badgeText} ${roleMeta.badgeBorder}`}
                        >
                          {renderRoleIcon(shift.STAFF_ROLE)}
                          <span>{roleMeta.label}</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-[11px]">
                        <div>
                          <span className="text-slate-400 font-bold">Start: </span>
                          <span>{formatShiftDateTime(shift.SHIFT_STARTED)}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-bold">End: </span>
                          <span>{formatShiftDateTime(shift.SHIFT_ENDED)}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-lg bg-slate-100 font-bold text-slate-700 text-[11px] font-mono">
                          {duration}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-black text-[#14274E]">
                        {ordersCount}
                      </td>
                      <td className="py-3.5 px-4 text-right font-black text-emerald-700 font-mono">
                        ₱{earnings.toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setTargetShift(shift)
                            setManagerCode('')
                            setAuthError(null)
                          }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-black text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-all cursor-pointer shadow-2xs"
                          title="Delete this shift registry due to a system glitch"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                          <span>Delete Registry</span>
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Manager Authorization Modal for Shift Registry Deletion ── */}
      {targetShift && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          onClick={() => !isDeleting && setTargetShift(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-rose-50/60">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-[#14274E]">Delete Shift Registry</h3>
                  <p className="text-[11px] font-bold text-slate-500">
                    Registry #{targetShift.SHIFT_HISTORY_ID} · {targetShift.STAFF_NAME}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setTargetShift(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmDelete}>
              <div className="p-5 space-y-4">
                {/* Warning Banner */}
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-900 text-xs font-medium leading-relaxed">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    This action permanently deletes this shift registry to resolve system glitches. A valid <strong>Manager Staff Code</strong> is required to proceed.
                  </span>
                </div>

                {/* Shift Details Summary */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-bold">Staff:</span>
                    <span className="font-black text-[#14274E]">
                      {targetShift.STAFF_NAME} (#{targetShift.STAFF_CODE})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-bold">Role:</span>
                    <span className="font-extrabold text-slate-700">{targetShift.STAFF_ROLE}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-bold">Earnings:</span>
                    <span className="font-black text-emerald-700">
                      ₱{(Number(targetShift.TOTAL_SHIFT_EARNING) || 0).toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Manager Code Input */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
                    Manager Staff Code (PIN) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="password"
                      required
                      autoFocus
                      disabled={isDeleting}
                      value={managerCode}
                      onChange={(e) => {
                        setManagerCode(e.target.value)
                        if (authError) setAuthError(null)
                      }}
                      placeholder="Enter 4-digit Manager code"
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 focus:border-[#14274E] focus:ring-2 focus:ring-[#14274E]/10 outline-none transition-all bg-white font-mono font-black"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 font-semibold">
                    Only staff codes assigned with the Manager role can authorize registry deletion.
                  </p>
                </div>

                {/* Error Message */}
                {authError && (
                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold animate-shake">
                    {authError}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 border-t border-slate-100 bg-slate-50">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setTargetShift(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isDeleting || !managerCode.trim()}
                  className="px-4 py-2 rounded-xl text-xs font-black text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Registry</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
