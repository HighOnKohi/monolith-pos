import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import {
  fetchAllLayoutPresets,
  fetchPresetLayout,
  fetchLiveRestaurantTables,
  savePresetLayout,
  createLayoutPreset,
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
import { GitMerge } from 'lucide-react'
import { resolveTableGroupByList } from '@/services/tableGroupService'
import type { TableData } from '@/services/tableService'
import { TableQrPreview } from '@/components/table-qr/TableQrPreview'
import { printBulkQrPdf } from '@/components/table-qr/tableQrPrinter'
import { downloadBulkQrPdf } from '@/components/table-qr/tableQrPdf'

interface DragState {
  tableNum: number
  startMouseX: number
  startMouseY: number
  startTableX: number
  startTableY: number
  currentX: number
  currentY: number
}

export interface ChairSuppressionInfo {
  top?: boolean | boolean[]
  bottom?: boolean | boolean[]
  left?: boolean
  right?: boolean
  radial?: boolean[]
  suppressedCount: number
}

export function calculateSuppressionForLayout(tables: TableLayoutInfo[]): Map<number, ChairSuppressionInfo> {
  const map = new Map<number, ChairSuppressionInfo>()
  const cellMap = new Map<string, number>()

  for (const t of tables) {
    const cfg = TABLE_TYPES[t.TABLE_TYPE] || TABLE_TYPES[1]
    for (let dx = 0; dx < cfg.width; dx++) {
      for (let dy = 0; dy < cfg.height; dy++) {
        cellMap.set(`${t.X_POS + dx},${t.Y_POS + dy}`, t.TABLE_NUM)
      }
    }
  }

  for (const t of tables) {
    let suppressedCount = 0

    if (t.TABLE_TYPE === 1 || t.TABLE_TYPE === 3) {
      const topCell = cellMap.get(`${t.X_POS},${t.Y_POS - 1}`)
      const bottomCell = cellMap.get(`${t.X_POS},${t.Y_POS + 1}`)
      const leftCell = cellMap.get(`${t.X_POS - 1},${t.Y_POS}`)
      const rightCell = cellMap.get(`${t.X_POS + 1},${t.Y_POS}`)

      // A chair disappears if its position overlaps with any other table
      const top = Boolean(topCell && topCell !== t.TABLE_NUM)
      const bottom = Boolean(bottomCell && bottomCell !== t.TABLE_NUM)
      const left = Boolean(leftCell && leftCell !== t.TABLE_NUM)
      const right = Boolean(rightCell && rightCell !== t.TABLE_NUM)

      if (top) suppressedCount++
      if (bottom) suppressedCount++
      if (left) suppressedCount++
      if (right) suppressedCount++

      map.set(t.TABLE_NUM, { top, bottom, left, right, suppressedCount })
    } else if (t.TABLE_TYPE === 2) {
      const topMask = [0, 1, 2].map((dx) => {
        const c = cellMap.get(`${t.X_POS + dx},${t.Y_POS - 1}`)
        return Boolean(c && c !== t.TABLE_NUM)
      })
      const bottomMask = [0, 1, 2].map((dx) => {
        const c = cellMap.get(`${t.X_POS + dx},${t.Y_POS + 1}`)
        return Boolean(c && c !== t.TABLE_NUM)
      })
      const leftCell = cellMap.get(`${t.X_POS - 1},${t.Y_POS}`)
      const rightCell = cellMap.get(`${t.X_POS + 3},${t.Y_POS}`)
      const left = Boolean(leftCell && leftCell !== t.TABLE_NUM)
      const right = Boolean(rightCell && rightCell !== t.TABLE_NUM)

      suppressedCount += topMask.filter(Boolean).length
      suppressedCount += bottomMask.filter(Boolean).length
      if (left) suppressedCount++
      if (right) suppressedCount++

      map.set(t.TABLE_NUM, { top: topMask, bottom: bottomMask, left, right, suppressedCount })
    } else if (t.TABLE_TYPE === 4) {
      const top1 = cellMap.get(`${t.X_POS},${t.Y_POS - 1}`)
      const top2 = cellMap.get(`${t.X_POS + 1},${t.Y_POS - 1}`)
      const topOcc = Boolean((top1 && top1 !== t.TABLE_NUM) || (top2 && top2 !== t.TABLE_NUM))

      const tr = cellMap.get(`${t.X_POS + 2},${t.Y_POS}`)
      const trOcc = Boolean(tr && tr !== t.TABLE_NUM)

      const br = cellMap.get(`${t.X_POS + 2},${t.Y_POS + 1}`)
      const brOcc = Boolean(br && br !== t.TABLE_NUM)

      const bot1 = cellMap.get(`${t.X_POS},${t.Y_POS + 2}`)
      const bot2 = cellMap.get(`${t.X_POS + 1},${t.Y_POS + 2}`)
      const botOcc = Boolean((bot1 && bot1 !== t.TABLE_NUM) || (bot2 && bot2 !== t.TABLE_NUM))

      const bl = cellMap.get(`${t.X_POS - 1},${t.Y_POS + 1}`)
      const blOcc = Boolean(bl && bl !== t.TABLE_NUM)

      const tl = cellMap.get(`${t.X_POS - 1},${t.Y_POS}`)
      const tlOcc = Boolean(tl && tl !== t.TABLE_NUM)

      const radial = [topOcc, trOcc, brOcc, botOcc, blOcc, tlOcc]
      suppressedCount = radial.filter(Boolean).length
      map.set(t.TABLE_NUM, { radial, suppressedCount })
    }
  }

  return map
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
        const minTableNum = Math.min(...component.map((idx) => tables[idx].TABLE_NUM))
        for (const idx of component) {
          result[idx] = { ...result[idx], MERGE_GROUP_ID: minTableNum }
        }
      } else {
        result[component[0]] = { ...result[component[0]], MERGE_GROUP_ID: null }
      }
    }
  }

  return result
}

