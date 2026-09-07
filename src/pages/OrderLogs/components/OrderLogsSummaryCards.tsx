import React from 'react'
import {
  ShoppingBag,
  CheckCircle2,
  XCircle,
  DollarSign,
  TrendingUp,
  Clock,
  Users,
  CreditCard,
} from 'lucide-react'
import type { OrderLogsSummary } from '@/services/orderLogsService'

interface OrderLogsSummaryCardsProps {
  summary: OrderLogsSummary
  loading?: boolean
}

export const OrderLogsSummaryCards: React.FC<OrderLogsSummaryCardsProps> = ({
  summary,
  loading = false,
}) => {
  const cards = [
    {
      title: 'Total Orders',
      value: loading ? '—' : summary.totalOrders.toLocaleString(),
      subtitle: `${summary.activeOrders} active / in-flight`,
      icon: ShoppingBag,
      accentColor: '#14274E',
      bgClass: 'bg-slate-50/50',
    },
    {
      title: 'Completed Orders',
      value: loading ? '—' : summary.completedOrders.toLocaleString(),
      subtitle: `${summary.totalOrders > 0 ? Math.round((summary.completedOrders / summary.totalOrders) * 100) : 0}% completion rate`,
      icon: CheckCircle2,
      accentColor: '#10B981',
      bgClass: 'bg-emerald-50/40',
    },
    {
      title: 'Cancelled / Rejected',
      value: loading ? '—' : summary.cancelledOrders.toLocaleString(),
      subtitle: `${summary.cancelledOrders} historical cancellations`,
      icon: XCircle,
      accentColor: '#F43F5E',
      bgClass: 'bg-rose-50/40',
    },
    {
      title: 'Filtered Revenue',
      value: loading ? '—' : `₱${summary.totalRevenue.toLocaleString('en-PH', { minimumFractionDigits: 0 })}`,
      subtitle: 'Completed orders revenue',
      icon: DollarSign,
      accentColor: '#2A9D8F',
      bgClass: 'bg-teal-50/40',
    },
    {
      title: 'Avg. Order Value',
      value: loading ? '—' : `₱${summary.averageOrderValue.toFixed(0)}`,
      subtitle: 'Revenue per completed order',
      icon: TrendingUp,
      accentColor: '#E9C46A',
      bgClass: 'bg-amber-50/40',
    },
    {
      title: 'Avg. Serving Time',
      value: loading
        ? '—'
        : summary.averageServingTimeMinutes !== null
          ? `${summary.averageServingTimeMinutes}m`
          : '—',
      subtitle: 'Order placed to served',
      icon: Clock,
      accentColor: '#6366F1',
      bgClass: 'bg-indigo-50/40',
    },
    {
      title: 'Tables Served',
      value: loading ? '—' : `${summary.customersServed.toLocaleString()}`,
      subtitle: 'Total diners recorded',
      icon: Users,
      accentColor: '#E76F51',
      bgClass: 'bg-orange-50/40',
    },
    {
      title: 'Payment Status',
      value: loading ? '—' : `${summary.paidOrders} Paid`,
      subtitle: `${summary.unpaidOrders} Unpaid / In-progress`,
      icon: CreditCard,
      accentColor: '#3B82F6',
      bgClass: 'bg-blue-50/40',
    },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
      {cards.map((card, idx) => {
        const Icon = card.icon
        return (
          <div
            key={idx}
            className={`p-3 rounded-2xl border border-slate-200/80 ${card.bgClass} flex flex-col justify-between shadow-2xs`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 truncate">
                {card.title}
              </span>
              <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: card.accentColor }} />
            </div>

            <div className="my-0.5">
              <span className="text-base sm:text-lg font-black text-[#14274E] tracking-tight">
                {card.value}
              </span>
            </div>

            <p className="text-[9.5px] text-slate-400 font-medium truncate mt-0.5">
              {card.subtitle}
            </p>
          </div>
        )
      })}
    </div>
  )
}
