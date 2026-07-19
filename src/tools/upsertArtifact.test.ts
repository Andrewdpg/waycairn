import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { upsertArtifactTool } from './upsertArtifact.js'
import { readArtifactFile } from '../artifacts/store.js'
import { openIndexDb, getIndexRow } from '../artifacts/db.js'
import { UnknownArtifactKindError } from '../artifacts/kinds/registry.js'
import { InvalidDiagramError } from '../validateDiagramShape.js'
import { upsertRegistryEntry } from '../registry.js'
import { DiagramRuleViolationError } from '../artifacts/diagramRules/index.js'

let waycairnDir: string

beforeEach(() => {
  waycairnDir = mkdtempSync(join(tmpdir(), 'waycairn-upsert-'))
})

afterEach(() => {
  rmSync(waycairnDir, { recursive: true, force: true })
})

describe('upsertArtifactTool', () => {
  it('writes the artifact file and returns the stored record', () => {
    const data = { nodes: [{ id: 'a', label: 'A', kind: 'service' }], edges: [] }
    const record = upsertArtifactTool(waycairnDir, 'diagram', 'auth-service', data)
    expect(record.id).toBe('auth-service')
    expect(record.kind).toBe('diagram')
    expect(record.data).toEqual(data)
    expect(readArtifactFile(waycairnDir, 'diagram', 'auth-service')).toEqual(record)
  })

  it('updates the sqlite index in the same call', () => {
    const data = { nodes: [], edges: [] }
    upsertArtifactTool(waycairnDir, 'diagram', 'auth-service', data)
    const db = openIndexDb(waycairnDir)
    const row = getIndexRow(db, 'diagram', 'auth-service')
    db.close()
    expect(row).not.toBeNull()
    expect(JSON.parse(row!.dataJson)).toEqual(data)
  })

  it('rejects an unknown kind without writing anything', () => {
    expect(() => upsertArtifactTool(waycairnDir, 'session-note', 'x', {})).toThrow(UnknownArtifactKindError)
    expect(readArtifactFile(waycairnDir, 'session-note', 'x')).toBeNull()
  })

  it('rejects invalid diagram data without writing anything', () => {
    expect(() => upsertArtifactTool(waycairnDir, 'diagram', 'bad', { nodes: [{ id: 'a' }], edges: [] })).toThrow(
      InvalidDiagramError
    )
    expect(readArtifactFile(waycairnDir, 'diagram', 'bad')).toBeNull()
  })
})

describe('upsertArtifactTool diagram rules', () => {
  it('rejects a node targeting "deployment" as a child, without writing anything', () => {
    const data = { nodes: [{ id: 'a', label: 'A', kind: 'service', childDiagram: 'deployment' }], edges: [] }
    expect(() => upsertArtifactTool(waycairnDir, 'diagram', 'components', data)).toThrow(DiagramRuleViolationError)
    expect(readArtifactFile(waycairnDir, 'diagram', 'components')).toBeNull()
  })

  it('allows writing a "deployment" diagram with no registryPath (rule short-circuits without registry context)', () => {
    const data = { nodes: [], edges: [] }
    expect(() => upsertArtifactTool(waycairnDir, 'diagram', 'deployment', data)).not.toThrow()
  })

  it('rejects a second "deployment" diagram connected via externalRef to an already-owned one', () => {
    const registryDir = mkdtempSync(join(tmpdir(), 'waycairn-upsert-registry-'))
    const registryPath = join(registryDir, 'registry.json')
    const otherRoot = mkdtempSync(join(tmpdir(), 'waycairn-upsert-other-'))
    try {
      // waycairnDir (from beforeEach) IS the ".waycairn" dir itself, so its
      // repo root — what resolveRepoId compares registry paths against — is
      // dirname(waycairnDir).
      upsertRegistryEntry(registryPath, 'host/org/this', { path: dirname(waycairnDir), name: 'this' })
      upsertRegistryEntry(registryPath, 'host/org/other', { path: otherRoot, name: 'other' })
      upsertArtifactTool(join(otherRoot, '.waycairn'), 'diagram', 'deployment', { nodes: [], edges: [] })

      const data = {
        nodes: [{ id: 'x', label: 'X', kind: 'external', externalRef: { repo: 'host/org/other', artifactId: 'components' } }],
        edges: [],
      }
      expect(() => upsertArtifactTool(waycairnDir, 'diagram', 'deployment', data, registryPath)).toThrow(
        DiagramRuleViolationError
      )
    } finally {
      rmSync(registryDir, { recursive: true, force: true })
      rmSync(otherRoot, { recursive: true, force: true })
    }
  })
})
