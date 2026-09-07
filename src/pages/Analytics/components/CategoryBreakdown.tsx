import type { CategoryStat } from '@/services/analyticsService'

interface CategoryBreakdownProps {
  categories: CategoryStat[]
}

const CATEGORY_COLORS = [
  '#14274E',
  '#394867',
  '#E9C46A',
  '#9BA4B4',
  '#2A9D8F',
  '#E76F51',
  '#457B9D',
]

export function CategoryBreakdown({ categories }: CategoryBreakdownProps) {
  if (!categories || categories.length === 0) {
    return (
      <div className="h-44 flex items-center justify-center text-slate-400 text-xs italic">
        No category sales data for this period.
      </div>
    )
  }

  const maxRevenue = Math.max(...categories.map((c) => c.revenue), 1)

  return (
    <div className="flex flex-col gap-3.5">
      {categories.map((cat, idx) => {
        const color = CATEGORY_COLORS[idx % CATEGORY_COLORS.length]
        const barWidth = Math.round((cat.revenue / maxRevenue) * 100)

        return (
          <div key={cat.categoryId || cat.categoryName} className="flex flex-col gap-1 text-xs">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <span className="font-bold text-slate-800">{cat.categoryName}</span>
                <span className="text-[10px] text-slate-400">({cat.itemsSold} items)</span>
              </div>

              <div className="flex items-center gap-2 text-right">
                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                  {cat.percentageOfRevenue}%
                </span>
                <span className="font-extrabold text-[#14274E] min-w-[70px]">
                  ₱{cat.revenue.toLocaleString('en-PH', { minimumFractionDigits: 0 })}
                </span>
              </div>
            </div>

            {/* Bar */}
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${barWidth}%`, backgroundColor: color }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
