import { useState, useEffect, useCallback } from 'react'
import {
  KeyRound,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Terminal,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import type {
  StaffCodeItem,
  StaffCodeFormData,
  StaffCodeFilterParams,
  StaffCodeSummaryStats,
  StaffAccount,
} from '@/types/account'
import {
  fetchStaffCodes,
  createStaffCode,
  updateStaffCode,
  toggleStaffCodeStatus,
  deleteStaffCode,
  getPrimaryStaffAccount,
  getActiveStaffSession,
  setActiveStaffSession,
} from '@/services/staffCodeService'
import { AccountManagerSummaryCards } from './components/AccountManagerSummaryCards'
import { AccountManagerFilterBar } from './components/AccountManagerFilterBar'
import { StaffAccountsTable } from './components/StaffAccountsTable'
import { StaffDrawer, type DrawerMode } from './components/StaffDrawer'
import { AccountPagination } from './components/AccountPagination'
import { AccountActionConfirmModal } from './components/AccountActionConfirmModal'

export default function AccountManagerPage() {
  const { user } = useAuth()

  // ── Primary Account State ──
  const [primaryAccount, setPrimaryAccount] = useState<StaffAccount | null>(null)

  // ── Staff Codes State ──
  const [codes, setCodes] = useState<StaffCodeItem[]>([])
  const [activeSession, setActiveSession] = useState<StaffCodeItem | null>(null)
  const [stats, setStats] = useState<StaffCodeSummaryStats>({
    totalCodes: 0,
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

  // ── Filter State ──
  const [filters, setFilters] = useState<StaffCodeFilterParams>({
    searchQuery: '',
    role: 'ALL',
    status: 'ALL',
    sortBy: 'codeId',
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
  const [drawerMode, setDrawerMode] = useState<DrawerMode>('create')
  const [selectedCode, setSelectedCode] = useState<StaffCodeItem | null>(null)

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

  // ── Load Primary Account & Staff Codes ──
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      // Load primary single staff account
      const primary = await getPrimaryStaffAccount()
      setPrimaryAccount(primary)

      // Active staff session
      const currentStaff = getActiveStaffSession()
      setActiveSession(currentStaff)

      // Load staff codes
      const result = await fetchStaffCodes(filters, currentPage, pageSize)
      setCodes(result.codes)
      setStats(result.summaryStats)
      setTotalCount(result.totalCount)
      setTotalPages(result.totalPages)
    } catch (err: unknown) {
      console.error('[AccountManager] Failed to load data:', err)
      showToast('Failed to load staff codes. Please refresh.', 'error')
    } finally {
      setLoading(false)
    }
  }, [filters, currentPage, pageSize, showToast])

  useEffect(() => {
    loadData()
  }, [loadData])

  // ── Filter Handlers ──
  const handleFilterChange = (newFilters: Partial<StaffCodeFilterParams>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }))
    setCurrentPage(1)
  }

  const handleClearFilters = () => {
    setFilters({
      searchQuery: '',
      role: 'ALL',
      status: 'ALL',
      sortBy: 'codeId',
      sortOrder: 'asc',
    })
    setCurrentPage(1)
  }

  // ── Drawer Openers ──
  const handleAddCode = () => {
    setSelectedCode(null)
    setDrawerMode('create')
    setIsDrawerOpen(true)
  }

  const handleEditCode = (item: StaffCodeItem) => {
    setSelectedCode(item)
    setDrawerMode('edit')
    setIsDrawerOpen(true)
  }

  // ── Save Code (Create or Edit) ──
  const handleSaveCode = async (data: StaffCodeFormData, originalCodeId?: number) => {
    if (drawerMode === 'create') {
      const created = await createStaffCode(data)
      showToast(`Staff code #${created.codeId} (${created.staffName}) created successfully.`)
    } else if (originalCodeId) {
      const updated = await updateStaffCode(originalCodeId, data)
      showToast(`Staff code #${updated.codeId} (${updated.staffName}) updated successfully.`)
    }
    await loadData()
  }

  // ── Quick Toggle Status ──
  const handleToggleStatus = (item: StaffCodeItem) => {
    const isActivating = item.status !== 'ACTIVE'
    setConfirmModal({
      isOpen: true,
      title: isActivating ? 'Activate Staff Code' : 'Deactivate Staff Code',
      description: isActivating
        ? `Are you sure you want to enable Staff Code #${item.codeId} for ${item.staffName}? They will be able to sign in and record actions on the POS terminal.`
        : `Are you sure you want to disable Staff Code #${item.codeId} for ${item.staffName}? They will not be able to authenticate or perform POS actions until reactivated.`,
      isDestructive: !isActivating,
      confirmText: isActivating ? 'Activate Code' : 'Deactivate Code',
      action: async () => {
        setConfirmLoading(true)
        try {
          await toggleStaffCodeStatus(item.codeId, item.status)
          showToast(
            `Staff code #${item.codeId} ${isActivating ? 'activated' : 'deactivated'}.`,
            'info',
          )
          await loadData()
        } catch (err: unknown) {
          console.error('[AccountManager] Toggle status failed:', err)
          showToast('Failed to update staff code status.', 'error')
        } finally {
          setConfirmLoading(false)
          setConfirmModal((prev) => ({ ...prev, isOpen: false }))
        }
      },
    })
  }

  // ── Delete Staff Code ──
  const handleDeleteCode = (item: StaffCodeItem) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Staff Code',
      description: `Are you sure you want to permanently delete Staff Code #${item.codeId} (${item.staffName})? This action cannot be undone.`,
      isDestructive: true,
      confirmText: 'Delete Code',
      action: async () => {
        setConfirmLoading(true)
        try {
          await deleteStaffCode(item.codeId)
          showToast(`Staff code #${item.codeId} deleted successfully.`, 'info')
          await loadData()
        } catch (err: unknown) {
          console.error('[AccountManager] Delete code failed:', err)
          showToast('Failed to delete staff code.', 'error')
        } finally {
          setConfirmLoading(false)
          setConfirmModal((prev) => ({ ...prev, isOpen: false }))
        }
      },
    })
  }

  // ── Select Current Terminal Session ──
  const handleSelectSession = (item: StaffCodeItem) => {
    setActiveStaffSession(item)
    setActiveSession(item)
    showToast(`Active terminal staff set to #${item.codeId} - ${item.staffName}`, 'info')
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 bg-slate-50/50 min-h-screen">
      {/* ── Toast Notification Banner ── */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl shadow-xl border text-xs font-bold animate-in slide-in-from-top duration-200 ${
            toast.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : toast.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : 'bg-blue-50 border-blue-200 text-blue-800'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* ── Header Title & Refresh ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-[#14274E] text-[#E9C46A] flex items-center justify-center font-bold shadow-xs">
              <KeyRound className="w-4 h-4" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-[#14274E] tracking-tight">
              Staff Codes & Roles Management
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Manage staff codes, assigned roles, and terminal status used for operational logging throughout the system.
          </p>
        </div>

        <button
          type="button"
          onClick={() => loadData()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-600 transition-all shadow-2xs self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#14274E]' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* ── Single Primary Store Account Banner ── */}
      <div className="rounded-2xl border border-blue-200/80 bg-gradient-to-r from-blue-50/90 via-indigo-50/50 to-white p-4.5 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-[#14274E] text-white flex items-center justify-center font-black text-sm shrink-0 shadow-xs">
              <Terminal className="w-5 h-5 text-[#E9C46A]" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#14274E] text-[#E9C46A]">
                  Primary Terminal Account
                </span>
                <span className="text-xs font-black text-[#14274E]">
                  {primaryAccount?.fullName || user?.email || 'Vincent Administrator'}
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  ({primaryAccount?.email || user?.email || 'taponakawnt123@gmail.com'})
                </span>
              </div>
              <p className="text-[11px] text-slate-600 mt-1 max-w-2xl leading-relaxed">
                This POS operates on a single authenticated store account. All floor, cashier, and kitchen operations are authorized and logged via individual <strong>Staff Codes</strong> below.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-start md:self-auto">
            <div className="px-3 py-1.5 rounded-xl bg-white border border-slate-200/80 text-[11px] font-bold text-slate-700 flex items-center gap-2 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Auth Status: <strong>Single Account Active</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Summary Cards ── */}
      <AccountManagerSummaryCards stats={stats} loading={loading} />

      {/* ── Filter Bar ── */}
      <AccountManagerFilterBar
        filters={filters}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
        onAddCode={handleAddCode}
      />

      {/* ── Staff Codes Table ── */}
      <StaffAccountsTable
        codes={codes}
        loading={loading}
        activeSessionCodeId={activeSession?.codeId}
        onEditCode={handleEditCode}
        onToggleStatus={handleToggleStatus}
        onDeleteCode={handleDeleteCode}
        onSelectForSession={handleSelectSession}
      />

      {/* ── Pagination ── */}
      {!loading && totalCount > pageSize && (
        <AccountPagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalCount={totalCount}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize)
            setCurrentPage(1)
          }}
        />
      )}

      {/* ── Add / Edit Staff Code Drawer ── */}
      <StaffDrawer
        isOpen={isDrawerOpen}
        mode={drawerMode}
        codeItem={selectedCode}
        onClose={() => setIsDrawerOpen(false)}
        onSave={handleSaveCode}
      />

      {/* ── Confirmation Modal ── */}
      <AccountActionConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        description={confirmModal.description}
        isDestructive={confirmModal.isDestructive}
        confirmText={confirmModal.confirmText}
        loading={confirmLoading}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.action}
      />
    </div>
  )
}
