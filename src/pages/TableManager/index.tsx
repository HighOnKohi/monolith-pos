import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useBlocker } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import {
  fetchAllLayoutPresets,
  fetchPresetLayout,
  fetchLiveRestaurantTables,
  savePresetLayout,
  createLayoutPreset,
  setDefaultLayoutPreset,
  updateLayoutPresetName,
  updateTableCapacity,
  updateTableStatus,
  updateTableGuestCount,
  deleteLayoutPreset,
  TABLE_TYPES,
  type TableLayoutPreset,
  type TableLayoutInfo,
  type RestaurantTableData,
  type MergedTableNode,
  type TableType,
} from '@/services/tableLayoutService'
import { TableVisual, TableShapeIcon } from './components/TableVisual'
import { TableManagerHeader } from './components/TableManagerHeader'
import { FloatingLayoutControls } from './components/FloatingLayoutControls'
import { TableManagerSidebar } from './components/TableManagerSidebar'
import { NewPresetModal } from './components/NewPresetModal'
import { ConfirmModal } from './components/ConfirmModal'
import { RenamePresetModal } from './components/RenamePresetModal'
import { TableQrPreview } from '@/components/table-qr/TableQrPreview'
import { printBulkQrPdf } from '@/components/table-qr/tableQrPrinter'
import { downloadBulkQrPdf } from '@/components/table-qr/tableQrPdf'
import { useActiveEvent } from '@/hooks/useActiveEvent'
import { GitMerge } from 'lucide-react'
import { TableTypesManager } from './components/TableTypesManager'
import { LabelHierarchyManager } from './components/LabelHierarchyManager'
import { RemoveAllTablesModal } from './components/RemoveAllTablesModal'
import { AdminAuthModal } from './components/AdminAuthModal'
import { AutomaticAllocationModal } from './components/AutomaticAllocationModal'
import { TableListView } from './components/TableListView'
import { PresetsManagerView } from './components/PresetsManagerView'
import type { TableManagerAdminTab } from './components/TableManagerHeader'
import { validateTableTypeCount } from '@/services/tableTypeConfigService'
import { removeAllTables } from '@/services/tableService'
import { logTableAction } from '@/services/tableAuditService'
import { fetchActiveLabels, assignLabelToTable, type TableLabel } from '@/services/tableLabelService'

interface DragState {
  tableNum: number
  startMouseX: number
  startMouseY: number
  startTableX: number
  startTableY: number
  currentX: number
  currentY: number
}

import {
  calculateLayoutSuppression,
  calculateTableEffectiveCapacity,
  resolveLayoutCapacityOverflow,
  distributePresetTables,
  calculateTableBaseCapacity,
  deductMovedTableOnOverflow,
  type ChairSuppression as ChairSuppressionInfo,
} from '@/utils/floorPlan/capacity'
import { getMergeGroupColor } from '@/utils/floorPlan/mergeGroupColors'
import { findNearestValidPosition } from '@/utils/floorPlan/collision'

export const calculateSuppressionForLayout = calculateLayoutSuppression
export type { ChairSuppressionInfo }

export function isTableOverlapping(
  tableNum: number,
  tableType: TableType,
  x: number,
  y: number,
  tables: TableLayoutInfo[],
): boolean {
  const cfgA = TABLE_TYPES[tableType] || TABLE_TYPES[1]
  const aLeft = x
  const aTop = y
  const aRight = x + cfgA.width
  const aBottom = y + cfgA.height

  for (const other of tables) {
    if (other.TABLE_NUM === tableNum) continue
    const cfgB = TABLE_TYPES[other.TABLE_TYPE] || TABLE_TYPES[1]
    const bLeft = other.X_POS
    const bTop = other.Y_POS
    const bRight = other.X_POS + cfgB.width
    const bBottom = other.Y_POS + cfgB.height

    const noOverlap =
      aRight <= bLeft ||
      aLeft >= bRight ||
      aBottom <= bTop ||
      aTop >= bBottom

    if (!noOverlap) {
      return true
    }
  }
  return false
}

export function resolveConnectedMergeGroups(
  tables: TableLayoutInfo[],
  areAdjacent: (t1: TableLayoutInfo, t2: TableLayoutInfo) => boolean,
): TableLayoutInfo[] {
  const n = tables.length
  if (n === 0) return []
  const adj: number[][] = Array.from({ length: n }, () => [])
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (areAdjacent(tables[i], tables[j])) {
        adj[i].push(j)
        adj[j].push(i)
      }
    }
  }

  const visited = new Array(n).fill(false)
  const result = [...tables]
  const components: number[][] = []

  for (let i = 0; i < n; i++) {
    if (!visited[i]) {
      const component: number[] = []
      const queue = [i]
      visited[i] = true

      while (queue.length > 0) {
        const curr = queue.shift()!
        component.push(curr)
        for (const neighbor of adj[curr]) {
          if (!visited[neighbor]) {
            visited[neighbor] = true
            queue.push(neighbor)
          }
        }
      }

      if (component.length >= 2) {
        components.push(component)
      } else {
        result[component[0]] = { ...result[component[0]], MERGE_GROUP_ID: null }
      }
    }
  }

  // 1. First record all existing assigned group IDs so they are NEVER stolen or reassigned
  const usedGroupIds = new Set<number>()
  for (const comp of components) {
    const existingGroupIds = comp
      .map((idx) => tables[idx].MERGE_GROUP_ID)
      .filter((gid): gid is number => gid != null && gid > 0)
    if (existingGroupIds.length > 0) {
      usedGroupIds.add(existingGroupIds[0])
    }
  }

  let nextAvailableId = 1

  for (const comp of components) {
    const existingGroupIds = comp
      .map((idx) => tables[idx].MERGE_GROUP_ID)
      .filter((gid): gid is number => gid != null && gid > 0)

    let assignedId: number | null = null
    if (existingGroupIds.length > 0) {
      assignedId = existingGroupIds[0]
    } else {
      while (usedGroupIds.has(nextAvailableId)) {
        nextAvailableId++
      }
      assignedId = nextAvailableId
      usedGroupIds.add(assignedId)
      nextAvailableId++
    }

    for (const idx of comp) {
      result[idx] = { ...result[idx], MERGE_GROUP_ID: assignedId }
    }
  }

  return result
}
export function applyTableMove(
  tables: TableLayoutInfo[],
  movedTableNum: number,
  newX: number,
  newY: number,
  _areAdjacent?: (t1: TableLayoutInfo, t2: TableLayoutInfo) => boolean,
): TableLayoutInfo[] {
  const currentTable = tables.find((t) => t.TABLE_NUM === movedTableNum)
  if (!currentTable) return tables

  const movedTable: TableLayoutInfo = {
    ...currentTable,
    X_POS: newX,
    Y_POS: newY,
  }

  return tables.map((t) => (t.TABLE_NUM === movedTableNum ? movedTable : t))
}

export interface MergeGroupVisualBox {
  type: 'box'
  groupId: number
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export interface MergeGroupVisualChain {
  type: 'chain'
  groupId: number
  links: Array<{
    x1: number
    y1: number
    x2: number
    y2: number
    fromTable: number
    toTable: number
  }>
  nodes: Array<{
    cx: number
    cy: number
    tableNum: number
  }>
}

export type MergeGroupVisual = MergeGroupVisualBox | MergeGroupVisualChain

export default function TableManager() {
  // Presets & Layout State
  const [presets, setPresets] = useState<TableLayoutPreset[]>([])
  const [activePresetId, setActivePresetId] = useState<number | null>(null)
  const [layoutTables, setLayoutTables] = useState<TableLayoutInfo[]>([])
  const [restaurantTables, setRestaurantTables] = useState<RestaurantTableData[]>([])

  // Editor State
  const [isEditMode, setIsEditMode] = useState(false)
  const [isQrPrintMode, setIsQrPrintMode] = useState(false)
  const [selectedForPrintTableNums, setSelectedForPrintTableNums] = useState<Set<number>>(new Set())
  const [selectedTableNum, setSelectedTableNum] = useState<number | null>(null)
  const [selectedTableNums, setSelectedTableNums] = useState<Set<number>>(new Set())
  const [activeOrderTableNums, setActiveOrderTableNums] = useState<Set<number>>(new Set())
  const [marqueeBox, setMarqueeBox] = useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null)
  const isMarqueeActiveRef = useRef(false)
  const marqueeStartRef = useRef<{ x: number; y: number } | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const lastMutationTimeRef = useRef<number>(0)
  const { activeEvent, isEventActive } = useActiveEvent()

  // ── Navigation Guard: block route changes when there are unsaved edits ──
  const shouldBlock = isDirty
  const blocker = useBlocker(shouldBlock)

  // Guard browser close / refresh
  useEffect(() => {
    if (!shouldBlock) return
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [shouldBlock])

  // Dragging & Container Dimension State
  const [dragState, setDragState] = useState<DragState | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerDimensions, setContainerDimensions] = useState({ width: 800, height: 600 })

  const activePresetIdRef = useRef<number | null>(null)
  activePresetIdRef.current = activePresetId

  const dragStateRef = useRef<DragState | null>(null)
  dragStateRef.current = dragState

