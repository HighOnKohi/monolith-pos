// ─────────────────────────────────────────────────────────────────────────────
// useFloorPlanState — Core state management hook for the floor-plan editor
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import { DEFAULT_FLOOR_CONFIG, type FloorConfig } from '@/utils/floorPlan/grid'
import type { TablePosition } from '@/utils/floorPlan/collision'
import {
  isValidPlacement,
  detectHardCollision,
  findFirstAvailablePosition,
  findNearestValidPosition,
} from '@/utils/floorPlan/collision'
import { snapPosition } from '@/utils/floorPlan/snapping'
import { calculateMergeGroups, type MergeGroup } from '@/utils/floorPlan/adjacency'
import { generateInitialLayout } from '@/utils/floorPlan/serialization'
import { HistoryManager, type FloorPlanSnapshot } from '@/utils/floorPlan/history'
import type { TableData } from '@/services/tableService'

// ── Types ────────────────────────────────────────────────────────────────────

export interface DragState {
  tableId: number
  startX: number
  startY: number
  currentX: number
  currentY: number
  isValid: boolean
}

export interface EditorTable extends TablePosition {
  tableId: number
  x: number
  y: number
  widthBlocks?: number
  heightBlocks?: number
  rotation?: number
  tableNum?: number
  capacity?: number
}

export const TABLE_DIMENSIONS_KEY = 'monolith_table_dimensions'

