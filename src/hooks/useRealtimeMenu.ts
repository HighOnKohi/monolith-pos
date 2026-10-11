import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { MenuItem } from '@/types/menu'

export const MENU_ITEM_STATUS_UPDATED = 'menu-item-status-updated'

export function broadcastMenuItemStatus(itemId: string | number, isSoldOut: boolean, orderLimit?: number) {
  window.dispatchEvent(new CustomEvent(MENU_ITEM_STATUS_UPDATED, {
    detail: { itemId: String(itemId), isSoldOut, orderLimit },
  }))

  try {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const bc = new BroadcastChannel('monolith_order_events')
      bc.postMessage({
        type: 'menu_item_status_updated',
        itemId: String(itemId),
        isSoldOut,
        orderLimit,
      })
      bc.close()
    }
  } catch {
    // Non-fatal
  }
}

/**
 * Subscribes to Menu_Items ITEM_STATUS & ORDER_LIMIT changes via Supabase Realtime.
 * When an item becomes OUT_OF_STOCK or AVAILABLE or changes limit, calls onUpdate.
 */
export function useRealtimeMenu(
  onUpdate: (itemId: string, isSoldOut: boolean, orderLimit?: number) => void,
) {
  useEffect(() => {
    const channel = supabase
      .channel('menu-items-realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'menu', table: 'Menu_Items' },
        (payload) => {
          const row = payload.new as Record<string, unknown>
          const itemId = String(row['ITEM_ID'])
          const orderLimit = row['ORDER_LIMIT'] != null ? Number(row['ORDER_LIMIT']) : undefined
          const isSoldOut = row['ITEM_STATUS'] === 'OUT_OF_STOCK' || (orderLimit !== undefined && orderLimit <= 0)
          onUpdate(itemId, isSoldOut, orderLimit)
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [onUpdate])
}

/**
 * Merges a sold-out status update into an existing items array.
 * Pure function — returns a new array.
 */
export function applyMenuUpdate(
  items: MenuItem[],
  itemId: string,
  isSoldOut: boolean,
  orderLimit?: number,
): MenuItem[] {
  return items.map((item) =>
    item.id === itemId
      ? {
          ...item,
          isSoldOut,
          isAvailable: !isSoldOut,
          ...(orderLimit !== undefined ? { orderLimit } : {}),
        }
      : item,
  )
}
