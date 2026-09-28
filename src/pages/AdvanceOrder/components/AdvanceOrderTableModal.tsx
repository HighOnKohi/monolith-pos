import { useState, useEffect } from 'react'
import { Utensils, X, Users, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react'
import { fetchAllTables, type TableData } from '@/services/tableService'
import { resolveTableGroupByList } from '@/services/tableGroupService'

interface AdvanceOrderTableModalProps {
  isOpen: boolean
  selectedTableId?: number | null
  initialGuestCount?: number
  onSelectTable: (tableId: number, tableNum: number, guestCount?: number) => void
  onClose: () => void
}

export function AdvanceOrderTableModal({
  isOpen,
  selectedTableId,
  initialGuestCount = 2,
  onSelectTable,
  onClose,
}: AdvanceOrderTableModalProps) {
  const [tables, setTables] = useState<TableData[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(selectedTableId ?? null)
  const [guestCount, setGuestCount] = useState<number>(initialGuestCount)

  const loadTables = async () => {
    setIsLoading(true)
    setFetchError(null)
    try {
      const all = await fetchAllTables()
      // Filter for available tables plus the currently selected table if re-opening
      const available = all.filter(
        (t) => t.STATUS === 'AVAILABLE' || (selectedTableId && t.TABLE_ID === selectedTableId),
      )
      setTables(available)
    } catch (err) {
      console.error('[AdvanceOrderTableModal] Failed to fetch tables:', err)
      setFetchError('Unable to load available tables. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      setSelectedId(selectedTableId ?? null)
      setGuestCount(initialGuestCount)
      loadTables()
    }
  }, [isOpen, selectedTableId, initialGuestCount])

  if (!isOpen) return null

  const selectedTable = tables.find((t) => t.TABLE_ID === selectedId)
  const selectedGroup = selectedId ? resolveTableGroupByList(selectedId, tables) : null

  const handleConfirm = () => {
    if (selectedTable) {
      onSelectTable(selectedTable.TABLE_ID, selectedTable.TABLE_NUM, selectedGroup?.isMerged ? guestCount : undefined)
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70 shrink-0">
          <div>
            <h3 className="text-base font-black text-[#14274E] flex items-center gap-2">
              <Utensils className="w-4 h-4 text-[#14274E]" />
              Choose Your Table
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Showing only currently available dining tables
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={loadTables}
              disabled={isLoading}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              title="Refresh available tables"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#14274E]' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {isLoading && tables.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400 space-y-2">
              <RefreshCw className="w-6 h-6 animate-spin text-[#14274E]" />
              <p className="text-xs font-semibold">Checking table availability…</p>
            </div>
          ) : fetchError ? (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{fetchError}</span>
            </div>
          ) : tables.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-800">No Tables Available Right Now</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                  All dine-in tables are currently occupied or reserved. You can switch to Takeout or check back in a few minutes.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {tables.map((table) => {
                  const isSelected = selectedId === table.TABLE_ID
                  const groupInfo = resolveTableGroupByList(table.TABLE_ID, tables)
                  return (
                    <button
                      key={table.TABLE_ID}
                      type="button"
                      onClick={() => {
                        setSelectedId(table.TABLE_ID)
                        if (groupInfo.isMerged) {
                          setGuestCount((prev) => Math.min(groupInfo.capacity, Math.max(1, prev)))
                        }
                      }}
                      className={`p-3.5 rounded-2xl border-2 text-left transition-all relative flex flex-col justify-between min-h-[95px] cursor-pointer ${
                        isSelected
                          ? 'border-[#14274E] bg-[#14274E]/5 ring-2 ring-[#14274E]/20 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/80 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between w-full">
                        <span className="text-base font-black text-[#14274E]">
                          Table {table.TABLE_NUM}
                        </span>
                        {isSelected ? (
                          <CheckCircle2 className="w-4 h-4 text-[#14274E] shrink-0" />
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 mt-1" />
                        )}
                      </div>

                      <div className="pt-2">
                        <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3 text-slate-400" />
                            {table.GUEST_CAPACITY || 4} guests
                          </span>
                          {groupInfo.isMerged && (
                            <span className="px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 text-[9px] font-extrabold">
                              Merged ({groupInfo.capacity})
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md mt-1 inline-block">
                          Available
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Guest Count Stepper if Merged Table Selected */}
              {selectedGroup?.isMerged && (
                <div className="p-3 bg-indigo-50/70 border border-indigo-200/80 rounded-2xl space-y-2 mt-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-black text-[#14274E]">
                      <Users className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Merged Tables Group ({selectedGroup.memberTableNums.map((n) => `T${n}`).join(' + ')})</span>
                    </div>
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                      Capacity: {selectedGroup.capacity} seats
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-slate-600 font-bold">Party Guest Count:</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setGuestCount((prev) => Math.max(1, prev - 1))}
                        disabled={guestCount <= 1}
                        className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-700 font-black flex items-center justify-center hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                      >
                        -
                      </button>
                      <span className="w-6 text-center text-sm font-black text-[#14274E]">
                        {guestCount}
                      </span>
                      <button
                        type="button"
                        onClick={() => setGuestCount((prev) => Math.min(selectedGroup.capacity, prev + 1))}
                        disabled={guestCount >= selectedGroup.capacity}
                        className="w-7 h-7 rounded-lg bg-[#14274E] text-white font-black flex items-center justify-center hover:bg-[#203c73] disabled:opacity-40 cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between shrink-0">
          <span className="text-xs font-bold text-slate-500">
            {selectedTable
              ? `Selected: Table ${selectedTable.TABLE_NUM} (${selectedTable.GUEST_CAPACITY} seats)`
              : 'Please select a table to continue'}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-extrabold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!selectedTable}
              className="px-4 py-2 bg-[#14274E] hover:bg-[#1f3b73] active:scale-95 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all disabled:opacity-40 cursor-pointer"
            >
              Confirm Table
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
