import { resolve, join } from 'node:path'
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

  function ingest(repoId: string, diagramId: string, data: unknown): void {
    if (diagramId === 'deployment') hasDeployment.add(repoId)
    for (const node of (data as DataLike)?.nodes ?? []) {
      const refRepo = node.externalRef?.repo
      if (typeof refRepo === 'string') addEdge(repoId, refRepo)
    }
  }

  for (const [repoId, entry] of Object.entries(registry)) {
    const waycairnDir = join(entry.path, '.waycairn')
    try {
      const db = openIndexDb(waycairnDir)
      try {
        reindexKind(waycairnDir, db, 'diagram')
        for (const row of listIndexRows(db, 'diagram')) {
          ingest(repoId, row.id, JSON.parse(row.dataJson))
        }
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
    for (const candidate of componentOf(repoId)) {
      if (hasDeployment.has(candidate)) return candidate
    }
    return null
  }

  return { componentOf, deploymentOwner }
}
