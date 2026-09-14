import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { Dispatch, ReactNode, SetStateAction } from 'react'
import { supabase } from '@/lib/supabase'
import type { MenuItem, Category } from '@/types/menu'
import { fetchMenuItems, fetchCategories, fetchMenuPresets, createMenuPreset, type MenuPreset } from '@/services/menuService'
import { MENU_ITEM_STATUS_UPDATED, applyMenuUpdate } from '@/hooks/useRealtimeMenu'

export const MENU_PRESET_CHANGED = 'menu-preset-changed'
const ACTIVE_PRESET_KEY = 'menu-active-preset-id'

type LoadState = 'loading' | 'loaded' | 'error' | 'empty'

interface UseMenuResult {
  items: MenuItem[]
  categories: Category[]
  loadState: LoadState
  error: string | null
  setItems: Dispatch<SetStateAction<MenuItem[]>>
  setCategories: Dispatch<SetStateAction<Category[]>>
  reload: () => void
  presets: MenuPreset[]
  activePresetId: number
  setActivePresetId: (id: number) => void
  createPreset: (name: string, description?: string) => Promise<MenuPreset>
}

const MenuContext = createContext<UseMenuResult | null>(null)

function useMenuState(enabled: boolean): UseMenuResult {
  const [items, setItems] = useState<MenuItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const [presets, setPresets] = useState<MenuPreset[]>([])
  const [activePresetId, setActivePresetIdState] = useState(() => Number(localStorage.getItem(ACTIVE_PRESET_KEY)) || 1)

  const setActivePresetId = useCallback((id: number) => {
    setActivePresetIdState(id)
    localStorage.setItem(ACTIVE_PRESET_KEY, String(id))
    window.dispatchEvent(new CustomEvent(MENU_PRESET_CHANGED, { detail: id }))
  }, [])

  const createPreset = useCallback(async (name: string) => {
    const preset = await createMenuPreset(name)
    setPresets((current) => [...current, preset])
    return preset
  }, [])

  const load = useCallback(async (isInitial: boolean) => {
    if (isInitial) {
      setLoadState('loading')
      setError(null)
    }

    try {
      const [fetchedItems, fetchedPresets] = await Promise.all([fetchMenuItems(), fetchMenuPresets()])
      const defaultPreset = fetchedPresets.find((p) => p.IS_DEFAULT)
      
      let targetPresetId = activePresetId
      // If defaultPreset exists and activePresetId is not found in presets, or if on initial load
      if (defaultPreset && (!fetchedPresets.some((p) => p.PRESET_ID === activePresetId) || !localStorage.getItem(ACTIVE_PRESET_KEY))) {
        targetPresetId = defaultPreset.PRESET_ID
        setActivePresetIdState(targetPresetId)
        localStorage.setItem(ACTIVE_PRESET_KEY, String(targetPresetId))
      }

      const activeItems = fetchedItems.filter((item) => item.presetId === targetPresetId)
      const fetchedCategories = await fetchCategories(activeItems, targetPresetId)
      setPresets(fetchedPresets)
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
  }, [activePresetId])

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
        { event: '*', schema: 'menu', table: 'Menu_Items' },
        () => loadIfActive(false),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'menu', table: 'Menu_Categories' },
        () => loadIfActive(false),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'menu', table: 'Menu_Presets' },
        () => {
          fetchMenuPresets().then((fetchedPresets) => {
            const def = fetchedPresets.find((p) => p.IS_DEFAULT)
            if (def) {
              setActivePresetIdState(def.PRESET_ID)
              localStorage.setItem(ACTIVE_PRESET_KEY, String(def.PRESET_ID))
            }
            loadIfActive(false)
          }).catch(() => loadIfActive(false))
        },
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

    const handlePresetChange = (event: Event) => {
      const id = Number((event as CustomEvent<number>).detail || localStorage.getItem(ACTIVE_PRESET_KEY))
      if (id) {
        setActivePresetIdState(id)
        localStorage.setItem(ACTIVE_PRESET_KEY, String(id))
      }
    }

    const handleBroadcastOrderUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ type: string; presetId?: number; menuPresetId?: number }>).detail
      if (detail?.type === 'event_activated' || detail?.type === 'event_deactivated' || detail?.type === 'menu_preset_changed') {
        if (detail.menuPresetId) {
          setActivePresetIdState(detail.menuPresetId)
          localStorage.setItem(ACTIVE_PRESET_KEY, String(detail.menuPresetId))
        }
        loadIfActive(false)
      }
    }

    window.addEventListener(MENU_ITEM_STATUS_UPDATED, handleMenuItemStatusUpdate)
    window.addEventListener(MENU_PRESET_CHANGED, handlePresetChange)
    window.addEventListener('monolith-order-update', handleBroadcastOrderUpdate)
    window.addEventListener('storage', handlePresetChange)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      cancelled = true
      window.removeEventListener(MENU_ITEM_STATUS_UPDATED, handleMenuItemStatusUpdate)
      window.removeEventListener(MENU_PRESET_CHANGED, handlePresetChange)
      window.removeEventListener('monolith-order-update', handleBroadcastOrderUpdate)
      window.removeEventListener('storage', handlePresetChange)
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
      presets,
      activePresetId,
      setActivePresetId,
      createPreset,
    }),
    [items, categories, loadState, error, presets, activePresetId, setActivePresetId, createPreset],
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
