// src/bin.test.ts
import { describe, it, expect, afterEach } from 'vitest'
import { join } from 'node:path'
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { execFileSync, spawn } from 'node:child_process'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

let client: Client | undefined

afterEach(async () => {
  if (client) await client.close()
  client = undefined
})

describe('bin/waycairn.ts mcp', () => {
  it(
    'starts as a real subprocess and serves all five tools over stdio, scoped to its spawn cwd',
    async () => {
      const sessionRoot = mkdtempSync(join(tmpdir(), 'waycairn-bin-mcp-'))
      try {
        const binPath = join(process.cwd(), 'bin', 'waycairn.ts')
        const transport = new StdioClientTransport({
          command: 'npx',
          args: ['tsx', binPath, 'mcp'],
          cwd: sessionRoot,
        })
        client = new Client({ name: 'test-client', version: '1.0.0' })
        await client.connect(transport)

        const { tools } = await client.listTools()
        expect(tools.map((t) => t.name).sort()).toEqual([
          'get_artifact',
          'list_artifacts',
          'list_repos',
          'upsert_artifact',
          'validate_artifact',
        ])
      } finally {
        rmSync(sessionRoot, { recursive: true, force: true })
      }
    },
    15_000
  )
})

describe('bin/waycairn.ts init', () => {
  it(
    'runs as a real subprocess, registering the repo in a HOME-scoped registry',
    () => {
      const fakeHome = mkdtempSync(join(tmpdir(), 'waycairn-bin-init-home-'))
      const repoRoot = mkdtempSync(join(tmpdir(), 'waycairn-bin-init-repo-'))
      try {
        execFileSync('git', ['-C', repoRoot, 'init', '-q'])
        execFileSync('git', [
          '-C',
          repoRoot,
          'remote',
          'add',
          'origin',
          'https://example-remote-host.test/org/bin-init-test.git',
        ])
        const binPath = join(process.cwd(), 'bin', 'waycairn.ts')
        execFileSync('npx', ['tsx', binPath, 'init'], {
          cwd: repoRoot,
          env: { ...process.env, HOME: fakeHome }, // never touch the real developer machine's ~/.waycairn
        })
        const registryPath = join(fakeHome, '.waycairn', 'registry.json')
        expect(existsSync(registryPath)).toBe(true)
        const registry = JSON.parse(readFileSync(registryPath, 'utf8'))
        expect(registry['example-remote-host.test/org/bin-init-test']).toEqual({
          path: repoRoot,
          name: 'bin-init-test',
        })
      } finally {
        rmSync(fakeHome, { recursive: true, force: true })
        rmSync(repoRoot, { recursive: true, force: true })
      }
    },
    15_000
  )
})

describe('bin/waycairn.ts init --workspace', () => {
  it(
    'runs as a real subprocess against a plain (non-git) folder, installing agent config without registering it',
    () => {
      const fakeHome = mkdtempSync(join(tmpdir(), 'waycairn-bin-init-workspace-home-'))
      const workspaceRoot = mkdtempSync(join(tmpdir(), 'waycairn-bin-init-workspace-root-'))
      try {
        const binPath = join(process.cwd(), 'bin', 'waycairn.ts')
        execFileSync('npx', ['tsx', binPath, 'init', '--workspace'], {
          cwd: workspaceRoot,
          env: { ...process.env, HOME: fakeHome },
        })
        expect(existsSync(join(fakeHome, '.waycairn', 'registry.json'))).toBe(false)
        expect(existsSync(join(workspaceRoot, '.gitignore'))).toBe(false)
      } finally {
        rmSync(fakeHome, { recursive: true, force: true })
        rmSync(workspaceRoot, { recursive: true, force: true })
      }
    },
    15_000
  )
})

describe('bin/waycairn.ts -h', () => {
  it(
    'prints a full command reference and exits 0',
    () => {
      const binPath = join(process.cwd(), 'bin', 'waycairn.ts')
      const output = execFileSync('npx', ['tsx', binPath, '-h'], { encoding: 'utf8' })
      expect(output).toContain('init --workspace')
      expect(output).toContain('Start the stdio MCP server')
      expect(output).toContain('read-only web UI')
    },
    15_000
  )

  it(
    '--help is an alias for -h',
    () => {
      const binPath = join(process.cwd(), 'bin', 'waycairn.ts')
      const output = execFileSync('npx', ['tsx', binPath, '--help'], { encoding: 'utf8' })
      expect(output).toContain('init --workspace')
    },
    15_000
  )
})

describe('bin/waycairn.ts ui', () => {
  it(
    'starts as a real subprocess and serves the local API over HTTP',
    async () => {
      const fakeHome = mkdtempSync(join(tmpdir(), 'waycairn-bin-ui-home-'))
      const sessionRoot = mkdtempSync(join(tmpdir(), 'waycairn-bin-ui-cwd-'))
      const port = 43179
      const binPath = join(process.cwd(), 'bin', 'waycairn.ts')
      const child = spawn('npx', ['tsx', binPath, 'ui'], {
        cwd: sessionRoot,
        env: { ...process.env, HOME: fakeHome, WAYCAIRN_UI_PORT: String(port) },
      })
      try {
        await waitForServerReady(`http://localhost:${port}/api/repos`, 10_000)
        const res = await fetch(`http://localhost:${port}/api/repos`)
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ local: [], registered: {} })
      } finally {
        child.kill()
        rmSync(fakeHome, { recursive: true, force: true })
        rmSync(sessionRoot, { recursive: true, force: true })
      }
    },
    15_000
  )
})

async function waitForServerReady(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch {
      // server not up yet — keep polling
    }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  throw new Error(`server at ${url} did not become ready within ${timeoutMs}ms`)
}
