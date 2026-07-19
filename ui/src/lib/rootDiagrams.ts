import type { ArtifactRecord } from './apiClient'
import type { Diagram } from './types'

export interface DiagramSummary {
  id: string
  title: string
}

function toDiagrams(artifacts: ArtifactRecord[]): Diagram[] {
  return artifacts.map((a) => ({ ...(a.data as Diagram), id: a.id }))
}

function toSummary(diagram: Diagram): DiagramSummary {
  return { id: diagram.id, title: diagram.title ?? diagram.id }
}

function byTitle(a: DiagramSummary, b: DiagramSummary): number {
  return a.title.localeCompare(b.title)
}

// The "orphan root" concept: any diagram not referenced by some other
// diagram's childDiagram is a root — generalizes list_diagrams'/
// diagramRepo.listDiagrams' hardcoded "everything except 'deployment'"
// rule to any number of independently-rooted trees.
export function computeRootDiagrams(artifacts: ArtifactRecord[]): DiagramSummary[] {
  const diagrams = toDiagrams(artifacts)
  const referenced = new Set<string>()
  for (const diagram of diagrams) {
    for (const node of diagram.nodes) {
      if (node.childDiagram) referenced.add(node.childDiagram)
    }
  }
  return diagrams
    .filter((d) => !referenced.has(d.id))
    .map(toSummary)
    .sort(byTitle)
}

export function searchDiagrams(artifacts: ArtifactRecord[], query: string): DiagramSummary[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return toDiagrams(artifacts)
    .filter((d) => d.id.toLowerCase().includes(q) || (d.title ?? d.id).toLowerCase().includes(q))
    .map(toSummary)
    .sort(byTitle)
}
