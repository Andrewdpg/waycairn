import { statSync } from 'node:fs'
import { dirname } from 'node:path'
import { openIndexDb, upsertIndexRow } from '../artifacts/db.js'
import { artifactFilePath, writeArtifactFile, type ArtifactRecord } from '../artifacts/store.js'
import { validateArtifactData } from '../artifacts/kinds/registry.js'
import { runDiagramRules, DiagramRuleViolationError } from '../artifacts/diagramRules/index.js'
import { resolveRepoId, buildRepoGraph } from '../artifacts/repoGraph.js'
import type { RepoGraph } from '../artifacts/diagramRules/types.js'

export function upsertArtifactTool(
  waycairnDir: string,
  kind: string,
  id: string,
  data: unknown,
  registryPath?: string
): ArtifactRecord {
  validateArtifactData(kind, data, id) // throws before anything is written on invalid input

  if (kind === 'diagram') {
    const repoId = registryPath ? resolveRepoId(registryPath, dirname(waycairnDir)) : null
    let cachedGraph: RepoGraph | undefined
    const violation = runDiagramRules({
      kind,
      id,
      data,
      repoId,
      graph: () => (cachedGraph ??= buildRepoGraph(registryPath!, repoId ? { repoId, id, data } : undefined)),
    })
    if (violation) throw new DiagramRuleViolationError(violation.rule, violation.message)
  }

  const record: ArtifactRecord = { id, kind, updatedAt: new Date().toISOString(), data }
  writeArtifactFile(waycairnDir, record)

  const db = openIndexDb(waycairnDir)
  try {
    const mtimeMs = statSync(artifactFilePath(waycairnDir, kind, id)).mtimeMs
    upsertIndexRow(db, { kind, id, dataJson: JSON.stringify(data), updatedAt: record.updatedAt, indexedMtimeMs: mtimeMs })
  } finally {
    db.close()
  }

  return record
}
