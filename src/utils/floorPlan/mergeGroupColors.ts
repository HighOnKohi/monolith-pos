// ─────────────────────────────────────────────────────────────────────────────
// Distinct Color Palettes for Merge Groups (1 to 7+)
// Provides deterministic, rich color coding for bounding boxes, chains & badges
// ─────────────────────────────────────────────────────────────────────────────

export interface MergeGroupColorTheme {
  id: number
  name: string
  primary: string      // Main vibrant stroke / icon / header
  containerBg: string  // Rich, high-contrast tinted background for merge group boxes
  lightBg: string      // Soft background for group box / badge
  border: string       // Crisp border color
  text: string         // High contrast text
  glow: string         // Glow underlay for chain connections
}

export const MERGE_GROUP_PALETTES: MergeGroupColorTheme[] = [
  // Group 1: Ocean Blue
  {
    id: 1,
    name: 'Ocean Blue',
    primary: '#2563EB',
    containerBg: 'rgba(37, 99, 235, 0.18)',
    lightBg: 'rgba(37, 99, 235, 0.14)',
    border: '#3B82F6',
    text: '#1D4ED8',
    glow: '#60A5FA',
  },
  // Group 2: Emerald Green
  {
    id: 2,
    name: 'Emerald Green',
    primary: '#059669',
    containerBg: 'rgba(5, 150, 105, 0.18)',
    lightBg: 'rgba(5, 150, 105, 0.14)',
    border: '#10B981',
    text: '#047857',
    glow: '#34D399',
  },
  // Group 3: Amber Orange
  {
    id: 3,
    name: 'Amber Orange',
    primary: '#D97706',
    containerBg: 'rgba(217, 119, 6, 0.18)',
    lightBg: 'rgba(217, 119, 6, 0.14)',
    border: '#F59E0B',
    text: '#B45309',
    glow: '#FBBF24',
  },
  // Group 4: Crimson Rose
  {
    id: 4,
    name: 'Crimson Rose',
    primary: '#E11D48',
    containerBg: 'rgba(225, 29, 72, 0.18)',
    lightBg: 'rgba(225, 29, 72, 0.14)',
    border: '#F43F5E',
    text: '#BE123C',
    glow: '#FB7185',
  },
  // Group 5: Cyan Teal
  {
    id: 5,
    name: 'Cyan Teal',
    primary: '#0891B2',
    containerBg: 'rgba(8, 145, 178, 0.18)',
    lightBg: 'rgba(8, 145, 178, 0.14)',
    border: '#06B6D4',
    text: '#0E7490',
    glow: '#22D3EE',
  },
  // Group 6: Violet Purple
  {
    id: 6,
    name: 'Violet Purple',
    primary: '#7C3AED',
    containerBg: 'rgba(124, 58, 237, 0.18)',
    lightBg: 'rgba(124, 58, 237, 0.14)',
    border: '#8B5CF6',
    text: '#6D28D9',
    glow: '#A78BFA',
  },
  // Group 7: Fuchsia Pink
  {
    id: 7,
    name: 'Fuchsia Pink',
    primary: '#C026D3',
    containerBg: 'rgba(192, 38, 211, 0.18)',
    lightBg: 'rgba(192, 38, 211, 0.14)',
    border: '#D946EF',
    text: '#A21CAF',
    glow: '#E879F9',
  },
]

/**
 * Returns a deterministic color palette for any merge group ID.
 * Group 1 => Blue, Group 2 => Emerald, Group 3 => Amber, Group 4 => Rose,
 * Group 5 => Cyan, Group 6 => Violet, Group 7 => Fuchsia, and cycles gracefully.
 */
export function getMergeGroupColor(groupId: number | null | undefined): MergeGroupColorTheme {
  if (groupId == null || groupId <= 0) return MERGE_GROUP_PALETTES[0]
  const idx = (groupId - 1) % MERGE_GROUP_PALETTES.length
  return MERGE_GROUP_PALETTES[idx < 0 ? 0 : idx]
}
