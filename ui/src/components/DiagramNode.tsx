import { Handle, Position } from '@xyflow/react'
import type { DiagramNodeData } from '../lib/types'
import type { HandlePlacement, Side } from '../lib/edgeGeometry'
import { NODE_SHAPES } from './nodeShapes'
import { getTechIcon } from '../lib/techIcons'
import { TechBadge } from './TechBadge'

export interface DiagramNodeProps {
  data: DiagramNodeData & { onOpenDetail?: (nodeId: string) => void; handlePlacements?: HandlePlacement[] }
}

const SIDE_TO_POSITION: Record<Side, Position> = {
  top: Position.Top,
  right: Position.Right,
  bottom: Position.Bottom,
  left: Position.Left,
}

// ponytail: typed against our own DiagramNodeData, not @xyflow/react's
// NodeProps — React Flow calls this with more props at runtime (id,
// selected, dragging, ...), which we simply don't declare or use. Avoids
// coupling to a type shape that has changed across major versions of the
// library.
export function DiagramNode({ data }: DiagramNodeProps) {
  const Shape = NODE_SHAPES[data.kind]
  const placements = data.handlePlacements ?? []

  return (
    <Shape node={data}>
      {placements.map((p) => (
        <Handle
          key={p.id}
          id={p.id}
          type={p.type}
          position={SIDE_TO_POSITION[p.side]}
          style={
            p.side === 'left' || p.side === 'right'
              ? { top: `${p.offsetFraction * 100}%`, transform: 'translateY(-50%)' }
              : { left: `${p.offsetFraction * 100}%`, transform: 'translateX(-50%)' }
          }
        />
      ))}
      {data.onOpenDetail && (
        <button
          className="node-eye-btn"
          aria-label={`View details for ${data.label}`}
          onClick={(e) => {
            e.stopPropagation()
            data.onOpenDetail?.(data.id)
          }}
          style={{
            position: 'absolute',
            top: -10,
            right: -10,
            width: 22,
            height: 22,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            color: 'var(--text)',
            cursor: 'pointer',
            fontSize: 11,
            lineHeight: 1,
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.4)',
          }}
        >
          👁
        </button>
      )}
      <span style={{ fontWeight: 600, fontSize: 13 }}>{data.label}</span>
      {data.responsibility && (
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{data.responsibility}</span>
      )}
      {data.techStack && data.techStack.length > 0 && (
        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', marginTop: 4 }}>
          {data.techStack.map((id) => (
            <TechBadge key={id} icon={getTechIcon(id)} />
          ))}
        </div>
      )}
    </Shape>
  )
}
