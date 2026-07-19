import { resolve, join } from 'node:path'
import { existsSync } from 'node:fs'
import { readRegistry } from '../registry.js'
import { openIndexDb, listIndexRows } from './db.js'
import { reindexKind } from './sync.js'
import type { RepoGraph } from './diagramRules/types.js'

interface NodeLike {
  externalRef?: { repo?: unknown }
}
interface DataLike {
  nodes?: NodeLike[]
}

export function resolveRepoId(registryPath: string, repoRoot: string): string | null {
  const registry = readRegistry(registryPath)
  const resolvedRoot = resolve(repoRoot)
  for (const [repoId, entry] of Object.entries(registry)) {
    if (resolve(entry.path) === resolvedRoot) return repoId
  }
  return null
}

export function buildRepoGraph(
  registryPath: string,
  extra?: { repoId: string; id: string; data: unknown }
): RepoGraph {
  const registry = readRegistry(registryPath)
  const edges = new Map<string, Set<string>>()
  const hasDeployment = new Set<string>()

  function addEdge(a: string, b: string): void {
    if (!edges.has(a)) edges.set(a, new Set())
    if (!edges.has(b)) edges.set(b, new Set())
    edges.get(a)!.add(b)
    edges.get(b)!.add(a)
  }

  // Collects one repo's contributions without touching shared state, so a
  // partial/corrupt repo can be discarded atomically instead of leaking edges.
  function collect(repoId: string, diagramId: string, data: unknown, into: { edges: [string, string][]; hasDeployment: boolean }): void {
    if (diagramId === 'deployment') into.hasDeployment = true
    for (const node of (data as DataLike)?.nodes ?? []) {
      const refRepo = node.externalRef?.repo
      if (typeof refRepo === 'string') into.edges.push([repoId, refRepo])
    }
  }

  function ingest(repoId: string, diagramId: string, data: unknown): void {
    const collected = { edges: [] as [string, string][], hasDeployment: false }
    collect(repoId, diagramId, data, collected)
    if (collected.hasDeployment) hasDeployment.add(repoId)
    for (const [a, b] of collected.edges) addEdge(a, b)
  }

  for (const [repoId, entry] of Object.entries(registry)) {
    const waycairnDir = join(entry.path, '.waycairn')
    if (!existsSync(waycairnDir)) continue // registry entry's repo no longer exists on disk — skip without writing anything

    try {
      const db = openIndexDb(waycairnDir)
      try {
        reindexKind(waycairnDir, db, 'diagram')
        const collected = { edges: [] as [string, string][], hasDeployment: false }
        for (const row of listIndexRows(db, 'diagram')) {
          if (extra && repoId === extra.repoId && row.id === extra.id) continue // superseded below by extra.data
          collect(repoId, row.id, JSON.parse(row.dataJson), collected)
        }
        // Only merge into shared state once the whole repo parsed cleanly.
        if (collected.hasDeployment) hasDeployment.add(repoId)
        for (const [a, b] of collected.edges) addEdge(a, b)
      } finally {
        db.close()
      }
    } catch {
      continue // stale/missing/corrupt registry entry — skip, don't block the write
    }
  }

  if (extra) ingest(extra.repoId, extra.id, extra.data)

  function componentOf(repoId: string): Set<string> {
    const visited = new Set<string>([repoId])
    const queue = [repoId]
    while (queue.length > 0) {
      const current = queue.shift()!
      for (const neighbor of edges.get(current) ?? []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor)
          queue.push(neighbor)
        }
      }
    }
    return visited
  }

  function deploymentOwner(repoId: string): string | null {
    // BFS visits repoId itself first, so a naive "first match" would always
    // report self as owner (e.g. while validating repoId's own in-progress
    // deployment write) and mask a real, pre-existing owner elsewhere in the
    // component. Prefer any other owner over self; fall back to self only if
    // nobody else in the component has one.
    let selfOwner: string | null = null
    for (const candidate of componentOf(repoId)) {
      if (!hasDeployment.has(candidate)) continue
      if (candidate !== repoId) return candidate
      selfOwner = candidate
    }
    return selfOwner
  }

  return { componentOf, deploymentOwner }
}