export function getStoredTableDimensions(): Record<number, { widthBlocks: number; heightBlocks: number; rotation?: number }> {
  try {
    const raw = localStorage.getItem(TABLE_DIMENSIONS_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore
  }
  return {}
}

export function saveStoredTableDimensions(dims: Record<number, { widthBlocks: number; heightBlocks: number; rotation?: number }>) {
  try {
    localStorage.setItem(TABLE_DIMENSIONS_KEY, JSON.stringify(dims))
  } catch {
    // ignore
  }
}

export interface FloorPlanState {
  // Configuration
  config: FloorConfig
  setConfig: (config: FloorConfig) => void
  updateConfig: (partial: Partial<FloorConfig>) => void

  // Table positions (local editor state, not DB until saved)
  positions: EditorTable[]
  setPositions: (positions: EditorTable[]) => void

  // Merge groups (computed from adjacency)
  mergeGroups: MergeGroup[]

  // Selection
  selectedTableId: number | null
  setSelectedTableId: (id: number | null) => void

  // Drag
  dragState: DragState | null
  startDrag: (tableId: number, x: number, y: number) => void
  updateDrag: (x: number, y: number) => void
  endDrag: () => boolean // returns whether position changed
  cancelDrag: () => void

  // Table operations
  addTable: (tableData: TableData, widthBlocks?: number, heightBlocks?: number) => EditorTable | null
  removeTable: (tableId: number) => void
  moveTable: (tableId: number, x: number, y: number) => boolean
  updateTableDimensions: (tableId: number, widthBlocks: number, heightBlocks: number) => void
  rotateTable: (tableId: number) => boolean

  // Zoom
  zoom: number
  setZoom: (z: number) => void
  zoomIn: () => void
  zoomOut: () => void
  resetZoom: () => void

  // History
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean

  // Dirty flag
  isDirty: boolean
  markClean: () => void

  // Initialize from DB tables
  initializeFromTables: (tables: TableData[], initialConfig?: FloorConfig, allowedTableIds?: Set<number>) => void
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useFloorPlanState(): FloorPlanState {
  const [config, setConfigState] = useState<FloorConfig>(DEFAULT_FLOOR_CONFIG)
  const [positions, setPositionsState] = useState<EditorTable[]>([])
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null)
  const [dragState, setDragState] = useState<DragState | null>(null)
  const [zoom, setZoomState] = useState(1)
  const [isDirty, setIsDirty] = useState(false)

  const historyRef = useRef(new HistoryManager())
  const [historyVersion, setHistoryVersion] = useState(0) // force re-render on history change

  // ── Computed merge groups ──────────────────────────────────────────────────

  const mergeGroups = useMemo(
    () => calculateMergeGroups(positions, config.tableSizeBlocks),
    [positions, config.tableSizeBlocks],
  )

  // ── Snapshot helper ────────────────────────────────────────────────────────

  const getSnapshot = useCallback((): FloorPlanSnapshot => ({
    positions: positions.map((p) => ({ ...p })),
    mergeGroups: mergeGroups.map((g) => ({ anchorId: g.anchorId, memberIds: [...g.memberIds] })),
    config: { ...config },
    tableIds: positions.map((p) => p.tableId),
  }), [positions, mergeGroups, config])

  const pushHistory = useCallback(() => {
    historyRef.current.push(getSnapshot())
    setHistoryVersion((v) => v + 1)
  }, [getSnapshot])

  const applySnapshot = useCallback((snapshot: FloorPlanSnapshot) => {
    setPositionsState(snapshot.positions.map((p) => ({ ...p })))
    setConfigState({ ...snapshot.config })
    setIsDirty(true)
    setHistoryVersion((v) => v + 1)
  }, [])

  // ── Config ─────────────────────────────────────────────────────────────────

  const setConfig = useCallback((newConfig: FloorConfig) => {
    pushHistory()
    setConfigState(newConfig)
    setPositionsState((prev) =>
      prev.map((p) => {
        const w = p.widthBlocks ?? newConfig.tableSizeBlocks
        const h = p.heightBlocks ?? newConfig.tableSizeBlocks
        const maxX = Math.max(0, newConfig.widthBlocks - w)
        const maxY = Math.max(0, newConfig.heightBlocks - h)
        if (p.x > maxX || p.y > maxY) {
          return {
            ...p,
            x: Math.min(p.x, maxX),
            y: Math.min(p.y, maxY),
          }
        }
        return p
      }),
    )
    setIsDirty(true)
  }, [pushHistory])

  const updateConfig = useCallback((partial: Partial<FloorConfig>) => {
    pushHistory()
    setConfigState((prev) => ({ ...prev, ...partial }))
    setIsDirty(true)
  }, [pushHistory])

  // ── Positions ──────────────────────────────────────────────────────────────

  const setPositions = useCallback((newPositions: EditorTable[]) => {
    setPositionsState(newPositions)
    setIsDirty(true)
  }, [])

  // ── Drag ───────────────────────────────────────────────────────────────────

  const startDrag = useCallback((tableId: number, x: number, y: number) => {
    setDragState({ tableId, startX: x, startY: y, currentX: x, currentY: y, isValid: true })
    setSelectedTableId(tableId)
  }, [])

  const updateDrag = useCallback((x: number, y: number) => {
    setDragState((prev) => {
      if (!prev) return null
      const current = positions.find((p) => p.tableId === prev.tableId)
      const w = current?.widthBlocks ?? config.tableSizeBlocks
      const h = current?.heightBlocks ?? config.tableSizeBlocks
      const snapped = snapPosition(
        x, y,
        config.tableSizeBlocks,
        config.widthBlocks,
        config.heightBlocks,
        config.snapEnabled,
        1,
        w,
        h,
      )
      const valid = isValidPlacement(
        snapped.x, snapped.y,
        prev.tableId,
        config.tableSizeBlocks,
        config.widthBlocks,
        config.heightBlocks,
        positions.filter((p) => p.tableId !== prev.tableId),
        0,
        w,
        h,
      )
      return { ...prev, currentX: snapped.x, currentY: snapped.y, isValid: valid }
    })
  }, [config, positions])

  const endDrag = useCallback((): boolean => {
    if (!dragState) return false

    const { tableId, startX, startY, currentX, currentY, isValid } = dragState

    if (!isValid) {
      // Revert to starting position
      setDragState(null)
      return false
    }

    const moved = currentX !== startX || currentY !== startY

    if (moved) {
      pushHistory()
      setPositionsState((prev) =>
        prev.map((p) => (p.tableId === tableId ? { ...p, x: currentX, y: currentY } : p)),
      )
      setIsDirty(true)
    }

    setDragState(null)
    return moved
  }, [dragState, pushHistory])

  const cancelDrag = useCallback(() => {
    setDragState(null)
  }, [])

  // ── Table operations ───────────────────────────────────────────────────────

  const addTable = useCallback((tableData: TableData, widthBlocks?: number, heightBlocks?: number): EditorTable | null => {
    const existing = positions.find((p) => p.tableId === tableData.TABLE_ID)
    if (existing) return existing

    const w = widthBlocks ?? (tableData.GUEST_CAPACITY > 4 ? 4 : config.tableSizeBlocks)
    const h = heightBlocks ?? config.tableSizeBlocks

    const pos = findFirstAvailablePosition(
      config.tableSizeBlocks,
      config.widthBlocks,
      config.heightBlocks,
      positions,
      config.spacingBlocks,
      w,
      h,
    )
    if (!pos) return null

    pushHistory()
    const newTable: EditorTable = {
      tableId: tableData.TABLE_ID,
      tableNum: tableData.TABLE_NUM,
      capacity: tableData.GUEST_CAPACITY,
      x: pos.x,
      y: pos.y,
      widthBlocks: w,
      heightBlocks: h,
    }
    setPositionsState((prev) => [...prev, newTable])
    setIsDirty(true)
    setSelectedTableId(tableData.TABLE_ID)

    const dims = getStoredTableDimensions()
    dims[tableData.TABLE_ID] = { widthBlocks: w, heightBlocks: h }
    saveStoredTableDimensions(dims)

    return newTable
  }, [positions, config, pushHistory])

  const removeTable = useCallback((tableId: number) => {
    pushHistory()
    setPositionsState((prev) => prev.filter((p) => p.tableId !== tableId))
    if (selectedTableId === tableId) setSelectedTableId(null)
    setIsDirty(true)
    const dims = getStoredTableDimensions()
    delete dims[tableId]
    saveStoredTableDimensions(dims)
  }, [pushHistory, selectedTableId])

  const updateTableDimensions = useCallback((tableId: number, widthBlocks: number, heightBlocks: number) => {
    pushHistory()
    setPositionsState((prev) =>
      prev.map((p) => (p.tableId === tableId ? { ...p, widthBlocks, heightBlocks } : p)),
    )
    setIsDirty(true)
    const dims = getStoredTableDimensions()
    dims[tableId] = {
      widthBlocks,
      heightBlocks,
      rotation: dims[tableId]?.rotation ?? 0,
    }
    saveStoredTableDimensions(dims)
  }, [pushHistory])

  const rotateTable = useCallback((tableId: number): boolean => {
    const current = positions.find((p) => p.tableId === tableId)
    if (!current) return false

    const curW = current.widthBlocks ?? config.tableSizeBlocks
    const curH = current.heightBlocks ?? config.tableSizeBlocks
    const curRot = current.rotation ?? 0

    const newW = curH
    const newH = curW
    const newRot = (curRot + 90) % 360

    // Keep within floor boundaries
    let newX = current.x
    let newY = current.y
    if (newX + newW > config.widthBlocks) {
      newX = Math.max(0, config.widthBlocks - newW)
    }
    if (newY + newH > config.heightBlocks) {
      newY = Math.max(0, config.heightBlocks - newH)
    }

    // Check collision with other tables
    const others = positions.filter((p) => p.tableId !== tableId)
    const collides = detectHardCollision(
      { tableId, x: newX, y: newY, widthBlocks: newW, heightBlocks: newH },
      config.tableSizeBlocks,
      others,
    )

    if (collides) {
      const safe = findNearestValidPosition(
        newX, newY, tableId, config.tableSizeBlocks,
        config.widthBlocks, config.heightBlocks, others,
        newW, newH,
      )
      if (safe) {
        newX = safe.x
        newY = safe.y
      } else {
        return false
      }
    }

    pushHistory()
    setPositionsState((prev) =>
      prev.map((p) =>
        p.tableId === tableId
          ? { ...p, x: newX, y: newY, widthBlocks: newW, heightBlocks: newH, rotation: newRot }
          : p,
      ),
    )
    setIsDirty(true)

    const dims = getStoredTableDimensions()
    dims[tableId] = { widthBlocks: newW, heightBlocks: newH, rotation: newRot }
    saveStoredTableDimensions(dims)

    return true
  }, [config, positions, pushHistory])

  const moveTable = useCallback((tableId: number, x: number, y: number): boolean => {
    const current = positions.find((p) => p.tableId === tableId)
    const w = current?.widthBlocks ?? config.tableSizeBlocks
    const h = current?.heightBlocks ?? config.tableSizeBlocks

    const snapped = snapPosition(
      x, y,
      config.tableSizeBlocks,
      config.widthBlocks,
      config.heightBlocks,
      config.snapEnabled,
      1,
      w,
      h,
    )

    const others = positions.filter((p) => p.tableId !== tableId)
    const valid = isValidPlacement(
      snapped.x, snapped.y, tableId, config.tableSizeBlocks,
      config.widthBlocks, config.heightBlocks, others, 0, w, h,
    )

    if (!valid) return false

    pushHistory()
    setPositionsState((prev) =>
      prev.map((p) => (p.tableId === tableId ? { ...p, x: snapped.x, y: snapped.y } : p)),
    )
    setIsDirty(true)
    return true
  }, [config, positions, pushHistory])

  // ── Zoom ───────────────────────────────────────────────────────────────────

  const setZoom = useCallback((z: number) => {
    setZoomState(Math.max(0.25, Math.min(3, z)))
  }, [])

  const zoomIn = useCallback(() => setZoom(zoom + 0.15), [zoom, setZoom])
  const zoomOut = useCallback(() => setZoom(zoom - 0.15), [zoom, setZoom])
  const resetZoom = useCallback(() => setZoomState(1), [])

  // ── History ────────────────────────────────────────────────────────────────

  const undo = useCallback(() => {
    const snapshot = historyRef.current.undo(getSnapshot())
    if (snapshot) applySnapshot(snapshot)
  }, [getSnapshot, applySnapshot])

  const redo = useCallback(() => {
    const snapshot = historyRef.current.redo(getSnapshot())
    if (snapshot) applySnapshot(snapshot)
  }, [getSnapshot, applySnapshot])

  // ── Initialize from DB ─────────────────────────────────────────────────────

  const initializeFromTables = useCallback((tables: TableData[], initialConfig?: FloorConfig, allowedTableIds?: Set<number>) => {
    if (initialConfig) {
      setConfigState(initialConfig)
    }
    const activeConfig = initialConfig ?? config
    const dims = getStoredTableDimensions()

    // Filter by allowedTableIds if provided
    const targetTables = allowedTableIds
      ? tables.filter((t) => allowedTableIds.has(t.TABLE_ID))
      : tables

    // Check if tables have stored positions
    const hasPositions = targetTables.some((t) => t.LAYOUT_X !== null && t.LAYOUT_Y !== null)

    let newPositions: EditorTable[]

    if (hasPositions) {
      newPositions = targetTables
        .filter((t) => t.LAYOUT_X !== null && t.LAYOUT_Y !== null)
        .map((t) => ({
          tableId: t.TABLE_ID,
          tableNum: t.TABLE_NUM,
          capacity: t.GUEST_CAPACITY,
          x: t.LAYOUT_X!,
          y: t.LAYOUT_Y!,
          widthBlocks: dims[t.TABLE_ID]?.widthBlocks ?? (t.GUEST_CAPACITY > 4 ? 4 : activeConfig.tableSizeBlocks),
          heightBlocks: dims[t.TABLE_ID]?.heightBlocks ?? activeConfig.tableSizeBlocks,
          rotation: dims[t.TABLE_ID]?.rotation ?? 0,
        }))
      // Do NOT auto-place unpositioned tables! Unpositioned tables belong to other layouts or are unplaced.
    } else {
      // No saved positions — generate initial layout
      const rawLayout = generateInitialLayout(
        targetTables.map((t) => t.TABLE_ID),
        activeConfig.widthBlocks,
        activeConfig.tableSizeBlocks,
        activeConfig.spacingBlocks,
      )
      newPositions = rawLayout.map((p) => {
        const t = targetTables.find((table) => table.TABLE_ID === p.tableId)
        return {
          ...p,
          tableNum: t?.TABLE_NUM,
          capacity: t?.GUEST_CAPACITY,
          widthBlocks: dims[p.tableId]?.widthBlocks ?? activeConfig.tableSizeBlocks,
          heightBlocks: dims[p.tableId]?.heightBlocks ?? activeConfig.tableSizeBlocks,
          rotation: dims[p.tableId]?.rotation ?? 0,
        }
      })
    }

    const normalized: EditorTable[] = []
    for (const position of newPositions) {
      const safe = findNearestValidPosition(
        position.x, position.y, position.tableId, activeConfig.tableSizeBlocks,
        activeConfig.widthBlocks, activeConfig.heightBlocks, normalized,
        position.widthBlocks, position.heightBlocks,
      )
      if (safe) normalized.push({ ...position, ...safe })
    }
    setPositionsState(normalized)
    historyRef.current.clear()
    setIsDirty(false)
  }, [config])

  // ── Dirty ──────────────────────────────────────────────────────────────────

  const markClean = useCallback(() => {
    setIsDirty(false)
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyboard(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        redo()
      }
      if (e.key === 'Escape') {
        cancelDrag()
        setSelectedTableId(null)
      }
      if (e.key === 'r' || e.key === 'R') {
        const active = document.activeElement
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT')) return
        if (selectedTableId !== null) {
          e.preventDefault()
          rotateTable(selectedTableId)
        }
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Only if no input/textarea is focused
        const active = document.activeElement
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return
        // Table deletion is handled by the parent page with confirmation
      }
    }

    document.addEventListener('keydown', handleKeyboard)
    return () => document.removeEventListener('keydown', handleKeyboard)
  }, [undo, redo, cancelDrag, selectedTableId, rotateTable])

  return {
    config,
    setConfig,
    updateConfig,
    positions,
    setPositions,
    mergeGroups,
    selectedTableId,
    setSelectedTableId,
    dragState,
    startDrag,
    updateDrag,
    endDrag,
    cancelDrag,
    addTable,
    removeTable,
    moveTable,
    updateTableDimensions,
    rotateTable,
    zoom,
    setZoom,
    zoomIn,
    zoomOut,
    resetZoom,
    undo,
    redo,
    canUndo: historyVersion >= 0 && historyRef.current.canUndo,
    canRedo: historyVersion >= 0 && historyRef.current.canRedo,
    isDirty,
    markClean,
    initializeFromTables,
  }
}
