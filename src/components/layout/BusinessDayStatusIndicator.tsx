import { useBusinessDay } from '@/hooks/useBusinessDay'
import { useNavigate } from 'react-router-dom'
import { Calendar, Store } from 'lucide-react'

interface BusinessDayStatusIndicatorProps {
  collapsed?: boolean
  className?: string
}

export function BusinessDayStatusIndicator({
  collapsed = false,
  className = '',
}: BusinessDayStatusIndicatorProps) {
  const { activeBusinessDay, isOpen, loading } = useBusinessDay()
  const navigate = useNavigate()

  const formattedDate = activeBusinessDay?.businessDate
    ? new Date(activeBusinessDay.businessDate).toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
      })
    : new Date().toLocaleDateString([], { month: 'short', day: 'numeric' })

  if (loading) {
    return (
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100/60 animate-pulse text-[11px] text-slate-400 font-semibold ${className}`}>
        <span className="w-2 h-2 rounded-full bg-slate-300" />
        {!collapsed && <span>Checking day...</span>}
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => navigate('/order-logs')}
      title={isOpen ? `Business Day Open (${activeBusinessDay?.businessDate})` : 'Business Day is currently closed'}
      className={`group flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-left transition-all cursor-pointer ${
        isOpen
          ? 'bg-emerald-50/80 hover:bg-emerald-100/80 border-emerald-200/80 text-emerald-800'
          : 'bg-amber-50/80 hover:bg-amber-100/80 border-amber-200/80 text-amber-800'
      } ${className}`}
    >
      <div className="relative shrink-0 flex items-center justify-center">
        <span
          className={`w-2.5 h-2.5 rounded-full ring-2 ring-white ${
            isOpen ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
          }`}
        />
      </div>

      {!collapsed && (
        <div className="flex flex-col min-w-0 leading-tight">
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-black tracking-tight uppercase">
              {isOpen ? 'Day Open' : 'Day Closed'}
            </span>
            {isOpen && (
              <span className="text-[9px] font-bold text-emerald-600">
                • {formattedDate}
              </span>
            )}
          </div>
          <span className="text-[9px] font-semibold opacity-70 truncate">
            {isOpen ? 'POS Accepting Orders' : 'Click to Manage'}
          </span>
        </div>
      )}
    </button>
  )
}
