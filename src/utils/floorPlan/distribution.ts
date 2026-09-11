export interface CapacityDistribution {
  capacities: number[]
  total: number
  exact: boolean
  count4?: number
  count2?: number
}

export interface TemplateDistributionTarget {
  templateId: string
  seats: number
  percentage: number // percentage between 0 and 100
}

export interface CustomDistributionResult {
  templateCounts: Record<string, number>
  totalPax: number
  totalTables: number
  exact: boolean
  orderedTemplateIds: string[]
}

/**
 * Calculates optimal table distribution for custom saved templates with user-specified target percentages.
 * The percentages represent table count share (e.g. 80% 4-tops, 20% 2-tops).
 *
 * @param targetPax Desired seating capacity
 * @param targets Active templates with their seats and percentage share
 * @param maxPax Maximum allowed seating capacity
 */
export function calculateCustomTemplateDistribution(
  targetPax: number,
  targets: TemplateDistributionTarget[],
  maxPax = 50,
): CustomDistributionResult {
  const ceiling = Math.max(1, Math.round(maxPax))
  const requested = Math.max(1, Math.min(ceiling, Math.round(targetPax)))

  const active = targets.filter((t) => t.percentage > 0 && t.seats > 0)
  if (active.length === 0) {
    return {
      templateCounts: {},
      totalPax: 0,
      totalTables: 0,
      exact: false,
      orderedTemplateIds: [],
    }
  }

  // Normalize percentages so they strictly sum to 1.0
  const rawSum = active.reduce((sum, t) => sum + t.percentage, 0)
  const normTargets = active.map((t) => ({
    ...t,
    normP: rawSum > 0 ? t.percentage / rawSum : 1 / active.length,
  }))

  // Single active template case: just fill up to requested without exceeding ceiling
  if (normTargets.length === 1) {
    const t = normTargets[0]
    let count = Math.max(1, Math.round(requested / t.seats))
    if (count * t.seats > ceiling) {
      count = Math.floor(ceiling / t.seats)
    }
    const totalPax = count * t.seats
    return {
      templateCounts: { [t.templateId]: count },
      totalPax,
      totalTables: count,
      exact: totalPax === requested,
      orderedTemplateIds: Array(count).fill(t.templateId),
    }
  }

  // Average seats per table
  const avgSeats = normTargets.reduce((sum, t) => sum + t.normP * t.seats, 0)
  const estTotalTables = Math.max(1, Math.round(requested / Math.max(1, avgSeats)))

  let best: {
    counts: Record<string, number>
    totalPax: number
    totalTables: number
    paxDiff: number
    ratioDiff: number
  } | null = null

  // Search around estimated table count (from 1 to ceiling)
  const minN = Math.max(1, Math.floor(estTotalTables * 0.5))
  const maxN = Math.min(ceiling, Math.ceil(estTotalTables * 1.6) + 3)

  for (let N = minN; N <= maxN; N++) {
    // Initial integer apportionment by Hamilton-Webster method (Largest Remainder)
    const rawCounts = normTargets.map((t) => t.normP * N)
    const baseCounts = rawCounts.map((rc) => Math.floor(rc))
    let remainder = N - baseCounts.reduce((s, c) => s + c, 0)

    const fractionalParts = rawCounts.map((rc, idx) => ({
      idx,
      frac: rc - baseCounts[idx],
    })).sort((a, b) => b.frac - a.frac)

    for (let i = 0; i < remainder; i++) {
      baseCounts[fractionalParts[i].idx]++
    }

    // Evaluate base configuration
    const candidateCountsList: number[][] = [baseCounts]

    // Also check small adjacent adjustments (+1 / -1 swaps)
    for (let i = 0; i < normTargets.length; i++) {
      for (let j = 0; j < normTargets.length; j++) {
        if (i !== j && baseCounts[i] > 0) {
          const adjusted = [...baseCounts]
          adjusted[i]--
          adjusted[j]++
          candidateCountsList.push(adjusted)
        }
      }
    }

    for (const counts of candidateCountsList) {
      const totalPax = counts.reduce((sum, c, idx) => sum + c * normTargets[idx].seats, 0)
      if (totalPax > ceiling || totalPax === 0) continue

      const paxDiff = Math.abs(totalPax - requested)
      const totalTables = counts.reduce((s, c) => s + c, 0)
      const ratioDiff = counts.reduce((sum, c, idx) => {
        const actualRatio = totalTables > 0 ? c / totalTables : 0
        return sum + Math.abs(actualRatio - normTargets[idx].normP)
      }, 0)

      if (!best) {
        const record: Record<string, number> = {}
        normTargets.forEach((t, idx) => { record[t.templateId] = counts[idx] })
        best = { counts: record, totalPax, totalTables, paxDiff, ratioDiff }
        continue
      }

      if (paxDiff < best.paxDiff) {
        const record: Record<string, number> = {}
        normTargets.forEach((t, idx) => { record[t.templateId] = counts[idx] })
        best = { counts: record, totalPax, totalTables, paxDiff, ratioDiff }
      } else if (paxDiff === best.paxDiff) {
        if (ratioDiff < best.ratioDiff) {
          const record: Record<string, number> = {}
          normTargets.forEach((t, idx) => { record[t.templateId] = counts[idx] })
          best = { counts: record, totalPax, totalTables, paxDiff, ratioDiff }
        }
      }
    }
  }

  if (!best) {
    return {
      templateCounts: {},
      totalPax: 0,
      totalTables: 0,
      exact: false,
      orderedTemplateIds: [],
    }
  }

  // Create ordered template IDs list
  const orderedTemplateIds: string[] = []
  // Order by descending seats
  const sortedTargets = [...normTargets].sort((a, b) => b.seats - a.seats)
  for (const t of sortedTargets) {
    const cnt = best.counts[t.templateId] ?? 0
    for (let i = 0; i < cnt; i++) {
      orderedTemplateIds.push(t.templateId)
    }
  }

  return {
    templateCounts: best.counts,
    totalPax: best.totalPax,
    totalTables: best.totalTables,
    exact: best.totalPax === requested,
    orderedTemplateIds,
  }
}

/**
 * Backwards compatibility helper for standard 4-pax and 2-pax table distribution.
 */
export function calculateTableDistribution(
  target: number,
  _tableTypes = [4, 2],
  maxPax = 50,
): CapacityDistribution {
  const result = calculateCustomTemplateDistribution(
    target,
    [
      { templateId: 'tmpl-4top', seats: 4, percentage: 80 },
      { templateId: 'tmpl-2top', seats: 2, percentage: 20 },
    ],
    maxPax,
  )

  const c4 = result.templateCounts['tmpl-4top'] ?? 0
  const c2 = result.templateCounts['tmpl-2top'] ?? 0
  const capacities = [
    ...Array(c4).fill(4),
    ...Array(c2).fill(2),
  ]

  return {
    capacities,
    total: result.totalPax,
    exact: result.exact,
    count4: c4,
    count2: c2,
  }
}
