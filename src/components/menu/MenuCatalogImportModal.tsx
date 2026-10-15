import { useState, useRef } from 'react'
import {
  X,
  FileSpreadsheet,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileDown,
  Info,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'
import type { MenuItem, Category } from '@/types/menu'
import { DEFAULT_FOOD_PLACEHOLDER } from '@/types/menu'
import { createCategory } from '@/services/menuService'
import { categoryIcons } from '@/components/menu/NewMenuCategoryModal'

interface MenuCatalogImportModalProps {
  isOpen: boolean
  onClose: () => void
  items: MenuItem[]
  categories: Category[]
  onSuccess: () => void
}

export function MenuCatalogImportModal({
  isOpen,
  onClose,
  categories,
  onSuccess,
}: MenuCatalogImportModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [downloadingIds, setDownloadingIds] = useState(false)
  const [resultMessage, setResultMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

  // 1. Download Format Template with required columns
  const handleDownloadFormat = () => {
    const templateData = [
      {
        'Name': 'Crispy Pork Belly',
        'Description': 'Slow-roasted pork belly with spiced liver sauce and pickled papaya',
        'Category': 'Mains',
        'Dietary (VEG or NONVEG)': 'NONVEG',
        'Price': 420,
        'Order Limit': 25,
      },
      {
        'Name': 'Truffle Mushroom Pasta',
        'Description': 'Creamy fettuccine with wild forest mushrooms and truffle oil',
        'Category': 'Pasta',
        'Dietary (VEG or NONVEG)': 'VEG',
        'Price': 380,
        'Order Limit': 30,
      },
      {
        'Name': 'Fresh Garden Salad',
        'Description': 'Organic mixed greens, cherry tomatoes, cucumbers with house vinaigrette',
        'Category': 'Salad',
        'Dietary (VEG or NONVEG)': 'VEG',
        'Price': 220,
        'Order Limit': '',
      },
      {
        'Name': 'Iced Lemon Tea',
        'Description': 'Freshly brewed black tea infused with real calamansi and lemon',
        'Category': 'Beverages',
        'Dietary (VEG or NONVEG)': 'VEG',
        'Price': 95,
        'Order Limit': 100,
      },
      {
        'Name': 'Classic Leche Flan',
        'Description': 'Traditional rich and creamy golden caramel custard',
        'Category': 'Dessert',
        'Dietary (VEG or NONVEG)': 'VEG',
        'Price': 150,
        'Order Limit': 20,
      },
    ]

    const ws = XLSX.utils.json_to_sheet(templateData)
    ws['!cols'] = [
      { wch: 28 }, // Name
      { wch: 45 }, // Description
      { wch: 18 }, // Category
      { wch: 25 }, // Dietary (VEG or NONVEG)
      { wch: 12 }, // Price
      { wch: 14 }, // Order Limit
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Menu Template')
    XLSX.writeFile(wb, 'Menu_Catalog_Import_Template.xlsx')
  }

  // 2. Download Item IDs (Strictly ITEM NAME and ITEM ID columns, querying ALL items from database)
  const handleDownloadItemIds = async () => {
    setDownloadingIds(true)
    try {
      const { data, error } = await supabase
        .schema('menu')
        .from('Menu_Items')
        .select('ITEM_NAME, ITEM_ID')
        .order('ITEM_ID', { ascending: true })

      if (error) throw error

      const allItems = data ?? []
      const rows = allItems.map((it) => ({
        'ITEM NAME': String(it.ITEM_NAME || ''),
        'ITEM ID': Number(it.ITEM_ID),
      }))

      const ws = XLSX.utils.json_to_sheet(rows)
      ws['!cols'] = [
        { wch: 35 }, // ITEM NAME
        { wch: 15 }, // ITEM ID
      ]

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Item IDs')
      XLSX.writeFile(wb, `Menu_Item_IDs_${new Date().toISOString().slice(0, 10)}.xlsx`)
    } catch (err) {
      console.error('[MenuCatalogImportModal] Failed to download item IDs:', err)
      setResultMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to query database for Item IDs export.',
      })
    } finally {
      setDownloadingIds(false)
    }
  }

  // 3. Import Items from Excel
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      setResultMessage(null)
    }
  }

  const handleExecuteImport = async () => {
    if (!file) return
    setImporting(true)
    setResultMessage(null)

    try {
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array' })
      const firstSheetName = wb.SheetNames[0]
      const ws = wb.Sheets[firstSheetName]
      const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, { defval: '' })

      if (rows.length === 0) {
        throw new Error('The selected spreadsheet does not contain any data rows.')
      }

      // Fetch fresh categories from database
      const { data: dbCategories, error: catFetchError } = await supabase
        .schema('menu')
        .from('Menu_Categories')
        .select('CATEGORY_ID, CATEGORY_NAME, CATEGORY_ICON')

      if (catFetchError) {
        console.warn('[MenuCatalogImportModal] Failed to fetch categories from db, using props:', catFetchError)
      }

      // Build active category lookup map: lowercase name -> Category object
      const catMap = new Map<string, { id: number; name: string }>()
      const activeCats = dbCategories && dbCategories.length > 0
        ? dbCategories.map((c) => ({ id: Number(c.CATEGORY_ID), name: String(c.CATEGORY_NAME).trim() }))
        : categories.filter((c) => c.id !== 'all').map((c) => ({ id: Number(c.id), name: c.name.trim() }))

      activeCats.forEach((c) => {
        catMap.set(c.name.toLowerCase(), c)
      })

      // Available icon names for random assignment when creating a new category
      const availableIcons = categoryIcons.map((i) => i.name)
      const getRandomIcon = () =>
        availableIcons.length > 0
          ? availableIcons[Math.floor(Math.random() * availableIcons.length)]
          : 'UtensilsCrossed'

      let createdCategoriesCount = 0
      const itemsToInsert: {
        ITEM_NAME: string
        ITEM_DESCRIPTION: string | null
        CATEGORY_ID: number
        ITEM_PRICE: number
        ORDER_LIMIT: number | null
        MENU_ITEM_DIETARY: 'VEGETARIAN' | 'NON-VEGETARIAN'
        ITEM_STATUS: 'AVAILABLE' | 'OUT_OF_STOCK'
        ITEM_IMAGE_URL: string
        IS_ITEM_GROUP: boolean
      }[] = []

      for (const row of rows) {
        // Name column
        const rawName = String(
          row['Name'] ||
          row['Item Name'] ||
          row['ITEM NAME'] ||
          row['Dish Name'] ||
          row['Dish'] ||
          ''
        ).trim()

        if (!rawName) continue

        // Category column
        const rawCat = String(
          row['Category'] ||
          row['Category Name'] ||
          row['CATEGORY'] ||
          'General'
        ).trim() || 'General'

        const catKey = rawCat.toLowerCase()
        let targetCategory = catMap.get(catKey)

        // If category doesn't exist, create it with a random SVG icon
        if (!targetCategory) {
          const randomIcon = getRandomIcon()
          const created = await createCategory(rawCat, randomIcon)
          targetCategory = { id: Number(created.id), name: created.name }
          catMap.set(catKey, targetCategory)
          createdCategoriesCount++
        }

        // Description column
        const rawDesc = String(
          row['Description'] ||
          row['Desc'] ||
          row['DESCRIPTION'] ||
          ''
        ).trim()

        // Dietary (VEG or NONVEG) column
        const rawDiet = String(
          row['Dietary (VEG or NONVEG)'] ||
          row['Dietary'] ||
          row['Dietary Type'] ||
          row['DIETARY'] ||
          ''
        ).trim().toUpperCase()

        const isVeg = rawDiet.includes('VEG') && !rawDiet.includes('NON')
        const dietaryType: 'VEGETARIAN' | 'NON-VEGETARIAN' = isVeg ? 'VEGETARIAN' : 'NON-VEGETARIAN'

        // Price column
        const rawPrice = row['Price'] ?? row['Item Price'] ?? row['PRICE']
        const price = typeof rawPrice === 'number'
          ? rawPrice
          : parseFloat(String(rawPrice || 0).replace(/[^0-9.]/g, '')) || 0

        // Order Limit column
        const rawLimit = row['Order Limit'] ?? row['OrderLimit'] ?? row['Limit'] ?? row['ORDER LIMIT']
        let orderLimit: number | null = null
        if (rawLimit !== undefined && rawLimit !== null && String(rawLimit).trim() !== '') {
          const parsed = parseInt(String(rawLimit).replace(/[^0-9]/g, ''), 10)
          if (!isNaN(parsed)) {
            orderLimit = Math.max(0, parsed)
          }
        }

        // Status based on stock/order limit
        const isOutOfStock = orderLimit !== null && orderLimit <= 0
        const itemStatus: 'AVAILABLE' | 'OUT_OF_STOCK' = isOutOfStock ? 'OUT_OF_STOCK' : 'AVAILABLE'

        itemsToInsert.push({
          ITEM_NAME: rawName,
          ITEM_DESCRIPTION: rawDesc || null,
          CATEGORY_ID: targetCategory.id,
          ITEM_PRICE: price,
          ORDER_LIMIT: orderLimit,
          MENU_ITEM_DIETARY: dietaryType,
          ITEM_STATUS: itemStatus,
          ITEM_IMAGE_URL: DEFAULT_FOOD_PLACEHOLDER,
          IS_ITEM_GROUP: false,
        })
      }

      if (itemsToInsert.length === 0) {
        throw new Error('No valid dishes found in the spreadsheet. Please verify the "Name" column is filled.')
      }

      // Insert dishes in batches of 50
      const CHUNK_SIZE = 50
      for (let i = 0; i < itemsToInsert.length; i += CHUNK_SIZE) {
        const chunk = itemsToInsert.slice(i, i + CHUNK_SIZE)
        const { error: insertError } = await supabase
          .schema('menu')
          .from('Menu_Items')
          .insert(chunk)

        if (insertError) throw insertError
      }

      setResultMessage({
        type: 'success',
        text: `Successfully imported ${itemsToInsert.length} dishes!${
          createdCategoriesCount > 0 ? ` (Created ${createdCategoriesCount} new categories)` : ''
        }`,
      })
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      onSuccess()
    } catch (err) {
      console.error('[MenuCatalogImportModal] Import failed:', err)
      setResultMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to import dishes from spreadsheet.',
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
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-[#14274E]">Import Catalog Dishes</h2>
              <p className="text-xs text-slate-400 font-medium">
                Bulk add dishes to the menu catalog, or export all Item IDs.
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
          {/* Action 1 & 2: Quick Template & Item IDs Downloads */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleDownloadFormat}
              className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/80 hover:bg-slate-100 text-left transition-all cursor-pointer group flex flex-col justify-between"
              title="Download the Excel template format for importing new dishes."
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-black text-[#14274E]">Download Format</span>
                <Download className="w-4 h-4 text-blue-600 group-hover:translate-y-0.5 transition-transform" />
              </div>
              <p className="text-[11px] text-slate-400 leading-tight">
                Columns: Name, Description, Category, Dietary (VEG or NONVEG), Price, Order Limit.
              </p>
            </button>

            <button
              type="button"
              onClick={handleDownloadItemIds}
              disabled={downloadingIds}
              className="p-3.5 rounded-2xl border border-amber-200 bg-amber-50/60 hover:bg-amber-100/70 text-left transition-all cursor-pointer group flex flex-col justify-between disabled:opacity-50"
              title="Download spreadsheet of all existing dishes with their assigned Item IDs."
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-black text-amber-900">
                  {downloadingIds ? 'Exporting...' : 'Download Item IDS'}
                </span>
                {downloadingIds ? (
                  <Loader2 className="w-4 h-4 text-amber-700 animate-spin" />
                ) : (
                  <FileDown className="w-4 h-4 text-amber-700 group-hover:translate-y-0.5 transition-transform" />
                )}
              </div>
              <p className="text-[11px] text-amber-800/80 leading-tight">
                Outputs ALL items in the menu catalog database with columns: ITEM NAME and ITEM ID.
              </p>
            </button>
          </div>

          {/* Import Upload Section */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black text-[#14274E]">Upload Excel Spreadsheet</span>
              <div className="group relative cursor-help">
                <Info className="w-3.5 h-3.5 text-slate-400" />
                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 w-64 p-2 bg-slate-800 text-white text-[10px] rounded-xl shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                  Spreadsheet columns: Name, Description, Category, Dietary (VEG or NONVEG), Price, Order Limit. Non-existing categories will automatically be created.
                </div>
              </div>
            </div>

            <div
              onClick={() => fileInputRef.current?.click()}
              className={`p-6 border-2 border-dashed rounded-2xl text-center cursor-pointer transition-colors ${
                file
                  ? 'border-emerald-300 bg-emerald-50/30'
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
              <Upload className={`w-8 h-8 mx-auto mb-2 ${file ? 'text-emerald-600' : 'text-slate-400'}`} />
              {file ? (
                <div>
                  <p className="text-xs font-black text-emerald-800">{file.name}</p>
                  <p className="text-[11px] text-emerald-600 font-semibold mt-0.5">
                    {(file.size / 1024).toFixed(1)} KB • Click to change file
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-xs font-bold text-slate-700">Click to select an Excel spreadsheet</p>
                  <p className="text-[10px] text-slate-400 mt-1">Supports .xlsx and .xls workbooks</p>
                </div>
              )}
            </div>

            {/* Notification message */}
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
            title="Import dishes from the selected spreadsheet into the Menu Catalog."
          >
            {importing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#E9C46A]" />
                <span>Importing Dishes...</span>
              </>
            ) : (
              <>
                <Upload className="w-3.5 h-3.5" />
                <span>Import Dishes</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
