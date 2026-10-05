import { useState, useEffect, useMemo } from 'react'
import {
  User,
  ArrowRight,
  AlertCircle,
  Utensils,
  ShoppingBag,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import logo from '@/assets/images/monolith-logo-nobg.png'
import type { DiningType } from '@/types/cart'
import { type TableData } from '@/services/tableService'
import {
  resolveTableGroupByList,
  findBestTableForPax,
  getMaxAvailableTableCapacity,
} from '@/services/tableGroupService'
import { fetchEligibleAdvanceOrderTables } from '@/services/advanceOrderService'

interface CustomerNameGateProps {
  isOpen: boolean
  initialName?: string
  initialDiningType?: DiningType
  initialTableId?: number | null
  initialTableNum?: number | null
  initialGuestCount?: number
  onSaveSetup: (
    name: string,
    diningType: DiningType,
    tableId: number | null,
    tableNum: number | null,
    guestCount?: number,
  ) => void
  onCancel?: () => void
}

const COMMON_PAX_OPTIONS = [1, 2, 3, 4, 5, 6, 8, 10]

export function CustomerNameGate({
  isOpen,
  initialName = '',
  initialDiningType = 'dine-in',
  initialTableId = null,
  initialTableNum = null,
  initialGuestCount = 2,
  onSaveSetup,
  onCancel,
}: CustomerNameGateProps) {
  const [name, setName] = useState(initialName)
  const [diningType, setDiningType] = useState<DiningType>(initialDiningType)
  const [paxCount, setPaxCount] = useState<number>(initialGuestCount || 2)
  const [showManualSelection, setShowManualSelection] = useState(false)
  const [manualTableId, setManualTableId] = useState<number | null>(initialTableId)
  const [error, setError] = useState<string | null>(null)

  // Tables state
  const [tables, setTables] = useState<TableData[]>([])
  const [isLoadingTables, setIsLoadingTables] = useState(false)
  const [tableError, setTableError] = useState<string | null>(null)

  const loadAvailableTables = async () => {
    setIsLoadingTables(true)
    setTableError(null)
    try {
      // Excludes merged tables, occupied tables, and tables with active orders
      const eligible = await fetchEligibleAdvanceOrderTables(initialTableId)
      setTables(eligible)
    } catch (err) {
      console.error('[CustomerNameGate] Failed to fetch tables:', err)
      setTableError('Could not load tables. Please check your network or try again.')
    } finally {
      setIsLoadingTables(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      setName(initialName)
      setDiningType(initialDiningType)
      setPaxCount(initialGuestCount || 2)
      setManualTableId(initialTableId)
      setShowManualSelection(false)
      loadAvailableTables()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialName, initialDiningType, initialTableId, initialTableNum, initialGuestCount])

  // Highest seating capacity among all currently eligible tables
  const maxAvailableCapacity = useMemo(() => {
    return getMaxAvailableTableCapacity(tables, initialTableId, { excludeMerged: true })
  }, [tables, initialTableId])

  // Automatically clamp paxCount if it exceeds max available capacity
  useEffect(() => {
    if (maxAvailableCapacity > 0 && paxCount > maxAvailableCapacity) {
      setPaxCount(maxAvailableCapacity)
    }
  }, [maxAvailableCapacity, paxCount])

  // Automatically find best table for paxCount (strictly excluding merged tables)
  const autoAssigned = useMemo(() => {
    return findBestTableForPax(tables, paxCount, initialTableId, { excludeMerged: true })
  }, [tables, paxCount, initialTableId])

  // Effective selected table (manual override if opened and chosen, otherwise auto-assigned)
  const effectiveTable = useMemo(() => {
    if (showManualSelection && manualTableId) {
      return tables.find((t) => t.TABLE_ID === manualTableId) || null
    }
    return autoAssigned?.table || null
  }, [showManualSelection, manualTableId, tables, autoAssigned])

  const effectiveGroup = useMemo(() => {
    if (!effectiveTable) return null
    return resolveTableGroupByList(effectiveTable.TABLE_ID, tables)
  }, [effectiveTable, tables])

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()

    if (!trimmed) {
      setError('Please enter your name before continuing.')
      return
    }

    if (trimmed.length < 2) {
      setError('Name must be at least 2 characters long.')
      return
    }

    if (trimmed.length > 50) {
      setError('Name cannot exceed 50 characters.')
      return
    }

    if (diningType === 'dine-in') {
      if (maxAvailableCapacity > 0 && paxCount > maxAvailableCapacity) {
        setError(`Party size of ${paxCount} exceeds maximum available table capacity (${maxAvailableCapacity} guests).`)
        return
      }

      if (!effectiveTable) {
        if (tables.length === 0 || maxAvailableCapacity === 0) {
          setError('No tables are currently available. Please select Takeout to proceed.')
        } else {
          setError(`No available tables fit a party of ${paxCount}. Maximum available table capacity is ${maxAvailableCapacity} guests.`)
        }
        return
      }
    }

    setError(null)
    onSaveSetup(
      trimmed,
      diningType,
      diningType === 'dine-in' && effectiveTable ? effectiveTable.TABLE_ID : null,
      diningType === 'dine-in' && effectiveTable ? effectiveTable.TABLE_NUM : null,
      diningType === 'dine-in' ? paxCount : undefined,
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden text-center p-6 sm:p-7 max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Logo & Header */}
        <div className="flex flex-col items-center shrink-0">
          <div className="w-14 h-14 rounded-2xl bg-[#F1F6F9] border border-slate-200/60 flex items-center justify-center shadow-2xs mb-2.5">
            <img src={logo} alt="Monolith logo" className="w-9 h-9 object-contain" />
          </div>
          <span className="px-2.5 py-0.5 rounded-full bg-[#14274E]/10 text-[#14274E] text-[10px] font-extrabold uppercase tracking-widest mb-1">
            Advance Order
          </span>
          <h2 className="text-xl font-black text-[#14274E] tracking-tight">
            Guest & Seating Setup
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 max-w-sm leading-relaxed">
            Enter your name and guest count — we&apos;ll automatically assign and reserve your table.
          </p>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4 text-left overflow-y-auto pr-1 flex-1">
          {/* Customer Name */}
          <div>
            <label className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
              Your Name <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  if (error) setError(null)
                }}
                placeholder="e.g. Alex Chen"
                autoFocus
                maxLength={50}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-[#14274E] focus:ring-[#14274E]/15 rounded-2xl text-sm font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all"
              />
            </div>
          </div>

          {/* Dining Type Selector */}
          <div>
            <label className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
              Dining Option <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setDiningType('dine-in')
                  if (error) setError(null)
                }}
                className={`p-3 rounded-2xl border-2 flex items-center gap-2.5 transition-all text-left cursor-pointer ${
                  diningType === 'dine-in'
                    ? 'border-[#14274E] bg-[#14274E]/5 text-[#14274E] font-black'
                    : 'border-slate-200 hover:border-slate-300 text-slate-600 font-bold bg-white'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    diningType === 'dine-in'
                      ? 'bg-[#14274E] text-[#E9C46A]'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  <Utensils className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-xs block leading-tight">Dine-In</span>
                  <span className="text-[10px] text-slate-400 font-medium truncate block">
                    Reserved table
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setDiningType('take-away')
                  if (error) setError(null)
                }}
                className={`p-3 rounded-2xl border-2 flex items-center gap-2.5 transition-all text-left cursor-pointer ${
                  diningType === 'take-away'
                    ? 'border-[#14274E] bg-[#14274E]/5 text-[#14274E] font-black'
                    : 'border-slate-200 hover:border-slate-300 text-slate-600 font-bold bg-white'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    diningType === 'take-away'
                      ? 'bg-[#14274E] text-[#E9C46A]'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-xs block leading-tight">Takeout</span>
                  <span className="text-[10px] text-slate-400 font-medium truncate block">
                    Pick up to go
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* Pax Selection & Auto-Assignment Section (Shown when Dine-In is active) */}
          {diningType === 'dine-in' && (
            <div className="space-y-3 pt-1 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">
                    Party Size (Guests) <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[10px] text-slate-400 font-medium">
                    Table is automatically assigned and reserved
                  </span>
                </div>
                <button
                  type="button"
                  onClick={loadAvailableTables}
                  disabled={isLoadingTables}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                  title="Refresh available tables"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${isLoadingTables ? 'animate-spin text-[#14274E]' : ''}`}
                  />
                </button>
              </div>

              {maxAvailableCapacity > 0 && (
                <div className="flex items-center justify-between px-1">
                  <span className="text-[10px] font-extrabold text-slate-500">
                    Seating limit:
                  </span>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                    Max Available Capacity: {maxAvailableCapacity} {maxAvailableCapacity === 1 ? 'Guest' : 'Guests'}
                  </span>
                </div>
              )}

              {/* Quick Pax Buttons */}
              <div className="flex flex-wrap gap-1.5">
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
                        if (error) setError(null)
                      }}
                      title={isExceeded ? `Exceeds max available table capacity (${maxAvailableCapacity} guests)` : undefined}
                      className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
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
              <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-700">Custom Guest Count:</span>
                  {maxAvailableCapacity > 0 && (
                    <span className="text-[10px] text-slate-400 font-medium">
                      Capped at {maxAvailableCapacity} max capacity
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPaxCount((prev) => Math.max(1, prev - 1))
                      setShowManualSelection(false)
                      if (error) setError(null)
                    }}
                    disabled={paxCount <= 1}
                    className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-700 font-black flex items-center justify-center hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    -
                  </button>
                  <span className="w-7 text-center text-sm font-black text-[#14274E]">
                    {paxCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setPaxCount((prev) => Math.min(maxAvailableCapacity, prev + 1))
                      setShowManualSelection(false)
                      if (error) setError(null)
                    }}
                    disabled={paxCount >= maxAvailableCapacity || maxAvailableCapacity <= 0}
                    title={paxCount >= maxAvailableCapacity ? `Max table capacity of ${maxAvailableCapacity} reached` : undefined}
                    className="w-7 h-7 rounded-lg bg-[#14274E] text-white font-black flex items-center justify-center hover:bg-[#203c73] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Live Auto-Assignment Result Card */}
              {isLoadingTables && tables.length === 0 ? (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-center gap-2 text-slate-400 text-xs font-semibold">
                  <RefreshCw className="w-4 h-4 animate-spin text-[#14274E]" />
                  <span>Checking available seating…</span>
                </div>
              ) : tableError ? (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{tableError}</span>
                </div>
              ) : effectiveTable ? (
                <div className="p-3.5 bg-emerald-50/80 border-2 border-emerald-300/80 rounded-2xl space-y-1 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-emerald-500 text-white flex items-center justify-center shadow-xs">
                        <Sparkles className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800">
                          {showManualSelection ? 'Selected Seating' : 'Automatically Assigned & Reserved'}
                        </span>
                        <h4 className="text-sm font-black text-emerald-950">
                          Table #{effectiveTable.TABLE_NUM}
                          {effectiveGroup?.isMerged && '+'}
                        </h4>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider border border-emerald-300/60">
                      Seats up to {effectiveGroup?.capacity || effectiveTable.GUEST_CAPACITY}
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-900/90 font-medium leading-relaxed">
                    Reserved for your party of <strong>{paxCount} {paxCount === 1 ? 'guest' : 'guests'}</strong> upon starting your order.
                  </p>
                </div>
              ) : (
                <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-2xl text-xs text-amber-900 space-y-1">
                  <p className="font-extrabold">No tables currently available for {paxCount} guests.</p>
                  <p className="text-[11px] text-amber-800/90">
                    Maximum available table capacity is {maxAvailableCapacity} guests. Please choose a smaller party size or switch to Takeout.
                  </p>
                </div>
              )}

              {/* Optional Manual Table Selection Toggle */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowManualSelection((prev) => !prev)}
                  className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                >
                  <span>Or browse available tables manually</span>
                  {showManualSelection ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {showManualSelection && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 animate-in fade-in duration-150 max-h-36 overflow-y-auto">
                    {tables.map((table) => {
                      const isSelected = manualTableId === table.TABLE_ID
                      const groupInfo = resolveTableGroupByList(table.TABLE_ID, tables)
                      return (
                        <button
                          key={table.TABLE_ID}
                          type="button"
                          onClick={() => {
                            setManualTableId(table.TABLE_ID)
                            if (error) setError(null)
                          }}
                          className={`p-2.5 rounded-xl border-2 text-left transition-all cursor-pointer ${
                            isSelected
                              ? 'border-[#14274E] bg-[#14274E]/5 ring-1 ring-[#14274E]/20'
                              : 'border-slate-200 hover:border-slate-300 bg-white'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-[#14274E]">
                              Table {table.TABLE_NUM}
                            </span>
                            {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-[#14274E]" />}
                          </div>
                          <div className="text-[9px] font-bold text-slate-400 mt-0.5 flex items-center justify-between">
                            <span>{groupInfo.capacity} seats</span>
                            <span className="text-emerald-700 bg-emerald-50 px-1 rounded">Available</span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Validation Error Banner */}
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2 text-xs text-rose-700 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={diningType === 'dine-in' && (!effectiveTable || (maxAvailableCapacity > 0 && paxCount > maxAvailableCapacity))}
              className="w-full py-3 px-4 bg-[#14274E] hover:bg-[#1f3b73] active:scale-[0.99] text-white font-extrabold text-sm rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span>Continue to Menu</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {onCancel && (
            <div className="text-center pt-0.5">
              <button
                type="button"
                onClick={onCancel}
                className="text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors cursor-pointer py-1"
              >
                Dismiss
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
