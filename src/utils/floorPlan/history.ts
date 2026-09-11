// ─────────────────────────────────────────────────────────────────────────────
// Undo / Redo History Manager
// ─────────────────────────────────────────────────────────────────────────────

import type { FloorConfig } from './grid'
import type { TablePosition } from './collision'
import type { MergeGroup } from './adjacency'

export interface FloorPlanSnapshot {
  positions: TablePosition[]
  mergeGroups: MergeGroup[]
  config: FloorConfig
  /** Table IDs present on the floor (used to detect add/remove) */
  tableIds: number[]
}

const MAX_HISTORY = 50

export class HistoryManager {
  private past: FloorPlanSnapshot[] = []
  private future: FloorPlanSnapshot[] = []

  get canUndo(): boolean {
    return this.past.length > 0
  }

  get canRedo(): boolean {
    return this.future.length > 0
  }

  /**
   * Push the current state before making a change.
   * Clears the redo stack (new branch of history).
   */
  push(snapshot: FloorPlanSnapshot): void {
    this.past.push(deepClone(snapshot))
    if (this.past.length > MAX_HISTORY) {
      this.past.shift()
    }
    this.future = []
  }

  /**
   * Undo: returns the previous state, saves current for redo.
   */
  undo(currentSnapshot: FloorPlanSnapshot): FloorPlanSnapshot | null {
    if (this.past.length === 0) return null
    this.future.push(deepClone(currentSnapshot))
    return this.past.pop()!
  }

  /**
   * Redo: returns the next state, saves current for undo.
   */
  redo(currentSnapshot: FloorPlanSnapshot): FloorPlanSnapshot | null {
    if (this.future.length === 0) return null
    this.past.push(deepClone(currentSnapshot))
    return this.future.pop()!
  }

  /** Clear all history. */
  clear(): void {
    this.past = []
    this.future = []
  }
}

function deepClone(snapshot: FloorPlanSnapshot): FloorPlanSnapshot {
  return {
    positions: snapshot.positions.map((p) => ({ ...p })),
    mergeGroups: snapshot.mergeGroups.map((g) => ({
      anchorId: g.anchorId,
      memberIds: [...g.memberIds],
    })),
    config: { ...snapshot.config },
    tableIds: [...snapshot.tableIds],
  }
}
