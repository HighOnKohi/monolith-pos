import React, { useState, useEffect } from 'react'
import {
  Search,
  X,
  Calendar,
  Filter,
  RotateCcw,
} from 'lucide-react'
import type {
  PaymentStatusFilter,
  PaymentMethodFilter,
  OrderSourceFilter,
} from '@/services/orderLogsService'
import type { OrderStatus } from '@/types/order'

export type DatePreset = 'all' | 'today' | 'yesterday' | 'last7days' | 'last30days' | 'custom'

interface OrderLogsFilterBarProps {
  search: string
  onSearchChange: (val: string) => void
  datePreset: DatePreset
  onDatePresetChange: (preset: DatePreset) => void
  customStartDate?: Date
  customEndDate?: Date
  onCustomDateChange: (start?: Date, end?: Date) => void
  orderStatus: OrderStatus | 'ALL'
  onOrderStatusChange: (status: OrderStatus | 'ALL') => void
  paymentStatus: PaymentStatusFilter
  onPaymentStatusChange: (ps: PaymentStatusFilter) => void
  paymentMethod: PaymentMethodFilter
  onPaymentMethodChange: (pm: PaymentMethodFilter) => void
  orderSource: OrderSourceFilter
  onOrderSourceChange: (source: OrderSourceFilter) => void
  tableId: number | 'ALL'
  onTableIdChange: (tId: number | 'ALL') => void
  availableTables: Array<{ id: number; num: number }>
  onClearFilters: () => void
  hasActiveFilters: boolean
}

export const OrderLogsFilterBar: React.FC<OrderLogsFilterBarProps> = ({
  search,
  onSearchChange,
  datePreset,
  onDatePresetChange,
  customStartDate,
  customEndDate,
  onCustomDateChange,
  orderStatus,
  onOrderStatusChange,
  paymentStatus,
  onPaymentStatusChange,
  paymentMethod,
  onPaymentMethodChange,
  orderSource,
  onOrderSourceChange,
  tableId,
  onTableIdChange,
  availableTables,
  onClearFilters,
  hasActiveFilters,
}) => {
  // Local input for debounced search
  const [localSearch, setLocalSearch] = useState(search)

  useEffect(() => {
    setLocalSearch(search)
  }, [search])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== search) {
        onSearchChange(localSearch)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [localSearch, search, onSearchChange])

  const datePresets: Array<{ id: DatePreset; label: string }> = [
    { id: 'all', label: 'All Time' },
    { id: 'today', label: 'Today' },
    { id: 'yesterday', label: 'Yesterday' },
    { id: 'last7days', label: 'Last 7 Days' },
    { id: 'last30days', label: 'Last 30 Days' },
    { id: 'custom', label: 'Custom' },
  ]

  return (
    <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-3">
      {/* Row 1: Search & Date Presets */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Search by Order #, Table, Source, Notes..."
            className="w-full pl-9.5 pr-8 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-xs text-slate-800 placeholder-slate-400 font-medium focus:outline-hidden focus:ring-2 focus:ring-[#14274E]/20 focus:border-[#14274E] transition-all"
          />
          {localSearch && (
            <button
              type="button"
              onClick={() => {
                setLocalSearch('')
                onSearchChange('')
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Date Preset Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          {datePresets.map((preset) => {
            const isSelected = datePreset === preset.id
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onDatePresetChange(preset.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#14274E] text-white shadow-2xs'
                    : 'bg-slate-100/70 text-slate-600 hover:bg-slate-200/60 hover:text-slate-800'
                }`}
              >
                {preset.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Row 1b: Custom Date Range Pickers (if custom selected) */}
      {datePreset === 'custom' && (
        <div className="p-3 bg-slate-50/70 border border-slate-200/60 rounded-xl flex flex-wrap items-center gap-3 text-xs">
          <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-600">From:</span>
            <input
              type="date"
              value={customStartDate ? customStartDate.toISOString().slice(0, 10) : ''}
              onChange={(e) => {
                const d = e.target.value ? new Date(`${e.target.value}T00:00:00`) : undefined
                onCustomDateChange(d, customEndDate)
              }}
              className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 font-medium"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-600">To:</span>
            <input
              type="date"
              value={customEndDate ? customEndDate.toISOString().slice(0, 10) : ''}
              onChange={(e) => {
                const d = e.target.value ? new Date(`${e.target.value}T23:59:59.999`) : undefined
                onCustomDateChange(customStartDate, d)
              }}
              className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 font-medium"
            />
          </div>
        </div>
      )}

      {/* Row 2: Secondary Dropdown Filters */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1 border-t border-slate-100">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-slate-400 mr-1 font-bold text-[11px] uppercase tracking-wider">
            <Filter className="w-3.5 h-3.5" />
            <span>Filters:</span>
          </div>

          {/* Order Status */}
          <select
            value={orderStatus}
            onChange={(e) => onOrderStatusChange(e.target.value as OrderStatus | 'ALL')}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100/80 focus:outline-hidden cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="SERVED">Served</option>
            <option value="READY">Ready</option>
            <option value="PREPARING">Preparing</option>
            <option value="VERIFIED">Confirmed</option>
            <option value="REQUESTED">Order Placed</option>
          </select>

          {/* Payment Status */}
          <select
            value={paymentStatus}
            onChange={(e) => onPaymentStatusChange(e.target.value as PaymentStatusFilter)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100/80 focus:outline-hidden cursor-pointer"
          >
            <option value="ALL">All Payments</option>
            <option value="PAID">Paid Only</option>
            <option value="UNPAID">Unpaid Only</option>
          </select>

          {/* Payment Method */}
          <select
            value={paymentMethod}
            onChange={(e) => onPaymentMethodChange(e.target.value as PaymentMethodFilter)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100/80 focus:outline-hidden cursor-pointer"
          >
            <option value="ALL">All Methods</option>
            <option value="CASH">Cash</option>
            <option value="CREDIT_CARD">Credit Card</option>
            <option value="INSTAPAY_QR">InstaPay QR</option>
          </select>

          {/* Order Source */}
          <select
            value={orderSource}
            onChange={(e) => onOrderSourceChange(e.target.value as OrderSourceFilter)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100/80 focus:outline-hidden cursor-pointer"
          >
            <option value="ALL">All Sources</option>
            <option value="Cashier">Cashier Station</option>
            <option value="Customer">Customer App</option>
          </select>

          {/* Table Selector */}
          <select
            value={tableId}
            onChange={(e) => {
              const val = e.target.value === 'ALL' ? 'ALL' : Number(e.target.value)
              onTableIdChange(val)
            }}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100/80 focus:outline-hidden cursor-pointer"
          >
            <option value="ALL">All Tables</option>
            {availableTables.map((t) => (
              <option key={t.id} value={t.id}>
                Table {t.num}
              </option>
            ))}
          </select>
        </div>

        {/* Clear Filters Action */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-all cursor-pointer shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Clear Filters</span>
          </button>
        )}
      </div>
    </div>
  )
}
