import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import {
  fetchAllLayoutPresets,
  fetchPresetLayout,
  fetchLiveRestaurantTables,
  TABLE_TYPES,
  DEFAULT_GRID_WIDTH,
  DEFAULT_GRID_HEIGHT,
  GRID_MARGIN_BLOCKS,
  TOTAL_GRID_WIDTH_BLOCKS,
  TOTAL_GRID_HEIGHT_BLOCKS,
  type TableLayoutPreset,
  type MergedTableNode,
  type TableLayoutInfo,
} from '@/services/tableLayoutService'
import { calculateLayoutSuppression } from '@/utils/floorPlan/capacity'
import {
  fetchAllTables,
  setTableStatus,
  updateSeatedPax,
  unmergeTables,
  saveTableMerge,
  reserveTable,
  cancelReservation,
  setTableMergePersistency,
  type TableData,
  type TableStatus,
} from '@/services/tableService'
import { fetchActiveLabels, assignLabelToTable, type TableLabel } from '@/services/tableLabelService'
import { resolveTableGroupByList } from '@/services/tableGroupService'
import { logTableAction } from '@/services/tableAuditService'
import { TableVisual, TableShapeIcon } from '@/pages/TableManager/components/TableVisual'
import { LabelSelector } from '@/components/common/LabelSelector'
import {
  Users,
  CheckCircle2,
  Clock,
  Ban,
  GitMerge,
  Unlink,
  Minus,
  Plus,
  AlertCircle,
  X,
  Check,
  Tag,
  Receipt,
  LayoutGrid,
  CalendarClock,
  Calendar,
  Phone,
  UserCheck,
  ShoppingBag,
} from 'lucide-react'
import {
  getActiveAdvanceOrderByTable,
  confirmAdvanceOrderToRegular,
  discardAdvanceOrderForTable,
} from '@/services/advanceOrderService'
import type { AdvanceOrder } from '@/types/advanceOrder'
import { LabelManagementModal } from '@/pages/TableManager/components/LabelManagementModal'
import { ReceptionistShiftHeaderBar } from '@/components/receptionist/ReceptionistShiftHeaderBar'

interface MergeGroupVisualBox {
  type: 'box'
  groupId: number
  minX: number
  minY: number
  maxX: number
  maxY: number
  isSelected: boolean
}

interface MergeGroupVisualChain {
  type: 'chain'
  groupId: number
  nodes: { tableNum: number; cx: number; cy: number }[]
  links: { fromTable: number; toTable: number; x1: number; y1: number; x2: number; y2: number }[]
  isSelected: boolean
}

type MergeGroupVisual = MergeGroupVisualBox | MergeGroupVisualChain

