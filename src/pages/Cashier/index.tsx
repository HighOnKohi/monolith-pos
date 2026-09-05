import { useRef } from 'react'
import { Search, ChevronLeft, ChevronRight, Plus, Minus, Trash2 } from 'lucide-react'

// ============================================================
// PLACEHOLDER DATA — remove when connecting to real data
// ============================================================
const CATEGORIES = [
  { id: 'all',        label: 'All',         count: 235 },
  { id: 'breakfast',  label: 'Breakfast',   count: 19  },
  { id: 'soups',      label: 'Soups',       count: 6   },
  { id: 'pasta',      label: 'Pasta',       count: 14  },
  { id: 'main',       label: 'Main Course', count: 67  },
  { id: 'drinks',     label: 'Drinks',      count: 22  },
  { id: 'desserts',   label: 'Desserts',    count: 11  },
]

const MENU_ITEMS = [
  { id: 1, name: 'Tasty Vegetable Salad',     price: 17.99, tag: 'Veg',     img: 'https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=fresh+vegetable+salad+top+view+food+photography&image_size=square' },
  { id: 2, name: 'Original Chess Meat Burger', price: 23.99, tag: 'Non Veg', img: 'https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=gourmet+cheeseburger+food+photography&image_size=square' },
  { id: 3, name: 'Tacos Salsa With Chicken',   price: 14.99, tag: 'Non Veg', img: 'https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=chicken+tacos+salsa+food+photography&image_size=square' },
  { id: 4, name: 'Meat Sushi Maki With Tuna',  price: 9.99,  tag: 'Non Veg', img: 'https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=sushi+maki+rolls+food+photography&image_size=square' },
  { id: 5, name: 'Fresh Orange Juice',         price: 12.99, tag: 'Veg',     img: 'https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=fresh+orange+juice+glass+food+photography&image_size=square' },
  { id: 6, name: 'Original Chess Burger',      price: 10.59, tag: 'Veg',     img: 'https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=classic+burger+food+photography&image_size=square' },
]

const ORDER_ITEMS = [
  { id: 1, name: 'Original Chess Meat Burger', price: 23.99, qty: 1 },
  { id: 2, name: 'Fresh Orange Juice With Bas…', price: 12.99, qty: 1 },
  { id: 3, name: 'Meat Sushi Maki With Tuna…',  price: 9.99,  qty: 1 },
  { id: 4, name: 'Tacos Salsa With Chickens…',  price: 14.99, qty: 1 },
]
// ============================================================
// END PLACEHOLDER DATA
// ============================================================

