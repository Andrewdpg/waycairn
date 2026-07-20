import type { CSSProperties } from 'react'
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type Position } from '@xyflow/react'

// ponytail: typed against exactly the props this component reads, not
// @xyflow/react's EdgeProps<Edge> generic — same reasoning as DiagramNode.tsx:
// React Flow calls edge components with more props at runtime (selected,
// source, target, ...) than we declare or use, and pinning to the library's
// own generic type couples this file to a shape that has changed across
// major versions.
export interface DiagramEdgeProps {
  id: string
  sourceX: number
  sourceY: number
  targetX: number
  targetY: number
  sourcePosition: Position
  targetPosition: Position
  style?: CSSProperties
  markerEnd?: string
  label?: string
  data?: { isHovered?: boolean }
}

// Collapsed to a small pill by default so a busy diagram isn't wall-to-wall
// text — full label only reveals on hover (of the line or, since the label
// itself has pointerEvents: none below, whatever's under it, which is the
// same edge's wider invisible hit-path React Flow already renders).
const COLLAPSED_MAX_WIDTH = 48

export function DiagramEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  label,
  data,
}: DiagramEdgeProps) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 8,
  })

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
      {label && (
        <EdgeLabelRenderer>
          <div
            className="badge"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'none',
              opacity: style?.opacity,
              maxWidth: data?.isHovered ? 'none' : COLLAPSED_MAX_WIDTH,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              transition: 'max-width var(--transition)',
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
