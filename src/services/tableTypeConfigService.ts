import { supabase } from '@/lib/supabase'
import { TABLE_TYPES, TABLE_TYPE_MAX_CAPACITIES, type TableType } from '@/services/tableLayoutService'

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
 * Fetch all table type configs, ordered by TABLE_TYPE_ID ascending.
 */
export async function fetchAllTypeConfigs(): Promise<TableTypeConfig[]> {
  const { data, error } = await supabase
    .schema('tables')
    .from('Table_Types')
    .select('*')
    .order('TABLE_TYPE_ID', { ascending: true })

  if (error) {
    console.error('[tableTypeConfigService] Error fetching type configs from Table_Types:', error)
    return []
  }

  return (data ?? []).map((row: Record<string, unknown>) => {
    const id = Number(row.TABLE_TYPE_ID)
    const maxCap = TABLE_TYPE_MAX_CAPACITIES[id as TableType] ?? 14
    const rawCap = Number(row.DEFAULT_SEAT_CAPACITY ?? 4)
    return {
      TYPE_CONFIG_ID: id,
      TABLE_TYPE: id,
      NAME: String(row.NAME ?? ''),
      CAPACITY: Math.min(rawCap, maxCap),
      MAX_COUNT: row.TABLES_IN_STOCK != null ? Number(row.TABLES_IN_STOCK) : null,
      IS_ACTIVE: Boolean(row.IS_ACTIVE),
      CREATED_AT: row.CREATED_AT != null ? String(row.CREATED_AT) : undefined,
      UPDATED_AT: row.UPDATED_AT != null ? String(row.UPDATED_AT) : undefined,
    }
  })
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
    const maxCap = TABLE_TYPE_MAX_CAPACITIES[typeConfigId as TableType] ?? 14
    if (fields.capacity > maxCap) {
      throw new Error(`Seating capacity cannot exceed the maximum limit of ${maxCap} guests for this table type.`)
    }
    payload.DEFAULT_SEAT_CAPACITY = fields.capacity
  }
  if (fields.maxCount !== undefined) {
    if (fields.maxCount !== null && fields.maxCount < 0) throw new Error('Max count cannot be negative.')
    payload.TABLES_IN_STOCK = fields.maxCount
  }
  if (fields.isActive !== undefined) payload.IS_ACTIVE = fields.isActive

  const { data, error } = await supabase
    .schema('tables')
    .from('Table_Types')
    .update(payload)
    .eq('TABLE_TYPE_ID', typeConfigId)
    .select()
    .single()

  if (error || !data) throw error ?? new Error('Failed to update type config in Table_Types.')

  const id = Number(data.TABLE_TYPE_ID)
  const cap = Number(data.DEFAULT_SEAT_CAPACITY ?? 4)

  // Update in-memory TABLE_TYPES immediately
  const typeId = id as TableType
  if (TABLE_TYPES[typeId]) {
    TABLE_TYPES[typeId].defaultCapacity = cap
  }
  if (typeId === 2 && TABLE_TYPES[5]) {
    TABLE_TYPES[5].defaultCapacity = cap
  }

  return {
    TYPE_CONFIG_ID: id,
    TABLE_TYPE: id,
    NAME: String(data.NAME),
    CAPACITY: cap,
    MAX_COUNT: data.TABLES_IN_STOCK != null ? Number(data.TABLES_IN_STOCK) : null,
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

  // Count current tables of this type from layout or Table_Info
  let currentCount = 0
  if (layoutTables) {
    currentCount = layoutTables.filter((t) => t.TABLE_TYPE === tableType).length
  } else {
    const { data } = await supabase
      .schema('tables')
      .from('Table_Info')
      .select('TABLE_ID')
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