export default function CashierPage() {
  const categoryScrollRef = useRef<HTMLDivElement>(null)

  function scrollCategories(dir: 'left' | 'right') {
    if (!categoryScrollRef.current) return
    categoryScrollRef.current.scrollBy({ left: dir === 'left' ? -160 : 160, behavior: 'smooth' })
  }

  const subtotal = ORDER_ITEMS.reduce((s, i) => s + i.price * i.qty, 0)
  const tax      = subtotal * 0.05
  const total    = subtotal + tax

  return (
    <div className="flex h-full gap-4 overflow-hidden">

      {/* ── LEFT: Menu browser ───────────────────────────── */}
      <div className="flex flex-1 flex-col gap-4 overflow-hidden">

        {/* Search bar */}
        <div className="flex items-center gap-2 rounded-xl bg-white border border-[#9BA4B4]/30 px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-[#9BA4B4]" />
          <input
            type="text"
            placeholder="Search product here..."
            className="flex-1 bg-transparent text-sm text-[#14274E] placeholder:text-[#9BA4B4] outline-none"
          />
        </div>

        {/* Category strip with arrows */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => scrollCategories('left')}
            className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg border border-[#9BA4B4]/30 bg-white text-[#394867] hover:bg-[#F1F6F9] transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          {/* Scrollable categories — PLACEHOLDER CATEGORIES */}
          <div
            ref={categoryScrollRef}
            className="flex flex-1 gap-2 overflow-x-auto scroll-smooth"
            style={{ scrollbarWidth: 'none' }}
          >
            {CATEGORIES.map((cat, i) => (
              <button
                key={cat.id}
                className={[
                  'shrink-0 flex flex-col items-center rounded-xl border px-4 py-2 text-xs font-semibold transition-colors',
                  i === 0
                    ? 'border-[#14274E] bg-[#14274E] text-white'
                    : 'border-[#9BA4B4]/30 bg-white text-[#394867] hover:border-[#14274E]/40 hover:text-[#14274E]',
                ].join(' ')}
              >
                <span>{cat.label}</span>
                <span className={i === 0 ? 'text-white/70' : 'text-[#9BA4B4]'}>{cat.count} items</span>
              </button>
            ))}
          </div>

          <button
            onClick={() => scrollCategories('right')}
            className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg border border-[#9BA4B4]/30 bg-white text-[#394867] hover:bg-[#F1F6F9] transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Item grid — scrollable vertically — PLACEHOLDER ITEMS */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-3 pb-2">
            {MENU_ITEMS.map((item) => (
              <div
                key={item.id}
                className="flex flex-col rounded-xl border border-[#9BA4B4]/20 bg-white overflow-hidden hover:shadow-sm transition-shadow"
              >
                <img
                  src={item.img}
                  alt={item.name}
                  className="h-36 w-full object-cover"
                />
                <div className="flex flex-col gap-2 p-3">
                  <p className="text-sm font-semibold text-[#14274E] leading-tight truncate">{item.name}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-[#14274E]">${item.price.toFixed(2)}</span>
                    <span className={[
                      'text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
                      item.tag === 'Veg'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-600',
                    ].join(' ')}>
                      {item.tag}
                    </span>
                  </div>
                  <button className="flex items-center justify-center gap-1.5 rounded-lg border border-[#9BA4B4]/30 py-1.5 text-xs font-semibold text-[#394867] hover:bg-[#14274E] hover:text-white hover:border-[#14274E] transition-colors">
                    <Plus className="h-3.5 w-3.5" />
                    Add to Order
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── RIGHT: Order sidebar ──────────────────────────── */}
      <div className="flex w-72 xl:w-80 shrink-0 flex-col rounded-xl bg-white border border-[#9BA4B4]/20 overflow-hidden">

        {/* Order header */}
        <div className="shrink-0 px-4 py-3 border-b border-[#9BA4B4]/20">
          <p className="text-sm font-bold text-[#14274E]">Current Order</p>
          {/* PLACEHOLDER: replace with real table/order info */}
          <p className="text-xs text-[#9BA4B4]">Table 4 — Dine In</p>
        </div>

        {/* Order type tabs — PLACEHOLDER active state */}
        <div className="shrink-0 flex gap-1 px-3 py-2 border-b border-[#9BA4B4]/20">
          {['Dine In', 'Take Away', 'Delivery'].map((t, i) => (
            <button
              key={t}
              className={[
                'flex-1 rounded-lg py-1.5 text-xs font-semibold transition-colors',
                i === 0
                  ? 'bg-[#14274E] text-white'
                  : 'text-[#394867] hover:bg-[#F1F6F9]',
              ].join(' ')}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Order items list — scrollable — PLACEHOLDER ITEMS */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
          {ORDER_ITEMS.map((item) => (
            <div key={item.id} className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-[#14274E] truncate">{item.name}</p>
                <p className="text-xs text-[#9BA4B4]">${item.price.toFixed(2)} ×{item.qty}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button className="flex h-6 w-6 items-center justify-center rounded-md bg-[#F1F6F9] text-[#394867] hover:bg-[#9BA4B4]/20 transition-colors">
                  <Minus className="h-3 w-3" />
                </button>
                <span className="w-5 text-center text-xs font-bold text-[#14274E]">{item.qty}</span>
                <button className="flex h-6 w-6 items-center justify-center rounded-md bg-[#14274E] text-white hover:bg-[#394867] transition-colors">
                  <Plus className="h-3 w-3" />
                </button>
              </div>
              <button className="shrink-0 text-[#9BA4B4] hover:text-[#C94A4A] transition-colors">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>

        {/* Totals + payment */}
        <div className="shrink-0 border-t border-[#9BA4B4]/20 px-4 py-3 space-y-1.5">
          <div className="flex justify-between text-xs text-[#9BA4B4]">
            <span>Sub Total</span>
            <span className="text-[#394867] font-medium">${subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-xs text-[#9BA4B4]">
            <span>Tax 5%</span>
            <span className="text-[#394867] font-medium">${tax.toFixed(2)}</span>
          </div>
          <div className="flex justify-between pt-1 border-t border-[#9BA4B4]/20">
            <span className="text-sm font-bold text-[#14274E]">Total Amount</span>
            <span className="text-sm font-bold text-[#14274E]">${total.toFixed(2)}</span>
          </div>
        </div>

        {/* Place order button */}
        <div className="shrink-0 px-3 pb-3">
          <button className="w-full rounded-xl bg-[#14274E] py-3 text-sm font-bold text-white hover:bg-[#394867] transition-colors">
            Place Order →
          </button>
        </div>
      </div>

    </div>
  )
}
