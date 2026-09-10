import React from 'react'
import { KeyRound, UserCheck, ShieldCheck, Store } from 'lucide-react'
import type { StaffCodeSummaryStats } from '@/types/account'

interface AccountManagerSummaryCardsProps {
  stats: StaffCodeSummaryStats
  loading?: boolean
}

export const AccountManagerSummaryCards: React.FC<AccountManagerSummaryCardsProps> = ({
  stats,
  loading = false,
}) => {
  const activeRate =
    stats.totalCodes > 0 ? Math.round((stats.activeCount / stats.totalCodes) * 100) : 0

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
      {/* Total Staff Codes */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-1.5 transition-all hover:border-slate-300">
        <div className="flex items-center justify-between text-slate-500">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
            Total Staff Codes
          </span>
          <div className="w-7 h-7 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
            <KeyRound className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-black text-[#14274E]">
            {loading ? '—' : stats.totalCodes}
          </span>
          <span className="text-[11px] font-bold text-slate-400">codes</span>
        </div>
        <div className="text-[11px] font-medium text-slate-500 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span>{activeRate}% active rate</span>
        </div>
      </div>

      {/* Active Codes */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-1.5 transition-all hover:border-slate-300">
        <div className="flex items-center justify-between text-slate-500">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
            Active Codes
          </span>
          <div className="w-7 h-7 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <UserCheck className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-black text-emerald-600">
            {loading ? '—' : stats.activeCount}
          </span>
          <span className="text-[11px] font-bold text-emerald-700/80">enabled</span>
        </div>
        <div className="text-[11px] font-medium text-slate-400">
          Authorized for terminal actions
        </div>
      </div>

      {/* Operational Roles: Cashier & Floor Staff */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-1.5 transition-all hover:border-slate-300">
        <div className="flex items-center justify-between text-slate-500">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
            Cashier & Floor
          </span>
          <div className="w-7 h-7 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
            <Store className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-black text-blue-700">
            {loading ? '—' : stats.cashierCount + stats.floorStaffCount}
          </span>
          <span className="text-[11px] font-bold text-blue-600/80">front of house</span>
        </div>
        <div className="text-[11px] font-medium text-slate-500">
          {stats.cashierCount} Cashier · {stats.floorStaffCount} Floor Staff
        </div>
      </div>

      {/* Kitchen & Supervisors */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-1.5 transition-all hover:border-slate-300">
        <div className="flex items-center justify-between text-slate-500">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
            Kitchen & Leads
          </span>
          <div className="w-7 h-7 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
            <ShieldCheck className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-black text-purple-700">
            {loading ? '—' : stats.adminCount + stats.managerCount + stats.kitchenCount}
          </span>
          <span className="text-[11px] font-bold text-purple-600/80">assigned</span>
        </div>
        <div className="text-[11px] font-medium text-slate-500">
          {stats.kitchenCount} Kitchen · {stats.managerCount} Mgr · {stats.adminCount} Admin
        </div>
      </div>
    </div>
  )
}
