import { supabase } from '@/lib/supabase'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface TableTypeConfig {
  TYPE_CONFIG_ID: number
  TABLE_TYPE: number
  NAME: string
  CAPACITY: number
  MAX_COUNT: number | null
  IS_ACTIVE: boolean
  CREATED_AT?: string
  UPDATED_AT?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Fetch
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch all table type configs, ordered by TABLE_TYPE ascending.
 */
export async function fetchAllTypeConfigs(): Promise<TableTypeConfig[]> {
  const { data, error } = await supabase
    .schema('tables')
    .from('Table_Type_Configs')
    .select('*')
    .order('TABLE_TYPE', { ascending: true })

  if (error) {
    console.error('[tableTypeConfigService] Error fetching type configs:', error)
    return []
  }

  return (data ?? []).map((row: Record<string, unknown>) => ({
    TYPE_CONFIG_ID: Number(row.TYPE_CONFIG_ID),
    TABLE_TYPE: Number(row.TABLE_TYPE),
    NAME: String(row.NAME ?? ''),
    CAPACITY: Number(row.CAPACITY ?? 4),
    MAX_COUNT: row.MAX_COUNT != null ? Number(row.MAX_COUNT) : null,
    IS_ACTIVE: Boolean(row.IS_ACTIVE),
    CREATED_AT: row.CREATED_AT != null ? String(row.CREATED_AT) : undefined,
    UPDATED_AT: row.UPDATED_AT != null ? String(row.UPDATED_AT) : undefined,
  }))
}

// ─────────────────────────────────────────────────────────────────────────────
// Update
// ─────────────────────────────────────────────────────────────────────────────

export async function updateTypeConfig(
  typeConfigId: number,
  fields: Partial<{ name: string; capacity: number; maxCount: number | null; isActive: boolean }>,
): Promise<TableTypeConfig> {
  const payload: Record<string, unknown> = { UPDATED_AT: new Date().toISOString() }

  if (fields.name !== undefined) payload.NAME = fields.name.trim()
  if (fields.capacity !== undefined) {
    if (fields.capacity < 1) throw new Error('Capacity must be at least 1.')
    payload.CAPACITY = fields.capacity
  }
  if (fields.maxCount !== undefined) {
    if (fields.maxCount !== null && fields.maxCount < 0) throw new Error('Max count cannot be negative.')
    payload.MAX_COUNT = fields.maxCount
  }
  if (fields.isActive !== undefined) payload.IS_ACTIVE = fields.isActive

  const { data, error } = await supabase
    .schema('tables')
    .from('Table_Type_Configs')
    .update(payload)
    .eq('TYPE_CONFIG_ID', typeConfigId)
    .select()
    .single()

  if (error || !data) throw error ?? new Error('Failed to update type config.')

  return {
    TYPE_CONFIG_ID: Number(data.TYPE_CONFIG_ID),
    TABLE_TYPE: Number(data.TABLE_TYPE),
    NAME: String(data.NAME),
    CAPACITY: Number(data.CAPACITY),
    MAX_COUNT: data.MAX_COUNT != null ? Number(data.MAX_COUNT) : null,
    IS_ACTIVE: Boolean(data.IS_ACTIVE),
    CREATED_AT: String(data.CREATED_AT),
    UPDATED_AT: String(data.UPDATED_AT),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate that adding tables of a given type won't exceed the max_count limit.
 * Returns { allowed: boolean; currentCount: number; maxCount: number | null; message?: string }
 */
export async function validateTableTypeCount(
  tableType: number,
  additionalCount: number = 1,
  layoutTables?: Array<{ TABLE_TYPE: number }>,
): Promise<{
  allowed: boolean
  currentCount: number
  maxCount: number | null
  message?: string
}> {
  // Fetch the type config
  const configs = await fetchAllTypeConfigs()
  const config = configs.find((c) => c.TABLE_TYPE === tableType)

  if (!config) {
    return { allowed: true, currentCount: 0, maxCount: null }
  }

  if (config.MAX_COUNT === null) {
    return { allowed: true, currentCount: 0, maxCount: null }
  }

  // Count current tables of this type from layout or live tables
  let currentCount = 0
  if (layoutTables) {
    currentCount = layoutTables.filter((t) => t.TABLE_TYPE === tableType).length
  } else {
    const { data } = await supabase
      .schema('tables')
      .from('Table_Layout_Info')
      .select('TABLE_NUM')
      .eq('TABLE_TYPE', tableType)

    currentCount = (data ?? []).length
  }

  const allowed = currentCount + additionalCount <= config.MAX_COUNT

  return {
    allowed,
    currentCount,
    maxCount: config.MAX_COUNT,
    message: allowed
      ? undefined
      : `Cannot add ${additionalCount} more ${config.NAME} table(s). Current: ${currentCount}, Maximum: ${config.MAX_COUNT}.`,
  }
}

/**
 * Get a summary of table type counts from a set of layout tables.
 */
export function getTypeCountsFromLayout(
  layoutTables: Array<{ TABLE_TYPE: number }>,
): Map<number, number> {
  const counts = new Map<number, number>()
  for (const t of layoutTables) {
    counts.set(t.TABLE_TYPE, (counts.get(t.TABLE_TYPE) ?? 0) + 1)
  }
  return counts
}

/**
 * Validate all type counts against their limits.
 * Returns a list of violations.
 */
export async function validateAllTypeCounts(
  layoutTables: Array<{ TABLE_TYPE: number }>,
): Promise<Array<{ tableType: number; name: string; currentCount: number; maxCount: number }>> {
  const configs = await fetchAllTypeConfigs()
  const counts = getTypeCountsFromLayout(layoutTables)
  const violations: Array<{ tableType: number; name: string; currentCount: number; maxCount: number }> = []

  for (const config of configs) {
    if (config.MAX_COUNT === null) continue
    const currentCount = counts.get(config.TABLE_TYPE) ?? 0
    if (currentCount > config.MAX_COUNT) {
      violations.push({
        tableType: config.TABLE_TYPE,
        name: config.NAME,
        currentCount,
        maxCount: config.MAX_COUNT,
      })
    }
  }

  return violations
}
