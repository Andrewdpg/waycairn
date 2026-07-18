// src/repoId.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { normalizeGitRemoteUrl, getRepoId, NoGitRemoteError, UnrecognizedGitRemoteUrlError } from './repoId.js'

describe('normalizeGitRemoteUrl', () => {
  it('normalizes an scp-like ssh URL with no alias to resolve', () => {
    expect(normalizeGitRemoteUrl('git@github.com:org/repo.git', null)).toBe('github.com/org/repo')
  })

  it('normalizes an https URL without a trailing .git', () => {
    expect(normalizeGitRemoteUrl('https://github.com/org/repo', null)).toBe('github.com/org/repo')
  })

  it('normalizes an ssh:// URL with a user prefix', () => {
    expect(normalizeGitRemoteUrl('ssh://git@github.com/org/repo.git', null)).toBe('github.com/org/repo')
  })

  it('resolves an ssh config host alias to its real HostName', () => {
    const sshConfig = [
      'Host b-personal',
      '  HostName bitbucket.org',
      '  User git',
      '  IdentityFile ~/.ssh/id_personal',
      '',
      'Host b-swiset',
      '  HostName bitbucket.org',
      '  User git',
    ].join('\n')
    expect(normalizeGitRemoteUrl('git@b-personal:org-a/payment-service.git', sshConfig)).toBe(
      'bitbucket.org/org-a/payment-service'
    )
    expect(normalizeGitRemoteUrl('git@b-swiset:org-b/payment-service.git', sshConfig)).toBe(
      'bitbucket.org/org-b/payment-service'
    )
  })

  it('leaves a host unchanged when no matching alias exists', () => {
    const sshConfig = 'Host other-alias\n  HostName example.com\n'
    expect(normalizeGitRemoteUrl('git@github.com:org/repo.git', sshConfig)).toBe('github.com/org/repo')
  })

  it('throws UnrecognizedGitRemoteUrlError for an unparseable URL', () => {
    expect(() => normalizeGitRemoteUrl('not a url at all', null)).toThrow(UnrecognizedGitRemoteUrlError)
  })
})

describe('getRepoId', () => {
  let repoRoot: string

  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), 'waycairn-repoid-'))
    execFileSync('git', ['-C', repoRoot, 'init', '-q'])
  })

  afterEach(() => {
    rmSync(repoRoot, { recursive: true, force: true })
  })

  it('computes the repoId from a real repo\'s origin remote', () => {
    execFileSync('git', ['-C', repoRoot, 'remote', 'add', 'origin', 'https://example-remote-host.test/org/repo.git'])
    expect(getRepoId(repoRoot)).toBe('example-remote-host.test/org/repo')
  })

  it('throws NoGitRemoteError when there is no origin remote', () => {
    expect(() => getRepoId(repoRoot)).toThrow(NoGitRemoteError)
  })
})
