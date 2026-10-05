import { useState } from 'react'
import { Store, ShieldCheck } from 'lucide-react'
import { BusinessDayManagementTab } from '@/pages/OrderLogs/components/BusinessDayManagementTab'
import { CashierAuditLogsTab } from '@/pages/OrderLogs/components/CashierAuditLogsTab'

export default function AdminPanelPage() {
  const [activeTab, setActiveTab] = useState<'business-day' | 'audit'>('business-day')

  return (
    <div className="order-logs-page-container staff-page space-y-4 pb-12">
      {/* ── Top Header ── */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/90 shadow-2xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-[#14274E] tracking-tight">
            Admin Panel
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Manage business day lifecycles, reconcile daily totals, and inspect staff operational audit trails.
          </p>
        </div>

        {/* ── Tab Switcher ── */}
        <div className="flex items-center bg-slate-100 p-1 rounded-2xl w-fit gap-1 border border-slate-200 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('business-day')}
            className={`px-3.5 py-2 text-xs font-black rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'business-day'
                ? 'bg-white text-[#14274E] shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Store className="w-4 h-4 text-emerald-600" />
            <span>Business Day &amp; Daily Summary</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            className={`px-3.5 py-2 text-xs font-black rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'audit'
                ? 'bg-white text-[#14274E] shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-[#14274E]" />
            <span>Staff Operational Audit</span>
          </button>
        </div>
      </div>

      {/* ── Tab Content ── */}
      {activeTab === 'business-day' ? (
        <BusinessDayManagementTab />
      ) : (
        <CashierAuditLogsTab />
      )}
    </div>
  )
}
