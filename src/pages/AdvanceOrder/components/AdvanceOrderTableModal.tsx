import { useState, useEffect, useMemo } from 'react'
import {
  Utensils,
  X,
  Users,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { type TableData } from '@/services/tableService'
import {
  resolveTableGroupByList,
  findBestTableForPax,
  getMaxAvailableTableCapacity,
} from '@/services/tableGroupService'
import { fetchEligibleAdvanceOrderTables } from '@/services/advanceOrderService'

interface AdvanceOrderTableModalProps {
  isOpen: boolean
  selectedTableId?: number | null
  initialGuestCount?: number
  onSelectTable: (tableId: number, tableNum: number, guestCount?: number) => void
  onClose: () => void
}

const COMMON_PAX_OPTIONS = [1, 2, 3, 4, 5, 6, 8, 10]

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
  const [paxCount, setPaxCount] = useState<number>(initialGuestCount)
  const [showManualSelection, setShowManualSelection] = useState(false)
  const [manualSelectedId, setManualSelectedId] = useState<number | null>(selectedTableId ?? null)

  const loadTables = async () => {
    setIsLoading(true)
    setFetchError(null)
    try {
      // Excludes merged tables, occupied tables, and tables with active orders
      const eligible = await fetchEligibleAdvanceOrderTables(selectedTableId)
      setTables(eligible)
    } catch (err) {
      console.error('[AdvanceOrderTableModal] Failed to fetch tables:', err)
      setFetchError('Unable to load available tables. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      setPaxCount(initialGuestCount || 2)
      setManualSelectedId(selectedTableId ?? null)
      setShowManualSelection(false)
      loadTables()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, selectedTableId, initialGuestCount])

  // Highest seating capacity among all currently eligible tables
  const maxAvailableCapacity = useMemo(() => {
    return getMaxAvailableTableCapacity(tables, selectedTableId, { excludeMerged: true })
  }, [tables, selectedTableId])

  // Automatically clamp paxCount if it exceeds max available capacity
  useEffect(() => {
    if (maxAvailableCapacity > 0 && paxCount > maxAvailableCapacity) {
      setPaxCount(maxAvailableCapacity)
    }
  }, [maxAvailableCapacity, paxCount])

  // Compute best automatic table for the selected pax size (strictly excluding merged tables)
  const autoAssigned = useMemo(() => {
    return findBestTableForPax(tables, paxCount, selectedTableId, { excludeMerged: true })
  }, [tables, paxCount, selectedTableId])

  // Resolve effective selected table (manual override if user chose one in manual view, otherwise auto-assigned)
  const effectiveTable = useMemo(() => {
    if (showManualSelection && manualSelectedId) {
      return tables.find((t) => t.TABLE_ID === manualSelectedId) || null
    }
    return autoAssigned?.table || null
  }, [showManualSelection, manualSelectedId, tables, autoAssigned])

  const effectiveGroup = useMemo(() => {
    if (!effectiveTable) return null
    return resolveTableGroupByList(effectiveTable.TABLE_ID, tables)
  }, [effectiveTable, tables])

  if (!isOpen) return null

  const handleConfirm = () => {
    if (effectiveTable) {
      onSelectTable(
        effectiveTable.TABLE_ID,
        effectiveTable.TABLE_NUM,
        paxCount,
      )
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70 shrink-0">
          <div>
            <h3 className="text-base font-black text-[#14274E] flex items-center gap-2">
              <Users className="w-4 h-4 text-[#14274E]" />
              Select Party Size
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Choose your guest count — we&apos;ll automatically assign and reserve the best table
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
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {isLoading && tables.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400 space-y-2">
              <RefreshCw className="w-6 h-6 animate-spin text-[#14274E]" />
              <p className="text-xs font-semibold">Checking available seating…</p>
            </div>
          ) : fetchError ? (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{fetchError}</span>
            </div>
          ) : tables.length === 0 || maxAvailableCapacity === 0 ? (
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
            <>
              {/* ── 1. Pax Selector Section ── */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-400 block">
                    Number of Guests (Pax)
                  </label>
                  {maxAvailableCapacity > 0 && (
                    <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                      Max Available Capacity: {maxAvailableCapacity} {maxAvailableCapacity === 1 ? 'Guest' : 'Guests'}
                    </span>
                  )}
                </div>

                {/* Quick Pax Pills */}
                <div className="flex flex-wrap gap-2">
                  {COMMON_PAX_OPTIONS.map((num) => {
                    const isExceeded = maxAvailableCapacity > 0 && num > maxAvailableCapacity
                    const isSelected = paxCount === num && !showManualSelection && !isExceeded
                    return (
                      <button
                        key={num}
                        type="button"
                        disabled={isExceeded}
                        onClick={() => {
                          setPaxCount(num)
                          setShowManualSelection(false)
                        }}
                        title={isExceeded ? `Exceeds max available table capacity (${maxAvailableCapacity} guests)` : undefined}
                        className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all ${
                          isExceeded
                            ? 'bg-slate-100/60 text-slate-300 cursor-not-allowed border border-slate-200/50'
                            : isSelected
                              ? 'bg-[#14274E] text-[#E9C46A] shadow-xs scale-105 cursor-pointer'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer'
                        }`}
                      >
                        {num} {num === 1 ? 'Guest' : 'Guests'}
                      </button>
                    )
                  })}
                </div>

                {/* Stepper for custom pax */}
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-700">Custom Party Size:</span>
                    {maxAvailableCapacity > 0 && (
                      <span className="text-[10px] text-slate-400 font-medium">
                        Capped at {maxAvailableCapacity} max capacity
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setPaxCount((prev) => Math.max(1, prev - 1))
                        setShowManualSelection(false)
                      }}
                      disabled={paxCount <= 1}
                      className="w-8 h-8 rounded-xl bg-white border border-slate-200 text-slate-700 font-black text-base flex items-center justify-center hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
                    >
                      -
                    </button>
                    <span className="w-8 text-center text-base font-black text-[#14274E]">
                      {paxCount}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setPaxCount((prev) => Math.min(maxAvailableCapacity, prev + 1))
                        setShowManualSelection(false)
                      }}
                      disabled={paxCount >= maxAvailableCapacity || maxAvailableCapacity <= 0}
                      title={paxCount >= maxAvailableCapacity ? `Max table capacity of ${maxAvailableCapacity} reached` : undefined}
                      className="w-8 h-8 rounded-xl bg-[#14274E] text-white font-black text-base flex items-center justify-center hover:bg-[#203c73] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* ── 2. Automatic Assignment Result Card ── */}
              {effectiveTable ? (
                <div className="p-4 bg-emerald-50/80 border-2 border-emerald-300/80 rounded-2xl space-y-2 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-xs">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800">
                          {showManualSelection ? 'Selected Seating' : 'Automatically Assigned & Reserved'}
                        </span>
                        <h4 className="text-base font-black text-emerald-950">
                          Table #{effectiveTable.TABLE_NUM}
                          {effectiveGroup?.isMerged && '+'}
                        </h4>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider border border-emerald-300/60">
                      Seats up to {effectiveGroup?.capacity || effectiveTable.GUEST_CAPACITY}
                    </span>
                  </div>

                  <p className="text-xs text-emerald-900/90 font-medium leading-relaxed">
                    This table is ideal for your party of <strong>{paxCount} {paxCount === 1 ? 'guest' : 'guests'}</strong> and will be automatically marked as <strong>Reserved</strong> for your advance order.
                  </p>
                </div>
              ) : (
                <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl flex items-start gap-2.5 text-xs text-amber-900">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-extrabold block">No table fits {paxCount} guests</span>
                    <span>Please choose a smaller party size (up to {maxAvailableCapacity} guests) or switch to Takeout.</span>
                  </div>
                </div>
              )}

              {/* ── 3. Optional Manual Selection Accordion ── */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowManualSelection((prev) => !prev)}
                  className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                >
                  <span>Or browse available tables manually</span>
                  {showManualSelection ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {showManualSelection && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-3 animate-in fade-in duration-150">
                    {tables.map((table) => {
                      const isSelected = manualSelectedId === table.TABLE_ID
                      const groupInfo = resolveTableGroupByList(table.TABLE_ID, tables)
                      return (
                        <button
                          key={table.TABLE_ID}
                          type="button"
                          onClick={() => setManualSelectedId(table.TABLE_ID)}
                          className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${
                            isSelected
                              ? 'border-[#14274E] bg-[#14274E]/5 ring-2 ring-[#14274E]/20'
                              : 'border-slate-200 hover:border-slate-300 bg-white'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-black text-[#14274E]">
                              Table {table.TABLE_NUM}
                            </span>
                            {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-[#14274E]" />}
                          </div>
                          <div className="text-[10px] font-bold text-slate-500 mt-1 flex items-center justify-between">
                            <span>{groupInfo.capacity} seats</span>
                            <span className="text-emerald-700 bg-emerald-50 px-1 rounded">Available</span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between shrink-0">
          <span className="text-xs font-bold text-slate-500">
            {effectiveTable
              ? `Assigned: Table ${effectiveTable.TABLE_NUM} (${effectiveGroup?.capacity || effectiveTable.GUEST_CAPACITY} seats)`
              : 'Choose a party size to continue'}
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
              disabled={!effectiveTable || (maxAvailableCapacity > 0 && paxCount > maxAvailableCapacity)}
              className="px-4 py-2 bg-[#14274E] hover:bg-[#1f3b73] active:scale-95 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all disabled:opacity-40 cursor-pointer flex items-center gap-1.5"
            >
              <Utensils className="w-3.5 h-3.5" />
              <span>Reserve Table</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
