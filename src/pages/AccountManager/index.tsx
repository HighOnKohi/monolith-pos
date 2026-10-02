import { useState, useEffect, useCallback } from 'react'
import {
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import type {
  StaffCodeItem,
  StaffCodeFormData,
  StaffCodeFilterParams,
  StaffCodeSummaryStats,
} from '@/types/account'
import {
  fetchStaffCodes,
  createStaffCode,
  updateStaffCode,
  toggleStaffCodeStatus,
  deleteStaffCode,
  endStaffShiftManually,
} from '@/services/staffCodeService'
import { AccountManagerSummaryCards } from './components/AccountManagerSummaryCards'
import { AccountManagerFilterBar } from './components/AccountManagerFilterBar'
import { StaffAccountsTable } from './components/StaffAccountsTable'
import { StaffDrawer, type DrawerMode } from './components/StaffDrawer'
import { AccountPagination } from './components/AccountPagination'
import { AccountActionConfirmModal } from './components/AccountActionConfirmModal'

export default function AccountManagerPage() {
  // ── Staff Codes State ──
  const [codes, setCodes] = useState<StaffCodeItem[]>([])
  const [summaryStats, setSummaryStats] = useState<StaffCodeSummaryStats>({
    totalCodes: 0,
    activeCount: 0,
    inactiveCount: 0,
    dispatcherCount: 0,
    serviceCount: 0,
    cashierCount: 0,
    ongoingShiftsCount: 0,
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
    shiftStatus: 'ALL',
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

  // ── Load Staff Codes ──
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const result = await fetchStaffCodes(filters, currentPage, pageSize)
      setCodes(result.codes)
      setSummaryStats(result.summaryStats)
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
      shiftStatus: 'ALL',
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

  // ── Manual End Shift ──
  const handleEndShift = (item: StaffCodeItem) => {
    setConfirmModal({
      isOpen: true,
      title: `End Shift for ${item.staffName}`,
      description: `Are you sure you want to conclude the active shift for Staff #${item.codeId} (${item.staffName})? This will record the shift end timestamp and log out their operational terminal session.`,
      isDestructive: true,
      confirmText: 'End Shift Now',
      action: async () => {
        setConfirmLoading(true)
        try {
          await endStaffShiftManually(item.codeId)
          showToast(`Shift for #${item.codeId} (${item.staffName}) has been ended.`, 'success')
          await loadData()
        } catch (err: unknown) {
          console.error('[AccountManager] End shift error:', err)
          showToast('Failed to end shift. Please try again.', 'error')
        } finally {
          setConfirmLoading(false)
          setConfirmModal((prev) => ({ ...prev, isOpen: false }))
        }
      },
    })
  }

  // ── Quick Toggle Status ──
  const handleToggleStatus = (item: StaffCodeItem) => {
    const isActivating = item.codeStatus !== 'ACTIVE'
    setConfirmModal({
      isOpen: true,
      title: isActivating ? 'Activate Staff Code' : 'Deactivate Staff Code',
      description: isActivating
        ? `Are you sure you want to enable Staff Code #${item.codeId} for ${item.staffName}? They will be able to sign in and record actions on their operational interface.`
        : `Are you sure you want to disable Staff Code #${item.codeId} for ${item.staffName}? They will not be able to authenticate until reactivated.`,
      isDestructive: !isActivating,
      confirmText: isActivating ? 'Activate Code' : 'Deactivate Code',
      action: async () => {
        setConfirmLoading(true)
        try {
          await toggleStaffCodeStatus(item.codeId, item.codeStatus)
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

      {/* ── KPI Summary Cards ── */}
      <AccountManagerSummaryCards stats={summaryStats} loading={loading} />

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
        onEditCode={handleEditCode}
        onToggleStatus={handleToggleStatus}
        onDeleteCode={handleDeleteCode}
        onEndShift={handleEndShift}
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
