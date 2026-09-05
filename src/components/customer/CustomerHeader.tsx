import logo from '@/assets/images/monolith-logo-nobg.png'
import { TableBadge } from './TableBadge'
import { BellRing } from 'lucide-react'

interface CustomerHeaderProps {
  tableLabel: string
  onOpenAssist?: () => void
  hasActiveAssist?: boolean
}

export function CustomerHeader({ tableLabel, onOpenAssist, hasActiveAssist }: CustomerHeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 pt-4 pb-3 bg-[#F1F6F9]">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <img
          src={logo}
          alt="Monolith logo"
          className="h-11 w-11 object-contain shrink-0"
        />
        <div>
          <h1 className="text-lg font-extrabold text-[#14274E] tracking-tight leading-tight">
            MONOLITH
          </h1>
          <p className="text-xs font-medium text-[#394867]">Order Station</p>
        </div>
      </div>

      {/* Right controls: Assist + Table badge */}
      <div className="flex items-center gap-2">
        {onOpenAssist && (
          <button
            onClick={onOpenAssist}
            className={[
              'p-2 rounded-full border transition-all duration-150 flex items-center justify-center relative active:scale-95',
              hasActiveAssist
                ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                : 'bg-white text-[#14274E] border-[#9BA4B4]/30 hover:bg-[#F1F6F9]',
            ].join(' ')}
            title="Request Table Assistance"
            aria-label="Request Table Assistance"
          >
            <BellRing className="w-4 h-4" />
            {hasActiveAssist && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-white animate-ping" />
            )}
          </button>
        )}
        <TableBadge tableLabel={tableLabel} />
      </div>
    </div>
  )
}
