// ─────────────────────────────────────────────────────────────────────────────
// FloorPlanEditor — Interactive floor plan canvas
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useRef, useEffect, useState, memo } from 'react'
import { calculateBlockSizePx, floorDimensionsPx } from '@/utils/floorPlan/grid'
import { previewAdjacency, findGroupForTable, getTableMergedSides, calculateGroupCombinedCapacity } from '@/utils/floorPlan/adjacency'
import { TableNode } from './TableNode'
import { MergeGroupOverlay } from './MergeGroupOverlay'
import type { FloorPlanState } from './useFloorPlanState'
import type { TableData } from '@/services/tableService'

interface FloorPlanEditorProps {
  floorPlan: FloorPlanState
  tables: TableData[]
  onSelectTable: (tableId: number | null) => void
}

export const FloorPlanEditor = memo(function FloorPlanEditor({
  floorPlan,
  tables,
  onSelectTable,
}: FloorPlanEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const floorRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 })
  const dragOffsetRef = useRef({ x: 0, y: 0 })

  const { config, positions, mergeGroups, selectedTableId, dragState, zoom } = floorPlan

  // ── Container sizing ───────────────────────────────────────────────────────

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        setContainerSize({ width, height })
      }
    })

    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  // ── Block size calculation ─────────────────────────────────────────────────

  const blockSizePx = calculateBlockSizePx(
    containerSize.width / zoom,
    containerSize.height / zoom,
    config.widthBlocks,
    config.heightBlocks,
  )

  const floorDims = floorDimensionsPx(config.widthBlocks, config.heightBlocks, blockSizePx)

  // ── Table data lookup ──────────────────────────────────────────────────────

  const tableDataMap = new Map(tables.map((t) => [t.TABLE_ID, t]))

  // ── Drag handling ──────────────────────────────────────────────────────────

  const handlePointerDown = useCallback((tableId: number, e: React.PointerEvent) => {
    const pos = positions.find((p) => p.tableId === tableId)
    if (!pos) return

    floorPlan.setSelectedTableId(tableId)
    onSelectTable(tableId)

    // Calculate offset from cursor to table top-left (in block units)
    const floorEl = floorRef.current
    if (!floorEl) return
    const rect = floorEl.getBoundingClientRect()
    const cursorBlockX = (e.clientX - rect.left) / (blockSizePx * zoom)
    const cursorBlockY = (e.clientY - rect.top) / (blockSizePx * zoom)
    dragOffsetRef.current = {
      x: cursorBlockX - pos.x,
      y: cursorBlockY - pos.y,
    }

    floorPlan.startDrag(tableId, pos.x, pos.y)

    // Capture pointer for drag tracking
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }, [positions, blockSizePx, zoom, floorPlan, onSelectTable])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragState) return

    const floorEl = floorRef.current
    if (!floorEl) return
    const rect = floorEl.getBoundingClientRect()
    const cursorBlockX = (e.clientX - rect.left) / (blockSizePx * zoom) - dragOffsetRef.current.x
    const cursorBlockY = (e.clientY - rect.top) / (blockSizePx * zoom) - dragOffsetRef.current.y

    floorPlan.updateDrag(
      Math.round(cursorBlockX),
      Math.round(cursorBlockY),
    )
  }, [dragState, blockSizePx, zoom, floorPlan])

  const handlePointerUp = useCallback(() => {
    if (!dragState) return
    floorPlan.endDrag()
  }, [dragState, floorPlan])

  // ── Click on empty floor ───────────────────────────────────────────────────

  const handleFloorClick = useCallback((e: React.MouseEvent) => {
    if (e.target === floorRef.current || e.target === containerRef.current) {
      onSelectTable(null)
    }
  }, [onSelectTable])

  // ── Handle table click ─────────────────────────────────────────────────────

  const handleTableClick = useCallback((tableId: number) => {
    floorPlan.setSelectedTableId(tableId)
    onSelectTable(tableId)
  }, [floorPlan, onSelectTable])

  // ── Adjacency preview for dragging ─────────────────────────────────────────

  const adjacencyPreview = dragState
    ? previewAdjacency(
        dragState.tableId,
        dragState.currentX,
        dragState.currentY,
        positions.filter((p) => p.tableId !== dragState.tableId),
        config.tableSizeBlocks,
      )
    : []

  // ── Wheel zoom ─────────────────────────────────────────────────────────────

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const delta = e.deltaY > 0 ? -0.1 : 0.1
      floorPlan.setZoom(zoom + delta)
    }
  }, [zoom, floorPlan])

  // ── Render ─────────────────────────────────────────────────────────────────

  const gridBgSize = blockSizePx
  const gridBgStyle = config.snapEnabled
    ? {
        backgroundImage: `
          linear-gradient(to right, rgba(20,39,78,0.06) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(20,39,78,0.06) 1px, transparent 1px)
        `,
        backgroundSize: `${gridBgSize}px ${gridBgSize}px`,
      }
    : {}

  return (
    <div
      ref={containerRef}
      className="fp-editor-container"
      onWheel={handleWheel}
      onClick={handleFloorClick}
    >
      <div
        className="fp-zoom-wrapper"
        style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
      >
        <div
          ref={floorRef}
          className="fp-floor"
          style={{
            width: `${floorDims.widthPx}px`,
            height: `${floorDims.heightPx}px`,
            ...gridBgStyle,
          }}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => floorPlan.cancelDrag()}
        >
          {/* Merge group overlays (rendered behind tables) */}
          {mergeGroups.map((group) => {
            const combinedCapacity = calculateGroupCombinedCapacity(
              group,
              tables,
              positions,
              config.tableSizeBlocks,
            )
            return (
              <MergeGroupOverlay
                key={`merge-${group.anchorId}`}
                group={group}
                combinedCapacity={combinedCapacity}
                positions={positions}
                blockSizePx={blockSizePx}
                tableSizeBlocks={config.tableSizeBlocks}
                isSelected={group.memberIds.includes(selectedTableId ?? -1)}
                onClick={(anchorId) => onSelectTable(anchorId)}
              />
            )
          })}

          {/* Adjacency preview highlight during drag */}
          {adjacencyPreview.length > 0 && dragState && (
            <div className="fp-adjacency-preview">
              {adjacencyPreview.map((id) => {
                const pos = positions.find((p) => p.tableId === id)
                if (!pos) return null
                const w = (pos.widthBlocks ?? config.tableSizeBlocks) * blockSizePx
                const h = (pos.heightBlocks ?? config.tableSizeBlocks) * blockSizePx
                return (
                  <div
                    key={`adj-${id}`}
                    className="fp-adjacency-highlight"
                    style={{
                      position: 'absolute',
                      left: `${pos.x * blockSizePx - 3}px`,
                      top: `${pos.y * blockSizePx - 3}px`,
                      width: `${w + 6}px`,
                      height: `${h + 6}px`,
                    }}
                  />
                )
              })}
            </div>
          )}

          {/* Table nodes */}
          {positions.map((pos) => {
            const tableData = tableDataMap.get(pos.tableId)
            if (!tableData) return null

            const isDragging = dragState?.tableId === pos.tableId
            const group = findGroupForTable(pos.tableId, mergeGroups)
            const mergeLabel = undefined

            const effectivePositions = dragState && dragState.isValid
              ? positions.map((p) => (p.tableId === dragState.tableId ? { ...p, x: dragState.currentX, y: dragState.currentY } : p))
              : positions

            const mergedSides = getTableMergedSides(
              pos.tableId,
              effectivePositions,
              config.tableSizeBlocks,
              mergeGroups,
            )

            return (
              <TableNode
                key={pos.tableId}
                table={tableData}
                x={pos.x}
                y={pos.y}
                blockSizePx={blockSizePx}
                tableSizeBlocks={config.tableSizeBlocks}
                widthBlocks={pos.widthBlocks}
                heightBlocks={pos.heightBlocks}
                rotation={pos.rotation}
                isSelected={selectedTableId === pos.tableId}
                isDragging={isDragging}
                dragX={isDragging ? dragState?.currentX : undefined}
                dragY={isDragging ? dragState?.currentY : undefined}
                isValidDrag={isDragging ? (dragState?.isValid ?? true) : true}
                isMerged={!!group && group.memberIds.length > 1}
                mergedSides={mergedSides}
                mergeLabel={mergeLabel}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onClick={handleTableClick}
                onRotate={floorPlan.rotateTable}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
})

export default FloorPlanEditor
