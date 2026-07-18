import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { writeArtifactFile, readArtifactFile, listArtifactFiles, artifactFilePath } from './store.js'

let waycairnDir: string

beforeEach(() => {
  waycairnDir = mkdtempSync(join(tmpdir(), 'waycairn-store-'))
})

afterEach(() => {
  rmSync(waycairnDir, { recursive: true, force: true })
})

describe('artifact file store', () => {
  it('computes the file path as .waycairn/<kind>/<id>.json', () => {
    expect(artifactFilePath(waycairnDir, 'diagram', 'auth-service')).toBe(
      join(waycairnDir, 'diagram', 'auth-service.json')
    )
  })

  it('writes an artifact, creating the kind directory if missing', () => {
    writeArtifactFile(waycairnDir, {
      id: 'auth-service',
      kind: 'diagram',
      updatedAt: '2026-07-18T00:00:00.000Z',
      data: { notation: 'c4', nodes: [], edges: [] },
    })
    const record = readArtifactFile(waycairnDir, 'diagram', 'auth-service')
    expect(record).toEqual({
      id: 'auth-service',
      kind: 'diagram',
      updatedAt: '2026-07-18T00:00:00.000Z',
      data: { notation: 'c4', nodes: [], edges: [] },
    })
  })

  it('returns null for an artifact that does not exist', () => {
    expect(readArtifactFile(waycairnDir, 'diagram', 'missing')).toBeNull()
  })

  it('overwrites an existing artifact file on a second write', () => {
    writeArtifactFile(waycairnDir, { id: 'a', kind: 'diagram', updatedAt: 't1', data: { v: 1 } })
    writeArtifactFile(waycairnDir, { id: 'a', kind: 'diagram', updatedAt: 't2', data: { v: 2 } })
    expect(readArtifactFile(waycairnDir, 'diagram', 'a')).toEqual({
      id: 'a',
      kind: 'diagram',
      updatedAt: 't2',
      data: { v: 2 },
    })
  })

  it('lists every artifact of a kind', () => {
    writeArtifactFile(waycairnDir, { id: 'a', kind: 'diagram', updatedAt: 't1', data: {} })
    writeArtifactFile(waycairnDir, { id: 'b', kind: 'diagram', updatedAt: 't2', data: {} })
    const records = listArtifactFiles(waycairnDir, 'diagram')
    expect(records.map((r) => r.id).sort()).toEqual(['a', 'b'])
  })

  it('returns an empty array when the kind directory does not exist yet', () => {
    expect(listArtifactFiles(waycairnDir, 'diagram')).toEqual([])
  })
})
