import { Pencil, GitMerge } from 'lucide-react'

interface TableBadgeProps {
  tableLabel: string
  isMerged?: boolean
  onEdit?: () => void
}

export function TableBadge({ tableLabel, isMerged = false, onEdit }: TableBadgeProps) {
  return (
    <button
      onClick={onEdit}
      aria-label="Active table"
      className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-full shadow-xs active:scale-95 transition-transform min-h-[36px] sm:min-h-[44px] shrink-0 whitespace-nowrap ${
        isMerged
          ? 'bg-indigo-50 border border-indigo-300'
          : 'bg-[#E9C46A]/25 border border-[#E9C46A]/50'
      }`}
    >
      {isMerged ? (
        <GitMerge className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
      ) : (
        <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-[#C94A4A] animate-pulse shrink-0" />
      )}
      <span className="text-xs sm:text-sm font-bold text-[#14274E]">{tableLabel}</span>
      {isMerged && (
        <span className="text-[9px] font-extrabold uppercase px-1 py-0.2 rounded bg-indigo-200/60 text-indigo-800">
          Merged
        </span>
      )}
      {onEdit && <Pencil className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#394867]" />}
    </button>
  )
}
