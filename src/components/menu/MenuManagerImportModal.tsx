import { useState, useRef } from 'react'
import {
  X,
  FileSpreadsheet,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Info,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import type { MenuItem } from '@/types/menu'
import type { MenuPreset } from '@/services/menuService'
import { savePresetItems } from '@/services/menuService'

interface MenuManagerImportModalProps {
  isOpen: boolean
  onClose: () => void
  activePreset: MenuPreset | undefined
  catalogItems: MenuItem[]
  onSuccess: () => void
}

export function MenuManagerImportModal({
  isOpen,
  onClose,
  activePreset,
  catalogItems,
  onSuccess,
}: MenuManagerImportModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [resultMessage, setResultMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!isOpen || !activePreset) return null

  // 1. Download Format Template
  const handleDownloadFormat = () => {
    // Pick first 3 catalog items as realistic example if available
    const sampleItems = catalogItems.slice(0, 3)

    const templateRows = sampleItems.length > 0
      ? sampleItems.map((item, idx) => ({
          'Item ID': Number(item.id),
          'Item Name': `${item.name} (Optional)`,
          'Schedule': idx === 1 ? 'Morning' : 'Whole Day',
        }))
      : [
          { 'Item ID': 101, 'Item Name': 'Sample Dish 1 (Optional)', 'Schedule': 'Whole Day' },
          { 'Item ID': 102, 'Item Name': 'Sample Dish 2 (Optional)', 'Schedule': 'Morning' },
          { 'Item ID': 103, 'Item Name': 'Sample Dish 3 (Optional)', 'Schedule': 'Afternoon' },
        ]

    const ws = XLSX.utils.json_to_sheet(templateRows)
    ws['!cols'] = [
      { wch: 12 }, // Item ID
      { wch: 35 }, // Item Name
      { wch: 18 }, // Schedule
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Preset Items')
    XLSX.writeFile(wb, 'Menu_Preset_Import_Template.xlsx')
  }

  // 2. Select file
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      setResultMessage(null)
    }
  }

  // 3. Execute Import into Active Preset
  const handleExecuteImport = async () => {
    if (!file || !activePreset) return
    setImporting(true)
    setResultMessage(null)

    try {
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array' })
      const firstSheetName = wb.SheetNames[0]
      const ws = wb.Sheets[firstSheetName]
      const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws)

      if (rows.length === 0) {
        throw new Error('The selected spreadsheet does not contain any item rows.')
      }

      // Catalog lookup map
      const catalogIdSet = new Set(catalogItems.map((it) => String(it.id)))

      // Existing items in active preset
      const currentWhole = new Set((activePreset.WHOLE_DAY_ITEM_IDS ?? []).map(String))
      const currentMorning = new Set((activePreset.MORNING_ITEM_IDS ?? []).map(String))
      const currentAfternoon = new Set((activePreset.AFTERNOON_ITEM_IDS ?? []).map(String))

      let addedCount = 0
      const invalidIds: string[] = []

      for (const row of rows) {
        const rawId = String(
          row['ITEM ID'] ||
          row['Item ID'] ||
          row['ITEM_ID'] ||
          row['item id'] ||
          row['ID'] ||
          row['Id'] ||
          ''
        ).trim()
        const rawSchedule = String(
          row['Schedule'] ||
          row['SCHEDULE'] ||
          row['Time'] ||
          row['TIME'] ||
          'Whole Day'
        ).trim().toLowerCase()

        if (!rawId) continue

        // Check if item exists in master catalog
        if (catalogIdSet.size > 0 && !catalogIdSet.has(rawId)) {
          invalidIds.push(rawId)
          continue
        }

        if (rawSchedule.includes('morn')) {
          currentMorning.add(rawId)
        } else if (rawSchedule.includes('after') || rawSchedule.includes('even')) {
          currentAfternoon.add(rawId)
        } else {
          currentWhole.add(rawId)
        }
        addedCount++
      }

      // Save updated schedule to database
      await savePresetItems(activePreset.PRESET_ID, {
        wholeDayItemIds: Array.from(currentWhole),
        morningItemIds: Array.from(currentMorning),
        afternoonItemIds: Array.from(currentAfternoon),
      })

      const warningText = invalidIds.length > 0 ? ` (${invalidIds.length} unrecognized IDs skipped)` : ''
      setResultMessage({
        type: 'success',
        text: `Successfully added ${addedCount} items to "${activePreset.PRESET_NAME}"!${warningText}`,
      })

      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      onSuccess()
    } catch (err) {
      console.error('[MenuManagerImportModal] Import error:', err)
      setResultMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to import items into preset.',
      })
    } finally {
      setImporting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-[#14274E] border border-blue-100 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-[#14274E]">Import Preset Items</h2>
              <p className="text-xs text-slate-400 font-medium">
                Bulk add dishes to <strong className="text-slate-700">{activePreset.PRESET_NAME}</strong> using Item IDs.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Template download card */}
          <button
            type="button"
            onClick={handleDownloadFormat}
            className="w-full p-4 rounded-2xl border border-blue-200 bg-blue-50/60 hover:bg-blue-100/70 text-left transition-all cursor-pointer group flex items-center justify-between"
            title="Download the Excel template expecting Item IDs."
          >
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-black text-[#14274E]">Download Format</span>
                <span className="text-[10px] bg-blue-200/60 text-blue-800 px-2 py-0.5 rounded-full font-bold">
                  Preset Template
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-tight">
                Expects Item IDs exported from the Menu Catalog's "Download Item IDS".
              </p>
            </div>
            <Download className="w-4 h-4 text-blue-600 group-hover:translate-y-0.5 transition-transform shrink-0 ml-3" />
          </button>

          {/* Import Upload Area */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black text-[#14274E]">Upload Preset Excel File</span>
              <div className="group relative cursor-help">
                <Info className="w-3.5 h-3.5 text-slate-400" />
                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 w-60 p-2 bg-slate-800 text-white text-[10px] rounded-xl shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                  Select a spreadsheet with Item ID and optional Schedule column (Whole Day, Morning, or Afternoon).
                </div>
              </div>
            </div>

            <div
              onClick={() => fileInputRef.current?.click()}
              className={`p-6 border-2 border-dashed rounded-2xl text-center cursor-pointer transition-colors ${
                file
                  ? 'border-blue-300 bg-blue-50/30'
                  : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls"
                onChange={handleFileChange}
                className="hidden"
              />
              <Upload className={`w-8 h-8 mx-auto mb-2 ${file ? 'text-blue-600' : 'text-slate-400'}`} />
              {file ? (
                <div>
                  <p className="text-xs font-black text-[#14274E]">{file.name}</p>
                  <p className="text-[11px] text-blue-600 font-semibold mt-0.5">
                    {(file.size / 1024).toFixed(1)} KB • Click to change file
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-xs font-bold text-slate-700">Click to select an Excel spreadsheet</p>
                  <p className="text-[10px] text-slate-400 mt-1">Accepts Item IDs taken from Menu Catalog</p>
                </div>
              )}
            </div>

            {/* Status Feedback */}
            {resultMessage && (
              <div
                className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                  resultMessage.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {resultMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{resultMessage.text}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 p-4 border-t border-slate-100 bg-slate-50/50">
          <button
            type="button"
            onClick={onClose}
            disabled={importing}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExecuteImport}
            disabled={!file || importing}
            className="px-5 py-2 text-xs font-black bg-[#14274E] hover:bg-[#1f3b73] text-[#E9C46A] rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            title="Import items into this menu preset."
          >
            {importing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#E9C46A]" />
                <span>Importing Items...</span>
              </>
            ) : (
              <>
                <Upload className="w-3.5 h-3.5" />
                <span>Import</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
