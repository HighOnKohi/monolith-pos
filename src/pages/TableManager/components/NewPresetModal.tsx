import React, { useState, useEffect, useMemo } from 'react'
import { X, Layers, Sparkles, AlertTriangle } from 'lucide-react'
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
import { type TablePosition, detectCollision, detectHardCollision } from '@/utils/floorPlan/collision'
import { TableShapeIcon } from './TableVisual'

interface NewPresetModalProps {
  isOpen: boolean
  gridWidth?: number
  gridHeight?: number
  onClose: () => void
  onCreate: (
    name: string,
    maxPax: number,
    isDefault: boolean,
    customTables?: TableLayoutInfo[],
  ) => Promise<void>
}

const ALL_TABLE_TYPES: TableType[] = [1, 2, 3, 4, 5]

const DEFAULT_WEIGHTS: Record<TableType, number> = {
  1: 30, // Square Table (1x1, 4 Pax)
  2: 20, // Rectangle Table Horizontal (3x1, 8 Pax)
  3: 20, // Small Circle Table (1x1, 4 Pax)
  4: 15, // Big Circle Table (2x2, 6 Pax)
  5: 15, // Rectangle Table Vertical (1x3, 8 Pax)
}

export const NewPresetModal: React.FC<NewPresetModalProps> = ({
  isOpen,
  gridWidth = 20,
  gridHeight = 16,
  onClose,
  onCreate,
}) => {
  const [name, setName] = useState('')
  const [maxPax, setMaxPax] = useState('50')
  const [isDefault, setIsDefault] = useState(false)
  const [enableAutoAllocate, setEnableAutoAllocate] = useState(true)
  const [typeWeights, setTypeWeights] = useState<Record<TableType, number>>(DEFAULT_WEIGHTS)
  const [typeConfigs, setTypeConfigs] = useState<TableTypeConfig[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch configured limits & capacities on open
  useEffect(() => {
    if (isOpen) {
      setError(null)
      void fetchAllTypeConfigs()
        .then((configs) => {
          setTypeConfigs(configs)
        })
        .catch((err) => {
          console.warn('Notice loading type configs:', err)
        })
    }
  }, [isOpen])

  // Map each table type to its effective capacity, name, and max count
  const typeDetails = useMemo(() => {
    const map = new Map<
      TableType,
      {
        type: TableType
        name: string
        capacity: number
        maxCount: number | null
        isActive: boolean
        width: number
        height: number
        area: number
      }
    >()

    for (const t of ALL_TABLE_TYPES) {
      const defaultMeta = TABLE_TYPES[t]
      const dbConfig = typeConfigs.find((c) => c.TABLE_TYPE === t)

      const isActive = dbConfig?.IS_ACTIVE ?? true
      const capacity = dbConfig?.CAPACITY ?? defaultMeta?.defaultCapacity ?? 4
      const maxCount = dbConfig?.MAX_COUNT ?? null
      const typeName = dbConfig?.NAME || defaultMeta?.name || `Type ${t}`
      const width = defaultMeta?.width ?? 1
      const height = defaultMeta?.height ?? 1

      map.set(t, {
        type: t,
        name: typeName,
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

  const parsedPaxNum = parseInt(maxPax, 10) || 50

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
    return Math.min(200, total || 200)
  }, [typeDetails])

  const effectiveRequestedPax = Math.min(parsedPaxNum, maxPossibleCapacity)

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
    const targets: TemplateDistributionTarget[] = ALL_TABLE_TYPES.filter((t) => {
      const details = typeDetails.get(t)
      return details?.isActive && (typeWeights[t] ?? 0) > 0
    }).map((t) => {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Please enter a preset name')
      return
    }

    const parsedPax = parseInt(maxPax, 10)
    if (isNaN(parsedPax) || parsedPax <= 0) {
      setError('Maximum Pax must be a positive number greater than 0')
      return
    }

    if (parsedPax > 200) {
      setError('Maximum Pax cannot exceed 200 seats')
      return
    }

    try {
      setIsSubmitting(true)
      setError(null)

      let allocatedTables: TableLayoutInfo[] | undefined

      if (enableAutoAllocate && distributionResult.totalTables > 0) {
        const existingPositions: TablePosition[] = []
        allocatedTables = []
        let tableNum = 1

        const sortedTypes = [...ALL_TABLE_TYPES].sort((a, b) => {
          const areaA = typeDetails.get(a)?.area ?? 1
          const areaB = typeDetails.get(b)?.area ?? 1
          return areaB - areaA
        })

        const placementQueue: Array<{
          type: TableType
          cap: number
          width: number
          height: number
        }> = []
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

        for (const item of placementQueue) {
          const width = item.width
          const height = item.height

          let placedX = -1
          let placedY = -1

          // 1. Primary pass: Spaced grid layout (with 1-cell aisle spacing around tables)
          for (let y = 1; y <= gridHeight - height; y += (height + 1)) {
            for (let x = 1; x <= gridWidth - width; x += (width + 1)) {
              const candidate: TablePosition = {
                tableId: tableNum,
                x,
                y,
                widthBlocks: width,
                heightBlocks: height,
              }
              if (!detectCollision(candidate, 1, existingPositions, 1)) {
                placedX = x
                placedY = y
                break
              }
            }
            if (placedX !== -1) break
          }

          // 2. Secondary pass: Fine coordinate search with 1-cell spacing
          if (placedX === -1) {
            for (let y = 0; y <= gridHeight - height; y++) {
              for (let x = 0; x <= gridWidth - width; x++) {
                const candidate: TablePosition = {
                  tableId: tableNum,
                  x,
                  y,
                  widthBlocks: width,
                  heightBlocks: height,
                }
                if (!detectCollision(candidate, 1, existingPositions, 1)) {
                  placedX = x
                  placedY = y
                  break
                }
              }
              if (placedX !== -1) break
            }
          }

          // 3. Fallback dense pass (pure overlap prevention)
          if (placedX === -1) {
            for (let y = 0; y <= gridHeight - height; y++) {
              for (let x = 0; x <= gridWidth - width; x++) {
                const candidate: TablePosition = {
                  tableId: tableNum,
                  x,
                  y,
                  widthBlocks: width,
                  heightBlocks: height,
                }
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
            existingPositions.push({
              tableId: tableNum,
              x: placedX,
              y: placedY,
              widthBlocks: width,
              heightBlocks: height,
            })
            allocatedTables.push({
              INFO_ID: `auto-table-${tableNum}-${Date.now()}`,
              LAYOUT_PRESET_ID: 0,
              TABLE_NUM: tableNum,
              MERGE_GROUP_ID: null,
              TABLE_TYPE: item.type,
              X_POS: placedX,
              Y_POS: placedY,
              TABLE_CAPACITY: item.cap,
            })
            tableNum++
          }
        }
      }

      await onCreate(name.trim(), parsedPax, isDefault, allocatedTables)
      setName('')
      setMaxPax('50')
      setIsDefault(false)
      onClose()
    } catch (err) {
      setError((err as Error).message || 'Failed to create preset')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 px-6 border-b border-slate-100 bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#14274E] text-[#E9C46A]">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-[#14274E]">Create New Layout Preset</h3>
              <p className="text-[11px] font-semibold text-slate-500">
                Configure floor plan capacity and auto-allocate initial table layout
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body (Scrollable) */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 text-xs font-bold text-rose-600 bg-rose-50 rounded-xl border border-rose-200">
              {error}
            </div>
          )}

          {/* Preset Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Preset Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Weekend Dining Layout, Event Setup"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#14274E]/20 focus:bg-white transition-all"
              autoFocus
            />
          </div>

          {/* Target Seating Capacity */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Maximum Pax (Seating Capacity)
              </label>
              <span className="font-mono font-black text-xs text-[#14274E] bg-slate-100 px-2.5 py-0.5 rounded-lg">
                {parsedPaxNum} Guests
              </span>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={4}
                max={200}
                step={2}
                value={parsedPaxNum}
                onChange={(e) => setMaxPax(e.target.value)}
                className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#14274E]"
              />
              <input
                type="number"
                min={1}
                max={200}
                value={maxPax}
                onChange={(e) => setMaxPax(e.target.value)}
                className="w-18 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-center text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#14274E]/20 focus:bg-white transition-all"
              />
            </div>
            {parsedPaxNum > maxPossibleCapacity && (
              <p className="text-[11px] font-bold text-amber-600 mt-1.5 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>Capped at {maxPossibleCapacity} guests due to table type inventory limits.</span>
              </p>
            )}
          </div>

          {/* Auto Allocate Feature Section */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3.5">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={enableAutoAllocate}
                  onChange={(e) => setEnableAutoAllocate(e.target.checked)}
                  className="w-4 h-4 rounded text-[#14274E] focus:ring-[#14274E] border-slate-300 cursor-pointer"
                />
                <span className="text-xs font-black text-[#14274E] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#E9C46A]" />
                  <span>Auto-Allocate Table Layout</span>
                </span>
              </label>

              {enableAutoAllocate && (
                <span className="text-[10px] font-semibold text-slate-400">
                  {gridWidth}×{gridHeight} grid placement
                </span>
              )}
            </div>

            {enableAutoAllocate && (
              <div className="space-y-3.5 pt-1">
                {/* Quick Presets */}
                <div>
                  <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                    Quick Distribution Presets
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => applyPresetWeights('balanced')}
                      className="px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition-colors cursor-pointer"
                    >
                      Balanced Mix
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPresetWeights('small')}
                      className="px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition-colors cursor-pointer"
                    >
                      Small Tables (1–4 Pax)
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPresetWeights('large')}
                      className="px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition-colors cursor-pointer"
                    >
                      Large Groups (6–8 Pax)
                    </button>
                  </div>
                </div>

                {/* Table Type Weight Sliders */}
                <div className="space-y-2.5">
                  {ALL_TABLE_TYPES.map((t) => {
                    const details = typeDetails.get(t)
                    if (!details || !details.isActive) return null

                    const currentWeight = typeWeights[t] ?? 0
                    const count = distributionResult.templateCounts[`type-${t}`] || 0

                    return (
                      <div
                        key={t}
                        className="bg-white p-2 rounded-xl border border-slate-200 shadow-2xs"
                      >
                        <div className="flex items-center justify-between text-xs mb-1">
                          <div className="flex items-center gap-1.5">
                            <TableShapeIcon tableType={t} size={16} />
                            <span className="font-bold text-slate-800">{details.name}</span>
                            <span className="text-[10px] text-slate-400">
                              ({details.capacity} Pax)
                            </span>
                            {details.maxCount !== null && (
                              <span className="text-[9px] font-bold px-1 rounded-md bg-amber-100 text-amber-800">
                                Max {details.maxCount}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-[#14274E]">
                              {count} {count === 1 ? 'table' : 'tables'}
                            </span>
                            <span className="font-mono text-[10px] font-bold text-slate-400 w-7 text-right">
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

                {/* Layout Summary */}
                <div className="p-3 bg-indigo-50/60 border border-indigo-100 rounded-xl">
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-indigo-900 mb-2 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Layout Summary</span>
                  </h4>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-center">
                    {ALL_TABLE_TYPES.map((t) => {
                      const details = typeDetails.get(t)
                      const count = distributionResult.templateCounts[`type-${t}`] || 0
                      if (!details || !details.isActive) return null

                      return (
                        <div
                          key={t}
                          className={`p-1.5 rounded-lg border shadow-2xs transition-colors ${
                            count > 0
                              ? 'bg-white border-indigo-200'
                              : 'bg-slate-50 border-slate-200 opacity-50'
                          }`}
                        >
                          <div className="flex items-center justify-center gap-1 mb-0.5">
                            <TableShapeIcon tableType={t} size={12} />
                            <p className="text-[10px] font-bold text-slate-600 truncate">
                              {details.name}
                            </p>
                          </div>
                          <p className="text-xs font-black text-[#14274E]">
                            {count}{' '}
                            <span className="text-[9px] font-normal text-slate-500">
                              ({count * details.capacity}p)
                            </span>
                          </p>
                        </div>
                      )
                    })}
                  </div>

                  <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-indigo-100 text-[11px] font-bold text-indigo-950">
                    <span>Total Generated Capacity:</span>
                    <span className="font-mono font-black text-indigo-700">
                      {distributionResult.totalPax} Guests ({distributionResult.totalTables} Tables)
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Set as Default Checkbox */}
          <div className="pt-1">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="w-4 h-4 rounded text-[#14274E] focus:ring-[#14274E] border-slate-300 cursor-pointer"
              />
              <span className="text-xs font-bold text-slate-700">
                Set as Default Floor Plan Preset
              </span>
            </label>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-black text-white bg-[#14274E] hover:bg-[#0f1f40] rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer active:scale-95"
            >
              {enableAutoAllocate && <Sparkles className="w-3 h-3 text-[#E9C46A]" />}
              <span>
                {isSubmitting
                  ? 'Creating...'
                  : enableAutoAllocate
                    ? 'Create & Allocate Preset'
                    : 'Create Preset'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

