import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readRegistry, upsertRegistryEntry } from './registry.js'

let dir: string
let registryPath: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'waycairn-registry-'))
  registryPath = join(dir, 'nested', 'registry.json') // nested: proves the directory gets created
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('registry', () => {
  it('returns an empty registry when the file does not exist', () => {
    expect(readRegistry(registryPath)).toEqual({})
  })

  it('upsert creates the file (and its parent directory) and can be read back', () => {
    upsertRegistryEntry(registryPath, 'github.com/org/a', { path: '/repos/a', name: 'a' })
    expect(readRegistry(registryPath)).toEqual({
      'github.com/org/a': { path: '/repos/a', name: 'a' },
    })
  })

  it('a second upsert for a different repoId keeps both entries', () => {
    upsertRegistryEntry(registryPath, 'github.com/org/a', { path: '/repos/a', name: 'a' })
    upsertRegistryEntry(registryPath, 'github.com/org/b', { path: '/repos/b', name: 'b' })
    expect(readRegistry(registryPath)).toEqual({
      'github.com/org/a': { path: '/repos/a', name: 'a' },
      'github.com/org/b': { path: '/repos/b', name: 'b' },
    })
  })

  it('a second upsert for the same repoId overwrites the entry (idempotent re-registration)', () => {
    upsertRegistryEntry(registryPath, 'github.com/org/a', { path: '/repos/a', name: 'a' })
    upsertRegistryEntry(registryPath, 'github.com/org/a', { path: '/new/path/a', name: 'a' })
    expect(readRegistry(registryPath)).toEqual({
      'github.com/org/a': { path: '/new/path/a', name: 'a' },
    })
  })
})
