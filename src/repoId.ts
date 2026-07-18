// src/repoId.ts
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export class NoGitRemoteError extends Error {
  constructor(repoRoot: string) {
    super(
      `No "origin" remote found in ${repoRoot}. Add one (git remote add origin <url>) before running "waycairn init" — the repo's identity is derived from it.`
    )
    this.name = 'NoGitRemoteError'
  }
}

export class UnrecognizedGitRemoteUrlError extends Error {
  constructor(url: string) {
    super(`Could not parse git remote URL: ${JSON.stringify(url)}`)
    this.name = 'UnrecognizedGitRemoteUrlError'
  }
}

interface ParsedGitUrl {
  host: string
  path: string
}

function stripGitSuffix(value: string): string {
  return value.endsWith('.git') ? value.slice(0, -'.git'.length) : value
}

function parseGitRemoteUrl(url: string): ParsedGitUrl {
  if (!url.startsWith('ssh://')) {
    const scpMatch = url.match(/^[^@\s]+@([^:\s]+):(.+)$/)
    if (scpMatch) return { host: scpMatch[1], path: stripGitSuffix(scpMatch[2]) }
  }
  const urlMatch = url.match(/^(?:ssh|https?):\/\/(?:[^@\s]+@)?([^/\s]+)\/(.+)$/)
  if (urlMatch) return { host: urlMatch[1], path: stripGitSuffix(urlMatch[2]) }
  throw new UnrecognizedGitRemoteUrlError(url)
}

function parseSshConfigAliases(content: string): Map<string, string> {
  const aliasToHostName = new Map<string, string>()
  let currentAliases: string[] = []
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim()
    if (line === '' || line.startsWith('#')) continue
    const [keyword, ...rest] = line.split(/\s+/)
    if (keyword.toLowerCase() === 'host') {
      currentAliases = rest
    } else if (keyword.toLowerCase() === 'hostname' && rest.length > 0) {
      for (const alias of currentAliases) aliasToHostName.set(alias, rest[0])
    }
  }
  return aliasToHostName
}

export function normalizeGitRemoteUrl(url: string, sshConfigContent: string | null): string {
  const { host, path } = parseGitRemoteUrl(url)
  const aliases = sshConfigContent ? parseSshConfigAliases(sshConfigContent) : new Map<string, string>()
  const resolvedHost = aliases.get(host) ?? host
  return `${resolvedHost}/${path}`
}

export function getRepoId(repoRoot: string): string {
  let url: string
  try {
    url = execFileSync('git', ['-C', repoRoot, 'remote', 'get-url', 'origin'], { encoding: 'utf8' }).trim()
  } catch {
    throw new NoGitRemoteError(repoRoot)
  }
  const sshConfigPath = join(homedir(), '.ssh', 'config')
  const sshConfigContent = existsSync(sshConfigPath) ? readFileSync(sshConfigPath, 'utf8') : null
  return normalizeGitRemoteUrl(url, sshConfigContent)
}