  // Modals & Toast
  const [newPresetModalOpen, setNewPresetModalOpen] = useState(false)
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean
    title: string
    message: string
    confirmLabel?: string
    cancelLabel?: string
    variant?: 'danger' | 'warning' | 'primary'
    onConfirm: () => void
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  })
  const [renameModal, setRenameModal] = useState<{
    isOpen: boolean
    presetId: number | null
    currentName: string
    currentMaxPax: number
  }>({
    isOpen: false,
    presetId: null,
    currentName: '',
    currentMaxPax: 50,
  })
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

  // Admin Interface Tabs & Modals
  const [activeAdminTab, setActiveAdminTab] = useState<TableManagerAdminTab>('layout')
  const [removeAllModalOpen, setRemoveAllModalOpen] = useState(false)
  const [autoAllocModalOpen, setAutoAllocModalOpen] = useState(false)
  const [adminAuthModalOpen, setAdminAuthModalOpen] = useState(false)
  const [pendingAdminAction, setPendingAdminAction] = useState<(() => void | Promise<void>) | null>(null)
  const [activeLabels, setActiveLabels] = useState<TableLabel[]>([])

  const activeLabelMap = useMemo(() => {
    const map = new Map<number, TableLabel>()
    activeLabels.forEach((l) => map.set(l.LABEL_ID, l))
    return map
  }, [activeLabels])

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  // Compute dynamic cell size and dimensions (~30% reduced grid count for venue capacity 50)
  const cellSize = useMemo(() => {
    if (containerDimensions.height <= 0) return 48
    // 13 vertical divisions ensures generous, clear table sizes and minimal unused grid space
    return Math.max(24, Math.floor(containerDimensions.height / 13))
  }, [containerDimensions.height])

  const gridWidth = useMemo(() => {
    if (containerDimensions.width <= 0) return 24
    return Math.max(8, Math.floor(containerDimensions.width / cellSize))
  }, [containerDimensions.width, cellSize])

  const gridHeight = useMemo(() => {
    if (containerDimensions.height <= 0) return 13
    return Math.max(6, Math.floor(containerDimensions.height / cellSize))
  }, [containerDimensions.height, cellSize])

  // Dynamic Active Preset & Maximum Pax
  const activePreset = useMemo(
    () => presets.find((p) => p.LAYOUT_PRESET_ID === activePresetId) ?? null,
    [presets, activePresetId],
  )
  const activePresetMaxPax = activePreset?.MAX_PAX ? Number(activePreset.MAX_PAX) : 50
  const activePresetMaxPaxRef = useRef(activePresetMaxPax)
  activePresetMaxPaxRef.current = activePresetMaxPax

  // Effective layout tables taking active drag position into account
  const effectiveLayoutTables = useMemo(() => {
    if (!dragState) return layoutTables
    return layoutTables.map((t) =>
      t.TABLE_NUM === dragState.tableNum ? { ...t, X_POS: dragState.currentX, Y_POS: dragState.currentY } : t
    )
  }, [layoutTables, dragState])

  // Chair suppression map computed reactively
  const chairSuppressionMap = useMemo(() => {
    return calculateLayoutSuppression(effectiveLayoutTables)
  }, [effectiveLayoutTables])

  // Base capacities map (preserves individual configured base capacities even when merged)
  const baseCapacitiesMap = useMemo(() => {
    const map = new Map<number, number>()
    for (const t of layoutTables) {
      const defaultCap = calculateTableBaseCapacity(t.TABLE_NUM, t.TABLE_TYPE)
      const base = t.TABLE_CAPACITY ?? defaultCap
      map.set(t.TABLE_NUM, base)
    }
    return map
  }, [layoutTables])

  // Live nodes representing all tables on floor plan
  const mergedNodes: MergedTableNode[] = useMemo(() => {
    return effectiveLayoutTables.map((lt) => {
      const live = restaurantTables.find((rt) => rt.TABLE_NUM === lt.TABLE_NUM)
      const effCap = calculateTableEffectiveCapacity(lt, chairSuppressionMap, baseCapacitiesMap)

      return {
        ...lt,
        MERGE_GROUP_ID: lt.MERGE_GROUP_ID ?? null,
        STATUS: live?.STATUS ?? 'AVAILABLE',
        CURRENT_GUEST_COUNT: live?.CURRENT_GUEST_COUNT ?? 0,
        GUEST_CAPACITY: effCap,
        BILL_OUT_REQUESTED: live?.BILL_OUT_REQUESTED ?? false,
        TABLE_ID: live?.TABLE_ID ?? lt.TABLE_NUM,
      }
    })
  }, [effectiveLayoutTables, restaurantTables, chairSuppressionMap, baseCapacitiesMap])

  // Total allocated capacity across current tables (direct sum of all active tables on canvas)
  const totalAllocatedCapacity = useMemo(() => {
    return mergedNodes.reduce((sum, node) => sum + (node.GUEST_CAPACITY ?? 0), 0)
  }, [mergedNodes])

  // Helper to synchronize Restaurant_Tables capacity with layout and clamp to preset maxPax
  const syncRestaurantTablesWithLayout = useCallback((
    newLayout: TableLayoutInfo[],
    suppMap: Map<number, ChairSuppressionInfo>,
    prevLiveTables: RestaurantTableData[],
    overrideMaxPax?: number,
    baseCaps?: Map<number, number>,
  ): RestaurantTableData[] => {
    const maxPax = overrideMaxPax ?? activePresetMaxPaxRef.current ?? 50

    // 1. Build base capacities map for new layout
    const baseMap = new Map<number, number>()
    for (const t of newLayout) {
      const defaultCap = calculateTableBaseCapacity(t.TABLE_NUM, t.TABLE_TYPE)
      const base = baseCaps?.get(t.TABLE_NUM) ?? t.TABLE_CAPACITY ?? defaultCap
      baseMap.set(t.TABLE_NUM, base)
    }

    // 2. Resolve overflow to ensure layout fits within maxPax
    const resolvedBases = resolveLayoutCapacityOverflow(newLayout, suppMap, baseMap, maxPax)

    // 3. For each table in newLayout, calculate its effective capacity
    const mapped: RestaurantTableData[] = newLayout.map((t) => {
      const existing = prevLiveTables.find((r) => r.TABLE_NUM === t.TABLE_NUM)
      const effectiveCap = calculateTableEffectiveCapacity(t, suppMap, resolvedBases)

      return {
        TABLE_ID: existing?.TABLE_ID ?? t.TABLE_NUM,
        TABLE_NUM: t.TABLE_NUM,
        STATUS: (existing?.STATUS ?? 'AVAILABLE') as RestaurantTableData['STATUS'],
        GUEST_CAPACITY: effectiveCap,
        CURRENT_GUEST_COUNT: existing?.CURRENT_GUEST_COUNT ?? 0,
        RESERVED_SINCE: existing?.RESERVED_SINCE ?? null,
        BILL_OUT_REQUESTED: existing?.BILL_OUT_REQUESTED ?? false,
        MERGE_GROUP_ID: t.MERGE_GROUP_ID,
      }
    })

    return mapped
  }, [])

  // Track container resize to keep 100% fit without scrollbars
  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        if (width > 0 && height > 0) {
          setContainerDimensions({ width, height })
        }
      }
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  // ── 1. Initial Data Load ──
  const loadInitialData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [allPresets, liveTables, labelsData] = await Promise.all([
        fetchAllLayoutPresets(),
        fetchLiveRestaurantTables(),
        fetchActiveLabels(),
      ])
      setPresets(allPresets)
      setActiveLabels(labelsData)
      void refreshActiveOrders()

      if (allPresets.length > 0) {
        const defaultPreset = allPresets.find((p) => p.IS_DEFAULT) || allPresets[0]
        setActivePresetId(defaultPreset.LAYOUT_PRESET_ID)
        const layoutData = await fetchPresetLayout(defaultPreset.LAYOUT_PRESET_ID)
        setLayoutTables(layoutData)
        // If liveTables are missing tables from layoutData, sync them
        const missingTables = layoutData.some((lt) => !liveTables.some((rt) => rt.TABLE_NUM === lt.TABLE_NUM))
        if (missingTables) {
          try {
            await savePresetLayout(defaultPreset.LAYOUT_PRESET_ID, layoutData, undefined, defaultPreset.MAX_PAX ?? 50)
            const refreshedLive = await fetchLiveRestaurantTables()
            setRestaurantTables(refreshedLive)
          } catch {
            // Ignore
          }
        }
      } else {
        const created = await createLayoutPreset('Main Dining Hall', 50, gridWidth, gridHeight, true)
        setPresets([created])
        setActivePresetId(created.LAYOUT_PRESET_ID)
        const { layoutTables: distributedTables, baseCapacities: distributedCaps } = distributePresetTables(50, gridWidth, gridHeight)
        await savePresetLayout(created.LAYOUT_PRESET_ID, distributedTables, distributedCaps, 50)
        setLayoutTables(distributedTables)
      }
      setIsDirty(false)
    } catch (err) {
      console.error('Error loading table manager data:', err)
      showToast('Failed to load table layouts', 'error')
    } finally {
      setIsLoading(false)
    }
  }, [gridWidth, gridHeight])

  const refreshActiveOrders = useCallback(async () => {
    try {
      const { data: orders } = await supabase
        .from('Restaurant_Orders')
        .select('TABLE_ID')
        .in('ORDER_STATUS', ['REQUESTED', 'VERIFIED', 'PREPARING', 'READY', 'SERVED', 'COMPLETED'])

      const live = await fetchLiveRestaurantTables()
      const liveIdToNum = new Map(live.map((t) => [t.TABLE_ID, t.TABLE_NUM]))
      const occupiedNums = new Set<number>()

      for (const t of live) {
        if (
          t.STATUS === 'OCCUPIED' ||
          t.STATUS === 'HAS_REQUEST' ||
          (t.CURRENT_GUEST_COUNT && t.CURRENT_GUEST_COUNT > 0)
        ) {
          occupiedNums.add(t.TABLE_NUM)
        }
      }

      for (const o of orders ?? []) {
        const tableId = Number(o.TABLE_ID)
        const tableNum = liveIdToNum.get(tableId) ?? tableId
        occupiedNums.add(tableNum)
      }

      setActiveOrderTableNums(occupiedNums)
    } catch (err) {
      console.warn('[TableManager] Failed to fetch active orders:', err)
    }
  }, [])

  useEffect(() => {
    loadInitialData()
  }, [loadInitialData])

  // ── 2. Realtime Subscription to Live Tables, Presets & Orders ──
  useEffect(() => {
    const channel = supabase
      .channel('table-manager-live-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'tables', table: 'Restaurant_Tables' },
        async () => {
          // If we recently performed a local optimistic mutation or are actively dragging/selecting, skip override
          if (
            Date.now() - lastMutationTimeRef.current < 4000 ||
            dragStateRef.current !== null ||
            isMarqueeActiveRef.current
          ) {
            return
          }
          try {
            const updated = await fetchLiveRestaurantTables()
            setRestaurantTables(updated)
            void refreshActiveOrders()
          } catch (err) {
            console.error('Error in live tables realtime sync:', err)
          }
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'Restaurant_Orders' },
        () => {
          void refreshActiveOrders()
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'tables', table: 'Table_Layout_Presets' },
        async () => {
          try {
            const allPresets = await fetchAllLayoutPresets()
            setPresets(allPresets)

            // If an external event or user changed the default preset to a different preset ID, switch to it
            const defaultPreset = allPresets.find((p) => p.IS_DEFAULT) || allPresets[0]
            if (
              defaultPreset &&
              defaultPreset.LAYOUT_PRESET_ID !== activePresetIdRef.current &&
              !isDirty &&
              dragStateRef.current === null &&
              !isMarqueeActiveRef.current &&
              Date.now() - lastMutationTimeRef.current >= 4000
            ) {
              setActivePresetId(defaultPreset.LAYOUT_PRESET_ID)
              const [layoutData, live] = await Promise.all([
                fetchPresetLayout(defaultPreset.LAYOUT_PRESET_ID),
                fetchLiveRestaurantTables(),
              ])
              setLayoutTables(layoutData)
              setRestaurantTables(live)
            }
          } catch (err) {
            console.error('Error in presets realtime sync:', err)
          }
        },
      )
      .subscribe()

    const handleBroadcastSync = async (e: Event) => {
      try {
        const detail = (e as CustomEvent<{ type?: string; presetId?: number }>).detail

        // If local mutation was done recently or dragging/selection is active, skip
        if (
          Date.now() - lastMutationTimeRef.current < 4000 ||
          dragStateRef.current !== null ||
          isMarqueeActiveRef.current
        ) {
          return
        }

        const [allPresets, live] = await Promise.all([
          fetchAllLayoutPresets(),
          fetchLiveRestaurantTables(),
        ])
        setPresets(allPresets)
        setRestaurantTables(live)
        void refreshActiveOrders()

        const targetPresetId = detail?.presetId
        if (
          targetPresetId &&
          targetPresetId !== activePresetIdRef.current &&
          !isDirty
        ) {
          setActivePresetId(targetPresetId)
          const layoutData = await fetchPresetLayout(targetPresetId)
          setLayoutTables(layoutData)
        }
      } catch (err) {
        console.warn('Error handling broadcast sync in TableManager:', err)
      }
    }
    window.addEventListener('monolith-order-update', handleBroadcastSync)

    return () => {
      void supabase.removeChannel(channel)
      window.removeEventListener('monolith-order-update', handleBroadcastSync)
    }
  }, [isDirty, refreshActiveOrders])

  // ── 3. Switch Active Preset ──
  const performSelectPreset = async (presetId: number) => {
    setIsLoading(true)
    try {
      setActivePresetId(presetId)
      setSelectedTableNum(null)
      await setDefaultLayoutPreset(presetId)
      const [layoutData, liveTables] = await Promise.all([
        fetchPresetLayout(presetId),
        fetchLiveRestaurantTables(),
      ])
      setLayoutTables(layoutData)
      setRestaurantTables(liveTables)
      setIsDirty(false)
      setPresets((prev) =>
        prev.map((p) => ({
          ...p,
          IS_DEFAULT: p.LAYOUT_PRESET_ID === presetId,
        }))
      )
    } catch (err) {
      console.error('Failed to load preset layout:', err)
      showToast('Failed to load preset layout', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectPreset = (presetId: number) => {
    if (presetId === activePresetId) return
    if (isEventActive) {
      showToast(
        `Cannot switch layout preset while event "${activeEvent?.title ?? 'Active Event'}" is active. Deactivate the event in Events first.`,
        'error',
      )
      return
    }
    if (isDirty) {
      setConfirmModal({
        isOpen: true,
        title: 'Unsaved Changes',
        message: 'You have unsaved changes on the current layout. Discard changes and switch preset?',
        confirmLabel: 'Discard & Switch',
        variant: 'warning',
        onConfirm: () => {
          setConfirmModal((prev) => ({ ...prev, isOpen: false }))
          void performSelectPreset(presetId)
        },
      })
      return
    }
    void performSelectPreset(presetId)
  }

  // ── 4. Rename / Edit Preset ──
  const handleRenamePreset = (presetId: number, currentName: string) => {
    const targetPreset = presets.find((p) => p.LAYOUT_PRESET_ID === presetId)
    setRenameModal({
      isOpen: true,
      presetId,
      currentName,
      currentMaxPax: targetPreset?.MAX_PAX != null ? Number(targetPreset.MAX_PAX) : 50,
    })
  }

  const handleConfirmRename = async (newName: string, newMaxPax: number) => {
    if (!renameModal.presetId) return
    const id = renameModal.presetId
    const { updateLayoutPresetMaxPax } = await import('@/services/tableLayoutService')
    await updateLayoutPresetName(id, newName)
    if (newMaxPax != null && newMaxPax > 0) {
      await updateLayoutPresetMaxPax(id, newMaxPax)
    }
    setPresets((prev) =>
      prev.map((p) =>
        p.LAYOUT_PRESET_ID === id
          ? {
              ...p,
              PRESET_NAME: newName,
              MAX_PAX: newMaxPax != null && newMaxPax > 0 ? newMaxPax : p.MAX_PAX,
            }
          : p,
      ),
    )
    showToast(`Preset updated successfully`, 'success')
  }

  // ── 5. Delete Preset ──
  const handleDeletePreset = (presetId: number) => {
    if (isEventActive) {
      showToast(
        `Cannot delete or switch layout preset while event "${activeEvent?.title ?? 'Active Event'}" is active.`,
        'error',
      )
      return
    }
    setConfirmModal({
      isOpen: true,
      title: 'Delete Floor Plan',
      message: 'Are you sure you want to delete this floor plan preset? This action cannot be undone.',
      confirmLabel: 'Delete Preset',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }))
        try {
          await deleteLayoutPreset(presetId)
          void logTableAction('PRESET_DELETED', `Deleted layout preset #${presetId}.`, {
            targetEntity: 'PRESET',
            targetId: String(presetId),
          })
          const remaining = presets.filter((p) => p.LAYOUT_PRESET_ID !== presetId)
          setPresets(remaining)
          if (remaining.length > 0) {
            void performSelectPreset(remaining[0].LAYOUT_PRESET_ID)
          }
          showToast('Layout preset deleted', 'success')
        } catch {
          showToast('Failed to delete preset', 'error')
        }
      },
    })
  }

  // ── 5b. Discard Changes ──
  const handleDiscardChanges = () => {
    if (!activePresetId || !isDirty) return
    setConfirmModal({
      isOpen: true,
      title: 'Discard Changes',
      message: 'Are you sure you want to discard all unsaved layout changes and reload the last saved floor plan?',
      confirmLabel: 'Discard Changes',
      variant: 'warning',
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }))
        setIsLoading(true)
        try {
          const layoutData = await fetchPresetLayout(activePresetId)
          setLayoutTables(layoutData)
          setIsDirty(false)
          showToast('Layout changes discarded', 'info')
        } catch {
          showToast('Failed to revert layout', 'error')
        } finally {
          setIsLoading(false)
        }
      },
    })
  }

  // ── 6. Create New Preset ──
  const handleCreatePreset = async (name: string, maxPax: number, isDef: boolean) => {
    if (isEventActive) {
      showToast(
        `Cannot create or switch layout preset while event "${activeEvent?.title ?? 'Active Event'}" is active.`,
        'error',
      )
      return
    }
    const validMaxPax = Math.max(1, Math.round(maxPax))
    const created = await createLayoutPreset(name, validMaxPax, gridWidth, gridHeight, isDef)

    // Automatically distribute tables to match maxPax
    const { layoutTables: distributedTables, baseCapacities: distributedCaps } = distributePresetTables(
      validMaxPax,
      gridWidth,
      gridHeight,
    )

    const initialLayout = distributedTables.map((t) => ({
      ...t,
      LAYOUT_PRESET_ID: created.LAYOUT_PRESET_ID,
    }))

    // Persist layout for preset and synchronize Restaurant_Tables
    try {
      await savePresetLayout(created.LAYOUT_PRESET_ID, initialLayout, distributedCaps, validMaxPax)
    } catch (err) {
      console.warn('Notice when saving initial distributed layout:', err)
    }

    const liveTables = await fetchLiveRestaurantTables()

    setPresets((prev) => {
      if (isDef) {
        return [...prev.map((p) => ({ ...p, IS_DEFAULT: false })), created]
      }
      return [...prev, created]
    })
    setActivePresetId(created.LAYOUT_PRESET_ID)
    setLayoutTables(initialLayout)
    setRestaurantTables(liveTables)
    setIsDirty(false)
    void logTableAction('PRESET_CREATED', `Created layout preset "${name}" with ${validMaxPax} pax capacity.`, {
      targetEntity: 'PRESET',
      targetId: String(created.LAYOUT_PRESET_ID),
      metadata: { name, maxPax: validMaxPax, isDefault: isDef },
    })
    showToast(`Preset "${name}" created with ${validMaxPax} pax capacity`, 'success')
  }

  // ── 7. Add Table from Floating Controls & Directory ──
  const handleAddTable = async (type: TableType, customLabelId?: number | null) => {
    if (!activePresetId) return
    const typeConfig = TABLE_TYPES[type]

    // Validate table type limit at database/business logic level
    const typeValidation = await validateTableTypeCount(type, 1, layoutTables)
    if (!typeValidation.allowed) {
      showToast(typeValidation.message || `Maximum limit reached for ${typeConfig.name}.`, 'error')
      return
    }

    // Check venue capacity
    const remainingVenueCap = activePresetMaxPax - totalAllocatedCapacity
    if (remainingVenueCap <= 0) {
      showToast(`Cannot add table: Maximum venue capacity (${activePresetMaxPax} seats) reached`, 'error')
      return
    }

    const assignedCapacity = Math.min(typeConfig.defaultCapacity, remainingVenueCap)

    // Find highest assigned TABLE_NUM
    const existingNums = layoutTables.map((t) => t.TABLE_NUM)
    const nextTableNum = existingNums.length > 0 ? Math.max(...existingNums) + 1 : 1

    // Find first available cell on grid
    let placedX = 1
    let placedY = 1
    let foundSpot = false

    const occupiedCells = new Set<string>()
    for (const t of layoutTables) {
      const cfg = TABLE_TYPES[t.TABLE_TYPE] || TABLE_TYPES[1]
      for (let dx = 0; dx < cfg.width; dx++) {
        for (let dy = 0; dy < cfg.height; dy++) {
          occupiedCells.add(`${t.X_POS + dx},${t.Y_POS + dy}`)
        }
      }
    }

    for (let y = 0; y <= gridHeight - typeConfig.height; y++) {
      for (let x = 0; x <= gridWidth - typeConfig.width; x++) {
        let collides = false
        for (let dx = 0; dx < typeConfig.width; dx++) {
          for (let dy = 0; dy < typeConfig.height; dy++) {
            if (occupiedCells.has(`${x + dx},${y + dy}`)) {
              collides = true
              break
            }
          }
          if (collides) break
        }
        if (!collides) {
          placedX = x
          placedY = y
          foundSpot = true
          break
        }
      }
      if (foundSpot) break
    }

    const newTable: TableLayoutInfo = {
      INFO_ID: `info-${activePresetId}-${nextTableNum}-${Date.now()}`,
      LAYOUT_PRESET_ID: activePresetId,
      TABLE_NUM: nextTableNum,
      TABLE_TYPE: type,
      LABEL_ID: customLabelId ?? null,
      MERGE_GROUP_ID: null,
      X_POS: placedX,
      Y_POS: placedY,
      TABLE_CAPACITY: assignedCapacity,
    }

    const updatedLayout = [...layoutTables, newTable]
    setLayoutTables(updatedLayout)
    setRestaurantTables((prev) => [
      ...prev,
      {
        TABLE_ID: nextTableNum,
        TABLE_NUM: nextTableNum,
        STATUS: 'AVAILABLE',
        GUEST_CAPACITY: assignedCapacity,
        CURRENT_GUEST_COUNT: 0,
        RESERVED_SINCE: null,
        BILL_OUT_REQUESTED: false,
        LABEL_ID: customLabelId ?? null,
        MERGE_GROUP_ID: null,
      },
    ])
    setSelectedTableNum(nextTableNum)

    // Automatically persist to database if not in manual edit mode
    if (!isEditMode && activePresetId) {
      try {
        const capacityMap = new Map<number, number>()
        for (const t of updatedLayout) {
          capacityMap.set(t.TABLE_NUM, t.TABLE_CAPACITY ?? TABLE_TYPES[t.TABLE_TYPE]?.defaultCapacity ?? 4)
        }
        await savePresetLayout(activePresetId, updatedLayout, capacityMap, activePresetMaxPax)
        const refreshedLive = await fetchLiveRestaurantTables()
        setRestaurantTables(refreshedLive)
        setIsDirty(false)
        void logTableAction('TABLE_CREATED', `Table ${nextTableNum} (${typeConfig.name}) added and saved to database.`)
        showToast(`Added ${typeConfig.name} #${nextTableNum} (${assignedCapacity} seats) — Saved`, 'success')
        return
      } catch (err) {
        console.error('Failed to auto-save added table:', err)
        setIsDirty(true)
        showToast(`Added ${typeConfig.name} #${nextTableNum} (unsaved)`, 'info')
        return
      }
    }

    setIsDirty(true)
    void logTableAction('TABLE_CREATED', `Table ${nextTableNum} (${typeConfig.name}) added to layout.`)
    showToast(`Added ${typeConfig.name} #${nextTableNum} (${assignedCapacity} seats)`, 'info')
  }

  // ── 8. Change Table Type (With Automatic Collision Resolution) ──
  const handleChangeTableType = (tableNum: number, newType: TableType) => {
    const newCfg = TABLE_TYPES[newType] || TABLE_TYPES[1]

    setLayoutTables((prev) => {
      const target = prev.find((t) => t.TABLE_NUM === tableNum)
      if (!target) return prev

      // 1. Clamp target position inside grid bounds for new dimensions
      const clampedX = Math.max(0, Math.min(gridWidth - newCfg.width, target.X_POS))
      const clampedY = Math.max(0, Math.min(gridHeight - newCfg.height, target.Y_POS))

      const updatedTarget: TableLayoutInfo = {
        ...target,
        TABLE_TYPE: newType,
        X_POS: clampedX,
        Y_POS: clampedY,
      }

      // 2. Set of cells occupied by target table
      const occupiedByTarget = new Set<string>()
      for (let dx = 0; dx < newCfg.width; dx++) {
        for (let dy = 0; dy < newCfg.height; dy++) {
          occupiedByTarget.add(`${clampedX + dx},${clampedY + dy}`)
        }
      }

      // 3. Check for collisions with other tables and space them out
      const allOccupied = new Set<string>(occupiedByTarget)
      const otherTables = prev.filter((t) => t.TABLE_NUM !== tableNum)
      const adjustedOtherTables: TableLayoutInfo[] = []

      for (const other of otherTables) {
        const otherCfg = TABLE_TYPES[other.TABLE_TYPE] || TABLE_TYPES[1]
        let collides = false

        for (let dx = 0; dx < otherCfg.width; dx++) {
          for (let dy = 0; dy < otherCfg.height; dy++) {
            if (occupiedByTarget.has(`${other.X_POS + dx},${other.Y_POS + dy}`)) {
              collides = true
              break
            }
          }
          if (collides) break
        }

        if (!collides) {
          // No collision with target table, keep in place
          for (let dx = 0; dx < otherCfg.width; dx++) {
            for (let dy = 0; dy < otherCfg.height; dy++) {
              allOccupied.add(`${other.X_POS + dx},${other.Y_POS + dy}`)
            }
          }
          adjustedOtherTables.push(other)
        } else {
          // Collides! Search for nearest free spot using radial search
          let newX = other.X_POS
          let newY = other.Y_POS
          let foundFreeSpot = false

          for (let radius = 1; radius <= Math.max(gridWidth, gridHeight); radius++) {
            for (let dy = -radius; dy <= radius; dy++) {
              for (let dx = -radius; dx <= radius; dx++) {
                if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue
                const testX = other.X_POS + dx
                const testY = other.Y_POS + dy

                if (
                  testX >= 0 &&
                  testY >= 0 &&
                  testX + otherCfg.width <= gridWidth &&
                  testY + otherCfg.height <= gridHeight
                ) {
                  let testCollides = false
                  for (let ox = 0; ox < otherCfg.width; ox++) {
                    for (let oy = 0; oy < otherCfg.height; oy++) {
                      if (allOccupied.has(`${testX + ox},${testY + oy}`)) {
                        testCollides = true
                        break
                      }
                    }
                    if (testCollides) break
                  }

                  if (!testCollides) {
                    newX = testX
                    newY = testY
                    foundFreeSpot = true
                    break
                  }
                }
              }
              if (foundFreeSpot) break
            }
            if (foundFreeSpot) break
          }

          // Register newly adjusted position
          for (let dx = 0; dx < otherCfg.width; dx++) {
            for (let dy = 0; dy < otherCfg.height; dy++) {
              allOccupied.add(`${newX + dx},${newY + dy}`)
            }
          }

          adjustedOtherTables.push({
            ...other,
            X_POS: newX,
            Y_POS: newY,
          })
        }
      }

      const combined = [updatedTarget, ...adjustedOtherTables]
      const suppMap = calculateSuppressionForLayout(combined)

      setRestaurantTables((prev) => syncRestaurantTablesWithLayout(combined, suppMap, prev))

      return combined
    })

    setIsDirty(true)
    showToast(`Table ${tableNum} changed to ${newCfg.name}`, 'info')
  }

  // ── 8b. Rotate Rectangle Table (Toggles Type 2 <=> Type 5) ──
  const handleRotateTable = (tableNum: number) => {
    setLayoutTables((prev) => {
      const target = prev.find((t) => t.TABLE_NUM === tableNum)
      if (!target) return prev
      if (target.TABLE_TYPE !== 2 && target.TABLE_TYPE !== 5) return prev

      const newType: TableType = target.TABLE_TYPE === 2 ? 5 : 2
      const newCfg = TABLE_TYPES[newType]

      const clampedX = Math.max(0, Math.min(gridWidth - newCfg.width, target.X_POS))
      const clampedY = Math.max(0, Math.min(gridHeight - newCfg.height, target.Y_POS))

      const updated = prev.map((t) =>
        t.TABLE_NUM === tableNum
          ? { ...t, TABLE_TYPE: newType, X_POS: clampedX, Y_POS: clampedY }
          : t,
      )

      const suppMap = calculateSuppressionForLayout(updated)
      setRestaurantTables((rPrev) => syncRestaurantTablesWithLayout(updated, suppMap, rPrev))

      return updated
    })
    setIsDirty(true)
    showToast(`Rotated Table ${tableNum}`, 'info')
  }

  // ── 9. Update Seat Count (Cannot exceed max capacity or venue limit) ──
  const handleUpdateSeatCount = async (tableNum: number, seats: number) => {
    lastMutationTimeRef.current = Date.now()
    const target = layoutTables.find((t) => t.TABLE_NUM === tableNum)
    if (!target) return
    const maxCapacity = TABLE_TYPES[target.TABLE_TYPE]?.defaultCapacity || 4

    // Check remaining venue capacity
    const otherTablesCap = layoutTables
      .filter((t) => t.TABLE_NUM !== tableNum)
      .reduce((sum, t) => {
        return sum + (t.TABLE_CAPACITY ?? TABLE_TYPES[t.TABLE_TYPE]?.defaultCapacity ?? 4)
      }, 0)

    const venueMaxForThisTable = Math.max(1, activePresetMaxPax - otherTablesCap)
    const clampedSeats = Math.max(1, Math.min(maxCapacity, venueMaxForThisTable, seats))

    const updatedLayout = layoutTables.map((t) =>
      t.TABLE_NUM === tableNum ? { ...t, TABLE_CAPACITY: clampedSeats } : t,
    )
    const suppMap = calculateSuppressionForLayout(updatedLayout)
    const baseCaps = new Map<number, number>()
    for (const t of updatedLayout) {
      baseCaps.set(t.TABLE_NUM, t.TABLE_CAPACITY ?? calculateTableBaseCapacity(t.TABLE_NUM, t.TABLE_TYPE))
    }
    const updatedRest = syncRestaurantTablesWithLayout(
      updatedLayout,
      suppMap,
      restaurantTables,
      activePresetMaxPax,
      baseCaps,
    )
    setLayoutTables(updatedLayout)
    setRestaurantTables(updatedRest)

    try {
      await updateTableCapacity(tableNum, clampedSeats)
      if (!isEditMode && activePresetId) {
        const capacityMap = new Map<number, number>()
        for (const t of updatedLayout) {
          capacityMap.set(t.TABLE_NUM, t.TABLE_CAPACITY ?? TABLE_TYPES[t.TABLE_TYPE]?.defaultCapacity ?? 4)
        }
        await savePresetLayout(activePresetId, updatedLayout, capacityMap, activePresetMaxPax)
        setIsDirty(false)
      } else {
        setIsDirty(true)
      }
    } catch (err) {
      console.error('Failed to update table capacity:', err)
      setIsDirty(true)
    }
  }

  // ── 9b. Update Live Guest Count (View Mode & Live Ops) ──
  const handleUpdateGuestCount = async (tableNum: number, count: number) => {
    lastMutationTimeRef.current = Date.now()
    setRestaurantTables((prev) =>
      prev.map((r) => (r.TABLE_NUM === tableNum ? { ...r, CURRENT_GUEST_COUNT: count } : r)),
    )
    try {
      await updateTableGuestCount(tableNum, count)
    } catch (err) {
      console.error('Failed to update guest count:', err)
      showToast('Failed to update guest count', 'error')
    }
  }

  // ── 9c. Update Live Table Status (View Mode & Live Ops) ──
  const handleUpdateStatus = async (
    tableNum: number,
    status: RestaurantTableData['STATUS'],
  ) => {
    lastMutationTimeRef.current = Date.now()
    setRestaurantTables((prev) =>
      prev.map((r) => (r.TABLE_NUM === tableNum ? { ...r, STATUS: status } : r)),
    )
    try {
      await updateTableStatus(tableNum, status)
      showToast(`Table ${tableNum} marked as ${status.toLowerCase()}`, 'success')
    } catch (err) {
      console.error('Failed to update table status:', err)
      showToast('Failed to update table status', 'error')
    }
  }

  // ── 10. Delete Selected Table ──
  const handleDeleteTable = async (tableNum: number) => {
    const remaining = layoutTables.filter((t) => t.TABLE_NUM !== tableNum)
    const groupCounts = new Map<number, number>()
    for (const t of remaining) {
      if (t.MERGE_GROUP_ID != null) {
        groupCounts.set(t.MERGE_GROUP_ID, (groupCounts.get(t.MERGE_GROUP_ID) || 0) + 1)
      }
    }
    const result = remaining.map((t) => {
      if (t.MERGE_GROUP_ID != null && (groupCounts.get(t.MERGE_GROUP_ID) || 0) < 2) {
        return { ...t, MERGE_GROUP_ID: null }
      }
      return t
    })
    const suppMap = calculateSuppressionForLayout(result)

    setLayoutTables(result)
    setRestaurantTables((rPrev) =>
      syncRestaurantTablesWithLayout(
        result,
        suppMap,
        rPrev.filter((r) => r.TABLE_NUM !== tableNum),
      ),
    )
    setSelectedTableNum(null)
    setSelectedTableNums((prev) => {
      const next = new Set(prev)
      next.delete(tableNum)
      return next
    })

    if (!isEditMode && activePresetId) {
      try {
        const capacityMap = new Map<number, number>()
        for (const t of result) {
          capacityMap.set(t.TABLE_NUM, t.TABLE_CAPACITY ?? TABLE_TYPES[t.TABLE_TYPE]?.defaultCapacity ?? 4)
        }
        await savePresetLayout(activePresetId, result, capacityMap, activePresetMaxPax)
        const refreshedLive = await fetchLiveRestaurantTables()
        setRestaurantTables(refreshedLive)
        setIsDirty(false)
        void logTableAction('TABLE_DELETED', `Table ${tableNum} removed and saved to database.`)
        showToast(`Removed Table ${tableNum} — Saved`, 'info')
        return
      } catch (err) {
        console.error('Failed to auto-save table removal:', err)
        setIsDirty(true)
        showToast(`Removed Table ${tableNum} (unsaved)`, 'info')
        return
      }
    }

    setIsDirty(true)
    showToast(`Removed Table ${tableNum}`, 'info')
  }

  // ── 11b. Remove All Tables ──
  const handleConfirmRemoveAll = async () => {
    try {
      const res = await removeAllTables()
      const blockedNums = new Set(res.blocked.map((b) => b.num))
      const remaining = layoutTables.filter((t) => blockedNums.has(t.TABLE_NUM))
      setLayoutTables(remaining)
      setSelectedTableNum(null)
      setSelectedTableNums(new Set())
      if (activePresetId) {
        await savePresetLayout(activePresetId, remaining, undefined, activePresetMaxPax)
      }
      const refreshedLive = await fetchLiveRestaurantTables()
      setRestaurantTables(refreshedLive)
      void logTableAction('ALL_TABLES_DELETED', `Removed ${res.deleted.length} tables from layout.`)
      if (res.blocked.length > 0) {
        showToast(
          `Removed ${res.deleted.length} tables. ${res.blocked.length} table(s) retained due to active orders.`,
          'info',
        )
      } else {
        showToast(`Successfully removed all ${res.deleted.length} tables.`, 'success')
      }
    } catch (err) {
      console.error('Error removing all tables:', err)
      showToast('Failed to remove tables.', 'error')
    }
  }

  // ── 11c. Apply Auto Layout ──
  const handleApplyAutoLayout = async (allocatedTables: TableLayoutInfo[]) => {
    try {
      setLayoutTables(allocatedTables)
      setSelectedTableNum(null)
      setSelectedTableNums(new Set())
      const baseMap = new Map<number, number>()
      allocatedTables.forEach((t) => baseMap.set(t.TABLE_NUM, t.TABLE_CAPACITY ?? 4))
      if (activePresetId) {
        await savePresetLayout(activePresetId, allocatedTables, baseMap, activePresetMaxPax)
      }
      const refreshedLive = await fetchLiveRestaurantTables()
      setRestaurantTables(refreshedLive)
      setIsDirty(false)
      void logTableAction('LAYOUT_CHANGED', `Applied automatic table allocation (${allocatedTables.length} tables).`)
      showToast(`Automatically allocated ${allocatedTables.length} tables.`, 'success')
    } catch (err) {
      console.error('Error applying auto layout:', err)
      showToast('Failed to apply allocated layout.', 'error')
    }
  }

  // ── 11d. Admin Auth Execution ──
  const handleAdminAuthSuccess = async () => {
    setAdminAuthModalOpen(false)
    if (pendingAdminAction) {
      await pendingAdminAction()
      setPendingAdminAction(null)
    }
  }

  // ── 11e. Set Default Layout Preset (Protected Admin Operation) ──
  const handleSetDefaultPreset = (presetId: number) => {
    const targetPreset = presets.find((p) => p.LAYOUT_PRESET_ID === presetId)
    setPendingAdminAction(() => async () => {
      try {
        await setDefaultLayoutPreset(presetId)
        await loadInitialData()
        void logTableAction('DEFAULT_LAYOUT_MODIFIED', `Set preset "${targetPreset?.PRESET_NAME}" as default layout.`)
        showToast(`Preset "${targetPreset?.PRESET_NAME}" set as default.`, 'success')
      } catch (err) {
        showToast('Failed to set default preset.', 'error')
      }
    })
    setAdminAuthModalOpen(true)
  }

  // ── 11f. Label Assignment on Directory ──
  const handleLabelAssigned = async (tableNum: number, labelId: number | null) => {
    setLayoutTables((prev) =>
      prev.map((t) => (t.TABLE_NUM === tableNum ? { ...t, LABEL_ID: labelId } : t)),
    )
    setRestaurantTables((prev) =>
      prev.map((r) => (r.TABLE_NUM === tableNum ? { ...r, LABEL_ID: labelId } : r)),
    )

    const liveTarget = restaurantTables.find((r) => r.TABLE_NUM === tableNum)
    const targetTableId = liveTarget?.TABLE_ID ?? tableNum
    try {
      await assignLabelToTable(targetTableId, labelId)
      if (!isEditMode && activePresetId) {
        try {
          await supabase
            .schema('tables')
            .from('Table_Layout_Info')
            .update({ LABEL_ID: labelId })
            .eq('LAYOUT_PRESET_ID', activePresetId)
            .eq('TABLE_NUM', tableNum)
        } catch {
          // Ignore if column not present yet
        }
        setIsDirty(false)
      } else {
        setIsDirty(true)
      }
    } catch (err) {
      console.error('Failed to persist label assignment:', err)
      setIsDirty(true)
    }
  }

  // ── 12. Update Table Number ──
  const handleUpdateTableNum = (oldNum: number, newNum: number) => {
    if (oldNum === newNum) return
    if (layoutTables.some((t) => t.TABLE_NUM === newNum)) {
      showToast(`Table number ${newNum} is already in use`, 'error')
      return
    }
    setLayoutTables((prev) =>
      prev.map((t) => (t.TABLE_NUM === oldNum ? { ...t, TABLE_NUM: newNum } : t)),
    )
    setSelectedTableNum(newNum)
    setSelectedTableNums((prev) => {
      const next = new Set(prev)
      if (next.has(oldNum)) {
        next.delete(oldNum)
        next.add(newNum)
      }
      return next
    })
    setIsDirty(true)
  }

  // ── 13. Unmerge Table (In-place unmerging without table displacement) ──
  const handleUnmergeTable = async (tableNum: number) => {
    lastMutationTimeRef.current = Date.now()
    const target = layoutTables.find((t) => t.TABLE_NUM === tableNum)
    if (!target || target.MERGE_GROUP_ID == null) return
    const currentMergeId = target.MERGE_GROUP_ID

    const groupMembers = layoutTables.filter((t) => t.MERGE_GROUP_ID === currentMergeId)

    // Check if any member in this merge group has active orders or seated guests
    const memberNums = groupMembers.map((m) => m.TABLE_NUM)
    const memberIds = groupMembers.map((m) => {
      const live = restaurantTables.find((r) => r.TABLE_NUM === m.TABLE_NUM)
      return live?.TABLE_ID ?? m.TABLE_NUM
    })

    try {
      const { data: activeOrders } = await supabase
        .from('Restaurant_Orders')
        .select('ORDER_ID')
        .in('TABLE_ID', [...new Set([...memberIds, ...memberNums])])
        .in('ORDER_STATUS', ['REQUESTED', 'VERIFIED', 'PREPARING', 'READY', 'SERVED', 'COMPLETED'])

      const hasOccupied = restaurantTables.some(
        (r) =>
          memberNums.includes(r.TABLE_NUM) &&
          (r.STATUS === 'OCCUPIED' || r.STATUS === 'HAS_REQUEST' || (r.CURRENT_GUEST_COUNT && r.CURRENT_GUEST_COUNT > 0)),
      )

      if ((activeOrders && activeOrders.length > 0) || hasOccupied) {
        showToast(
          `Cannot unmerge Group #${currentMergeId}: Table has active order(s) or seated guests. Settle or void orders first.`,
          'error',
        )
        return
      }
    } catch (err) {
      console.warn('Active orders check before unmerge:', err)
    }

    const remainingMembers = groupMembers.filter((t) => t.TABLE_NUM !== tableNum)

    let updatedLayout: TableLayoutInfo[]
    if (remainingMembers.length <= 1) {
      // If only 1 table remains in group, clear merge group for all members of this group
      updatedLayout = layoutTables.map((t) => {
        if (t.MERGE_GROUP_ID === currentMergeId) {
          return { ...t, MERGE_GROUP_ID: null }
        }
        return t
      })
    } else {
      // 2 or more remain in group, preserve existing currentMergeId for the group
      updatedLayout = layoutTables.map((t) => {
        if (t.TABLE_NUM === tableNum) {
          return { ...t, MERGE_GROUP_ID: null }
        }
        return t
      })
    }

    const suppMap = calculateSuppressionForLayout(updatedLayout)
    const { updatedBaseCapacities, updatedLayout: finalLayout } = deductMovedTableOnOverflow(
      tableNum,
      updatedLayout,
      suppMap,
      baseCapacitiesMap,
      activePresetMaxPax,
    )
    const updatedRest = syncRestaurantTablesWithLayout(finalLayout, suppMap, restaurantTables, activePresetMaxPax, updatedBaseCapacities)

    setLayoutTables(finalLayout)
    setRestaurantTables(updatedRest)

    if (!isEditMode && activePresetId) {
      try {
        const capacityMap = new Map<number, number>()
        for (const r of updatedRest) {
          capacityMap.set(r.TABLE_NUM, r.GUEST_CAPACITY)
        }
        await savePresetLayout(activePresetId, finalLayout, capacityMap, activePresetMaxPax)
        showToast(`Table ${tableNum} unmerged`, 'info')
      } catch (err) {
        console.error('Failed to save unmerge in view mode:', err)
        showToast('Failed to unmerge table', 'error')
      }
    } else {
      setIsDirty(true)
      showToast(`Table ${tableNum} unmerged`, 'info')
    }
  }

  // ── 13b. Merge Multi-Selected Tables (Floating Button in View/Edit Mode) ──
  const handleMergeSelectedTables = async () => {
    if (selectedTableNums.size < 2) return
    lastMutationTimeRef.current = Date.now()

    const selectedList = Array.from(selectedTableNums)

    // Collect all existing merge group IDs currently assigned across all tables
    const existingGroupIds = new Set(
      layoutTables
        .map((t) => t.MERGE_GROUP_ID)
        .filter((gid): gid is number => gid != null && gid > 0),
    )

    // Check if any of the selected tables already belongs to an existing merge group
    const selectedExisting = layoutTables
      .filter((t) => selectedTableNums.has(t.TABLE_NUM) && t.MERGE_GROUP_ID != null)
      .map((t) => t.MERGE_GROUP_ID!)

    let targetMergeGroupId: number
    if (selectedExisting.length > 0) {
      targetMergeGroupId = selectedExisting[0]
    } else {
      targetMergeGroupId = 1
      while (existingGroupIds.has(targetMergeGroupId)) {
        targetMergeGroupId++
      }
    }

    const updatedLayout = layoutTables.map((t) => {
      if (selectedTableNums.has(t.TABLE_NUM)) {
        return { ...t, MERGE_GROUP_ID: targetMergeGroupId }
      }
      return t
    })

    const suppMap = calculateSuppressionForLayout(updatedLayout)
    const updatedRest = syncRestaurantTablesWithLayout(
      updatedLayout,
      suppMap,
      restaurantTables,
      activePresetMaxPax,
      baseCapacitiesMap,
    )

    setLayoutTables(updatedLayout)
    setRestaurantTables(updatedRest)
    setSelectedTableNums(new Set())

    if (!isEditMode && activePresetId) {
      try {
        const capacityMap = new Map<number, number>()
        for (const r of updatedRest) {
          capacityMap.set(r.TABLE_NUM, r.GUEST_CAPACITY)
        }
        await savePresetLayout(activePresetId, updatedLayout, capacityMap, activePresetMaxPax)
        showToast(`Merged ${selectedList.length} tables into Group #${targetMergeGroupId}`, 'success')
      } catch (err) {
        console.error('Failed to save merged tables:', err)
        showToast('Failed to merge tables', 'error')
      }
    } else {
      setIsDirty(true)
      showToast(`Merged ${selectedList.length} tables into Group #${targetMergeGroupId}`, 'success')
    }
  }

  // ── 14. Save Layout ──
  const handleSaveLayout = async () => {
    if (!activePresetId) return
    setIsSaving(true)
    try {
      const capacityMap = new Map<number, number>()
      for (const r of restaurantTables) {
        capacityMap.set(r.TABLE_NUM, r.GUEST_CAPACITY)
      }
      await savePresetLayout(activePresetId, layoutTables, capacityMap, activePresetMaxPax)
      setIsDirty(false)
      setIsEditMode(false)
      setSelectedTableNum(null)
      setSelectedTableNums(new Set())
      showToast('Floor plan layout saved successfully!', 'success')
      const updated = await fetchLiveRestaurantTables()
      setRestaurantTables(updated)
    } catch (err) {
      console.error('Failed to save layout:', err)
      showToast('Failed to save floor plan layout', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  // ── 15. Merging & Adjacency Detection ──
  const areTablesAdjacent = useCallback((t1: TableLayoutInfo, t2: TableLayoutInfo) => {
    const cfg1 = TABLE_TYPES[t1.TABLE_TYPE] || TABLE_TYPES[1]
    const cfg2 = TABLE_TYPES[t2.TABLE_TYPE] || TABLE_TYPES[1]

    const cells1: Array<{ x: number; y: number }> = []
    for (let dx = 0; dx < cfg1.width; dx++) {
      for (let dy = 0; dy < cfg1.height; dy++) {
        cells1.push({ x: t1.X_POS + dx, y: t1.Y_POS + dy })
      }
    }

    const cells2: Array<{ x: number; y: number }> = []
    for (let dx = 0; dx < cfg2.width; dx++) {
      for (let dy = 0; dy < cfg2.height; dy++) {
        cells2.push({ x: t2.X_POS + dx, y: t2.Y_POS + dy })
      }
    }

    for (const c1 of cells1) {
      for (const c2 of cells2) {
        const dist = Math.abs(c1.x - c2.x) + Math.abs(c1.y - c2.y)
        if (dist === 1) return true
      }
    }
    return false
  }, [])

  // ── 16. Drag Handling (Active in both View Mode and Edit Mode) ──
  const handleMouseDown = (tableNum: number, e: React.MouseEvent) => {
    if (isQrPrintMode) return

    // Only respond to main left click (button 0)
    if (e.button !== 0) return

    // Ctrl/Cmd click is reserved for multi-selection toggle
    if (e.ctrlKey || e.metaKey) {
      return
    }

    e.preventDefault()
    e.stopPropagation()
    const table = layoutTables.find((t) => t.TABLE_NUM === tableNum)
    if (!table) return

    lastMutationTimeRef.current = Date.now()

    if (!selectedTableNums.has(tableNum)) {
      setSelectedTableNum(tableNum)
      setSelectedTableNums(new Set([tableNum]))
    }

    const newDrag: DragState = {
      tableNum,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startTableX: table.X_POS,
      startTableY: table.Y_POS,
      currentX: table.X_POS,
      currentY: table.Y_POS,
    }
    dragStateRef.current = newDrag
    setDragState(newDrag)
  }

  // Handle Table Click (Single vs Ctrl+Click Multi-Select like file explorers)
  const handleTableClick = (tableNum: number, e: React.MouseEvent) => {
    e.stopPropagation()
    if (isQrPrintMode) {
      handleTogglePrintSelectTable(tableNum)
      return
    }

    if (e.ctrlKey || e.metaKey) {
      setSelectedTableNums((prev) => {
        const next = new Set(prev)
        // If there was a single active selected table not in the set, retain it
        if (selectedTableNum != null && !next.has(selectedTableNum)) {
          next.add(selectedTableNum)
        }

        if (next.has(tableNum)) {
          next.delete(tableNum)
          if (selectedTableNum === tableNum) {
            const remaining = Array.from(next)
            setSelectedTableNum(remaining.length > 0 ? remaining[remaining.length - 1] : null)
          }
        } else {
          next.add(tableNum)
          setSelectedTableNum(tableNum)
        }
        return next
      })
    } else {
      setSelectedTableNum(tableNum)
      setSelectedTableNums(new Set([tableNum]))
    }
  }

  // Handle Canvas Background Mouse Down (Starts Marquee Selection in View Mode & Deselects Tables)
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (isQrPrintMode) return

    const target = e.target as HTMLElement
    if (target.closest('.table-node-item')) {
      return
    }

    if (!e.ctrlKey && !e.metaKey) {
      setSelectedTableNum(null)
      setSelectedTableNums(new Set())
    }

    if (!isEditMode) {
      isMarqueeActiveRef.current = true
      marqueeStartRef.current = { x: e.clientX, y: e.clientY }
      setMarqueeBox({
        startX: e.clientX,
        startY: e.clientY,
        currentX: e.clientX,
        currentY: e.clientY,
      })
    }
  }

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      // Safety check: If no mouse button is held down, finalize dragging immediately
      if (e.buttons === 0) {
        if (dragStateRef.current !== null || isMarqueeActiveRef.current) {
          void handleGlobalMouseUp()
        }
        return
      }

      const activeDrag = dragStateRef.current || dragState
      // 1. Table Dragging
      if (activeDrag) {
        const deltaPixelX = e.clientX - activeDrag.startMouseX
        const deltaPixelY = e.clientY - activeDrag.startMouseY

        const deltaGridX = Math.round(deltaPixelX / cellSize)
        const deltaGridY = Math.round(deltaPixelY / cellSize)

        const targetTable = layoutTables.find((t) => t.TABLE_NUM === activeDrag.tableNum)
        if (targetTable) {
          const cfg = TABLE_TYPES[targetTable.TABLE_TYPE] || TABLE_TYPES[1]
          const nextX = Math.max(0, Math.min(gridWidth - cfg.width, activeDrag.startTableX + deltaGridX))
          const nextY = Math.max(0, Math.min(gridHeight - cfg.height, activeDrag.startTableY + deltaGridY))

          if (nextX !== activeDrag.currentX || nextY !== activeDrag.currentY) {
            const updated: DragState = { ...activeDrag, currentX: nextX, currentY: nextY }
            dragStateRef.current = updated
            setDragState(updated)
          }
        }
      }

      // 2. Canvas Marquee Selection
      if (isMarqueeActiveRef.current && marqueeStartRef.current && containerRef.current) {
        const startX = marqueeStartRef.current.x
        const startY = marqueeStartRef.current.y
        const currentX = e.clientX
        const currentY = e.clientY

        setMarqueeBox({
          startX,
          startY,
          currentX,
          currentY,
        })

        if (Math.hypot(currentX - startX, currentY - startY) > 4) {
          const cRect = containerRef.current.getBoundingClientRect()
          const boxLeft = Math.min(startX, currentX)
          const boxTop = Math.min(startY, currentY)
          const boxRight = Math.max(startX, currentX)
          const boxBottom = Math.max(startY, currentY)

          const newlySelected = new Set<number>(e.ctrlKey || e.metaKey ? selectedTableNums : [])

          for (const t of layoutTables) {
            const cfg = TABLE_TYPES[t.TABLE_TYPE] || TABLE_TYPES[1]
            const tLeft = cRect.left + t.X_POS * cellSize
            const tTop = cRect.top + t.Y_POS * cellSize
            const tRight = tLeft + cfg.width * cellSize
            const tBottom = tTop + cfg.height * cellSize

            const isOverlapping = !(
              boxRight < tLeft ||
              boxLeft > tRight ||
              boxBottom < tTop ||
              boxTop > tBottom
            )

            if (isOverlapping) {
              newlySelected.add(t.TABLE_NUM)
            }
          }

          setSelectedTableNums(newlySelected)
        }
      }
    }

    const handleGlobalMouseUp = async () => {
      const activeDrag = dragStateRef.current || dragState
      dragStateRef.current = null
      setDragState(null)

      // 1. Table Dragging Finish
      if (activeDrag) {
        const { tableNum, currentX, currentY, startTableX, startTableY } = activeDrag
        const hasMoved = currentX !== startTableX || currentY !== startTableY

        if (hasMoved) {
          lastMutationTimeRef.current = Date.now()
          const currentTable = layoutTables.find((t) => t.TABLE_NUM === tableNum)
          if (currentTable) {
            let finalX = currentX
            let finalY = currentY

            // Prevent tables from overlapping each other
            if (isTableOverlapping(tableNum, currentTable.TABLE_TYPE, finalX, finalY, layoutTables)) {
              const tablePositions = layoutTables.map((t) => {
                const cfg = TABLE_TYPES[t.TABLE_TYPE] || TABLE_TYPES[1]
                return {
                  tableId: t.TABLE_NUM,
                  x: t.X_POS,
                  y: t.Y_POS,
                  widthBlocks: cfg.width,
                  heightBlocks: cfg.height,
                }
              })
              const currentCfg = TABLE_TYPES[currentTable.TABLE_TYPE] || TABLE_TYPES[1]
              const nearest = findNearestValidPosition(
                finalX,
                finalY,
                tableNum,
                1,
                gridWidth,
                gridHeight,
                tablePositions,
                currentCfg.width,
                currentCfg.height,
              )

              if (nearest) {
                finalX = nearest.x
                finalY = nearest.y
              } else {
                finalX = startTableX
                finalY = startTableY
              }
            }

            const rawResult = applyTableMove(layoutTables, tableNum, finalX, finalY, areTablesAdjacent)
            const suppMap = calculateSuppressionForLayout(rawResult)
            const { updatedBaseCapacities, updatedLayout } = deductMovedTableOnOverflow(
              tableNum,
              rawResult,
              suppMap,
              baseCapacitiesMap,
              activePresetMaxPax,
            )
            const updatedRest = syncRestaurantTablesWithLayout(
              updatedLayout,
              suppMap,
              restaurantTables,
              activePresetMaxPax,
              updatedBaseCapacities,
            )

            setLayoutTables(updatedLayout)
            setRestaurantTables(updatedRest)

            if (!isEditMode && activePresetId) {
              try {
                const capacityMap = new Map<number, number>()
                for (const r of updatedRest) {
                  capacityMap.set(r.TABLE_NUM, r.GUEST_CAPACITY)
                }
                await savePresetLayout(activePresetId, updatedLayout, capacityMap, activePresetMaxPax)
              } catch (err) {
                console.error('Failed to save layout move in view mode:', err)
              }
            } else {
              setIsDirty(true)
            }
          }
        }
      }

      // 2. Marquee Selection Finish
      if (isMarqueeActiveRef.current) {
        isMarqueeActiveRef.current = false
        marqueeStartRef.current = null
        setMarqueeBox(null)
      }
    }

    window.addEventListener('mousemove', handleGlobalMouseMove)
    window.addEventListener('mouseup', handleGlobalMouseUp)
    window.addEventListener('pointerup', handleGlobalMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove)
      window.removeEventListener('mouseup', handleGlobalMouseUp)
      window.removeEventListener('pointerup', handleGlobalMouseUp)
    }
  }, [dragState, gridWidth, gridHeight, layoutTables, areTablesAdjacent, cellSize, isEditMode, activePresetId, restaurantTables, syncRestaurantTablesWithLayout, selectedTableNums, activePresetMaxPax, baseCapacitiesMap])


  // ── 18. Dynamic Visuals for Merged Groups (Box or Smart Nearest-Neighbor Chain) ──
  const mergeGroupVisuals: MergeGroupVisual[] = useMemo(() => {
    const groupMap = new Map<number, MergedTableNode[]>()
    for (const node of mergedNodes) {
      if (node.MERGE_GROUP_ID == null) continue
      const list = groupMap.get(node.MERGE_GROUP_ID) || []
      list.push(node)
      groupMap.set(node.MERGE_GROUP_ID, list)
    }

    const visuals: MergeGroupVisual[] = []

    for (const [groupId, members] of groupMap.entries()) {
      if (members.length < 2) continue

      // Only show merge group indicator if at least one member table in this group is currently selected
      const isGroupSelected = members.some(
        (m) => m.TABLE_NUM === selectedTableNum || selectedTableNums.has(m.TABLE_NUM),
      )
      if (!isGroupSelected) continue

      const memberDetails = members.map((m) => {
        const cfg = TABLE_TYPES[m.TABLE_TYPE] || TABLE_TYPES[1]
        const isDraggingThis = dragState?.tableNum === m.TABLE_NUM
        const x = isDraggingThis ? dragState.currentX : m.X_POS
        const y = isDraggingThis ? dragState.currentY : m.Y_POS
        const width = cfg.width
        const height = cfg.height
        const cx = (x + width / 2) * cellSize
        const cy = (y + height / 2) * cellSize
        return {
          tableNum: m.TABLE_NUM,
          x,
          y,
          width,
          height,
          right: x + width,
          bottom: y + height,
          cx,
          cy,
        }
      })

      const minX = Math.min(...memberDetails.map((m) => m.x))
      const minY = Math.min(...memberDetails.map((m) => m.y))
      const maxX = Math.max(...memberDetails.map((m) => m.right))
      const maxY = Math.max(...memberDetails.map((m) => m.bottom))

      // Check if bounding box overlaps any table that is not part of this merge group
      const foreignTables = mergedNodes.filter((n) => n.MERGE_GROUP_ID !== groupId)
      let overlapsForeign = false

      for (const foreign of foreignTables) {
        const fCfg = TABLE_TYPES[foreign.TABLE_TYPE] || TABLE_TYPES[1]
        const isDraggingForeign = dragState?.tableNum === foreign.TABLE_NUM
        const fx = isDraggingForeign ? dragState.currentX : foreign.X_POS
        const fy = isDraggingForeign ? dragState.currentY : foreign.Y_POS
        const fRight = fx + fCfg.width
        const fBottom = fy + fCfg.height

        const noOverlap =
          fRight <= minX || fx >= maxX || fBottom <= minY || fy >= maxY
        if (!noOverlap) {
          overlapsForeign = true
          break
        }
      }

      if (!overlapsForeign) {
        visuals.push({
          type: 'box',
          groupId,
          minX,
          minY,
          maxX,
          maxY,
        })
      } else {
        // Overlaps foreign tables -> build smart nearest-neighbor chain link
        let startTable = memberDetails[0]
        if (memberDetails.length > 2) {
          let maxDistSq = -1
          for (let i = 0; i < memberDetails.length; i++) {
            for (let j = i + 1; j < memberDetails.length; j++) {
              const dSq =
                Math.pow(memberDetails[i].cx - memberDetails[j].cx, 2) +
                Math.pow(memberDetails[i].cy - memberDetails[j].cy, 2)
              if (dSq > maxDistSq) {
                maxDistSq = dSq
                startTable =
                  memberDetails[i].cx < memberDetails[j].cx ||
                  (memberDetails[i].cx === memberDetails[j].cx && memberDetails[i].cy <= memberDetails[j].cy)
                    ? memberDetails[i]
                    : memberDetails[j]
              }
            }
          }
        }

        const chain: typeof memberDetails = [startTable]
        const visited = new Set<number>([startTable.tableNum])

        while (chain.length < memberDetails.length) {
          const current = chain[chain.length - 1]
          let nearestCandidate: (typeof memberDetails)[0] | null = null
          let nearestDistSq = Infinity

          for (const cand of memberDetails) {
            if (visited.has(cand.tableNum)) continue
            const dSq = Math.pow(cand.cx - current.cx, 2) + Math.pow(cand.cy - current.cy, 2)
            if (dSq < nearestDistSq) {
              nearestDistSq = dSq
              nearestCandidate = cand
            }
          }

          if (nearestCandidate) {
            visited.add(nearestCandidate.tableNum)
            chain.push(nearestCandidate)
          } else {
            break
          }
        }

        const links: MergeGroupVisualChain['links'] = []
        for (let i = 0; i < chain.length - 1; i++) {
          links.push({
            x1: chain[i].cx,
            y1: chain[i].cy,
            x2: chain[i + 1].cx,
            y2: chain[i + 1].cy,
            fromTable: chain[i].tableNum,
            toTable: chain[i + 1].tableNum,
          })
        }

        const nodes: MergeGroupVisualChain['nodes'] = memberDetails.map((m) => ({
          cx: m.cx,
          cy: m.cy,
          tableNum: m.tableNum,
        }))

        visuals.push({
          type: 'chain',
          groupId,
          links,
          nodes,
        })
      }
    }

    return visuals
  }, [mergedNodes, selectedTableNum, selectedTableNums, dragState, cellSize])

  const selectedNode = mergedNodes.find((n) => n.TABLE_NUM === selectedTableNum) || null

  const isSelectedMergeGroupBlockedFromUnmerge = useMemo(() => {
    if (!selectedNode || selectedNode.MERGE_GROUP_ID == null) return false
    const groupMembers = layoutTables.filter((t) => t.MERGE_GROUP_ID === selectedNode.MERGE_GROUP_ID)
    return groupMembers.some((m) => activeOrderTableNums.has(m.TABLE_NUM))
  }, [selectedNode, layoutTables, activeOrderTableNums])

  // ── 19. Table QR Code Preview & Bulk Operations ──
  const [qrModalTable, setQrModalTable] = useState<{
    TABLE_ID: number
    TABLE_NUM: number
    GUEST_CAPACITY?: number
  } | null>(null)
  const [isPrintingBulk, setIsPrintingBulk] = useState(false)
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)

  const handleToggleQrPrintMode = () => {
    setIsQrPrintMode(true)
    setSelectedForPrintTableNums(new Set(mergedNodes.map((n) => n.TABLE_NUM)))
  }

  const handleCancelQrPrint = () => {
    setIsQrPrintMode(false)
    setSelectedForPrintTableNums(new Set())
  }

  const handleTogglePrintSelectTable = (tableNum: number) => {
    setSelectedForPrintTableNums((prev) => {
      const next = new Set(prev)
      if (next.has(tableNum)) {
        next.delete(tableNum)
      } else {
        next.add(tableNum)
      }
      return next
    })
  }

  const handleToggleSelectAllPrint = (selectAll: boolean) => {
    if (selectAll) {
      setSelectedForPrintTableNums(new Set(mergedNodes.map((n) => n.TABLE_NUM)))
    } else {
      setSelectedForPrintTableNums(new Set())
    }
  }

  const handlePrintSelectedQrs = useCallback(async () => {
    const selectedTables = mergedNodes.filter((n) => selectedForPrintTableNums.has(n.TABLE_NUM))
    if (selectedTables.length === 0) {
      showToast('Please select at least one table to print', 'error')
      return
    }
    try {
      setIsPrintingBulk(true)
      const tableRefs = selectedTables.map((n) => ({
        TABLE_ID: n.TABLE_ID ?? n.TABLE_NUM,
        TABLE_NUM: n.TABLE_NUM,
      }))
      await printBulkQrPdf(tableRefs)
    } catch (err) {
      console.error('Failed to print bulk QRs:', err)
      showToast('Failed to print table QR codes', 'error')
    } finally {
      setIsPrintingBulk(false)
    }
  }, [mergedNodes, selectedForPrintTableNums])

  const handleDownloadQrPdf = useCallback(async () => {
    const selectedTables = isQrPrintMode
      ? mergedNodes.filter((n) => selectedForPrintTableNums.has(n.TABLE_NUM))
      : mergedNodes
    if (selectedTables.length === 0) {
      showToast('Please select at least one table to download', 'error')
      return
    }
    try {
      setIsGeneratingPdf(true)
      const tableRefs = selectedTables.map((n) => ({
        TABLE_ID: n.TABLE_ID ?? n.TABLE_NUM,
        TABLE_NUM: n.TABLE_NUM,
      }))
      await downloadBulkQrPdf(tableRefs)
      showToast('Table QR PDF generated successfully', 'info')
    } catch (err) {
      console.error('Failed to generate QR PDF:', err)
      showToast('Failed to generate table QR PDF', 'error')
    } finally {
      setIsGeneratingPdf(false)
    }
  }, [mergedNodes, isQrPrintMode, selectedForPrintTableNums])

  const handleOpenQrModal = useCallback(
    (table: MergedTableNode | { TABLE_ID?: number; TABLE_NUM: number; GUEST_CAPACITY?: number }) => {
      setQrModalTable({
        TABLE_ID: table.TABLE_ID ?? table.TABLE_NUM,
        TABLE_NUM: table.TABLE_NUM,
        GUEST_CAPACITY: table.GUEST_CAPACITY,
      })
    },
    [],
  )

  const handleToggleEditMode = () => {
    if (isEditMode && isDirty) {
      setConfirmModal({
        isOpen: true,
        title: 'Discard Changes & Exit',
        message: 'You have unsaved changes. Exit edit mode and discard them?',
        confirmLabel: 'Discard & Exit',
        variant: 'warning',
        onConfirm: async () => {
          setConfirmModal((prev) => ({ ...prev, isOpen: false }))
          if (activePresetId) {
            const layoutData = await fetchPresetLayout(activePresetId)
            setLayoutTables(layoutData)
          }
          setIsDirty(false)
          setIsEditMode(false)
          setSelectedTableNum(null)
        },
      })
      return
    }
    setIsEditMode((prev) => !prev)
    setSelectedTableNum(null)
  }

  return (
    <div className="table-manager-page-container staff-page flex flex-row h-full w-full overflow-hidden bg-[#F1F6F9] p-0 select-none">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-2xl shadow-xl border text-xs font-black flex items-center gap-2 animate-in slide-in-from-top-2 duration-150 ${toast.type === 'error'
            ? 'bg-rose-700 text-white border-rose-500'
            : toast.type === 'info'
              ? 'bg-[#14274E] text-white border-slate-700'
              : 'bg-emerald-700 text-white border-emerald-500'
            }`}
        >
          <span>{toast.message}</span>
        </div>
      )}

      {/* ── Left Div: inner-table-manager-container ── */}
      <div className="inner-table-manager-container flex-1 min-w-0 h-full flex flex-col overflow-hidden">
        {/* Top: table-manager-header (Preset Dropdown on left & Save Layout / Discard Changes / Edit Layout on right) */}
        <TableManagerHeader
          presets={presets}
          activePresetId={activePresetId}
          isEventActive={isEventActive}
          activeEventTitle={activeEvent?.title}
          totalCapacity={totalAllocatedCapacity}
          maxVenueCapacity={activePresetMaxPax}
          isDirty={isDirty}
          onSelectPreset={handleSelectPreset}
          onRenamePreset={handleRenamePreset}
          onDeletePreset={handleDeletePreset}
          activeTab={activeAdminTab}
          onTabChange={(tab) => {
            if (isDirty) {
              setConfirmModal({
                isOpen: true,
                title: 'Unsaved Layout Changes',
                message: 'You have unsaved floor layout changes. Discard changes to switch tabs?',
                confirmLabel: 'Discard & Switch',
                variant: 'warning',
                onConfirm: () => {
                  setConfirmModal((prev) => ({ ...prev, isOpen: false }))
                  setIsDirty(false)
                  setActiveAdminTab(tab)
                },
              })
              return
            }
            setActiveAdminTab(tab)
          }}
          onOpenAutoAlloc={() => setAutoAllocModalOpen(true)}
          onOpenRemoveAll={() => setRemoveAllModalOpen(true)}
          onOpenNewPresetModal={() => {
            if (isEventActive) {
              showToast(
                `Cannot create or switch layout preset while event "${activeEvent?.title ?? 'Active Event'}" is active.`,
                'error',
              )
              return
            }
            if (isDirty) {
              setConfirmModal({
                isOpen: true,
                title: 'Unsaved Changes',
                message: 'You have unsaved changes on the current layout. Discard changes and create a new preset?',
                confirmLabel: 'Discard & Create',
                variant: 'warning',
                onConfirm: () => {
                  setConfirmModal((prev) => ({ ...prev, isOpen: false }))
                  setIsDirty(false)
                  setNewPresetModalOpen(true)
                },
              })
              return
            }
            setNewPresetModalOpen(true)
          }}
          isEditMode={isEditMode}
          onToggleEditMode={handleToggleEditMode}
          onSaveLayout={handleSaveLayout}
          onDiscardChanges={handleDiscardChanges}
          isSaving={isSaving}
          isQrPrintMode={isQrPrintMode}
          selectedPrintCount={selectedForPrintTableNums.size}
          onToggleQrPrintMode={handleToggleQrPrintMode}
          onCancelQrPrint={handleCancelQrPrint}
          onPrintSelectedQrs={handlePrintSelectedQrs}
          isPrintingBulk={isPrintingBulk}
          hasTables={mergedNodes.length > 0}
        />

        {/* Tab 1: Tables Directory & CRUD */}
        {activeAdminTab === 'tables' && (
          <div className="flex-1 overflow-y-auto">
            <TableListView
              tables={mergedNodes}
              onAddTable={(type) => void handleAddTable(type)}
              onDeleteTable={handleDeleteTable}
              onUpdateSeatCount={handleUpdateSeatCount}
              onOpenQrModal={handleOpenQrModal}
              onOpenRemoveAll={() => setRemoveAllModalOpen(true)}
              onOpenAutoAlloc={() => setAutoAllocModalOpen(true)}
              onLabelAssigned={handleLabelAssigned}
            />
          </div>
        )}

        {/* Tab 2: Layout Presets */}
        {activeAdminTab === 'presets' && (
          <div className="flex-1 overflow-y-auto">
            <PresetsManagerView
              presets={presets}
              activePresetId={activePresetId}
              isEventActive={isEventActive}
              activeEventTitle={activeEvent?.title}
              onSelectPreset={handleSelectPreset}
              onSetDefaultPreset={handleSetDefaultPreset}
              onRenamePreset={handleRenamePreset}
              onDeletePreset={handleDeletePreset}
              onOpenNewPresetModal={() => setNewPresetModalOpen(true)}
            />
          </div>
        )}

        {/* Tab 3: Table Types Limits */}
        {activeAdminTab === 'types' && (
          <div className="flex-1 overflow-y-auto">
            <TableTypesManager
              layoutTables={mergedNodes}
              onConfigChange={() => void loadInitialData()}
            />
          </div>
        )}

        {/* Tab 4: Labels & Hierarchy Management */}
        {activeAdminTab === 'labels' && (
          <div className="flex-1 overflow-y-auto">
            <LabelHierarchyManager />
          </div>
        )}

        {/* Tab 5: Floor Layout Canvas (Admin Editor) */}
        {activeAdminTab === 'layout' && (
          <div className="layout-container flex-1 min-h-0 mx-5 mb-5 mt-1 rounded-2xl bg-white border border-slate-200/90 shadow-xs relative overflow-hidden flex flex-col">
          {/* Add Table button in upper right corner (Edit Mode only, non-obtrusive) */}
          {isEditMode && (
            <div className="absolute top-3.5 right-3.5 z-30">
              <FloatingLayoutControls
                onAddTable={handleAddTable}
                totalCapacity={totalAllocatedCapacity}
                maxVenueCapacity={activePresetMaxPax}
              />
            </div>
          )}

          {/* Floating Merge Tables button in upper right corner (When >= 2 tables selected) */}
          {!isQrPrintMode && selectedTableNums.size >= 2 && (
            <div className="absolute top-3.5 right-3.5 z-30 animate-in fade-in zoom-in-95 duration-150">
              <button
                type="button"
                onClick={handleMergeSelectedTables}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#14274E] to-[#1E3A6D] text-[#E9C46A] border border-[#E9C46A]/40 shadow-xl hover:from-[#1E3A6D] hover:to-[#27477D] hover:scale-105 active:scale-95 transition-all font-bold text-xs cursor-pointer"
              >
                <GitMerge className="w-4 h-4 text-[#E9C46A]" />
                <span>Merge Tables ({selectedTableNums.size})</span>
              </button>
            </div>
          )}

          {/* Grid View Canvas Container - Dynamic edge-to-edge grid container */}
          <div
            ref={containerRef}
            className="floor-grid-canvas flex-1 h-full w-full overflow-hidden relative bg-white select-none p-0 cursor-default"
            onMouseDown={handleCanvasMouseDown}
          >
            {/* Floor Grid: Covers 100% of w-full h-full with zero padding or margin (grid lines only visible in edit mode) */}
            <div
              className="w-full h-full relative select-none"
              style={{
                backgroundImage: isEditMode
                  ? `
                    linear-gradient(to right, rgba(20, 39, 78, 0.08) 1px, transparent 1px),
                    linear-gradient(to bottom, rgba(20, 39, 78, 0.08) 1px, transparent 1px)
                  `
                  : 'none',
                backgroundSize: `${cellSize}px ${cellSize}px`,
                backgroundPosition: '0 0',
              }}
            >
              {/* Dynamic Merge Group Indicators (Box or Broken Chain Link Lines) */}
              {mergeGroupVisuals.map((visual) => {
                const theme = getMergeGroupColor(visual.groupId)

                if (visual.type === 'box') {
                  const padding = Math.max(6, Math.round(cellSize * 0.12))
                  const left = visual.minX * cellSize - padding
                  const top = visual.minY * cellSize - padding
                  const width = (visual.maxX - visual.minX) * cellSize + padding * 2
                  const height = (visual.maxY - visual.minY) * cellSize + padding * 2

                  return (
                    <div
                      key={`merge-group-box-${visual.groupId}`}
                      className="absolute pointer-events-none rounded-2xl border-2 border-dashed transition-all duration-150 z-10 shadow-xs"
                      style={{
                        left: `${left}px`,
                        top: `${top}px`,
                        width: `${width}px`,
                        height: `${height}px`,
                        borderColor: theme.primary,
                        backgroundColor: theme.containerBg || theme.lightBg,
                      }}
                    />
                  )
                }

                if (visual.type === 'chain') {
                  return (
                    <svg
                      key={`merge-group-chain-${visual.groupId}`}
                      className="absolute inset-0 w-full h-full pointer-events-none z-10 overflow-visible"
                    >
                      {/* Broken Chain Link Lines */}
                      {visual.links.map((link, idx) => (
                        <g key={`link-${visual.groupId}-${link.fromTable}-${link.toTable}-${idx}`}>
                          {/* Soft Glow Underlay */}
                          <line
                            x1={link.x1}
                            y1={link.y1}
                            x2={link.x2}
                            y2={link.y2}
                            stroke={theme.glow}
                            strokeWidth={6}
                            strokeOpacity={0.35}
                            strokeDasharray="10 6"
                            strokeLinecap="round"
                          />
                          {/* Primary Dashed Chain Line */}
                          <line
                            x1={link.x1}
                            y1={link.y1}
                            x2={link.x2}
                            y2={link.y2}
                            stroke={theme.primary}
                            strokeWidth={2.5}
                            strokeDasharray="8 5"
                            strokeLinecap="round"
                          />
                        </g>
                      ))}

                      {/* Chain Node Dots at Table Centers */}
                      {visual.nodes.map((node) => (
                        <g key={`node-${visual.groupId}-${node.tableNum}`}>
                          <circle
                            cx={node.cx}
                            cy={node.cy}
                            r={6}
                            fill={theme.primary}
                            stroke="#FFFFFF"
                            strokeWidth={2}
                          />
                          <circle cx={node.cx} cy={node.cy} r={2.5} fill="#FFFFFF" />
                        </g>
                      ))}
                    </svg>
                  )
                }

                return null
              })}

              {/* Marquee Selection Rectangle Box */}
              {marqueeBox && containerRef.current && (() => {
                const cRect = containerRef.current.getBoundingClientRect()
                const boxLeft = Math.min(marqueeBox.startX, marqueeBox.currentX) - cRect.left
                const boxTop = Math.min(marqueeBox.startY, marqueeBox.currentY) - cRect.top
                const boxWidth = Math.abs(marqueeBox.currentX - marqueeBox.startX)
                const boxHeight = Math.abs(marqueeBox.currentY - marqueeBox.startY)

                return (
                  <div
                    className="absolute pointer-events-none rounded-lg border-2 border-dashed border-indigo-500 bg-indigo-500/20 z-50 backdrop-blur-[0.5px]"
                    style={{
                      left: `${boxLeft}px`,
                      top: `${boxTop}px`,
                      width: `${boxWidth}px`,
                      height: `${boxHeight}px`,
                    }}
                  />
                )
              })()}

              {/* Render Tables */}
              {mergedNodes.map((node) => {
                const isDraggingThis = dragState?.tableNum === node.TABLE_NUM
                const posX = isDraggingThis ? dragState.currentX : node.X_POS
                const posY = isDraggingThis ? dragState.currentY : node.Y_POS
                const isSelected = selectedTableNum === node.TABLE_NUM || selectedTableNums.has(node.TABLE_NUM)
                const suppress = chairSuppressionMap.get(node.TABLE_NUM)

                return (
                  <div
                    key={node.TABLE_NUM}
                    onMouseDown={(e) => {
                      handleMouseDown(node.TABLE_NUM, e)
                    }}
                    onClick={(e) => {
                      handleTableClick(node.TABLE_NUM, e)
                    }}
                    className={`table-node-item absolute transition-transform select-none cursor-grab active:cursor-grabbing ${
                      isDraggingThis ? 'z-40 scale-105 opacity-90' : 'z-20'
                    }`}
                    style={{
                      left: `${posX * cellSize}px`,
                      top: `${posY * cellSize}px`,
                    }}
                  >
                    <TableVisual
                      tableType={node.TABLE_TYPE}
                      tableNum={node.TABLE_NUM}
                      cellSize={cellSize}
                      status={node.STATUS}
                      guestCount={node.CURRENT_GUEST_COUNT}
                      capacity={node.GUEST_CAPACITY}
                      labelName={node.LABEL_ID ? activeLabelMap.get(node.LABEL_ID)?.NAME : undefined}
                      labelColor={node.LABEL_ID ? activeLabelMap.get(node.LABEL_ID)?.COLOR : undefined}
                      isMerged={node.MERGE_GROUP_ID != null}
                      mergeGroupId={node.MERGE_GROUP_ID}
                      isSelected={isSelected}
                      isEditMode={isEditMode}
                      isQrPrintMode={isQrPrintMode}
                      isPrintSelected={selectedForPrintTableNums.has(node.TABLE_NUM)}
                      onTogglePrintSelect={() => handleTogglePrintSelectTable(node.TABLE_NUM)}
                      onRotate={() => handleRotateTable(node.TABLE_NUM)}
                      hideChairs={suppress}
                    />
                  </div>
                )
              })}

              {/* Loading State */}
              {isLoading && (
                <div className="absolute inset-0 bg-white/70 backdrop-blur-xs flex items-center justify-center z-50">
                  <div className="flex items-center gap-2 text-xs font-black text-[#14274E]">
                    <div className="w-4 h-4 rounded-full border-2 border-[#14274E] border-t-transparent animate-spin" />
                    <span>Loading Floor Plan...</span>
                  </div>
                </div>
              )}

              {/* Empty State */}
              {!isLoading && mergedNodes.length === 0 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center pointer-events-none">
                  <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-center justify-center mb-3 shadow-xs">
                    <TableShapeIcon tableType={1} size={32} />
                  </div>
                  <h3 className="text-sm font-extrabold text-[#14274E]">
                    Floor Plan is Empty
                  </h3>
                  <p className="text-xs text-slate-400 font-medium max-w-xs mt-1">
                    {isEditMode
                      ? 'Click "+ Add Table" in the top bar to spawn tables onto the grid.'
                      : 'Click "Edit Layout" at the top right to start adding tables.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
        )}
      </div>

      {/* ── Right Div: table-manager-sidebar (Visible in Layout tab) ── */}
      {activeAdminTab === 'layout' && (
        <TableManagerSidebar
          isEditMode={isEditMode}
          isQrPrintMode={isQrPrintMode}
          selectedTable={selectedNode}
          allTables={mergedNodes}
          remainingVenueCapacity={activePresetMaxPax - totalAllocatedCapacity}
          maxVenueCapacity={activePresetMaxPax}
          onSelectTableNum={(num) => setSelectedTableNum(num)}
          selectedForPrintTableNums={selectedForPrintTableNums}
          onTogglePrintSelectTable={handleTogglePrintSelectTable}
          onToggleSelectAllPrint={handleToggleSelectAllPrint}
          onDownloadQrPdf={handleDownloadQrPdf}
          isGeneratingPdf={isGeneratingPdf}
          onPrintSelectedQrs={handlePrintSelectedQrs}
          isPrintingBulk={isPrintingBulk}
          onUpdateTableNum={handleUpdateTableNum}
          onChangeTableType={handleChangeTableType}
          onUpdateSeatCount={handleUpdateSeatCount}
          onUpdateGuestCount={handleUpdateGuestCount}
          onUpdateStatus={handleUpdateStatus}
          onUnmergeTable={handleUnmergeTable}
          isMergeGroupBlockedFromUnmerge={isSelectedMergeGroupBlockedFromUnmerge}
          onDeleteTable={handleDeleteTable}
          onOpenQrModal={handleOpenQrModal}
        />
      )}

      {/* Remove All Tables Modal */}
      <RemoveAllTablesModal
        isOpen={removeAllModalOpen}
        totalTablesCount={layoutTables.length}
        onClose={() => setRemoveAllModalOpen(false)}
        onConfirm={handleConfirmRemoveAll}
      />

      {/* Automatic Table Allocation Modal */}
      <AutomaticAllocationModal
        isOpen={autoAllocModalOpen}
        gridWidth={gridWidth}
        gridHeight={gridHeight}
        maxVenuePax={activePresetMaxPax}
        presetId={activePresetId ?? 0}
        onClose={() => setAutoAllocModalOpen(false)}
        onApply={handleApplyAutoLayout}
      />

      {/* Admin Authorization Security Gate Modal */}
      <AdminAuthModal
        isOpen={adminAuthModalOpen}
        onClose={() => {
          setAdminAuthModalOpen(false)
          setPendingAdminAction(null)
        }}
        onSuccess={handleAdminAuthSuccess}
      />

      {/* New Preset Modal */}
      <NewPresetModal
        isOpen={newPresetModalOpen}
        onClose={() => setNewPresetModalOpen(false)}
        onCreate={handleCreatePreset}
      />

      {/* In-App Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmLabel={confirmModal.confirmLabel}
        cancelLabel={confirmModal.cancelLabel}
        variant={confirmModal.variant}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* Navigation Guard Modal — blocks page changes when unsaved edits exist */}
      <ConfirmModal
        isOpen={blocker.state === 'blocked'}
        title="Unsaved Changes"
        message="You have unsaved layout changes. If you leave this page, your changes will be lost. Do you want to discard them and leave?"
        confirmLabel="Discard & Leave"
        cancelLabel="Stay on Page"
        variant="warning"
        onConfirm={() => {
          setIsDirty(false)
          blocker.proceed?.()
        }}
        onCancel={() => blocker.reset?.()}
      />

      {/* In-App Rename / Edit Preset Modal */}
      <RenamePresetModal
        isOpen={renameModal.isOpen}
        currentName={renameModal.currentName}
        currentMaxPax={renameModal.currentMaxPax}
        onClose={() => setRenameModal((prev) => ({ ...prev, isOpen: false }))}
        onRename={handleConfirmRename}
      />

      {/* Table QR Preview Modal */}
      {qrModalTable && (
        <TableQrPreview
          tableId={qrModalTable.TABLE_ID}
          tableNum={qrModalTable.TABLE_NUM}
          guestCapacity={qrModalTable.GUEST_CAPACITY}
          onClose={() => setQrModalTable(null)}
        />
      )}
    </div>
  )
}
