import React from 'react'
import { Search, Ticket } from 'lucide-react'

interface TicketingHeaderProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  activeTicketId: number
}

export const TicketingHeader: React.FC<TicketingHeaderProps> = ({
  searchQuery,
  onSearchChange,
  activeTicketId,
}) => {
  return (
    <div className="ticketing-interface-top-bar relative z-50 bg-transparent">
      {/* Left: Search input */}
      <div className="ticketing-header-search flex-1 max-w-md">
        <div className="ticketing-search-wrapper">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search menu items, categories, SKU..."
            className="ticketing-search-input"
          />
        </div>
      </div>

      {/* Right: Active Ticket ID Display */}
      <div className="flex items-center gap-2">
        <div
          className="ticketing-pill-badge cursor-default"
          title="Active Ticket ID for New Order"
        >
          <Ticket className="w-4 h-4 text-[#E9C46A]" />
          <span className="font-extrabold text-white text-xs sm:text-sm tracking-wide">
            Ticket #{activeTicketId || '—'}
          </span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        </div>
      </div>
    </div>
  )
}
