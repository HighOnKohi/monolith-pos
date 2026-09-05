import { Pencil } from 'lucide-react'

interface TableBadgeProps {
  tableLabel: string
  onEdit?: () => void
}

export function TableBadge({ tableLabel, onEdit }: TableBadgeProps) {
  return (
    <button
      onClick={onEdit}
      aria-label="Active table"
      className="flex items-center gap-2 bg-[#E9C46A]/25 border border-[#E9C46A]/50 px-3.5 py-2 rounded-full shadow-xs active:scale-95 transition-transform min-h-[44px]"
    >
      <span className="w-2.5 h-2.5 rounded-full bg-[#C94A4A] animate-pulse shrink-0" />
      <span className="text-sm font-bold text-[#14274E]">{tableLabel}</span>
      {onEdit && <Pencil className="w-3.5 h-3.5 text-[#394867]" />}
    </button>
  )
}
