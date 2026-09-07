import type { TopItemStat } from '@/services/analyticsService'

interface TopItemsChartProps {
  items: TopItemStat[]
}

export function TopItemsChart({ items }: TopItemsChartProps) {
  if (!items || items.length === 0) {
    return (
      <div className="h-44 flex items-center justify-center text-slate-400 text-xs italic">
        No sales recorded for this date range.
      </div>
    )
  }

  const maxQty = Math.max(...items.map((i) => i.quantity), 1)

  return (
    <div className="flex flex-col gap-3.5">
      {items.map((item, index) => {
        const percentage = Math.round((item.quantity / maxQty) * 100)

        // Rank styling
        const rankColor =
          index === 0
            ? 'bg-[#E9C46A] text-[#14274E]'
            : index === 1
              ? 'bg-slate-300 text-slate-800'
              : index === 2
                ? 'bg-amber-700/20 text-amber-900'
                : 'bg-slate-100 text-slate-600'

        return (
          <div key={item.itemId} className="flex flex-col gap-1 text-xs group">
            {/* Top row: Rank, Name, Category, Qty & Revenue */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span
                  className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black shrink-0 ${rankColor}`}
                >
                  {index + 1}
                </span>
                <span className="font-bold text-slate-800 truncate" title={item.itemName}>
                  {item.itemName}
                </span>
                <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded shrink-0 hidden sm:inline">
                  {item.categoryName}
                </span>
              </div>

              <div className="flex items-center gap-3 shrink-0 text-right">
                <span className="font-extrabold text-slate-700">
                  {item.quantity} <span className="text-[10px] font-medium text-slate-400">sold</span>
                </span>
                <span className="font-black text-[#14274E] w-20 text-right">
                  ₱{item.revenue.toLocaleString('en-PH', { minimumFractionDigits: 0 })}
                </span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden flex items-center">
              <div
                className="h-full bg-[#14274E] group-hover:bg-[#E9C46A] rounded-full transition-all duration-300"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
