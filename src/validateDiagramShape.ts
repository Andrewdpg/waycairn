// Copied from src/lib/validateDiagram.ts + src/lib/types.ts (architecture-map
// frontend). Kept in sync manually — see Task 6 Step 1 design note in
// docs/superpowers/plans/2026-07-12-mcp-server.md if this drifts.

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

// One row per column, name+type only in prose — PK/FK/unique/nullable are
// their own fields so they render as distinct markers instead of getting
// buried (or comma-joined with other columns) inside a free-text string.
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
  title: string
  notation?: Notation
  nodes: DiagramNodeData[]
  edges: DiagramEdgeData[]
}

export class InvalidDiagramError extends Error {
  constructor(diagramId: string, reason: string) {
    super(`Invalid diagram "${diagramId}": ${reason}`)
    this.name = 'InvalidDiagramError'
  }
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string')
}

function isValidSourceRefObject(value: unknown): value is SourceRef {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>).repo === 'string' &&
    typeof (value as Record<string, unknown>).path === 'string' &&
    Object.keys(value as object).length === 2
  )
}

function isValidSourceRefsArray(value: unknown): value is Array<string | SourceRef> {
  if (!Array.isArray(value)) return false
  return value.every((v) => (typeof v === 'string' && v.length > 0) || isValidSourceRefObject(v))
}

const COLUMN_FIELDS = new Set(['name', 'type', 'primaryKey', 'foreignKey', 'unique', 'nullable'])

function isValidTableColumn(value: unknown): value is TableColumn {
  if (typeof value !== 'object' || value === null) return false
  const c = value as Record<string, unknown>
  if (typeof c.name !== 'string' || c.name.length === 0) return false
  if (typeof c.type !== 'string' || c.type.length === 0) return false
  if (c.primaryKey !== undefined && typeof c.primaryKey !== 'boolean') return false
  if (c.unique !== undefined && typeof c.unique !== 'boolean') return false
  if (c.nullable !== undefined && typeof c.nullable !== 'boolean') return false
  if (c.foreignKey !== undefined) {
    const fk = c.foreignKey as Record<string, unknown> | null
    const isValidFk =
      typeof fk === 'object' &&
      fk !== null &&
      typeof fk.table === 'string' &&
      typeof fk.column === 'string' &&
      Object.keys(fk).length === 2
    if (!isValidFk) return false
  }
  return Object.keys(c).every((k) => COLUMN_FIELDS.has(k))
}

function isValidColumnsArray(value: unknown): value is TableColumn[] {
  return Array.isArray(value) && value.every(isValidTableColumn)
}

const NODE_FIELDS = new Set([
  'id', 'label', 'kind', 'childDiagram', 'x', 'y', 'responsibility',
  'techStack', 'dataOwned', 'gotchas', 'attributes', 'operations', 'columns', 'sourceRefs',
  'externalRef',
])
const EDGE_FIELDS = new Set(['from', 'to', 'label', 'relationship', 'order', 'async', 'condition', 'cardinality'])

// Rejects any field not in the schema, instead of silently ignoring it.
// Without this, a caller (an MCP agent guessing at the shape by trial and
// error, or a human typo) could set e.g. "parent" on a node and get no
// error at all — it would just be dropped on the next read, with no
// indication anything was wrong. This is exactly what happened in
// practice: an agent set an undocumented "parent" field, saw no
// validation error, and built an entire diagram hierarchy on a mechanism
// that was never real.
function assertNoUnknownFields(
  obj: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  diagramId: string,
  context: string
): void {
  const unknown = Object.keys(obj).filter((k) => !allowed.has(k))
  if (unknown.length > 0) {
    throw new InvalidDiagramError(
      diagramId,
      `${context} has unrecognized field(s): ${unknown.join(', ')}. Valid fields: ${Array.from(allowed).join(', ')}`
    )
  }
}

