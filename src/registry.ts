import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

export interface RegistryEntry {
  path: string
  name: string
}

export type Registry = Record<string, RegistryEntry>

export function readRegistry(registryPath: string): Registry {
  if (!existsSync(registryPath)) return {}
  return JSON.parse(readFileSync(registryPath, 'utf8')) as Registry
}

export function upsertRegistryEntry(registryPath: string, repoId: string, entry: RegistryEntry): void {
  const registry = readRegistry(registryPath)
  registry[repoId] = entry
  mkdirSync(dirname(registryPath), { recursive: true })
  writeFileSync(registryPath, JSON.stringify(registry, null, 2) + '\n', 'utf8')
}
