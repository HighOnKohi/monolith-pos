import React, { useState } from 'react'
import {
  Edit2,
  KeyRound,
  Trash2,
  Copy,
  Check,
  ChefHat,
  Store,
  UtensilsCrossed,
  PowerOff,
  Clock,
  ShieldCheck,
} from 'lucide-react'
import type { StaffCodeItem, StaffRole } from '@/types/account'
import { ROLE_DEFINITIONS } from '@/types/account'

function formatShiftTime(isoString?: string | null): string {
  if (!isoString) return 'Active'
  try {
    const d = new Date(isoString)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return 'Active'
  }
}

interface StaffAccountsTableProps {
  codes: StaffCodeItem[]
  loading?: boolean
  onEditCode: (code: StaffCodeItem) => void
  onToggleStatus: (code: StaffCodeItem) => void
  onDeleteCode: (code: StaffCodeItem) => void
  onEndShift: (code: StaffCodeItem) => void
}

export const StaffAccountsTable: React.FC<StaffAccountsTableProps> = ({
  codes,
  loading = false,
  onEditCode,
  onToggleStatus,
  onDeleteCode,
  onEndShift,
}) => {
  const [copiedCodeId, setCopiedCodeId] = useState<number | null>(null)

  const handleCopyCode = (codeId: number) => {
    navigator.clipboard.writeText(String(codeId))
    setCopiedCodeId(codeId)
    setTimeout(() => setCopiedCodeId(null), 2000)
  }

  const getInitials = (name: string) => {
    const parts = name.trim().split(' ')
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
    }
    return name.slice(0, 2).toUpperCase()
  }

  const renderRoleBadge = (role: StaffRole) => {
    const meta = ROLE_DEFINITIONS[role] || ROLE_DEFINITIONS.DISPATCHER
    let RoleIcon = ChefHat
    if (role === 'SERVICE') RoleIcon = UtensilsCrossed
    if (role === 'CASHIER') RoleIcon = Store

    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black border ${meta.badgeBg} ${meta.badgeText} ${meta.badgeBorder}`}
      >
        <RoleIcon className="w-3.5 h-3.5 shrink-0" />
        <span>{meta.label}</span>
      </span>
    )
  }

  const renderCodeStatusBadge = (status: string) => {
    const isActive = status === 'ACTIVE'
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black border ${
          isActive
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
            : 'bg-slate-100 text-slate-600 border-slate-200'
        }`}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-400'}`}
        />
        <span>{isActive ? 'Active' : 'Inactive'}</span>
      </span>
    )
  }

  const renderShiftStatusBadge = (item: StaffCodeItem) => {
    const isOngoing = item.shiftStatus === 'ONGOING'
    if (isOngoing) {
      return (
        <div className="flex flex-col items-start gap-0.5">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black border bg-amber-50 text-amber-800 border-amber-300 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <span>Shift Ongoing</span>
          </span>
          {item.shiftStart && (
            <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1 ml-1">
              <Clock className="w-2.5 h-2.5" />
              Started {formatShiftTime(item.shiftStart)}
            </span>
          )}
        </div>
      )
    }

    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold text-slate-400 bg-slate-50 border border-slate-200">
        <span>Shift Ended</span>
      </span>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-black uppercase tracking-wider text-slate-400">
              <th className="py-3.5 px-4">Staff Member</th>
              <th className="py-3.5 px-4">Staff Code</th>
              <th className="py-3.5 px-4">Assigned Role</th>
              <th className="py-3.5 px-4">Code Status</th>
              <th className="py-3.5 px-4">Shift Status</th>
              <th className="py-3.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {/* Loading State */}
            {loading &&
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={`skel-${i}`} className="animate-pulse">
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-200" />
                      <div className="space-y-1.5">
                        <div className="h-3 w-32 bg-slate-200 rounded" />
                        <div className="h-2.5 w-20 bg-slate-100 rounded" />
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="h-4 w-16 bg-slate-200 rounded" />
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="h-5 w-20 bg-slate-200 rounded-full" />
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="h-5 w-16 bg-slate-200 rounded-full" />
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="h-5 w-20 bg-slate-200 rounded-full" />
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="h-7 w-7 bg-slate-200 rounded-lg ml-auto" />
                  </td>
                </tr>
              ))}

            {/* Empty State */}
            {!loading && codes.length === 0 && (
              <tr>
                <td colSpan={6} className="py-12 px-4 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-3">
                    <KeyRound className="h-6 w-6" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-700">No staff codes found</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    No staff codes match the current filter or search criteria.
                  </p>
                </td>
              </tr>
            )}

            {/* Data Rows */}
            {!loading &&
              codes.map((item) => {
                const isOngoing = item.shiftStatus === 'ONGOING'

                return (
                  <tr
                    key={item.codeId}
                    className={`hover:bg-slate-50/75 transition-colors group ${
                      isOngoing ? 'bg-amber-50/20' : ''
                    }`}
                  >
                    {/* 1. Staff Member */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#14274E] text-[#E9C46A] flex items-center justify-center font-black text-xs shrink-0 shadow-2xs">
                          {getInitials(item.staffName)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-extrabold text-[#14274E] truncate">
                              {item.staffName}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-400 font-medium">
                            POS Staff Account
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* 2. Staff Code */}
                    <td className="py-3.5 px-4">
                      <div className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200/80 px-2.5 py-1 rounded-xl transition-colors border border-slate-200/60">
                        <KeyRound className="w-3 h-3 text-[#14274E]" />
                        <span className="font-mono font-black text-xs text-[#14274E]">
                          #{item.codeId}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyCode(item.codeId)}
                          className="ml-1 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                          title="Copy Staff Code"
                        >
                          {copiedCodeId === item.codeId ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </td>

                    {/* 3. Assigned Role */}
                    <td className="py-3.5 px-4">{renderRoleBadge(item.staffRole)}</td>

                    {/* 4. Code Status */}
                    <td className="py-3.5 px-4">{renderCodeStatusBadge(item.codeStatus)}</td>

                    {/* 5. Shift Status */}
                    <td className="py-3.5 px-4">{renderShiftStatusBadge(item)}</td>

                    {/* 6. Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1 relative">
                        {/* Manual End Shift Button (Only if shift is ONGOING) */}
                        {isOngoing && (
                          <button
                            type="button"
                            onClick={() => onEndShift(item)}
                            className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-black transition-all flex items-center gap-1.5 shadow-2xs active:scale-95 cursor-pointer"
                            title={`Manually end ongoing shift for ${item.staffName}`}
                          >
                            <PowerOff className="w-3.5 h-3.5 text-rose-600" />
                            <span>End Shift</span>
                          </button>
                        )}

                        {/* Quick Edit */}
                        <button
                          type="button"
                          onClick={() => onEditCode(item)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-[#14274E] hover:bg-slate-100 transition-all cursor-pointer"
                          title="Edit Staff Code"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Quick Toggle Status */}
                        <button
                          type="button"
                          onClick={() => onToggleStatus(item)}
                          className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                            item.codeStatus === 'ACTIVE'
                              ? 'text-amber-600 hover:bg-amber-50'
                              : 'text-emerald-600 hover:bg-emerald-50'
                          }`}
                          title={
                            item.codeStatus === 'ACTIVE'
                              ? 'Deactivate Staff Code'
                              : 'Activate Staff Code'
                          }
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete Code */}
                        <button
                          type="button"
                          onClick={() => onDeleteCode(item)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                          title="Delete Staff Code"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
