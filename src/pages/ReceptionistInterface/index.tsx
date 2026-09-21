import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import {
  fetchAllLayoutPresets,
  fetchPresetLayout,
  fetchLiveRestaurantTables,
  TABLE_TYPES,
  type TableLayoutPreset,
  type MergedTableNode,
  type TableLayoutInfo,
} from '@/services/tableLayoutService'
import { calculateLayoutSuppression } from '@/utils/floorPlan/capacity'
import {
  fetchAllTables,
  setTableStatus,
  updateSeatedPax,
  mergeTables,
  unmergeTables,
  type TableData,
  type TableStatus,
} from '@/services/tableService'
import { fetchActiveLabels, assignLabelToTable, type TableLabel } from '@/services/tableLabelService'
import { resolveTableGroupByList } from '@/services/tableGroupService'
import { logTableAction } from '@/services/tableAuditService'
import { TableVisual, TableShapeIcon } from '@/pages/TableManager/components/TableVisual'
import { TableQrPreview } from '@/components/table-qr/TableQrPreview'
import { printBulkQrPdf } from '@/components/table-qr/tableQrPrinter'
import { downloadBulkQrPdf } from '@/components/table-qr/tableQrPdf'
import { LabelSelector } from '@/components/common/LabelSelector'
import {
  Users,
  CheckCircle2,
  Clock,
  Ban,
  GitMerge,
  QrCode,
  Printer,
  FileDown,
  RefreshCw,
  Unlink,
  Minus,
  Plus,
  Search,
  Crown,
  ChevronDown,
  Sparkles,
  AlertCircle,
  X,
  Check,
  Layers,
  Flame,
} from 'lucide-react'

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
  const [presets, setPresets] = useState<TableLayoutPreset[]>([])
  const [activePreset, setActivePreset] = useState<TableLayoutPreset | null>(null)
  const activePresetRef = useRef<TableLayoutPreset | null>(null)
  activePresetRef.current = activePreset
  const lastMutationTimeRef = useRef<number>(0)
  const [labels, setLabels] = useState<TableLabel[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // ── UI State ──
  const [selectedTableNum, setSelectedTableNum] = useState<number | null>(null)
  const [statusFilter, setStatusFilter] = useState<TableStatus | 'ALL'>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [showQrModal, setShowQrModal] = useState(false)
  const [qrTableNum, setQrTableNum] = useState<number | null>(null)
  const [mergeMode, setMergeMode] = useState(false)
  const [mergeSelection, setMergeSelection] = useState<number[]>([])
  const [containerDimensions, setContainerDimensions] = useState({ width: 0, height: 0 })

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

  // ── Calculate cellSize to fit 13 vertical divisions ──
  const cellSize = useMemo(() => {
    if (containerDimensions.height <= 0) return 48
    return Math.max(24, Math.floor(containerDimensions.height / 13))
  }, [containerDimensions.height])

  // ── Chair Suppression Map ──
  const chairSuppressionMap = useMemo(() => {
    return calculateLayoutSuppression(layoutTables)
  }, [layoutTables])

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
      setPresets(presetsData)

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

      if (layoutData.length > 0) {
        const mergedNodes: MergedTableNode[] = layoutData.map((lt) => {
          const live = liveByNum.get(lt.TABLE_NUM)
          return {
            ...lt,
            STATUS: (live?.STATUS || 'AVAILABLE') as MergedTableNode['STATUS'],
            CURRENT_GUEST_COUNT: live?.CURRENT_GUEST_COUNT ?? 0,
            GUEST_CAPACITY: live?.GUEST_CAPACITY ?? lt.TABLE_CAPACITY ?? TABLE_TYPES[lt.TABLE_TYPE]?.defaultCapacity ?? 4,
            BILL_OUT_REQUESTED: live?.BILL_OUT_REQUESTED ?? false,
            TABLE_ID: live?.TABLE_ID ?? lt.TABLE_NUM,
            LABEL_ID: live?.LABEL_ID != null ? live.LABEL_ID : (lt.LABEL_ID ?? null),
          }
        })
        setLayoutTables(mergedNodes)
      } else if (liveTables.length > 0) {
        const fallbackNodes: MergedTableNode[] = liveTables.map((rt, idx) => ({
          INFO_ID: `live-table-${rt.TABLE_NUM}`,
          LAYOUT_PRESET_ID: targetPreset?.LAYOUT_PRESET_ID ?? 0,
          TABLE_NUM: rt.TABLE_NUM,
          MERGE_GROUP_ID: rt.MERGE_GROUP_ID,
          TABLE_TYPE: 1,
          X_POS: (idx % 6) * 3 + 1,
          Y_POS: Math.floor(idx / 6) * 3 + 1,
          STATUS: rt.STATUS,
          CURRENT_GUEST_COUNT: rt.CURRENT_GUEST_COUNT,
          GUEST_CAPACITY: rt.GUEST_CAPACITY,
          BILL_OUT_REQUESTED: rt.BILL_OUT_REQUESTED,
          TABLE_ID: rt.TABLE_ID,
          LABEL_ID: rt.LABEL_ID ?? null,
        }))
        setLayoutTables(fallbackNodes)
      } else {
        setLayoutTables([])
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
      .on('postgres_changes', { event: '*', schema: 'tables', table: 'Restaurant_Tables' }, () => {
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

    const handleOrderUpdate = () => {
      if (Date.now() - lastMutationTimeRef.current >= 2500) {
        void loadData(true)
      }
    }
    window.addEventListener('monolith-order-update', handleOrderUpdate)

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastMutationTimeRef.current >= 2500) {
        void loadData(true)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      window.removeEventListener('monolith-order-update', handleOrderUpdate)
      document.removeEventListener('visibilitychange', handleVisibility)
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

  // ── Status Counts & Venue Pax ──
  const { statusCounts, totalSeatedPax, totalVenueCapacity } = useMemo(() => {
    const counts = { AVAILABLE: 0, OCCUPIED: 0, RESERVED: 0, HAS_REQUEST: 0, UNAVAILABLE: 0 }
    let seated = 0
    let cap = 0
    for (const t of layoutTables) {
      if (t.STATUS && counts[t.STATUS] !== undefined) {
        counts[t.STATUS]++
      }
      seated += t.CURRENT_GUEST_COUNT ?? 0
      cap += t.GUEST_CAPACITY ?? 4
    }
    return { statusCounts: counts, totalSeatedPax: seated, totalVenueCapacity: cap }
  }, [layoutTables])

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

      const isGroupSelected = members.some(
        (m) => m.TABLE_NUM === selectedTableNum || mergeSelection.includes(m.TABLE_ID ?? m.TABLE_NUM),
      )

      const memberDetails = members.map((m) => {
        const cfg = TABLE_TYPES[m.TABLE_TYPE] || TABLE_TYPES[1]
        const x = m.X_POS
        const y = m.Y_POS
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
  }, [layoutTables, selectedTableNum, mergeSelection, cellSize])

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
      void logTableAction('TABLE_STATUS_CHANGED', `Table ${selectedTable?.TABLE_NUM ?? tableId} status updated to ${newStatus}.`, {
        targetEntity: 'TABLE',
        targetId: String(tableId),
        newState: { status: newStatus },
      })
      showToast(`Table status set to ${newStatus.replace('_', ' ')}`, 'success')
    } catch (err) {
      showToast((err as Error).message, 'error')
      void loadData(true)
    }
  }

  async function handleSeatedPaxChange(tableId: number, pax: number) {
    lastMutationTimeRef.current = Date.now()

    // Optimistic guest count update
    setLayoutTables((prev) =>
      prev.map((t) =>
        t.TABLE_ID === tableId || t.TABLE_NUM === selectedTable?.TABLE_NUM
          ? {
              ...t,
              CURRENT_GUEST_COUNT: pax,
              STATUS: (pax > 0 && t.STATUS === 'AVAILABLE') ? 'OCCUPIED' : t.STATUS,
            }
          : t,
      ),
    )

    try {
      await updateSeatedPax(tableId, pax)
      void logTableAction('CAPACITY_CHANGED', `Table ${selectedTable?.TABLE_NUM ?? tableId} seated pax changed to ${pax}.`, {
        targetEntity: 'TABLE',
        targetId: String(tableId),
        newState: { seatedPax: pax },
      })
      if (pax > 0 && selectedTable?.STATUS === 'AVAILABLE') {
        await setTableStatus(tableId, 'OCCUPIED')
      }
    } catch (err) {
      showToast((err as Error).message, 'error')
      void loadData(true)
    }
  }

  async function handleClearTable(tableId: number) {
    lastMutationTimeRef.current = Date.now()

    // Optimistic table clear
    setLayoutTables((prev) =>
      prev.map((t) =>
        t.TABLE_ID === tableId || t.TABLE_NUM === selectedTable?.TABLE_NUM
          ? { ...t, CURRENT_GUEST_COUNT: 0, STATUS: 'AVAILABLE' }
          : t,
      ),
    )

    try {
      await updateSeatedPax(tableId, 0)
      await setTableStatus(tableId, 'AVAILABLE')
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

    // Optimistic label update
    setLayoutTables((prev) =>
      prev.map((t) =>
        t.TABLE_ID === tableId || t.TABLE_NUM === selectedTable?.TABLE_NUM
          ? { ...t, LABEL_ID: labelId }
          : t,
      ),
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

  async function handleMerge() {
    if (mergeSelection.length < 2) {
      showToast('Select at least 2 tables to merge', 'error')
      return
    }
    try {
      await mergeTables(mergeSelection)
      void logTableAction('TABLES_MERGED', `Merged ${mergeSelection.length} tables (IDs: ${mergeSelection.join(', ')}).`, {
        targetEntity: 'TABLE_GROUP',
        metadata: { tableIds: mergeSelection },
      })
      showToast(`Merged ${mergeSelection.length} tables successfully`, 'success')
      setMergeMode(false)
      setMergeSelection([])
      await loadData(true)
    } catch (err) {
      showToast((err as Error).message, 'error')
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

  function handleTableClick(node: MergedTableNode) {
    if (mergeMode) {
      const id = node.TABLE_ID ?? node.TABLE_NUM
      setMergeSelection((prev) =>
        prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
      )
    } else {
      setSelectedTableNum((prev) => (prev === node.TABLE_NUM ? null : node.TABLE_NUM))
    }
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    const num = parseInt(searchQuery.trim().replace(/^T/i, ''), 10)
    if (!isNaN(num)) {
      const found = layoutTables.find((t) => t.TABLE_NUM === num)
      if (found) {
        setSelectedTableNum(found.TABLE_NUM)
        showToast(`Selected Table ${found.TABLE_NUM}`, 'info')
      } else {
        showToast(`Table ${num} not found on floor plan`, 'error')
      }
    }
  }

  const selectedLabel = selectedTable?.LABEL_ID ? labelMap.get(selectedTable.LABEL_ID) : null

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-[#F8FAFC] overflow-hidden select-none">
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

      {/* ── Top Header Toolbar ── */}
      <div className="flex items-center justify-between px-5 py-2.5 bg-white border-b border-slate-200/90 shrink-0 shadow-2xs gap-3 flex-wrap">
        {/* Left Section: Title & Preset Switcher */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#14274E]" />
            <h1 className="text-base font-black tracking-tight text-[#14274E]">Reception Floor Plan</h1>
          </div>

          {/* Preset Chooser (Multi-Floor Support) */}
          {presets.length > 1 && (
            <div className="relative inline-flex items-center">
              <select
                value={activePreset?.LAYOUT_PRESET_ID ?? ''}
                onChange={(e) => {
                  const pid = Number(e.target.value)
                  if (pid) void loadData(false, pid)
                }}
                className="appearance-none pl-2.5 pr-7 py-1 text-xs font-bold text-[#14274E] bg-slate-100 hover:bg-slate-200/80 rounded-lg border border-slate-200 cursor-pointer transition-colors focus:outline-hidden"
              >
                {presets.map((p) => (
                  <option key={p.LAYOUT_PRESET_ID} value={p.LAYOUT_PRESET_ID}>
                    {p.PRESET_NAME} {p.IS_DEFAULT ? '(Default)' : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2 pointer-events-none" />
            </div>
          )}

          {/* Venue Capacity Indicator */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100/90 border border-slate-200 text-xs font-semibold text-slate-700">
            <Users className="w-3 h-3 text-slate-500" />
            <span>
              Occupancy: <strong className="text-[#14274E]">{totalSeatedPax}</strong> / {totalVenueCapacity} Pax
            </span>
            <span className="text-[10px] text-slate-500 ml-0.5">
              ({totalVenueCapacity > 0 ? Math.round((totalSeatedPax / totalVenueCapacity) * 100) : 0}%)
            </span>
          </div>
        </div>

        {/* Center Section: Status Filter Pills (Clicking filters/highlights) */}
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

        {/* Right Section: Quick Search & Merge Controls */}
        <div className="flex items-center gap-2">
          {/* Quick Search */}
          <form onSubmit={handleSearchSubmit} className="relative">
            <input
              type="text"
              placeholder="Find Table #"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-28 sm:w-32 pl-7 pr-2 py-1 text-xs font-semibold bg-slate-100 rounded-lg border border-slate-200 focus:outline-hidden focus:bg-white focus:border-[#14274E] focus:w-36 transition-all"
            />
            <Search className="w-3 h-3 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </form>

          {/* Merge Mode Toggle Button */}
          {mergeMode ? (
            <div className="flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-150">
              <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-200">
                {mergeSelection.length} selected
              </span>
              <button
                type="button"
                onClick={handleMerge}
                disabled={mergeSelection.length < 2}
                className="flex items-center gap-1 px-3 py-1 text-xs font-bold bg-[#14274E] text-[#E9C46A] hover:bg-[#1e3a6d] rounded-lg disabled:opacity-40 cursor-pointer shadow-xs transition-colors"
              >
                <GitMerge className="w-3 h-3" />
                <span>Confirm Merge</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMergeMode(false)
                  setMergeSelection([])
                }}
                className="px-2.5 py-1 text-xs font-bold text-slate-600 bg-white hover:bg-slate-100 rounded-lg border border-slate-200 cursor-pointer transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setMergeMode(true)
                if (selectedTableNum !== null) {
                  const target = layoutTables.find((t) => t.TABLE_NUM === selectedTableNum)
                  if (target) setMergeSelection([target.TABLE_ID ?? target.TABLE_NUM])
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 rounded-lg border border-slate-200 cursor-pointer transition-colors shadow-2xs"
              title="Select multiple tables to merge into a single group"
            >
              <GitMerge className="w-3.5 h-3.5 text-indigo-600" />
              <span>Merge</span>
            </button>
          )}

          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => void loadData(false)}
            className="p-1.5 text-slate-500 hover:text-slate-800 bg-white hover:bg-slate-100 rounded-lg border border-slate-200 cursor-pointer transition-colors"
            title="Refresh floor data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Main Workspace Body: Floor Plan Canvas + Right Inspector ── */}
      <div className="flex flex-1 min-h-0 relative overflow-hidden">
        {/* Floor Plan Canvas Container (Identical to TableManager layout-container) */}
        <div className="layout-container flex-1 min-h-0 m-3 rounded-2xl bg-white border border-slate-200/90 shadow-xs relative overflow-hidden flex flex-col">
          {/* Dynamic edge-to-edge grid container */}
          <div
            ref={containerRef}
            onClick={(e) => {
              // Click background deselects table
              const target = e.target as HTMLElement
              if (!target.closest('.table-node-item')) {
                if (!mergeMode) setSelectedTableNum(null)
              }
            }}
            className="floor-grid-canvas flex-1 h-full w-full overflow-hidden relative bg-white select-none p-0 cursor-default"
          >
            <div
              className="w-full h-full relative select-none"
              style={{
                backgroundSize: `${cellSize}px ${cellSize}px`,
                backgroundPosition: '0 0',
              }}
            >
              {/* Dynamic Merge Group Indicators (Box or Broken Chain Link Lines) */}
              {mergeGroupVisuals.map((visual) => {
                if (visual.type === 'box') {
                  const padding = Math.max(6, Math.round(cellSize * 0.12))
                  const left = visual.minX * cellSize - padding
                  const top = visual.minY * cellSize - padding
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
              {layoutTables.map((node) => {
                const isSelected =
                  selectedTableNum === node.TABLE_NUM ||
                  mergeSelection.includes(node.TABLE_ID ?? node.TABLE_NUM)
                const suppress = chairSuppressionMap.get(node.TABLE_NUM)
                const label = node.LABEL_ID ? labelMap.get(node.LABEL_ID) : undefined

                // Dim tables that don't match the current status filter (preserving floor layout spatial context)
                const matchesFilter = statusFilter === 'ALL' || node.STATUS === statusFilter

                return (
                  <div
                    key={node.TABLE_NUM}
                    onClick={() => handleTableClick(node)}
                    className={`table-node-item absolute transition-all select-none cursor-pointer ${
                      isSelected
                        ? 'z-40 scale-105 filter drop-shadow-lg'
                        : matchesFilter
                          ? 'z-20 hover:scale-103'
                          : 'z-10 opacity-30 hover:opacity-80'
                    }`}
                    style={{
                      left: `${node.X_POS * cellSize}px`,
                      top: `${node.Y_POS * cellSize}px`,
                    }}
                  >
                    <TableVisual
                      tableType={node.TABLE_TYPE}
                      tableNum={node.TABLE_NUM}
                      cellSize={cellSize}
                      status={node.STATUS}
                      guestCount={node.CURRENT_GUEST_COUNT}
                      capacity={node.GUEST_CAPACITY}
                      labelName={label?.NAME}
                      labelColor={label?.COLOR}
                      isMerged={node.MERGE_GROUP_ID != null}
                      mergeGroupId={node.MERGE_GROUP_ID}
                      isSelected={isSelected}
                      hideChairs={suppress}
                    />
                  </div>
                )
              })}

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
                    No tables found in this preset. Configure floor plans in the Table Manager.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Right Inspector Panel (Dedicated Reception Operations) ── */}
        <div className="w-80 lg:w-96 shrink-0 bg-white border-l border-slate-200 overflow-y-auto flex flex-col shadow-xs">
          {selectedTable ? (
            <div className="p-4 flex flex-col gap-4">
              {/* Header: Table Title & Shape */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-[#14274E] text-[#E9C46A] flex items-center justify-center font-black text-lg shadow-sm">
                    {selectedTable.TABLE_NUM}
                  </div>
                  <div>
                    <h2 className="text-base font-black text-[#14274E] leading-tight">
                      Table {selectedTable.TABLE_NUM}
                    </h2>
                    <span className="text-xs text-slate-500 font-medium">
                      {TABLE_TYPES[selectedTable.TABLE_TYPE]?.name ?? 'Table'} • Max{' '}
                      {selectedTable.GUEST_CAPACITY ?? 4} Pax
                    </span>
                  </div>
                </div>

                {/* Close Inspector */}
                <button
                  type="button"
                  onClick={() => setSelectedTableNum(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                  title="Close inspector"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* ── CARD 1: VIP & Table Tier (The "Label Thingy" & VIP Stuff) ── */}
              <div className="p-3.5 rounded-2xl bg-gradient-to-br from-amber-500/10 via-rose-500/5 to-slate-50 border border-amber-200/60 shadow-2xs">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-xs font-black text-[#14274E]">
                    <Crown className="w-4 h-4 text-amber-500 fill-amber-500/30" />
                    <span>VIP & Table Tier</span>
                  </div>

                  {/* Active Label Pill */}
                  {selectedLabel ? (
                    <span
                      className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider text-white shadow-xs flex items-center gap-1"
                      style={{ backgroundColor: selectedLabel.COLOR }}
                    >
                      <Sparkles className="w-2.5 h-2.5" />
                      <span>{selectedLabel.NAME}</span>
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-slate-400 bg-slate-100">
                      Regular
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-slate-500 mb-2.5">
                  {selectedLabel
                    ? `This table is designated as "${selectedLabel.NAME}". Provide priority service.`
                    : 'Assign a VIP, Gold, or Priority tier to this table for special service.'}
                </p>

                {/* Label Selector Dropdown */}
                <div className="bg-white rounded-xl p-1 border border-slate-200 shadow-2xs">
                  <LabelSelector
                    tableId={selectedTable.TABLE_ID ?? selectedTable.TABLE_NUM}
                    currentLabelId={selectedTable.LABEL_ID ?? null}
                    labels={labels}
                    onLabelChanged={(labelId) =>
                      handleLabelChange(selectedTable.TABLE_ID ?? selectedTable.TABLE_NUM, labelId)
                    }
                  />
                </div>
              </div>

              {/* ── CARD 2: Live Table Status (Tactile Status Buttons) ── */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 shadow-2xs">
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-black text-[#14274E]">
                    <Layers className="w-4 h-4 text-[#14274E]" />
                    <span>Table Status</span>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wide ${
                      selectedTable.STATUS === 'AVAILABLE'
                        ? 'bg-emerald-100 text-emerald-800'
                        : selectedTable.STATUS === 'OCCUPIED'
                          ? 'bg-blue-100 text-blue-800'
                          : selectedTable.STATUS === 'RESERVED'
                            ? 'bg-amber-100 text-amber-800'
                            : selectedTable.STATUS === 'HAS_REQUEST'
                              ? 'bg-rose-100 text-rose-800 animate-pulse'
                              : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {selectedTable.STATUS?.replace('_', ' ') ?? 'AVAILABLE'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      {
                        status: 'AVAILABLE',
                        label: 'Available',
                        icon: CheckCircle2,
                        color: '#10B981',
                        bg: '#ECFDF5',
                        border: '#A7F3D0',
                      },
                      {
                        status: 'OCCUPIED',
                        label: 'Occupied',
                        icon: Users,
                        color: '#3B82F6',
                        bg: '#EFF6FF',
                        border: '#BFDBFE',
                      },
                      {
                        status: 'RESERVED',
                        label: 'Reserved',
                        icon: Clock,
                        color: '#F59E0B',
                        bg: '#FFFBEB',
                        border: '#FDE68A',
                      },
                      {
                        status: 'HAS_REQUEST',
                        label: 'Bill Out',
                        icon: Flame,
                        color: '#EF4444',
                        bg: '#FEF2F2',
                        border: '#FECACA',
                      },
                      {
                        status: 'UNAVAILABLE',
                        label: 'Unavailable',
                        icon: Ban,
                        color: '#64748B',
                        bg: '#F8FAFC',
                        border: '#E2E8F0',
                      },
                    ] as const
                  ).map((btn) => {
                    const isActive = selectedTable.STATUS === btn.status
                    const IconComponent = btn.icon

                    return (
                      <button
                        key={btn.status}
                        type="button"
                        onClick={() =>
                          handleStatusChange(
                            selectedTable.TABLE_ID ?? selectedTable.TABLE_NUM,
                            btn.status as TableStatus,
                          )
                        }
                        className={`flex items-center gap-2 p-2 rounded-xl text-left font-bold text-xs transition-all cursor-pointer border ${
                          isActive
                            ? 'ring-2 ring-offset-1 shadow-sm scale-102'
                            : 'bg-white hover:bg-slate-100/80 border-slate-200 text-slate-700'
                        }`}
                        style={
                          isActive
                            ? {
                                backgroundColor: btn.bg,
                                borderColor: btn.color,
                                color: btn.color,
                                boxShadow: `0 0 0 2px ${btn.color}30`,
                              }
                            : {}
                        }
                      >
                        <IconComponent
                          className="w-4 h-4 shrink-0"
                          style={{ color: isActive ? btn.color : '#94A3B8' }}
                        />
                        <span className="truncate">{btn.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* ── CARD 3: Seated Guests Stepper ── */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 shadow-2xs">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-xs font-black text-[#14274E]">
                    <Users className="w-4 h-4 text-[#14274E]" />
                    <span>Seated Guests</span>
                  </div>
                  <span className="text-xs font-semibold text-slate-500">
                    Max {selectedTable.GUEST_CAPACITY ?? 4} Pax
                  </span>
                </div>

                <div className="flex items-center justify-between bg-white rounded-xl p-2 border border-slate-200">
                  <button
                    type="button"
                    onClick={() =>
                      handleSeatedPaxChange(
                        selectedTable.TABLE_ID ?? selectedTable.TABLE_NUM,
                        Math.max(0, (selectedTable.CURRENT_GUEST_COUNT ?? 0) - 1),
                      )
                    }
                    className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-black cursor-pointer transition-colors active:scale-95"
                    title="Decrease seated guests"
                  >
                    <Minus className="w-4 h-4 stroke-[3]" />
                  </button>

                  <div className="flex flex-col items-center">
                    <span className="text-2xl font-black text-[#14274E] leading-none">
                      {selectedTable.CURRENT_GUEST_COUNT ?? 0}
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                      Guests Seated
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      handleSeatedPaxChange(
                        selectedTable.TABLE_ID ?? selectedTable.TABLE_NUM,
                        Math.min(
                          selectedTable.GUEST_CAPACITY ?? 99,
                          (selectedTable.CURRENT_GUEST_COUNT ?? 0) + 1,
                        ),
                      )
                    }
                    className="w-10 h-10 rounded-xl bg-[#14274E] hover:bg-[#1e3a6d] text-[#E9C46A] flex items-center justify-center font-black cursor-pointer transition-colors active:scale-95"
                    title="Increase seated guests"
                  >
                    <Plus className="w-4 h-4 stroke-[3]" />
                  </button>
                </div>

                {/* Quick Pax Buttons */}
                <div className="flex items-center gap-1.5 mt-2.5">
                  {[1, 2, 3, 4].map((pax) => (
                    <button
                      key={pax}
                      type="button"
                      onClick={() =>
                        handleSeatedPaxChange(selectedTable.TABLE_ID ?? selectedTable.TABLE_NUM, pax)
                      }
                      className={`flex-1 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                        selectedTable.CURRENT_GUEST_COUNT === pax
                          ? 'bg-[#14274E] text-[#E9C46A] border-[#14274E]'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {pax} Pax
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      handleSeatedPaxChange(
                        selectedTable.TABLE_ID ?? selectedTable.TABLE_NUM,
                        selectedTable.GUEST_CAPACITY ?? 4,
                      )
                    }
                    className="flex-1 py-1 rounded-lg text-xs font-bold bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 cursor-pointer"
                  >
                    Full
                  </button>
                </div>

                {/* Clear Table Action */}
                {(selectedTable.CURRENT_GUEST_COUNT ?? 0) > 0 && (
                  <button
                    type="button"
                    onClick={() => handleClearTable(selectedTable.TABLE_ID ?? selectedTable.TABLE_NUM)}
                    className="w-full mt-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Clear Table & Mark Available</span>
                  </button>
                )}
              </div>

              {/* ── CARD 4: Merge Group Information ── */}
              {selectedGroup?.isMerged && (
                <div className="p-3.5 rounded-2xl bg-indigo-50/80 border border-indigo-200 shadow-2xs">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5 text-xs font-black text-indigo-900">
                      <GitMerge className="w-4 h-4 text-indigo-600" />
                      <span>Merged Group #{selectedGroup.anchorTableId}</span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-200/70 text-indigo-800">
                      {selectedGroup.capacity} Pax Total
                    </span>
                  </div>

                  <p className="text-xs text-indigo-800 mb-3">
                    Connected with:{' '}
                    <strong>
                      {selectedGroup.memberTableNums
                        .filter((n) => n !== selectedTable.TABLE_NUM)
                        .map((n) => `Table ${n}`)
                        .join(', ')}
                    </strong>
                  </p>

                  <button
                    type="button"
                    onClick={() => handleUnmerge(selectedGroup.anchorTableId)}
                    className="w-full py-1.5 rounded-xl bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Unlink className="w-3.5 h-3.5" />
                    <span>Unmerge Table Group</span>
                  </button>
                </div>
              )}

              {/* ── CARD 5: QR Code & Ordering ── */}
              <button
                type="button"
                onClick={() => {
                  setQrTableNum(selectedTable.TABLE_NUM)
                  setShowQrModal(true)
                }}
                className="w-full py-2.5 rounded-2xl bg-[#14274E] hover:bg-[#1e3a6d] text-[#E9C46A] text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md active:scale-98"
              >
                <QrCode className="w-4 h-4" />
                <span>View & Print Table QR Code</span>
              </button>
            </div>
          ) : (
            /* Empty Selection State */
            <div className="flex flex-col items-center justify-center h-full p-6 text-center">
              <div className="w-16 h-16 rounded-3xl bg-slate-100 border border-slate-200 flex items-center justify-center mb-4 shadow-xs text-slate-400">
                <TableShapeIcon tableType={1} size={36} />
              </div>
              <h3 className="text-sm font-black text-[#14274E]">Select a Table</h3>
              <p className="text-xs text-slate-400 font-medium max-w-xs mt-1.5">
                Click any table on the floor plan canvas to update status, adjust seated guests, assign VIP
                tiers, or print table QR codes.
              </p>

              {/* Floor Overview Quick Stats */}
              <div className="mt-6 w-full max-w-xs grid grid-cols-2 gap-2 text-left">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Available</span>
                  <p className="text-base font-black text-emerald-600 leading-tight">
                    {statusCounts.AVAILABLE} Tables
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Occupied</span>
                  <p className="text-base font-black text-blue-600 leading-tight">
                    {statusCounts.OCCUPIED} Tables
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Reserved</span>
                  <p className="text-base font-black text-amber-600 leading-tight">
                    {statusCounts.RESERVED} Tables
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Bill Out</span>
                  <p className="text-base font-black text-rose-600 leading-tight">
                    {statusCounts.HAS_REQUEST} Tables
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── QR Code Preview Modal ── */}
      {showQrModal && qrTableNum !== null && (() => {
        const qrTable = layoutTables.find((t) => t.TABLE_NUM === qrTableNum)
        const tableId = qrTable?.TABLE_ID ?? qrTableNum
        const qrItem = { TABLE_ID: tableId, TABLE_NUM: qrTableNum }

        return (
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150"
            onClick={() => setShowQrModal(false)}
          >
            <div
              className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <QrCode className="w-5 h-5 text-[#14274E]" />
                  <h3 className="text-base font-black text-[#14274E]">Table {qrTableNum} QR Code</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowQrModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-auto flex justify-center py-2">
                <TableQrPreview
                  tableId={tableId}
                  tableNum={qrTableNum}
                  guestCapacity={qrTable?.GUEST_CAPACITY}
                  onClose={() => setShowQrModal(false)}
                />
              </div>

              <div className="flex gap-2.5 mt-5">
                <button
                  type="button"
                  onClick={() => {
                    void printBulkQrPdf([qrItem])
                  }}
                  className="flex-1 py-2.5 text-xs font-black bg-[#14274E] text-[#E9C46A] hover:bg-[#1e3a6d] rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print QR Code</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void downloadBulkQrPdf([qrItem])
                  }}
                  className="flex-1 py-2.5 text-xs font-black border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <FileDown className="w-4 h-4" />
                  <span>Download PDF</span>
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