export function validateDiagramShape(raw: unknown, diagramId: string): Diagram {
  if (typeof raw !== 'object' || raw === null) {
    throw new InvalidDiagramError(diagramId, 'not an object')
  }
  const d = raw as Partial<Diagram>

  if (typeof d.id !== 'string') throw new InvalidDiagramError(diagramId, 'missing "id"')
  if (typeof d.title !== 'string') throw new InvalidDiagramError(diagramId, 'missing "title"')
  if (d.notation !== undefined && !NOTATIONS.includes(d.notation as Notation)) {
    throw new InvalidDiagramError(diagramId, `invalid "notation": ${JSON.stringify(d.notation)}`)
  }
  if (!Array.isArray(d.nodes)) throw new InvalidDiagramError(diagramId, 'missing "nodes" array')
  if (!Array.isArray(d.edges)) throw new InvalidDiagramError(diagramId, 'missing "edges" array')

  d.nodes.forEach((n, i) => {
    if (typeof n !== 'object' || n === null) {
      throw new InvalidDiagramError(diagramId, `node at index ${i} is not an object`)
    }
    const node = n as unknown as Record<string, unknown>
    if (typeof node.id !== 'string') {
      throw new InvalidDiagramError(diagramId, `node at index ${i} missing "id"`)
    }
    if (typeof node.label !== 'string') {
      throw new InvalidDiagramError(diagramId, `node at index ${i} missing "label"`)
    }
    if (typeof node.kind !== 'string' || !NODE_KINDS.includes(node.kind as NodeKind)) {
      throw new InvalidDiagramError(
        diagramId,
        `node "${node.id ?? i}" has invalid "kind": ${JSON.stringify(node.kind)}`
      )
    }
    if (node.responsibility !== undefined && typeof node.responsibility !== 'string') {
      throw new InvalidDiagramError(diagramId, `node "${node.id}" has invalid "responsibility" (must be string)`)
    }
    if (node.dataOwned !== undefined && typeof node.dataOwned !== 'string') {
      throw new InvalidDiagramError(diagramId, `node "${node.id}" has invalid "dataOwned" (must be string)`)
    }
    for (const field of ['techStack', 'gotchas', 'attributes', 'operations'] as const) {
      if (node[field] !== undefined && !isStringArray(node[field])) {
        throw new InvalidDiagramError(diagramId, `node "${node.id}" has invalid "${field}" (must be string[])`)
      }
    }
    if (node.columns !== undefined && !isValidColumnsArray(node.columns)) {
      throw new InvalidDiagramError(
        diagramId,
        `node "${node.id}" has invalid "columns" (must be an array of { name, type, primaryKey?, foreignKey?: { table, column }, unique?, nullable? })`
      )
    }
    if (node.sourceRefs !== undefined && !isValidSourceRefsArray(node.sourceRefs)) {
      throw new InvalidDiagramError(
        diagramId,
        `node "${node.id}" has invalid "sourceRefs" (must be an array of non-empty strings or { repo, path } objects)`
      )
    }
    if (node.externalRef !== undefined) {
      const ref = node.externalRef as Record<string, unknown> | null
      const isValidRef =
        typeof ref === 'object' &&
        ref !== null &&
        typeof ref.repo === 'string' &&
        typeof ref.artifactId === 'string' &&
        Object.keys(ref).length === 2
      if (!isValidRef) {
        throw new InvalidDiagramError(
          diagramId,
          `node "${node.id}" has invalid "externalRef" (must be exactly { repo: string, artifactId: string })`
        )
      }
    }
    assertNoUnknownFields(node, NODE_FIELDS, diagramId, `node "${node.id}"`)
  })

  d.edges.forEach((e, i) => {
    if (typeof e !== 'object' || e === null) {
      throw new InvalidDiagramError(diagramId, `edge at index ${i} is not an object`)
    }
    const edge = e as unknown as Record<string, unknown>
    if (typeof edge.from !== 'string') {
      throw new InvalidDiagramError(diagramId, `edge at index ${i} missing "from"`)
    }
    if (typeof edge.to !== 'string') {
      throw new InvalidDiagramError(diagramId, `edge at index ${i} missing "to"`)
    }
    if (edge.relationship !== undefined && !UML_RELATIONSHIPS.includes(edge.relationship as UmlRelationship)) {
      throw new InvalidDiagramError(
        diagramId,
        `edge "${edge.from}->${edge.to}" has invalid "relationship": ${JSON.stringify(edge.relationship)}`
      )
    }
    if (edge.order !== undefined && typeof edge.order !== 'number') {
      throw new InvalidDiagramError(diagramId, `edge "${edge.from}->${edge.to}" has invalid "order" (must be number)`)
    }
    if (edge.async !== undefined && typeof edge.async !== 'boolean') {
      throw new InvalidDiagramError(diagramId, `edge "${edge.from}->${edge.to}" has invalid "async" (must be boolean)`)
    }
    if (edge.condition !== undefined && typeof edge.condition !== 'string') {
      throw new InvalidDiagramError(
        diagramId,
        `edge "${edge.from}->${edge.to}" has invalid "condition" (must be string)`
      )
    }
    if (edge.cardinality !== undefined && !ERD_CARDINALITIES.includes(edge.cardinality as ErdCardinality)) {
      throw new InvalidDiagramError(
        diagramId,
        `edge "${edge.from}->${edge.to}" has invalid "cardinality": ${JSON.stringify(edge.cardinality)}`
      )
    }
    assertNoUnknownFields(edge, EDGE_FIELDS, diagramId, `edge "${edge.from}->${edge.to}"`)
  })

  const nodeIds = new Set(d.nodes.map((n) => (n as { id: string }).id))
  for (const edge of d.edges as Array<{ from: string; to: string }>) {
    if (!nodeIds.has(edge.from)) {
      throw new InvalidDiagramError(diagramId, `edge references unknown node "${edge.from}"`)
    }
    if (!nodeIds.has(edge.to)) {
      throw new InvalidDiagramError(diagramId, `edge references unknown node "${edge.to}"`)
    }
  }

  return d as Diagram
}
