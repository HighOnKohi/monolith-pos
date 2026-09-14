import React from 'react'
import {
  X,
  Trash2,
  Unlink,
  Users,
  Hash,
  GitMerge,
  QrCode,
} from 'lucide-react'
import type { MergedTableNode } from '@/services/tableLayoutService'
import { TABLE_TYPES } from '@/services/tableLayoutService'

interface TableQuickInspectorProps {
  table: MergedTableNode
  onClose: () => void
  isEditMode: boolean
  onUpdateTableNum?: (tableNum: number) => void
  onUnmerge?: () => void
  onDelete?: () => void
  onOpenQr?: (table: MergedTableNode) => void
}

export const TableQuickInspector: React.FC<TableQuickInspectorProps> = ({
  table,
  onClose,
  isEditMode,
  onUpdateTableNum,
  onUnmerge,
  onDelete,
  onOpenQr,
}) => {
  const typeConfig = TABLE_TYPES[table.TABLE_TYPE] || TABLE_TYPES[1]

  return (
    <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-30 bg-white border border-slate-200/90 rounded-2xl shadow-2xl p-4 flex items-center gap-4 sm:gap-6 animate-in slide-in-from-bottom-3 duration-200 select-none">
      {/* Table Badge */}
      <div className="flex items-center gap-3 pr-2 border-r border-slate-100">
        <div className="w-10 h-10 rounded-xl bg-[#14274E] text-white flex flex-col items-center justify-center font-black shadow-inner">
          <span className="text-[10px] text-slate-300 font-bold leading-none">TBL</span>
          <span className="text-sm leading-none">{table.TABLE_NUM}</span>
        </div>
        <div>
          <h4 className="text-xs font-black text-[#14274E]">
            {typeConfig.name}
          </h4>
          <p className="text-[10px] font-bold text-slate-400">
            {typeConfig.width}x{typeConfig.height} ({typeConfig.defaultCapacity} Seats)
          </p>
        </div>
      </div>

      {/* Edit Mode: Number and Merge controls */}
      {isEditMode ? (
        <div className="flex items-center gap-3">
          {/* Table Number Input */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200">
            <Hash className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs font-bold text-slate-500">Num:</span>
            <input
              type="number"
              min={1}
              max={999}
              value={table.TABLE_NUM}
              onChange={(e) => onUpdateTableNum && onUpdateTableNum(Math.max(1, Number(e.target.value)))}
              className="w-12 px-1 py-0.5 bg-white border border-slate-200 rounded-lg text-xs font-black text-slate-800 text-center"
            />
          </div>

          {/* Unmerge Button */}
          {table.MERGE_GROUP_ID != null && (
            <button
              type="button"
              onClick={onUnmerge}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold rounded-xl border border-amber-200 transition-colors cursor-pointer"
              title="Remove from Merge Group"
            >
              <Unlink className="w-3.5 h-3.5" />
              <span>Unmerge</span>
            </button>
          )}

          {/* QR Code Button */}
          {onOpenQr && (
            <button
              type="button"
              onClick={() => onOpenQr(table)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-colors cursor-pointer"
              title="View & Print Table QR Code"
            >
              <QrCode className="w-3.5 h-3.5 text-[#14274E]" />
              <span>QR</span>
            </button>
          )}

          {/* Delete Table Button */}
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl border border-rose-200 transition-colors cursor-pointer"
            title="Delete this table"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
          </button>
        </div>
      ) : (
        /* View Mode details */
        <div className="flex items-center gap-3 text-xs font-bold text-slate-600">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Status:</span>
            <span className="uppercase font-black text-slate-800">{table.STATUS || 'AVAILABLE'}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-slate-400" />
            <span>{table.CURRENT_GUEST_COUNT || 0} / {table.GUEST_CAPACITY || typeConfig.defaultCapacity} Pax</span>
          </div>

          {table.MERGE_GROUP_ID != null && (
            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md border border-indigo-200 text-[10px] flex items-center gap-1 font-extrabold">
              <GitMerge className="w-3 h-3 text-indigo-600" />
              <span>Merged Table</span>
            </span>
          )}

          {/* QR Code Button */}
          {onOpenQr && (
            <button
              type="button"
              onClick={() => onOpenQr(table)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 hover:bg-[#14274E] hover:text-white text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-colors cursor-pointer"
              title="View & Print Table QR Code"
            >
              <QrCode className="w-3.5 h-3.5 text-[#14274E] group-hover:text-white" />
              <span>Print QR</span>
            </button>
          )}
        </div>
      )}

      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer ml-2"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
