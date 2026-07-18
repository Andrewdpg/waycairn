import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export interface ArtifactRecord {
  id: string
  kind: string
  updatedAt: string
  data: unknown
}

export class UnsafeArtifactPathError extends Error {
  constructor(field: 'kind' | 'id', value: string) {
    super(`Unsafe artifact ${field} ${JSON.stringify(value)}: must not contain "/", "\\", or ".."`)
    this.name = 'UnsafeArtifactPathError'
  }
}

function assertSafePathSegment(field: 'kind' | 'id', value: string): void {
  if (value.includes('/') || value.includes('\\') || value.includes('..')) {
    throw new UnsafeArtifactPathError(field, value)
  }
}

function kindDir(waycairnDir: string, kind: string): string {
  assertSafePathSegment('kind', kind)
  return join(waycairnDir, kind)
}

export function artifactFilePath(waycairnDir: string, kind: string, id: string): string {
  const dir = kindDir(waycairnDir, kind) // validates kind first
  assertSafePathSegment('id', id)
  return join(dir, `${id}.json`)
}

export function writeArtifactFile(waycairnDir: string, record: ArtifactRecord): void {
  mkdirSync(kindDir(waycairnDir, record.kind), { recursive: true })
  writeFileSync(artifactFilePath(waycairnDir, record.kind, record.id), JSON.stringify(record, null, 2) + '\n', 'utf8')
}

export function readArtifactFile(waycairnDir: string, kind: string, id: string): ArtifactRecord | null {
  const path = artifactFilePath(waycairnDir, kind, id)
  if (!existsSync(path)) return null
  return JSON.parse(readFileSync(path, 'utf8')) as ArtifactRecord
}

export function listArtifactFiles(waycairnDir: string, kind: string): ArtifactRecord[] {
  const dir = kindDir(waycairnDir, kind)
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => JSON.parse(readFileSync(join(dir, name), 'utf8')) as ArtifactRecord)
}
