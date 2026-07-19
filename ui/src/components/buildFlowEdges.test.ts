import { describe, it, expect } from 'vitest'
import { MarkerType } from '@xyflow/react'
import { buildFlowEdges } from './buildFlowEdges'
import { computeEdgeRouting } from '../lib/edgeGeometry'
import type { DiagramEdgeData } from '../lib/types'

const nodes = [
  { id: 'a', x: 0, y: 0, width: 180, height: 60 },
  { id: 'b', x: 200, y: 0, width: 180, height: 60 },
]

function route(edges: DiagramEdgeData[]) {
  return computeEdgeRouting(
    nodes,
    edges.map((e) => ({ id: `${e.from}->${e.to}`, from: e.from, to: e.to }))
  )
}

describe('buildFlowEdges', () => {
  it('gives a plain edge with no relationship a default arrow marker', () => {
    const edges: DiagramEdgeData[] = [{ from: 'a', to: 'b' }]
    const [flowEdge] = buildFlowEdges(edges, route(edges))
    expect(flowEdge.markerEnd).toEqual({ type: MarkerType.ArrowClosed, color: 'var(--edge-arrow)', width: 16, height: 16 })
  })

  it('uses the composition marker id for a uml-structural composition edge', () => {
    const edges: DiagramEdgeData[] = [{ from: 'a', to: 'b', relationship: 'composition' }]
    const [flowEdge] = buildFlowEdges(edges, route(edges))
    expect(flowEdge.markerEnd).toBe('url(#uml-composition)')
  })

  it('uses the inheritance marker id for a uml-structural inheritance edge', () => {
    const edges: DiagramEdgeData[] = [{ from: 'a', to: 'b', relationship: 'inheritance' }]
    const [flowEdge] = buildFlowEdges(edges, route(edges))
    expect(flowEdge.markerEnd).toBe('url(#uml-inheritance)')
  })

  it('falls back to the default arrow for association/dependency (no dedicated marker shape)', () => {
    const edges: DiagramEdgeData[] = [{ from: 'a', to: 'b', relationship: 'association' }]
    const [flowEdge] = buildFlowEdges(edges, route(edges))
    expect(flowEdge.markerEnd).toEqual({ type: MarkerType.ArrowClosed, color: 'var(--edge-arrow)', width: 16, height: 16 })
  })

  it('renders a dashed stroke for an async uml-behavioral edge', () => {
    const edges: DiagramEdgeData[] = [{ from: 'a', to: 'b', async: true }]
    const [flowEdge] = buildFlowEdges(edges, route(edges))
    expect((flowEdge.style as { strokeDasharray?: string }).strokeDasharray).toBe('4 3')
  })

  it('renders a dashed stroke for a dependency relationship', () => {
    const edges: DiagramEdgeData[] = [{ from: 'a', to: 'b', relationship: 'dependency' }]
    const [flowEdge] = buildFlowEdges(edges, route(edges))
    expect((flowEdge.style as { strokeDasharray?: string }).strokeDasharray).toBe('4 3')
  })

  it('does not dash a plain edge', () => {
    const edges: DiagramEdgeData[] = [{ from: 'a', to: 'b' }]
    const [flowEdge] = buildFlowEdges(edges, route(edges))
    expect((flowEdge.style as { strokeDasharray?: string }).strokeDasharray).toBeUndefined()
  })

  it('combines order, label, and condition into the edge label text', () => {
    const edges: DiagramEdgeData[] = [{ from: 'a', to: 'b', label: 'calls', order: 2, condition: 'on retry' }]
    const [flowEdge] = buildFlowEdges(edges, route(edges))
    expect(flowEdge.label).toBe('2. calls [on retry]')
  })

  it('carries the sourceHandle/targetHandle assigned by routing', () => {
    const edges: DiagramEdgeData[] = [{ from: 'a', to: 'b' }]
    const routing = route(edges)
    const [flowEdge] = buildFlowEdges(edges, routing)
    expect(flowEdge.sourceHandle).toBe(routing.edgeRouting[0].sourceHandle)
    expect(flowEdge.targetHandle).toBe(routing.edgeRouting[0].targetHandle)
  })
})
