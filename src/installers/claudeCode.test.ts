import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, readFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { detectClaudeCode, claudeCodeInstaller } from './claudeCode.js'
import { readJsonFile, writeJsonFile } from './jsonFile.js'

let repoRoot: string

beforeEach(() => {
  repoRoot = mkdtempSync(join(tmpdir(), 'waycairn-claudecode-'))
})

afterEach(() => {
  rmSync(repoRoot, { recursive: true, force: true })
})

describe('detectClaudeCode', () => {
  it('returns true when <homeDir>/.claude exists', () => {
    const fakeHome = mkdtempSync(join(tmpdir(), 'waycairn-cc-home-'))
    mkdirSync(join(fakeHome, '.claude'))
    try {
      expect(detectClaudeCode(fakeHome)).toBe(true)
    } finally {
      rmSync(fakeHome, { recursive: true, force: true })
    }
  })

  it('returns false when <homeDir>/.claude does not exist', () => {
    const fakeHome = mkdtempSync(join(tmpdir(), 'waycairn-cc-home-'))
    try {
      expect(detectClaudeCode(fakeHome)).toBe(false)
    } finally {
      rmSync(fakeHome, { recursive: true, force: true })
    }
  })
})

describe('claudeCodeInstaller.installMcpServer', () => {
  it('writes .mcp.json with the waycairn stdio server entry', () => {
    claudeCodeInstaller.installMcpServer(repoRoot)
    const config = readJsonFile(join(repoRoot, '.mcp.json'))
    expect(config).toEqual({
      mcpServers: { waycairn: { type: 'stdio', command: 'waycairn', args: ['mcp'] } },
    })
  })

  it('preserves an existing, unrelated MCP server entry', () => {
    writeJsonFile(join(repoRoot, '.mcp.json'), { mcpServers: { other: { type: 'stdio', command: 'other' } } })
    claudeCodeInstaller.installMcpServer(repoRoot)
    const config = readJsonFile(join(repoRoot, '.mcp.json')) as { mcpServers: Record<string, unknown> }
    expect(config.mcpServers.other).toEqual({ type: 'stdio', command: 'other' })
    expect(config.mcpServers.waycairn).toEqual({ type: 'stdio', command: 'waycairn', args: ['mcp'] })
  })
})

describe('claudeCodeInstaller.installSkill', () => {
  it('writes .claude/skills/waycairn/SKILL.md with frontmatter naming the skill', () => {
    claudeCodeInstaller.installSkill(repoRoot)
    const content = readFileSync(join(repoRoot, '.claude', 'skills', 'waycairn', 'SKILL.md'), 'utf8')
    expect(content).toContain('name: waycairn')
    expect(content).toContain('upsert_artifact')
  })
})

describe('claudeCodeInstaller.installSessionHook', () => {
  it('adds the waycairn Stop hook to .claude/settings.json', () => {
    claudeCodeInstaller.installSessionHook(repoRoot)
    const settings = readJsonFile(join(repoRoot, '.claude', 'settings.json')) as {
      hooks: { Stop: Array<{ hooks: Array<{ command: string }> }> }
    }
    expect(settings.hooks.Stop[0].hooks[0].command).toMatch(/waycairn/)
  })

  it('is idempotent — a second run does not duplicate the hook entry', () => {
    claudeCodeInstaller.installSessionHook(repoRoot)
    claudeCodeInstaller.installSessionHook(repoRoot)
    const settings = readJsonFile(join(repoRoot, '.claude', 'settings.json')) as {
      hooks: { Stop: unknown[] }
    }
    expect(settings.hooks.Stop.length).toBe(1)
  })

  it('preserves an existing, unrelated Stop hook entry', () => {
    writeJsonFile(join(repoRoot, '.claude', 'settings.json'), {
      hooks: { Stop: [{ hooks: [{ type: 'command', command: 'echo other-hook' }] }] },
    })
    claudeCodeInstaller.installSessionHook(repoRoot)
    const settings = readJsonFile(join(repoRoot, '.claude', 'settings.json')) as {
      hooks: { Stop: Array<{ hooks: Array<{ command: string }> }> }
    }
    expect(settings.hooks.Stop.length).toBe(2)
    expect(settings.hooks.Stop.some((m) => m.hooks.some((h) => h.command === 'echo other-hook'))).toBe(true)
  })
})
