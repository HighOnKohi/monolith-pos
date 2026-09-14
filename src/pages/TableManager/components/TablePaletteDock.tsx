import React, { memo } from 'react'
import { TABLE_TYPES, type TableType } from '@/services/tableLayoutService'
import { Plus } from 'lucide-react'

interface TablePaletteDockProps {
  onAddTable: (type: TableType) => void
  disabled?: boolean
}

export const TablePaletteDock: React.FC<TablePaletteDockProps> = memo(({
  onAddTable,
  disabled = false,
}) => {
  const tableTypes: TableType[] = [1, 2, 3, 4]

  return (
    <aside className="w-84 sm:w-96 bg-white border-l border-slate-200/90 flex flex-col p-5 shadow-sm select-none shrink-0 z-10">
      <div className="mb-4">
        <h3 className="text-xs font-black text-[#14274E] uppercase tracking-wider">
          Add Tables
        </h3>
        <p className="text-[11px] text-slate-400 font-medium mt-0.5">
          Click to spawn a table onto the floor plan
        </p>
      </div>

      <div className="flex flex-col gap-3 overflow-y-auto pr-1">
        {tableTypes.map((typeKey) => {
          const cfg = TABLE_TYPES[typeKey]
          return (
            <button
              key={typeKey}
              type="button"
              disabled={disabled}
              onClick={() => onAddTable(typeKey)}
              className="group relative flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-[#14274E]/40 hover:shadow-md transition-all text-left cursor-pointer active:scale-[0.98]"
            >
              <div className="flex items-center gap-3.5">
                {/* Visual miniature icon */}
                <div className="w-11 h-11 rounded-xl bg-[#2D3239] flex items-center justify-center shrink-0 shadow-inner group-hover:bg-[#14274E] transition-colors">
                  {typeKey === 1 && (
                    <div className="w-5 h-5 rounded-xs bg-slate-200 border border-slate-400 shadow-xs" />
                  )}
                  {typeKey === 2 && (
                    <div className="w-8 h-4 rounded-full bg-slate-200 border border-slate-400 shadow-xs" />
                  )}
                  {typeKey === 3 && (
                    <div className="w-5 h-5 rounded-full bg-slate-200 border border-slate-400 shadow-xs" />
                  )}
                  {typeKey === 4 && (
                    <div className="w-7 h-7 rounded-full bg-slate-200 border-2 border-slate-400 shadow-xs" />
                  )}
                </div>

                <div>
                  <h4 className="text-xs font-black text-[#14274E] group-hover:text-blue-900 leading-tight">
                    {cfg.name}
                  </h4>
                  <p className="text-[11px] font-bold text-slate-400 mt-0.5">
                    {cfg.description}
                  </p>
                </div>
              </div>

              <div className="w-7 h-7 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 group-hover:text-[#14274E] group-hover:border-[#14274E] group-hover:bg-slate-100 transition-all shrink-0">
                <Plus className="w-4 h-4" />
              </div>
            </button>
          )
        })}
      </div>

      <div className="mt-auto pt-4 border-t border-slate-100 text-[11px] text-slate-400 leading-relaxed font-medium">
        <p className="font-bold text-slate-600 mb-1">💡 Merging Tip</p>
        Drag a table right next to another table to automatically connect them into a merge group.
      </div>
    </aside>
  )
})

TablePaletteDock.displayName = 'TablePaletteDock'
