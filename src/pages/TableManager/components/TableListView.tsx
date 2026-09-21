import React, { useState } from 'react'
import {
  TABLE_TYPES,
  type TableType,
  type MergedTableNode,
} from '@/services/tableLayoutService'
import { TableShapeIcon } from './TableVisual'
import { LabelSelector } from '@/components/common/LabelSelector'
import {
  Plus,
  Trash2,
  QrCode,
  Search,
  Sparkles,
} from 'lucide-react'

interface TableListViewProps {
  tables: MergedTableNode[]
  onAddTable: (type: TableType, labelId?: number | null) => void
  onDeleteTable: (tableNum: number) => void
  onUpdateSeatCount: (tableNum: number, seats: number) => void
  onOpenQrModal: (table: MergedTableNode) => void
  onOpenRemoveAll: () => void
  onOpenAutoAlloc: () => void
  onLabelAssigned: (tableNum: number, labelId: number | null) => void
}

export const TableListView: React.FC<TableListViewProps> = ({
  tables,
  onAddTable,
  onDeleteTable,
  onUpdateSeatCount,
  onOpenQrModal,
  onOpenRemoveAll,
  onOpenAutoAlloc,
  onLabelAssigned,
}) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [showAddModal, setShowAddModal] = useState(false)
  const [newTableType, setNewTableType] = useState<TableType>(1)

  const filteredTables = tables.filter((t) => {
    const matchesSearch =
      searchTerm.trim() === '' ||
      t.TABLE_NUM.toString().includes(searchTerm.trim()) ||
      TABLE_TYPES[t.TABLE_TYPE]?.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'ALL' || t.STATUS === statusFilter
    return matchesSearch && matchesStatus
  })

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-black text-[#14274E]">Table Directory & Management</h2>
          <p className="text-xs font-semibold text-slate-500">
            Configure individual tables, maximum pax capacities, labels, and QR codes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenAutoAlloc}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-indigo-200 bg-indigo-50/70 hover:bg-indigo-100 text-indigo-900 text-xs font-bold transition-all cursor-pointer shadow-2xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>Auto Allocate</span>
          </button>
          <button
            type="button"
            onClick={onOpenRemoveAll}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-200 bg-rose-50/70 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-all cursor-pointer shadow-2xs"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
            <span>Remove All</span>
          </button>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#14274E] hover:bg-[#0f1f40] text-white text-xs font-black transition-all cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5 text-[#E9C46A]" />
            <span>Add Table</span>
          </button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="relative min-w-[240px] flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search table number or type..."
            className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-[#14274E] focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Status:
          </span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-hidden cursor-pointer"
          >
            <option value="ALL">All Statuses ({tables.length})</option>
            <option value="AVAILABLE">Available</option>
            <option value="OCCUPIED">Occupied</option>
            <option value="RESERVED">Reserved</option>
            <option value="UNAVAILABLE">Unavailable</option>
          </select>
        </div>
      </div>

      {/* Table Grid / List */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs divide-y divide-slate-100">
        <div className="grid grid-cols-12 px-5 py-3 bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-400">
          <div className="col-span-2">Table</div>
          <div className="col-span-3">Type & Dimensions</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2">Max Capacity</div>
          <div className="col-span-2">Priority Label</div>
          <div className="col-span-1 text-right">Actions</div>
        </div>

        {filteredTables.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs font-bold">
            No tables match your search or filter.
          </div>
        ) : (
          filteredTables.map((table) => {
            const typeConfig = TABLE_TYPES[table.TABLE_TYPE] || TABLE_TYPES[1]

            return (
              <div
                key={table.TABLE_NUM}
                className="grid grid-cols-12 px-5 py-3.5 items-center hover:bg-slate-50/60 transition-colors"
              >
                {/* Table Number */}
                <div className="col-span-2 flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center font-black text-xs text-[#14274E] shrink-0">
                    {table.TABLE_NUM}
                  </div>
                  <div>
                    <span className="text-xs font-black text-[#14274E]">
                      Table {table.TABLE_NUM}
                    </span>
                    {table.MERGE_GROUP_ID != null && (
                      <span className="block text-[10px] font-bold text-indigo-600">
                        Merged (Group #{table.MERGE_GROUP_ID})
                      </span>
                    )}
                  </div>
                </div>

                {/* Type */}
                <div className="col-span-3 flex items-center gap-2.5">
                  <TableShapeIcon tableType={table.TABLE_TYPE} className="w-5 h-5 text-slate-600" />
                  <div>
                    <p className="text-xs font-bold text-slate-800">{typeConfig.name}</p>
                    <p className="text-[10px] font-semibold text-slate-400">
                      {typeConfig.width}x{typeConfig.height} Grid Units
                    </p>
                  </div>
                </div>

                {/* Status */}
                <div className="col-span-2">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                      table.STATUS === 'AVAILABLE'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : table.STATUS === 'OCCUPIED'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : table.STATUS === 'RESERVED'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}
                  >
                    {table.STATUS}
                  </span>
                </div>

                {/* Capacity */}
                <div className="col-span-2 flex items-center gap-1.5">
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={table.GUEST_CAPACITY}
                    onChange={(e) =>
                      onUpdateSeatCount(
                        table.TABLE_NUM,
                        Math.max(1, parseInt(e.target.value, 10) || 1),
                      )
                    }
                    className="w-14 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-[#14274E]"
                  />
                  <span className="text-[11px] font-bold text-slate-400">Pax</span>
                </div>

                {/* Priority Label */}
                <div className="col-span-2">
                  <LabelSelector
                    tableId={table.TABLE_ID ?? table.TABLE_NUM}
                    currentLabelId={table.LABEL_ID ?? null}
                    onLabelChanged={(newLabelId: number | null) =>
                      onLabelAssigned(table.TABLE_NUM, newLabelId)
                    }
                  />
                </div>

                {/* Actions */}
                <div className="col-span-1 flex items-center justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => onOpenQrModal(table)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                    title="View QR Code"
                  >
                    <QrCode className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteTable(table.TABLE_NUM)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    title="Delete Table"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Add Table Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden p-6 space-y-4">
            <h3 className="text-sm font-black text-[#14274E]">Add New Table</h3>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Select Table Type
              </label>
              <div className="space-y-2">
                {([1, 2, 3, 4, 5] as TableType[]).map((tType) => {
                  const cfg = TABLE_TYPES[tType]
                  return (
                    <button
                      key={tType}
                      type="button"
                      onClick={() => setNewTableType(tType)}
                      className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        newTableType === tType
                          ? 'border-[#14274E] bg-slate-50 ring-2 ring-[#14274E]/10'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <TableShapeIcon tableType={tType} className="w-5 h-5 text-slate-700" />
                        <div>
                          <p className="text-xs font-bold text-slate-800">{cfg.name}</p>
                          <p className="text-[10px] text-slate-400">
                            {cfg.width}x{cfg.height} units • {cfg.defaultCapacity} seats
                          </p>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onAddTable(newTableType)
                  setShowAddModal(false)
                }}
                className="px-4 py-2 text-xs font-black text-white bg-[#14274E] hover:bg-[#0f1f40] rounded-xl shadow-xs cursor-pointer"
              >
                Add Table
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
