import type { ComponentType } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  useNodesState,
  useUpdateNodeInternals,
  type Edge,
  type Node,
  type OnNodesChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { DiagramNode } from './DiagramNode'
import { DiagramEdge } from './DiagramEdge'
import { ExportImageButton } from './ExportImageButton'
import { UmlMarkerDefs } from './umlMarkers'
import { buildFlowEdges } from './buildFlowEdges'
import { computeEdgeRouting, computeHandleSignature } from '../lib/edgeGeometry'
import { computeHighlightedIds, type HoverTarget } from '../lib/hoverHighlight'
import { estimateNodeSize } from '../lib/autoLayout'
import type { PositionedNode } from '../lib/autoLayout'
import type { DiagramEdgeData } from '../lib/types'

// ponytail: DiagramNode declares its own minimal prop type (just `data`)
// rather than @xyflow/react's NodeProps, so it's cast here at the one place
// that's wired into the library. See DiagramNode.tsx for why.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nodeTypes = { diagramNode: DiagramNode as ComponentType<any> }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const edgeTypes = { diagramEdge: DiagramEdge as ComponentType<any> }

export interface DiagramCanvasProps {
  nodes: PositionedNode[]
  edges: DiagramEdgeData[]
  onNodeClick: (nodeId: string) => void
  onNodeDetailRequest?: (nodeId: string) => void
}

interface DiagramFlowProps {
  renderedNodes: Node[]
  flowEdges: Edge[]
  onNodesChange: OnNodesChange
  onNodeClick: (nodeId: string) => void
  handleNodeIds: string[]
  handleSignature: string
}

// ponytail: `useUpdateNodeInternals` only works inside <ReactFlowProvider>,
// so this has to be a child component, not called directly in DiagramCanvas
// (which is the one rendering the provider). Whenever ANY node's handle set
// or handle positions change (a drag moves an edge from, say, its left side
// to its top side, or just rebalances offsets among edges that already
// shared a side), React Flow keeps stale bounds for the affected handle ids
// until told to re-measure — without this, edges referencing those ids
// silently fail to render (this is React Flow's documented "dynamic
// handles" gotcha). The effect is keyed on `handleSignature` (every node's
// full list of handle id/side/offset, not just which nodes have handles at
// all) — keying on the node-id set alone misses the common case where the
// SAME nodes keep having handles but their ids/offsets are reshuffled.
function DiagramFlow({ renderedNodes, flowEdges, onNodesChange, onNodeClick, handleNodeIds, handleSignature }: DiagramFlowProps) {
  const updateNodeInternals = useUpdateNodeInternals()
  const [hovered, setHovered] = useState<HoverTarget>(null)
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    for (const nodeId of handleNodeIds) {
      updateNodeInternals(nodeId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleSignature, updateNodeInternals])

  useEffect(
    () => () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
    },
    []
  )

  // ponytail: a dense diagram has edges/labels everywhere, so the mouse
  // crosses several hover targets just passing through — committing to a
  // hover immediately made the whole canvas flicker. Only commit after the
  // mouse rests on a target for HOVER_INTENT_MS; leaving always clears
  // immediately (and cancels any pending commit) so the highlight never
  // lags on exit, only on entry.
  const HOVER_INTENT_MS = 150
  function commitHover(target: HoverTarget) {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }
    if (target === null) {
      setHovered(null)
      return
    }
    hoverTimeoutRef.current = setTimeout(() => setHovered(target), HOVER_INTENT_MS)
  }

  const highlight = computeHighlightedIds(
    hovered,
    flowEdges.map((e) => ({ id: e.id as string, from: e.source, to: e.target }))
  )

  const styledNodes =
    highlight.nodeIds.size === 0
      ? renderedNodes
      : renderedNodes.map((n) => {
          const opacity = highlight.nodeIds.has(n.id) ? 1 : 0.3
          return {
            ...n,
            style: { ...n.style, opacity, transition: 'opacity var(--transition)' },
            data: { ...n.data, opacity },
          }
        })

  const styledEdges =
    highlight.nodeIds.size === 0
      ? flowEdges
      : flowEdges.map((e) => ({
          ...e,
          style: {
            ...e.style,
            opacity: highlight.edgeIds.has(e.id as string) ? 1 : 0.15,
            transition: 'opacity var(--transition)',
          },
          data: { ...e.data, isHovered: hovered?.type === 'edge' && hovered.id === e.id },
        }))

  return (
    <ReactFlow
      nodes={styledNodes}
      edges={styledEdges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={onNodesChange}
      onNodeClick={(_, node) => onNodeClick(node.id)}
      onNodeMouseEnter={(_, node) => commitHover({ type: 'node', id: node.id })}
      onNodeMouseLeave={() => commitHover(null)}
      onEdgeMouseEnter={(_, edge) => commitHover({ type: 'edge', id: edge.id })}
      onEdgeMouseLeave={() => commitHover(null)}
      fitView
      defaultEdgeOptions={{ style: { stroke: 'var(--edge-stroke)' } }}
    >
      <Background variant={BackgroundVariant.Dots} color="var(--border)" gap={20} />
      <Controls style={{ filter: 'invert(0.9) hue-rotate(220deg) saturate(0.6)' }} />
      <MiniMap
        pannable
        zoomable
        maskColor="rgba(12, 13, 16, 0.75)"
        style={{ background: 'var(--surface)' }}
        nodeColor={(n) => {
          const kind = (n.data as { kind?: string }).kind
          return kind ? `var(--kind-${kind}-fg)` : 'var(--text-faint)'
        }}
      />
      <Panel position="top-right">
        <ExportImageButton />
      </Panel>
    </ReactFlow>
  )
}

