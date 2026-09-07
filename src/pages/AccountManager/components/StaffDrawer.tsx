import React, { useState, useEffect } from 'react'
import {
  X,
  Save,
  AlertCircle,
  Mail,
  Phone,
  Calendar,
  Clock,
  User,
  Check,
  KeyRound,
} from 'lucide-react'
import type {
  StaffAccount,
  StaffAccountFormData,
  StaffRole,
  StaffStatus,
  StaffPermission,
} from '@/types/account'
import {
  ROLE_DEFINITIONS,
  PERMISSION_DEFINITIONS,
} from '@/types/account'

export type DrawerMode = 'view' | 'create' | 'edit'

interface StaffDrawerProps {
  isOpen: boolean
  mode: DrawerMode
  account: StaffAccount | null
  currentAdminEmail?: string
  totalActiveAdmins: number
  onClose: () => void
  onSave: (data: StaffAccountFormData, accountId?: number) => Promise<void>
  onSendPasswordReset?: (account: StaffAccount) => void
  onToggleStatus?: (account: StaffAccount) => void
}

export const StaffDrawer: React.FC<StaffDrawerProps> = ({
  isOpen,
  mode,
  account,
  currentAdminEmail,
  totalActiveAdmins,
  onClose,
  onSave,
  onSendPasswordReset,
}) => {
  // Form State
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<StaffRole>('STAFF')
  const [status, setStatus] = useState<StaffStatus>('ACTIVE')
  const [permissions, setPermissions] = useState<StaffPermission[]>([])
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [sendInviteEmail, setSendInviteEmail] = useState(true)

  // UI state
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // ESC key listener
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  // Populate form on account change or mode switch
  useEffect(() => {
    if (!isOpen) return

    setFormError(null)

    if (mode === 'create') {
      setFullName('')
      setEmail('')
      setRole('STAFF')
      setStatus('ACTIVE')
      setPermissions(ROLE_DEFINITIONS.STAFF.defaultPermissions)
      setPhone('')
      setNotes('')
      setSendInviteEmail(true)
    } else if (account) {
      setFullName(account.fullName)
      setEmail(account.email)
      setRole(account.role)
      setStatus(account.status)
      setPermissions(account.permissions)
      setPhone(account.phone || '')
      setNotes(account.notes || '')
    }
  }, [isOpen, mode, account])

  // When role changes in create mode, auto-suggest default permissions
  const handleRoleChange = (newRole: StaffRole) => {
    setRole(newRole)
    if (mode === 'create') {
      setPermissions(ROLE_DEFINITIONS[newRole].defaultPermissions)
    }
  }

  const togglePermission = (perm: StaffPermission) => {
    if (permissions.includes(perm)) {
      setPermissions(permissions.filter((p) => p !== perm))
    } else {
      setPermissions([...permissions, perm])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!fullName.trim()) {
      setFormError('Full name is required.')
      return
    }
    if (!email.trim() || !email.includes('@')) {
      setFormError('Please enter a valid email address.')
      return
    }

    setSubmitting(true)
    try {
      await onSave(
        {
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          role,
          status,
          permissions,
          phone: phone.trim() || undefined,
          notes: notes.trim() || undefined,
          sendInviteEmail: mode === 'create' ? sendInviteEmail : false,
        },
        account?.accountId,
      )
      onClose()
    } catch (err: unknown) {
      setFormError((err as { message?: string })?.message || 'Failed to save staff account.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen) return null

  const isSelf =
    Boolean(account && currentAdminEmail) &&
    account?.email.toLowerCase() === currentAdminEmail?.toLowerCase()

  const isLastAdmin = account?.role === 'ADMIN' && totalActiveAdmins <= 1

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 w-full max-w-xl bg-white shadow-2xl flex flex-col z-50 animate-in slide-in-from-right duration-250 border-l border-slate-200">
        {/* ── Drawer Header ── */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/75 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#14274E] text-[#E9C46A] flex items-center justify-center font-black text-sm shadow-xs">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-[#14274E]">
                {mode === 'create'
                  ? 'Add Staff Account'
                  : mode === 'edit'
                    ? `Edit: ${account?.fullName}`
                    : account?.fullName}
              </h2>
              <p className="text-xs text-slate-400">
                {mode === 'create'
                  ? 'Create a new staff user profile & configure access.'
                  : mode === 'edit'
                    ? 'Update profile details, permissions, or system role.'
                    : `Staff ID #${account?.accountId} · ${ROLE_DEFINITIONS[account?.role || 'STAFF'].label}`}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
            aria-label="Close drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Drawer Content ── */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          {/* ════ VIEW MODE ════ */}
          {mode === 'view' && account && (
            <div className="space-y-5">
              {/* Profile Card */}
              <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                      Assigned Role
                    </span>
                    <span className="text-base font-black text-[#14274E]">
                      {ROLE_DEFINITIONS[account.role].label}
                    </span>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black ${
                      account.status === 'ACTIVE'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        account.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-rose-500'
                      }`}
                    />
                    <span>{account.status}</span>
                  </span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {ROLE_DEFINITIONS[account.role].description}
                </p>
              </div>

              {/* Contact Information */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200/80 space-y-2.5">
                <h4 className="text-xs font-black uppercase tracking-wider text-[#14274E]">
                  Contact & Identification
                </h4>
                <div className="space-y-2 text-xs text-slate-600">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <Mail className="w-3.5 h-3.5" />
                      <span>Email</span>
                    </span>
                    <span className="font-bold text-slate-800">{account.email}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <Phone className="w-3.5 h-3.5" />
                      <span>Phone</span>
                    </span>
                    <span className="font-bold text-slate-800">{account.phone || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Created</span>
                    </span>
                    <span className="font-bold text-slate-800">
                      {new Date(account.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Last Login</span>
                    </span>
                    <span className="font-bold text-slate-800">
                      {account.lastLogin
                        ? new Date(account.lastLogin).toLocaleString('en-US')
                        : 'Never logged in'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Permissions Checklist */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-[#14274E]">
                    Assigned Permissions
                  </h4>
                  <span className="text-[11px] font-bold text-slate-400">
                    {account.permissions.length} active
                  </span>
                </div>

                <div className="space-y-2">
                  {Object.values(PERMISSION_DEFINITIONS).map((p) => {
                    const hasPerm = account.permissions.includes(p.key)
                    return (
                      <div
                        key={p.key}
                        className={`p-2.5 rounded-xl border flex items-start gap-2.5 text-xs transition-colors ${
                          hasPerm
                            ? 'bg-emerald-50/50 border-emerald-200/80 text-emerald-900'
                            : 'bg-slate-50/50 border-slate-200/60 text-slate-400 opacity-60'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${
                            hasPerm ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'
                          }`}
                        >
                          <Check className="w-3 h-3" />
                        </div>
                        <div>
                          <p className="font-bold">{p.label}</p>
                          <p className="text-[11px] text-slate-500 font-normal">
                            {p.description}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Notes */}
              {account.notes && (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs space-y-1">
                  <span className="font-black text-slate-400 uppercase tracking-wider text-[10px]">
                    Internal Staff Notes
                  </span>
                  <p className="text-slate-700">{account.notes}</p>
                </div>
              )}
            </div>
          )}

          {/* ════ CREATE & EDIT FORMS ════ */}
          {(mode === 'create' || mode === 'edit') && (
            <form id="staff-drawer-form" onSubmit={handleSubmit} className="space-y-4">
              {/* Full Name */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Full Name *</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Maria Santos"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#14274E]"
                />
              </div>

              {/* Email */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Email Address *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. staff@monolithpos.com"
                  disabled={mode === 'edit'}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#14274E] disabled:bg-slate-100 disabled:text-slate-500"
                />
                {mode === 'edit' && (
                  <p className="text-[10px] text-slate-400">
                    Primary login emails cannot be modified to protect active sessions.
                  </p>
                )}
              </div>

              {/* Phone */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Phone Number (Optional)</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+63 9XX XXX XXXX"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#14274E]"
                />
              </div>

              {/* Role Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>System Access Role *</span>
                  {isSelf && (
                    <span className="text-[10px] font-bold text-amber-600">
                      Cannot demote yourself
                    </span>
                  )}
                  {isLastAdmin && (
                    <span className="text-[10px] font-bold text-amber-600">
                      Last active admin
                    </span>
                  )}
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(Object.keys(ROLE_DEFINITIONS) as StaffRole[]).map((rKey) => {
                    const meta = ROLE_DEFINITIONS[rKey]
                    const isSelected = role === rKey
                    const disabled = (isSelf || isLastAdmin) && rKey !== 'ADMIN'

                    return (
                      <button
                        key={rKey}
                        type="button"
                        disabled={disabled}
                        onClick={() => handleRoleChange(rKey)}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'border-[#14274E] bg-slate-50 shadow-xs'
                            : 'border-slate-200 hover:bg-slate-50'
                        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-black text-xs text-slate-900">{meta.label}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-[#14274E]" />}
                        </div>
                        <p className="text-[10px] text-slate-400 line-clamp-2 mt-0.5">
                          {meta.description}
                        </p>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Status Selector (in edit mode) */}
              {mode === 'edit' && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Account Status</label>
                  <select
                    value={status}
                    disabled={isSelf || isLastAdmin}
                    onChange={(e) => setStatus(e.target.value as StaffStatus)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white focus:outline-none focus:border-[#14274E]"
                  >
                    <option value="ACTIVE">Active (Can log in & perform POS actions)</option>
                    <option value="INACTIVE">Inactive (Access blocked; historical data preserved)</option>
                    <option value="SUSPENDED">Suspended (Temporarily locked)</option>
                  </select>
                </div>
              )}

              {/* Permissions Checklist */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black uppercase tracking-wider text-[#14274E]">
                    Granular Access Permissions
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setPermissions(ROLE_DEFINITIONS[role].defaultPermissions)
                    }
                    className="text-[10px] font-bold text-[#14274E] hover:underline cursor-pointer"
                  >
                    Reset to Role Defaults
                  </button>
                </div>

                <div className="space-y-1.5">
                  {Object.values(PERMISSION_DEFINITIONS).map((p) => {
                    const checked = permissions.includes(p.key)
                    return (
                      <label
                        key={p.key}
                        className={`p-2.5 rounded-xl border flex items-start gap-2.5 text-xs cursor-pointer select-none transition-colors ${
                          checked
                            ? 'bg-indigo-50/40 border-indigo-200 text-slate-900'
                            : 'bg-white border-slate-200/80 text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => togglePermission(p.key)}
                          className="mt-0.5 rounded border-slate-300 text-[#14274E] focus:ring-0 cursor-pointer"
                        />
                        <div>
                          <p className="font-bold text-slate-800">{p.label}</p>
                          <p className="text-[10px] text-slate-400">{p.description}</p>
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Internal Notes</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional internal administrative notes..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#14274E]"
                />
              </div>

              {/* Send Invite Email (Create mode) */}
              {mode === 'create' && (
                <label className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center gap-2.5 text-xs cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={sendInviteEmail}
                    onChange={(e) => setSendInviteEmail(e.target.checked)}
                    className="rounded border-slate-300 text-[#14274E] focus:ring-0 cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-slate-800">
                      Send password setup email invitation
                    </span>
                    <p className="text-[10px] text-slate-400">
                      Dispatches a secure Supabase password reset link for the user to set their password.
                    </p>
                  </div>
                </label>
              )}
            </form>
          )}
        </div>

        {/* ── Drawer Footer Actions ── */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/75 flex items-center justify-between gap-3 shrink-0">
          {mode === 'view' ? (
            <div className="w-full flex items-center justify-between">
              {onSendPasswordReset && account && (
                <button
                  onClick={() => onSendPasswordReset(account)}
                  className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-white text-xs font-bold text-slate-700 flex items-center gap-1.5 cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5 text-amber-500" />
                  <span>Send Password Reset</span>
                </button>
              )}
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-[#14274E] text-white text-xs font-black hover:bg-[#1a3468] transition-colors cursor-pointer ml-auto"
              >
                Done
              </button>
            </div>
          ) : (
            <div className="w-full flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-white text-xs font-bold text-slate-600 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="staff-drawer-form"
                disabled={submitting}
                className="px-5 py-2 rounded-xl bg-[#14274E] hover:bg-[#1a3468] disabled:opacity-50 text-white text-xs font-black flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
              >
                {submitting ? (
                  <>
                    <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>{mode === 'create' ? 'Create Account' : 'Save Changes'}</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
