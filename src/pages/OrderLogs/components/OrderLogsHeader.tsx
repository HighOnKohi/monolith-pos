import React from 'react'
import { RefreshCw, Printer, Download, FileText, ClipboardList } from 'lucide-react'

interface OrderLogsHeaderProps {
  onRefresh: () => void
  onPrint: () => void
  onExportCsv: () => void
  onExportPdf: () => void
  loading?: boolean
}

export const OrderLogsHeader: React.FC<OrderLogsHeaderProps> = ({
  onRefresh,
  onPrint,
  onExportCsv,
  onExportPdf,
  loading = false,
}) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-[#14274E] text-white flex items-center justify-center shadow-xs shrink-0">
          <ClipboardList className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-[#14274E] tracking-tight">
            Order Logs
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Complete historical audit trail of restaurant orders, statuses, and transactions.
          </p>
        </div>
      </div>

      <div className="no-print flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 active:scale-95 text-slate-700 text-xs font-bold rounded-xl border border-slate-200/80 shadow-xs transition-all disabled:opacity-50 cursor-pointer"
          title="Reload order logs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
          <span>Refresh</span>
        </button>

        <button
          type="button"
          onClick={onPrint}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 active:scale-95 text-slate-700 text-xs font-bold rounded-xl border border-slate-200/80 shadow-xs transition-all cursor-pointer"
          title="Print or Save as PDF via browser"
        >
          <Printer className="w-3.5 h-3.5 text-slate-600" />
          <span>Print</span>
        </button>

        <button
          type="button"
          onClick={onExportCsv}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 active:scale-95 text-slate-700 text-xs font-bold rounded-xl border border-slate-200/80 shadow-xs transition-all cursor-pointer"
          title="Download filtered records as CSV"
        >
          <Download className="w-3.5 h-3.5 text-emerald-600" />
          <span>Export CSV</span>
        </button>

        <button
          type="button"
          onClick={onExportPdf}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#14274E] hover:bg-[#1f3b73] active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
          title="Export structured PDF report"
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Save as PDF</span>
        </button>
      </div>
    </div>
  )
}
