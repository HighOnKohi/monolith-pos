import React from 'react'
import { KeyRound, ChefHat, Store, UtensilsCrossed } from 'lucide-react'
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
      {/* 1. Total Staff Codes */}
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
          <span>{activeRate}% active rate ({stats.activeCount} active)</span>
        </div>
      </div>

      {/* 2. Dispatchers */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-1.5 transition-all hover:border-slate-300">
        <div className="flex items-center justify-between text-slate-500">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
            Dispatchers
          </span>
          <div className="w-7 h-7 rounded-xl bg-amber-50 flex items-center justify-center text-amber-700">
            <ChefHat className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-black text-amber-700">
            {loading ? '—' : stats.dispatcherCount}
          </span>
          <span className="text-[11px] font-bold text-amber-600/80">kitchen line</span>
        </div>
        <div className="text-[11px] font-medium text-slate-400">
          Order cooking & dispatching
        </div>
      </div>

      {/* 3. Service Staff */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-1.5 transition-all hover:border-slate-300">
        <div className="flex items-center justify-between text-slate-500">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
            Service Staff
          </span>
          <div className="w-7 h-7 rounded-xl bg-blue-50 flex items-center justify-center text-blue-700">
            <UtensilsCrossed className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-black text-blue-700">
            {loading ? '—' : stats.serviceCount}
          </span>
          <span className="text-[11px] font-bold text-blue-600/80">floor staff</span>
        </div>
        <div className="text-[11px] font-medium text-slate-400">
          Table ordering & serving
        </div>
      </div>

      {/* 4. Cashiers & Active Shifts */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-1.5 transition-all hover:border-slate-300">
        <div className="flex items-center justify-between text-slate-500">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
            Cashiers & Shifts
          </span>
          <div className="w-7 h-7 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-700">
            <Store className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-black text-emerald-700">
            {loading ? '—' : stats.cashierCount}
          </span>
          <span className="text-[11px] font-bold text-emerald-600/80">cashiers</span>
        </div>
        <div className="text-[11px] font-bold text-amber-700 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          <span>{stats.ongoingShiftsCount} ongoing shift(s)</span>
        </div>
      </div>
    </div>
  )
}
