import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { MenuItem, Category } from '@/types/menu'
import { fetchMenuItems, fetchCategories } from '@/services/menuService'

type LoadState = 'loading' | 'loaded' | 'error' | 'empty'

interface UseMenuResult {
  items: MenuItem[]
  categories: Category[]
  loadState: LoadState
  error: string | null
  reload: () => void
}

export function useMenu(): UseMenuResult {
  const [items, setItems] = useState<MenuItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function load(isInitial = false) {
      if (isInitial) {
        setLoadState('loading')
        setError(null)
      }
      try {
        const fetchedItems = await fetchMenuItems()
        const fetchedCategories = await fetchCategories(fetchedItems)
        if (cancelled) return
        setItems(fetchedItems)
        setCategories(fetchedCategories)
        if (isInitial) {
          setLoadState(fetchedItems.length === 0 ? 'empty' : 'loaded')
        }
      } catch (err) {
        if (cancelled) return
        console.error('[useMenu] Failed to load menu:', err)
        if (isInitial) {
          setError('Unable to load the menu. Please try again.')
          setLoadState('error')
        }
      }
    }

    load(true)

    // Realtime channel to immediately reconcile menu items & categories across interfaces
    const channel = supabase
      .channel('menu-sync-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'Menu_Items' },
        () => {
          load(false)
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'Menu_Categories' },
        () => {
          load(false)
        },
      )
      .subscribe()

    // Background safety poll every 5000ms
    const interval = setInterval(() => {
      load(false)
    }, 5000)

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        load(false)
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      cancelled = true
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      supabase.removeChannel(channel)
    }
  }, [revision])

  return {
    items,
    categories,
    loadState,
    error,
    reload: () => setRevision((v) => v + 1),
  }
}
