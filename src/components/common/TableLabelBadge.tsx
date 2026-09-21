import React from 'react'

interface TableLabelBadgeProps {
  name: string
  color: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
  showDot?: boolean
}

/**
 * Auto-calculates whether to use light or dark text based on the background color.
 */
function getContrastColor(hexColor: string): string {
  const hex = hexColor.replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)
  // Perceived brightness (ITU-R BT.601)
  const brightness = (r * 299 + g * 587 + b * 114) / 1000
  return brightness > 150 ? '#1a1a1a' : '#ffffff'
}

/**
 * Generate a subtle tinted background from the label color.
 * Used for order cards — a light wash of the label color.
 */
export function getLabelTintBg(hexColor: string, opacity = 0.12): string {
  const hex = hexColor.replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${opacity})`
}

/**
 * Reusable label badge component used across interfaces:
 * - Dispatcher order cards
 * - Kitchen order cards
 * - Receptionist floor view
 * - Table management sidebar
 */
export const TableLabelBadge: React.FC<TableLabelBadgeProps> = ({
  name,
  color,
  size = 'sm',
  className = '',
  showDot = false,
}) => {
  const textColor = getContrastColor(color)

  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5 leading-tight',
    md: 'text-xs px-2 py-0.5 leading-snug',
    lg: 'text-sm px-2.5 py-1 leading-snug',
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded font-semibold tracking-wide uppercase whitespace-nowrap ${sizeClasses[size]} ${className}`}
      style={{
        backgroundColor: color,
        color: textColor,
      }}
    >
      {showDot && (
        <span
          className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: textColor, opacity: 0.7 }}
        />
      )}
      {name}
    </span>
  )
}

/**
 * Minimal inline label indicator — just a colored dot + text.
 * For compact views like table lists.
 */
export const TableLabelDot: React.FC<{ name: string; color: string; className?: string }> = ({
  name,
  color,
  className = '',
}) => (
  <span className={`inline-flex items-center gap-1.5 text-xs ${className}`}>
    <span
      className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
      style={{ backgroundColor: color }}
    />
    <span className="text-[#394867] font-medium">{name}</span>
  </span>
)

/**
 * Colored left-border strip for order cards.
 * Wraps children with a colored left border indicating label priority.
 */
export const LabelBorderCard: React.FC<{
  color: string | null | undefined
  children: React.ReactNode
  className?: string
}> = ({ color, children, className = '' }) => (
  <div
    className={`relative ${className}`}
    style={{
      borderLeft: color ? `4px solid ${color}` : undefined,
    }}
  >
    {children}
  </div>
)
