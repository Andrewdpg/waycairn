import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resolveRepoId, buildRepoGraph } from './repoGraph.js'
import { upsertArtifactTool } from '../tools/upsertArtifact.js'
import { upsertRegistryEntry } from '../registry.js'

let root: string
let registryPath: string
let repoA: string
let repoB: string
let repoC: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'waycairn-repograph-'))
  registryPath = join(root, 'registry.json')
  repoA = join(root, 'repo-a')
  repoB = join(root, 'repo-b')
  repoC = join(root, 'repo-c')
  upsertRegistryEntry(registryPath, 'host/org/a', { path: repoA, name: 'a' })
  upsertRegistryEntry(registryPath, 'host/org/b', { path: repoB, name: 'b' })
  upsertRegistryEntry(registryPath, 'host/org/c', { path: repoC, name: 'c' })
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('resolveRepoId', () => {
  it('finds the repoId whose registry path matches repoRoot', () => {
    expect(resolveRepoId(registryPath, repoA)).toBe('host/org/a')
  })

  it('returns null for an unregistered path', () => {
    expect(resolveRepoId(registryPath, join(root, 'not-registered'))).toBeNull()
  })
})

describe('buildRepoGraph', () => {
  it('connects two repos via a one-directional externalRef and finds deploymentOwner across the component', () => {
    upsertArtifactTool(join(repoA, '.waycairn'), 'diagram', 'deployment', {
      nodes: [{ id: 'b', label: 'B', kind: 'external', externalRef: { repo: 'host/org/b', artifactId: 'components' } }],
      edges: [],
    })
    upsertArtifactTool(join(repoB, '.waycairn'), 'diagram', 'components', { nodes: [], edges: [] })

    const graph = buildRepoGraph(registryPath)
    expect(graph.componentOf('host/org/b')).toEqual(new Set(['host/org/b', 'host/org/a']))
    expect(graph.deploymentOwner('host/org/b')).toBe('host/org/a')
  })

  it('keeps unconnected repos in separate components with independent deploymentOwners', () => {
    upsertArtifactTool(join(repoA, '.waycairn'), 'diagram', 'deployment', { nodes: [], edges: [] })
    upsertArtifactTool(join(repoC, '.waycairn'), 'diagram', 'deployment', { nodes: [], edges: [] })

    const graph = buildRepoGraph(registryPath)
    expect(graph.deploymentOwner('host/org/a')).toBe('host/org/a')
    expect(graph.deploymentOwner('host/org/c')).toBe('host/org/c')
    expect(graph.componentOf('host/org/a').has('host/org/c')).toBe(false)
  })

  it('returns null deploymentOwner when nobody in the component has one', () => {
    upsertArtifactTool(join(repoA, '.waycairn'), 'diagram', 'components', {
      nodes: [{ id: 'b', label: 'B', kind: 'external', externalRef: { repo: 'host/org/b', artifactId: 'components' } }],
      edges: [],
    })
    const graph = buildRepoGraph(registryPath)
    expect(graph.deploymentOwner('host/org/a')).toBeNull()
  })

  it('skips a registered repo whose path no longer exists, without throwing', () => {
    upsertRegistryEntry(registryPath, 'host/org/ghost', { path: join(root, 'does-not-exist'), name: 'ghost' })
    upsertArtifactTool(join(repoA, '.waycairn'), 'diagram', 'deployment', { nodes: [], edges: [] })
    expect(() => buildRepoGraph(registryPath)).not.toThrow()
    expect(buildRepoGraph(registryPath).deploymentOwner('host/org/a')).toBe('host/org/a')
  })

  it('folds in-progress write data (extra) not yet on disk', () => {
    upsertArtifactTool(join(repoB, '.waycairn'), 'diagram', 'deployment', { nodes: [], edges: [] })
    const extra = {
      repoId: 'host/org/a',
      id: 'deployment',
      data: { nodes: [{ id: 'b', label: 'B', kind: 'external', externalRef: { repo: 'host/org/b', artifactId: 'deployment' } }], edges: [] },
    }
    const graph = buildRepoGraph(registryPath, extra)
    expect(graph.componentOf('host/org/a')).toEqual(new Set(['host/org/a', 'host/org/b']))
  })
})
