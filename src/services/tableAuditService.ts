import { supabase } from '@/lib/supabase'

// ─────────────────────────────────────────────────────────────────────────────
// Table Audit Service
//
// Thin wrapper around the existing Action_History system (migration 022)
// for table-management-specific actions.
// ─────────────────────────────────────────────────────────────────────────────

export type TableAuditAction =
  | 'TABLE_CREATED'
  | 'TABLE_DELETED'
  | 'ALL_TABLES_DELETED'
  | 'CAPACITY_CHANGED'
  | 'TYPE_CHANGED'
  | 'TYPE_LIMIT_CHANGED'
  | 'LAYOUT_CHANGED'
  | 'PRESET_CREATED'
  | 'PRESET_DELETED'
  | 'PRESET_APPLIED'
  | 'HIERARCHY_CHANGED'
  | 'LABEL_CREATED'
  | 'LABEL_UPDATED'
  | 'LABEL_DELETED'
  | 'LABEL_ASSIGNED'
  | 'DEFAULT_LAYOUT_MODIFIED'
  | 'EVENT_LAYOUT_APPLIED'
  | 'EVENT_LAYOUT_RESET'
  | 'TABLE_STATUS_CHANGED'
  | 'TABLES_MERGED'
  | 'TABLES_UNMERGED'

const MODULE = 'TABLE_MANAGEMENT'

/**
 * Log a table management action to Action_History.
 * Non-blocking — errors are logged but do not propagate.
 */
export async function logTableAction(
  actionType: TableAuditAction,
  description: string,
  options?: {
    targetEntity?: string
    targetId?: string
    previousState?: Record<string, unknown>
    newState?: Record<string, unknown>
    metadata?: Record<string, unknown>
    staffCode?: number
    staffName?: string
    staffRole?: string
  },
): Promise<void> {
  try {
    // Try using the log_staff_action function if staff code is available
    if (options?.staffCode) {
      await supabase.rpc('log_staff_action', {
        p_staff_code: options.staffCode,
        p_action_type: actionType,
        p_description: description,
        p_module: MODULE,
        p_target_entity: options?.targetEntity ?? null,
        p_target_id: options?.targetId ?? null,
        p_staff_name: options?.staffName ?? null,
        p_staff_role: options?.staffRole ?? null,
        p_previous_state: options?.previousState ?? null,
        p_new_state: options?.newState ?? null,
        p_metadata: options?.metadata ?? {},
      })
      return
    }

    // Direct insert if no staff code available
    await supabase.from('Action_History').insert({
      STAFF_CODE: null,
      STAFF_NAME: options?.staffName ?? 'System',
      STAFF_ROLE: options?.staffRole ?? 'SYSTEM',
      ACTION_TYPE: actionType,
      MODULE,
      DESCRIPTION: description,
      TARGET_ENTITY: options?.targetEntity ?? null,
      TARGET_ID: options?.targetId ?? null,
      PREVIOUS_STATE: options?.previousState ?? null,
      NEW_STATE: options?.newState ?? null,
      METADATA: options?.metadata ?? {},
    })
  } catch (err) {
    // Non-blocking — audit logging failures should not break operations
    console.warn('[tableAuditService] Failed to log action:', actionType, err)
  }
}

/**
 * Convenience: log a label hierarchy change.
 */
export async function logHierarchyChange(
  orderedLabelNames: string[],
  staffCode?: number,
): Promise<void> {
  await logTableAction('HIERARCHY_CHANGED', `Label hierarchy reordered: ${orderedLabelNames.join(' > ')}`, {
    staffCode,
    newState: { order: orderedLabelNames },
  })
}

/**
 * Convenience: log a layout preset change.
 */
export async function logPresetApplied(
  presetName: string,
  presetId: number,
  staffCode?: number,
): Promise<void> {
  await logTableAction('PRESET_APPLIED', `Layout preset "${presetName}" applied as default`, {
    staffCode,
    targetEntity: 'PRESET',
    targetId: String(presetId),
    metadata: { presetName },
  })
}
