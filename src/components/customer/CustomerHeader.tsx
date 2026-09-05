import logo from '@/assets/images/monolith-logo-nobg.png'
import { TableBadge } from './TableBadge'

interface CustomerHeaderProps {
  tableLabel: string
}

export function CustomerHeader({ tableLabel }: CustomerHeaderProps) {
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
          <p className="text-xs font-medium text-[#394867]">Order Station #02</p>
        </div>
      </div>

      {/* Table badge */}
      <TableBadge tableLabel={tableLabel} />
    </div>
  )
}
