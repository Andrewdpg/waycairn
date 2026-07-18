import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parse } from 'smol-toml'
import { detectCodex, codexInstaller } from './codex.js'
import { readJsonFile } from './jsonFile.js'

let repoRoot: string

beforeEach(() => {
  repoRoot = mkdtempSync(join(tmpdir(), 'waycairn-codex-'))
})

afterEach(() => {
  rmSync(repoRoot, { recursive: true, force: true })
})

describe('detectCodex', () => {
  it('returns true when <homeDir>/.codex exists', () => {
    const fakeHome = mkdtempSync(join(tmpdir(), 'waycairn-codex-home-'))
    mkdirSync(join(fakeHome, '.codex'))
    try {
      expect(detectCodex(fakeHome)).toBe(true)
    } finally {
      rmSync(fakeHome, { recursive: true, force: true })
    }
  })

  it('returns false when <homeDir>/.codex does not exist', () => {
    const fakeHome = mkdtempSync(join(tmpdir(), 'waycairn-codex-home-'))
    try {
      expect(detectCodex(fakeHome)).toBe(false)
    } finally {
      rmSync(fakeHome, { recursive: true, force: true })
    }
  })
})

describe('codexInstaller.installMcpServer', () => {
  it('writes .codex/config.toml with a waycairn mcp_servers table', () => {
    codexInstaller.installMcpServer(repoRoot)
    const toml = readFileSync(join(repoRoot, '.codex', 'config.toml'), 'utf8')
    const parsed = parse(toml) as { mcp_servers?: { waycairn?: { command: string; args: string[] } } }
    expect(parsed.mcp_servers?.waycairn).toEqual({ command: 'waycairn', args: ['mcp'] })
  })

  it('preserves an existing, unrelated table in config.toml', () => {
    mkdirSync(join(repoRoot, '.codex'), { recursive: true })
    writeFileSync(join(repoRoot, '.codex', 'config.toml'), '[mcp_servers.other]\ncommand = "other"\n', 'utf8')
    codexInstaller.installMcpServer(repoRoot)
    const parsed = parse(readFileSync(join(repoRoot, '.codex', 'config.toml'), 'utf8')) as {
      mcp_servers?: { other?: { command: string }; waycairn?: { command: string } }
    }
    expect(parsed.mcp_servers?.other).toEqual({ command: 'other' })
    expect(parsed.mcp_servers?.waycairn?.command).toBe('waycairn')
  })
})

describe('codexInstaller.installSkill', () => {
  it('is a no-op — Codex has no skill concept', () => {
    const result = codexInstaller.installSkill(repoRoot)
    expect(result).toEqual({ installed: false, detail: 'Codex has no skill concept' })
  })
})

describe('codexInstaller.installSessionHook', () => {
  it('writes .codex/hooks.json with a Stop hook', () => {
    codexInstaller.installSessionHook(repoRoot)
    const hooks = readJsonFile(join(repoRoot, '.codex', 'hooks.json')) as {
      hooks: { Stop: Array<{ hooks: Array<{ command: string }> }> }
    }
    expect(hooks.hooks.Stop[0].hooks[0].command).toMatch(/waycairn/)
  })

  it('is idempotent — a second run does not duplicate the hook entry', () => {
    codexInstaller.installSessionHook(repoRoot)
    codexInstaller.installSessionHook(repoRoot)
    const hooks = readJsonFile(join(repoRoot, '.codex', 'hooks.json')) as { hooks: { Stop: unknown[] } }
    expect(hooks.hooks.Stop.length).toBe(1)
  })
})
