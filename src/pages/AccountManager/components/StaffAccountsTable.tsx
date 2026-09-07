import React, { useState, useRef, useEffect } from 'react'
import {
  MoreVertical,
  Eye,
  Edit2,
  ShieldAlert,
  KeyRound,
  AlertTriangle,
  UserCheck,
  UserX,
  Clock,
  Mail,
  Phone,
} from 'lucide-react'
import type { StaffAccount, StaffRole } from '@/types/account'
import { ROLE_DEFINITIONS } from '@/types/account'

interface StaffAccountsTableProps {
  accounts: StaffAccount[]
  loading?: boolean
  currentAdminEmail?: string
  onViewDetails: (account: StaffAccount) => void
  onEditAccount: (account: StaffAccount) => void
  onChangeRole: (account: StaffAccount) => void
  onToggleStatus: (account: StaffAccount) => void
  onSendPasswordReset: (account: StaffAccount) => void
}

export const StaffAccountsTable: React.FC<StaffAccountsTableProps> = ({
  accounts,
  loading = false,
  currentAdminEmail,
  onViewDetails,
  onEditAccount,
  onChangeRole,
  onToggleStatus,
  onSendPasswordReset,
}) => {
  const [openMenuId, setOpenMenuId] = useState<number | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null)
      }
    }
    if (openMenuId !== null) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [openMenuId])

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso)
      if (isNaN(d.getTime())) return iso
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    } catch {
      return iso
    }
  }

  const formatLastActive = (iso?: string | null) => {
    if (!iso) return 'Never logged in'
    try {
      const d = new Date(iso)
      if (isNaN(d.getTime())) return 'Never'
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    } catch {
      return 'Never'
    }
  }

  const getInitials = (name: string) => {
    const parts = name.trim().split(' ')
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
    }
    return name.slice(0, 2).toUpperCase()
  }

  const renderRoleBadge = (role: StaffRole) => {
    const meta = ROLE_DEFINITIONS[role] || ROLE_DEFINITIONS.STAFF
    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-black border ${meta.badgeBg} ${meta.badgeText} ${meta.badgeBorder}`}
      >
        {meta.label}
      </span>
    )
  }

  const renderStatusBadge = (status: StaffAccount['status']) => {
    if (status === 'ACTIVE') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200/80">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span>Active</span>
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-rose-50 text-rose-700 border border-rose-200/80">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
        <span>Inactive</span>
      </span>
    )
  }

  if (loading) {
    return (
      <div className="p-12 text-center bg-white rounded-2xl border border-slate-200/80 space-y-3">
        <div className="w-8 h-8 rounded-full border-3 border-[#14274E] border-t-transparent animate-spin mx-auto" />
        <p className="text-xs font-bold text-slate-500">Loading staff accounts...</p>
      </div>
    )
  }

  if (accounts.length === 0) {
    return (
      <div className="p-12 text-center bg-white rounded-2xl border border-slate-200/80 space-y-2">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-black text-slate-700">No staff accounts found</h3>
        <p className="text-xs text-slate-400 max-w-sm mx-auto">
          No accounts match your filter criteria or no accounts have been added yet.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* ── Desktop Table (md and up) ── */}
      <div className="hidden md:block rounded-2xl bg-white border border-slate-200/80 shadow-2xs overflow-visible">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-black text-slate-400 uppercase tracking-wider">
              <th className="py-3 px-4">Staff Member</th>
              <th className="py-3 px-4">Contact</th>
              <th className="py-3 px-4">Role</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Created</th>
              <th className="py-3 px-4">Last Login</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
            {accounts.map((acc) => {
              const isCurrentAdmin =
                Boolean(currentAdminEmail) &&
                acc.email.toLowerCase() === currentAdminEmail?.toLowerCase()

              return (
                <tr
                  key={acc.accountId}
                  className="hover:bg-slate-50/70 transition-colors group"
                >
                  {/* Name & Avatar */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center font-black text-xs text-[#14274E] shrink-0 shadow-2xs">
                        {getInitials(acc.fullName)}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold text-slate-900 text-xs">
                            {acc.fullName}
                          </span>
                          {isCurrentAdmin && (
                            <span className="text-[10px] font-extrabold text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.2 rounded-full">
                              You
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400 block font-normal">
                          ID: #{acc.accountId}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Contact */}
                  <td className="py-3 px-4">
                    <div className="space-y-0.5 text-[11px]">
                      <div className="flex items-center gap-1 text-slate-600">
                        <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate max-w-[160px]">{acc.email}</span>
                      </div>
                      {acc.phone && (
                        <div className="flex items-center gap-1 text-slate-400">
                          <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{acc.phone}</span>
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Role */}
                  <td className="py-3 px-4">{renderRoleBadge(acc.role)}</td>

                  {/* Status */}
                  <td className="py-3 px-4">{renderStatusBadge(acc.status)}</td>

                  {/* Created Date */}
                  <td className="py-3 px-4 text-slate-500 text-[11px]">
                    {formatDate(acc.createdAt)}
                  </td>

                  {/* Last Login */}
                  <td className="py-3 px-4 text-slate-500 text-[11px]">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                      <span>{formatLastActive(acc.lastLogin)}</span>
                    </div>
                  </td>

                  {/* Actions Dropdown */}
                  <td className="py-3 px-4 text-right relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setOpenMenuId(openMenuId === acc.accountId ? null : acc.accountId)
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                      aria-label="Open staff action menu"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {openMenuId === acc.accountId && (
                      <div
                        ref={menuRef}
                        className="absolute right-4 top-10 z-50 w-48 bg-white rounded-xl shadow-xl border border-slate-200/90 py-1.5 text-left text-xs font-semibold animate-in fade-in zoom-in-95 duration-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => {
                            setOpenMenuId(null)
                            onViewDetails(acc)
                          }}
                          className="w-full px-3.5 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-400" />
                          <span>View Details</span>
                        </button>

                        <button
                          onClick={() => {
                            setOpenMenuId(null)
                            onEditAccount(acc)
                          }}
                          className="w-full px-3.5 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                          <span>Edit Account</span>
                        </button>

                        <button
                          onClick={() => {
                            setOpenMenuId(null)
                            onChangeRole(acc)
                          }}
                          className="w-full px-3.5 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors cursor-pointer"
                        >
                          <ShieldAlert className="w-3.5 h-3.5 text-slate-400" />
                          <span>Change Role</span>
                        </button>

                        <button
                          onClick={() => {
                            setOpenMenuId(null)
                            onSendPasswordReset(acc)
                          }}
                          className="w-full px-3.5 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors cursor-pointer"
                        >
                          <KeyRound className="w-3.5 h-3.5 text-amber-500" />
                          <span>Send Password Reset</span>
                        </button>

                        <div className="my-1 border-t border-slate-100" />

                        <button
                          onClick={() => {
                            setOpenMenuId(null)
                            onToggleStatus(acc)
                          }}
                          className={`w-full px-3.5 py-2 flex items-center gap-2 transition-colors cursor-pointer ${
                            acc.status === 'ACTIVE'
                              ? 'text-rose-600 hover:bg-rose-50'
                              : 'text-emerald-600 hover:bg-emerald-50'
                          }`}
                        >
                          {acc.status === 'ACTIVE' ? (
                            <>
                              <UserX className="w-3.5 h-3.5 text-rose-500" />
                              <span>Deactivate Account</span>
                            </>
                          ) : (
                            <>
                              <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
                              <span>Activate Account</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ── Mobile Responsive Cards (visible below md) ── */}
      <div className="block md:hidden space-y-3">
        {accounts.map((acc) => {
          const isCurrentAdmin =
            Boolean(currentAdminEmail) &&
            acc.email.toLowerCase() === currentAdminEmail?.toLowerCase()

          return (
            <div
              key={acc.accountId}
              className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center font-black text-xs text-[#14274E]">
                    {getInitials(acc.fullName)}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-extrabold text-slate-900 text-sm">
                        {acc.fullName}
                      </span>
                      {isCurrentAdmin && (
                        <span className="text-[10px] font-extrabold text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.2 rounded-full">
                          You
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-500 block truncate max-w-[200px]">
                      {acc.email}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1">
                  {renderRoleBadge(acc.role)}
                  {renderStatusBadge(acc.status)}
                </div>
              </div>

              {/* Meta row */}
              <div className="text-[11px] text-slate-400 flex items-center justify-between pt-2 border-t border-slate-100">
                <span>Created {formatDate(acc.createdAt)}</span>
                <span>Active: {formatLastActive(acc.lastLogin)}</span>
              </div>

              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={() => onViewDetails(acc)}
                  className="py-1.5 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-700 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5 text-slate-500" />
                  <span>Details</span>
                </button>
                <button
                  onClick={() => onEditAccount(acc)}
                  className="py-1.5 px-3 rounded-xl bg-[#14274E] text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