export default function TableManager() {
  // Presets & Layout State
  const [presets, setPresets] = useState<TableLayoutPreset[]>([])
  const [activePresetId, setActivePresetId] = useState<number | null>(null)
  const [layoutTables, setLayoutTables] = useState<TableLayoutInfo[]>([])
  const [restaurantTables, setRestaurantTables] = useState<RestaurantTableData[]>([])

  // Editor State
  const [isEditMode, setIsEditMode] = useState(false)
  const [selectedTableNum, setSelectedTableNum] = useState<number | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Dragging & Container Dimension State
  const [dragState, setDragState] = useState<DragState | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerDimensions, setContainerDimensions] = useState({ width: 800, height: 600 })

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
  }>({
    isOpen: false,
    presetId: null,
    currentName: '',
  })
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

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

  // Chair suppression map computed reactively
  const chairSuppressionMap = useMemo(() => {
    return calculateSuppressionForLayout(layoutTables)
  }, [layoutTables])

  // Total allocated capacity across current tables (Venue Max = 50)
  const VENUE_MAX_CAPACITY = 50
  const totalAllocatedCapacity = useMemo(() => {
    return layoutTables.reduce((sum, t) => {
      const live = restaurantTables.find((r) => r.TABLE_NUM === t.TABLE_NUM)
      const supp = chairSuppressionMap.get(t.TABLE_NUM)
      const suppCount = supp?.suppressedCount ?? 0
      const defaultCap = TABLE_TYPES[t.TABLE_TYPE]?.defaultCapacity ?? 4
      return sum + (live?.GUEST_CAPACITY ?? Math.max(1, defaultCap - suppCount))
    }, 0)
  }, [layoutTables, restaurantTables, chairSuppressionMap])

  // Helper to synchronize Restaurant_Tables capacity with layout and strictly clamp to VENUE_MAX_CAPACITY (50)
  const syncRestaurantTablesWithLayout = useCallback((
    newLayout: TableLayoutInfo[],
    suppMap: Map<number, ChairSuppressionInfo>,
    prevLiveTables: RestaurantTableData[],
  ): RestaurantTableData[] => {
    // 1. For each table in newLayout, calculate its target capacity
    const mapped: RestaurantTableData[] = newLayout.map((t) => {
      const existing = prevLiveTables.find((r) => r.TABLE_NUM === t.TABLE_NUM)
      const supp = suppMap.get(t.TABLE_NUM)
      const suppCount = supp?.suppressedCount ?? 0
      const defaultCap = TABLE_TYPES[t.TABLE_TYPE]?.defaultCapacity ?? 4
      const maxTableCap = Math.max(1, defaultCap - suppCount)

      // Retain existing capacity if available and clamp to maxTableCap, or default to maxTableCap
      const prevCap = existing ? existing.GUEST_CAPACITY : maxTableCap
      const initialCap = Math.max(1, Math.min(prevCap, maxTableCap))

      return {
        TABLE_ID: existing?.TABLE_ID ?? t.TABLE_NUM,
        TABLE_NUM: t.TABLE_NUM,
        STATUS: (existing?.STATUS ?? 'AVAILABLE') as RestaurantTableData['STATUS'],
        GUEST_CAPACITY: initialCap,
        CURRENT_GUEST_COUNT: existing?.CURRENT_GUEST_COUNT ?? 0,
        RESERVED_SINCE: existing?.RESERVED_SINCE ?? null,
        BILL_OUT_REQUESTED: existing?.BILL_OUT_REQUESTED ?? false,
        MERGE_GROUP_ID: t.MERGE_GROUP_ID,
      }
    })

    // 2. Strictly enforce VENUE_MAX_CAPACITY (50) across all tables
    let currentTotal = mapped.reduce((sum, r) => sum + r.GUEST_CAPACITY, 0)
    if (currentTotal > VENUE_MAX_CAPACITY) {
      for (let i = mapped.length - 1; i >= 0 && currentTotal > VENUE_MAX_CAPACITY; i--) {
        const canReduce = mapped[i].GUEST_CAPACITY - 1
        const excess = currentTotal - VENUE_MAX_CAPACITY
        const reduction = Math.min(excess, canReduce)
        if (reduction > 0) {
          mapped[i].GUEST_CAPACITY -= reduction
          currentTotal -= reduction
        }
      }
    }

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
      const [allPresets, liveTables] = await Promise.all([
        fetchAllLayoutPresets(),
        fetchLiveRestaurantTables(),
      ])
      setPresets(allPresets)
      setRestaurantTables(liveTables)

      if (allPresets.length > 0) {
        const defaultPreset = allPresets.find((p) => p.IS_DEFAULT) || allPresets[0]
        setActivePresetId(defaultPreset.LAYOUT_PRESET_ID)
        const layoutData = await fetchPresetLayout(defaultPreset.LAYOUT_PRESET_ID)
        const resolved = resolveConnectedMergeGroups(layoutData, areTablesAdjacent)
        setLayoutTables(resolved)
      } else {
        const created = await createLayoutPreset('Main Dining Hall', gridWidth, gridHeight, true)
        setPresets([created])
        setActivePresetId(created.LAYOUT_PRESET_ID)
        setLayoutTables([])
      }
      setIsDirty(false)
    } catch (err) {
      console.error('Error loading table manager data:', err)
      showToast('Failed to load table layouts', 'error')
    } finally {
      setIsLoading(false)
    }
  }, [gridWidth, gridHeight])

  useEffect(() => {
    loadInitialData()
  }, [loadInitialData])

  // ── 2. Realtime Subscription to Live Tables & Presets ──
  useEffect(() => {
    const channel = supabase
      .channel('table-manager-live-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'tables', table: 'Restaurant_Tables' },
        async () => {
          try {
            const updated = await fetchLiveRestaurantTables()
            setRestaurantTables(updated)
          } catch (err) {
            console.error('Error in live tables realtime sync:', err)
          }
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'tables', table: 'Table_Layout_Presets' },
        async () => {
          try {
            const allPresets = await fetchAllLayoutPresets()
            setPresets(allPresets)
            const defaultPreset = allPresets.find((p) => p.IS_DEFAULT) || allPresets[0]
            if (defaultPreset && !isDirty) {
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
        const [allPresets, live] = await Promise.all([
          fetchAllLayoutPresets(),
          fetchLiveRestaurantTables(),
        ])
        setPresets(allPresets)
        setRestaurantTables(live)

        const targetPresetId = detail?.presetId || allPresets.find((p) => p.IS_DEFAULT)?.LAYOUT_PRESET_ID
        if (targetPresetId && !isDirty) {
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
  }, [isDirty])

  // ── 3. Switch Active Preset ──
  const performSelectPreset = async (presetId: number) => {
    setIsLoading(true)
    try {
      setActivePresetId(presetId)
      setSelectedTableNum(null)
      const layoutData = await fetchPresetLayout(presetId)
      const resolved = resolveConnectedMergeGroups(layoutData, areTablesAdjacent)
      setLayoutTables(resolved)
      setIsDirty(false)
    } catch (err) {
      console.error('Failed to load preset layout:', err)
      showToast('Failed to load preset layout', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectPreset = (presetId: number) => {
    if (presetId === activePresetId) return
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

  // ── 4. Rename Preset ──
  const handleRenamePreset = (presetId: number, currentName: string) => {
    setRenameModal({
      isOpen: true,
      presetId,
      currentName,
    })
  }

  const handleConfirmRename = async (newName: string) => {
    if (!renameModal.presetId) return
    const id = renameModal.presetId
    await updateLayoutPresetName(id, newName)
    setPresets((prev) =>
      prev.map((p) =>
        p.LAYOUT_PRESET_ID === id ? { ...p, PRESET_NAME: newName } : p,
      ),
    )
    showToast(`Preset renamed to "${newName}"`, 'success')
  }

  // ── 5. Delete Preset ──
  const handleDeletePreset = (presetId: number) => {
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
          const remaining = presets.filter((p) => p.LAYOUT_PRESET_ID !== presetId)
          setPresets(remaining)
          if (remaining.length > 0) {
            void performSelectPreset(remaining[0].LAYOUT_PRESET_ID)
          }
          showToast('Layout preset deleted', 'success')
        } catch (err) {
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
        } catch (err) {
          showToast('Failed to revert layout', 'error')
        } finally {
          setIsLoading(false)
        }
      },
    })
  }

  // ── 6. Create New Preset ──
  const handleCreatePreset = async (name: string, isDef: boolean) => {
    const created = await createLayoutPreset(name, gridWidth, gridHeight, isDef)
    setPresets((prev) => {
      if (isDef) {
        return [...prev.map((p) => ({ ...p, IS_DEFAULT: false })), created]
      }
      return [...prev, created]
    })
    setActivePresetId(created.LAYOUT_PRESET_ID)
    setLayoutTables([])
    setIsDirty(false)
    showToast(`Preset "${name}" created`, 'success')
  }

  // ── 7. Add Table from Floating Controls ──
  const handleAddTable = (type: TableType) => {
    if (!activePresetId) return
    const typeConfig = TABLE_TYPES[type]

    // Check venue capacity
    const remainingVenueCap = VENUE_MAX_CAPACITY - totalAllocatedCapacity
    if (remainingVenueCap <= 0) {
      showToast('Cannot add table: Maximum venue capacity (50 seats) reached', 'error')
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
      MERGE_GROUP_ID: null,
      X_POS: placedX,
      Y_POS: placedY,
    }

    setLayoutTables((prev) => [...prev, newTable])
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
        MERGE_GROUP_ID: null,
      },
    ])
    setSelectedTableNum(nextTableNum)
    setIsDirty(true)
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
      const result = resolveConnectedMergeGroups(combined, areTablesAdjacent)
      const suppMap = calculateSuppressionForLayout(result)

      setRestaurantTables((prev) => syncRestaurantTablesWithLayout(result, suppMap, prev))

      return result
    })

    setIsDirty(true)
    showToast(`Table ${tableNum} changed to ${newCfg.name}`, 'info')
  }

  // ── 9. Update Seat Count (Cannot exceed max capacity or venue limit) ──
  const handleUpdateSeatCount = (tableNum: number, seats: number) => {
    const target = layoutTables.find((t) => t.TABLE_NUM === tableNum)
    if (!target) return
    const maxCapacity = TABLE_TYPES[target.TABLE_TYPE]?.defaultCapacity || 4

    // Check remaining venue capacity
    const otherTablesCap = layoutTables
      .filter((t) => t.TABLE_NUM !== tableNum)
      .reduce((sum, t) => {
        const live = restaurantTables.find((r) => r.TABLE_NUM === t.TABLE_NUM)
        return sum + (live?.GUEST_CAPACITY ?? TABLE_TYPES[t.TABLE_TYPE]?.defaultCapacity ?? 4)
      }, 0)

    const venueMaxForThisTable = Math.max(1, VENUE_MAX_CAPACITY - otherTablesCap)
    const clampedSeats = Math.max(1, Math.min(maxCapacity, venueMaxForThisTable, seats))

    setRestaurantTables((prev) => {
      const exists = prev.some((r) => r.TABLE_NUM === tableNum)
      if (exists) {
        return prev.map((r) =>
          r.TABLE_NUM === tableNum ? { ...r, GUEST_CAPACITY: clampedSeats } : r,
        )
      } else {
        return [
          ...prev,
          {
            TABLE_ID: tableNum,
            TABLE_NUM: tableNum,
            STATUS: 'AVAILABLE' as const,
            GUEST_CAPACITY: clampedSeats,
            CURRENT_GUEST_COUNT: 0,
            RESERVED_SINCE: null,
            BILL_OUT_REQUESTED: false,
            MERGE_GROUP_ID: target.MERGE_GROUP_ID,
          },
        ]
      }
    })

    void updateTableCapacity(tableNum, clampedSeats).catch(() => { })
    setIsDirty(true)
  }

  // ── 9b. Update Live Guest Count (View Mode & Live Ops) ──
  const handleUpdateGuestCount = async (tableNum: number, count: number) => {
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
  const handleDeleteTable = (tableNum: number) => {
    setLayoutTables((prev) => {
      const remaining = prev.filter((t) => t.TABLE_NUM !== tableNum)
      const result = resolveConnectedMergeGroups(remaining, areTablesAdjacent)
      const suppMap = calculateSuppressionForLayout(result)

      setRestaurantTables((rPrev) =>
        syncRestaurantTablesWithLayout(
          result,
          suppMap,
          rPrev.filter((r) => r.TABLE_NUM !== tableNum),
        ),
      )
      return result
    })
    setSelectedTableNum(null)
    setIsDirty(true)
    showToast(`Removed Table ${tableNum}`, 'info')
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
    setIsDirty(true)
  }

  // ── 13. Unmerge Table ──
  const handleUnmergeTable = (tableNum: number) => {
    setLayoutTables((prev) => {
      const target = prev.find((t) => t.TABLE_NUM === tableNum)
      if (!target || target.MERGE_GROUP_ID == null) return prev
      const currentMergeId = target.MERGE_GROUP_ID
      const groupMembers = prev.filter((t) => t.MERGE_GROUP_ID === currentMergeId)

      // Try nudging unmerged table away from neighbors so they don't immediately re-merge
      const cfg = TABLE_TYPES[target.TABLE_TYPE] || TABLE_TYPES[1]
      let newX = target.X_POS
      let newY = target.Y_POS

      const directions = [
        { dx: 1, dy: 0 },
        { dx: -1, dy: 0 },
        { dx: 0, dy: 1 },
        { dx: 0, dy: -1 },
        { dx: 2, dy: 0 },
        { dx: -2, dy: 0 },
        { dx: 0, dy: 2 },
        { dx: 0, dy: -2 },
      ]

      const otherMembers = groupMembers.filter((m) => m.TABLE_NUM !== tableNum)
      for (const dir of directions) {
        const testX = Math.max(0, Math.min(gridWidth - cfg.width, target.X_POS + dir.dx))
        const testY = Math.max(0, Math.min(gridHeight - cfg.height, target.Y_POS + dir.dy))
        const testTable = { ...target, X_POS: testX, Y_POS: testY }
        const stillAdjacent = otherMembers.some((m) => areTablesAdjacent(testTable, m))
        const collidesWithAny = prev.some((other) => {
          if (other.TABLE_NUM === tableNum) return false
          const oCfg = TABLE_TYPES[other.TABLE_TYPE] || TABLE_TYPES[1]
          return (
            testX < other.X_POS + oCfg.width &&
            testX + cfg.width > other.X_POS &&
            testY < other.Y_POS + oCfg.height &&
            testY + cfg.height > other.Y_POS
          )
        })

        if (!stillAdjacent && !collidesWithAny) {
          newX = testX
          newY = testY
          break
        }
      }

      const updated = prev.map((t) => {
        if (t.TABLE_NUM === tableNum) {
          return { ...t, X_POS: newX, Y_POS: newY, MERGE_GROUP_ID: null }
        }
        return t
      })

      const result = resolveConnectedMergeGroups(updated, areTablesAdjacent)
      const suppMap = calculateSuppressionForLayout(result)

      setRestaurantTables((rPrev) => syncRestaurantTablesWithLayout(result, suppMap, rPrev))

      return result
    })
    setIsDirty(true)
    showToast(`Table ${tableNum} unmerged`, 'info')
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
      await savePresetLayout(activePresetId, layoutTables, capacityMap)
      setIsDirty(false)
      setIsEditMode(false)
      setSelectedTableNum(null)
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

  // ── 16. Drag Handling ──
  const handleMouseDown = (tableNum: number, e: React.MouseEvent) => {
    if (!isEditMode) {
      setSelectedTableNum(tableNum)
      return
    }

    e.preventDefault()
    e.stopPropagation()
    const table = layoutTables.find((t) => t.TABLE_NUM === tableNum)
    if (!table) return

    setSelectedTableNum(tableNum)
    setDragState({
      tableNum,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startTableX: table.X_POS,
      startTableY: table.Y_POS,
      currentX: table.X_POS,
      currentY: table.Y_POS,
    })
  }

  useEffect(() => {
    if (!dragState) return

    const handleMouseMove = (e: MouseEvent) => {
      const deltaPixelX = e.clientX - dragState.startMouseX
      const deltaPixelY = e.clientY - dragState.startMouseY

      const deltaGridX = Math.round(deltaPixelX / cellSize)
      const deltaGridY = Math.round(deltaPixelY / cellSize)

      const targetTable = layoutTables.find((t) => t.TABLE_NUM === dragState.tableNum)
      if (!targetTable) return

      const cfg = TABLE_TYPES[targetTable.TABLE_TYPE] || TABLE_TYPES[1]
      const nextX = Math.max(0, Math.min(gridWidth - cfg.width, dragState.startTableX + deltaGridX))
      const nextY = Math.max(0, Math.min(gridHeight - cfg.height, dragState.startTableY + deltaGridY))

      if (nextX !== dragState.currentX || nextY !== dragState.currentY) {
        setDragState((prev) => (prev ? { ...prev, currentX: nextX, currentY: nextY } : null))
      }
    }

    const handleMouseUp = () => {
      if (dragState) {
        const { tableNum, currentX, currentY, startTableX, startTableY } = dragState
        const hasMoved = currentX !== startTableX || currentY !== startTableY

        if (hasMoved) {
          setLayoutTables((prev) => {
            const currentTable = prev.find((t) => t.TABLE_NUM === tableNum)
            if (!currentTable) return prev

            const movedTable: TableLayoutInfo = {
              ...currentTable,
              X_POS: currentX,
              Y_POS: currentY,
            }

            const rawUpdated = prev.map((t) => (t.TABLE_NUM === tableNum ? movedTable : t))
            const result = resolveConnectedMergeGroups(rawUpdated, areTablesAdjacent)
            const suppMap = calculateSuppressionForLayout(result)

            setRestaurantTables((rPrev) => syncRestaurantTablesWithLayout(result, suppMap, rPrev))

            return result
          })
          setIsDirty(true)
        }
        setDragState(null)
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [dragState, gridWidth, gridHeight, layoutTables, areTablesAdjacent, cellSize])

  // ── 17. Merged Live Nodes ──
  const mergedNodes: MergedTableNode[] = useMemo(() => {
    return layoutTables.map((lt) => {
      const live = restaurantTables.find((rt) => rt.TABLE_NUM === lt.TABLE_NUM)
      const supp = chairSuppressionMap.get(lt.TABLE_NUM)
      const suppCount = supp?.suppressedCount ?? 0
      const defaultCap = TABLE_TYPES[lt.TABLE_TYPE]?.defaultCapacity ?? 4

      // In live view mode, resolve merge status from live tables if available
      let mergeId = lt.MERGE_GROUP_ID
      if (!isEditMode && live) {
        const group = resolveTableGroupByList(live.TABLE_ID, restaurantTables as TableData[])
        if (group.isMerged) {
          mergeId = group.anchorTableNum
        }
      }

      return {
        ...lt,
        MERGE_GROUP_ID: mergeId,
        STATUS: live?.STATUS ?? 'AVAILABLE',
        CURRENT_GUEST_COUNT: live?.CURRENT_GUEST_COUNT ?? 0,
        GUEST_CAPACITY: live?.GUEST_CAPACITY ?? Math.max(1, defaultCap - suppCount),
        BILL_OUT_REQUESTED: live?.BILL_OUT_REQUESTED ?? false,
        TABLE_ID: live?.TABLE_ID ?? lt.TABLE_NUM,
      }
    })
  }, [layoutTables, restaurantTables, chairSuppressionMap, isEditMode])

  // ── 18. Dynamic Bounding Box for Merged Groups ──
  const mergeGroupBounds = useMemo(() => {
    const groups = new Map<number, { minX: number; minY: number; maxX: number; maxY: number }>()

    for (const node of mergedNodes) {
      if (node.MERGE_GROUP_ID == null) continue
      const cfg = TABLE_TYPES[node.TABLE_TYPE] || TABLE_TYPES[1]
      const isDraggingThis = dragState?.tableNum === node.TABLE_NUM
      const x = isDraggingThis ? dragState.currentX : node.X_POS
      const y = isDraggingThis ? dragState.currentY : node.Y_POS
      const right = x + cfg.width
      const bottom = y + cfg.height

      const current = groups.get(node.MERGE_GROUP_ID)
      if (!current) {
        groups.set(node.MERGE_GROUP_ID, {
          minX: x,
          minY: y,
          maxX: right,
          maxY: bottom,
        })
      } else {
        groups.set(node.MERGE_GROUP_ID, {
          minX: Math.min(current.minX, x),
          minY: Math.min(current.minY, y),
          maxX: Math.max(current.maxX, right),
          maxY: Math.max(current.maxY, bottom),
        })
      }
    }

    return Array.from(groups.entries()).map(([groupId, bounds]) => ({
      groupId,
      ...bounds,
    }))
  }, [mergedNodes, dragState])

  const selectedNode = mergedNodes.find((n) => n.TABLE_NUM === selectedTableNum) || null

  // ── 19. Table QR Code Preview & Bulk Operations ──
  const [qrModalTable, setQrModalTable] = useState<{
    TABLE_ID: number
    TABLE_NUM: number
    GUEST_CAPACITY?: number
  } | null>(null)
  const [isPrintingBulk, setIsPrintingBulk] = useState(false)
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)

  const handlePrintAllQr = useCallback(async () => {
    if (mergedNodes.length === 0) return
    try {
      setIsPrintingBulk(true)
      const tableRefs = mergedNodes.map((n) => ({
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
  }, [mergedNodes])

  const handleDownloadQrPdf = useCallback(async () => {
    if (mergedNodes.length === 0) return
    try {
      setIsGeneratingPdf(true)
      const tableRefs = mergedNodes.map((n) => ({
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
  }, [mergedNodes])

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
          totalCapacity={totalAllocatedCapacity}
          maxVenueCapacity={VENUE_MAX_CAPACITY}
          isDirty={isDirty}
          onSelectPreset={handleSelectPreset}
          onRenamePreset={handleRenamePreset}
          onDeletePreset={handleDeletePreset}
          onOpenNewPresetModal={() => setNewPresetModalOpen(true)}
          isEditMode={isEditMode}
          onToggleEditMode={handleToggleEditMode}
          onSaveLayout={handleSaveLayout}
          onDiscardChanges={handleDiscardChanges}
          isSaving={isSaving}
          onDownloadQrPdf={handleDownloadQrPdf}
          onPrintAllQr={handlePrintAllQr}
          isGeneratingPdf={isGeneratingPdf}
          isPrintingBulk={isPrintingBulk}
          hasTables={mergedNodes.length > 0}
        />

        {/* Big Div: layout-container (consumes whole width with margins on all sides, contains grid) */}
        <div className="layout-container flex-1 min-h-0 mx-5 mb-5 mt-1 rounded-2xl bg-white border border-slate-200/90 shadow-xs relative overflow-hidden flex flex-col">
          {/* Add Table button in upper right corner (Edit Mode only, non-obtrusive) */}
          {isEditMode && (
            <div className="absolute top-3.5 right-3.5 z-30">
              <FloatingLayoutControls
                onAddTable={handleAddTable}
                totalCapacity={totalAllocatedCapacity}
                maxVenueCapacity={VENUE_MAX_CAPACITY}
              />
            </div>
          )}

          {/* Grid View Canvas Container - Dynamic edge-to-edge grid container */}
          <div
            ref={containerRef}
            className="flex-1 h-full w-full overflow-hidden relative bg-white select-none p-0"
            onClick={() => setSelectedTableNum(null)}
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
              {/* Dynamic Broken-Line Bounding Box for Merged Table Groups */}
              {mergeGroupBounds.map((group) => {
                const padding = Math.max(6, Math.round(cellSize * 0.12))
                const left = group.minX * cellSize - padding
                const top = group.minY * cellSize - padding
                const width = (group.maxX - group.minX) * cellSize + padding * 2
                const height = (group.maxY - group.minY) * cellSize + padding * 2

                const memberNums = mergedNodes
                  .filter((m) => m.MERGE_GROUP_ID === group.groupId)
                  .map((m) => m.TABLE_NUM)
                  .sort((a, b) => a - b)

                return (
                  <div
                    key={`merge-group-${group.groupId}`}
                    className="absolute pointer-events-none rounded-2xl border-2 border-dashed border-indigo-400/80 bg-indigo-500/5 transition-all duration-150 z-10 shadow-xs"
                    style={{
                      left: `${left}px`,
                      top: `${top}px`,
                      width: `${width}px`,
                      height: `${height}px`,
                    }}
                  >
                    <div className="absolute top-1.5 left-2 px-2 py-0.5 rounded-md bg-indigo-950/80 border border-indigo-400/50 text-indigo-300 text-[10px] font-black tracking-wider uppercase shadow-xs flex items-center gap-1">
                      <GitMerge className="w-3 h-3 text-indigo-400" />
                      <span>Merged: Tables {memberNums.join(' + ')}</span>
                    </div>
                  </div>
                )
              })}

              {/* Render Tables */}
              {mergedNodes.map((node) => {
                const isDraggingThis = dragState?.tableNum === node.TABLE_NUM
                const posX = isDraggingThis ? dragState.currentX : node.X_POS
                const posY = isDraggingThis ? dragState.currentY : node.Y_POS
                const isSelected = selectedTableNum === node.TABLE_NUM
                const suppress = chairSuppressionMap.get(node.TABLE_NUM)

                return (
                  <div
                    key={node.TABLE_NUM}
                    onMouseDown={(e) => handleMouseDown(node.TABLE_NUM, e)}
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedTableNum(node.TABLE_NUM)
                    }}
                    className={`absolute transition-transform select-none ${isEditMode ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                      } ${isDraggingThis ? 'z-40 scale-105 opacity-90' : 'z-20'}`}
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
                      isMerged={node.MERGE_GROUP_ID != null}
                      mergeGroupId={node.MERGE_GROUP_ID}
                      isSelected={isSelected}
                      isEditMode={isEditMode}
                      hideChairs={suppress}
                      onOpenQr={() => handleOpenQrModal(node)}
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
      </div>

      {/* ── Right Div: table-manager-sidebar (Consistent & always visible) ── */}
      <TableManagerSidebar
        isEditMode={isEditMode}
        selectedTable={selectedNode}
        remainingVenueCapacity={VENUE_MAX_CAPACITY - totalAllocatedCapacity}
        onUpdateTableNum={handleUpdateTableNum}
        onChangeTableType={handleChangeTableType}
        onUpdateSeatCount={handleUpdateSeatCount}
        onUpdateGuestCount={handleUpdateGuestCount}
        onUpdateStatus={handleUpdateStatus}
        onUnmergeTable={handleUnmergeTable}
        onDeleteTable={handleDeleteTable}
        onOpenQrModal={handleOpenQrModal}
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

      {/* In-App Rename Preset Modal */}
      <RenamePresetModal
        isOpen={renameModal.isOpen}
        currentName={renameModal.currentName}
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
