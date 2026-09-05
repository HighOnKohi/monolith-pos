import { useState, useRef } from 'react'
import { Search, Plus, ChevronLeft, ChevronRight, Edit2, Trash2, X, Upload } from 'lucide-react'

// ============================================================
// PLACEHOLDER DATA — remove when connecting to real data
// ============================================================
const CATEGORIES = [
  { id: 'all',       label: 'All',         count: 235 },
  { id: 'burgers',   label: 'Burgers',     count: 32  },
  { id: 'breakfast', label: 'Breakfast',   count: 19  },
  { id: 'soups',     label: 'Soups',       count: 4   },
  { id: 'pasta',     label: 'Pasta',       count: 14  },
  { id: 'drinks',    label: 'Drinks',      count: 22  },
]

const MENU_ITEMS = [
  { id: 1, name: 'Tasty Vegetable Salad',      price: 17.99, tag: 'Veg',     category: 'Burgers', inStock: true,  img: 'https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=fresh+vegetable+salad+top+view+food+photography&image_size=square' },
  { id: 2, name: 'Original Cheese Meat Burger', price: 23.99, tag: 'Non Veg', category: 'Burgers', inStock: true,  img: 'https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=gourmet+cheeseburger+food+photography&image_size=square' },
  { id: 3, name: 'Tacos Salsa With Chicken',    price: 14.99, tag: 'Non Veg', category: 'Burgers', inStock: true,  img: 'https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=chicken+tacos+salsa+food+photography&image_size=square' },
  { id: 4, name: 'Meat Sushi Maki With Tuna',   price: 9.99,  tag: 'Non Veg', category: 'Burgers', inStock: false, img: 'https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=sushi+maki+rolls+food+photography&image_size=square' },
  { id: 5, name: 'Fresh Orange Juice',          price: 12.99, tag: 'Veg',     category: 'Burgers', inStock: true,  img: 'https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=fresh+orange+juice+glass+food+photography&image_size=square' },
  { id: 6, name: 'Original Chess Burger',       price: 10.59, tag: 'Veg',     category: 'Burgers', inStock: true,  img: 'https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=classic+burger+food+photography&image_size=square' },
]
// ============================================================
// END PLACEHOLDER DATA
// ============================================================

type MenuItem = typeof MENU_ITEMS[0]

