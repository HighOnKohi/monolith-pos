import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { getActiveEvent } from '@/services/eventService'
import type { RestaurantEvent } from '@/types/event'

export interface UseActiveEventResult {
  activeEvent: RestaurantEvent | null
  isEventActive: boolean
  isLoading: boolean
  reloadActiveEvent: () => Promise<void>
}

export function useActiveEvent(): UseActiveEventResult {
  const [activeEvent, setActiveEvent] = useState<RestaurantEvent | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const checkActive = useCallback(async () => {
    try {
      const active = await getActiveEvent()
      setActiveEvent(active)
    } catch {
      setActiveEvent(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void checkActive()

    // 1. Same-window custom event
    const handleUpdate = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.type === 'event_activated' || detail?.type === 'event_deactivated') {
        void checkActive()
      }
    }
    window.addEventListener('monolith-order-update', handleUpdate)

    // 2. Cross-tab BroadcastChannel
    let bc: BroadcastChannel | null = null
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        bc = new BroadcastChannel('monolith_order_events')
        bc.addEventListener('message', (event) => {
          const data = event.data
          if (data?.type === 'event_activated' || data?.type === 'event_deactivated') {
            void checkActive()
          }
        })
      }
    } catch {
      // Ignore
    }

    // 3. Supabase Realtime for cross-device updates
    const channel = supabase
      .channel('active-event-sync-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'Restaurant_Events' },
        () => {
          void checkActive()
        },
      )
      .subscribe()

    return () => {
      window.removeEventListener('monolith-order-update', handleUpdate)
      bc?.close()
      void supabase.removeChannel(channel)
    }
  }, [checkActive])

  return {
    activeEvent,
    isEventActive: Boolean(activeEvent),
    isLoading,
    reloadActiveEvent: checkActive,
  }
}