export default function ReceptionistInterface() {
  // ── Data State ──
  const [tables, setTables] = useState<TableData[]>([])
  const [layoutTables, setLayoutTables] = useState<MergedTableNode[]>([])
  const [activePreset, setActivePreset] = useState<TableLayoutPreset | null>(null)
  const activePresetRef = useRef<TableLayoutPreset | null>(null)
  activePresetRef.current = activePreset
  const lastMutationTimeRef = useRef<number>(0)
  const [labels, setLabels] = useState<TableLabel[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // ── UI State ──
  const [selectedTableNum, setSelectedTableNum] = useState<number | null>(null)
  const [selectedTableNums, setSelectedTableNums] = useState<Set<number>>(new Set())
  const [statusFilter, setStatusFilter] = useState<TableStatus | 'ALL'>('ALL')
  const [containerDimensions, setContainerDimensions] = useState({ width: 0, height: 0 })
  const [labelsModalOpen, setLabelsModalOpen] = useState(false)
  const [advanceOrderForSelectedTable, setAdvanceOrderForSelectedTable] = useState<AdvanceOrder | null>(null)
  const [keepAdvanceOrder, setKeepAdvanceOrder] = useState<boolean>(true)

  // ── Sidebar Tabs State ──
  type SidebarTab = 'table' | 'reservation' | 'advanced_orders'
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('table')

  // ── Reservation Form State ──
  interface TableReservation {
    tableNum: number
    customerName: string
    phoneNumber: string
    partySize: number
    reservationTime: string
    notes: string
    createdAt: string
  }
  const [reservations, setReservations] = useState<Record<number, TableReservation>>(() => {
    try {
      const saved = localStorage.getItem('monolith_table_reservations')
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  })
  const [resCustomerName, setResCustomerName] = useState('')
  const [resPhone, setResPhone] = useState('')
  const [resPartySize, setResPartySize] = useState<number>(2)
  const [resTime, setResTime] = useState('')
  const [resNotes, setResNotes] = useState('')

  // ── Merge Modal State ──
  const [mergeModalOpen, setMergeModalOpen] = useState(false)
  const [mergePersistencyChoice, setMergePersistencyChoice] = useState<'TEMPORARY' | 'CONTINOUOUS'>('TEMPORARY')

  // ── Drag & Drop State ──
  interface DragState {
    tableNum: number
    startMouseX: number
    startMouseY: number
    startTableX: number
    startTableY: number
    currentX: number
    currentY: number
  }
  const [dragState, setDragState] = useState<DragState | null>(null)
  const dragStateRef = useRef<DragState | null>(null)
  dragStateRef.current = dragState

  const containerRef = useRef<HTMLDivElement>(null)

  // ── Toast ──
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null)
  function showToast(text: string, type: 'success' | 'error' | 'info' = 'success') {
    setToastMessage({ text, type })
    setTimeout(() => setToastMessage(null), 3000)
  }

  // ── Labels Map ──
  const labelMap = useMemo(() => {
    const map = new Map<number, TableLabel>()
    labels.forEach((l) => map.set(l.LABEL_ID, l))
    return map
  }, [labels])

  // ── Track Container Resize (Identical to TableManager) ──
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

  // ── Fixed Grid Dimensions & Proportional Scaling ──
  const gridWidth = DEFAULT_GRID_WIDTH
  const gridHeight = DEFAULT_GRID_HEIGHT

  // Dynamic cell size: scales to fit BOTH container width and height (17 blocks wide x 12 blocks high)
  const cellSize = useMemo(() => {
    if (containerDimensions.width <= 0 || containerDimensions.height <= 0) return 48
    const maxW = (containerDimensions.width - 24) / TOTAL_GRID_WIDTH_BLOCKS
    const maxH = (containerDimensions.height - 24) / TOTAL_GRID_HEIGHT_BLOCKS
    return Math.max(28, Math.floor(Math.min(maxW, maxH)))
  }, [containerDimensions.width, containerDimensions.height])

  const halfCellMarginPx = Math.round(GRID_MARGIN_BLOCKS * cellSize)
  const playableWidthPx = gridWidth * cellSize
  const playableHeightPx = gridHeight * cellSize
  const totalFloorWidthPx = playableWidthPx + halfCellMarginPx * 2
  const totalFloorHeightPx = playableHeightPx + halfCellMarginPx * 2

  // ── Effective Layout Tables taking active drag into account ──
  const effectiveLayoutTables = useMemo(() => {
    if (!dragState) return layoutTables
    return layoutTables.map((t) =>
      t.TABLE_NUM === dragState.tableNum ? { ...t, X_POS: dragState.currentX, Y_POS: dragState.currentY } : t
    )
  }, [layoutTables, dragState])

  // ── Chair Suppression Map ──
  const chairSuppressionMap = useMemo(() => {
    return calculateLayoutSuppression(effectiveLayoutTables)
  }, [effectiveLayoutTables])

  // ── Data Loading ──
  const loadData = useCallback(async (silent = false, presetOverrideId?: number) => {
    if (!silent) setIsLoading(true)
    try {
      const [presetsResult, tablesResult, labelsResult, liveResult] = await Promise.allSettled([
        fetchAllLayoutPresets(),
        fetchAllTables(),
        fetchActiveLabels(),
        fetchLiveRestaurantTables(),
      ])

      const presetsData = presetsResult.status === 'fulfilled' ? presetsResult.value : []
      const allTables = tablesResult.status === 'fulfilled' ? tablesResult.value : []
      const labelsData = labelsResult.status === 'fulfilled' ? labelsResult.value : []
      const liveTables = liveResult.status === 'fulfilled' ? liveResult.value : []

      setLabels(labelsData)
      setTables(allTables)

      let targetPreset = presetsData.find((p) => p.IS_DEFAULT) ?? presetsData[0] ?? null
      if (presetOverrideId) {
        targetPreset = presetsData.find((p) => p.LAYOUT_PRESET_ID === presetOverrideId) ?? targetPreset
      } else if (activePresetRef.current) {
        targetPreset = presetsData.find((p) => p.LAYOUT_PRESET_ID === activePresetRef.current?.LAYOUT_PRESET_ID) ?? targetPreset
      }
      setActivePreset(targetPreset)

      const liveByNum = new Map(liveTables.map((t) => [t.TABLE_NUM, t]))

      let layoutData: TableLayoutInfo[] = []
      if (targetPreset) {
        layoutData = await fetchPresetLayout(targetPreset.LAYOUT_PRESET_ID).catch((err) => {
          console.warn('[ReceptionistInterface] Failed to fetch preset layout:', err)
          return []
        })
      }

      // Build shared label map across merged table groups
      const mergeGroupLabelMap = new Map<number | string, number>()
      for (const lt of layoutData) {
        const live = liveByNum.get(lt.TABLE_NUM)
        let gid: number | string | null = lt.MERGE_GROUP_ID ?? null
        if (gid == null && live?.MERGE_GROUP_ID != null) {
          gid = live.MERGE_GROUP_ID
        }
        if (gid == null && live?.TABLE_ID != null) {
          const isCaptain = liveTables.some((rt) => rt.MERGE_GROUP_ID === live.TABLE_ID)
          if (isCaptain) gid = live.TABLE_ID
        }
        if (gid != null) {
          const lbl = live?.LABEL_ID != null ? live.LABEL_ID : (lt.LABEL_ID ?? null)
          if (lbl != null && !mergeGroupLabelMap.has(gid)) {
            mergeGroupLabelMap.set(gid, lbl)
          }
        }
      }

      if (layoutData.length > 0) {
        const mergedNodes: MergedTableNode[] = layoutData.map((lt) => {
          const live = liveByNum.get(lt.TABLE_NUM)
          let gid: number | null = lt.MERGE_GROUP_ID != null ? Number(lt.MERGE_GROUP_ID) : null
          if (gid == null && live?.MERGE_GROUP_ID != null) {
            gid = Number(live.MERGE_GROUP_ID)
          }
          if (gid == null && live?.TABLE_ID != null) {
            const isCaptain = liveTables.some((rt) => rt.MERGE_GROUP_ID === live.TABLE_ID)
            if (isCaptain) gid = Number(live.TABLE_ID)
          }

          const directLabel = live?.LABEL_ID != null ? live.LABEL_ID : (lt.LABEL_ID ?? null)
          const resolvedLabel = gid != null ? (mergeGroupLabelMap.get(gid) ?? directLabel) : directLabel

          return {
            ...lt,
            MERGE_GROUP_ID: gid,
            STATUS: (live?.STATUS || 'AVAILABLE') as MergedTableNode['STATUS'],
            CURRENT_GUEST_COUNT: live?.CURRENT_GUEST_COUNT ?? 0,
            GUEST_CAPACITY: live?.GUEST_CAPACITY ?? lt.TABLE_CAPACITY ?? TABLE_TYPES[lt.TABLE_TYPE]?.defaultCapacity ?? 4,
            BILL_OUT_REQUESTED: live?.BILL_OUT_REQUESTED ?? false,
            TABLE_ID: live?.TABLE_ID ?? lt.TABLE_NUM,
            LABEL_ID: resolvedLabel,
            MERGE_PERSISTENCY: live?.MERGE_PERSISTENCY ?? null,
            OCCUPIED_SINCE: live?.OCCUPIED_SINCE ?? null,
            RESERVATION_ID: live?.RESERVATION_ID ?? null,
            RESERVATION_NAME: live?.RESERVATION_NAME ?? null,
            RESERVATION_PAX: live?.RESERVATION_PAX ?? null,
            RESERVATION_NOTES: live?.RESERVATION_NOTES ?? null,
            RESERVATION_TIME_LIMIT: live?.RESERVATION_TIME_LIMIT ?? null,
            RESERVED_SINCE: live?.RESERVED_SINCE ?? null,
          }
        })
        setLayoutTables(mergedNodes)
      } else if (liveTables.length > 0) {
        const fallbackGroupLabelMap = new Map<number | string, number>()
        for (const rt of liveTables) {
          let gid: number | string | null = rt.MERGE_GROUP_ID ?? null
          if (gid == null) {
            const isCaptain = liveTables.some((other) => other.MERGE_GROUP_ID === rt.TABLE_ID)
            if (isCaptain) gid = rt.TABLE_ID
          }
          if (gid != null && rt.LABEL_ID != null && !fallbackGroupLabelMap.has(gid)) {
            fallbackGroupLabelMap.set(gid, rt.LABEL_ID)
          }
        }

        const fallbackNodes: MergedTableNode[] = liveTables.map((rt, idx) => {
          let gid: number | null = rt.MERGE_GROUP_ID != null ? Number(rt.MERGE_GROUP_ID) : null
          if (gid == null) {
            const isCaptain = liveTables.some((other) => other.MERGE_GROUP_ID === rt.TABLE_ID)
            if (isCaptain) gid = Number(rt.TABLE_ID)
          }
          const directLabel = rt.LABEL_ID ?? null
          const resolvedLabel = gid != null ? (fallbackGroupLabelMap.get(gid) ?? directLabel) : directLabel

          return {
            INFO_ID: `live-table-${rt.TABLE_NUM}`,
            LAYOUT_PRESET_ID: targetPreset?.LAYOUT_PRESET_ID ?? 0,
            TABLE_NUM: rt.TABLE_NUM,
            MERGE_GROUP_ID: gid,
            TABLE_TYPE: 1,
            X_POS: (idx % 6) * 3 + 1,
            Y_POS: Math.floor(idx / 6) * 3 + 1,
            STATUS: rt.STATUS,
            CURRENT_GUEST_COUNT: rt.CURRENT_GUEST_COUNT,
            GUEST_CAPACITY: rt.GUEST_CAPACITY,
            BILL_OUT_REQUESTED: rt.BILL_OUT_REQUESTED,
            TABLE_ID: rt.TABLE_ID,
            LABEL_ID: resolvedLabel,
            MERGE_PERSISTENCY: rt.MERGE_PERSISTENCY ?? null,
            OCCUPIED_SINCE: rt.OCCUPIED_SINCE ?? null,
            RESERVATION_ID: rt.RESERVATION_ID ?? null,
            RESERVATION_NAME: rt.RESERVATION_NAME ?? null,
            RESERVATION_PAX: rt.RESERVATION_PAX ?? null,
            RESERVATION_NOTES: rt.RESERVATION_NOTES ?? null,
            RESERVATION_TIME_LIMIT: rt.RESERVATION_TIME_LIMIT ?? null,
            RESERVED_SINCE: rt.RESERVED_SINCE ?? null,
          }
        })
        setLayoutTables(fallbackNodes)
      } else {
        setLayoutTables([])
      }

      // Sync active reservations from Table_Reservations joined on liveTables
      const dbReservations: Record<number, TableReservation> = {}
      for (const rt of liveTables) {
        if (rt.STATUS === 'RESERVED' && rt.RESERVATION_NAME) {
          dbReservations[rt.TABLE_NUM] = {
            tableNum: rt.TABLE_NUM,
            customerName: rt.RESERVATION_NAME,
            phoneNumber: '',
            partySize: rt.RESERVATION_PAX || rt.CURRENT_GUEST_COUNT || 1,
            reservationTime: rt.RESERVATION_TIME_LIMIT || 'Later today',
            notes: rt.RESERVATION_NOTES || '',
            createdAt: rt.RESERVED_SINCE || new Date().toISOString(),
          }
        }
      }
      if (Object.keys(dbReservations).length > 0) {
        setReservations((prev) => ({ ...prev, ...dbReservations }))
      }
    } catch (err) {
      console.error('[ReceptionistInterface] Error loading data:', err)
      showToast('Failed to load table data', 'error')
    } finally {
      if (!silent) setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData(false)

    // Realtime subscriptions with local mutation debouncing
    const channel = supabase
      .channel('receptionist-live-sync')
      .on('postgres_changes', { event: '*', schema: 'tables', table: 'Active_Tables' }, () => {
        if (Date.now() - lastMutationTimeRef.current >= 2500) {
          void loadData(true)
        }
      })
      .on('postgres_changes', { event: '*', schema: 'tables', table: 'Table_Info' }, () => {
        if (Date.now() - lastMutationTimeRef.current >= 2500) {
          void loadData(true)
        }
      })
      .on('postgres_changes', { event: '*', schema: 'tables', table: 'Table_Reservations' }, () => {
        if (Date.now() - lastMutationTimeRef.current >= 2500) {
          void loadData(true)
        }
      })
      .on('postgres_changes', { event: '*', schema: 'tables', table: 'Table_Labels' }, () => {
        if (Date.now() - lastMutationTimeRef.current >= 2500) {
          void loadData(true)
        }
      })
      .on('postgres_changes', { event: '*', schema: 'tables', table: 'Table_Layout_Presets' }, () => {
        if (Date.now() - lastMutationTimeRef.current >= 2500) {
          void loadData(true)
        }
      })
      .subscribe()

    const handleOrderUpdate = (e?: Event) => {
      const detail = (e as CustomEvent<{ type?: string }>)?.detail
      if (detail?.type === 'table_label_changed') {
        void loadData(true)
        return
      }
      if (Date.now() - lastMutationTimeRef.current >= 2500) {
        void loadData(true)
      }
    }
    window.addEventListener('monolith-order-update', handleOrderUpdate)

    const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('monolith_order_events') : null
    if (bc) {
      bc.onmessage = (msgEvent) => {
        window.dispatchEvent(new CustomEvent('monolith-order-update', { detail: msgEvent.data }))
      }
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastMutationTimeRef.current >= 2500) {
        void loadData(true)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      window.removeEventListener('monolith-order-update', handleOrderUpdate)
      document.removeEventListener('visibilitychange', handleVisibility)
      bc?.close()
      supabase.removeChannel(channel)
    }
  }, [loadData])

  // ── Selected Table ──
  const selectedTable = useMemo(() => {
    if (selectedTableNum === null) return null
    return layoutTables.find((t) => t.TABLE_NUM === selectedTableNum) ?? null
  }, [selectedTableNum, layoutTables])

  const selectedGroup = useMemo(() => {
    if (!selectedTable?.TABLE_ID) return null
    return resolveTableGroupByList(selectedTable.TABLE_ID, tables)
  }, [selectedTable, tables])

  // Synchronize active advance order for currently inspected table
  useEffect(() => {
    if (!selectedTable) {
      setAdvanceOrderForSelectedTable(null)
      return
    }

    let isMounted = true
    getActiveAdvanceOrderByTable(selectedTable.TABLE_ID ?? selectedTable.TABLE_NUM, selectedTable.TABLE_NUM)
      .then((order) => {
        if (isMounted) {
          setAdvanceOrderForSelectedTable(order)
          setKeepAdvanceOrder(true)
        }
      })
      .catch((err) => {
        console.warn('[ReceptionistInterface] Failed to check advance order for table:', err)
      })

    return () => {
      isMounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTable?.TABLE_ID, selectedTable?.TABLE_NUM, selectedTable?.STATUS])

  // ── Status Counts & Venue Pax ──
  const { statusCounts, totalSeatedPax, totalVenueCapacity } = useMemo(() => {
    const counts = { AVAILABLE: 0, OCCUPIED: 0, RESERVED: 0, HAS_REQUEST: 0, UNAVAILABLE: 0 }
    let seated = 0
    let cap = 0
    const processedMergeGroups = new Set<number>()

    for (const t of layoutTables) {
      if (t.STATUS && counts[t.STATUS] !== undefined) {
        counts[t.STATUS]++
      }
      cap += t.GUEST_CAPACITY ?? 4

      if (t.MERGE_GROUP_ID != null) {
        if (!processedMergeGroups.has(t.MERGE_GROUP_ID)) {
          processedMergeGroups.add(t.MERGE_GROUP_ID)
          seated += t.CURRENT_GUEST_COUNT ?? 0
        }
      } else {
        seated += t.CURRENT_GUEST_COUNT ?? 0
      }
    }
    return { statusCounts: counts, totalSeatedPax: seated, totalVenueCapacity: cap }
  }, [layoutTables])

  // ── Combined Pax & Capacity for Selected Table ──
  const isSelectedMerged = Boolean(selectedTable?.MERGE_GROUP_ID != null || selectedGroup?.isMerged)

  const selectedGroupMembers = useMemo(() => {
    if (!selectedTable) return []
    if (selectedTable.MERGE_GROUP_ID != null) {
      return layoutTables.filter((t) => t.MERGE_GROUP_ID === selectedTable.MERGE_GROUP_ID)
    }
    return [selectedTable]
  }, [selectedTable, layoutTables])

  const selectedEffectiveCapacity = useMemo(() => {
    if (!selectedTable) return 4
    if (isSelectedMerged) {
      return selectedGroupMembers.reduce((sum, m) => sum + (m.GUEST_CAPACITY ?? 4), 0)
    }
    return selectedTable.GUEST_CAPACITY ?? 4
  }, [selectedTable, isSelectedMerged, selectedGroupMembers])

  const selectedCurrentPax = useMemo(() => {
    if (!selectedTable) return 0
    if (isSelectedMerged) {
      return Math.max(...selectedGroupMembers.map((m) => m.CURRENT_GUEST_COUNT ?? 0), 0)
    }
    return selectedTable.CURRENT_GUEST_COUNT ?? 0
  }, [selectedTable, isSelectedMerged, selectedGroupMembers])

  const quickPaxOptions = useMemo(() => {
    if (selectedEffectiveCapacity <= 4) {
      return [1, 2, 3, 4].filter((p) => p <= selectedEffectiveCapacity)
    }
    if (selectedEffectiveCapacity <= 8) {
      return [2, 4, 6, selectedEffectiveCapacity].filter((v, i, a) => a.indexOf(v) === i)
    }
    const step = Math.max(2, Math.ceil(selectedEffectiveCapacity / 4))
    const list = [2, 2 + step, 2 + step * 2, selectedEffectiveCapacity]
    return Array.from(new Set(list.filter((p) => p <= selectedEffectiveCapacity)))
  }, [selectedEffectiveCapacity])

  // ── Dynamic Visuals for Merged Groups (Box or Chain) ──
  const mergeGroupVisuals: MergeGroupVisual[] = useMemo(() => {
    const groupMap = new Map<number, MergedTableNode[]>()
    for (const node of layoutTables) {
      if (node.MERGE_GROUP_ID == null) continue
      const list = groupMap.get(node.MERGE_GROUP_ID) || []
      list.push(node)
      groupMap.set(node.MERGE_GROUP_ID, list)
    }

    const visuals: MergeGroupVisual[] = []

    for (const [groupId, members] of groupMap.entries()) {
      if (members.length < 2) continue

      const isGroupSelected = members.some((m) => m.TABLE_NUM === selectedTableNum || selectedTableNums.has(m.TABLE_NUM))

      const memberDetails = members.map((m) => {
        const cfg = TABLE_TYPES[m.TABLE_TYPE] || TABLE_TYPES[1]
        const x = m.X_POS
        const y = m.Y_POS
        const width = cfg.width
        const height = cfg.height
        const cx = halfCellMarginPx + (x + width / 2) * cellSize
        const cy = halfCellMarginPx + (y + height / 2) * cellSize
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

      const foreignTables = layoutTables.filter((n) => n.MERGE_GROUP_ID !== groupId)
      let overlapsForeign = false

      for (const foreign of foreignTables) {
        const fCfg = TABLE_TYPES[foreign.TABLE_TYPE] || TABLE_TYPES[1]
        const fx = foreign.X_POS
        const fy = foreign.Y_POS
        const fRight = fx + fCfg.width
        const fBottom = fy + fCfg.height

        const noOverlap = fRight <= minX || fx >= maxX || fBottom <= minY || fy >= maxY
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
          isSelected: isGroupSelected,
        })
      } else {
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

        const links = []
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

        const nodes = memberDetails.map((m) => ({
          cx: m.cx,
          cy: m.cy,
          tableNum: m.tableNum,
        }))

        visuals.push({
          type: 'chain',
          groupId,
          nodes,
          links,
          isSelected: isGroupSelected,
        })
      }
    }

    return visuals
  }, [layoutTables, selectedTableNum, selectedTableNums, cellSize])

  // ── Operational Handlers ──
  async function handleStatusChange(tableId: number, newStatus: TableStatus) {
    lastMutationTimeRef.current = Date.now()

    // Optimistic status update
    setLayoutTables((prev) =>
      prev.map((t) =>
        t.TABLE_ID === tableId || t.TABLE_NUM === selectedTable?.TABLE_NUM
          ? { ...t, STATUS: newStatus }
          : t,
      ),
    )

    try {
      await setTableStatus(tableId, newStatus)

      // Handle Advance Order transition if present
      if (advanceOrderForSelectedTable && advanceOrderForSelectedTable.status === 'PENDING') {
        if (newStatus === 'OCCUPIED') {
          if (keepAdvanceOrder) {
            // Keep advance order as regular order & disarm expiration
            await confirmAdvanceOrderToRegular(tableId, advanceOrderForSelectedTable.orderNumber)
            // If table has no seated pax entered yet, seat the advance order guest count
            if (
              advanceOrderForSelectedTable.guestCount &&
              (!selectedTable?.CURRENT_GUEST_COUNT || selectedTable.CURRENT_GUEST_COUNT === 0)
            ) {
              await updateSeatedPax(tableId, advanceOrderForSelectedTable.guestCount)
            }
            setAdvanceOrderForSelectedTable((prev) => (prev ? { ...prev, status: 'CONFIRMED' } : null))
            showToast(
              `Table ${selectedTable?.TABLE_NUM ?? tableId} occupied. Advance order kept as regular order.`,
              'success',
            )
          } else {
            // Discard advance order
            await discardAdvanceOrderForTable(tableId, 'Discarded by receptionist upon seating')
            setAdvanceOrderForSelectedTable(null)
            showToast(`Table ${selectedTable?.TABLE_NUM ?? tableId} occupied. Advance order was discarded.`, 'info')
          }
        } else if (newStatus === 'AVAILABLE') {
          await discardAdvanceOrderForTable(tableId, 'Table cleared to Available by receptionist')
          setAdvanceOrderForSelectedTable(null)
        }
      }

      void logTableAction('TABLE_STATUS_CHANGED', `Table ${selectedTable?.TABLE_NUM ?? tableId} status updated to ${newStatus}.`, {
        targetEntity: 'TABLE',
        targetId: String(tableId),
        newState: { status: newStatus },
      })
      if (!advanceOrderForSelectedTable || newStatus !== 'OCCUPIED') {
        showToast(`Table status set to ${newStatus.replace('_', ' ')}`, 'success')
      }
    } catch (err) {
      showToast((err as Error).message, 'error')
      void loadData(true)
    }
  }

  async function handleSeatWithAdvanceOrder(keepOrder: boolean) {
    if (!selectedTable || !advanceOrderForSelectedTable) return
    const tableId = selectedTable.TABLE_ID ?? selectedTable.TABLE_NUM
    const pax = advanceOrderForSelectedTable.guestCount || selectedCurrentPax || 1

    lastMutationTimeRef.current = Date.now()

    // Optimistic status update
    setLayoutTables((prev) =>
      prev.map((t) =>
        t.TABLE_ID === tableId || t.TABLE_NUM === selectedTable.TABLE_NUM
          ? { ...t, STATUS: 'OCCUPIED', CURRENT_GUEST_COUNT: pax }
          : t,
      ),
    )

    try {
      await updateSeatedPax(tableId, pax)
      await setTableStatus(tableId, 'OCCUPIED')

      if (keepOrder) {
        await confirmAdvanceOrderToRegular(tableId, advanceOrderForSelectedTable.orderNumber)
        setAdvanceOrderForSelectedTable((prev) => (prev ? { ...prev, status: 'CONFIRMED' } : null))
        showToast(
          `Table ${selectedTable.TABLE_NUM} seated with ${pax} guests. Advance order kept as regular order.`,
          'success',
        )
      } else {
        await discardAdvanceOrderForTable(tableId, 'Discarded by receptionist upon seating')
        setAdvanceOrderForSelectedTable(null)
        showToast(`Table ${selectedTable.TABLE_NUM} seated with ${pax} guests. Advance order discarded.`, 'info')
      }

      void logTableAction('TABLE_STATUS_CHANGED', `Table ${selectedTable.TABLE_NUM} seated via Advance Order.`, {
        targetEntity: 'TABLE',
        targetId: String(tableId),
        newState: { status: 'OCCUPIED', seatedPax: pax },
      })
    } catch (err) {
      showToast((err as Error).message, 'error')
      void loadData(true)
    }
  }

  // ── Drag & Drop Event Listeners ──
  const handleTableMouseDown = (table: MergedTableNode, e: React.MouseEvent) => {
    if (e.button !== 0) return
    // Ctrl/Cmd click is reserved for multi-selection toggle
    if (e.ctrlKey || e.metaKey) return

    e.preventDefault()
    e.stopPropagation()

    const newDrag: DragState = {
      tableNum: table.TABLE_NUM,
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

  // ── Adjacency Detection for Drag-and-Drop Merge ──
  const areTablesAdjacent = useCallback((t1: MergedTableNode, t2: MergedTableNode) => {
    const cfg1 = TABLE_TYPES[t1.TABLE_TYPE] || TABLE_TYPES[1]
    const cfg2 = TABLE_TYPES[t2.TABLE_TYPE] || TABLE_TYPES[1]

    for (let dx1 = 0; dx1 < cfg1.width; dx1++) {
      for (let dy1 = 0; dy1 < cfg1.height; dy1++) {
        for (let dx2 = 0; dx2 < cfg2.width; dx2++) {
          for (let dy2 = 0; dy2 < cfg2.height; dy2++) {
            const dist =
              Math.abs((t1.X_POS + dx1) - (t2.X_POS + dx2)) +
              Math.abs((t1.Y_POS + dy1) - (t2.Y_POS + dy2))
            if (dist === 1) return true
          }
        }
      }
    }
    return false
  }, [])

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (e.buttons === 0) {
        if (dragStateRef.current !== null) {
          void handleGlobalMouseUp()
        }
        return
      }

      const activeDrag = dragStateRef.current || dragState
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
    }

    const handleGlobalMouseUp = async () => {
      const activeDrag = dragStateRef.current || dragState
      dragStateRef.current = null
      setDragState(null)

      if (activeDrag) {
        const { tableNum, currentX, currentY, startTableX, startTableY } = activeDrag
        const hasMoved = currentX !== startTableX || currentY !== startTableY

        if (hasMoved) {
          lastMutationTimeRef.current = Date.now()

          // Build updated layout with new position
          const updatedLayout = layoutTables.map((t) =>
            t.TABLE_NUM === tableNum ? { ...t, X_POS: currentX, Y_POS: currentY } : t
          )
          setLayoutTables(updatedLayout)

          try {
            const movedTable = updatedLayout.find((t) => t.TABLE_NUM === tableNum)
            const resolvedTableId = movedTable?.TABLE_ID ?? tableNum
            await supabase
              .schema('tables')
              .from('Table_Info')
              .update({ X_POS: currentX, Y_POS: currentY })
              .eq('TABLE_ID', resolvedTableId)

            void logTableAction('LAYOUT_CHANGED', `Moved Table ${tableNum} to (${currentX}, ${currentY}) from Receptionist.`)

            // ── Auto-Merge on Drop: Check adjacency with other tables ──
            if (movedTable) {
              const adjacentTables = updatedLayout.filter(
                (t) => t.TABLE_NUM !== tableNum && areTablesAdjacent(movedTable, t)
              )

              if (adjacentTables.length > 0) {
                // Gather all tables to merge (moved table + all adjacent tables + their existing groups)
                const tablesToMerge = new Set<number>([tableNum])
                for (const adj of adjacentTables) {
                  tablesToMerge.add(adj.TABLE_NUM)
                  // Also include existing group members of adjacent tables
                  if (adj.MERGE_GROUP_ID != null) {
                    for (const t of updatedLayout) {
                      if (t.MERGE_GROUP_ID === adj.MERGE_GROUP_ID) {
                        tablesToMerge.add(t.TABLE_NUM)
                      }
                    }
                  }
                }
                // Also include existing group members of the moved table
                if (movedTable.MERGE_GROUP_ID != null) {
                  for (const t of updatedLayout) {
                    if (t.MERGE_GROUP_ID === movedTable.MERGE_GROUP_ID) {
                      tablesToMerge.add(t.TABLE_NUM)
                    }
                  }
                }

                const mergeList = updatedLayout
                  .filter((t) => tablesToMerge.has(t.TABLE_NUM))
                  .sort((a, b) => a.TABLE_NUM - b.TABLE_NUM)

                if (mergeList.length >= 2) {
                  const captainId = mergeList[0].TABLE_ID ?? mergeList[0].TABLE_NUM
                  const memberIds = mergeList.slice(1).map((t) => t.TABLE_ID ?? t.TABLE_NUM)

                  try {
                    await saveTableMerge(captainId, memberIds)
                    void logTableAction('TABLES_MERGED', `Drag-merge: Tables ${mergeList.map((t) => t.TABLE_NUM).join(', ')} merged from Receptionist.`, {
                      targetEntity: 'TABLE_GROUP',
                      targetId: String(captainId),
                      newState: { memberTableNums: mergeList.map((t) => t.TABLE_NUM) },
                    })
                    showToast(`Merged ${mergeList.length} tables into Group #${mergeList[0].TABLE_NUM}`, 'success')
                    await loadData(true)
                  } catch (mergeErr) {
                    console.warn('Auto-merge after drag failed:', mergeErr)
                    showToast(`Moved Table ${tableNum}`, 'info')
                  }
                } else {
                  showToast(`Moved Table ${tableNum}`, 'info')
                }
              } else {
                showToast(`Moved Table ${tableNum}`, 'info')
              }
            }
          } catch (err) {
            console.error('Failed to save table move from receptionist:', err)
            showToast('Failed to save table position', 'error')
          }
        }
      }
    }

    window.addEventListener('mousemove', handleGlobalMouseMove)
    window.addEventListener('mouseup', handleGlobalMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove)
      window.removeEventListener('mouseup', handleGlobalMouseUp)
    }
  }, [dragState, cellSize, gridWidth, gridHeight, layoutTables, areTablesAdjacent, loadData])

  async function handleSeatedPaxChange(tableId: number, pax: number) {
    lastMutationTimeRef.current = Date.now()

    const targetTable = layoutTables.find((t) => t.TABLE_ID === tableId || t.TABLE_NUM === selectedTable?.TABLE_NUM)
    const targetMergeGroupId = targetTable?.MERGE_GROUP_ID

    // Optimistic guest count update for target table and any merged group members
    setLayoutTables((prev) =>
      prev.map((t) => {
        const isTarget = t.TABLE_ID === tableId || t.TABLE_NUM === selectedTable?.TABLE_NUM
        const isMergedWithTarget = targetMergeGroupId != null && t.MERGE_GROUP_ID === targetMergeGroupId
        let nextStatus = t.STATUS
        if (pax > 0 && (t.STATUS === 'AVAILABLE' || t.STATUS === 'RESERVED')) {
          nextStatus = 'OCCUPIED'
        } else if (pax === 0 && t.STATUS !== 'AVAILABLE') {
          nextStatus = 'AVAILABLE'
        }
        return isTarget || isMergedWithTarget
          ? {
              ...t,
              CURRENT_GUEST_COUNT: pax,
              STATUS: nextStatus,
            }
          : t
      }),
    )

    try {
      await updateSeatedPax(tableId, pax)
      void logTableAction('CAPACITY_CHANGED', `Table ${selectedTable?.TABLE_NUM ?? tableId} seated pax changed to ${pax}.`, {
        targetEntity: 'TABLE',
        targetId: String(tableId),
        newState: { seatedPax: pax },
      })
      if (pax > 0 && (selectedTable?.STATUS === 'AVAILABLE' || selectedTable?.STATUS === 'RESERVED')) {
        await setTableStatus(tableId, 'OCCUPIED')
      } else if (pax === 0 && selectedTable?.STATUS !== 'AVAILABLE') {
        await setTableStatus(tableId, 'AVAILABLE')
      }
    } catch (err) {
      showToast((err as Error).message, 'error')
      void loadData(true)
    }
  }

  async function handleClearTable(tableId: number) {
    lastMutationTimeRef.current = Date.now()

    const targetTable = layoutTables.find((t) => t.TABLE_ID === tableId || t.TABLE_NUM === selectedTable?.TABLE_NUM)
    const targetMergeGroupId = targetTable?.MERGE_GROUP_ID

    // Optimistic table clear for target table and any merged group members
    setLayoutTables((prev) =>
      prev.map((t) => {
        const isTarget = t.TABLE_ID === tableId || t.TABLE_NUM === selectedTable?.TABLE_NUM
        const isMergedWithTarget = targetMergeGroupId != null && t.MERGE_GROUP_ID === targetMergeGroupId
        return isTarget || isMergedWithTarget
          ? { ...t, CURRENT_GUEST_COUNT: 0, STATUS: 'AVAILABLE' }
          : t
      }),
    )

    try {
      await updateSeatedPax(tableId, 0)
      await setTableStatus(tableId, 'AVAILABLE')
      if (advanceOrderForSelectedTable) {
        await discardAdvanceOrderForTable(tableId, 'Table cleared by receptionist')
        setAdvanceOrderForSelectedTable(null)
      }
      void logTableAction('TABLE_STATUS_CHANGED', `Table ${selectedTable?.TABLE_NUM ?? tableId} cleared and marked Available.`, {
        targetEntity: 'TABLE',
        targetId: String(tableId),
        newState: { status: 'AVAILABLE', seatedPax: 0 },
      })
      showToast(`Table ${selectedTable?.TABLE_NUM ?? tableId} cleared`, 'success')
    } catch (err) {
      showToast((err as Error).message, 'error')
      void loadData(true)
    }
  }

  async function handleLabelChange(tableId: number, labelId: number | null) {
    lastMutationTimeRef.current = Date.now()

    // Find if target table belongs to a merge group so we update all merged tables optimistically
    const targetTable = layoutTables.find((t) => t.TABLE_ID === tableId || t.TABLE_NUM === selectedTable?.TABLE_NUM)
    const targetMergeGroupId = targetTable?.MERGE_GROUP_ID

    // Optimistic label update for target table and any merged group members
    setLayoutTables((prev) =>
      prev.map((t) => {
        const isTarget = t.TABLE_ID === tableId || t.TABLE_NUM === selectedTable?.TABLE_NUM
        const isMergedWithTarget = targetMergeGroupId != null && t.MERGE_GROUP_ID === targetMergeGroupId
        return isTarget || isMergedWithTarget
          ? { ...t, LABEL_ID: labelId }
          : t
      }),
    )

    try {
      await assignLabelToTable(tableId, labelId)
      const assignedLabel = labelId ? labelMap.get(labelId)?.NAME : 'None'
      void logTableAction(
        'LABEL_ASSIGNED',
        labelId
          ? `Assigned VIP/Label "${assignedLabel}" to Table ${selectedTable?.TABLE_NUM ?? tableId}.`
          : `Removed VIP/Label from Table ${selectedTable?.TABLE_NUM ?? tableId}.`,
        {
          targetEntity: 'TABLE',
          targetId: String(tableId),
          newState: { labelId },
        },
      )
      showToast(labelId ? `Assigned "${assignedLabel}" tier` : 'VIP label removed', 'success')
    } catch (err) {
      showToast((err as Error).message, 'error')
      void loadData(true)
    }
  }

  async function handleUnmerge(tableId: number) {
    try {
      await unmergeTables(tableId)
      void logTableAction('TABLES_UNMERGED', `Unmerged table ${selectedTable?.TABLE_NUM ?? tableId}.`, {
        targetEntity: 'TABLE_GROUP',
        targetId: String(tableId),
      })
      showToast(`Table ${selectedTable?.TABLE_NUM ?? tableId} unmerged`, 'success')
      await loadData(true)
    } catch (err) {
      showToast((err as Error).message, 'error')
    }
  }

  // ── Sync Active Reservation Fields on Table Select ──
  useEffect(() => {
    if (selectedTable) {
      const activeRes = reservations[selectedTable.TABLE_NUM]
      if (activeRes) {
        setResCustomerName(activeRes.customerName)
        setResPhone(activeRes.phoneNumber)
        setResPartySize(activeRes.partySize)
        setResTime(activeRes.reservationTime)
        setResNotes(activeRes.notes || '')
      } else {
        setResCustomerName('')
        setResPhone('')
        setResPartySize(Math.min(2, selectedEffectiveCapacity))
        const d = new Date(Date.now() + 30 * 60000)
        const hh = String(d.getHours()).padStart(2, '0')
        const mm = String(d.getMinutes()).padStart(2, '0')
        setResTime(`${hh}:${mm}`)
        setResNotes('')
      }
    }
  }, [selectedTableNum, selectedEffectiveCapacity, reservations])

  // ── Reservation Action Handlers ──
  async function handleRegisterReservation(e?: React.FormEvent) {
    if (e) e.preventDefault()
    if (!selectedTable) return
    if (!resCustomerName.trim()) {
      showToast('Please enter customer name for reservation.', 'error')
      return
    }

    const tableId = selectedTable.TABLE_ID ?? selectedTable.TABLE_NUM
    const now = new Date().toISOString()
    const newRes: TableReservation = {
      tableNum: selectedTable.TABLE_NUM,
      customerName: resCustomerName.trim(),
      phoneNumber: resPhone.trim(),
      partySize: Math.max(1, Math.min(selectedEffectiveCapacity, resPartySize || 1)),
      reservationTime: resTime || 'Later today',
      notes: resNotes.trim(),
      createdAt: now,
    }

    const updated = { ...reservations, [selectedTable.TABLE_NUM]: newRes }
    setReservations(updated)
    try {
      localStorage.setItem('monolith_table_reservations', JSON.stringify(updated))
    } catch {
      // quota
    }

    try {
      await reserveTable(tableId, {
        name: resCustomerName.trim(),
        pax: newRes.partySize,
        timeLimit: resTime || 'Later today',
        notes: resNotes.trim(),
      })
      showToast(`Reservation registered for Table ${selectedTable.TABLE_NUM}!`, 'success')
      await loadData(true)
    } catch (err) {
      showToast((err as Error).message || 'Failed to save reservation', 'error')
    }
  }

  async function handleCancelReservation(tableNum: number) {
    if (!selectedTable) return
    const tableId = selectedTable.TABLE_ID ?? selectedTable.TABLE_NUM
    const updated = { ...reservations }
    delete updated[tableNum]
    setReservations(updated)
    try {
      localStorage.setItem('monolith_table_reservations', JSON.stringify(updated))
    } catch {
      // quota
    }

    try {
      await cancelReservation(tableId)
      showToast(`Reservation cancelled for Table ${tableNum}.`, 'info')
      await loadData(true)
    } catch (err) {
      showToast((err as Error).message || 'Failed to cancel reservation', 'error')
    }
  }

  async function handleSeatReservation(tableNum: number) {
    if (!selectedTable) return
    const tableId = selectedTable.TABLE_ID ?? selectedTable.TABLE_NUM
    const res = reservations[tableNum]
    const pax = res?.partySize || selectedCurrentPax || 1

    const updated = { ...reservations }
    delete updated[tableNum]
    setReservations(updated)
    try {
      localStorage.setItem('monolith_table_reservations', JSON.stringify(updated))
    } catch {
      // quota
    }

    try {
      await cancelReservation(tableId)
      await handleStatusChange(tableId, 'OCCUPIED')
      await handleSeatedPaxChange(tableId, pax)
      setSidebarTab('table')
      showToast(`Table ${tableNum} seated with ${pax} guests!`, 'success')
      await loadData(true)
    } catch (err) {
      showToast((err as Error).message || 'Failed to seat reservation', 'error')
    }
  }

  // ── Footer Toggle Handlers (Table Tab) ──
  async function handleOccupiedToggle() {
    if (!selectedTable) return
    const tableId = selectedTable.TABLE_ID ?? selectedTable.TABLE_NUM
    if (selectedTable.STATUS === 'OCCUPIED') {
      await handleClearTable(tableId)
    } else {
      await handleStatusChange(tableId, 'OCCUPIED')
      if (selectedCurrentPax === 0) {
        await handleSeatedPaxChange(tableId, 1)
      }
    }
  }

  async function handleUnavailableToggle() {
    if (!selectedTable) return
    const tableId = selectedTable.TABLE_ID ?? selectedTable.TABLE_NUM
    if (selectedTable.STATUS === 'UNAVAILABLE') {
      await handleStatusChange(tableId, 'AVAILABLE')
    } else {
      if (selectedTable.STATUS === 'OCCUPIED') {
        showToast('Cannot mark table as Unavailable while it is Occupied.', 'error')
        return
      }
      await handleStatusChange(tableId, 'UNAVAILABLE')
    }
  }

  function handleTableClick(node: MergedTableNode, e?: React.MouseEvent) {
    if (e && (e.ctrlKey || e.metaKey)) {
      // Multi-selection via Ctrl/Cmd+Click
      setSelectedTableNums((prev) => {
        const next = new Set(prev)
        // If there was a single active selected table not in the set, retain it
        if (selectedTableNum != null && !next.has(selectedTableNum)) {
          next.add(selectedTableNum)
        }

        if (next.has(node.TABLE_NUM)) {
          next.delete(node.TABLE_NUM)
          if (selectedTableNum === node.TABLE_NUM) {
            const remaining = Array.from(next)
            setSelectedTableNum(remaining.length > 0 ? remaining[remaining.length - 1] : null)
          }
        } else {
          next.add(node.TABLE_NUM)
          setSelectedTableNum(node.TABLE_NUM)
        }
        return next
      })
    } else {
      // Single click: select this table, deselect everything else
      setSelectedTableNum((prev) => (prev === node.TABLE_NUM ? null : node.TABLE_NUM))
      setSelectedTableNums(node.TABLE_NUM === selectedTableNum ? new Set() : new Set([node.TABLE_NUM]))
    }
  }

  // ── Merge Multi-Selected Tables ──
  function handleMergeSelectedTables() {
    if (selectedTableNums.size < 2) return
    setMergePersistencyChoice('TEMPORARY')
    setMergeModalOpen(true)
  }

  async function handleConfirmMerge() {
    if (selectedTableNums.size < 2) return
    lastMutationTimeRef.current = Date.now()

    // Map selected table numbers to TABLE_IDs
    const selectedTables = layoutTables.filter((t) => selectedTableNums.has(t.TABLE_NUM))
    if (selectedTables.length < 2) {
      showToast('Select at least 2 tables to merge', 'error')
      setMergeModalOpen(false)
      return
    }

    // Determine captain (lowest TABLE_NUM)
    const sorted = [...selectedTables].sort((a, b) => a.TABLE_NUM - b.TABLE_NUM)
    const captainId = sorted[0].TABLE_ID ?? sorted[0].TABLE_NUM
    const memberIds = sorted.slice(1).map((t) => t.TABLE_ID ?? t.TABLE_NUM)

    try {
      await saveTableMerge(captainId, memberIds, mergePersistencyChoice)
      void logTableAction('TABLES_MERGED', `Merged tables ${Array.from(selectedTableNums).sort().join(', ')} (${mergePersistencyChoice}) from Receptionist.`, {
        targetEntity: 'TABLE_GROUP',
        targetId: String(captainId),
        newState: { memberTableNums: Array.from(selectedTableNums), persistency: mergePersistencyChoice },
      })
      showToast(`Merged ${selectedTableNums.size} tables into Group #${sorted[0].TABLE_NUM} (${mergePersistencyChoice.toLowerCase()})`, 'success')
      setSelectedTableNums(new Set())
      setSelectedTableNum(null)
      setMergeModalOpen(false)
      await loadData(true)
    } catch (err) {
      showToast((err as Error).message || 'Failed to merge tables', 'error')
    }
  }

  const selectedLabel = selectedTable?.LABEL_ID ? labelMap.get(selectedTable.LABEL_ID) : null

  const occupiedDuration = useMemo(() => {
    if (!selectedTable?.OCCUPIED_SINCE) return null
    const startTime = new Date(selectedTable.OCCUPIED_SINCE).getTime()
    if (isNaN(startTime)) return null
    const diffMinutes = Math.max(0, Math.floor((Date.now() - startTime) / 60000))
    if (diffMinutes < 60) return `${diffMinutes}m`
    const hours = Math.floor(diffMinutes / 60)
    const mins = diffMinutes % 60
    return `${hours}h ${mins}m`
  }, [selectedTable?.OCCUPIED_SINCE])

  return (
    <div className="receptionist-interface-page staff-page select-none">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-4 py-2 rounded-xl text-xs font-bold shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-150 ${
            toastMessage.type === 'error'
              ? 'bg-[#EF4444] text-white'
              : toastMessage.type === 'info'
                ? 'bg-[#14274E] text-[#E9C46A]'
                : 'bg-emerald-600 text-white'
          }`}
        >
          {toastMessage.type === 'error' ? <AlertCircle className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* ── Main Workspace Body: Two Side-by-Side Containers with gaps on all sides ── */}
      <div className="receptionist-interface-layout">
        {/* ── Left Div: inner-receptionist-container ── */}
        <div className="inner-receptionist-container">
          {/* Receptionist Active Shift & End Shift Header (Moved above original container) */}
          <ReceptionistShiftHeaderBar />

          {/* Top: Status Filter Bar Card */}
          <div className="receptionist-top-header flex items-center justify-between gap-3 flex-wrap bg-white px-4 py-2.5 rounded-2xl border border-slate-200/90 shadow-2xs shrink-0">
            {/* Status Filter Pills (Legend on left) */}
            <div className="flex items-center gap-1 bg-slate-100/80 p-0.5 rounded-xl border border-slate-200/80 overflow-x-auto max-w-full">
              {(
                [
                  { key: 'ALL', label: 'All', color: '#14274E', count: layoutTables.length },
                  { key: 'AVAILABLE', label: 'Available', color: '#10B981', count: statusCounts.AVAILABLE },
                  { key: 'OCCUPIED', label: 'Occupied', color: '#3B82F6', count: statusCounts.OCCUPIED },
                  { key: 'RESERVED', label: 'Reserved', color: '#F59E0B', count: statusCounts.RESERVED },
                  { key: 'HAS_REQUEST', label: 'Bill Out', color: '#EF4444', count: statusCounts.HAS_REQUEST },
                  { key: 'UNAVAILABLE', label: 'Unavailable', color: '#64748B', count: statusCounts.UNAVAILABLE },
                ] as const
              ).map((item) => {
                const isSelected = statusFilter === item.key
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setStatusFilter(item.key)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                      isSelected
                        ? 'bg-white text-[#14274E] shadow-xs ring-1 ring-slate-200'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                    }`}
                  >
                    {item.key !== 'ALL' && (
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                    )}
                    <span>{item.label}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                        isSelected ? 'bg-slate-100 text-[#14274E]' : 'bg-slate-200/80 text-slate-600'
                      }`}
                    >
                      {item.count}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Occupancy Counter on right */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100/90 border border-slate-200 text-xs font-semibold text-slate-700">
              <Users className="w-3.5 h-3.5 text-slate-500" />
              <span>
                Occupancy: <strong className="text-[#14274E]">{totalSeatedPax}</strong> / {totalVenueCapacity} Pax
              </span>
              <span className="text-[10px] text-slate-500 ml-0.5">
                ({totalVenueCapacity > 0 ? Math.round((totalSeatedPax / totalVenueCapacity) * 100) : 0}%)
              </span>
            </div>
          </div>

        {/* Floor Plan Workspace Wrapper (Centers tight card) */}
        <div
          ref={containerRef}
          className="layout-workspace-wrapper flex-1 min-h-0 w-full h-full flex items-center justify-center p-2 sm:p-3 overflow-hidden relative select-none"
        >
          {/* Tight Card Container (Fits grid exactly) */}
          <div
            onClick={(e) => {
              // Click background deselects table
              const target = e.target as HTMLElement
              if (!target.closest('.table-node-item')) {
                if (!e.ctrlKey && !e.metaKey) {
                  setSelectedTableNum(null)
                  setSelectedTableNums(new Set())
                }
              }
            }}
            className="layout-container relative bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden select-none cursor-default shrink-0"
            style={{
              width: `${totalFloorWidthPx}px`,
              height: `${totalFloorHeightPx}px`,
            }}
          >
            {/* Floating Merge Tables Button (When >= 2 tables are multi-selected) */}
            {selectedTableNums.size >= 2 && (
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

            {/* Floor Canvas (17x12 blocks: 16x11 playable with half-cell extension on all 4 sides) */}
            <div className="w-full h-full relative select-none bg-white">
              {/* Dynamic Merge Group Indicators (Only shown when a table under that merge group is selected) */}
              {mergeGroupVisuals
                .filter((visual) => visual.isSelected)
                .map((visual) => {
                if (visual.type === 'box') {
                  const padding = Math.max(6, Math.round(cellSize * 0.12))
                  const left = halfCellMarginPx + visual.minX * cellSize - padding
                  const top = halfCellMarginPx + visual.minY * cellSize - padding
                  const width = (visual.maxX - visual.minX) * cellSize + padding * 2
                  const height = (visual.maxY - visual.minY) * cellSize + padding * 2

                  return (
                    <div
                      key={`merge-group-box-${visual.groupId}`}
                      className={`absolute pointer-events-none rounded-2xl border-2 border-dashed transition-all duration-150 z-10 ${
                        visual.isSelected
                          ? 'border-indigo-600 bg-indigo-500/10 shadow-md ring-2 ring-indigo-300'
                          : 'border-indigo-400/80 bg-indigo-500/5 shadow-xs'
                      }`}
                      style={{
                        left: `${left}px`,
                        top: `${top}px`,
                        width: `${width}px`,
                        height: `${height}px`,
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
                          <line
                            x1={link.x1}
                            y1={link.y1}
                            x2={link.x2}
                            y2={link.y2}
                            stroke="#818CF8"
                            strokeWidth={visual.isSelected ? 8 : 5}
                            strokeOpacity={visual.isSelected ? 0.5 : 0.3}
                            strokeDasharray="10 6"
                            strokeLinecap="round"
                          />
                          <line
                            x1={link.x1}
                            y1={link.y1}
                            x2={link.x2}
                            y2={link.y2}
                            stroke="#4F46E5"
                            strokeWidth={visual.isSelected ? 3.5 : 2.5}
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
                            r={visual.isSelected ? 7 : 5.5}
                            fill="#4F46E5"
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

              {/* Render Table Nodes with TableVisual */}
              {effectiveLayoutTables.map((node) => {
                const isSelected = selectedTableNum === node.TABLE_NUM || selectedTableNums.has(node.TABLE_NUM)
                const suppress = chairSuppressionMap.get(node.TABLE_NUM)
                const label = node.LABEL_ID ? labelMap.get(node.LABEL_ID) : undefined

                // Dim tables that don't match the current status filter (preserving floor layout spatial context)
                const matchesFilter = statusFilter === 'ALL' || node.STATUS === statusFilter

                // Compute combined pax and capacity if merged
                const isMerged = node.MERGE_GROUP_ID != null
                const groupMembers = isMerged
                  ? effectiveLayoutTables.filter((t) => t.MERGE_GROUP_ID === node.MERGE_GROUP_ID)
                  : [node]
                const displayCapacity = isMerged
                  ? groupMembers.reduce((sum, m) => sum + (m.GUEST_CAPACITY ?? 4), 0)
                  : (node.GUEST_CAPACITY ?? 4)
                const displayPax = isMerged
                  ? Math.max(...groupMembers.map((m) => m.CURRENT_GUEST_COUNT ?? 0), 0)
                  : (node.CURRENT_GUEST_COUNT ?? 0)

                return (
                  <div
                    key={node.TABLE_NUM}
                    draggable={false}
                    onMouseDown={(e) => handleTableMouseDown(node, e)}
                    onClick={(e) => handleTableClick(node, e)}
                    className={`table-node-item absolute select-none cursor-grab active:cursor-grabbing ${
                      dragState?.tableNum === node.TABLE_NUM
                        ? 'transition-none z-50 scale-105 opacity-90'
                        : 'transition-all'
                    } ${
                      isSelected || selectedTableNums.has(node.TABLE_NUM)
                        ? 'z-40 scale-105 filter drop-shadow-md'
                        : matchesFilter
                          ? 'z-20 hover:scale-103'
                          : 'z-10 opacity-30 hover:opacity-80'
                    }`}
                    style={{
                      left: `${halfCellMarginPx + node.X_POS * cellSize}px`,
                      top: `${halfCellMarginPx + node.Y_POS * cellSize}px`,
                    }}
                  >
                    <TableVisual
                      tableType={node.TABLE_TYPE}
                      tableNum={node.TABLE_NUM}
                      cellSize={cellSize}
                      status={node.STATUS}
                      guestCount={displayPax}
                      capacity={displayCapacity}
                      labelName={label?.NAME}
                      labelColor={label?.COLOR}
                      isMerged={isMerged}
                      mergeGroupId={node.MERGE_GROUP_ID}
                      isSelected={isSelected}
                      hideChairs={suppress}
                    />
                  </div>
                )
              })}
            </div>

            {/* Loading Indicator */}
            {isLoading && (
              <div className="absolute inset-0 bg-white/70 backdrop-blur-xs flex items-center justify-center z-50">
                <div className="flex items-center gap-2 text-xs font-black text-[#14274E]">
                  <div className="w-4 h-4 rounded-full border-2 border-[#14274E] border-t-transparent animate-spin" />
                  <span>Syncing floor plan...</span>
                </div>
              </div>
            )}

            {/* Empty State */}
            {!isLoading && layoutTables.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center pointer-events-none">
                <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-center justify-center mb-3 shadow-xs">
                  <TableShapeIcon tableType={1} size={32} />
                </div>
                <h3 className="text-sm font-extrabold text-[#14274E]">Floor Plan is Empty</h3>
                <p className="text-xs text-slate-400 font-medium max-w-xs mt-1">
                  No tables found in this preset. Configure floor plans in the Layout Manager.
                </p>
              </div>
            )}
          </div>
          </div>
        </div>

        {/* ── Right Div: receptionist-sidebar (Docked with gap and rounded corners) ── */}
        <aside className="receptionist-sidebar">
          <div className="h-full overflow-y-auto flex flex-col">
            {selectedTable ? (
              <div className="p-4 flex flex-col gap-3.5 flex-1 min-h-0">
                {/* Header: Table Title & Active Label (No number icon, No description below title) */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2 min-w-0">
                    <h2 className="text-lg font-black text-[#14274E] leading-tight">
                      Table {selectedTable.TABLE_NUM}
                    </h2>
                    {selectedLabel && (
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase text-white shadow-2xs truncate max-w-[120px]"
                        style={{ backgroundColor: selectedLabel.COLOR }}
                      >
                        {selectedLabel.NAME}
                      </span>
                    )}
                  </div>

                  {/* Close Inspector */}
                  <button
                    type="button"
                    onClick={() => setSelectedTableNum(null)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer shrink-0"
                    title="Close inspector"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* 3 Tabs: Table | Reservation | Advanced Orders */}
                <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100/90 rounded-xl border border-slate-200/80">
                  <button
                    type="button"
                    onClick={() => setSidebarTab('table')}
                    className={`py-1.5 px-2 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      sidebarTab === 'table'
                        ? 'bg-white text-[#14274E] shadow-xs'
                        : 'text-slate-600 hover:text-[#14274E] hover:bg-white/50'
                    }`}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span>Table</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSidebarTab('reservation')}
                    className={`py-1.5 px-2 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer relative ${
                      sidebarTab === 'reservation'
                        ? 'bg-white text-[#14274E] shadow-xs'
                        : 'text-slate-600 hover:text-[#14274E] hover:bg-white/50'
                    }`}
                  >
                    <CalendarClock className="w-3.5 h-3.5" />
                    <span>Reservation</span>
                    {selectedTable.STATUS === 'RESERVED' && (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 absolute top-1.5 right-1.5 animate-pulse" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setSidebarTab('advanced_orders')}
                    className={`py-1.5 px-2 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer relative ${
                      sidebarTab === 'advanced_orders'
                        ? 'bg-white text-[#14274E] shadow-xs'
                        : 'text-slate-600 hover:text-[#14274E] hover:bg-white/50'
                    }`}
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span className="truncate">Adv. Orders</span>
                    {advanceOrderForSelectedTable && (
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 absolute top-1.5 right-1.5 animate-pulse" />
                    )}
                  </button>
                </div>

                {/* ── TAB 1: TABLE CONFIGURATIONS ── */}
                {sidebarTab === 'table' && (
                  <div className="flex flex-col gap-3.5 flex-1">
                    {/* 1. Table Label Config (Moved to TOP of configs, not inside a container) */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-[#14274E] tracking-tight">Table Label</span>
                        <button
                          type="button"
                          onClick={() => setLabelsModalOpen(true)}
                          className="flex items-center gap-1 text-[11px] font-bold text-[#14274E] hover:text-[#1e3a6d] cursor-pointer"
                        >
                          <Tag className="w-3 h-3" />
                          <span>Manage</span>
                        </button>
                      </div>
                      <LabelSelector
                        tableId={selectedTable.TABLE_ID ?? selectedTable.TABLE_NUM}
                        currentLabelId={selectedTable.LABEL_ID ?? null}
                        labels={labels}
                        onLabelChanged={(labelId) =>
                          handleLabelChange(selectedTable.TABLE_ID ?? selectedTable.TABLE_NUM, labelId)
                        }
                      />
                    </div>

                    {/* 2. Table Status Config Container (Status badge next to title removed, 4 grid buttons removed) */}
                    <div className="p-3 rounded-2xl bg-slate-50/90 border border-slate-200/80 shadow-2xs">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-black text-[#14274E] tracking-tight">Table Status</span>
                      </div>

                      <div
                        className={`p-2.5 rounded-xl border flex items-center gap-3 transition-colors ${
                          selectedTable.STATUS === 'AVAILABLE'
                            ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                            : selectedTable.STATUS === 'OCCUPIED'
                            ? 'bg-blue-50/70 border-blue-200 text-blue-900'
                            : selectedTable.STATUS === 'RESERVED'
                            ? 'bg-amber-50/70 border-amber-200 text-amber-900'
                            : selectedTable.STATUS === 'HAS_REQUEST'
                            ? 'bg-rose-50/70 border-rose-200 text-rose-900'
                            : 'bg-slate-100 border-slate-300 text-slate-800'
                        }`}
                      >
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-2xs ${
                            selectedTable.STATUS === 'AVAILABLE'
                              ? 'bg-emerald-500 text-white'
                              : selectedTable.STATUS === 'OCCUPIED'
                              ? 'bg-blue-500 text-white'
                              : selectedTable.STATUS === 'RESERVED'
                              ? 'bg-amber-500 text-white'
                              : selectedTable.STATUS === 'HAS_REQUEST'
                              ? 'bg-rose-500 text-white'
                              : 'bg-slate-500 text-white'
                          }`}
                        >
                          {selectedTable.STATUS === 'AVAILABLE' && <CheckCircle2 className="w-4 h-4" />}
                          {selectedTable.STATUS === 'OCCUPIED' && <Users className="w-4 h-4" />}
                          {selectedTable.STATUS === 'RESERVED' && <Clock className="w-4 h-4" />}
                          {selectedTable.STATUS === 'HAS_REQUEST' && <Receipt className="w-4 h-4" />}
                          {selectedTable.STATUS === 'UNAVAILABLE' && <Ban className="w-4 h-4" />}
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-black block leading-tight">
                            {selectedTable.STATUS?.replace('_', ' ') ?? 'AVAILABLE'}
                          </span>
                          <span className="text-[11px] text-slate-500 font-medium block truncate">
                            {selectedTable.STATUS === 'AVAILABLE'
                              ? 'Available for seating'
                              : selectedTable.STATUS === 'OCCUPIED'
                              ? `${selectedCurrentPax} / ${selectedEffectiveCapacity} seated${occupiedDuration ? ` · Occupied for ${occupiedDuration}` : ''}`
                              : selectedTable.STATUS === 'RESERVED'
                              ? 'Reserved for customer'
                              : selectedTable.STATUS === 'HAS_REQUEST'
                              ? 'Bill out requested'
                              : 'Out of service'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 3. Seated Guests Config (No 'Guests' below number, no 'P' on quick buttons, 'Empty' button added) */}
                    <div className="p-3 rounded-2xl bg-slate-50/90 border border-slate-200/80 shadow-2xs">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-black text-[#14274E] tracking-tight">Seated Guests</span>
                        <span className="text-[11px] font-semibold text-slate-500">
                          Capacity: {selectedEffectiveCapacity} Pax
                        </span>
                      </div>

                      <div className="flex items-center justify-between bg-white rounded-xl p-2 border border-slate-200">
                        <button
                          type="button"
                          onClick={() =>
                            handleSeatedPaxChange(
                              selectedTable.TABLE_ID ?? selectedTable.TABLE_NUM,
                              Math.max(0, selectedCurrentPax - 1),
                            )
                          }
                          className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-black cursor-pointer transition-colors active:scale-95"
                          title="Decrease seated guests"
                        >
                          <Minus className="w-3.5 h-3.5 stroke-[3]" />
                        </button>

                        <div className="flex flex-col items-center">
                          <span className="text-2xl font-black text-[#14274E] leading-none">
                            {selectedCurrentPax}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            handleSeatedPaxChange(
                              selectedTable.TABLE_ID ?? selectedTable.TABLE_NUM,
                              Math.min(
                                selectedEffectiveCapacity,
                                selectedCurrentPax + 1,
                              ),
                            )
                          }
                          className="w-9 h-9 rounded-xl bg-[#14274E] hover:bg-[#1e3a6d] text-[#E9C46A] flex items-center justify-center font-black cursor-pointer transition-colors active:scale-95"
                          title="Increase seated guests"
                        >
                          <Plus className="w-3.5 h-3.5 stroke-[3]" />
                        </button>
                      </div>

                      {/* Quick Pax Shortcuts: Empty, numeric buttons without P, Full */}
                      <div className="flex items-center gap-1.5 mt-2">
                        <button
                          type="button"
                          onClick={() =>
                            handleSeatedPaxChange(selectedTable.TABLE_ID ?? selectedTable.TABLE_NUM, 0)
                          }
                          className={`flex-1 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                            selectedCurrentPax === 0
                              ? 'bg-[#14274E] text-[#E9C46A] border-[#14274E]'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          Empty
                        </button>
                        {quickPaxOptions.map((pax) => (
                          <button
                            key={pax}
                            type="button"
                            onClick={() =>
                              handleSeatedPaxChange(selectedTable.TABLE_ID ?? selectedTable.TABLE_NUM, pax)
                            }
                            className={`flex-1 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                              selectedCurrentPax === pax
                                ? 'bg-[#14274E] text-[#E9C46A] border-[#14274E]'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {pax}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() =>
                            handleSeatedPaxChange(
                              selectedTable.TABLE_ID ?? selectedTable.TABLE_NUM,
                              selectedEffectiveCapacity,
                            )
                          }
                          className={`flex-1 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                            selectedCurrentPax === selectedEffectiveCapacity && selectedEffectiveCapacity > 0
                              ? 'bg-[#14274E] text-[#E9C46A] border-[#14274E]'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          Full
                        </button>
                      </div>
                    </div>

                    {/* Merged Group Banner (if merged) */}
                    {selectedGroup?.isMerged && (
                      <div className="p-3 rounded-2xl bg-indigo-50/90 border border-indigo-200 flex flex-col gap-2.5 text-xs shadow-2xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-indigo-950 font-bold truncate">
                            <GitMerge className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                            <span className="truncate">Merged Group #{selectedGroup.anchorTableId}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleUnmerge(selectedGroup.anchorTableId)}
                            className="px-2 py-0.5 rounded-lg bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors shrink-0"
                          >
                            <Unlink className="w-3 h-3" />
                            <span>Unmerge</span>
                          </button>
                        </div>

                        {/* Persistency indicator & switcher */}
                        <div className="flex items-center justify-between bg-white rounded-xl p-2 border border-indigo-100">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] text-slate-500 font-medium">Persistency:</span>
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                              selectedTable.MERGE_PERSISTENCY === 'CONTINOUOUS'
                                ? 'bg-purple-100 text-purple-700 border border-purple-200'
                                : 'bg-blue-100 text-blue-700 border border-blue-200'
                            }`}>
                              {selectedTable.MERGE_PERSISTENCY === 'CONTINOUOUS' ? 'Continuous' : 'Temporary'}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={async () => {
                              const newPersistency = selectedTable.MERGE_PERSISTENCY === 'CONTINOUOUS' ? 'TEMPORARY' : 'CONTINOUOUS'
                              const targetId = selectedTable.TABLE_ID ?? selectedTable.TABLE_NUM
                              await setTableMergePersistency(targetId, newPersistency)
                              showToast(`Merge set to ${newPersistency.toLowerCase()}`, 'success')
                              void loadData(true)
                            }}
                            className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
                          >
                            Switch to {selectedTable.MERGE_PERSISTENCY === 'CONTINOUOUS' ? 'Temporary' : 'Continuous'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* 4. Footer Buttons: Mark as Occupied/Available & Mark as Unavailable */}
                    <div className="pt-3 border-t border-slate-200 flex flex-col gap-2 mt-auto">
                      {/* Button A: Mark as Occupied (Shows Mark as Available if occupied) */}
                      <button
                        type="button"
                        disabled={selectedTable.STATUS === 'UNAVAILABLE'}
                        onClick={handleOccupiedToggle}
                        className={`w-full py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 text-xs font-black transition-all shadow-xs ${
                          selectedTable.STATUS === 'UNAVAILABLE'
                            ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60'
                            : selectedTable.STATUS === 'OCCUPIED'
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer active:scale-98'
                            : 'bg-[#14274E] hover:bg-[#1e3a6d] text-[#E9C46A] cursor-pointer active:scale-98'
                        }`}
                      >
                        {selectedTable.STATUS === 'OCCUPIED' ? (
                          <>
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Mark as Available</span>
                          </>
                        ) : (
                          <>
                            <Users className="w-4 h-4" />
                            <span>Mark as Occupied</span>
                          </>
                        )}
                      </button>

                      {/* Button B: Mark as Unavailable (Disables Mark as Occupied/Available, disabled if Occupied) */}
                      <button
                        type="button"
                        disabled={selectedTable.STATUS === 'OCCUPIED'}
                        onClick={handleUnavailableToggle}
                        className={`w-full py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold transition-all ${
                          selectedTable.STATUS === 'OCCUPIED'
                            ? 'bg-slate-100 text-slate-300 border border-slate-200 cursor-not-allowed'
                            : selectedTable.STATUS === 'UNAVAILABLE'
                            ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 cursor-pointer active:scale-98'
                            : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 cursor-pointer active:scale-98'
                        }`}
                        title={selectedTable.STATUS === 'OCCUPIED' ? 'Cannot mark as Unavailable while occupied' : undefined}
                      >
                        {selectedTable.STATUS === 'UNAVAILABLE' ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Mark as Available</span>
                          </>
                        ) : (
                          <>
                            <Ban className="w-3.5 h-3.5" />
                            <span>Mark as Unavailable</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* ── TAB 2: RESERVATIONS ── */}
                {sidebarTab === 'reservation' && (
                  <div className="flex flex-col gap-3.5 flex-1">
                    {selectedTable.STATUS === 'RESERVED' && reservations[selectedTable.TABLE_NUM] ? (
                      /* Active Registered Reservation Card */
                      <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-300 shadow-xs flex flex-col gap-3">
                        <div className="flex items-center justify-between pb-2 border-b border-amber-200">
                          <div className="flex items-center gap-2 text-amber-950 font-black text-xs">
                            <CalendarClock className="w-4 h-4 text-amber-600" />
                            <span>Active Reservation</span>
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide bg-amber-100 text-amber-900 border border-amber-300">
                            Reserved
                          </span>
                        </div>

                        <div className="bg-white rounded-xl p-3 border border-amber-200/80 space-y-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500 font-medium">Customer:</span>
                            <span className="font-bold text-[#14274E] text-sm">
                              {reservations[selectedTable.TABLE_NUM].customerName}
                            </span>
                          </div>
                          {reservations[selectedTable.TABLE_NUM].phoneNumber && (
                            <div className="flex items-center justify-between">
                              <span className="text-slate-500 font-medium flex items-center gap-1">
                                <Phone className="w-3 h-3 text-slate-400" />
                                <span>Phone:</span>
                              </span>
                              <span className="font-bold text-slate-700 font-mono">
                                {reservations[selectedTable.TABLE_NUM].phoneNumber}
                              </span>
                            </div>
                          )}
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500 font-medium">Party Size:</span>
                            <span className="font-bold text-[#14274E]">
                              {reservations[selectedTable.TABLE_NUM].partySize} Guests
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500 font-medium">Time:</span>
                            <span className="font-bold text-amber-700">
                              {reservations[selectedTable.TABLE_NUM].reservationTime}
                            </span>
                          </div>
                          {reservations[selectedTable.TABLE_NUM].notes && (
                            <div className="pt-2 border-t border-slate-100">
                              <span className="text-slate-400 text-[11px] block font-medium">Notes:</span>
                              <span className="text-slate-700 text-xs italic">
                                {reservations[selectedTable.TABLE_NUM].notes}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => handleSeatReservation(selectedTable.TABLE_NUM)}
                            className="w-full py-2.5 px-3 rounded-xl bg-[#14274E] hover:bg-[#1e3a6d] active:scale-98 text-[#E9C46A] text-xs font-black flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-all"
                          >
                            <UserCheck className="w-4 h-4" />
                            <span>Seat Guests & Start Service</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleCancelReservation(selectedTable.TABLE_NUM)}
                            className="w-full py-1.5 px-3 rounded-lg bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                          >
                            <Ban className="w-3.5 h-3.5" />
                            <span>Cancel Reservation</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Register New Reservation Form */
                      <form onSubmit={handleRegisterReservation} className="p-3.5 rounded-2xl bg-slate-50/90 border border-slate-200/80 shadow-2xs flex flex-col gap-3">
                        <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                          <CalendarClock className="w-4 h-4 text-[#14274E]" />
                          <h3 className="text-xs font-black text-[#14274E]">Register Table Reservation</h3>
                        </div>

                        {selectedTable.STATUS === 'OCCUPIED' && (
                          <div className="p-2 rounded-xl bg-blue-50 border border-blue-200 text-[11px] text-blue-900 font-medium">
                            Table is currently occupied. You can schedule a reservation for later.
                          </div>
                        )}

                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] font-bold text-slate-600">Customer Name *</label>
                          <input
                            type="text"
                            value={resCustomerName}
                            onChange={(e) => setResCustomerName(e.target.value)}
                            placeholder="e.g. Maria Santos"
                            className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#14274E]/30"
                            required
                          />
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] font-bold text-slate-600">Phone Number</label>
                          <input
                            type="tel"
                            value={resPhone}
                            onChange={(e) => setResPhone(e.target.value)}
                            placeholder="e.g. 0917 123 4567"
                            className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#14274E]/30"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="flex flex-col gap-1">
                            <label className="text-[11px] font-bold text-slate-600">Party Size (Pax)</label>
                            <input
                              type="number"
                              min={1}
                              max={selectedEffectiveCapacity}
                              value={resPartySize}
                              onChange={(e) => setResPartySize(Number(e.target.value) || 1)}
                              className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#14274E]/30"
                            />
                          </div>

                          <div className="flex flex-col gap-1">
                            <label className="text-[11px] font-bold text-slate-600">Reservation Time</label>
                            <input
                              type="time"
                              value={resTime}
                              onChange={(e) => setResTime(e.target.value)}
                              className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#14274E]/30"
                            />
                          </div>
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] font-bold text-slate-600">Notes / Requests</label>
                          <textarea
                            rows={2}
                            value={resNotes}
                            onChange={(e) => setResNotes(e.target.value)}
                            placeholder="Special requests, celebration, high chair..."
                            className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#14274E]/30 resize-none"
                          />
                        </div>

                        <button
                          type="submit"
                          className="w-full mt-1 py-2.5 px-4 rounded-xl bg-[#14274E] hover:bg-[#1e3a6d] active:scale-98 text-[#E9C46A] text-xs font-black flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-all"
                        >
                          <Calendar className="w-4 h-4" />
                          <span>Confirm Reservation</span>
                        </button>
                      </form>
                    )}
                  </div>
                )}

                {/* ── TAB 3: ADVANCED ORDERS ── */}
                {sidebarTab === 'advanced_orders' && (
                  <div className="flex flex-col gap-3.5 flex-1">
                    {advanceOrderForSelectedTable ? (
                      <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-300 shadow-2xs flex flex-col gap-3">
                        <div className="flex items-center justify-between pb-2 border-b border-amber-200">
                          <div className="flex items-center gap-1.5 text-xs font-black text-amber-950">
                            <Receipt className="w-4 h-4 text-amber-600" />
                            <span>Advance Order: {advanceOrderForSelectedTable.orderNumber}</span>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide ${
                              advanceOrderForSelectedTable.status === 'CONFIRMED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-900 border border-amber-300 animate-pulse'
                            }`}
                          >
                            {advanceOrderForSelectedTable.status === 'CONFIRMED' ? 'Confirmed' : 'Pending'}
                          </span>
                        </div>

                        {/* Customer & details */}
                        <div className="bg-white rounded-xl p-3 border border-amber-200/80 space-y-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500 font-medium">Customer:</span>
                            <span className="font-bold text-[#14274E] text-sm">{advanceOrderForSelectedTable.customerName}</span>
                          </div>
                          {advanceOrderForSelectedTable.guestCount && (
                            <div className="flex items-center justify-between">
                              <span className="text-slate-500 font-medium">Party Size:</span>
                              <span className="font-bold text-[#14274E]">{advanceOrderForSelectedTable.guestCount} Guests</span>
                            </div>
                          )}

                          {/* Order items list */}
                          <div className="pt-2 border-t border-slate-100 max-h-36 overflow-y-auto space-y-1.5">
                            {advanceOrderForSelectedTable.items.map((it) => (
                              <div key={it.advanceItemId} className="flex items-center justify-between text-xs">
                                <span className="text-slate-700 truncate font-semibold">
                                  {it.quantity}× {it.itemName}
                                </span>
                                <span className="text-slate-600 font-mono ml-2 shrink-0">
                                  ₱{it.totalPrice.toFixed(2)}
                                </span>
                              </div>
                            ))}
                          </div>

                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between font-black text-xs text-[#14274E]">
                            <span>Total:</span>
                            <span className="text-sm">₱{advanceOrderForSelectedTable.totalAmount.toFixed(2)}</span>
                          </div>
                        </div>

                        {/* Action buttons */}
                        {advanceOrderForSelectedTable.status === 'PENDING' ? (
                          <div className="flex flex-col gap-2 pt-1">
                            <label className="flex items-center gap-2 px-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={keepAdvanceOrder}
                                onChange={(e) => setKeepAdvanceOrder(e.target.checked)}
                                className="w-3.5 h-3.5 rounded text-[#14274E] accent-[#14274E] cursor-pointer"
                              />
                              <span className="text-[11px] font-bold text-amber-950">
                                Keep items as regular order
                              </span>
                            </label>
                            <button
                              type="button"
                              onClick={() => handleSeatWithAdvanceOrder(keepAdvanceOrder)}
                              className="w-full py-2.5 px-3 rounded-xl bg-[#14274E] hover:bg-[#1e3a6d] active:scale-98 text-[#E9C46A] text-xs font-black flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-all"
                            >
                              <Users className="w-4 h-4" />
                              <span>Seat Guests ({keepAdvanceOrder ? 'Keep Order' : 'Discard'})</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSeatWithAdvanceOrder(false)}
                              className="w-full py-1.5 px-2 rounded-lg bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                            >
                              <Ban className="w-3.5 h-3.5" />
                              <span>Discard Advance Order</span>
                            </button>
                          </div>
                        ) : (
                          <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-xl text-center text-xs font-bold text-emerald-800 flex items-center justify-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span>Kept as Regular Order</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Empty Advanced Orders State */
                      <div className="p-8 rounded-2xl bg-slate-50/70 border border-slate-200/80 text-center flex flex-col items-center justify-center gap-2.5">
                        <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 text-slate-400 flex items-center justify-center shadow-2xs">
                          <ShoppingBag className="w-6 h-6 stroke-[1.5]" />
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-[#14274E]">No Advanced Orders</h4>
                          <p className="text-[11px] text-slate-400 font-medium max-w-xs mt-1">
                            There are no pre-orders or online reservations attached to Table {selectedTable.TABLE_NUM}.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* Empty Selection State */
              <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                <div className="w-16 h-16 rounded-3xl bg-slate-100 border border-slate-200 flex items-center justify-center mb-4 shadow-xs text-slate-400">
                  <TableShapeIcon tableType={1} size={36} />
                </div>
                <h3 className="text-sm font-black text-[#14274E]">Select a Table</h3>
                <p className="text-xs text-slate-400 font-medium max-w-xs mt-1.5">
                  Click any table on the floor plan canvas to update status, register reservations, or view advance orders.
                </p>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Merge Persistency Configuration Modal */}
      {mergeModalOpen && (
        <div className="fixed inset-0 z-[120] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 flex flex-col gap-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
                  <GitMerge className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-[#14274E]">Merge {selectedTableNums.size} Tables</h3>
                  <p className="text-[11px] text-slate-500">Tables {Array.from(selectedTableNums).sort().join(', ')}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMergeModalOpen(false)}
                className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col gap-2.5">
              <span className="text-xs font-bold text-slate-700">Choose Merge Persistency:</span>

              {/* Temporary Option */}
              <label
                className={`p-3 rounded-xl border-2 flex items-start gap-3 cursor-pointer transition-all ${
                  mergePersistencyChoice === 'TEMPORARY'
                    ? 'border-indigo-600 bg-indigo-50/50 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="mergePersistency"
                  value="TEMPORARY"
                  checked={mergePersistencyChoice === 'TEMPORARY'}
                  onChange={() => setMergePersistencyChoice('TEMPORARY')}
                  className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-[#14274E]">Temporary Merge</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700">Default</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                    When the table is billed out, the merge group automatically dissolves and each table returns to available individually.
                  </p>
                </div>
              </label>

              {/* Continuous Option */}
              <label
                className={`p-3 rounded-xl border-2 flex items-start gap-3 cursor-pointer transition-all ${
                  mergePersistencyChoice === 'CONTINOUOUS'
                    ? 'border-indigo-600 bg-indigo-50/50 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="mergePersistency"
                  value="CONTINOUOUS"
                  checked={mergePersistencyChoice === 'CONTINOUOUS'}
                  onChange={() => setMergePersistencyChoice('CONTINOUOUS')}
                  className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                />
                <div className="flex-1">
                  <span className="text-xs font-black text-[#14274E]">Continuous Merge</span>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                    Tables remain merged across multiple dining parties and bill settlements until manually unmerged by staff.
                  </p>
                </div>
              </label>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setMergeModalOpen(false)}
                className="flex-1 py-2 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmMerge}
                className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-[#14274E] to-[#1E3A6D] hover:from-[#1E3A6D] hover:to-[#27477D] text-[#E9C46A] text-xs font-black cursor-pointer shadow-md active:scale-98 transition-all flex items-center justify-center gap-1.5"
              >
                <GitMerge className="w-3.5 h-3.5" />
                <span>Confirm Merge</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Label Management In-App Modal */}
      <LabelManagementModal
        isOpen={labelsModalOpen}
        onClose={() => {
          setLabelsModalOpen(false)
          void loadData(true)
        }}
      />
    </div>
  )
}