export default function MenuManagerPage() {
  const [activeCat, setActiveCat]       = useState('burgers')
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(MENU_ITEMS[1])
  const [editingId, setEditingId]       = useState<number | null>(MENU_ITEMS[1].id)
  const catScrollRef = useRef<HTMLDivElement>(null)

  function scrollCats(dir: 'left' | 'right') {
    catScrollRef.current?.scrollBy({ left: dir === 'left' ? -160 : 160, behavior: 'smooth' })
  }

  function handleEdit(item: MenuItem) {
    setSelectedItem(item)
    setEditingId(item.id)
  }

  function handleClose() {
    setSelectedItem(null)
    setEditingId(null)
  }

  const activeLabel = CATEGORIES.find(c => c.id === activeCat)?.label ?? 'All'

  return (
    <div className="menu-manager-page-container">

      {/* ── LEFT: Menu browser ───────────────────────────── */}
      <div className="inner-menu-manager-page-container">

        {/* Search bar */}
        <div className="flex items-center gap-2 rounded-xl bg-white border border-[#9BA4B4]/30 px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-[#9BA4B4]" />
          <input
            type="text"
            placeholder="Search menu items, categories, SKU..."
            className="flex-1 bg-transparent text-sm text-[#14274E] placeholder:text-[#9BA4B4] outline-none"
          />
        </div>

        {/* Add Category button */}
        <div className="flex justify-end">
          <button className="flex items-center gap-1.5 rounded-xl border border-[#14274E]/30 bg-white px-3 py-1.5 text-xs font-semibold text-[#14274E] hover:bg-[#14274E] hover:text-white transition-colors">
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

          {/* PLACEHOLDER CATEGORIES */}
          <div
            ref={catScrollRef}
            className="flex flex-1 gap-2 overflow-x-auto scroll-smooth"
            style={{ scrollbarWidth: 'none' }}
          >
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCat(cat.id)}
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
                  {cat.label}
                </span>
                <div className="flex items-center gap-1 mt-0.5">
                  {activeCat === cat.id && (
                    <span className="h-1.5 w-1.5 rounded-full bg-[#E9C46A]" />
                  )}
                  <span className={activeCat === cat.id ? 'text-xs text-[#9BA4B4]' : 'text-xs text-[#9BA4B4]'}>
                    {cat.count} Items
                  </span>
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
          <button className="flex items-center gap-1.5 rounded-xl bg-[#14274E] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#394867] transition-colors">
            <Plus className="h-3.5 w-3.5" />
            Add Dish
          </button>
        </div>

        {/* Item grid — scrollable — PLACEHOLDER ITEMS */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-3 pb-2">
            {MENU_ITEMS.map((item) => (
              <div
                key={item.id}
                onClick={() => handleEdit(item)}
                className={[
                  'relative flex flex-col rounded-xl border bg-white overflow-hidden cursor-pointer transition-all',
                  editingId === item.id
                    ? 'border-[#14274E] shadow-md'
                    : 'border-[#9BA4B4]/20 hover:shadow-sm',
                ].join(' ')}
              >
                {/* Selected badge */}
                {editingId === item.id && (
                  <div className="absolute top-2 left-2 z-10 flex items-center gap-1 rounded-full bg-[#14274E] px-2 py-0.5 text-[10px] font-bold text-white">
                    ✓ Selected
                  </div>
                )}

                <img src={item.img} alt={item.name} className="h-32 w-full object-cover" />

                <div className="flex flex-col gap-2 p-3">
                  <p className="text-sm font-semibold text-[#14274E] leading-tight truncate">{item.name}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-[#14274E]">${item.price.toFixed(2)}</span>
                    <span className={[
                      'text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
                      item.tag === 'Veg' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600',
                    ].join(' ')}>
                      {item.tag}
                    </span>
                  </div>

                  {/* Action row */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleEdit(item) }}
                      className={[
                        'flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold border transition-colors',
                        editingId === item.id
                          ? 'bg-[#14274E] border-[#14274E] text-white'
                          : 'border-[#9BA4B4]/30 text-[#394867] hover:bg-[#F1F6F9]',
                      ].join(' ')}
                    >
                      <Edit2 className="h-3 w-3" />
                      {editingId === item.id ? 'Editing' : 'Edit Dish'}
                    </button>
                    <button
                      onClick={(e) => e.stopPropagation()}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#9BA4B4]/30 text-[#9BA4B4] hover:border-[#C94A4A]/40 hover:text-[#C94A4A] transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pagination footer — PLACEHOLDER */}
        <div className="shrink-0 flex items-center justify-between pt-1 border-t border-[#9BA4B4]/20">
          <p className="text-xs text-[#9BA4B4]">
            Showing {MENU_ITEMS.length} of 32 items in <span className="font-semibold text-[#394867]">{activeLabel}</span>
          </p>
          <div className="flex items-center gap-1">
            <button className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#9BA4B4]/30 text-[#394867] hover:bg-[#F1F6F9] transition-colors">
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            {/* PLACEHOLDER page numbers */}
            {[1, 2].map((p) => (
              <button
                key={p}
                className={[
                  'flex h-7 w-7 items-center justify-center rounded-lg text-xs font-semibold transition-colors',
                  p === 1 ? 'bg-[#14274E] text-white' : 'border border-[#9BA4B4]/30 text-[#394867] hover:bg-[#F1F6F9]',
                ].join(' ')}
              >
                {p}
              </button>
            ))}
            <button className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#9BA4B4]/30 text-[#394867] hover:bg-[#F1F6F9] transition-colors">
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
                {/* PLACEHOLDER SKU */}
                <p className="text-[10px] text-[#9BA4B4]">SKU: #810.2 • {selectedItem.category}</p>
              </div>
              <button onClick={handleClose} className="text-[#9BA4B4] hover:text-[#14274E] transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Tabs */}
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

              {/* Image upload */}
              <div>
                <p className="mb-1.5 text-xs font-semibold text-[#394867]">Item Imagery</p>
                <div className="flex items-center gap-3">
                  <img src={selectedItem.img} alt="" className="h-14 w-14 rounded-lg object-cover border border-[#9BA4B4]/20" />
                  <button className="flex items-center gap-1.5 rounded-lg border border-[#9BA4B4]/30 px-3 py-1.5 text-xs font-semibold text-[#394867] hover:bg-[#F1F6F9] transition-colors">
                    <Upload className="h-3.5 w-3.5" />
                    Change Photo
                  </button>
                </div>
              </div>

              {/* Dish name */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#394867]">Dish Name</label>
                {/* PLACEHOLDER value */}
                <input
                  defaultValue={selectedItem.name}
                  className="w-full rounded-lg border border-[#9BA4B4]/30 px-3 py-2 text-sm text-[#14274E] outline-none focus:border-[#14274E] transition-colors"
                />
              </div>

              {/* Category + Price */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#394867]">Category</label>
                  {/* PLACEHOLDER value */}
                  <select className="w-full rounded-lg border border-[#9BA4B4]/30 px-3 py-2 text-sm text-[#14274E] bg-white outline-none focus:border-[#14274E] transition-colors">
                    {CATEGORIES.filter(c => c.id !== 'all').map(c => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#394867]">Price ($)</label>
                  {/* PLACEHOLDER value */}
                  <input
                    type="number"
                    defaultValue={selectedItem.price}
                    className="w-full rounded-lg border border-[#9BA4B4]/30 px-3 py-2 text-sm text-[#14274E] outline-none focus:border-[#14274E] transition-colors"
                  />
                </div>
              </div>

              {/* Dietary classification */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#394867]">Dietary Classification</label>
                <div className="flex gap-2">
                  <button className={[
                    'flex-1 rounded-lg border py-1.5 text-xs font-semibold transition-colors',
                    selectedItem.tag === 'Non Veg'
                      ? 'border-[#C94A4A] bg-red-50 text-[#C94A4A]'
                      : 'border-[#9BA4B4]/30 text-[#394867] hover:bg-[#F1F6F9]',
                  ].join(' ')}>
                    Non-Veg
                  </button>
                  <button className={[
                    'flex-1 rounded-lg border py-1.5 text-xs font-semibold transition-colors',
                    selectedItem.tag === 'Veg'
                      ? 'border-[#E9C46A] bg-yellow-50 text-yellow-700'
                      : 'border-[#9BA4B4]/30 text-[#394867] hover:bg-[#F1F6F9]',
                  ].join(' ')}>
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
                <div className={[
                  'relative h-6 w-11 rounded-full transition-colors cursor-pointer',
                  selectedItem.inStock ? 'bg-[#14274E]' : 'bg-[#9BA4B4]/40',
                ].join(' ')}>
                  <div className={[
                    'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
                    selectedItem.inStock ? 'translate-x-5' : 'translate-x-0.5',
                  ].join(' ')} />
                </div>
              </div>
            </div>

            {/* Footer actions */}
            <div className="shrink-0 border-t border-[#9BA4B4]/20 px-3 pb-3 pt-2 space-y-2">
              <button className="w-full rounded-xl bg-[#14274E] py-2.5 text-sm font-bold text-white hover:bg-[#394867] transition-colors">
                Save Changes →
              </button>
              <button className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-[#C94A4A]/30 py-2 text-xs font-semibold text-[#C94A4A] hover:bg-red-50 transition-colors">
                <Trash2 className="h-3.5 w-3.5" />
                Delete Dish
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
