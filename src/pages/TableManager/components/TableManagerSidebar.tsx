import React, { memo, useState, useRef, useEffect } from 'react'
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
  GitMerge,
  QrCode,
  Copy,
  Check,
  ExternalLink,
  ChevronDown,
  Printer,
  FileDown,
  CheckSquare,
  Square,
  Layers,
} from 'lucide-react'
import { getTableQrUrl } from '@/components/table-qr/tableQrUtils'
import { getMergeGroupColor } from '@/utils/floorPlan/mergeGroupColors'

interface TableManagerSidebarProps {
  isEditMode: boolean
  isQrPrintMode?: boolean
  selectedTable: MergedTableNode | null
  allTables: MergedTableNode[]
  remainingVenueCapacity?: number
  maxVenueCapacity?: number
  onSelectTableNum: (tableNum: number) => void
  selectedForPrintTableNums?: Set<number>
  onTogglePrintSelectTable?: (tableNum: number) => void
  onToggleSelectAllPrint?: (selectAll: boolean) => void
  onDownloadQrPdf?: () => void
  isGeneratingPdf?: boolean
  onPrintSelectedQrs?: () => void
  isPrintingBulk?: boolean
  onUpdateTableNum?: (oldNum: number, newNum: number) => void
  onChangeTableType: (tableNum: number, newType: TableType) => void
  onUpdateSeatCount: (tableNum: number, seats: number) => void
  onUpdateGuestCount: (tableNum: number, guests: number) => void
  onUpdateStatus: (tableNum: number, status: RestaurantTableData['STATUS']) => void
  onUnmergeTable: (tableNum: number) => void
  isMergeGroupBlockedFromUnmerge?: boolean
  onDeleteTable: (tableNum: number) => void
  onOpenQrModal?: (table: MergedTableNode) => void
}

