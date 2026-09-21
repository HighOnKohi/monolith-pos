import React, { useState, useEffect, useCallback } from 'react'
import {
  fetchAllTypeConfigs,
  updateTypeConfig,
  getTypeCountsFromLayout,
  type TableTypeConfig,
} from '@/services/tableTypeConfigService'
import { TABLE_TYPES, type TableType, type MergedTableNode } from '@/services/tableLayoutService'
import { logTableAction } from '@/services/tableAuditService'
import { TableShapeIcon } from './TableVisual'
import { Save, AlertCircle, RefreshCw, Check, AlertTriangle } from 'lucide-react'

interface TableTypesManagerProps {
  layoutTables: MergedTableNode[]
  onConfigChange?: () => void
}

export const TableTypesManager: React.FC<TableTypesManagerProps> = ({
  layoutTables,
  onConfigChange,
}) => {
  const [configs, setConfigs] = useState<TableTypeConfig[]>([])
  const [loading, setLoading] = useState(true)
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
    setLoading(true)
    try {
      const data = await fetchAllTypeConfigs()
      setConfigs(data)
    } catch (err) {
      console.error('Error loading type configs:', err)
      setError('Failed to load table type configurations.')
    } finally {
      setLoading(false)
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
    // If setting maxCount below placed count, enforce resolution flow
    if (editFields.maxCount !== null && editFields.maxCount < placedCount) {
      setError(
        `Current placed tables: ${placedCount}. New maximum: ${editFields.maxCount}. You currently have ${placedCount} tables of this type in the layout. Remove ${placedCount - editFields.maxCount} table(s) before applying this limit.`,
      )
      return
    }

    setIsSaving(true)
    setError(null)
    try {
      await updateTypeConfig(cfg.TYPE_CONFIG_ID, {
        name: editFields.name,
        capacity: editFields.capacity,
        maxCount: editFields.maxCount,
      })
      void logTableAction(
        'TYPE_LIMIT_CHANGED',
        `Updated table type "${editFields.name}" (Type ${cfg.TABLE_TYPE}): capacity=${editFields.capacity}, maxCount=${editFields.maxCount ?? 'unlimited'}.`,
        {
          targetEntity: 'TYPE_CONFIG',
          targetId: String(cfg.TYPE_CONFIG_ID),
          newState: { capacity: editFields.capacity, maxCount: editFields.maxCount },
        },
      )
      setSuccessMessage(`Updated ${editFields.name} configuration successfully.`)
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
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-black text-[#14274E]">Table Type Configuration & Limits</h2>
          <p className="text-xs font-semibold text-slate-500">
            Define seating capacities and maximum placement limits per table type.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadConfigs()}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-600 transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {configs.map((cfg) => {
          const tableType = cfg.TABLE_TYPE as TableType
          const placedCount = currentTypeCounts.get(cfg.TABLE_TYPE) || 0
          const isEditing = editingConfigId === cfg.TYPE_CONFIG_ID
          const isOverLimit = cfg.MAX_COUNT !== null && placedCount > cfg.MAX_COUNT
          const isAtLimit = cfg.MAX_COUNT !== null && placedCount >= cfg.MAX_COUNT

          return (
            <div
              key={cfg.TYPE_CONFIG_ID}
              className={`bg-white rounded-2xl border p-4.5 transition-all shadow-xs ${
                isOverLimit
                  ? 'border-rose-300 bg-rose-50/20'
                  : isEditing
                    ? 'border-[#14274E]/40 ring-2 ring-[#14274E]/10'
                    : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center border border-slate-200 text-slate-700 shrink-0">
                    <TableShapeIcon tableType={tableType} className="w-6 h-6" />
                  </div>
                  <div>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editFields.name}
                        onChange={(e) =>
                          setEditFields((prev) => ({ ...prev, name: e.target.value }))
                        }
                        className="text-xs font-black text-[#14274E] px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[#14274E]"
                      />
                    ) : (
                      <h3 className="text-xs font-black text-[#14274E]">{cfg.NAME}</h3>
                    )}
                    <p className="text-[11px] font-bold text-slate-400">
                      Type ID #{cfg.TABLE_TYPE} • {TABLE_TYPES[tableType]?.width}x
                      {TABLE_TYPES[tableType]?.height} Grid Units
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      isOverLimit
                        ? 'bg-rose-100 text-rose-700'
                        : isAtLimit
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {placedCount} Placed
                  </span>
                </div>
              </div>

              {/* Stats & Form */}
              <div className="grid grid-cols-2 gap-3 py-3 border-y border-slate-100 my-3">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                    Seating Capacity (Pax)
                  </label>
                  {isEditing ? (
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={editFields.capacity}
                      onChange={(e) =>
                        setEditFields((prev) => ({
                          ...prev,
                          capacity: Math.max(1, parseInt(e.target.value, 10) || 1),
                        }))
                      }
                      className="w-full text-xs font-bold text-slate-800 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-[#14274E]"
                    />
                  ) : (
                    <p className="text-xs font-black text-slate-800">{cfg.CAPACITY} Guests</p>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                    Maximum Allowed
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
                        `${cfg.MAX_COUNT} max`
                      )}
                    </p>
                  )}
                </div>
              </div>

              {/* Resolution Warning */}
              {isEditing &&
                editFields.maxCount !== null &&
                editFields.maxCount < placedCount && (
                  <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] font-bold text-amber-800 mb-3">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      Requires removing {placedCount - editFields.maxCount} table(s) from floor
                      layout first.
                    </span>
                  </div>
                )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-1">
                {isEditing ? (
                  <>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      disabled={isSaving}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 text-[11px] font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSave(cfg)}
                      disabled={isSaving}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#14274E] text-white text-[11px] font-black hover:bg-[#0f1f40] transition-colors shadow-xs"
                    >
                      <Save className="w-3 h-3" />
                      <span>{isSaving ? 'Saving...' : 'Save Limits'}</span>
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => startEdit(cfg)}
                    className="px-3 py-1 rounded-xl text-[11px] font-black text-[#14274E] bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
                  >
                    Edit Limit
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
