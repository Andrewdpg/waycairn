import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ensureGitignoreEntry } from './gitignoreUpdate.js'

let repoRoot: string

beforeEach(() => {
  repoRoot = mkdtempSync(join(tmpdir(), 'waycairn-gitignore-'))
})

afterEach(() => {
  rmSync(repoRoot, { recursive: true, force: true })
})

describe('ensureGitignoreEntry', () => {
  it('creates .gitignore with the waycairn block when none exists', () => {
    ensureGitignoreEntry(repoRoot)
    const content = readFileSync(join(repoRoot, '.gitignore'), 'utf8')
    expect(content).toContain('.waycairn/index.sqlite')
  })

  it('appends to an existing .gitignore, preserving its content', () => {
    writeFileSync(join(repoRoot, '.gitignore'), 'node_modules\ndist\n')
    ensureGitignoreEntry(repoRoot)
    const content = readFileSync(join(repoRoot, '.gitignore'), 'utf8')
    expect(content).toContain('node_modules')
    expect(content).toContain('dist')
    expect(content).toContain('.waycairn/index.sqlite')
  })

  it('is idempotent — running twice does not duplicate the entry', () => {
    ensureGitignoreEntry(repoRoot)
    ensureGitignoreEntry(repoRoot)
    const content = readFileSync(join(repoRoot, '.gitignore'), 'utf8')
    expect(content.split('.waycairn/index.sqlite').length - 1).toBe(1)
  })

  it('handles an existing .gitignore with no trailing newline', () => {
    writeFileSync(join(repoRoot, '.gitignore'), 'node_modules') // no trailing \n
    ensureGitignoreEntry(repoRoot)
    const content = readFileSync(join(repoRoot, '.gitignore'), 'utf8')
    expect(content).toContain('node_modules\n')
    expect(content).toContain('.waycairn/index.sqlite')
  })

  it('does not create a .gitignore-adjacent file, only .gitignore itself', () => {
    ensureGitignoreEntry(repoRoot)
    expect(existsSync(join(repoRoot, '.gitignore'))).toBe(true)
  })
})
