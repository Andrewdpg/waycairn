// Kept in sync manually with src/validateDiagramShape.ts at the repo root
// (the backend's runtime-validated shape) and with archmap-front's
// src/lib/types.ts (the shape the ported canvas components expect) — all
// three describe the same Diagram/DiagramNodeData contract.

export type NodeKind =
  | 'system' | 'container' | 'component' | 'service' | 'server'
  | 'database' | 'class' | 'external' | 'bridge' | 'table'

export const NODE_KINDS: readonly NodeKind[] = [
  'system', 'container', 'component', 'service', 'server',
  'database', 'class', 'external', 'bridge', 'table',
]

export type Notation = 'c4' | 'uml-structural' | 'uml-behavioral' | 'erd'
export const NOTATIONS: readonly Notation[] = ['c4', 'uml-structural', 'uml-behavioral', 'erd']

export type UmlRelationship = 'association' | 'composition' | 'inheritance' | 'dependency'
export const UML_RELATIONSHIPS: readonly UmlRelationship[] = [
  'association', 'composition', 'inheritance', 'dependency',
]

export type ErdCardinality = 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many'
export const ERD_CARDINALITIES: readonly ErdCardinality[] = [
  'one-to-one', 'one-to-many', 'many-to-one', 'many-to-many',
]

export interface SourceRef {
  repo: string
  path: string
}

export interface TableColumn {
  name: string
  type: string
  primaryKey?: boolean
  foreignKey?: { table: string; column: string }
  unique?: boolean
  nullable?: boolean
}

export interface DiagramNodeData {
  id: string
  label: string
  kind: NodeKind
  childDiagram?: string
  x?: number
  y?: number
  responsibility?: string
  techStack?: string[]
  dataOwned?: string
  gotchas?: string[]
  attributes?: string[]
  operations?: string[]
  columns?: TableColumn[]
  sourceRefs?: Array<string | SourceRef>
  externalRef?: { repo: string; artifactId: string }
}

export interface DiagramEdgeData {
  from: string
  to: string
  label?: string
  relationship?: UmlRelationship
  order?: number
  async?: boolean
  condition?: string
  cardinality?: ErdCardinality
}

export interface Diagram {
  id: string
  // Real stored diagram artifacts never have this — the backend's
  // validateDiagramArtifactData (src/artifacts/kinds/diagram.ts at the repo
  // root) only synthesizes a title to reuse shape validation, it never
  // persists one. The artifact's own id IS its identity. Every consumer of
  // `title` must fall back to `id` when it's absent.
  title?: string
  notation?: Notation
  nodes: DiagramNodeData[]
  edges: DiagramEdgeData[]
}
