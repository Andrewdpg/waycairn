import type { Diagram } from './types'
import type { ArtifactRecord } from './apiClient'

export class DiagramNotFoundError extends Error {
  constructor(public diagramId: string) {
    super(`Diagram not found: ${diagramId}`)
    this.name = 'DiagramNotFoundError'
  }
}

export interface ChainEntry {
  diagram: Diagram
  updatedAt: string
}

export async function resolveDiagramChain(
  rootDiagramId: string,
  segments: string[],
  fetchFn: (id: string) => Promise<ArtifactRecord | null>
): Promise<ChainEntry[]> {
  const rootRecord = await fetchFn(rootDiagramId)
  if (!rootRecord) throw new DiagramNotFoundError(rootDiagramId)

  const chain: ChainEntry[] = [
    { diagram: { ...(rootRecord.data as Diagram), id: rootRecord.id }, updatedAt: rootRecord.updatedAt },
  ]

  for (const nodeId of segments) {
    const current = chain[chain.length - 1].diagram
    const node = current.nodes.find((n) => n.id === nodeId)
    if (!node || !node.childDiagram) {
      throw new DiagramNotFoundError(nodeId)
    }
    const record = await fetchFn(node.childDiagram)
    if (!record) throw new DiagramNotFoundError(node.childDiagram)
    chain.push({ diagram: { ...(record.data as Diagram), id: record.id }, updatedAt: record.updatedAt })
  }

  return chain
}
