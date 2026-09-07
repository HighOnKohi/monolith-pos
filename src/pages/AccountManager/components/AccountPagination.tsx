import React from 'react'
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react'

interface AccountPaginationProps {
  currentPage: number
  totalPages: number
  totalCount: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}

export const AccountPagination: React.FC<AccountPaginationProps> = ({
  currentPage,
  totalPages,
  totalCount,
  pageSize,
  onPageChange,
  onPageSizeChange,
}) => {
  if (totalCount === 0) return null

  const startRecord = (currentPage - 1) * pageSize + 1
  const endRecord = Math.min(currentPage * pageSize, totalCount)

  const pages: number[] = []
  const maxButtons = 5
  let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2))
  const endPage = Math.min(totalPages, startPage + maxButtons - 1)

  if (endPage - startPage + 1 < maxButtons) {
    startPage = Math.max(1, endPage - maxButtons + 1)
  }

  for (let i = startPage; i <= endPage; i++) {
    pages.push(i)
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600 bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
      <div className="flex items-center gap-3">
        <span className="font-semibold text-slate-700">
          Showing <strong className="text-slate-900">{startRecord}</strong> to{' '}
          <strong className="text-slate-900">{endRecord}</strong> of{' '}
          <strong className="text-slate-900">{totalCount}</strong> accounts
        </span>

        <div className="flex items-center gap-1.5 pl-3 border-l border-slate-200">
          <span className="text-slate-400 text-[11px]">Show:</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 cursor-pointer focus:outline-none"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-1 self-center sm:self-auto">
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          aria-label="First page"
        >
          <ChevronsLeft className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          aria-label="Previous page"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        {pages.map((p) => (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={`min-w-7 h-7 px-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              p === currentPage
                ? 'bg-[#14274E] text-white shadow-2xs'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            {p}
          </button>
        ))}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          aria-label="Next page"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          aria-label="Last page"
        >
          <ChevronsRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
