// ─────────────────────────────────────────────────────────────────────────────
// Custom Table Templates Service — Persistent Storage in Supabase & LocalStorage
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from '@/lib/supabase'

export interface TableTemplate {
  id: string
  label: string
  seats: number
  widthBlocks: number
  heightBlocks: number
  isCustom?: boolean
}

export const DEFAULT_TABLE_TEMPLATES: TableTemplate[] = [
  { id: 'tmpl-2top', label: '2-TOP', seats: 2, widthBlocks: 2, heightBlocks: 2, isCustom: false },
  { id: 'tmpl-4top', label: '4-TOP', seats: 4, widthBlocks: 2, heightBlocks: 2, isCustom: false },
]

const TEMPLATES_STORAGE_KEY = 'monolith_table_templates'

/** Read cached templates from localStorage */
export function getLocalTemplates(): TableTemplate[] {
  try {
    const raw = localStorage.getItem(TEMPLATES_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
      }
    }
  } catch {
    // ignore parsing errors
  }
  return [...DEFAULT_TABLE_TEMPLATES]
}

/** Save templates cache to localStorage */
export function saveLocalTemplates(templates: TableTemplate[]): void {
  try {
    localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(templates))
  } catch {
    // ignore storage quota errors
  }
}

/** Fetch all templates (defaults + persistent custom templates) */
export async function fetchAllTableTemplates(): Promise<TableTemplate[]> {
  const localList = getLocalTemplates()

  try {
    const { data, error } = await supabase
      .from('Custom_Table_Templates')
      .select('*')
      .order('CREATED_AT', { ascending: true })

    if (error) throw error

    const dbTemplates: TableTemplate[] = (data ?? []).map((row: Record<string, unknown>) => ({
      id: String(row['TEMPLATE_ID']),
      label: String(row['LABEL']),
      seats: Number(row['SEATS']),
      widthBlocks: Number(row['WIDTH_BLOCKS'] ?? 2),
      heightBlocks: Number(row['HEIGHT_BLOCKS'] ?? 2),
      isCustom: Boolean(row['IS_CUSTOM'] ?? true),
    }))

    // Merge default templates, DB templates, and any un-synced local custom templates
    const map = new Map<string, TableTemplate>()

    DEFAULT_TABLE_TEMPLATES.forEach((t) => map.set(t.id, t))
    localList.forEach((t) => {
      if (t.isCustom) map.set(t.id, t)
    })
    dbTemplates.forEach((t) => map.set(t.id, t))

    const merged = Array.from(map.values())
    saveLocalTemplates(merged)
    return merged
  } catch {
    // If Supabase table is not yet migrated or offline, return local cache
    return localList
  }
}

/** Persist a custom table template to Supabase & LocalStorage */
export async function saveCustomTemplate(template: TableTemplate): Promise<void> {
  const current = getLocalTemplates()
  const exists = current.some((t) => t.id === template.id)
  const updated = exists
    ? current.map((t) => (t.id === template.id ? template : t))
    : [...current, template]
  saveLocalTemplates(updated)

  // Asynchronously upsert to Supabase
  try {
    await supabase.from('Custom_Table_Templates').upsert({
      TEMPLATE_ID: template.id,
      LABEL: template.label.trim(),
      SEATS: template.seats,
      WIDTH_BLOCKS: template.widthBlocks,
      HEIGHT_BLOCKS: template.heightBlocks,
      IS_CUSTOM: true,
      UPDATED_AT: new Date().toISOString(),
    })
  } catch (err) {
    console.warn('[templateService] Failed to upsert custom template to Supabase:', err)
  }
}

/** Delete a custom table template permanently from Supabase & LocalStorage */
export async function deleteCustomTemplate(templateId: string): Promise<void> {
  const current = getLocalTemplates()
  const filtered = current.filter((t) => t.id !== templateId)
  saveLocalTemplates(filtered)

  try {
    await supabase.from('Custom_Table_Templates').delete().eq('TEMPLATE_ID', templateId)
  } catch (err) {
    console.warn('[templateService] Failed to delete custom template from Supabase:', err)
  }
}
