import React from 'react'
import { X, Users, CheckCircle2, AlertCircle, Receipt, Utensils } from 'lucide-react'

export interface TableItem {
  TABLE_ID: number
  TABLE_NUM: number
  STATUS: 'AVAILABLE' | 'RESERVED' | 'OCCUPIED' | 'HAS_REQUEST' | string
  GUEST_CAPACITY: number
  CURRENT_GUEST_COUNT: number
  BILL_OUT_REQUESTED: boolean
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
  if (!isOpen) return null

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
              Pick a dining table to view active bills, punch orders, or check status
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tables Grid */}
        <div className="p-6 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
          {tables.map((table) => {
            const isSelected = table.TABLE_ID === selectedTableId
            const isHasRequest = table.STATUS === 'HAS_REQUEST'
            const isBillOut = table.BILL_OUT_REQUESTED
            const isOccupied = table.STATUS === 'OCCUPIED'

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
            }

            return (
              <div
                key={table.TABLE_ID}
                onClick={() => {
                  onSelectTable(table.TABLE_ID)
                  onClose()
                }}
                className={[
                  'p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between select-none relative',
                  isSelected
                    ? 'border-[#14274E] bg-slate-50/70 shadow-md ring-2 ring-[#14274E]/20'
                    : 'border-slate-100 bg-white hover:border-slate-300 hover:shadow-xs',
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
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-base font-black text-[#14274E]">
                      Table {table.TABLE_NUM || table.TABLE_ID}
                    </span>
                    {isSelected && (
                      <CheckCircle2 className="w-4 h-4 text-[#14274E]" />
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-2">
                    <Users className="w-3.5 h-3.5" />
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
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>{tables.length} dining tables active</span>
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
