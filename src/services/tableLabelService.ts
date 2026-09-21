import { supabase } from '@/lib/supabase'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface TableLabel {
  LABEL_ID: number
  NAME: string
  COLOR: string
  PRIORITY: number
  IS_ACTIVE: boolean
  CREATED_AT?: string
  UPDATED_AT?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Fetch
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch all labels ordered by PRIORITY ascending (lowest number = highest priority).
 */
export async function fetchAllLabels(): Promise<TableLabel[]> {
  const { data, error } = await supabase
    .schema('tables')
    .from('Table_Labels')
    .select('*')
    .order('PRIORITY', { ascending: true })
    .order('LABEL_ID', { ascending: true })

  if (error) {
    console.error('[tableLabelService] Error fetching labels:', error)
    return []
  }

  return (data ?? []).map((row: Record<string, unknown>) => ({
    LABEL_ID: Number(row.LABEL_ID),
    NAME: String(row.NAME ?? ''),
    COLOR: String(row.COLOR ?? '#6B7280'),
    PRIORITY: Number(row.PRIORITY ?? 100),
    IS_ACTIVE: Boolean(row.IS_ACTIVE),
    CREATED_AT: row.CREATED_AT != null ? String(row.CREATED_AT) : undefined,
    UPDATED_AT: row.UPDATED_AT != null ? String(row.UPDATED_AT) : undefined,
  }))
}

/**
 * Fetch only active labels.
 */
export async function fetchActiveLabels(): Promise<TableLabel[]> {
  const all = await fetchAllLabels()
  return all.filter((l) => l.IS_ACTIVE)
}

// ─────────────────────────────────────────────────────────────────────────────
// Create
// ─────────────────────────────────────────────────────────────────────────────

export async function createLabel(
  name: string,
  color: string,
  priority?: number,
): Promise<TableLabel> {
  if (!name.trim()) throw new Error('Label name is required.')

  // Auto-assign priority if not provided: max existing priority + 1
  let effectivePriority = priority
  if (effectivePriority === undefined) {
    const existing = await fetchAllLabels()
    effectivePriority = existing.length > 0
      ? Math.max(...existing.map((l) => l.PRIORITY)) + 1
      : 1
  }

  const { data, error } = await supabase
    .schema('tables')
    .from('Table_Labels')
    .insert({
      NAME: name.trim(),
      COLOR: color || '#6B7280',
      PRIORITY: effectivePriority,
      IS_ACTIVE: true,
      CREATED_AT: new Date().toISOString(),
      UPDATED_AT: new Date().toISOString(),
    })
    .select()
    .single()

  if (error || !data) throw error ?? new Error('Failed to create label.')

  return {
    LABEL_ID: Number(data.LABEL_ID),
    NAME: String(data.NAME),
    COLOR: String(data.COLOR),
    PRIORITY: Number(data.PRIORITY),
    IS_ACTIVE: Boolean(data.IS_ACTIVE),
    CREATED_AT: String(data.CREATED_AT),
    UPDATED_AT: String(data.UPDATED_AT),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Update
// ─────────────────────────────────────────────────────────────────────────────

export async function updateLabel(
  labelId: number,
  fields: Partial<{ name: string; color: string; priority: number; isActive: boolean }>,
): Promise<TableLabel> {
  const payload: Record<string, unknown> = { UPDATED_AT: new Date().toISOString() }

  if (fields.name !== undefined) payload.NAME = fields.name.trim()
  if (fields.color !== undefined) payload.COLOR = fields.color
  if (fields.priority !== undefined) payload.PRIORITY = fields.priority
  if (fields.isActive !== undefined) payload.IS_ACTIVE = fields.isActive

  const { data, error } = await supabase
    .schema('tables')
    .from('Table_Labels')
    .update(payload)
    .eq('LABEL_ID', labelId)
    .select()
    .single()

  if (error || !data) throw error ?? new Error('Failed to update label.')

  return {
    LABEL_ID: Number(data.LABEL_ID),
    NAME: String(data.NAME),
    COLOR: String(data.COLOR),
    PRIORITY: Number(data.PRIORITY),
    IS_ACTIVE: Boolean(data.IS_ACTIVE),
    CREATED_AT: String(data.CREATED_AT),
    UPDATED_AT: String(data.UPDATED_AT),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Delete
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Delete a label. First unsets LABEL_ID on all tables referencing this label.
 */
export async function deleteLabel(labelId: number): Promise<void> {
  // Unset LABEL_ID on Restaurant_Tables
  try {
    await supabase
      .schema('tables')
      .from('Restaurant_Tables')
      .update({ LABEL_ID: null })
      .eq('LABEL_ID', labelId)
  } catch {
    // Non-critical — continue with deletion
  }

  // Unset LABEL_ID on Table_Layout_Info
  try {
    await supabase
      .schema('tables')
      .from('Table_Layout_Info')
      .update({ LABEL_ID: null })
      .eq('LABEL_ID', labelId)
  } catch {
    // Non-critical
  }

  const { error } = await supabase
    .schema('tables')
    .from('Table_Labels')
    .delete()
    .eq('LABEL_ID', labelId)

  if (error) {
    console.error('[tableLabelService] Error deleting label:', error)
    throw error
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Reorder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reorder labels by updating their PRIORITY based on array position.
 * First item in the array gets priority 1, second gets 2, etc.
 */
export async function reorderLabels(orderedLabelIds: number[]): Promise<void> {
  for (let i = 0; i < orderedLabelIds.length; i++) {
    const { error } = await supabase
      .schema('tables')
      .from('Table_Labels')
      .update({ PRIORITY: i + 1, UPDATED_AT: new Date().toISOString() })
      .eq('LABEL_ID', orderedLabelIds[i])

    if (error) {
      console.error(`[tableLabelService] Error reordering label ${orderedLabelIds[i]}:`, error)
      throw error
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Assign Label to Table
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Assign a label to a table (or remove it by passing null).
 */
export async function assignLabelToTable(
  tableId: number,
  labelId: number | null,
): Promise<void> {
  // Update Restaurant_Tables by TABLE_ID
  const { data, error } = await supabase
    .schema('tables')
    .from('Restaurant_Tables')
    .update({ LABEL_ID: labelId })
    .eq('TABLE_ID', tableId)
    .select('TABLE_ID, TABLE_NUM')

  let resolvedTableNum: number = tableId
  if (error) {
    console.error('[tableLabelService] Error assigning label by TABLE_ID, attempting by TABLE_NUM:', error)
    const { data: numData, error: numError } = await supabase
      .schema('tables')
      .from('Restaurant_Tables')
      .update({ LABEL_ID: labelId })
      .eq('TABLE_NUM', tableId)
      .select('TABLE_ID, TABLE_NUM')

    if (numError) {
      console.error('[tableLabelService] Error assigning label by TABLE_NUM:', numError)
      throw error
    }
    if (numData && numData.length > 0) {
      resolvedTableNum = Number(numData[0].TABLE_NUM)
    }
  } else if (data && data.length > 0) {
    resolvedTableNum = Number(data[0].TABLE_NUM)
  } else {
    // If 0 rows matched by TABLE_ID, try by TABLE_NUM
    const { data: numData } = await supabase
      .schema('tables')
      .from('Restaurant_Tables')
      .update({ LABEL_ID: labelId })
      .eq('TABLE_NUM', tableId)
      .select('TABLE_ID, TABLE_NUM')
    if (numData && numData.length > 0) {
      resolvedTableNum = Number(numData[0].TABLE_NUM)
    }
  }

  // Also sync Table_Layout_Info for current layout snapshots
  try {
    await supabase
      .schema('tables')
      .from('Table_Layout_Info')
      .update({ LABEL_ID: labelId })
      .eq('TABLE_NUM', resolvedTableNum)
  } catch {
    // Non-critical
  }

  // Broadcast update for cross-interface sync
  if (typeof window !== 'undefined') {
    const detail = { type: 'table_label_changed', tableId, labelId }
    window.dispatchEvent(new CustomEvent('monolith-order-update', { detail }))

    try {
      const bc = new BroadcastChannel('monolith_order_events')
      bc.postMessage(detail)
      bc.close()
    } catch {
      // Ignore
    }
  }
}

/**
 * Assign a label to all tables in a merge group.
 */
export async function assignLabelToGroup(
  tableIds: number[],
  labelId: number | null,
): Promise<void> {
  if (tableIds.length === 0) return

  const { error } = await supabase
    .schema('tables')
    .from('Restaurant_Tables')
    .update({ LABEL_ID: labelId })
    .in('TABLE_ID', tableIds)

  if (error) {
    console.error('[tableLabelService] Error assigning label to group:', error)
    throw error
  }

  // Broadcast
  if (typeof window !== 'undefined') {
    const detail = { type: 'table_label_changed', tableIds, labelId }
    window.dispatchEvent(new CustomEvent('monolith-order-update', { detail }))

    try {
      const bc = new BroadcastChannel('monolith_order_events')
      bc.postMessage(detail)
      bc.close()
    } catch {
      // Ignore
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Group Label Resolution
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Given a list of label IDs (from merge group members), resolve the effective
 * label — the one with the lowest (highest-priority) PRIORITY number.
 *
 * Synchronous variant that requires pre-fetched labels.
 */
export function getEffectiveGroupLabel(
  memberLabelIds: (number | null | undefined)[],
  allLabels: TableLabel[],
): TableLabel | null {
  const activeLabelMap = new Map(allLabels.filter((l) => l.IS_ACTIVE).map((l) => [l.LABEL_ID, l]))

  let bestLabel: TableLabel | null = null

  for (const labelId of memberLabelIds) {
    if (labelId == null) continue
    const label = activeLabelMap.get(labelId)
    if (!label) continue

    if (!bestLabel || label.PRIORITY < bestLabel.PRIORITY) {
      bestLabel = label
    }
  }

  return bestLabel
}

/**
 * Get a label by ID from a pre-fetched list.
 */
export function getLabelById(
  labelId: number | null | undefined,
  allLabels: TableLabel[],
): TableLabel | null {
  if (labelId == null) return null
  return allLabels.find((l) => l.LABEL_ID === labelId) ?? null
}
