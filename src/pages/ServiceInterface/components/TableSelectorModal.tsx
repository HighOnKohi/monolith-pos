import React, { useMemo } from 'react'
import { X, Users, CheckCircle2, AlertCircle, Receipt, Utensils, GitMerge } from 'lucide-react'
import { resolveTableGroupByList } from '@/services/tableGroupService'
import type { TableData } from '@/services/tableService'

export interface TableItem {
  TABLE_ID: number
  TABLE_NUM: number
  STATUS: 'AVAILABLE' | 'RESERVED' | 'OCCUPIED' | 'HAS_REQUEST' | string
  GUEST_CAPACITY: number
  CURRENT_GUEST_COUNT: number
  BILL_OUT_REQUESTED: boolean
  MERGE_GROUP_ID?: number | null
}

interface TableSelectorModalProps {
  isOpen: boolean
  tables: TableItem[]
  selectedTableId: number
  onSelectTable: (tableId: number) => void
  onClose: () => void
}

export const TableSelectorModal: React.FC<TableSelectorModalProps> = ({
  isOpen,
  tables,
  selectedTableId,
  onSelectTable,
  onClose,
}) => {
  // Separate tables into merge groups (placed first) and standalone tables
  const { mergedGroups, standaloneTables } = useMemo(() => {
    const tableDataList = tables as unknown as TableData[]
    const processedIds = new Set<number>()
    const merged: Array<{
      groupId: number
      anchorTableNum: number
      tables: TableItem[]
    }> = []
    const standalone: TableItem[] = []

    for (const table of tables) {
      if (processedIds.has(table.TABLE_ID)) continue

      const grp = resolveTableGroupByList(table.TABLE_ID, tableDataList)
      if (grp.isMerged) {
        const memberTables = tables
          .filter((t) => grp.memberTableIds.includes(t.TABLE_ID))
          .sort((a, b) => (a.TABLE_NUM || a.TABLE_ID) - (b.TABLE_NUM || b.TABLE_ID))

        memberTables.forEach((t) => processedIds.add(t.TABLE_ID))

        merged.push({
          groupId: grp.anchorTableId,
          anchorTableNum: grp.anchorTableNum,
          tables: memberTables,
        })
      } else {
        processedIds.add(table.TABLE_ID)
        standalone.push(table)
      }
    }

    // Sort merge groups by their anchor table number ascending
    merged.sort((a, b) => a.anchorTableNum - b.anchorTableNum)

    // Sort standalone tables by table number ascending
    standalone.sort((a, b) => (a.TABLE_NUM || a.TABLE_ID) - (b.TABLE_NUM || b.TABLE_ID))

    return { mergedGroups: merged, standaloneTables: standalone }
  }, [tables])

  if (!isOpen) return null

  const renderTableCard = (table: TableItem) => {
    const isSelected = table.TABLE_ID === selectedTableId
    const isHasRequest = table.STATUS === 'HAS_REQUEST'
    const isBillOut = Boolean(table.BILL_OUT_REQUESTED)
    const isOccupied = table.STATUS === 'OCCUPIED' || (table.CURRENT_GUEST_COUNT || 0) > 0

    let statusColor = 'bg-emerald-50 text-emerald-700 border-emerald-200'
    let statusLabel = 'Available'

    if (isHasRequest) {
      statusColor = 'bg-rose-100 text-rose-700 border-rose-300 animate-pulse'
      statusLabel = 'Has Call'
    } else if (isBillOut) {
      statusColor = 'bg-amber-100 text-amber-800 border-amber-300'
      statusLabel = 'Bill Requested'
    } else if (isOccupied) {
      statusColor = 'bg-blue-50 text-blue-700 border-blue-200'
      statusLabel = 'Occupied'
    } else if (table.STATUS === 'RESERVED') {
      statusColor = 'bg-purple-50 text-purple-700 border-purple-200'
      statusLabel = 'Reserved'
    } else if (table.STATUS === 'UNAVAILABLE') {
      statusColor = 'bg-slate-100 text-slate-500 border-slate-200'
      statusLabel = 'Unavailable'
    }

    return (
      <div
        key={table.TABLE_ID}
        onClick={() => {
          onSelectTable(table.TABLE_ID)
          onClose()
        }}
        className={[
          'p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between select-none relative bg-white',
          isSelected
            ? 'border-[#14274E] bg-slate-50/80 shadow-md ring-2 ring-[#14274E]/20'
            : 'border-slate-200/80 hover:border-slate-400 hover:shadow-xs',
        ].join(' ')}
      >
        {/* Indicator dot */}
        {isBillOut && (
          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-500"></span>
          </span>
        )}

        <div>
          <div className="flex items-start justify-between mb-1.5 gap-1">
            <span className="text-sm font-black text-[#14274E] block truncate">
              Table #{table.TABLE_NUM || table.TABLE_ID}
            </span>
            {isSelected && (
              <CheckCircle2 className="w-4 h-4 text-[#14274E] shrink-0 mt-0.5" />
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-2">
            <Users className="w-3.5 h-3.5 shrink-0" />
            <span>
              {table.CURRENT_GUEST_COUNT || 0} / {table.GUEST_CAPACITY || 4}
            </span>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
          <span
            className={[
              'text-[10px] font-bold px-2 py-0.5 rounded-full border',
              statusColor,
            ].join(' ')}
          >
            {statusLabel}
          </span>
          {isBillOut && <Receipt className="w-3.5 h-3.5 text-amber-600" />}
          {isHasRequest && <AlertCircle className="w-3.5 h-3.5 text-rose-600" />}
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-xs animate-fade-in">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div>
            <h3 className="text-base font-black text-[#14274E] flex items-center gap-2">
              <Utensils className="w-5 h-5 text-[#14274E]" />
              Select Table
            </h3>
            <p className="text-xs text-slate-500">
              Pick an active table or table group to view shared bills and punch orders
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tables Hierarchy */}
        <div className="p-6 overflow-y-auto flex flex-col gap-4">
          {/* 1. Merge Groups appear FIRST */}
          {mergedGroups.map((group) => (
            <fieldset
              key={`modal-group-${group.groupId}`}
              className="border-2 border-dashed border-indigo-300/80 rounded-2xl p-3.5 pt-2 bg-indigo-50/20"
            >
              <legend className="px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-indigo-700 bg-white border border-dashed border-indigo-300 rounded-full inline-flex items-center gap-1.5 ml-2 shadow-2xs select-none">
                <GitMerge className="w-3 h-3 text-indigo-600 shrink-0" />
                <span>Table Group</span>
              </legend>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5 mt-1">
                {group.tables.map(renderTableCard)}
              </div>
            </fieldset>
          ))}

          {/* 2. Standalone Tables Grid */}
          {standaloneTables.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
              {standaloneTables.map(renderTableCard)}
            </div>
          )}

          {mergedGroups.length === 0 && standaloneTables.length === 0 && (
            <div className="p-8 text-center text-slate-400 text-xs font-bold">
              No tables available.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>
            {tables.length} table{tables.length !== 1 ? 's' : ''}
            {mergedGroups.length > 0 && ` (${mergedGroups.length} table group${mergedGroups.length !== 1 ? 's' : ''})`}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