export const TableManagerSidebar: React.FC<TableManagerSidebarProps> = memo(({
  isEditMode,
  isQrPrintMode = false,
  selectedTable,
  allTables = [],
  remainingVenueCapacity = 50,
  maxVenueCapacity = 50,
  onSelectTableNum,
  selectedForPrintTableNums = new Set(),
  onTogglePrintSelectTable,
  onToggleSelectAllPrint,
  onDownloadQrPdf,
  isGeneratingPdf = false,
  onPrintSelectedQrs,
  isPrintingBulk = false,
  onChangeTableType,
  onUpdateSeatCount,
  onUpdateGuestCount,
  onUpdateStatus,
  onUnmergeTable,
  isMergeGroupBlockedFromUnmerge = false,
  onDeleteTable,
  onOpenQrModal,
}) => {
  const [copied, setCopied] = useState(false)
  const [isTableDropdownOpen, setIsTableDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close table selector dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsTableDropdownOpen(false)
      }
    }
    if (isTableDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isTableDropdownOpen])

  const handleCopyUrl = async () => {
    if (!selectedTable) return
    const tableId = selectedTable.TABLE_ID ?? selectedTable.TABLE_NUM
    const url = getTableQrUrl(tableId)
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const input = document.createElement('input')
      input.value = url
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const sortedTables = [...allTables].sort((a, b) => a.TABLE_NUM - b.TABLE_NUM)
  const allPrintSelected = sortedTables.length > 0 && selectedForPrintTableNums.size === sortedTables.length

  // ═══════════════════════════════════════════════════════════════════════════
  // MODE A: QR PRINT MODE (Table Card Grid, Selection Toggles, PDF Download)
  // ═══════════════════════════════════════════════════════════════════════════
  if (isQrPrintMode) {
    return (
      <aside className="table-manager-sidebar w-80 sm:w-88 shrink-0 h-full bg-white border-l border-slate-200 flex flex-col shadow-xs select-none z-20 overflow-hidden">
        {/* QR Print Header */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/70 shrink-0">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-[#14274E] text-[#E9C46A]">
                <Printer className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-black text-[#14274E] uppercase tracking-wider">
                  QR Batch Print
                </h3>
                <p className="text-[11px] font-bold text-slate-500">
                  {selectedForPrintTableNums.size} of {sortedTables.length} tables selected
                </p>
              </div>
            </div>

            {/* Download PDF button moved to sidebar */}
            {onDownloadQrPdf && (
              <button
                type="button"
                disabled={selectedForPrintTableNums.size === 0 || isGeneratingPdf}
                onClick={onDownloadQrPdf}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-slate-100 disabled:opacity-40 text-[#14274E] border border-slate-300 rounded-xl text-xs font-bold shadow-2xs transition-transform active:scale-95 cursor-pointer disabled:cursor-not-allowed"
                title="Download A4 PDF of selected table QR codes"
              >
                <FileDown className="w-3.5 h-3.5 text-[#14274E]" />
                <span className="text-[11px] font-black">{isGeneratingPdf ? 'Generating...' : 'Download PDF'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Table Card Grid */}
        <div className="flex-1 overflow-y-auto p-3.5">
          {sortedTables.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 font-semibold">
              No tables available on this layout.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              {sortedTables.map((t) => {
                const isSelected = selectedForPrintTableNums.has(t.TABLE_NUM)
                const typeCfg = TABLE_TYPES[t.TABLE_TYPE] || TABLE_TYPES[1]
                const capacity = t.GUEST_CAPACITY ?? typeCfg.defaultCapacity

                return (
                  <div
                    key={t.TABLE_NUM}
                    onClick={() => onTogglePrintSelectTable && onTogglePrintSelectTable(t.TABLE_NUM)}
                    className={`relative p-3 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-white border-[#14274E] ring-2 ring-[#14274E]/20 shadow-xs'
                        : 'bg-slate-50/70 border-slate-200 opacity-60 hover:opacity-90 hover:bg-white'
                    }`}
                  >
                    {/* Checkbox at top-right */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-200/80 flex items-center justify-center">
                        <TableShapeIcon tableType={t.TABLE_TYPE} size={15} />
                      </div>

                      <div
                        className={`w-5 h-5 rounded-md flex items-center justify-center transition-all ${
                          isSelected
                            ? 'bg-[#14274E] text-[#E9C46A] shadow-2xs'
                            : 'bg-white border-2 border-slate-300 text-transparent'
                        }`}
                      >
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    </div>

                    {/* Table Number & Info */}
                    <div>
                      <div className="text-xs font-black text-[#14274E]">
                        Table #{t.TABLE_NUM}
                      </div>
                      <div className="text-[10px] font-bold text-slate-400 mt-0.5 flex items-center gap-1">
                        <Users className="w-2.5 h-2.5" />
                        <span>{capacity} Seats</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer: Select All / Deselect All & Print Button */}
        <div className="p-3.5 border-t border-slate-200 bg-slate-50/90 flex flex-col gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onToggleSelectAllPrint && onToggleSelectAllPrint(!allPrintSelected)}
            className="w-full py-2 px-3 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
          >
            {allPrintSelected ? (
              <>
                <Square className="w-3.5 h-3.5 text-slate-500" />
                <span>Deselect All</span>
              </>
            ) : (
              <>
                <CheckSquare className="w-3.5 h-3.5 text-[#14274E]" />
                <span>Select All ({sortedTables.length})</span>
              </>
            )}
          </button>

          {onPrintSelectedQrs && (
            <button
              type="button"
              disabled={selectedForPrintTableNums.size === 0 || isPrintingBulk}
              onClick={onPrintSelectedQrs}
              className="w-full py-2.5 px-3 rounded-xl bg-[#14274E] hover:bg-[#0f1f40] disabled:opacity-40 text-white text-xs font-black transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer active:scale-98 disabled:cursor-not-allowed"
            >
              <Printer className="w-3.5 h-3.5 text-[#E9C46A]" />
              <span>
                {isPrintingBulk
                  ? 'Preparing Print...'
                  : `Print ${selectedForPrintTableNums.size} Selected QR${selectedForPrintTableNums.size === 1 ? '' : 's'}`}
              </span>
            </button>
          )}
        </div>
      </aside>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MODE B & C: VIEW / EDIT MODE
  // ═══════════════════════════════════════════════════════════════════════════

  const currentTypeConfig = selectedTable ? (TABLE_TYPES[selectedTable.TABLE_TYPE] || TABLE_TYPES[1]) : null
  const originalMaxSeats = currentTypeConfig ? currentTypeConfig.defaultCapacity : 4
  const maxSeatsAllowed = originalMaxSeats

  // In Edit Mode: base unsuppressed capacity configured for the table
  const configuredBaseCapacity = selectedTable
    ? Math.min(maxSeatsAllowed, Math.max(1, selectedTable.TABLE_CAPACITY ?? selectedTable.GUEST_CAPACITY ?? maxSeatsAllowed))
    : 4

  // In View Mode: effective capacity respecting suppressed adjacent chairs (e.g. 4 for big circle table)
  const effectiveSeatCapacity = selectedTable
    ? (selectedTable.GUEST_CAPACITY ?? selectedTable.TABLE_CAPACITY ?? maxSeatsAllowed)
    : 4

  const currentGuestCount = selectedTable
    ? Math.max(0, Math.min(effectiveSeatCapacity, selectedTable.CURRENT_GUEST_COUNT || 0))
    : 0
  const currentStatus = selectedTable?.STATUS || 'AVAILABLE'

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
    <aside className="table-manager-sidebar w-80 sm:w-84 shrink-0 h-full bg-white border-l border-slate-200 flex flex-col shadow-xs select-none z-20 overflow-hidden">
      {/* ── View Mode Header: Table Selector Dropdown & Table Counter ── */}
      {!isEditMode && (
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
          <div className="flex items-center justify-between gap-2.5">
            {/* Table Selector Dropdown */}
            <div className="relative flex-1" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setIsTableDropdownOpen((prev) => !prev)}
                className="w-full px-3 py-2 bg-white border border-slate-300 hover:border-slate-400 rounded-xl text-xs font-black text-[#14274E] flex items-center justify-between gap-2 shadow-2xs cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2 truncate">
                  <div className="w-5 h-5 rounded-md bg-amber-50 border border-amber-200/80 flex items-center justify-center shrink-0">
                    {selectedTable ? (
                      <TableShapeIcon tableType={selectedTable.TABLE_TYPE} size={13} />
                    ) : (
                      <Layers className="w-3 h-3 text-amber-600" />
                    )}
                  </div>
                  <span className="truncate">
                    {selectedTable ? `Table #${selectedTable.TABLE_NUM}` : 'Select a Table...'}
                  </span>
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-200 ${
                    isTableDropdownOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {/* Dropdown Menu */}
              {isTableDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 w-full z-50 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in duration-100 max-h-56 overflow-y-auto divide-y divide-slate-100">
                  {sortedTables.length === 0 ? (
                    <div className="p-3 text-xs text-slate-400 font-semibold text-center">
                      No tables on floor plan
                    </div>
                  ) : (
                    sortedTables.map((t) => {
                      const isSelected = selectedTable?.TABLE_NUM === t.TABLE_NUM
                      const cap = t.GUEST_CAPACITY ?? (TABLE_TYPES[t.TABLE_TYPE]?.defaultCapacity || 4)
                      return (
                        <button
                          key={t.TABLE_NUM}
                          type="button"
                          onClick={() => {
                            onSelectTableNum(t.TABLE_NUM)
                            setIsTableDropdownOpen(false)
                          }}
                          className={`w-full px-3 py-2 text-left text-xs font-bold flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-[#14274E] text-white'
                              : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <div className="w-6 h-5 flex items-center justify-center shrink-0">
                              <TableShapeIcon tableType={t.TABLE_TYPE} size={14} />
                            </div>
                            <span className="font-extrabold">Table #{t.TABLE_NUM}</span>
                          </div>
                          <div
                            className={`flex items-center gap-1 text-[11px] font-bold ${
                              isSelected ? 'text-slate-200' : 'text-slate-500'
                            }`}
                          >
                            <Users className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{cap}</span>
                          </div>
                        </button>
                      )
                    })
                  )}
                </div>
              )}
            </div>

            {/* Total Tables Counter Badge */}
            <div className="px-2.5 py-2 rounded-xl bg-white border border-slate-300 text-xs font-bold text-[#14274E] shadow-2xs shrink-0 flex items-center gap-1.5">
              <span className="font-semibold text-slate-400">Total:</span>
              <span className="font-black text-[#14274E]">{sortedTables.length}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Main Content Area ── */}
      {!selectedTable ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 overflow-y-auto">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200/60 flex items-center justify-center mb-3 shadow-xs">
            <TableShapeIcon tableType={1} size={28} />
          </div>
          <h3 className="text-sm font-black text-[#14274E]">
            No Table Selected
          </h3>
          <p className="text-xs text-slate-400 font-medium mt-1.5 max-w-[220px] leading-relaxed">
            {isEditMode
              ? 'Click on any table on the floor plan to edit its shape, capacity, position, or delete it.'
              : 'Select a table from the header dropdown above or click on any table on the layout.'}
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
      ) : (
        <div className="flex-1 overflow-y-auto p-5 flex flex-col">
          {/* Header Info when table is selected */}
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200/80 flex items-center justify-center shrink-0">
              <TableShapeIcon tableType={selectedTable.TABLE_TYPE} size={22} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-[#14274E] tracking-tight">
                  Table #{selectedTable.TABLE_NUM}
                </h2>
                {selectedTable.MERGE_GROUP_ID != null && (() => {
                  const theme = getMergeGroupColor(selectedTable.MERGE_GROUP_ID)
                  return (
                    <span
                      className="px-2 py-0.5 rounded-md border inline-flex items-center gap-1 text-[10px] font-black shadow-2xs"
                      style={{
                        backgroundColor: theme.lightBg,
                        borderColor: theme.border,
                        color: theme.text,
                      }}
                      title={`Merge Group #${selectedTable.MERGE_GROUP_ID}`}
                    >
                      <GitMerge className="w-3 h-3" style={{ color: theme.primary }} />
                      <span>Group #{selectedTable.MERGE_GROUP_ID}</span>
                    </span>
                  )
                })()}
              </div>
              <span className="text-xs font-bold text-slate-400">
                {currentTypeConfig?.name}
              </span>
            </div>
          </div>

          <div className="space-y-5 flex-1">
            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* VIEW MODE: Status, Guests */}
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
                      Cap: {effectiveSeatCapacity}
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
                      disabled={currentGuestCount >= effectiveSeatCapacity}
                      onClick={() =>
                        onUpdateGuestCount(
                          selectedTable.TABLE_NUM,
                          Math.min(effectiveSeatCapacity, currentGuestCount + 1),
                        )
                      }
                      className="w-9 h-9 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 flex items-center justify-center font-black text-slate-700 cursor-pointer text-base active:scale-95 transition-all shadow-2xs"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* 3. Unmerge Table in View Mode (if merged) */}
                {selectedTable.MERGE_GROUP_ID != null && (() => {
                  const theme = getMergeGroupColor(selectedTable.MERGE_GROUP_ID)
                  return (
                    <div className="space-y-1">
                      <button
                        type="button"
                        disabled={isMergeGroupBlockedFromUnmerge}
                        onClick={() => onUnmergeTable(selectedTable.TABLE_NUM)}
                        className={`w-full px-3 py-2.5 rounded-xl border text-xs font-black transition-all flex items-center justify-center gap-2 shadow-2xs ${
                          isMergeGroupBlockedFromUnmerge
                            ? 'opacity-50 cursor-not-allowed'
                            : 'cursor-pointer active:scale-98'
                        }`}
                        style={{
                          backgroundColor: theme.lightBg,
                          borderColor: theme.border,
                          color: theme.text,
                        }}
                        title={
                          isMergeGroupBlockedFromUnmerge
                            ? 'Cannot unmerge: active orders exist on this merge group'
                            : `Unmerge Table ${selectedTable.TABLE_NUM}`
                        }
                      >
                        <Unlink className="w-3.5 h-3.5" style={{ color: theme.primary }} />
                        <span>Unmerge Table {selectedTable.TABLE_NUM} (Group #{selectedTable.MERGE_GROUP_ID})</span>
                      </button>
                      {isMergeGroupBlockedFromUnmerge && (
                        <p className="text-[10px] font-bold text-amber-600 text-center">
                          Active order on merge group. Settle order to unmerge.
                        </p>
                      )}
                    </div>
                  )
                })()}
              </>
            )}

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* EDIT MODE: Table Type Shapes, Max Seat Capacity, Unmerge */}
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

                {/* 2. Max Seat Capacity Editor (Moved to Edit Mode) */}
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
                      disabled={configuredBaseCapacity <= 1}
                      onClick={() =>
                        onUpdateSeatCount(
                          selectedTable.TABLE_NUM,
                          Math.max(1, configuredBaseCapacity - 1),
                        )
                      }
                      className="w-9 h-9 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 flex items-center justify-center font-black text-slate-700 cursor-pointer text-base active:scale-95 transition-all shadow-2xs"
                    >
                      -
                    </button>

                    <div className="flex flex-col items-center">
                      <span className="text-lg font-black text-[#14274E]">
                        {configuredBaseCapacity}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 -mt-0.5">
                        {configuredBaseCapacity === 1 ? 'Seat Max' : 'Seats Max'}
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={configuredBaseCapacity >= originalMaxSeats || remainingVenueCapacity <= 0}
                      onClick={() =>
                        onUpdateSeatCount(
                          selectedTable.TABLE_NUM,
                          Math.min(originalMaxSeats, configuredBaseCapacity + 1),
                        )
                      }
                      className="w-9 h-9 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 flex items-center justify-center font-black text-slate-700 cursor-pointer text-base active:scale-95 transition-all shadow-2xs"
                      title={remainingVenueCapacity <= 0 ? `Maximum venue capacity (${maxVenueCapacity} seats) reached` : 'Increase seats'}
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* 3. Unmerge Table (if merged) */}
                {selectedTable.MERGE_GROUP_ID != null && (() => {
                  const theme = getMergeGroupColor(selectedTable.MERGE_GROUP_ID)
                  return (
                    <div className="space-y-1">
                      <button
                        type="button"
                        disabled={isMergeGroupBlockedFromUnmerge}
                        onClick={() => onUnmergeTable(selectedTable.TABLE_NUM)}
                        className={`w-full px-3 py-2.5 rounded-xl border text-xs font-black transition-all flex items-center justify-center gap-2 shadow-2xs ${
                          isMergeGroupBlockedFromUnmerge
                            ? 'opacity-50 cursor-not-allowed'
                            : 'cursor-pointer active:scale-98'
                        }`}
                        style={{
                          backgroundColor: theme.lightBg,
                          borderColor: theme.border,
                          color: theme.text,
                        }}
                        title={
                          isMergeGroupBlockedFromUnmerge
                            ? 'Cannot unmerge: active orders exist on this merge group'
                            : `Unmerge Table ${selectedTable.TABLE_NUM}`
                        }
                      >
                        <Unlink className="w-3.5 h-3.5" style={{ color: theme.primary }} />
                        <span>Unmerge Table {selectedTable.TABLE_NUM} (Group #{selectedTable.MERGE_GROUP_ID})</span>
                      </button>
                      {isMergeGroupBlockedFromUnmerge && (
                        <p className="text-[10px] font-bold text-amber-600 text-center">
                          Active order on merge group. Settle order to unmerge.
                        </p>
                      )}
                    </div>
                  )
                })()}
              </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* Table QR Code & Customer Ordering (Visible in both View & Edit)  */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            {(() => {
              const tableId = selectedTable.TABLE_ID ?? selectedTable.TABLE_NUM
              const qrUrl = getTableQrUrl(tableId)
              return (
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <QrCode className="w-4 h-4 text-[#14274E]" />
                      <span className="text-xs font-black text-[#14274E] uppercase tracking-wider">
                        Table QR & Ordering
                      </span>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-slate-400">
                      ID: #{tableId}
                    </span>
                  </div>

                  {/* Prominent View / Print QR Code button */}
                  <button
                    type="button"
                    onClick={() => onOpenQrModal && onOpenQrModal(selectedTable)}
                    className="w-full py-2.5 px-3 rounded-xl bg-[#14274E] hover:bg-[#0f1f40] text-white text-xs font-black flex items-center justify-center gap-2 shadow-xs transition-transform active:scale-98 cursor-pointer"
                  >
                    <QrCode className="w-4 h-4 text-[#E9C46A]" />
                    <span>View / Print Table {selectedTable.TABLE_NUM} QR</span>
                  </button>

                  {/* Canonical QR URL with copy button */}
                  <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200 text-xs">
                    <span
                      className="text-[11px] font-mono text-slate-600 truncate max-w-[170px]"
                      title={qrUrl}
                    >
                      {qrUrl}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyUrl}
                      className="p-1 text-xs text-slate-500 hover:text-[#14274E] rounded-md transition-colors flex items-center gap-1 font-bold cursor-pointer"
                      title="Copy canonical table QR URL"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700 text-[10px]">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span className="text-[10px]">Copy</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* External customer link */}
                  <a
                    href={qrUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-2 px-3 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                    <span>Test Customer View</span>
                  </a>
                </div>
              )
            })()}
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
        </div>
      )}
    </aside>
  )
})

TableManagerSidebar.displayName = 'TableManagerSidebar'

