import React, { useState, useEffect, useCallback } from 'react'
import {
  fetchAllTypeConfigs,
  updateTypeConfig,
  getTypeCountsFromLayout,
  type TableTypeConfig,
} from '@/services/tableTypeConfigService'
import { TABLE_TYPE_MAX_CAPACITIES, type TableType, type MergedTableNode } from '@/services/tableLayoutService'
import { logTableAction } from '@/services/tableAuditService'
import { TableShapeIcon } from './TableVisual'
import { Save, AlertCircle, Check, AlertTriangle } from 'lucide-react'

interface TableTypesManagerProps {
  layoutTables: MergedTableNode[]
  onConfigChange?: () => void
  isSidebar?: boolean
}

export const TableTypesManager: React.FC<TableTypesManagerProps> = ({
  layoutTables,
  onConfigChange,
  isSidebar = false,
}) => {
  const [configs, setConfigs] = useState<TableTypeConfig[]>([])
  const [editingConfigId, setEditingConfigId] = useState<number | null>(null)
  const [editFields, setEditFields] = useState<{
    name: string
    capacity: number
    maxCount: number | null
  }>({
    name: '',
    capacity: 4,
    maxCount: null,
  })
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const currentTypeCounts = getTypeCountsFromLayout(layoutTables)

  const loadConfigs = useCallback(async () => {
    try {
      const data = await fetchAllTypeConfigs()
      setConfigs(data)
    } catch (err) {
      console.error('Error loading type configs:', err)
      setError('Failed to load table type configurations.')
    }
  }, [])

  useEffect(() => {
    void loadConfigs()
  }, [loadConfigs])

  const startEdit = (cfg: TableTypeConfig) => {
    setEditingConfigId(cfg.TYPE_CONFIG_ID)
    setEditFields({
      name: cfg.NAME,
      capacity: cfg.CAPACITY,
      maxCount: cfg.MAX_COUNT,
    })
    setError(null)
    setSuccessMessage(null)
  }

  const cancelEdit = () => {
    setEditingConfigId(null)
    setError(null)
  }

  const handleSave = async (cfg: TableTypeConfig) => {
    const placedCount = currentTypeCounts.get(cfg.TABLE_TYPE) || 0
    // Enforce hardcoded limits per table type
    const maxAllowedCap = TABLE_TYPE_MAX_CAPACITIES[cfg.TABLE_TYPE as TableType] ?? 14
    if (editFields.capacity > maxAllowedCap) {
      setError(`Seating capacity cannot exceed the maximum limit of ${maxAllowedCap} guests for ${cfg.NAME}.`)
      return
    }

    // If setting maxCount below placed count, enforce resolution flow
    if (editFields.maxCount !== null && editFields.maxCount < placedCount) {
      setError(
        `Current placed tables: ${placedCount}. Tables in Stock: ${editFields.maxCount}. You currently have ${placedCount} tables of this type in the layout. Remove ${placedCount - editFields.maxCount} table(s) before applying this stock limit.`,
      )
      return
    }

    setIsSaving(true)
    setError(null)
    try {
      await updateTypeConfig(cfg.TYPE_CONFIG_ID, {
        capacity: editFields.capacity,
        maxCount: editFields.maxCount,
      })
      void logTableAction(
        'TYPE_LIMIT_CHANGED',
        `Updated table type "${cfg.NAME}" (Type ${cfg.TABLE_TYPE}): capacity=${editFields.capacity}, inStock=${editFields.maxCount ?? 'unlimited'}.`,
        {
          targetEntity: 'TYPE_CONFIG',
          targetId: String(cfg.TYPE_CONFIG_ID),
          newState: { capacity: editFields.capacity, maxCount: editFields.maxCount },
        },
      )
      setSuccessMessage(`Updated ${cfg.NAME} configuration successfully.`)
      setEditingConfigId(null)
      await loadConfigs()
      onConfigChange?.()
      setTimeout(() => setSuccessMessage(null), 3500)
    } catch (err) {
      setError((err as Error).message || 'Failed to update type configuration.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className={isSidebar ? 'p-3.5 space-y-3.5 select-none' : 'p-6 max-w-5xl mx-auto space-y-6'}>


      {/* Notifications */}
      {error && (
        <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-700">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
          <div className="flex-1">{error}</div>
        </div>
      )}

      {successMessage && (
        <div className="flex items-center gap-2.5 p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-bold text-emerald-700">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Table Types Cards */}
      <div className={isSidebar ? 'flex flex-col gap-2.5' : 'grid grid-cols-1 md:grid-cols-2 gap-4'}>
        {configs.map((cfg) => {
          const tableType = cfg.TABLE_TYPE as TableType
          const placedCount = currentTypeCounts.get(cfg.TABLE_TYPE) || 0
          const isEditing = editingConfigId === cfg.TYPE_CONFIG_ID
          const isOverLimit = cfg.MAX_COUNT !== null && placedCount > cfg.MAX_COUNT
          const maxAllowedCapacity = TABLE_TYPE_MAX_CAPACITIES[tableType] ?? 14

          return (
            <div
              key={cfg.TYPE_CONFIG_ID}
              className={`bg-white rounded-2xl border p-4 transition-all shadow-xs ${
                isOverLimit
                  ? 'border-rose-300 bg-rose-50/20'
                  : isEditing
                    ? 'border-[#14274E] ring-2 ring-[#14274E]/10'
                    : 'border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center border border-slate-200 text-slate-700 shrink-0">
                    <TableShapeIcon tableType={tableType} className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-[#14274E]">{cfg.NAME}</h3>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {isEditing ? (
                    <>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          cancelEdit()
                        }}
                        disabled={isSaving}
                        className="px-2.5 py-1 rounded-xl border border-slate-200 text-[11px] font-bold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          void handleSave(cfg)
                        }}
                        disabled={isSaving}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#14274E] text-white text-[11px] font-black hover:bg-[#0f1f40] transition-colors shadow-xs cursor-pointer"
                      >
                        <Save className="w-3 h-3" />
                        <span>{isSaving ? 'Saving...' : 'Save'}</span>
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        startEdit(cfg)
                      }}
                      className="px-2.5 py-1 rounded-xl text-[11px] font-black text-[#14274E] bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
                    >
                      Edit Table
                    </button>
                  )}
                </div>
              </div>

              {/* Stats & Form */}
              <div className="grid grid-cols-2 gap-3 py-3 border-y border-slate-100 my-3">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                    Default Capacity
                  </label>
                  {isEditing ? (
                    <div>
                      <input
                        type="number"
                        min={1}
                        max={maxAllowedCapacity}
                        value={editFields.capacity}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10)
                          const clamped = isNaN(val)
                            ? 1
                            : Math.min(maxAllowedCapacity, Math.max(1, val))
                          setEditFields((prev) => ({
                            ...prev,
                            capacity: clamped,
                          }))
                        }}
                        className="w-full text-xs font-bold text-slate-800 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-[#14274E]"
                      />
                      <span className="text-[10px] text-slate-400 font-bold block mt-1">
                        Max Limit: {maxAllowedCapacity} Pax
                      </span>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs font-black text-slate-800">{cfg.CAPACITY} Guests</p>
                      <span className="text-[10px] text-slate-400 font-bold block mt-0.5">
                        Max Limit: {maxAllowedCapacity} Pax
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                    Tables in Stock
                  </label>
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={editFields.maxCount === null ? '' : editFields.maxCount}
                        placeholder="No limit"
                        onChange={(e) => {
                          const val = e.target.value === '' ? null : parseInt(e.target.value, 10)
                          setEditFields((prev) => ({
                            ...prev,
                            maxCount: isNaN(val as number) ? null : val,
                          }))
                        }}
                        className="w-full text-xs font-bold text-slate-800 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-[#14274E]"
                      />
                    </div>
                  ) : (
                    <p className="text-xs font-black text-slate-800">
                      {cfg.MAX_COUNT === null ? (
                        <span className="text-slate-400">Unlimited</span>
                      ) : (
                        `${cfg.MAX_COUNT} in Stock`
                      )}
                    </p>
                  )}
                </div>
              </div>

              {/* Resolution Warning */}
              {isEditing &&
                editFields.maxCount !== null &&
                editFields.maxCount < placedCount && (
                  <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] font-bold text-amber-800">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      Requires removing {placedCount - editFields.maxCount} table(s) from floor
                      layout first.
                    </span>
                  </div>
                )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
