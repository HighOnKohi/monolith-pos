import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { Dispatch, ReactNode, SetStateAction } from 'react'
import { supabase } from '@/lib/supabase'
import type { MenuItem, Category } from '@/types/menu'
import { fetchMenuItems, fetchCategories } from '@/services/menuService'
import { MENU_ITEM_STATUS_UPDATED, applyMenuUpdate } from '@/hooks/useRealtimeMenu'

type LoadState = 'loading' | 'loaded' | 'error' | 'empty'

interface UseMenuResult {
  items: MenuItem[]
  categories: Category[]
  loadState: LoadState
  error: string | null
  setItems: Dispatch<SetStateAction<MenuItem[]>>
  setCategories: Dispatch<SetStateAction<Category[]>>
  reload: () => void
}

const MenuContext = createContext<UseMenuResult | null>(null)

function useMenuState(enabled: boolean): UseMenuResult {
  const [items, setItems] = useState<MenuItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)

  const load = useCallback(async (isInitial: boolean) => {
    if (isInitial) {
      setLoadState('loading')
      setError(null)
    }

    try {
      const fetchedItems = await fetchMenuItems()
      const fetchedCategories = await fetchCategories(fetchedItems)
      setItems((current) => {
        const temporaryItems = current.filter((item) => item.id.startsWith('temporary-'))
        return [...fetchedItems, ...temporaryItems]
      })
      setCategories(fetchedCategories)
      if (isInitial) {
        setLoadState(fetchedItems.length === 0 ? 'empty' : 'loaded')
      }
    } catch (err) {
      console.error('[useMenu] Failed to load menu:', err)
      if (isInitial) {
        setError('Unable to load the menu. Please try again.')
        setLoadState('error')
      }
    }
  }, [])

  useEffect(() => {
    if (!enabled) return

    let cancelled = false
    const loadIfActive = (isInitial: boolean) => {
      if (!cancelled) void load(isInitial)
    }

    loadIfActive(true)

    const channel = supabase
      .channel('shared-menu-sync-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'Menu_Items' },
        () => loadIfActive(false),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'Menu_Categories' },
        () => loadIfActive(false),
      )
      .subscribe()

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') loadIfActive(false)
    }

    const handleMenuItemStatusUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ itemId: string; isSoldOut: boolean }>).detail
      if (detail?.itemId) {
        setItems((current) => applyMenuUpdate(current, detail.itemId, detail.isSoldOut))
      }
    }

    window.addEventListener(MENU_ITEM_STATUS_UPDATED, handleMenuItemStatusUpdate)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      cancelled = true
      window.removeEventListener(MENU_ITEM_STATUS_UPDATED, handleMenuItemStatusUpdate)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      void supabase.removeChannel(channel)
    }
  }, [enabled, load, revision])

  return useMemo(
    () => ({
      items,
      categories,
      loadState,
      error,
      setItems,
      setCategories,
      reload: () => setRevision((value) => value + 1),
    }),
    [items, categories, loadState, error],
  )
}

export function MenuProvider({ children }: { children: ReactNode }) {
  const value = useMenuState(true)
  return <MenuContext.Provider value={value}>{children}</MenuContext.Provider>
}

export function useMenu(): UseMenuResult {
  const sharedMenu = useContext(MenuContext)
  const localMenu = useMenuState(sharedMenu === null)
  return sharedMenu ?? localMenu
}
