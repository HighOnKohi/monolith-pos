import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { MenuItem } from '@/types/menu'

export const MENU_ITEM_STATUS_UPDATED = 'menu-item-status-updated'

export function broadcastMenuItemStatus(itemId: string | number, isSoldOut: boolean) {
  window.dispatchEvent(new CustomEvent(MENU_ITEM_STATUS_UPDATED, {
    detail: { itemId: String(itemId), isSoldOut },
  }))
}

/**
 * Subscribes to Menu_Items ITEM_STATUS changes via Supabase Realtime.
 * When an item becomes OUT_OF_STOCK or AVAILABLE, calls onUpdate with
 * the updated item ID and new sold-out state so the parent can merge.
 */
export function useRealtimeMenu(
  onUpdate: (itemId: string, isSoldOut: boolean) => void,
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
          const isSoldOut = row['ITEM_STATUS'] === 'OUT_OF_STOCK'
          onUpdate(itemId, isSoldOut)
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
): MenuItem[] {
  return items.map((item) =>
    item.id === itemId
      ? { ...item, isSoldOut, isAvailable: !isSoldOut }
      : item,
  )
}
