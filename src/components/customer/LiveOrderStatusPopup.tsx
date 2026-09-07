import { useEffect } from 'react'
import {
  CheckCircle2,
  ChefHat,
  Utensils,
  UtensilsCrossed,
  X,
  XCircle,
  ArrowRight,
  Sparkles,
} from 'lucide-react'
import type { OrderStatusNotification } from '@/hooks/useOrders'

interface LiveOrderStatusPopupProps {
  notification: OrderStatusNotification | null
  onDismiss: () => void
  onViewOrders: () => void
}

const STATUS_CONFIG = {
  REQUESTED: {
    icon: CheckCircle2,
    color: 'border-blue-300 bg-blue-50/95 text-blue-900',
    iconBg: 'bg-blue-600 text-white',
    badge: 'bg-blue-100 text-blue-800',
  },
  VERIFIED: {
    icon: CheckCircle2,
    color: 'border-blue-400 bg-blue-50/95 text-blue-950',
    iconBg: 'bg-[#14274E] text-[#E9C46A]',
    badge: 'bg-blue-100 text-blue-800',
  },
  PREPARING: {
    icon: ChefHat,
    color: 'border-amber-400 bg-amber-50/95 text-amber-950',
    iconBg: 'bg-amber-600 text-white',
    badge: 'bg-amber-100 text-amber-800',
  },
  READY: {
    icon: Utensils,
    color: 'border-indigo-400 bg-indigo-50/95 text-indigo-950',
    iconBg: 'bg-indigo-600 text-white',
    badge: 'bg-indigo-100 text-indigo-800',
  },
  SERVED: {
    icon: UtensilsCrossed,
    color: 'border-emerald-400 bg-emerald-50/95 text-emerald-950',
    iconBg: 'bg-emerald-600 text-white',
    badge: 'bg-emerald-100 text-emerald-800',
  },
  CANCELLED: {
    icon: XCircle,
    color: 'border-rose-400 bg-rose-50/95 text-rose-950',
    iconBg: 'bg-rose-600 text-white',
    badge: 'bg-rose-100 text-rose-800',
  },
  COMPLETED: {
    icon: CheckCircle2,
    color: 'border-slate-300 bg-slate-50/95 text-slate-900',
    iconBg: 'bg-slate-600 text-white',
    badge: 'bg-slate-100 text-slate-800',
  },
}

export function LiveOrderStatusPopup({
  notification,
  onDismiss,
  onViewOrders,
}: LiveOrderStatusPopupProps) {
  // Auto-dismiss after 6 seconds
  useEffect(() => {
    if (!notification) return
    const timer = setTimeout(() => {
      onDismiss()
    }, 6000)
    return () => clearTimeout(timer)
  }, [notification, onDismiss])

  if (!notification) return null

  const config = STATUS_CONFIG[notification.status] || STATUS_CONFIG.VERIFIED
  const Icon = config.icon

  return (
    <div className="fixed top-3 inset-x-3 sm:inset-x-auto sm:right-4 sm:max-w-md z-[90] pointer-events-auto animate-slide-down">
      <div
        className={[
          'rounded-3xl p-4 border-2 shadow-[0_12px_40px_rgba(0,0,0,0.18)] backdrop-blur-md transition-all',
          config.color,
        ].join(' ')}
      >
        <div className="flex items-start gap-3">
          {/* Animated Icon */}
          <div
            className={[
              'w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-xs animate-bounce-short',
              config.iconBg,
            ].join(' ')}
          >
            <Icon className="w-5 h-5" />
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0 pr-1">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md tracking-wider bg-white/80 shadow-2xs">
                Order #{notification.orderId}
              </span>
              <span className="text-[10px] text-black/60 font-semibold">
                Just now
              </span>
            </div>

            <h4 className="text-sm font-black tracking-tight leading-snug flex items-center gap-1.5">
              {notification.title}
              {notification.status === 'SERVED' && (
                <Sparkles className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
              )}
            </h4>

            <p className="text-xs text-black/80 font-medium mt-0.5 leading-relaxed">
              {notification.message}
            </p>

            {/* Actions */}
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={() => {
                  onViewOrders()
                  onDismiss()
                }}
                className="px-3 py-1.5 rounded-xl bg-[#14274E] text-white text-xs font-bold flex items-center gap-1 hover:bg-[#14274E]/90 active:scale-95 transition-all shadow-xs"
              >
                <span>View Orders</span>
                <ArrowRight className="w-3 h-3" />
              </button>

              <button
                onClick={onDismiss}
                className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-black/70 hover:bg-black/5 transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>

          {/* Close button */}
          <button
            onClick={onDismiss}
            className="p-1 rounded-full text-black/40 hover:text-black/80 hover:bg-black/5 transition-colors"
            aria-label="Close notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
