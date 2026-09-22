import React, { useState, useEffect, useMemo } from 'react'
import {
  calculateCustomTemplateDistribution,
  type TemplateDistributionTarget,
} from '@/utils/floorPlan/distribution'
import {
  TABLE_TYPES,
  type TableType,
  type TableLayoutInfo,
} from '@/services/tableLayoutService'
import {
  fetchAllTypeConfigs,
  type TableTypeConfig,
} from '@/services/tableTypeConfigService'
import { type TablePosition, detectHardCollision } from '@/utils/floorPlan/collision'
import { TableShapeIcon } from './TableVisual'
import { Sparkles, X, AlertTriangle, Layers } from 'lucide-react'

interface AutomaticAllocationModalProps {
  isOpen: boolean
  gridWidth: number
  gridHeight: number
  maxVenuePax: number
  presetId: number
  onClose: () => void
  onApply: (allocatedTables: TableLayoutInfo[]) => void
}

const ALL_TABLE_TYPES: TableType[] = [1, 2, 3, 4, 5]

const DEFAULT_WEIGHTS: Record<TableType, number> = {
  1: 30, // Square Table (1x1, 4 Pax)
  2: 20, // Rectangle Table Horizontal (3x1, 8 Pax)
  3: 20, // Small Circle Table (1x1, 4 Pax)
  4: 15, // Big Circle Table (2x2, 6 Pax)
  5: 15, // Rectangle Table Vertical (1x3, 8 Pax)
}

