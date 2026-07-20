import { describe, it, expect } from 'vitest'
import { validateDiagramShape, InvalidDiagramError } from './validateDiagramShape.js'

function baseDiagram(node: Record<string, unknown>) {
  return { id: 'd1', title: 'D1', nodes: [{ id: 'n1', label: 'N1', kind: 'service', ...node }], edges: [] }
}

describe('validateDiagramShape - sourceRefs', () => {
  it('accepts a plain string sourceRef (same-repo, relative path)', () => {
    const diagram = validateDiagramShape(baseDiagram({ sourceRefs: ['src/foo.ts:42'] }), 'd1')
    expect(diagram.nodes[0].sourceRefs).toEqual(['src/foo.ts:42'])
  })

  it('accepts a {repo, path} sourceRef object (cross-repo)', () => {
    const ref = { repo: 'host/org/other', path: 'lib/baz.ts:5' }
    const diagram = validateDiagramShape(baseDiagram({ sourceRefs: [ref] }), 'd1')
    expect(diagram.nodes[0].sourceRefs).toEqual([ref])
  })

  it('accepts a mix of string and object entries in the same array', () => {
    const diagram = validateDiagramShape(
      baseDiagram({ sourceRefs: ['src/foo.ts:42', { repo: 'host/org/other', path: 'lib/baz.ts:5' }] }),
      'd1'
    )
    expect(diagram.nodes[0].sourceRefs).toHaveLength(2)
  })

  it('rejects a sourceRef object missing "path"', () => {
    expect(() => validateDiagramShape(baseDiagram({ sourceRefs: [{ repo: 'host/org/other' }] }), 'd1')).toThrow(
      InvalidDiagramError
    )
  })

  it('rejects a sourceRef object missing "repo"', () => {
    expect(() => validateDiagramShape(baseDiagram({ sourceRefs: [{ path: 'lib/baz.ts:5' }] }), 'd1')).toThrow(
      InvalidDiagramError
    )
  })

  it('rejects a sourceRef object with an extra field', () => {
    expect(() =>
      validateDiagramShape(baseDiagram({ sourceRefs: [{ repo: 'a', path: 'b', extra: 'x' }] }), 'd1')
    ).toThrow(InvalidDiagramError)
  })

  it('rejects a sourceRef entry that is neither a string nor an object', () => {
    expect(() => validateDiagramShape(baseDiagram({ sourceRefs: [42] }), 'd1')).toThrow(InvalidDiagramError)
  })
})

describe('validateDiagramShape - erd support', () => {
  it('accepts kind "table" on a node', () => {
    const diagram = validateDiagramShape(baseDiagram({ kind: 'table' }), 'd1')
    expect(diagram.nodes[0].kind).toBe('table')
  })

  it('accepts notation "erd" on the diagram', () => {
    const diagram = validateDiagramShape({ id: 'd1', title: 'D1', notation: 'erd', nodes: [], edges: [] }, 'd1')
    expect(diagram.notation).toBe('erd')
  })

  it('accepts a valid edge cardinality', () => {
    const diagram = validateDiagramShape(
      {
        id: 'd1',
        title: 'D1',
        nodes: [
          { id: 'a', label: 'A', kind: 'table' },
          { id: 'b', label: 'B', kind: 'table' },
        ],
        edges: [{ from: 'a', to: 'b', cardinality: 'one-to-many' }],
      },
      'd1'
    )
    expect(diagram.edges[0].cardinality).toBe('one-to-many')
  })

  it('rejects an invalid edge cardinality', () => {
    expect(() =>
      validateDiagramShape(
        {
          id: 'd1',
          title: 'D1',
          nodes: [
            { id: 'a', label: 'A', kind: 'table' },
            { id: 'b', label: 'B', kind: 'table' },
          ],
          edges: [{ from: 'a', to: 'b', cardinality: 'bogus' }],
        },
        'd1'
      )
    ).toThrow(InvalidDiagramError)
  })
})

describe('validateDiagramShape - table columns', () => {
  it('accepts a minimal column (name + type only)', () => {
    const diagram = validateDiagramShape(
      baseDiagram({ kind: 'table', columns: [{ name: 'email', type: 'varchar(255)' }] }),
      'd1'
    )
    expect(diagram.nodes[0].columns).toEqual([{ name: 'email', type: 'varchar(255)' }])
  })

  it('accepts a column with primaryKey, foreignKey, unique, and nullable set', () => {
    const column = {
      name: 'user_id',
      type: 'uint',
      primaryKey: false,
      foreignKey: { table: 'users', column: 'id' },
      unique: true,
      nullable: true,
    }
    const diagram = validateDiagramShape(baseDiagram({ kind: 'table', columns: [column] }), 'd1')
    expect(diagram.nodes[0].columns).toEqual([column])
  })

  it('rejects a column missing "name"', () => {
    expect(() =>
      validateDiagramShape(baseDiagram({ kind: 'table', columns: [{ type: 'uint' }] }), 'd1')
    ).toThrow(InvalidDiagramError)
  })

  it('rejects a column missing "type"', () => {
    expect(() =>
      validateDiagramShape(baseDiagram({ kind: 'table', columns: [{ name: 'id' }] }), 'd1')
    ).toThrow(InvalidDiagramError)
  })

  it('rejects a column with an invalid foreignKey shape', () => {
    expect(() =>
      validateDiagramShape(
        baseDiagram({ kind: 'table', columns: [{ name: 'user_id', type: 'uint', foreignKey: { table: 'users' } }] }),
        'd1'
      )
    ).toThrow(InvalidDiagramError)
  })

  it('rejects a column with an unrecognized field', () => {
    expect(() =>
      validateDiagramShape(
        baseDiagram({ kind: 'table', columns: [{ name: 'id', type: 'uint', comment: 'nope' }] }),
        'd1'
      )
    ).toThrow(InvalidDiagramError)
  })

  it('rejects columns that is not an array', () => {
    expect(() => validateDiagramShape(baseDiagram({ kind: 'table', columns: 'nope' }), 'd1')).toThrow(
      InvalidDiagramError
    )
  })
})
