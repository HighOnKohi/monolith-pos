import React from 'react'
import { Users, UserCheck, ShieldCheck, UserX } from 'lucide-react'
import type { AccountSummaryStats } from '@/types/account'

interface AccountManagerSummaryCardsProps {
  stats: AccountSummaryStats
  loading?: boolean
}

export const AccountManagerSummaryCards: React.FC<AccountManagerSummaryCardsProps> = ({
  stats,
  loading = false,
}) => {
  const activeRate =
    stats.totalStaff > 0 ? Math.round((stats.activeCount / stats.totalStaff) * 100) : 0

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
      {/* Total Staff */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-1.5 transition-all hover:border-slate-300">
        <div className="flex items-center justify-between text-slate-500">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
            Total Accounts
          </span>
          <div className="w-7 h-7 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
            <Users className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-black text-[#14274E]">
            {loading ? '—' : stats.totalStaff}
          </span>
          <span className="text-[11px] font-bold text-slate-400">registered</span>
        </div>
        <div className="text-[11px] font-medium text-slate-500 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span>{activeRate}% active rate</span>
        </div>
      </div>

      {/* Active Staff */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-1.5 transition-all hover:border-slate-300">
        <div className="flex items-center justify-between text-slate-500">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
            Active Staff
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
          Can authenticate to POS
        </div>
      </div>

      {/* Administrators */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-1.5 transition-all hover:border-slate-300">
        <div className="flex items-center justify-between text-slate-500">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
            Administrators
          </span>
          <div className="w-7 h-7 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
            <ShieldCheck className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-black text-purple-700">
            {loading ? '—' : stats.adminCount}
          </span>
          <span className="text-[11px] font-bold text-purple-600/80">admins</span>
        </div>
        <div className="text-[11px] font-medium text-purple-600 flex items-center gap-1">
          <span>Protected system keys</span>
        </div>
      </div>

      {/* Inactive / Suspended */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-1.5 transition-all hover:border-slate-300">
        <div className="flex items-center justify-between text-slate-500">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
            Inactive / Disabled
          </span>
          <div className="w-7 h-7 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600">
            <UserX className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-black text-slate-700">
            {loading ? '—' : stats.inactiveCount}
          </span>
          <span className="text-[11px] font-bold text-slate-400">disabled</span>
        </div>
        <div className="text-[11px] font-medium text-slate-400">
          Access blocked; logs kept
        </div>
      </div>
    </div>
  )
}
