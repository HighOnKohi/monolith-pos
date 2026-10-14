import { useEffect } from 'react'
import type { OrderStatusNotification } from '@/hooks/useOrders'

interface LiveOrderStatusPopupProps {
  notification: OrderStatusNotification | null
  onDismiss: () => void
  onViewOrders: () => void
}

export function LiveOrderStatusPopup({
  notification,
  onDismiss,
}: LiveOrderStatusPopupProps) {
  useEffect(() => {
    if (!notification) return
    const timer = setTimeout(() => {
      onDismiss()
    }, 6000)
    return () => clearTimeout(timer)
  }, [notification, onDismiss])

  return null
}
