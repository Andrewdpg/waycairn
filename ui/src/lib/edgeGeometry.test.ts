import { describe, it, expect } from 'vitest'
import { computeEdgeRouting, computeHandleSignature } from './edgeGeometry'

const SIZE = { width: 180, height: 60 }

describe('computeEdgeRouting', () => {
  it('routes a horizontally-dominant edge (target mostly to the right) via source=right, target=left', () => {
    const nodes = [
      { id: 'a', x: 0, y: 0, ...SIZE },
      { id: 'b', x: 200, y: 0, ...SIZE },
    ]
    const edges = [{ id: 'a->b', from: 'a', to: 'b' }]

    const { edgeRouting, nodeHandles } = computeEdgeRouting(nodes, edges)

    expect(edgeRouting).toHaveLength(1)
    const aHandles = nodeHandles.get('a')!
    const bHandles = nodeHandles.get('b')!
    expect(aHandles.find((h) => h.id === edgeRouting[0].sourceHandle)?.side).toBe('right')
    expect(bHandles.find((h) => h.id === edgeRouting[0].targetHandle)?.side).toBe('left')
  })

  it('routes a horizontally-dominant back-reference (target to the left) via source=left, target=right — purely geometric, no forward/back distinction', () => {
    const nodes = [
      { id: 'a', x: 200, y: 0, ...SIZE },
      { id: 'b', x: 0, y: 0, ...SIZE },
    ]
    const edges = [{ id: 'a->b', from: 'a', to: 'b' }]

    const { edgeRouting, nodeHandles } = computeEdgeRouting(nodes, edges)

    const aHandles = nodeHandles.get('a')!
    const bHandles = nodeHandles.get('b')!
    // b is to the left of a, so a's closest side toward b is its own left,
    // and b's closest side toward a is its own right — same rule as the
    // forward case above, just mirrored. No special-casing by direction.
    expect(aHandles.find((h) => h.id === edgeRouting[0].sourceHandle)?.side).toBe('left')
    expect(bHandles.find((h) => h.id === edgeRouting[0].targetHandle)?.side).toBe('right')
  })

  it('routes a vertically-dominant edge (target mostly below) via source=bottom, target=top', () => {
    const nodes = [
      { id: 'a', x: 0, y: 0, ...SIZE },
      { id: 'b', x: 50, y: 200, ...SIZE },
    ]
    const edges = [{ id: 'a->b', from: 'a', to: 'b' }]

    const { edgeRouting, nodeHandles } = computeEdgeRouting(nodes, edges)

    const aHandles = nodeHandles.get('a')!
    const bHandles = nodeHandles.get('b')!
    expect(aHandles.find((h) => h.id === edgeRouting[0].sourceHandle)?.side).toBe('bottom')
    expect(bHandles.find((h) => h.id === edgeRouting[0].targetHandle)?.side).toBe('top')
  })

  it('gives every edge a unique handle id even when multiple edges share a (node, side)', () => {
    const nodes = [
      { id: 'a', x: 0, y: 0, ...SIZE },
      { id: 'b', x: 200, y: 0, ...SIZE },
      { id: 'c', x: 200, y: 20, ...SIZE },
    ]
    const edges = [
      { id: 'a->b', from: 'a', to: 'b' },
      { id: 'a->c', from: 'a', to: 'c' },
    ]

    const { edgeRouting } = computeEdgeRouting(nodes, edges)

    expect(edgeRouting[0].sourceHandle).not.toBe(edgeRouting[1].sourceHandle)
  })

  it('spreads multiple edges sharing the same (node, side) across distinct, evenly-spaced offsets', () => {
    const nodes = [
      { id: 'a', x: 0, y: 0, ...SIZE },
      { id: 'b', x: 200, y: 0, ...SIZE },
      { id: 'c', x: 200, y: 10, ...SIZE },
      { id: 'd', x: 200, y: 20, ...SIZE },
    ]
    const edges = [
      { id: 'a->b', from: 'a', to: 'b' },
      { id: 'a->c', from: 'a', to: 'c' },
      { id: 'a->d', from: 'a', to: 'd' },
    ]

    const { nodeHandles } = computeEdgeRouting(nodes, edges)
    const rightHandlesOnA = nodeHandles.get('a')!.filter((h) => h.side === 'right')

    expect(rightHandlesOnA).toHaveLength(3)
    const offsets = rightHandlesOnA.map((h) => h.offsetFraction).sort((x, y) => x - y)
    expect(offsets).toEqual([0.25, 0.5, 0.75])
    // no two edges share the exact same point
    expect(new Set(offsets).size).toBe(3)
  })

  it('spreads a cyclic pair (A->B and B->A) to distinct points, not the same one on each side', () => {
    const nodes = [
      { id: 'a', x: 0, y: 0, ...SIZE },
      { id: 'b', x: 200, y: 0, ...SIZE },
    ]
    const edges = [
      { id: 'a->b', from: 'a', to: 'b' },
      { id: 'b->a', from: 'b', to: 'a' },
    ]

    const { nodeHandles } = computeEdgeRouting(nodes, edges)

    // a's right side now carries BOTH the outgoing a->b source handle and
    // the incoming b->a target handle — they must not share an offset.
    const aRightHandles = nodeHandles.get('a')!.filter((h) => h.side === 'right')
    expect(aRightHandles).toHaveLength(2)
    expect(new Set(aRightHandles.map((h) => h.offsetFraction)).size).toBe(2)

    const bLeftHandles = nodeHandles.get('b')!.filter((h) => h.side === 'left')
    expect(bLeftHandles).toHaveLength(2)
    expect(new Set(bLeftHandles.map((h) => h.offsetFraction)).size).toBe(2)
  })

  it('orders handles on a side by the position of what they connect to, not by authoring/insertion order', () => {
    // d is authored first but sits at the bottom; b is authored second but
    // sits at the top; c is in the middle. All three are far enough right
    // that a's closest side to each is 'right'. Offsets must come out sorted
    // top-to-bottom (b, c, d) regardless of the a->d / a->b / a->c order
    // they were declared in — that's what keeps a straight, non-crossing
    // fan of lines instead of one that zigzags to match declaration order.
    const nodes = [
      { id: 'a', x: 0, y: 100, ...SIZE },
      { id: 'b', x: 200, y: 80, ...SIZE },
      { id: 'c', x: 200, y: 100, ...SIZE },
      { id: 'd', x: 200, y: 120, ...SIZE },
    ]
    const edges = [
      { id: 'a->d', from: 'a', to: 'd' },
      { id: 'a->b', from: 'a', to: 'b' },
      { id: 'a->c', from: 'a', to: 'c' },
    ]

    const { edgeRouting, nodeHandles } = computeEdgeRouting(nodes, edges)
    const aHandles = nodeHandles.get('a')!.filter((h) => h.side === 'right')

    const handleToEdge = new Map(edgeRouting.map((r) => [r.sourceHandle, r.edgeId]))
    const orderedByOffset = [...aHandles].sort((x, y) => x.offsetFraction - y.offsetFraction)
    const edgeIdsInOffsetOrder = orderedByOffset.map((h) => handleToEdge.get(h.id))

    expect(edgeIdsInOffsetOrder).toEqual(['a->b', 'a->c', 'a->d'])
  })

  it('computeHandleSignature changes when a drag reshuffles offsets even though the same nodes still have handles', () => {
    // Node c starts far below b, so a's two edges land on different sides
    // (b via right, c via bottom). After "moving" c up next to b (second
    // layout), both become right-side edges on a and must share/reshuffle
    // that side's offsets — same two node ids have handles in both layouts,
    // but the actual placements differ, and the signature must say so.
    const edges = [
      { id: 'a->b', from: 'a', to: 'b' },
      { id: 'a->c', from: 'a', to: 'c' },
    ]
    const before = computeEdgeRouting(
      [
        { id: 'a', x: 0, y: 0, ...SIZE },
        { id: 'b', x: 200, y: 0, ...SIZE },
        { id: 'c', x: 20, y: 300, ...SIZE },
      ],
      edges
    )
    const after = computeEdgeRouting(
      [
        { id: 'a', x: 0, y: 0, ...SIZE },
        { id: 'b', x: 200, y: 0, ...SIZE },
        { id: 'c', x: 200, y: 15, ...SIZE },
      ],
      edges
    )

    expect([...before.nodeHandles.keys()].sort()).toEqual([...after.nodeHandles.keys()].sort())
    expect(computeHandleSignature(before.nodeHandles)).not.toBe(computeHandleSignature(after.nodeHandles))
  })

  it('does not crash on an edge referencing an unknown node id (defensive — validation happens elsewhere)', () => {
    const nodes = [{ id: 'a', x: 0, y: 0, ...SIZE }]
    const edges = [{ id: 'a->ghost', from: 'a', to: 'ghost' }]

    const { edgeRouting } = computeEdgeRouting(nodes, edges)
    expect(edgeRouting).toHaveLength(0)
  })
})
