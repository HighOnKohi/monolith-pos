import React, { memo } from 'react'
import {
  TABLE_TYPES,
  type TableType,
  type MergedTableNode,
  type RestaurantTableData,
} from '@/services/tableLayoutService'
import { TableShapeIcon } from './TableVisual'
import {
  Users,
  Trash2,
  Unlink,
  CheckCircle2,
  Clock,
  Ban,
  ShieldCheck,
} from 'lucide-react'

interface TableManagerSidebarProps {
  isEditMode: boolean
  selectedTable: MergedTableNode | null
  remainingVenueCapacity?: number
  onUpdateTableNum: (oldNum: number, newNum: number) => void
  onChangeTableType: (tableNum: number, newType: TableType) => void
  onUpdateSeatCount: (tableNum: number, seats: number) => void
  onUpdateGuestCount: (tableNum: number, guests: number) => void
  onUpdateStatus: (tableNum: number, status: RestaurantTableData['STATUS']) => void
  onUnmergeTable: (tableNum: number) => void
  onDeleteTable: (tableNum: number) => void
}

export const TableManagerSidebar: React.FC<TableManagerSidebarProps> = memo(({
  isEditMode,
  selectedTable,
  remainingVenueCapacity = 50,
  onChangeTableType,
  onUpdateSeatCount,
  onUpdateGuestCount,
  onUpdateStatus,
  onUnmergeTable,
  onDeleteTable,
}) => {
  if (!selectedTable) {
    return (
      <aside className="table-manager-sidebar w-80 sm:w-84 shrink-0 h-full bg-white border-l border-slate-200 flex flex-col p-6 shadow-xs select-none z-20 overflow-y-auto">
        <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200/60 flex items-center justify-center mb-3 shadow-xs">
            <TableShapeIcon tableType={1} size={28} />
          </div>
          <h3 className="text-sm font-black text-[#14274E]">
            No Table Selected
          </h3>
          <p className="text-xs text-slate-400 font-medium mt-1.5 max-w-[220px] leading-relaxed">
            {isEditMode
              ? 'Click on any table on the floor plan to edit its shape or delete it.'
              : 'Click on any table to update its live status, guest count, or seat capacity.'}
          </p>

          <div className="mt-6 p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl text-left w-full">
            <div className="flex items-center gap-1.5 text-xs font-black text-[#14274E] mb-1">
              <ShieldCheck className="w-3.5 h-3.5 text-[#14274E] shrink-0" />
              <span>{isEditMode ? 'Layout Editor Active' : 'Floor Operations'}</span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
              {isEditMode
                ? 'Drag tables across the dynamic grid to reposition. Drag adjacent tables together to merge.'
                : 'Click any table to switch statuses between Available, Occupied, Reserved, or update seated guests.'}
            </p>
          </div>
        </div>
      </aside>
    )
  }

  const currentTypeConfig = TABLE_TYPES[selectedTable.TABLE_TYPE] || TABLE_TYPES[1]
  const originalMaxSeats = currentTypeConfig.defaultCapacity
  const maxSeatsAllowed = originalMaxSeats
  const currentSeatCapacity = Math.min(
    maxSeatsAllowed,
    Math.max(1, selectedTable.GUEST_CAPACITY || maxSeatsAllowed),
  )
  const currentGuestCount = Math.max(
    0,
    Math.min(currentSeatCapacity, selectedTable.CURRENT_GUEST_COUNT || 0),
  )
  const currentStatus = selectedTable.STATUS || 'AVAILABLE'

  const tableTypeOptions: TableType[] = [1, 2, 3, 4]

  const statusOptions: Array<{
    id: RestaurantTableData['STATUS']
    label: string
    icon: React.ReactNode
    activeClass: string
  }> = [
    {
      id: 'AVAILABLE',
      label: 'Available',
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      activeClass: 'bg-emerald-600 text-white border-emerald-600 shadow-xs',
    },
    {
      id: 'OCCUPIED',
      label: 'Occupied',
      icon: <Users className="w-3.5 h-3.5" />,
      activeClass: 'bg-blue-600 text-white border-blue-600 shadow-xs',
    },
    {
      id: 'RESERVED',
      label: 'Reserved',
      icon: <Clock className="w-3.5 h-3.5" />,
      activeClass: 'bg-amber-500 text-white border-amber-500 shadow-xs',
    },
    {
      id: 'UNAVAILABLE',
      label: 'Unavailable',
      icon: <Ban className="w-3.5 h-3.5" />,
      activeClass: 'bg-slate-700 text-white border-slate-700 shadow-xs',
    },
  ]

  return (
    <aside className="table-manager-sidebar w-80 sm:w-84 shrink-0 h-full bg-white border-l border-slate-200 flex flex-col p-5 shadow-xs select-none z-20 overflow-y-auto">
      {/* Header: Clean Table Info & Gold Shape Icon (Plain text number, no extra label, no input) */}
      <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-4">
        <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200/80 flex items-center justify-center shrink-0">
          <TableShapeIcon tableType={selectedTable.TABLE_TYPE} size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-black text-[#14274E] tracking-tight">
            Table #{selectedTable.TABLE_NUM}
          </h2>
          <span className="text-xs font-bold text-slate-400">
            {currentTypeConfig.name}
          </span>
        </div>
      </div>

      <div className="space-y-5 flex-1">
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* VIEW MODE (Outside Edit Mode): Status, Guests, Max Seat Capacity */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {!isEditMode && (
          <>
            {/* 1. Live Status Selection */}
            <div>
              <label className="block text-xs font-black text-[#14274E] mb-2">
                Table Status
              </label>
              <div className="grid grid-cols-2 gap-2">
                {statusOptions.map((opt) => {
                  const isCurrent = currentStatus === opt.id
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onUpdateStatus(selectedTable.TABLE_NUM, opt.id)}
                      className={`px-3 py-2 rounded-xl border text-xs font-black transition-all cursor-pointer flex items-center justify-between ${
                        isCurrent
                          ? opt.activeClass
                          : 'bg-slate-50/70 border-slate-200 hover:bg-white hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      <span>{opt.label}</span>
                      {opt.icon}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 2. Current Guest Count */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#14274E]" />
                  <span className="text-xs font-black text-[#14274E]">
                    Current Guests Seated
                  </span>
                </div>
                <span className="text-[11px] font-bold text-slate-400">
                  Cap: {currentSeatCapacity}
                </span>
              </div>

              <div className="flex items-center justify-between mt-3">
                <button
                  type="button"
                  disabled={currentGuestCount <= 0}
                  onClick={() =>
                    onUpdateGuestCount(
                      selectedTable.TABLE_NUM,
                      Math.max(0, currentGuestCount - 1),
                    )
                  }
                  className="w-9 h-9 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 flex items-center justify-center font-black text-slate-700 cursor-pointer text-base active:scale-95 transition-all shadow-2xs"
                >
                  -
                </button>

                <div className="flex flex-col items-center">
                  <span className="text-lg font-black text-[#14274E]">
                    {currentGuestCount}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 -mt-0.5">
                    {currentGuestCount === 1 ? 'Guest Seated' : 'Guests Seated'}
                  </span>
                </div>

                <button
                  type="button"
                  disabled={currentGuestCount >= currentSeatCapacity}
                  onClick={() =>
                    onUpdateGuestCount(
                      selectedTable.TABLE_NUM,
                      Math.min(currentSeatCapacity, currentGuestCount + 1),
                    )
                  }
                  className="w-9 h-9 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 flex items-center justify-center font-black text-slate-700 cursor-pointer text-base active:scale-95 transition-all shadow-2xs"
                >
                  +
                </button>
              </div>
            </div>

            {/* 3. Max Seat Capacity */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#14274E]" />
                  <span className="text-xs font-black text-[#14274E]">
                    Max Seat Capacity
                  </span>
                </div>
                <span className="text-[11px] font-bold text-slate-400">
                  Type Max: {originalMaxSeats}
                </span>
              </div>

              <div className="flex items-center justify-between mt-3">
                <button
                  type="button"
                  disabled={currentSeatCapacity <= 1}
                  onClick={() =>
                    onUpdateSeatCount(
                      selectedTable.TABLE_NUM,
                      Math.max(1, currentSeatCapacity - 1),
                    )
                  }
                  className="w-9 h-9 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 flex items-center justify-center font-black text-slate-700 cursor-pointer text-base active:scale-95 transition-all shadow-2xs"
                >
                  -
                </button>

                <div className="flex flex-col items-center">
                  <span className="text-lg font-black text-[#14274E]">
                    {currentSeatCapacity}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 -mt-0.5">
                    {currentSeatCapacity === 1 ? 'Seat Max' : 'Seats Max'}
                  </span>
                </div>

                <button
                  type="button"
                  disabled={currentSeatCapacity >= originalMaxSeats || remainingVenueCapacity <= 0}
                  onClick={() =>
                    onUpdateSeatCount(
                      selectedTable.TABLE_NUM,
                      Math.min(originalMaxSeats, currentSeatCapacity + 1),
                    )
                  }
                  className="w-9 h-9 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 flex items-center justify-center font-black text-slate-700 cursor-pointer text-base active:scale-95 transition-all shadow-2xs"
                  title={remainingVenueCapacity <= 0 ? 'Venue maximum capacity (50 seats) reached' : 'Increase seats'}
                >
                  +
                </button>
              </div>
            </div>
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* EDIT MODE: Table Type Shapes, Unmerge */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {isEditMode && (
          <div className="space-y-4">
            {/* 1. Change Table Type (Gold Shape Icons) */}
            <div>
              <label className="block text-xs font-black text-[#14274E] mb-2">
                Table Type / Shape
              </label>
              <div className="grid grid-cols-2 gap-2">
                {tableTypeOptions.map((typeKey) => {
                  const cfg = TABLE_TYPES[typeKey]
                  const isCurrent = typeKey === selectedTable.TABLE_TYPE

                  return (
                    <button
                      key={typeKey}
                      type="button"
                      onClick={() => onChangeTableType(selectedTable.TABLE_NUM, typeKey)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        isCurrent
                          ? 'bg-[#14274E] border-[#14274E] text-white shadow-xs'
                          : 'bg-slate-50/70 border-slate-200 hover:bg-white hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <TableShapeIcon tableType={typeKey} size={18} />
                        <span
                          className={`text-[10px] font-bold ${
                            isCurrent ? 'text-slate-300' : 'text-slate-400'
                          }`}
                        >
                          {cfg.width}×{cfg.height}
                        </span>
                      </div>
                      <div className="text-xs font-black leading-tight mt-1">
                        {cfg.name}
                      </div>
                      <div
                        className={`text-[10px] mt-0.5 ${
                          isCurrent ? 'text-slate-300' : 'text-slate-400'
                        }`}
                      >
                        Max {cfg.defaultCapacity} seats
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 2. Unmerge Table (if merged) */}
            {selectedTable.MERGE_GROUP_ID != null && (
              <button
                type="button"
                onClick={() => onUnmergeTable(selectedTable.TABLE_NUM)}
                className="w-full px-3 py-2.5 rounded-xl border border-indigo-200 bg-indigo-50/70 hover:bg-indigo-100/80 text-indigo-700 text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Unlink className="w-3.5 h-3.5" />
                <span>Unmerge Table {selectedTable.TABLE_NUM}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Footer: Delete Table (Fixed at the bottom in Edit Mode) ── */}
      {isEditMode && (
        <div className="mt-auto pt-4 border-t border-slate-200 shrink-0">
          <button
            type="button"
            onClick={() => onDeleteTable(selectedTable.TABLE_NUM)}
            className="w-full px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs active:scale-98"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Table {selectedTable.TABLE_NUM}</span>
          </button>
        </div>
      )}
    </aside>
  )
})

TableManagerSidebar.displayName = 'TableManagerSidebar'
