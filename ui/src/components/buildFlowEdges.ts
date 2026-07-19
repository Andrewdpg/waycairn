import { MarkerType, type Edge } from '@xyflow/react'
import { RELATIONSHIP_MARKER_IDS } from './umlMarkers'
import type { RoutingResult } from '../lib/edgeGeometry'
import type { DiagramEdgeData } from '../lib/types'

function buildEdgeLabel(e: DiagramEdgeData): string | undefined {
  const parts = [
    e.order !== undefined ? `${e.order}.` : null,
    e.label ?? null,
    e.condition ? `[${e.condition}]` : null,
  ].filter((part): part is string => part !== null)
  return parts.length > 0 ? parts.join(' ') : undefined
}

// ponytail: pulled out of DiagramCanvas as a pure function (no rendering)
// specifically so its marker/dash/label logic can be unit-tested directly —
// asserting on it via rendered DOM requires React Flow to have measured
// every node's named handle bounds, which jsdom's stubbed ResizeObserver
// never provides (see setupTests.ts), so `.react-flow__edge-path` never
// appears in tests even though this renders correctly in a real browser.
export function buildFlowEdges(edges: DiagramEdgeData[], routing: RoutingResult): Edge[] {
  const routingByEdgeId = new Map(routing.edgeRouting.map((r) => [r.edgeId, r]))

  return edges.map((e) => {
    const edgeId = `${e.from}->${e.to}`
    const markerId = e.relationship ? RELATIONSHIP_MARKER_IDS[e.relationship] : undefined
    const dashed = e.relationship === 'dependency' || e.async === true
    const routed = routingByEdgeId.get(edgeId)
    return {
      id: edgeId,
      source: e.from,
      target: e.to,
      sourceHandle: routed?.sourceHandle,
      targetHandle: routed?.targetHandle,
      label: buildEdgeLabel(e),
      // Every edge gets a direction marker — a plain arrow by default, or
      // the UML-specific composition/inheritance marker when the diagram's
      // notation supplies one. Previously only composition/inheritance got
      // a marker at all, so every c4/association/dependency edge rendered
      // as an undirected line.
      markerEnd: markerId
        ? `url(#${markerId})`
        : { type: MarkerType.ArrowClosed, color: 'var(--edge-arrow)', width: 16, height: 16 },
      style: { stroke: 'var(--edge-stroke)', strokeDasharray: dashed ? '4 3' : undefined },
      labelStyle: { fill: 'var(--edge-label-fg)', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 },
      labelBgStyle: { fill: 'var(--edge-label-bg)' },
    }
  })
}
