// ─────────────────────────────────────────────────────────────────────────────
// Layout Preset Service — Supabase CRUD for Table_Layout_Presets
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from '@/lib/supabase'
import type { FloorConfig } from '@/utils/floorPlan/grid'
import type { TablePosition } from '@/utils/floorPlan/collision'
import type { MergeGroup } from '@/utils/floorPlan/adjacency'

export interface LayoutPreset {
  PRESET_ID: number
  PRESET_NAME: string
  DESCRIPTION: string | null
  FLOOR_WIDTH_BLOCKS: number
  FLOOR_HEIGHT_BLOCKS: number
  TABLE_SIZE_BLOCKS: number
  TABLE_SPACING_BLOCKS: number
  SNAP_TO_GRID: boolean
  LAYOUT_DATA: Array<{
    tableId: number
    x: number
    y: number
    widthBlocks?: number
    heightBlocks?: number
    rotation?: number
    capacity?: number
    tableNum?: number
  }>
  MERGE_GROUPS: Array<{ anchorId: number; memberIds: number[] }>
  IS_ACTIVE: boolean
  EVENT_ID?: number | null
  CREATED_AT: string
  UPDATED_AT: string
  CREATED_BY: string | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPresetRow(row: Record<string, any>): LayoutPreset {
  let eventId: number | null = row['EVENT_ID'] != null ? Number(row['EVENT_ID']) : null
  const description = row['DESCRIPTION'] ?? null
  if (eventId == null && typeof description === 'string') {
    const match = description.match(/\[EVENT_ID:(\d+)\]/)
    if (match) eventId = Number(match[1])
  }

  return {
    PRESET_ID: row['PRESET_ID'],
    PRESET_NAME: row['PRESET_NAME'],
    DESCRIPTION: description,
    FLOOR_WIDTH_BLOCKS: row['FLOOR_WIDTH_BLOCKS'],
    FLOOR_HEIGHT_BLOCKS: row['FLOOR_HEIGHT_BLOCKS'],
    TABLE_SIZE_BLOCKS: row['TABLE_SIZE_BLOCKS'],
    TABLE_SPACING_BLOCKS: row['TABLE_SPACING_BLOCKS'],
    SNAP_TO_GRID: row['SNAP_TO_GRID'],
    LAYOUT_DATA: row['LAYOUT_DATA'] ?? [],
    MERGE_GROUPS: row['MERGE_GROUPS'] ?? [],
    IS_ACTIVE: Boolean(row['IS_ACTIVE']),
    EVENT_ID: eventId,
    CREATED_AT: row['CREATED_AT'],
    UPDATED_AT: row['UPDATED_AT'],
    CREATED_BY: row['CREATED_BY'] ?? null,
  }
}

// ── Fetch ────────────────────────────────────────────────────────────────────

export async function fetchAllPresets(): Promise<LayoutPreset[]> {
  const { data, error } = await supabase
    .from('Table_Layout_Presets')
    .select('*')
    .order('CREATED_AT', { ascending: false })

  if (error) throw error
  return (data ?? []).map(mapPresetRow)
}

export async function fetchActivePreset(): Promise<LayoutPreset | null> {
  const { data, error } = await supabase
    .from('Table_Layout_Presets')
    .select('*')
    .eq('IS_ACTIVE', true)
    .maybeSingle()

  if (error) throw error
  return data ? mapPresetRow(data) : null
}

export async function fetchPresetById(presetId: number): Promise<LayoutPreset | null> {
  const { data, error } = await supabase
    .from('Table_Layout_Presets')
    .select('*')
    .eq('PRESET_ID', presetId)
    .maybeSingle()

  if (error) throw error
  return data ? mapPresetRow(data) : null
}

// ── Create ───────────────────────────────────────────────────────────────────

export async function createPreset(
  name: string,
  description: string | null,
  config: FloorConfig,
  positions: TablePosition[],
  mergeGroups: MergeGroup[],
  eventId?: number | null,
): Promise<LayoutPreset> {
  if (!name.trim()) throw new Error('Preset name is required.')

  let descVal = description?.trim() || null
  if (eventId) {
    if (!descVal) descVal = `[EVENT_ID:${eventId}]`
    else if (!descVal.includes(`[EVENT_ID:${eventId}]`)) {
      descVal = `${descVal.replace(/\[EVENT_ID:\d+\]/g, '').trim()}\n[EVENT_ID:${eventId}]`.trim()
    }
  }

  const insertPayload: Record<string, unknown> = {
    PRESET_NAME: name.trim(),
    DESCRIPTION: descVal,
    FLOOR_WIDTH_BLOCKS: config.widthBlocks,
    FLOOR_HEIGHT_BLOCKS: config.heightBlocks,
    TABLE_SIZE_BLOCKS: config.tableSizeBlocks,
    TABLE_SPACING_BLOCKS: config.spacingBlocks,
    SNAP_TO_GRID: config.snapEnabled,
    LAYOUT_DATA: positions.map((p) => ({
      tableId: p.tableId,
      tableNum: (p as any).tableNum,
      capacity: (p as any).capacity,
      x: p.x,
      y: p.y,
      widthBlocks: p.widthBlocks,
      heightBlocks: p.heightBlocks,
      rotation: p.rotation ?? 0,
    })),
    MERGE_GROUPS: mergeGroups.map((g) => ({ anchorId: g.anchorId, memberIds: g.memberIds })),
    IS_ACTIVE: false,
  }

  if (eventId != null) {
    insertPayload['EVENT_ID'] = eventId
  }

  let res = await supabase.from('Table_Layout_Presets').insert(insertPayload).select().single()

  if (res.error && eventId != null && res.error.message.includes('EVENT_ID')) {
    delete insertPayload['EVENT_ID']
    res = await supabase.from('Table_Layout_Presets').insert(insertPayload).select().single()
  }

  if (res.error || !res.data) throw res.error ?? new Error('Failed to create preset.')
  return mapPresetRow(res.data)
}

// ── Update ───────────────────────────────────────────────────────────────────

export async function updatePreset(
  presetId: number,
  fields: Partial<{
    name: string
    description: string | null
    config: FloorConfig
    positions: TablePosition[]
    mergeGroups: MergeGroup[]
    eventId?: number | null
  }>,
): Promise<LayoutPreset> {
  const payload: Record<string, unknown> = { UPDATED_AT: new Date().toISOString() }

  if (fields.name !== undefined) payload.PRESET_NAME = fields.name.trim()

  let descVal = fields.description !== undefined ? (fields.description?.trim() || null) : undefined
  if (fields.eventId !== undefined) {
    if (fields.eventId) {
      const base = descVal ?? ''
      descVal = `${base.replace(/\[EVENT_ID:\d+\]/g, '').trim()}\n[EVENT_ID:${fields.eventId}]`.trim()
    } else if (descVal) {
      descVal = descVal.replace(/\[EVENT_ID:\d+\]/g, '').trim() || null
    }
    payload['EVENT_ID'] = fields.eventId
  }

  if (descVal !== undefined) payload.DESCRIPTION = descVal

  if (fields.config) {
    payload.FLOOR_WIDTH_BLOCKS = fields.config.widthBlocks
    payload.FLOOR_HEIGHT_BLOCKS = fields.config.heightBlocks
    payload.TABLE_SIZE_BLOCKS = fields.config.tableSizeBlocks
    payload.TABLE_SPACING_BLOCKS = fields.config.spacingBlocks
    payload.SNAP_TO_GRID = fields.config.snapEnabled
  }
  if (fields.positions) {
    payload.LAYOUT_DATA = fields.positions.map((p) => ({
      tableId: p.tableId,
      tableNum: (p as any).tableNum,
      capacity: (p as any).capacity,
      x: p.x,
      y: p.y,
      widthBlocks: p.widthBlocks,
      heightBlocks: p.heightBlocks,
      rotation: p.rotation ?? 0,
    }))
  }
  if (fields.mergeGroups) {
    payload.MERGE_GROUPS = fields.mergeGroups.map((g) => ({ anchorId: g.anchorId, memberIds: g.memberIds }))
  }

  let res = await supabase
    .from('Table_Layout_Presets')
    .update(payload)
    .eq('PRESET_ID', presetId)
    .select()
    .single()

  if (res.error && fields.eventId !== undefined && res.error.message.includes('EVENT_ID')) {
    delete payload['EVENT_ID']
    res = await supabase
      .from('Table_Layout_Presets')
      .update(payload)
      .eq('PRESET_ID', presetId)
      .select()
      .single()
  }

  if (res.error || !res.data) throw res.error ?? new Error('Failed to update preset.')
  return mapPresetRow(res.data)
}

/** Link or unlink a preset to an event */
export async function linkPresetToEvent(presetId: number, eventId: number | null): Promise<LayoutPreset> {
  return updatePreset(presetId, { eventId })
}

// ── Delete ───────────────────────────────────────────────────────────────────

export async function deletePreset(presetId: number): Promise<void> {
  const { error } = await supabase
    .from('Table_Layout_Presets')
    .delete()
    .eq('PRESET_ID', presetId)

  if (error) throw error
}

// ── Set Active ───────────────────────────────────────────────────────────────

export async function setActivePreset(presetId: number): Promise<LayoutPreset> {
  // Deactivate all presets
  await supabase
    .from('Table_Layout_Presets')
    .update({ IS_ACTIVE: false })
    .eq('IS_ACTIVE', true)

  // Activate the selected one
  const { data, error } = await supabase
    .from('Table_Layout_Presets')
    .update({ IS_ACTIVE: true, UPDATED_AT: new Date().toISOString() })
    .eq('PRESET_ID', presetId)
    .select()
    .single()

  if (error || !data) throw error ?? new Error('Failed to activate preset.')
  return data as LayoutPreset
}

// ── Apply Preset Positions to Restaurant_Tables ──────────────────────────────

/**
 * Load a preset and apply its table positions to the Restaurant_Tables rows.
 * Updates LAYOUT_X / LAYOUT_Y on referenced tables, and clears them on unreferenced tables.
 */
export async function applyPresetPositions(
  preset: LayoutPreset,
): Promise<void> {
  const positions = preset.LAYOUT_DATA ?? []
  const activeIds = new Set(positions.map((p) => p.tableId))

  // Batch update positions
  for (const pos of positions) {
    await supabase
      .from('Restaurant_Tables')
      .update({
        LAYOUT_X: pos.x,
        LAYOUT_Y: pos.y,
        ...(pos.capacity ? { GUEST_CAPACITY: pos.capacity } : {}),
      })
      .eq('TABLE_ID', pos.tableId)
  }

  // Clear positions for tables not belonging to this preset
  const { data: allTables } = await supabase.from('Restaurant_Tables').select('TABLE_ID')
  if (allTables) {
    const unreferencedIds = allTables
      .map((t) => Number(t.TABLE_ID))
      .filter((id) => !activeIds.has(id))
    if (unreferencedIds.length > 0) {
      await supabase
        .from('Restaurant_Tables')
        .update({ LAYOUT_X: null, LAYOUT_Y: null })
        .in('TABLE_ID', unreferencedIds)
    }
  }
}

// ── Batch Update Positions (for saving current layout) ───────────────────────

export async function batchUpdateTablePositions(
  positions: Array<{ tableId: number; x: number | null; y: number | null }>,
): Promise<void> {
  for (const pos of positions) {
    const { error } = await supabase
      .from('Restaurant_Tables')
      .update({ LAYOUT_X: pos.x, LAYOUT_Y: pos.y })
      .eq('TABLE_ID', pos.tableId)

    if (error) throw new Error(`Failed to save table ${pos.tableId}'s position: ${error.message}`)
  }
}

/** Clear floor plan coordinates for specified tables */
export async function clearTablePositions(tableIds: number[]): Promise<void> {
  if (tableIds.length === 0) return
  const { error } = await supabase
    .from('Restaurant_Tables')
    .update({ LAYOUT_X: null, LAYOUT_Y: null })
    .in('TABLE_ID', tableIds)

  if (error) throw new Error(`Failed to clear table positions: ${error.message}`)
}

