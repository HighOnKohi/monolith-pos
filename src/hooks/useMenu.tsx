import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, ReactNode, SetStateAction } from 'react'
import { supabase } from '@/lib/supabase'
import type { MenuItem, Category } from '@/types/menu'
import {
  fetchMenuItems,
  fetchCategories,
  fetchMenuPresets,
  createMenuPreset,
  setDefaultMenuPreset,
  type MenuPreset,
} from '@/services/menuService'
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
  setActivePresetId: (id: number) => Promise<void> | void
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
  const activePresetIdRef = useRef(activePresetId)
  activePresetIdRef.current = activePresetId

  const load = useCallback(async (isInitial: boolean, targetId?: number) => {
    if (isInitial) {
      setLoadState('loading')
      setError(null)
    }

    try {
      const [fetchedItems, fetchedPresets] = await Promise.all([fetchMenuItems(), fetchMenuPresets()])
      const defaultPreset = fetchedPresets.find((p) => p.IS_DEFAULT)

      // Determine target preset:
      // 1. Explicit targetId passed to load()
      // 2. Default preset in database (IS_DEFAULT = true)
      // 3. Current active preset if exists in fetched presets
      // 4. First preset or 1
      let targetPresetId = targetId
      if (!targetPresetId) {
        if (defaultPreset) {
          targetPresetId = defaultPreset.PRESET_ID
        } else if (fetchedPresets.some((p) => p.PRESET_ID === activePresetIdRef.current)) {
          targetPresetId = activePresetIdRef.current
        } else {
          targetPresetId = fetchedPresets[0]?.PRESET_ID ?? 1
        }
      }

      setActivePresetIdState(targetPresetId)
      localStorage.setItem(ACTIVE_PRESET_KEY, String(targetPresetId))

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
  }, [])

  const setActivePresetId = useCallback(async (id: number) => {
    setActivePresetIdState(id)
    localStorage.setItem(ACTIVE_PRESET_KEY, String(id))
    window.dispatchEvent(new CustomEvent(MENU_PRESET_CHANGED, { detail: id }))
    try {
      await setDefaultMenuPreset(id)
    } catch (err) {
      console.warn('[useMenu] Failed to set default menu preset in DB:', err)
    }
    void load(false, id)
  }, [load])

  const createPreset = useCallback(async (name: string) => {
    const preset = await createMenuPreset(name)
    setPresets((current) => [...current, preset])
    return preset
  }, [])

  useEffect(() => {
    if (!enabled) return

    let cancelled = false
    const loadIfActive = (isInitial: boolean, targetId?: number) => {
      if (!cancelled) void load(isInitial, targetId)
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
            loadIfActive(false, def?.PRESET_ID)
          }).catch(() => loadIfActive(false))
        },
      )
      .on(
        'broadcast',
        { event: 'menu_preset_changed' },
        ({ payload }) => {
          const newPresetId = payload?.presetId ? Number(payload.presetId) : undefined
          if (newPresetId) {
            setActivePresetIdState(newPresetId)
            localStorage.setItem(ACTIVE_PRESET_KEY, String(newPresetId))
          }
          loadIfActive(false, newPresetId)
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
        loadIfActive(false, id)
      }
    }

    const handleBroadcastOrderUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ type: string; presetId?: number; menuPresetId?: number }>).detail
      if (detail?.type === 'event_activated' || detail?.type === 'event_deactivated' || detail?.type === 'menu_preset_changed') {
        const targetId = detail.menuPresetId ?? detail.presetId
        if (targetId) {
          setActivePresetIdState(targetId)
          localStorage.setItem(ACTIVE_PRESET_KEY, String(targetId))
        }
        loadIfActive(false, targetId)
      }
    }

    // Cross-tab BroadcastChannel listener
    let bc: BroadcastChannel | null = null
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        bc = new BroadcastChannel('monolith_order_events')
        bc.addEventListener('message', (event) => {
          const data = event.data
          if (data?.type === 'event_activated' || data?.type === 'event_deactivated' || data?.type === 'menu_preset_changed') {
            const targetId = data.menuPresetId ?? data.presetId
            if (targetId) {
              setActivePresetIdState(targetId)
              localStorage.setItem(ACTIVE_PRESET_KEY, String(targetId))
            }
            loadIfActive(false, targetId)
          }
        })
      }
    } catch {
      // Ignore
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
      bc?.close()
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