export const AutomaticAllocationModal: React.FC<AutomaticAllocationModalProps> = ({
  isOpen,
  gridWidth,
  gridHeight,
  maxVenuePax,
  presetId,
  onClose,
  onApply,
}) => {
  const [targetPax, setTargetPax] = useState(Math.min(50, maxVenuePax))
  const [typeWeights, setTypeWeights] = useState<Record<TableType, number>>(DEFAULT_WEIGHTS)
  const [typeConfigs, setTypeConfigs] = useState<TableTypeConfig[]>([])
  const [isAllocating, setIsAllocating] = useState(false)
  const [placementNotice, setPlacementNotice] = useState<string | null>(null)

  // Fetch configured limits & capacities on open
  useEffect(() => {
    if (isOpen) {
      setPlacementNotice(null)
      void fetchAllTypeConfigs().then((configs) => {
        setTypeConfigs(configs)
      }).catch((err) => {
        console.warn('Notice loading type configs:', err)
      })
    }
  }, [isOpen])

  // Map each table type to its effective capacity, name, and max count
  const typeDetails = useMemo(() => {
    const map = new Map<TableType, {
      type: TableType
      name: string
      capacity: number
      maxCount: number | null
      isActive: boolean
      width: number
      height: number
      area: number
    }>()

    for (const t of ALL_TABLE_TYPES) {
      const defaultMeta = TABLE_TYPES[t]
      const dbConfig = typeConfigs.find((c) => c.TABLE_TYPE === t)

      const isActive = dbConfig?.IS_ACTIVE ?? true
      const capacity = dbConfig?.CAPACITY ?? defaultMeta?.defaultCapacity ?? 4
      const maxCount = dbConfig?.MAX_COUNT ?? null
      const name = dbConfig?.NAME || defaultMeta?.name || `Type ${t}`
      const width = defaultMeta?.width ?? 1
      const height = defaultMeta?.height ?? 1

      map.set(t, {
        type: t,
        name,
        capacity,
        maxCount,
        isActive,
        width,
        height,
        area: width * height,
      })
    }

    return map
  }, [typeConfigs])

  // Calculate dynamic capacity cap based on max_count limits
  const maxPossibleCapacity = useMemo(() => {
    let total = 0
    for (const t of ALL_TABLE_TYPES) {
      const details = typeDetails.get(t)
      if (!details || !details.isActive) continue

      if (details.maxCount !== null) {
        total += details.maxCount * details.capacity
      } else {
        total += 250 // effectively unlimited
      }
    }
    return Math.min(maxVenuePax, total || maxVenuePax)
  }, [typeDetails, maxVenuePax])

  // Effective requested pax clamped to dynamic ceiling
  const effectiveRequestedPax = Math.min(targetPax, maxPossibleCapacity)

  // Quick preset weight options
  const applyPresetWeights = (preset: 'balanced' | 'small' | 'large') => {
    if (preset === 'balanced') {
      setTypeWeights({ 1: 30, 2: 20, 3: 20, 4: 15, 5: 15 })
    } else if (preset === 'small') {
      setTypeWeights({ 1: 50, 2: 0, 3: 50, 4: 0, 5: 0 })
    } else if (preset === 'large') {
      setTypeWeights({ 1: 0, 2: 35, 3: 0, 4: 30, 5: 35 })
    }
  }

  // Distribution calculation
  const distributionResult = useMemo(() => {
    const targets: TemplateDistributionTarget[] = ALL_TABLE_TYPES
      .filter((t) => {
        const details = typeDetails.get(t)
        return details?.isActive && (typeWeights[t] ?? 0) > 0
      })
      .map((t) => {
        const details = typeDetails.get(t)!
        return {
          templateId: `type-${t}`,
          seats: details.capacity,
          percentage: typeWeights[t] ?? 0,
        }
      })

    if (targets.length === 0) {
      return {
        templateCounts: {} as Record<string, number>,
        totalPax: 0,
        totalTables: 0,
      }
    }

    const dist = calculateCustomTemplateDistribution(
      effectiveRequestedPax,
      targets,
      maxPossibleCapacity,
    )

    // Clamp counts to configured MAX_COUNT limits
    const clampedCounts: Record<string, number> = {}
    let totalPax = 0
    let totalTables = 0

    for (const t of ALL_TABLE_TYPES) {
      const tmplId = `type-${t}`
      const rawCount = dist.templateCounts[tmplId] || 0
      const details = typeDetails.get(t)

      let count = rawCount
      if (details?.maxCount !== null && details?.maxCount !== undefined) {
        count = Math.min(count, details.maxCount)
      }
      clampedCounts[tmplId] = count

      if (details) {
        totalPax += count * details.capacity
        totalTables += count
      }
    }

    return {
      templateCounts: clampedCounts,
      totalPax,
      totalTables,
    }
  }, [effectiveRequestedPax, typeWeights, maxPossibleCapacity, typeDetails])

  if (!isOpen) return null

  const handleGenerate = () => {
    setIsAllocating(true)
    setPlacementNotice(null)

    try {
      const existingPositions: TablePosition[] = []
      const layoutTables: TableLayoutInfo[] = []
      let tableNum = 1

      // Sort types by footprint area descending so largest tables are placed first:
      // Area 4 (Big Circle 2x2) -> Area 3 (Rectangles 3x1 and 1x3) -> Area 1 (Square & Small Circle 1x1)
      const sortedTypes = [...ALL_TABLE_TYPES].sort((a, b) => {
        const areaA = (typeDetails.get(a)?.area ?? 1)
        const areaB = (typeDetails.get(b)?.area ?? 1)
        return areaB - areaA
      })

      const placementQueue: Array<{ type: TableType; cap: number; width: number; height: number }> = []
      for (const t of sortedTypes) {
        const count = distributionResult.templateCounts[`type-${t}`] || 0
        const details = typeDetails.get(t)
        if (!details || count <= 0) continue

        for (let i = 0; i < count; i++) {
          placementQueue.push({
            type: t,
            cap: details.capacity,
            width: details.width,
            height: details.height,
          })
        }
      }

      let placedCount = 0

      for (const item of placementQueue) {
        const width = item.width
        const height = item.height

        let placedX = -1
        let placedY = -1

        // 1. Primary pass: Scan grid with 1-cell spacing gap between tables
        for (let y = 1; y <= gridHeight - height - 1; y += 2) {
          for (let x = 1; x <= gridWidth - width - 1; x += 2) {
            const candidate: TablePosition = { tableId: tableNum, x, y, widthBlocks: width, heightBlocks: height }
            if (!detectHardCollision(candidate, 1, existingPositions)) {
              placedX = x
              placedY = y
              break
            }
          }
          if (placedX !== -1) break
        }

        // 2. Fallback pass: Dense scan if spacing scan couldn't place
        if (placedX === -1) {
          for (let y = 0; y <= gridHeight - height; y++) {
            for (let x = 0; x <= gridWidth - width; x++) {
              const candidate: TablePosition = { tableId: tableNum, x, y, widthBlocks: width, heightBlocks: height }
              if (!detectHardCollision(candidate, 1, existingPositions)) {
                placedX = x
                placedY = y
                break
              }
            }
            if (placedX !== -1) break
          }
        }

        if (placedX !== -1) {
          existingPositions.push({ tableId: tableNum, x: placedX, y: placedY, widthBlocks: width, heightBlocks: height })
          layoutTables.push({
            INFO_ID: `auto-table-${tableNum}-${Date.now()}`,
            LAYOUT_PRESET_ID: presetId,
            TABLE_NUM: tableNum,
            MERGE_GROUP_ID: null,
            TABLE_TYPE: item.type,
            X_POS: placedX,
            Y_POS: placedY,
            TABLE_CAPACITY: item.cap,
          })
          tableNum++
          placedCount++
        }
      }

      if (placedCount < placementQueue.length) {
        setPlacementNotice(
          `Placed ${placedCount} of ${placementQueue.length} requested tables. The remaining ${
            placementQueue.length - placedCount
          } tables did not fit on the ${gridWidth}×${gridHeight} grid.`,
        )
      }

      onApply(layoutTables)
      onClose()
    } finally {
      setIsAllocating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 px-6 border-b border-slate-100 bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#14274E] text-[#E9C46A]">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-[#14274E]">Automatic Table Allocation</h3>
              <p className="text-[11px] font-semibold text-slate-500">
                Algorithmically populate layout matching target guest capacity using all table types
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content (Scrollable) */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Target Capacity Slider */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-black text-slate-700">Target Seating Capacity</label>
              <span className="font-mono font-black text-xs text-[#14274E] bg-slate-100 px-2.5 py-0.5 rounded-lg">
                {targetPax} Guests
              </span>
            </div>
            <input
              type="range"
              min={4}
              max={maxVenuePax}
              step={2}
              value={targetPax}
              onChange={(e) => setTargetPax(parseInt(e.target.value, 10))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#14274E]"
            />
            {targetPax > maxPossibleCapacity && (
              <p className="text-[11px] font-bold text-amber-600 mt-1.5 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>Capped at {maxPossibleCapacity} guests due to table type inventory limits.</span>
              </p>
            )}
          </div>

          {/* Quick Presets */}
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">
              Quick Distribution Presets
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => applyPresetWeights('balanced')}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition-colors"
              >
                Balanced Mix
              </button>
              <button
                type="button"
                onClick={() => applyPresetWeights('small')}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition-colors"
              >
                Small Tables (1–4 Pax)
              </button>
              <button
                type="button"
                onClick={() => applyPresetWeights('large')}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition-colors"
              >
                Large Groups (6–8 Pax)
              </button>
            </div>
          </div>

          {/* Distribution Sliders for all 5 Table Types */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3.5">
            <div className="flex items-center justify-between">
              <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                Table Type Weight Distribution
              </h4>
              <span className="text-[10px] font-semibold text-slate-400">
                Relative weights normalized automatically
              </span>
            </div>

            <div className="space-y-3">
              {ALL_TABLE_TYPES.map((t) => {
                const details = typeDetails.get(t)
                if (!details || !details.isActive) return null

                const currentWeight = typeWeights[t] ?? 0
                const count = distributionResult.templateCounts[`type-${t}`] || 0

                return (
                  <div key={t} className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <div className="flex items-center gap-2">
                        <TableShapeIcon tableType={t} size={18} />
                        <span className="font-bold text-slate-800">{details.name}</span>
                        <span className="text-[10px] font-semibold text-slate-400">
                          ({details.width}×{details.height}, {details.capacity} Pax)
                        </span>
                        {details.maxCount !== null && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800">
                            Max {details.maxCount}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-[#14274E]">
                          {count} {count === 1 ? 'table' : 'tables'}
                        </span>
                        <span className="font-mono text-[11px] font-bold text-slate-400 w-8 text-right">
                          {currentWeight}%
                        </span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={currentWeight}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10)
                        setTypeWeights((prev) => ({ ...prev, [t]: val }))
                      }}
                      className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#14274E]"
                    />
                  </div>
                )
              })}
            </div>
          </div>

          {/* Allocation Preview Breakdown */}
          <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl">
            <h4 className="text-[10px] font-black uppercase tracking-wider text-indigo-900 mb-2.5 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-600" />
              <span>Layout Summary</span>
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-center">
              {ALL_TABLE_TYPES.map((t) => {
                const details = typeDetails.get(t)
                const count = distributionResult.templateCounts[`type-${t}`] || 0
                if (!details || !details.isActive) return null

                return (
                  <div
                    key={t}
                    className={`p-2 rounded-xl border shadow-2xs transition-colors ${
                      count > 0 ? 'bg-white border-indigo-200' : 'bg-slate-50 border-slate-200 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <TableShapeIcon tableType={t} size={14} />
                      <p className="text-[10px] font-bold text-slate-600 truncate">{details.name}</p>
                    </div>
                    <p className="text-sm font-black text-[#14274E]">
                      {count} <span className="text-[10px] font-normal text-slate-500">({count * details.capacity} pax)</span>
                    </p>
                  </div>
                )
              })}
            </div>

            <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-indigo-100 text-xs font-bold text-indigo-950">
              <span>Total Generated Capacity:</span>
              <span className="font-mono font-black text-indigo-700">
                {distributionResult.totalPax} Guests ({distributionResult.totalTables} Tables)
              </span>
            </div>
          </div>

          {placementNotice && (
            <p className="text-xs font-bold text-amber-700 bg-amber-50 p-3 rounded-xl border border-amber-200 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{placementNotice}</span>
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2.5 p-4 px-6 border-t border-slate-100 bg-slate-50/50 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isAllocating || distributionResult.totalTables === 0}
            className="flex items-center gap-1.5 px-5 py-2.5 text-xs font-black text-white bg-[#14274E] hover:bg-[#0f1f40] rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer active:scale-95"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#E9C46A]" />
            <span>{isAllocating ? 'Allocating & Saving...' : 'Generate & Save Layout'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
