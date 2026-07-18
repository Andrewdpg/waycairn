import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { listRepos } from './listRepos.js'

let cwd: string

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), 'waycairn-listrepos-'))
})

afterEach(() => {
  rmSync(cwd, { recursive: true, force: true })
})

describe('listRepos', () => {
  it('returns an empty array when cwd has no repos at all', () => {
    expect(listRepos(cwd)).toEqual([])
  })

  it('includes "." when cwd itself is a git repo (directory .git)', () => {
    mkdirSync(join(cwd, '.git'))
    expect(listRepos(cwd)).toEqual(['.'])
  })

  it('includes an immediate subdirectory that is a git repo', () => {
    mkdirSync(join(cwd, 'auth-service', '.git'), { recursive: true })
    mkdirSync(join(cwd, 'not-a-repo'))
    expect(listRepos(cwd)).toEqual(['auth-service'])
  })

  it('treats a worktree-style .git FILE (not a directory) as a valid repo too', () => {
    mkdirSync(join(cwd, 'payment-service'))
    writeFileSync(join(cwd, 'payment-service', '.git'), 'gitdir: /elsewhere/.git/worktrees/payment-service\n')
    expect(listRepos(cwd)).toEqual(['payment-service'])
  })

  it('returns results sorted, combining "." and subdirectories', () => {
    mkdirSync(join(cwd, '.git'))
    mkdirSync(join(cwd, 'zeta', '.git'), { recursive: true })
    mkdirSync(join(cwd, 'alpha', '.git'), { recursive: true })
    expect(listRepos(cwd)).toEqual(['.', 'alpha', 'zeta'])
  })

  it('ignores non-directory entries in cwd', () => {
    writeFileSync(join(cwd, 'README.md'), 'hello')
    expect(listRepos(cwd)).toEqual([])
  })
})
