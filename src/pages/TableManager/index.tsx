import { useState, useEffect, useCallback } from 'react'
import {
  Users,
  BellRing,
  ExternalLink,
  RefreshCw,
  QrCode,
  FileDown,
  Printer,
  Copy,
  Check,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'
import { resolveTableAssistance } from '@/services/assistanceService'
import { TableQrPreview } from '@/components/table-qr/TableQrPreview'
import { getTableQrUrl } from '@/components/table-qr/tableQrUtils'
import { downloadBulkQrPdf } from '@/components/table-qr/tableQrPdf'
import { printBulkQrPdf } from '@/components/table-qr/tableQrPrinter'

interface TableData {
  TABLE_ID: number
  TABLE_NUM: number
  STATUS: 'AVAILABLE' | 'RESERVED' | 'OCCUPIED' | 'HAS_REQUEST'
  GUEST_CAPACITY: number
  CURRENT_GUEST_COUNT: number
  BILL_OUT_REQUESTED: boolean
}

export default function TableManagerPage() {
  const [tables, setTables] = useState<TableData[]>([])
  const [selectedTable, setSelectedTable] = useState<TableData | null>(null)
  const [qrModalTable, setQrModalTable] = useState<TableData | null>(null)
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)
  const [isPrintingBulk, setIsPrintingBulk] = useState(false)
  const [copiedTableId, setCopiedTableId] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadTables = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('Restaurant_Tables')
        .select('*')
        .order('TABLE_NUM')
      if (error) throw error
      setTables((data as TableData[]) ?? [])
      if (data && data.length > 0) {
        setSelectedTable((curr) => curr ?? (data[0] as TableData))
      }
    } catch (err) {
      console.error('Failed to load tables:', err)
    } finally {
      if (!silent) setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTables(false)

    // Constantly fetch table updates every 3000ms in background
    const interval = setInterval(() => {
      loadTables(true)
    }, 3000)

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadTables(true)
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Realtime subscription for table updates & assistance
    const channel = supabase
      .channel('table-manager-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'Restaurant_Tables' },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            const updated = payload.new as TableData
            setTables((prev) =>
              prev.map((t) => (t.TABLE_ID === updated.TABLE_ID ? updated : t))
            )
            setSelectedTable((curr) =>
              curr?.TABLE_ID === updated.TABLE_ID ? updated : curr
            )
          } else if (payload.eventType === 'INSERT') {
            const newT = payload.new as TableData
            setTables((prev) => [...prev, newT])
          }
        }
      )
      .on('broadcast', { event: 'assistance_request' }, (payload) => {
        const { tableId } = payload.payload as { tableId: number }
        setTables((prev) =>
          prev.map((t) => (t.TABLE_ID === tableId ? { ...t, STATUS: 'HAS_REQUEST' } : t))
        )
      })
      .on('broadcast', { event: 'assistance_resolved' }, (payload) => {
        const { tableId } = payload.payload as { tableId: number }
        setTables((prev) =>
          prev.map((t) => (t.TABLE_ID === tableId ? { ...t, STATUS: 'OCCUPIED' } : t))
        )
      })
      .subscribe()

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      supabase.removeChannel(channel)
    }
  }, [loadTables])

  const handleClearAssistance = async (tableId: number, e?: React.MouseEvent) => {
    e?.stopPropagation()
    await resolveTableAssistance(tableId)
    setTables((prev) =>
      prev.map((t) => (t.TABLE_ID === tableId ? { ...t, STATUS: 'OCCUPIED', BILL_OUT_REQUESTED: false } : t))
    )
  }

  const handleUpdateStatus = async (tableId: number, newStatus: TableData['STATUS']) => {
    try {
      await supabase
        .from('Restaurant_Tables')
        .update({ STATUS: newStatus })
        .eq('TABLE_ID', tableId)
      setTables((prev) =>
        prev.map((t) => (t.TABLE_ID === tableId ? { ...t, STATUS: newStatus } : t))
      )
    } catch (err) {
      console.error(err)
    }
  }

  const handleDownloadBulkPdf = async () => {
    if (tables.length === 0) return
    try {
      setIsGeneratingPdf(true)
      await downloadBulkQrPdf(tables)
    } catch (err) {
      console.error('Failed to download QR PDF:', err)
    } finally {
      setIsGeneratingPdf(false)
    }
  }

  const handlePrintBulk = async () => {
    if (tables.length === 0) return
    try {
      setIsPrintingBulk(true)
      await printBulkQrPdf(tables)
    } catch (err) {
      console.error('Failed to print bulk QRs:', err)
    } finally {
      setIsPrintingBulk(false)
    }
  }

  const handleCopyUrl = async (tableId: number, e?: React.MouseEvent) => {
    e?.stopPropagation()
    const url = getTableQrUrl(tableId)
    try {
      await navigator.clipboard.writeText(url)
      setCopiedTableId(tableId)
      setTimeout(() => setCopiedTableId(null), 2000)
    } catch {
      const input = document.createElement('input')
      input.value = url
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      setCopiedTableId(tableId)
      setTimeout(() => setCopiedTableId(null), 2000)
    }
  }

  const assistanceTables = tables.filter((t) => t.STATUS === 'HAS_REQUEST')

  return (
    <div className="table-manager-page-container staff-page space-y-5">
      <PageHeader
        title="Table Manager"
        description="Live floor plan layout, customer service calls & table QR codes."
        action={
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              variant="secondary"
              onClick={handleDownloadBulkPdf}
              disabled={isGeneratingPdf || tables.length === 0}
              className="flex items-center gap-1.5"
              title="Download print-ready A4 PDF with all table QR cards"
            >
              <FileDown className="w-3.5 h-3.5 text-[#14274E]" />
              <span>{isGeneratingPdf ? 'Generating PDF...' : 'Download QR PDF'}</span>
            </Button>

            <Button
              size="sm"
              variant="secondary"
              onClick={handlePrintBulk}
              disabled={isPrintingBulk || tables.length === 0}
              className="flex items-center gap-1.5"
              title="Print all table QR codes in a 2-column grid"
            >
              <Printer className="w-3.5 h-3.5 text-[#14274E]" />
              <span>{isPrintingBulk ? 'Preparing...' : 'Print All QRs'}</span>
            </Button>

            <Button size="sm" variant="secondary" onClick={() => void loadTables()} className="flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </Button>
          </div>
        }
      />

      {/* Active Table Assistance Alerts */}
      {assistanceTables.length > 0 && (
        <div className="p-4 rounded-2xl bg-red-50 border-2 border-red-300 flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-600 text-white flex items-center justify-center font-bold">
              <BellRing className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-extrabold text-red-950">
                {assistanceTables.length} {assistanceTables.length === 1 ? 'Table' : 'Tables'} Calling for Assistance!
              </h4>
              <p className="text-xs text-red-800">
                {assistanceTables.map((t) => `Table ${t.TABLE_NUM}`).join(', ')} requested service.
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-red-900 bg-red-200/60 px-3 py-1 rounded-lg">
            Action Required
          </span>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Visual floor plan */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader
              title="Restaurant Floor Plan"
              description="Click on any table to view QR code or change status"
            />
            <div className="p-5">
              {isLoading ? (
                <div className="py-16 text-center text-muted text-sm">Loading restaurant floor plan...</div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {tables.map((table) => {
                    const isSelected = selectedTable?.TABLE_ID === table.TABLE_ID
                    const hasRequest = table.STATUS === 'HAS_REQUEST'
                    const isOccupied = table.STATUS === 'OCCUPIED'
                    const isReserved = table.STATUS === 'RESERVED'

                    return (
                      <div
                        key={table.TABLE_ID}
                        onClick={() => setSelectedTable(table)}
                        className={[
                          'p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between relative select-none',
                          isSelected ? 'ring-2 ring-[#14274E]' : '',
                          hasRequest
                            ? 'bg-red-50 border-red-500 shadow-md animate-bounce-short'
                            : isOccupied
                            ? 'bg-[#14274E]/5 border-[#14274E]/30'
                            : isReserved
                            ? 'bg-amber-50 border-amber-300'
                            : 'bg-white border-[#9BA4B4]/20 hover:border-[#14274E]/30',
                        ].join(' ')}
                      >
                        {hasRequest && (
                          <div className="absolute -top-2 -right-2 bg-red-600 text-white p-1 rounded-full shadow-md animate-ping">
                            <BellRing className="w-3 h-3" />
                          </div>
                        )}

                        <div className="flex items-center justify-between">
                          <span className="text-lg font-black text-[#14274E]">
                            T-{table.TABLE_NUM}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedTable(table)
                                setQrModalTable(table)
                              }}
                              className="p-1 rounded-lg text-[#394867] hover:text-[#14274E] hover:bg-[#14274E]/10 transition-colors"
                              title={`View QR Code for Table ${table.TABLE_NUM}`}
                            >
                              <QrCode className="w-4 h-4" />
                            </button>
                            <span className="text-xs text-[#9BA4B4] flex items-center gap-1 font-semibold">
                              <Users className="w-3.5 h-3.5" />
                              {table.GUEST_CAPACITY}
                            </span>
                          </div>
                        </div>

                        <div className="mt-3">
                          <span
                            className={[
                              'text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md inline-block',
                              hasRequest
                                ? 'bg-red-600 text-white'
                                : isOccupied
                                ? 'bg-[#14274E] text-white'
                                : isReserved
                                ? 'bg-amber-400 text-[#14274E]'
                                : 'bg-emerald-100 text-emerald-800',
                            ].join(' ')}
                          >
                            {hasRequest ? 'Needs Help' : table.STATUS}
                          </span>
                        </div>

                        {hasRequest && (
                          <button
                            onClick={(e) => handleClearAssistance(table.TABLE_ID, e)}
                            className="mt-3 w-full py-1 bg-red-600 text-white text-[10px] font-bold rounded-lg hover:bg-red-700 transition-colors shadow-xs"
                          >
                            Clear Alert
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Selected Table details & QR code generator */}
        <Card>
          <CardHeader
            title={selectedTable ? `Table ${selectedTable.TABLE_NUM} Details` : 'Table Details'}
            description="Table controls and customer ordering link"
          />
          {selectedTable ? (
            <div className="p-5 space-y-4">
              <div className="p-4 rounded-2xl bg-[#F1F6F9] border border-[#9BA4B4]/20">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-[#9BA4B4] font-bold uppercase">Status</span>
                  <span className="text-xs font-black text-[#14274E]">
                    {selectedTable.STATUS}
                  </span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-[#9BA4B4] font-bold uppercase">Capacity</span>
                  <span className="text-xs font-bold text-[#14274E]">
                    {selectedTable.GUEST_CAPACITY} Seats
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[#9BA4B4] font-bold uppercase">Bill Out Requested</span>
                  <span className="text-xs font-bold text-[#14274E]">
                    {selectedTable.BILL_OUT_REQUESTED ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>

              {selectedTable.STATUS === 'HAS_REQUEST' && (
                <div className="p-3 bg-red-50 border border-red-300 rounded-xl flex items-center justify-between">
                  <span className="text-xs font-bold text-red-700">Customer calling for assistance</span>
                  <Button
                    size="sm"
                    variant="primary"
                    className="text-xs py-1"
                    onClick={() => handleClearAssistance(selectedTable.TABLE_ID)}
                  >
                    Resolve Call
                  </Button>
                </div>
              )}

              {/* Status toggles */}
              <div>
                <label className="text-xs font-bold text-[#394867] uppercase block mb-1.5">
                  Change Status
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['AVAILABLE', 'OCCUPIED', 'RESERVED'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => handleUpdateStatus(selectedTable.TABLE_ID, st)}
                      className={[
                        'py-1.5 px-2 rounded-xl text-xs font-bold border transition-colors',
                        selectedTable.STATUS === st
                          ? 'bg-[#14274E] text-white border-[#14274E]'
                          : 'bg-white text-[#394867] border-[#9BA4B4]/30 hover:bg-[#F1F6F9]',
                      ].join(' ')}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Customer Link & QR Code section */}
              <div className="pt-4 border-t border-[#9BA4B4]/20 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#394867] uppercase">
                    Table QR Code & Ordering
                  </label>
                  <span className="text-[10px] font-mono text-[#9BA4B4]">
                    ID: #{selectedTable.TABLE_ID}
                  </span>
                </div>

                {/* Prominent QR Preview trigger button */}
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => setQrModalTable(selectedTable)}
                  className="w-full py-2.5 flex items-center justify-center gap-2 font-bold shadow-sm"
                >
                  <QrCode className="w-4 h-4" />
                  <span>View / Print Table {selectedTable.TABLE_NUM} QR</span>
                </Button>

                {/* Canonical URL pill with copy button */}
                <div className="flex items-center justify-between p-2 rounded-xl bg-[#F1F6F9] border border-[#9BA4B4]/20">
                  <span className="text-[11px] font-mono text-[#394867] truncate max-w-[180px]" title={getTableQrUrl(selectedTable.TABLE_ID)}>
                    {getTableQrUrl(selectedTable.TABLE_ID)}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => handleCopyUrl(selectedTable.TABLE_ID, e)}
                    className="p-1 text-xs text-[#394867] hover:text-[#14274E] rounded-md transition-colors flex items-center gap-1 font-semibold"
                    title="Copy canonical table QR URL"
                  >
                    {copiedTableId === selectedTable.TABLE_ID ? (
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
                  href={getTableQrUrl(selectedTable.TABLE_ID)}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-2 px-3 rounded-xl bg-white hover:bg-[#F1F6F9] text-[#394867] hover:text-[#14274E] border border-[#9BA4B4]/30 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Test Customer View (Table {selectedTable.TABLE_NUM})</span>
                </a>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-[#9BA4B4] text-xs">
              Select a table from the floor plan to inspect.
            </div>
          )}
        </Card>
      </div>

      {/* Table QR Preview Modal */}
      {qrModalTable && (
        <TableQrPreview
          tableId={qrModalTable.TABLE_ID}
          tableNum={qrModalTable.TABLE_NUM}
          guestCapacity={qrModalTable.GUEST_CAPACITY}
          onClose={() => setQrModalTable(null)}
        />
      )}
    </div>
  )
}
