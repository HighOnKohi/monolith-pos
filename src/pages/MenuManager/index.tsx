import { useState, useRef } from 'react'
import { Search, Plus, ChevronLeft, ChevronRight, Edit2, Trash2, X, Upload } from 'lucide-react'
import { useMenu } from '@/hooks/useMenu'
import {
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  createCategory,
} from '@/services/menuService'
import type { MenuItem, Category } from '@/types/menu'

export default function MenuManagerPage() {
  const { items, categories, loadState, reload } = useMenu()

  const [activeCat, setActiveCat]       = useState<string>('all')
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null)
  const [editingId, setEditingId]       = useState<string | null>(null)
  const [search, setSearch]             = useState('')
  const [saving, setSaving]             = useState(false)
  const [deleting, setDeleting]         = useState(false)

  // Edit form state
  const [formName,      setFormName]      = useState('')
  const [formPrice,     setFormPrice]     = useState('')
  const [formCatId,     setFormCatId]     = useState('')
  const [formDietary,   setFormDietary]   = useState<'veg' | 'non-veg'>('non-veg')
  const [formAvailable, setFormAvailable] = useState(true)

  const catScrollRef = useRef<HTMLDivElement>(null)

  // ── Category strip helpers ─────────────────────────────────────────────────
  function scrollCats(dir: 'left' | 'right') {
    catScrollRef.current?.scrollBy({ left: dir === 'left' ? -160 : 160, behavior: 'smooth' })
  }

  // ── Filtered items ─────────────────────────────────────────────────────────
  const filtered = items.filter((item) => {
    const matchCat  = activeCat === 'all' || item.categoryId === activeCat
    const matchSearch = search.trim() === '' ||
      item.name.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  // ── Edit handlers ──────────────────────────────────────────────────────────
  function handleEdit(item: MenuItem) {
    setSelectedItem(item)
    setEditingId(item.id)
    setFormName(item.name)
    setFormPrice(String(item.price))
    setFormCatId(item.categoryId)
    setFormDietary(item.dietaryType)
    setFormAvailable(item.isAvailable)
  }

  function handleClose() {
    setSelectedItem(null)
    setEditingId(null)
  }

  async function handleSave() {
    if (!selectedItem) return
    setSaving(true)
    try {
      await updateMenuItem(selectedItem.id, {
        name:        formName,
        price:       parseFloat(formPrice),
        categoryId:  formCatId,
        dietaryType: formDietary,
        isAvailable: formAvailable,
      })
      reload()
      handleClose()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!selectedItem) return
    setDeleting(true)
    try {
      await deleteMenuItem(selectedItem.id)
      reload()
      handleClose()
    } finally {
      setDeleting(false)
    }
  }

  // ── Add Category ───────────────────────────────────────────────────────────
  async function handleAddCategory() {
    const name = window.prompt('Category name:')
    if (!name?.trim()) return
    await createCategory(name.trim())
    reload()
  }

  // ── Add Dish ───────────────────────────────────────────────────────────────
  async function handleAddDish() {
    const firstRealCat = categories.find(c => c.id !== 'all')
    if (!firstRealCat) return

    const created = await createMenuItem({
      name:        'New Dish',
      price:       0,
      categoryId:  firstRealCat.id,
      dietaryType: 'non-veg',
    })
    reload()
    handleEdit({ ...created })
  }

  // ── Pagination ─────────────────────────────────────────────────────────────
  const PAGE_SIZE = 12
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const activeLabel = categories.find((c: Category) => c.id === activeCat)?.name ?? 'All'

  return (
    <div className="menu-manager-page-container">

      {/* ── LEFT: Menu browser ───────────────────────────── */}
      <div className="inner-menu-manager-page-container">

        {/* Search bar */}
        <div className="flex items-center gap-2 rounded-xl bg-white border border-[#9BA4B4]/30 px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-[#9BA4B4]" />
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search menu items, categories, SKU..."
            className="flex-1 bg-transparent text-sm text-[#14274E] placeholder:text-[#9BA4B4] outline-none"
          />
        </div>

        {/* Add Category button */}
        <div className="flex justify-end">
          <button
            onClick={handleAddCategory}
            className="flex items-center gap-1.5 rounded-xl border border-[#14274E]/30 bg-white px-3 py-1.5 text-xs font-semibold text-[#14274E] hover:bg-[#14274E] hover:text-white transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Category
          </button>
        </div>

        {/* Category strip */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => scrollCats('left')}
            className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg border border-[#9BA4B4]/30 bg-white text-[#394867] hover:bg-[#F1F6F9] transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div
            ref={catScrollRef}
            className="flex flex-1 gap-2 overflow-x-auto scroll-smooth"
            style={{ scrollbarWidth: 'none' }}
          >
            {categories.map((cat: Category) => (
              <button
                key={cat.id}
                onClick={() => { setActiveCat(cat.id); setPage(1) }}
                className={[
                  'shrink-0 flex flex-col items-center rounded-xl border px-5 py-3 transition-all',
                  activeCat === cat.id
                    ? 'border-[#14274E] bg-white shadow-sm'
                    : 'border-[#9BA4B4]/20 bg-white text-[#394867] hover:border-[#14274E]/30',
                ].join(' ')}
              >
                <span className={[
                  'text-sm font-bold',
                  activeCat === cat.id ? 'text-[#14274E]' : 'text-[#394867]',
                ].join(' ')}>
                  {cat.name}
                </span>
                <div className="flex items-center gap-1 mt-0.5">
                  {activeCat === cat.id && (
                    <span className="h-1.5 w-1.5 rounded-full bg-[#E9C46A]" />
                  )}
                  <span className="text-xs text-[#9BA4B4]">{cat.count} Items</span>
                </div>
              </button>
            ))}
          </div>

          <button
            onClick={() => scrollCats('right')}
            className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg border border-[#9BA4B4]/30 bg-white text-[#394867] hover:bg-[#F1F6F9] transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Add Dish button */}
        <div className="flex justify-end">
          <button
            onClick={handleAddDish}
            className="flex items-center gap-1.5 rounded-xl bg-[#14274E] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#394867] transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Dish
          </button>
        </div>

        {/* Item grid */}
        <div className="flex-1 overflow-y-auto">
          {loadState === 'loading' && (
            <div className="flex h-full items-center justify-center text-sm text-[#9BA4B4]">
              Loading menu...
            </div>
          )}
          {loadState === 'error' && (
            <div className="flex h-full items-center justify-center text-sm text-[#C94A4A]">
              Failed to load menu.
            </div>
          )}
          {(loadState === 'loaded' || loadState === 'empty') && (
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-3 pb-2">
              {paginated.map((item) => (
                <div
                  key={item.id}
                  className={[
                    'relative flex flex-col rounded-xl border bg-white overflow-hidden transition-all',
                    editingId === item.id
                      ? 'border-[#14274E] shadow-md'
                      : 'border-[#9BA4B4]/20 hover:border-[#14274E]/30',
                  ].join(' ')}
                >
                  {/* Selected badge */}
                  {editingId === item.id && (
                    <div className="absolute top-2 left-2 z-10 flex items-center gap-1 rounded-full bg-[#14274E] px-2 py-0.5 text-[10px] font-bold text-white">
                      ✓ Selected
                    </div>
                  )}

                  {/* Image */}
                  <div className="h-32 w-full overflow-hidden bg-[#F1F6F9]">
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="h-full w-full object-cover"
                    />
                  </div>

                  {/* Info */}
                  <div className="flex flex-col gap-1 p-2.5">
                    <p className="text-sm font-semibold text-[#14274E] line-clamp-2">{item.name}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-[#14274E]">${item.price.toFixed(2)}</span>
                      <span className={[
                        'flex items-center gap-1 text-[10px] font-semibold',
                        item.dietaryType === 'veg' ? 'text-yellow-600' : 'text-[#C94A4A]',
                      ].join(' ')}>
                        <span className={[
                          'h-1.5 w-1.5 rounded-full',
                          item.dietaryType === 'veg' ? 'bg-yellow-500' : 'bg-[#C94A4A]',
                        ].join(' ')} />
                        {item.dietaryType === 'veg' ? 'Veg' : 'Non Veg'}
                      </span>
                    </div>

                    {/* Card actions */}
                    <div className="flex gap-1.5 mt-1">
                      <button
                        onClick={() => handleEdit(item)}
                        className={[
                          'flex flex-1 items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-semibold transition-colors',
                          editingId === item.id
                            ? 'bg-[#14274E] text-white'
                            : 'border border-[#9BA4B4]/30 text-[#394867] hover:bg-[#F1F6F9]',
                        ].join(' ')}
                      >
                        <Edit2 className="h-3 w-3" />
                        {editingId === item.id ? 'Editing' : 'Edit Dish'}
                      </button>
                      <button
                        onClick={async () => {
                          if (!confirm(`Delete "${item.name}"?`)) return
                          await deleteMenuItem(item.id)
                          if (editingId === item.id) handleClose()
                          reload()
                        }}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#C94A4A]/30 text-[#C94A4A] hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {paginated.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-sm font-semibold text-[#14274E]">No items found</p>
                  <p className="text-xs text-[#9BA4B4]">Try a different category or search term.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Pagination footer */}
        <div className="shrink-0 flex items-center justify-between pt-1 border-t border-[#9BA4B4]/20">
          <p className="text-xs text-[#9BA4B4]">
            Showing {paginated.length} of {filtered.length} items in{' '}
            <span className="font-semibold text-[#394867]">{activeLabel}</span>
          </p>
          <div className="flex items-center gap-1">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#9BA4B4]/30 text-[#394867] hover:bg-[#F1F6F9] disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={[
                  'flex h-7 w-7 items-center justify-center rounded-lg text-xs font-semibold transition-colors',
                  p === page ? 'bg-[#14274E] text-white' : 'border border-[#9BA4B4]/30 text-[#394867] hover:bg-[#F1F6F9]',
                ].join(' ')}
              >
                {p}
              </button>
            ))}
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#9BA4B4]/30 text-[#394867] hover:bg-[#F1F6F9] disabled:opacity-40 transition-colors"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── RIGHT: Order sidebar — always visible, flush to container edges ─── */}
      <div className="order-sidebar">

        {selectedItem ? (
          <>
            {/* Panel header */}
            <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-[#9BA4B4]/20">
              <div>
                <p className="text-sm font-bold text-[#14274E]">Edit Dish</p>
                <p className="text-[10px] text-[#9BA4B4]">
                  ID: #{selectedItem.id} •{' '}
                  {categories.find((c: Category) => c.id === selectedItem.categoryId)?.name ?? '—'}
                </p>
              </div>
              <button onClick={handleClose} className="text-[#9BA4B4] hover:text-[#14274E] transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Tabs (static — only Dish Details is functional for now) */}
            <div className="shrink-0 flex gap-1 px-3 pt-2 pb-1 border-b border-[#9BA4B4]/20">
              {['Dish Details', 'Modifiers', 'Pricing'].map((t, i) => (
                <button
                  key={t}
                  className={[
                    'flex-1 rounded-lg py-1.5 text-xs font-semibold transition-colors',
                    i === 0 ? 'bg-[#14274E] text-white' : 'text-[#394867] hover:bg-[#F1F6F9]',
                  ].join(' ')}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Form — scrollable */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">

              {/* Image */}
              <div>
                <p className="mb-1.5 text-xs font-semibold text-[#394867]">Item Imagery</p>
                <div className="flex items-center gap-3">
                  <img
                    src={selectedItem.imageUrl}
                    alt={selectedItem.name}
                    className="h-14 w-14 rounded-lg object-cover border border-[#9BA4B4]/20"
                  />
                  <button className="flex items-center gap-1.5 rounded-lg border border-[#9BA4B4]/30 px-3 py-1.5 text-xs font-semibold text-[#394867] hover:bg-[#F1F6F9] transition-colors">
                    <Upload className="h-3.5 w-3.5" />
                    Change Photo
                  </button>
                </div>
              </div>

              {/* Dish name */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#394867]">Dish Name</label>
                <input
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  className="w-full rounded-lg border border-[#9BA4B4]/30 px-3 py-2 text-sm text-[#14274E] outline-none focus:border-[#14274E] transition-colors"
                />
              </div>

              {/* Category + Price */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#394867]">Category</label>
                  <select
                    value={formCatId}
                    onChange={e => setFormCatId(e.target.value)}
                    className="w-full rounded-lg border border-[#9BA4B4]/30 px-3 py-2 text-sm text-[#14274E] bg-white outline-none focus:border-[#14274E] transition-colors"
                  >
                    {categories.filter((c: Category) => c.id !== 'all').map((c: Category) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#394867]">Price ($)</label>
                  <input
                    type="number"
                    value={formPrice}
                    onChange={e => setFormPrice(e.target.value)}
                    className="w-full rounded-lg border border-[#9BA4B4]/30 px-3 py-2 text-sm text-[#14274E] outline-none focus:border-[#14274E] transition-colors"
                  />
                </div>
              </div>

              {/* Dietary classification */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#394867]">Dietary Classification</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setFormDietary('non-veg')}
                    className={[
                      'flex-1 rounded-lg border py-1.5 text-xs font-semibold transition-colors',
                      formDietary === 'non-veg'
                        ? 'border-[#C94A4A] bg-red-50 text-[#C94A4A]'
                        : 'border-[#9BA4B4]/30 text-[#394867] hover:bg-[#F1F6F9]',
                    ].join(' ')}
                  >
                    Non-Veg
                  </button>
                  <button
                    onClick={() => setFormDietary('veg')}
                    className={[
                      'flex-1 rounded-lg border py-1.5 text-xs font-semibold transition-colors',
                      formDietary === 'veg'
                        ? 'border-[#E9C46A] bg-yellow-50 text-yellow-700'
                        : 'border-[#9BA4B4]/30 text-[#394867] hover:bg-[#F1F6F9]',
                    ].join(' ')}
                  >
                    Vegetarian
                  </button>
                </div>
              </div>

              {/* In Stock toggle */}
              <div className="flex items-center justify-between rounded-lg border border-[#9BA4B4]/20 px-3 py-2.5">
                <div>
                  <p className="text-xs font-semibold text-[#14274E]">In Stock &amp; Visible</p>
                  <p className="text-[10px] text-[#9BA4B4]">Instant live sync to terminal</p>
                </div>
                <div
                  onClick={() => setFormAvailable(v => !v)}
                  className={[
                    'relative h-6 w-11 rounded-full transition-colors cursor-pointer',
                    formAvailable ? 'bg-[#14274E]' : 'bg-[#9BA4B4]/40',
                  ].join(' ')}
                >
                  <div className={[
                    'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
                    formAvailable ? 'translate-x-5' : 'translate-x-0.5',
                  ].join(' ')} />
                </div>
              </div>
            </div>

            {/* Footer actions */}
            <div className="shrink-0 border-t border-[#9BA4B4]/20 px-3 pb-3 pt-2 space-y-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full rounded-xl bg-[#14274E] py-2.5 text-sm font-bold text-white hover:bg-[#394867] disabled:opacity-60 transition-colors"
              >
                {saving ? 'Saving...' : 'Save Changes →'}
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-[#C94A4A]/30 py-2 text-xs font-semibold text-[#C94A4A] hover:bg-red-50 disabled:opacity-60 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {deleting ? 'Deleting...' : 'Delete Dish'}
              </button>
            </div>
          </>
        ) : (
          /* Empty state — no dish selected */
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#F1F6F9] text-[#9BA4B4]">
              <Edit2 className="h-5 w-5" />
            </div>
            <p className="text-sm font-semibold text-[#14274E]">No dish selected</p>
            <p className="text-xs text-[#9BA4B4]">Click Edit on any dish to manage its details here.</p>
          </div>
        )}
      </div>
    </div>
  )
}
