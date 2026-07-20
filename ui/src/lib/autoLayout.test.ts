import { describe, it, expect } from 'vitest'
import { layoutDiagram, estimateNodeSize, NODE_MAX_WIDTH } from './autoLayout'
import type { DiagramNodeData, DiagramEdgeData } from './types'

describe('layoutDiagram', () => {
  it('assigns numeric x/y to every node', () => {
    const nodes: DiagramNodeData[] = [
      { id: 'a', label: 'A', kind: 'service' },
      { id: 'b', label: 'B', kind: 'service' },
    ]
    const edges: DiagramEdgeData[] = [{ from: 'a', to: 'b' }]

    const positioned = layoutDiagram(nodes, edges)

    expect(positioned).toHaveLength(2)
    for (const n of positioned) {
      expect(typeof n.x).toBe('number')
      expect(typeof n.y).toBe('number')
    }
  })

  it('places a downstream node to the right of its upstream node (rankdir LR)', () => {
    const nodes: DiagramNodeData[] = [
      { id: 'a', label: 'A', kind: 'service' },
      { id: 'b', label: 'B', kind: 'service' },
    ]
    const edges: DiagramEdgeData[] = [{ from: 'a', to: 'b' }]

    const [a, b] = layoutDiagram(nodes, edges)
    expect(b.x).toBeGreaterThan(a.x)
  })

  it('respects an explicit x/y override instead of computing one', () => {
    const nodes: DiagramNodeData[] = [{ id: 'a', label: 'A', kind: 'service', x: 999, y: 111 }]
    const [a] = layoutDiagram(nodes, [])
    expect(a.x).toBe(999)
    expect(a.y).toBe(111)
  })
})

describe('estimateNodeSize', () => {
  it('never estimates a width beyond NODE_MAX_WIDTH, even for a long label', () => {
    const node: DiagramNodeData = {
      id: 'a',
      label: 'A Very Long Label That Would Otherwise Blow Up The Box Width',
      kind: 'service',
    }
    expect(estimateNodeSize(node).width).toBeLessThanOrEqual(NODE_MAX_WIDTH)
  })

  it('grows the height estimate for a long responsibility (multi-line wrap), not a flat constant', () => {
    const short: DiagramNodeData = { id: 'a', label: 'A', kind: 'service', responsibility: 'Short.' }
    const long: DiagramNodeData = {
      id: 'a',
      label: 'A',
      kind: 'service',
      responsibility:
        'This is a much longer responsibility sentence that will need to wrap across several lines once the box width is capped, unlike a short one.',
    }
    expect(estimateNodeSize(long).height).toBeGreaterThan(estimateNodeSize(short).height)
  })

  it('grows the height estimate for a table node with many columns, not a flat constant', () => {
    const empty: DiagramNodeData = { id: 'a', label: 'users', kind: 'table' }
    const withColumns: DiagramNodeData = {
      id: 'a',
      label: 'users',
      kind: 'table',
      columns: Array.from({ length: 20 }, (_, i) => ({ name: `col${i}`, type: 'text' })),
    }
    expect(estimateNodeSize(withColumns).height).toBeGreaterThan(estimateNodeSize(empty).height)
  })
})
