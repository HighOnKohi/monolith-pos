import React, { useState, useEffect, useCallback } from 'react'
import { Users, RefreshCw, CheckCircle2, AlertCircle, Info } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import type {
  StaffAccount,
  StaffAccountFormData,
  AccountFilterParams,
  AccountSummaryStats,
} from '@/types/account'
import {
  fetchStaffAccounts,
  createStaffAccount,
  updateStaffAccount,
  toggleStaffStatus,
  sendStaffPasswordReset,
} from '@/services/staffAccountService'
import { AccountManagerSummaryCards } from './components/AccountManagerSummaryCards'
import { AccountManagerFilterBar } from './components/AccountManagerFilterBar'
import { StaffAccountsTable } from './components/StaffAccountsTable'
import { StaffDrawer, type DrawerMode } from './components/StaffDrawer'
import { AccountPagination } from './components/AccountPagination'
import { AccountActionConfirmModal } from './components/AccountActionConfirmModal'

export default function AccountManagerPage() {
  const { user } = useAuth()
  const currentAdminEmail = user?.email || undefined

  // ── Data State ──
  const [accounts, setAccounts] = useState<StaffAccount[]>([])
  const [stats, setStats] = useState<AccountSummaryStats>({
    totalStaff: 0,
    activeCount: 0,
    inactiveCount: 0,
    adminCount: 0,
    managerCount: 0,
    cashierCount: 0,
    kitchenCount: 0,
    floorStaffCount: 0,
  })
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [loading, setLoading] = useState(true)
  const [isUsingFallback, setIsUsingFallback] = useState(false)

  // ── Filter State ──
  const [filters, setFilters] = useState<AccountFilterParams>({
    searchQuery: '',
    role: 'ALL',
    status: 'ALL',
    sortBy: 'fullName',
    sortOrder: 'asc',
  })

  // ── Toast Notification State ──
  const [toast, setToast] = useState<{
    message: string
    type: 'success' | 'error' | 'info'
  } | null>(null)

  const showToast = useCallback(
    (message: string, type: 'success' | 'error' | 'info' = 'success') => {
      setToast({ message, type })
      setTimeout(() => {
        setToast((curr) => (curr?.message === message ? null : curr))
      }, 4000)
    },
    [],
  )

  // ── Drawer State ──
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [drawerMode, setDrawerMode] = useState<DrawerMode>('view')
  const [selectedAccount, setSelectedAccount] = useState<StaffAccount | null>(null)

  // ── Confirmation Modal State ──
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean
    title: string
    description: string
    isDestructive: boolean
    confirmText?: string
    action: () => Promise<void>
  }>({
    isOpen: false,
    title: '',
    description: '',
    isDestructive: false,
    action: async () => {},
  })
  const [confirmLoading, setConfirmLoading] = useState(false)

  // ── Load Staff Accounts ──
  const loadAccounts = useCallback(async () => {
    setLoading(true)
    try {
      const result = await fetchStaffAccounts(filters, currentPage, pageSize)
      setAccounts(result.accounts)
      setStats(result.summaryStats)
      setTotalCount(result.totalCount)
      setTotalPages(result.totalPages)
      setIsUsingFallback(result.isUsingFallback)
    } catch (err: unknown) {
      console.error('[AccountManager] Failed to load accounts:', err)
      showToast('Failed to load accounts. Please refresh.', 'error')
    } finally {
      setLoading(false)
    }
  }, [filters, currentPage, pageSize, showToast])

  useEffect(() => {
    loadAccounts()
  }, [loadAccounts])

  // ── Filter Handlers ──
  const handleFilterChange = (newFilters: Partial<AccountFilterParams>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }))
    setCurrentPage(1)
  }

  const handleClearFilters = () => {
    setFilters({
      searchQuery: '',
      role: 'ALL',
      status: 'ALL',
      sortBy: 'fullName',
      sortOrder: 'asc',
    })
    setCurrentPage(1)
  }

  // ── Drawer Openers ──
  const handleAddAccount = () => {
    setSelectedAccount(null)
    setDrawerMode('create')
    setIsDrawerOpen(true)
  }

  const handleViewDetails = (account: StaffAccount) => {
    setSelectedAccount(account)
    setDrawerMode('view')
    setIsDrawerOpen(true)
  }

  const handleEditAccount = (account: StaffAccount) => {
    setSelectedAccount(account)
    setDrawerMode('edit')
    setIsDrawerOpen(true)
  }

  const handleChangeRole = (account: StaffAccount) => {
    setSelectedAccount(account)
    setDrawerMode('edit')
    setIsDrawerOpen(true)
  }

  // ── Drawer Save Action ──
  const handleDrawerSave = async (
    formData: StaffAccountFormData,
    accountId?: number,
  ) => {
    if (drawerMode === 'create') {
      const { account, inviteSent } = await createStaffAccount(formData)
      showToast(
        `Staff account "${account.fullName}" created successfully!${
          inviteSent ? ' Invitation email dispatched.' : ''
        }`,
        'success',
      )
    } else if (accountId) {
      const updated = await updateStaffAccount(accountId, formData, currentAdminEmail)
      showToast(`Account "${updated.fullName}" updated successfully!`, 'success')
    }
    loadAccounts()
  }

  // ── Toggle Status Handler ──
  const handleToggleStatus = (account: StaffAccount) => {
    if (account.status === 'ACTIVE') {
      // Deactivation confirmation
      setConfirmModal({
        isOpen: true,
        title: `Deactivate ${account.fullName}?`,
        description: `Are you sure you want to deactivate ${account.fullName}'s account (${account.email})? This staff member will immediately lose access to the POS. Historical orders, payments, and audit log activities associated with this account will remain intact.`,
        isDestructive: true,
        confirmText: 'Deactivate Account',
        action: async () => {
          setConfirmLoading(true)
          try {
            await toggleStaffStatus(account.accountId, 'INACTIVE', currentAdminEmail)
            showToast(`Account "${account.fullName}" has been deactivated.`, 'info')
            setConfirmModal((prev) => ({ ...prev, isOpen: false }))
            loadAccounts()
          } catch (err: unknown) {
            showToast(
              (err as { message?: string })?.message || 'Failed to deactivate account.',
              'error',
            )
          } finally {
            setConfirmLoading(false)
          }
        },
      })
    } else {
      // Activation
      setConfirmModal({
        isOpen: true,
        title: `Activate ${account.fullName}?`,
        description: `Activate this account? ${account.fullName} will be permitted to log in and access the POS according to their assigned role and permissions.`,
        isDestructive: false,
        confirmText: 'Activate Account',
        action: async () => {
          setConfirmLoading(true)
          try {
            await toggleStaffStatus(account.accountId, 'ACTIVE', currentAdminEmail)
            showToast(`Account "${account.fullName}" has been activated.`, 'success')
            setConfirmModal((prev) => ({ ...prev, isOpen: false }))
            loadAccounts()
          } catch (err: unknown) {
            showToast(
              (err as { message?: string })?.message || 'Failed to activate account.',
              'error',
            )
          } finally {
            setConfirmLoading(false)
          }
        },
      })
    }
  }

  // ── Password Reset Handler ──
  const handleSendPasswordReset = (account: StaffAccount) => {
    setConfirmModal({
      isOpen: true,
      title: `Send Password Reset Email?`,
      description: `Send a secure password reset email to ${account.fullName} (${account.email})? They will receive an official link to create or update their POS password.`,
      isDestructive: false,
      confirmText: 'Send Reset Link',
      action: async () => {
        setConfirmLoading(true)
        try {
          await sendStaffPasswordReset(account.email)
          showToast(`Password reset link sent to ${account.email}.`, 'success')
          setConfirmModal((prev) => ({ ...prev, isOpen: false }))
        } catch (err: unknown) {
          showToast(
            (err as { message?: string })?.message || 'Failed to send password reset email.',
            'error',
          )
        } finally {
          setConfirmLoading(false)
        }
      },
    })
  }

  return (
    <div className="account-manager-page-container staff-page space-y-4 pb-12">
      {/* ── Toast Notification Banner ── */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2 duration-200">
          <div
            className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl border text-xs font-bold ${
              toast.type === 'success'
                ? 'bg-emerald-900 text-white border-emerald-700'
                : toast.type === 'error'
                  ? 'bg-rose-900 text-white border-rose-700'
                  : 'bg-[#14274E] text-white border-slate-700'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : toast.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            ) : (
              <Info className="w-4 h-4 text-blue-400 shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#14274E] text-[#E9C46A] flex items-center justify-center font-black shadow-xs">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-[#14274E] tracking-tight">
              Account Manager
            </h1>
            <p className="text-xs text-slate-400 font-medium">
              Manage staff accounts, roles, and access to the POS.
            </p>
          </div>
        </div>

        <button
          onClick={loadAccounts}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-xs font-bold text-slate-700 transition-colors cursor-pointer self-start sm:self-auto shrink-0"
          title="Refresh accounts"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* ── Optional Fallback Notice ── */}
      {isUsingFallback && (
        <div className="p-3 bg-blue-50/80 border border-blue-200/80 rounded-2xl flex items-start gap-2.5 text-xs text-blue-900">
          <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-black">Staff Accounts Storage Active</p>
            <p className="text-blue-800 text-[11px] leading-relaxed">
              Staff accounts are currently managed with local caching. Run{' '}
              <code className="px-1 py-0.5 bg-blue-100/80 rounded font-mono text-[10px]">
                Context/migrations/011_staff_accounts_and_roles.sql
              </code>{' '}
              in your Supabase SQL editor to enable multi-device synchronization.
            </p>
          </div>
        </div>
      )}

      {/* ── Summary KPI Cards ── */}
      <AccountManagerSummaryCards stats={stats} loading={loading} />

      {/* ── Search and Filters ── */}
      <AccountManagerFilterBar
        filters={filters}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
        onAddAccount={handleAddAccount}
      />

      {/* ── Staff Accounts Table / Mobile Cards ── */}
      <StaffAccountsTable
        accounts={accounts}
        loading={loading}
        currentAdminEmail={currentAdminEmail}
        onViewDetails={handleViewDetails}
        onEditAccount={handleEditAccount}
        onChangeRole={handleChangeRole}
        onToggleStatus={handleToggleStatus}
        onSendPasswordReset={handleSendPasswordReset}
      />

      {/* ── Pagination ── */}
      <AccountPagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalCount}
        pageSize={pageSize}
        onPageChange={(p) => setCurrentPage(p)}
        onPageSizeChange={(s) => {
          setPageSize(s)
          setCurrentPage(1)
        }}
      />

      {/* ── Staff Drawer (View, Create, Edit) ── */}
      <StaffDrawer
        isOpen={isDrawerOpen}
        mode={drawerMode}
        account={selectedAccount}
        currentAdminEmail={currentAdminEmail}
        totalActiveAdmins={stats.adminCount}
        onClose={() => setIsDrawerOpen(false)}
        onSave={handleDrawerSave}
        onSendPasswordReset={handleSendPasswordReset}
        onToggleStatus={handleToggleStatus}
      />

      {/* ── Action Confirmation Modal ── */}
      <AccountActionConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        description={confirmModal.description}
        isDestructive={confirmModal.isDestructive}
        confirmText={confirmModal.confirmText}
        loading={confirmLoading}
        onConfirm={confirmModal.action}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  )
}