export function DiagramCanvas({ nodes, edges, onNodeClick, onNodeDetailRequest }: DiagramCanvasProps) {
  // ponytail: React Flow needs its own node state to keep drag positions —
  // passing a freshly-computed `nodes` array straight into `<ReactFlow>`
  // resets positions to the auto-layout on every unrelated re-render (e.g.
  // opening the detail panel). Re-seed only when the diagram itself changes
  // (different node ids), not on every parent render.
  const diagramKey = useMemo(() => JSON.stringify(nodes), [nodes])

  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState<Node>([])

  useEffect(() => {
    setFlowNodes(
      nodes.map((n) => ({
        id: n.id,
        position: { x: n.x, y: n.y },
        data: {
          id: n.id,
          label: n.label,
          kind: n.kind,
          responsibility: n.responsibility,
          techStack: n.techStack,
          dataOwned: n.dataOwned,
          gotchas: n.gotchas,
          attributes: n.attributes,
          operations: n.operations,
          columns: n.columns,
          onOpenDetail: onNodeDetailRequest,
        },
        type: 'diagramNode',
      }))
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diagramKey, onNodeDetailRequest])

  // ponytail: recomputed from `flowNodes`' LIVE positions (not the static
  // `nodes` prop) so dragging a box re-evaluates which side is actually
  // closest — keyed on a position-signature string, not the flowNodes array
  // reference, so it only recomputes when a position value actually changes.
  // Deliberately NOT stored back into flowNodes via a `setFlowNodes` effect:
  // that would make routing depend on flowNodes and flowNodes depend on
  // routing's output, ping-ponging forever. Instead it's merged into the
  // node list at render time, below.
  const positionSignature = flowNodes.map((n) => `${n.id}:${n.position.x}:${n.position.y}`).join('|')
  const routing = useMemo(() => {
    const sized = flowNodes.map((n) => {
      const original = nodes.find((orig) => orig.id === n.id)
      const size = original ? estimateNodeSize(original) : { width: 180, height: 60 }
      return { id: n.id, x: n.position.x, y: n.position.y, ...size }
    })
    return computeEdgeRouting(
      sized,
      edges.map((e) => ({ id: `${e.from}->${e.to}`, from: e.from, to: e.to }))
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positionSignature, edges, nodes])

  const renderedNodes: Node[] = flowNodes.map((n) => ({
    ...n,
    data: { ...n.data, handlePlacements: routing.nodeHandles.get(n.id) ?? [] },
  }))

  const flowEdges = buildFlowEdges(edges, routing)

  const handleSignature = computeHandleSignature(routing.nodeHandles)

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <UmlMarkerDefs />
      <ReactFlowProvider>
        <DiagramFlow
          renderedNodes={renderedNodes}
          flowEdges={flowEdges}
          onNodesChange={onNodesChange}
          onNodeClick={onNodeClick}
          handleNodeIds={[...routing.nodeHandles.keys()]}
          handleSignature={handleSignature}
        />
      </ReactFlowProvider>
    </div>
  )
}
