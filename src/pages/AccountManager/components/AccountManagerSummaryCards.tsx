import React from 'react'
import { KeyRound, ChefHat, Store, UtensilsCrossed, FolderKanban, ConciergeBell } from 'lucide-react'
import type { StaffCodeSummaryStats } from '@/types/account'

interface AccountManagerSummaryCardsProps {
  stats: StaffCodeSummaryStats
  loading?: boolean
}

export const AccountManagerSummaryCards: React.FC<AccountManagerSummaryCardsProps> = ({
  stats,
  loading = false,
}) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
      {/* 1. Total Staff Codes */}
      <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/80 shadow-2xs space-y-1 transition-all hover:border-slate-300">
        <div className="flex items-center justify-between text-slate-500">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
            Total Codes
          </span>
          <div className="w-6 h-6 rounded-lg bg-slate-200/70 flex items-center justify-center text-slate-600">
            <KeyRound className="w-3.5 h-3.5" />
          </div>
        </div>
        <div>
          <span className="text-2xl font-black text-[#14274E]">
            {loading ? '—' : stats.totalCodes}
          </span>
        </div>
      </div>

      {/* 2. Dispatcher */}
      <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200/80 shadow-2xs space-y-1 transition-all hover:border-amber-300">
        <div className="flex items-center justify-between text-amber-700">
          <span className="text-[11px] font-black uppercase tracking-wider text-amber-700/80">
            Dispatcher
          </span>
          <div className="w-6 h-6 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700">
            <ChefHat className="w-3.5 h-3.5" />
          </div>
        </div>
        <div>
          <span className="text-2xl font-black text-amber-700">
            {loading ? '—' : stats.dispatcherCount}
          </span>
        </div>
      </div>

      {/* 3. Service */}
      <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-200/80 shadow-2xs space-y-1 transition-all hover:border-blue-300">
        <div className="flex items-center justify-between text-blue-700">
          <span className="text-[11px] font-black uppercase tracking-wider text-blue-700/80">
            Service
          </span>
          <div className="w-6 h-6 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700">
            <UtensilsCrossed className="w-3.5 h-3.5" />
          </div>
        </div>
        <div>
          <span className="text-2xl font-black text-blue-700">
            {loading ? '—' : stats.serviceCount}
          </span>
        </div>
      </div>

      {/* 4. Cashier */}
      <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200/80 shadow-2xs space-y-1 transition-all hover:border-emerald-300">
        <div className="flex items-center justify-between text-emerald-700">
          <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700/80">
            Cashier
          </span>
          <div className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
            <Store className="w-3.5 h-3.5" />
          </div>
        </div>
        <div>
          <span className="text-2xl font-black text-emerald-700">
            {loading ? '—' : stats.cashierCount}
          </span>
        </div>
      </div>

      {/* 5. Organizer */}
      <div className="p-3 rounded-xl bg-violet-50/60 border border-violet-200/80 shadow-2xs space-y-1 transition-all hover:border-violet-300">
        <div className="flex items-center justify-between text-violet-700">
          <span className="text-[11px] font-black uppercase tracking-wider text-violet-700/80">
            Organizer
          </span>
          <div className="w-6 h-6 rounded-lg bg-violet-100 flex items-center justify-center text-violet-700">
            <FolderKanban className="w-3.5 h-3.5" />
          </div>
        </div>
        <div>
          <span className="text-2xl font-black text-violet-700">
            {loading ? '—' : stats.organizerCount}
          </span>
        </div>
      </div>

      {/* 6. Receptionist */}
      <div className="p-3 rounded-xl bg-teal-50/60 border border-teal-200/80 shadow-2xs space-y-1 transition-all hover:border-teal-300">
        <div className="flex items-center justify-between text-teal-700">
          <span className="text-[11px] font-black uppercase tracking-wider text-teal-700/80">
            Receptionist
          </span>
          <div className="w-6 h-6 rounded-lg bg-teal-100 flex items-center justify-center text-teal-700">
            <ConciergeBell className="w-3.5 h-3.5" />
          </div>
        </div>
        <div>
          <span className="text-2xl font-black text-teal-700">
            {loading ? '—' : stats.receptionistCount}
          </span>
        </div>
      </div>
    </div>
  )
}
