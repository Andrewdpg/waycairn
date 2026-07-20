export interface HighlightEdgeRef {
  id: string
  from: string
  to: string
}

export interface HighlightResult {
  nodeIds: Set<string>
  edgeIds: Set<string>
}

export type HoverTarget = { type: 'node'; id: string } | { type: 'edge'; id: string } | null

// ponytail: empty sets mean "nothing hovered, dim nothing" — callers must
// treat an empty nodeIds set as "show everything at full opacity", not as
// "nothing is highlighted so dim everything".
export function computeHighlightedIds(hover: HoverTarget, edges: HighlightEdgeRef[]): HighlightResult {
  if (!hover) return { nodeIds: new Set(), edgeIds: new Set() }

  if (hover.type === 'edge') {
    const edge = edges.find((e) => e.id === hover.id)
    if (!edge) return { nodeIds: new Set(), edgeIds: new Set() }
    return { nodeIds: new Set([edge.from, edge.to]), edgeIds: new Set([edge.id]) }
  }

  const nodeIds = new Set<string>([hover.id])
  const edgeIds = new Set<string>()

  for (const edge of edges) {
    if (edge.from === hover.id || edge.to === hover.id) {
      edgeIds.add(edge.id)
      nodeIds.add(edge.from)
      nodeIds.add(edge.to)
    }
  }

  return { nodeIds, edgeIds }
}
