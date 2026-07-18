// src/commands/init.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, readFileSync, existsSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runInit } from './init.js'
import { NoGitRemoteError } from '../repoId.js'

let repoRoot: string
let registryPath: string

beforeEach(() => {
  repoRoot = mkdtempSync(join(tmpdir(), 'waycairn-init-repo-'))
  execFileSync('git', ['-C', repoRoot, 'init', '-q'])
  execFileSync('git', ['-C', repoRoot, 'remote', 'add', 'origin', 'https://example-remote-host.test/org/init-test.git'])
  registryPath = join(mkdtempSync(join(tmpdir(), 'waycairn-init-registry-')), 'registry.json')
})

afterEach(() => {
  rmSync(repoRoot, { recursive: true, force: true })
})

describe('runInit', () => {
  it('registers the repo in the registry at the given path', () => {
    runInit(repoRoot, registryPath)
    const registry = JSON.parse(readFileSync(registryPath, 'utf8'))
    expect(registry['example-remote-host.test/org/init-test']).toEqual({ path: repoRoot, name: 'init-test' })
  })

  it('ensures .gitignore covers the derived sqlite index', () => {
    runInit(repoRoot, registryPath)
    const gitignore = readFileSync(join(repoRoot, '.gitignore'), 'utf8')
    expect(gitignore).toContain('.waycairn/index.sqlite')
  })

  it('does not create .waycairn/ itself (left to upsert_artifact on first write)', () => {
    runInit(repoRoot, registryPath)
    expect(existsSync(join(repoRoot, '.waycairn'))).toBe(false)
  })

  it('propagates NoGitRemoteError for a repo with no origin remote', () => {
    const bareRepo = mkdtempSync(join(tmpdir(), 'waycairn-init-bare-'))
    execFileSync('git', ['-C', bareRepo, 'init', '-q'])
    try {
      expect(() => runInit(bareRepo, registryPath)).toThrow(NoGitRemoteError)
      expect(existsSync(registryPath)).toBe(false)
      expect(existsSync(join(bareRepo, '.gitignore'))).toBe(false)
    } finally {
      rmSync(bareRepo, { recursive: true, force: true })
    }
  })

  it('runs detected agent installers end-to-end against a fake HOME with all three agents present', () => {
    const fakeHome = mkdtempSync(join(tmpdir(), 'waycairn-init-agents-home-'))
    const originalHome = process.env.HOME
    try {
      mkdirSync(join(fakeHome, '.claude'), { recursive: true })
      mkdirSync(join(fakeHome, '.codex'), { recursive: true })
      mkdirSync(join(fakeHome, '.config', 'opencode'), { recursive: true })
      process.env.HOME = fakeHome

      runInit(repoRoot, registryPath)

      expect(existsSync(join(repoRoot, '.mcp.json'))).toBe(true)
      expect(existsSync(join(repoRoot, '.claude', 'skills', 'waycairn', 'SKILL.md'))).toBe(true)
      expect(existsSync(join(repoRoot, '.claude', 'settings.json'))).toBe(true)
      expect(existsSync(join(repoRoot, '.codex', 'config.toml'))).toBe(true)
      expect(existsSync(join(repoRoot, '.codex', 'hooks.json'))).toBe(true)
      expect(existsSync(join(repoRoot, 'opencode.json'))).toBe(true)
      expect(existsSync(join(repoRoot, '.opencode', 'plugin', 'waycairn-nudge.ts'))).toBe(true)
    } finally {
      process.env.HOME = originalHome
      rmSync(fakeHome, { recursive: true, force: true })
    }
  })
})
