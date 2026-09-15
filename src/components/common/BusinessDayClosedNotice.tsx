import { Store, ShieldAlert, ArrowRight, Clock, CalendarX2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import monolithLogoYellow from '@/assets/images/monolith-logo-yellow.png'

interface BusinessDayClosedNoticeProps {
  mode?: 'cashier' | 'service' | 'customer' | 'kitchen'
  onRetry?: () => void
}

export function BusinessDayClosedNotice({
  mode = 'cashier',
  onRetry,
}: BusinessDayClosedNoticeProps) {
  const navigate = useNavigate()

  const config = {
    cashier: {
      tag: 'Counter POS Locked',
      title: 'Business Day Closed',
      description:
        'The cashier system is currently unavailable because the operational business day has not been started or has already concluded.',
      hint: 'Please contact a manager or system administrator to start the business day from the management portal.',
      showAdminAction: true,
    },
    service: {
      tag: 'Floor Service Locked',
      title: 'Business Day Closed',
      description:
        'Floor order punching and table service are currently unavailable. The restaurant operational day is closed.',
      hint: 'Please ask an administrator to start the business day to begin taking customer orders.',
      showAdminAction: true,
    },
    customer: {
      tag: 'Ordering Closed',
      title: 'Ordering Unavailable',
      description:
        'The restaurant is currently not accepting dining or takeout orders. Our register and kitchen are offline.',
      hint: 'Please try again later or ask your server once the business day opens.',
      showAdminAction: false,
    },
    kitchen: {
      tag: 'Kitchen Display Locked',
      title: 'Business Day Closed',
      description:
        'The kitchen order display and dispatcher interface are currently offline because the operational business day is closed.',
      hint: 'Please contact a manager or system administrator to start the business day from the management portal to begin processing tickets.',
      showAdminAction: true,
    },
  }[mode]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden text-center">
        {/* Header Visual */}
        <div className="bg-[#14274E] px-8 pt-8 pb-7 relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-36 h-36 rounded-full bg-amber-500/15 blur-2xl pointer-events-none" />
          <div className="absolute -bottom-8 -left-8 w-28 h-28 rounded-full bg-rose-500/15 blur-xl pointer-events-none" />

          <div className="flex justify-center mb-3">
            <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/15 flex items-center justify-center shadow-lg p-2.5">
              <img src={monolithLogoYellow} alt="Monolith POS" className="w-full h-full object-contain" />
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-400/30 text-[#E9C46A] text-[10px] font-black uppercase tracking-wider mb-2">
            <Store className="w-3 h-3" />
            <span>{config.tag}</span>
          </div>

          <h2 className="text-xl font-black text-white tracking-tight">{config.title}</h2>
          <p className="text-xs font-semibold text-slate-300 mt-1 max-w-xs mx-auto leading-relaxed">
            {config.description}
          </p>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-8 space-y-5">
          <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-4 flex items-start gap-3 text-left">
            <CalendarX2 className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-xs font-black text-amber-900">No Active Business Day</h4>
              <p className="text-[11px] font-semibold text-amber-800 leading-snug">
                {config.hint}
              </p>
            </div>
          </div>

          {config.showAdminAction && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => navigate('/order-logs')}
                className="w-full py-3.5 bg-[#14274E] hover:bg-[#1f3b73] active:bg-[#0f1d3b] text-white rounded-2xl font-black text-xs tracking-wide shadow-lg shadow-[#14274E]/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
              >
                <ShieldAlert className="w-4 h-4 text-[#E9C46A]" />
                <span>Manage Business Day (Admin)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors flex items-center justify-center gap-1.5 mx-auto cursor-pointer"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Check Status Again</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
