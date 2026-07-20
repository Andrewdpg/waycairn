import dagre from 'dagre'
import type { DiagramNodeData, DiagramEdgeData } from './types'

export interface PositionedNode extends DiagramNodeData {
  x: number
  y: number
}

const BASE_WIDTH = 180
const BASE_HEIGHT = 60
const LINE_HEIGHT = 16

// ponytail: shared with nodeShapes.tsx's baseBoxStyle maxWidth — the two
// MUST stay in sync. If they drift, dagre reserves a different amount of
// horizontal space than the box actually renders at, which is exactly what
// caused nodes to overlap before this constant existed (long `responsibility`
// text stretched the box wider than dagre had budgeted for it).
export const NODE_MAX_WIDTH = 240
const NODE_PADDING_X = 28 // baseBoxStyle's `padding: '10px 14px'` → 14px * 2
const AVG_CHAR_WIDTH_PX = 6.5 // rough average glyph width for the UI font at 11-13px

function estimateWrappedLineCount(text: string, boxWidth: number): number {
  const usableWidth = boxWidth - NODE_PADDING_X
  const charsPerLine = Math.max(1, Math.floor(usableWidth / AVG_CHAR_WIDTH_PX))
  return Math.max(1, Math.ceil(text.length / charsPerLine))
}

// ponytail: dagre needs a size estimate per node to pack the layout without
// overlap — the real DOM size varies with content (responsibility line, tech
// badges, class attributes/operations, database cap curves), so this
// approximates it instead of assuming every node is the same fixed box. Must
// stay a reasonably close upper-bound of the real rendered size, or nodes
// overlap — see NODE_MAX_WIDTH above for why width is capped, not just
// estimated from the label.
export function estimateNodeSize(node: DiagramNodeData): { width: number; height: number } {
  const width = Math.min(NODE_MAX_WIDTH, Math.max(BASE_WIDTH, node.label.length * 8 + 60))

  let height = BASE_HEIGHT
  if (node.responsibility) {
    height += estimateWrappedLineCount(node.responsibility, width) * LINE_HEIGHT
  }
  if (node.techStack && node.techStack.length > 0) height += 20
  if (node.kind === 'database') height += 16

  if (node.kind === 'class') {
    const attributeLines = node.attributes?.length ?? 0
    const operationLines = node.operations?.length ?? 0
    height +=
      (attributeLines > 0 ? 12 + attributeLines * LINE_HEIGHT : 0) +
      (operationLines > 0 ? 12 + operationLines * LINE_HEIGHT : 0)
  }

  if (node.kind === 'table') {
    const columnLines = node.columns?.length ?? 0
    height += columnLines > 0 ? 12 + columnLines * LINE_HEIGHT : 0
  }

  return { width, height: Math.max(BASE_HEIGHT, height) }
}

export function layoutDiagram(nodes: DiagramNodeData[], edges: DiagramEdgeData[]): PositionedNode[] {
  const graph = new dagre.graphlib.Graph()
  graph.setGraph({ rankdir: 'LR', nodesep: 70, ranksep: 110 })
  graph.setDefaultEdgeLabel(() => ({}))

  for (const node of nodes) {
    graph.setNode(node.id, estimateNodeSize(node))
  }
  for (const edge of edges) {
    graph.setEdge(edge.from, edge.to)
  }

  dagre.layout(graph)

  return nodes.map((node) => {
    if (node.x !== undefined && node.y !== undefined) {
      return { ...node, x: node.x, y: node.y }
    }
    const computed = graph.node(node.id)
    return { ...node, x: computed.x, y: computed.y }
  })
}
