import { useState, useEffect } from 'react'
import {
  User,
  ArrowRight,
  AlertCircle,
  Utensils,
  ShoppingBag,
  Users,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react'
import logo from '@/assets/images/monolith-logo-nobg.png'
import type { DiningType } from '@/types/cart'
import { fetchAllTables, type TableData } from '@/services/tableService'

interface CustomerNameGateProps {
  isOpen: boolean
  initialName?: string
  initialDiningType?: DiningType
  initialTableId?: number | null
  initialTableNum?: number | null
  onSaveSetup: (
    name: string,
    diningType: DiningType,
    tableId: number | null,
    tableNum: number | null,
  ) => void
  onCancel?: () => void
}

export function CustomerNameGate({
  isOpen,
  initialName = '',
  initialDiningType = 'dine-in',
  initialTableId = null,
  initialTableNum = null,
  onSaveSetup,
  onCancel,
}: CustomerNameGateProps) {
  const [name, setName] = useState(initialName)
  const [diningType, setDiningType] = useState<DiningType>(initialDiningType)
  const [selectedTableId, setSelectedTableId] = useState<number | null>(initialTableId)
  const [selectedTableNum, setSelectedTableNum] = useState<number | null>(initialTableNum)
  const [error, setError] = useState<string | null>(null)

  // Tables state
  const [tables, setTables] = useState<TableData[]>([])
  const [isLoadingTables, setIsLoadingTables] = useState(false)
  const [tableError, setTableError] = useState<string | null>(null)

  const loadAvailableTables = async () => {
    setIsLoadingTables(true)
    setTableError(null)
    try {
      const all = await fetchAllTables()
      const available = all.filter((t) => t.STATUS === 'AVAILABLE')
      setTables(available)

      // If user had a selected table that is still available, keep it, otherwise pick first available if dine-in
      if (selectedTableId && !available.some((t) => t.TABLE_ID === selectedTableId)) {
        setSelectedTableId(null)
        setSelectedTableNum(null)
      }
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
      setSelectedTableId(initialTableId)
      setSelectedTableNum(initialTableNum)
      loadAvailableTables()
    }
  }, [isOpen, initialName, initialDiningType, initialTableId, initialTableNum])

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
      if (!selectedTableId || !selectedTableNum) {
        if (tables.length === 0) {
          setError('No tables are currently available. Please select Takeout to proceed.')
        } else {
          setError('Please select an available table to sit on.')
        }
        return
      }
    }

    setError(null)
    onSaveSetup(
      trimmed,
      diningType,
      diningType === 'dine-in' ? selectedTableId : null,
      diningType === 'dine-in' ? selectedTableNum : null,
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
            Dining & Table Setup
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 max-w-sm leading-relaxed">
            Enter your name and choose where you would like to sit so we can prepare your order.
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
                    Sit at a table
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

          {/* Table Selection Section (Shown when Dine-In is active) */}
          {diningType === 'dine-in' && (
            <div className="space-y-2 pt-1 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">
                    Select Available Table <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[10px] text-slate-400 font-medium">
                    Only available tables are displayed
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

              {isLoadingTables && tables.length === 0 ? (
                <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-2 text-slate-400">
                  <RefreshCw className="w-5 h-5 animate-spin text-[#14274E]" />
                  <span className="text-xs font-semibold">Checking available tables…</span>
                </div>
              ) : tableError ? (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{tableError}</span>
                </div>
              ) : tables.length === 0 ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 space-y-1">
                  <p className="font-extrabold">All tables are currently occupied.</p>
                  <p className="text-[11px] text-amber-800/90 leading-relaxed">
                    You can switch to Takeout to proceed now, or check back shortly.
                  </p>
                  <button
                    type="button"
                    onClick={() => setDiningType('take-away')}
                    className="mt-1 text-xs font-black text-amber-900 underline cursor-pointer"
                  >
                    Switch to Takeout →
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1">
                  {tables.map((table) => {
                    const isSelected = selectedTableId === table.TABLE_ID
                    return (
                      <button
                        key={table.TABLE_ID}
                        type="button"
                        onClick={() => {
                          setSelectedTableId(table.TABLE_ID)
                          setSelectedTableNum(table.TABLE_NUM)
                          if (error) setError(null)
                        }}
                        className={`p-2.5 rounded-xl border-2 text-left transition-all relative flex flex-col justify-between cursor-pointer ${
                          isSelected
                            ? 'border-[#14274E] bg-[#14274E]/5 ring-1 ring-[#14274E]/20 shadow-2xs'
                            : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/80'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="text-xs font-black text-[#14274E]">
                            Table {table.TABLE_NUM}
                          </span>
                          {isSelected ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#14274E]" />
                          ) : (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          )}
                        </div>
                        <div className="mt-1 flex items-center gap-1 text-[10px] font-bold text-slate-400">
                          <Users className="w-2.5 h-2.5" />
                          <span>{table.GUEST_CAPACITY || 4} seats</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Validation Error */}
          {error && (
            <div className="flex items-center gap-1.5 text-rose-600 text-xs font-semibold p-2 bg-rose-50 rounded-xl border border-rose-200 animate-in fade-in duration-150">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Actions */}
          <div className="pt-2 flex flex-col gap-2 shrink-0">
            <button
              type="submit"
              className="w-full py-3 px-4 bg-[#14274E] hover:bg-[#1f3b73] active:scale-[0.99] text-white font-extrabold text-sm rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Continue to Menu</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="w-full py-2 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
              >
                Close
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
