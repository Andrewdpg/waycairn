export type Side = 'top' | 'right' | 'bottom' | 'left'

export interface HandlePlacement {
  id: string
  type: 'source' | 'target'
  side: Side
  offsetFraction: number // 0..1, position along that side (0 = one corner, 1 = the other)
}

export interface EdgeRouting {
  edgeId: string
  sourceHandle: string
  targetHandle: string
}

export interface RoutingResult {
  edgeRouting: EdgeRouting[]
  nodeHandles: Map<string, HandlePlacement[]>
}

interface NodePosition {
  id: string
  x: number
  y: number
  width: number
  height: number
}

interface EdgeRef {
  id: string
  from: string
  to: string
}

// ponytail: purely geometric — picks whichever side of a node's rectangle is
// closest to the direction of the other node's center, the same way a
// "floating edge" would, using the node's own half-width/half-height to
// account for non-square boxes. Deliberately NOT direction-aware (forward
// vs. cyclic/back edges used to force bottom/top instead of left/right) —
// that semantic split caused edges to take a longer, tangled path instead of
// the geometrically direct one. Multiple edges landing on the same side of
// the same node are still spread apart (see registerHandle below), so this
// alone doesn't reintroduce the original stacking problem.
function pickSide(dx: number, dy: number, halfWidth: number, halfHeight: number): Side {
  const scaledDx = halfWidth > 0 ? dx / halfWidth : dx
  const scaledDy = halfHeight > 0 ? dy / halfHeight : dy
  if (Math.abs(scaledDx) >= Math.abs(scaledDy)) {
    return scaledDx >= 0 ? 'right' : 'left'
  }
  return scaledDy >= 0 ? 'bottom' : 'top'
}

interface SideGroup {
  nodeId: string
  side: Side
  // ponytail: source and target handles on the SAME side of the SAME node
  // must be spread together, not in separate groups — a cyclic pair (A→B
  // and B→A) puts one source handle and one target handle on the same side
  // of each node. Grouping by (node, side, type) would independently center
  // each single-member group at the side's midpoint, landing both handles
  // on the exact same point and making two edges look like one.
  //
  // `otherX`/`otherY` (the position of the node at the OTHER end of this
  // specific edge) are carried along so offsets can be assigned by that
  // node's actual position, not insertion order — insertion order grouped
  // all outgoing handles before all incoming ones (edges are usually
  // authored that way), so a cyclic pair's two lines landed far apart on the
  // side instead of next to each other, crossing every unrelated line in
  // between for no geometric reason.
  handles: Array<{ id: string; type: 'source' | 'target'; otherX: number; otherY: number }>
}

/**
 * Computes, for every edge, which side of its source/target node it should
 * connect to, and a distinct handle id per edge so multiple edges sharing
 * the same (node, side) — regardless of whether they're incoming or
 * outgoing — get spread evenly along it instead of stacking on the exact
 * same point.
 */
export function computeEdgeRouting(nodes: NodePosition[], edges: EdgeRef[]): RoutingResult {
  const positionById = new Map(nodes.map((n) => [n.id, n]))
  const sideGroups = new Map<string, SideGroup>()

  function registerHandle(
    nodeId: string,
    side: Side,
    type: 'source' | 'target',
    other: NodePosition
  ): string {
    const key = `${nodeId}|${side}`
    let group = sideGroups.get(key)
    if (!group) {
      group = { nodeId, side, handles: [] }
      sideGroups.set(key, group)
    }
    const handleId = `${key}|${type}#${group.handles.length}`
    group.handles.push({ id: handleId, type, otherX: other.x, otherY: other.y })
    return handleId
  }

  const edgeRouting: EdgeRouting[] = []

  for (const edge of edges) {
    const from = positionById.get(edge.from)
    const to = positionById.get(edge.to)
    if (!from || !to) continue // dangling reference — validateDiagramShape already guards this elsewhere

    const sourceSide = pickSide(to.x - from.x, to.y - from.y, from.width / 2, from.height / 2)
    const targetSide = pickSide(from.x - to.x, from.y - to.y, to.width / 2, to.height / 2)
    const sourceHandle = registerHandle(edge.from, sourceSide, 'source', to)
    const targetHandle = registerHandle(edge.to, targetSide, 'target', from)
    edgeRouting.push({ edgeId: edge.id, sourceHandle, targetHandle })
  }

  const nodeHandles = new Map<string, HandlePlacement[]>()
  for (const group of sideGroups.values()) {
    // Order handles by the position of whatever they connect to, along the
    // axis that runs ALONG this side (left/right sides run vertically, so
    // sort by the other node's y; top/bottom sides run horizontally, so sort
    // by x) — this is what actually avoids needless crossings, and as a
    // side effect keeps a cyclic pair's two lines (same "other" node)
    // adjacent to each other instead of split apart by insertion order.
    const sorted = [...group.handles].sort((a, b) => {
      const aKey = group.side === 'left' || group.side === 'right' ? a.otherY : a.otherX
      const bKey = group.side === 'left' || group.side === 'right' ? b.otherY : b.otherX
      return aKey - bKey
    })
    const placements = nodeHandles.get(group.nodeId) ?? []
    sorted.forEach((h, i) => {
      placements.push({
        id: h.id,
        type: h.type,
        side: group.side,
        offsetFraction: (i + 1) / (sorted.length + 1),
      })
    })
    nodeHandles.set(group.nodeId, placements)
  }

  return { edgeRouting, nodeHandles }
}

// ponytail: the exact string a caller should key a "re-measure handles now"
// effect on. Deliberately encodes every handle's id/side/offset per node,
// NOT just which node ids have handles — a real bug shipped here once
// already because the effect was keyed on the node-id set alone, which
// stays identical across a drag even when the SAME nodes' handle ids/offsets
// get reshuffled (the far more common case than a node gaining/losing
// handles outright).
export function computeHandleSignature(nodeHandles: Map<string, HandlePlacement[]>): string {
  return [...nodeHandles.entries()]
    .map(([nodeId, placements]) => `${nodeId}:${placements.map((p) => `${p.id}|${p.side}|${p.offsetFraction}`).join(',')}`)
    .join(';')
}
