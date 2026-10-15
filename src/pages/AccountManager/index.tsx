import { useState, useEffect, useCallback } from 'react'
import {
  Users,
  ShieldCheck,
} from 'lucide-react'
import { CashierAuditLogsTab } from '@/pages/OrderLogs/components/CashierAuditLogsTab'
import { StaffShiftSummaryModal } from './components/StaffShiftSummaryModal'
import type {
  StaffCodeItem,
  StaffCodeFormData,
  StaffCodeFilterParams,
  StaffCodeSummaryStats,
  StaffRole,
} from '@/types/account'
import {
  fetchStaffCodes,
  createStaffCode,
  createMultipleStaffCodes,
  updateStaffCode,
  toggleStaffCodeStatus,
  deleteStaffCode,
  endStaffShiftManually,
  endAllStaffShiftsManually,
} from '@/services/staffCodeService'
import {
  sanitizeTerminalSessions,
  subscribeToSessionEvents,
} from '@/services/terminalSessionService'
import { supabase } from '@/lib/supabase'
import { AccountManagerSummaryCards } from './components/AccountManagerSummaryCards'
import { AccountManagerFilterBar } from './components/AccountManagerFilterBar'
import { StaffAccountsTable } from './components/StaffAccountsTable'
import { StaffDrawer, type DrawerMode } from './components/StaffDrawer'
import { AccountActionConfirmModal } from './components/AccountActionConfirmModal'

export default function AccountManagerPage() {
  // ── Sub-Tab State ──
  const [activeSubTab, setActiveSubTab] = useState<'accounts' | 'audit'>('accounts')

  // ── Staff Codes State ──
  const [codes, setCodes] = useState<StaffCodeItem[]>([])
  const [summaryStats, setSummaryStats] = useState<StaffCodeSummaryStats>({
    totalCodes: 0,
    activeCount: 0,
    inactiveCount: 0,
    dispatcherCount: 0,
    serviceCount: 0,
    cashierCount: 0,
    organizerCount: 0,
    receptionistCount: 0,
    ongoingShiftsCount: 0,
  })
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 250
  const [loading, setLoading] = useState(true)

  // ── Shift Summary Modal State ──
  const [summaryStaff, setSummaryStaff] = useState<StaffCodeItem | null>(null)
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false)

  const handleOpenSummary = (item: StaffCodeItem) => {
    setSummaryStaff(item)
    setIsSummaryModalOpen(true)
  }

  // ── Filter State ──
  const [filters, setFilters] = useState<StaffCodeFilterParams>({
    searchQuery: '',
    role: 'ALL',
    status: 'ALL',
    shiftStatus: 'ALL',
    sortBy: 'codeId',
    sortOrder: 'asc',
  })

  const showToast = useCallback(
    (_message: string, _type: 'success' | 'error' | 'info' = 'success') => {
      // Popup notifications disabled
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
    } catch (err: unknown) {
      console.error('[AccountManager] Failed to load data:', err)
      showToast('Failed to load staff codes. Please refresh.', 'error')
    } finally {
      setLoading(false)
    }
  }, [filters, currentPage, pageSize, showToast])

  useEffect(() => {
    // Sanitize any stale local sessions on mount
    void sanitizeTerminalSessions()
    void loadData()

    // 1. Listen for cross-terminal session events (SHIFT_STARTED, SHIFT_ENDED, FORCE_LOGOUT)
    const unsubscribeSessionEvents = subscribeToSessionEvents(() => {
      void loadData()
    })

    // 2. Real-time postgres changes subscription on Staff_Codes
    const channel = supabase
      .channel('account-manager-staff-codes-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'staff', table: 'Staff_Codes' },
        () => {
          void loadData()
        },
      )
      .subscribe()

    return () => {
      unsubscribeSessionEvents()
      void supabase.removeChannel(channel)
    }
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

  // ── Save Multiple Codes (Create Multi-Name) ──
  const handleSaveMultipleCodes = async (staffRole: StaffRole, names: string[]) => {
    const created = await createMultipleStaffCodes(staffRole, names)
    showToast(`Successfully created ${created.length} staff code(s) for ${staffRole}.`)
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

  // ── Manual End All Shifts ──
  const handleEndAllShifts = () => {
    setConfirmModal({
      isOpen: true,
      title: 'End All Active Shifts',
      description: `Are you sure you want to end all active shifts (${summaryStats.ongoingShiftsCount} staff on duty)? This will record shift end timestamps, calculate final shift metrics, and log out operational terminal sessions across the network.`,
      isDestructive: true,
      confirmText: 'End All Shifts Now',
      action: async () => {
        setConfirmLoading(true)
        try {
          const endedCount = await endAllStaffShiftsManually()
          showToast(`Successfully ended ${endedCount} active staff shift(s).`, 'success')
          await loadData()
        } catch (err: unknown) {
          console.error('[AccountManager] End all shifts error:', err)
          showToast('Failed to end all shifts. Please try again.', 'error')
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

      {/* ── Top Sub-Tab Switcher: Staff Accounts vs Action History ── */}
      <div className="no-print flex items-center bg-slate-200/70 p-1 rounded-2xl w-fit gap-1 border border-slate-200">
        <button
          type="button"
          onClick={() => setActiveSubTab('accounts')}
          className={`px-4 py-2 text-xs font-black rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'accounts'
              ? 'bg-white text-[#14274E] shadow-xs'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Staff Accounts &amp; Roles</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('audit')}
          className={`px-4 py-2 text-xs font-black rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'audit'
              ? 'bg-white text-[#14274E] shadow-xs'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-[#14274E]" />
          <span>Action History</span>
        </button>
      </div>

      {activeSubTab === 'accounts' ? (
        <>
          {/* ── KPI Summary Cards ── */}
          <AccountManagerSummaryCards stats={summaryStats} loading={loading} />

          {/* ── Filter Bar ── */}
          <AccountManagerFilterBar
            filters={filters}
            onFilterChange={handleFilterChange}
            onClearFilters={handleClearFilters}
            onAddCode={handleAddCode}
            onEndAllShifts={handleEndAllShifts}
            ongoingShiftsCount={summaryStats.ongoingShiftsCount}
          />

          {/* ── Staff Codes Table (Scrollable with Summaries Column) ── */}
          <StaffAccountsTable
            codes={codes}
            loading={loading}
            onEditCode={handleEditCode}
            onToggleStatus={handleToggleStatus}
            onDeleteCode={handleDeleteCode}
            onEndShift={handleEndShift}
            onOpenSummary={handleOpenSummary}
          />
        </>
      ) : (
        <CashierAuditLogsTab />
      )}

      {/* ── Add / Edit Staff Code Drawer ── */}
      <StaffDrawer
        isOpen={isDrawerOpen}
        mode={drawerMode}
        codeItem={selectedCode}
        onClose={() => setIsDrawerOpen(false)}
        onSave={handleSaveCode}
        onSaveMultiple={handleSaveMultipleCodes}
      />

      {/* ── Staff Shift Summary & Actions Modal ── */}
      <StaffShiftSummaryModal
        isOpen={isSummaryModalOpen}
        staff={summaryStaff}
        onClose={() => setIsSummaryModalOpen(false)}
        onActionDeleted={() => void loadData()}
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
