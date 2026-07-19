import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createUiServer } from './uiServer.js'
import { upsertRegistryEntry } from './registry.js'
import { upsertArtifactTool } from './tools/upsertArtifact.js'

let cwd: string
let registryPath: string
let staticDir: string

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), 'waycairn-uiserver-cwd-'))
  registryPath = join(mkdtempSync(join(tmpdir(), 'waycairn-uiserver-registry-')), 'registry.json')
  staticDir = mkdtempSync(join(tmpdir(), 'waycairn-uiserver-static-'))
})

afterEach(() => {
  rmSync(cwd, { recursive: true, force: true })
  rmSync(staticDir, { recursive: true, force: true })
})

describe('createUiServer', () => {
  it('GET /api/repos returns local + registered repos', async () => {
    mkdirSync(join(cwd, '.git'))
    upsertRegistryEntry(registryPath, 'host/org/repo', { path: '/somewhere', name: 'repo' })
    const app = createUiServer(cwd, registryPath, staticDir)
    const res = await request(app).get('/api/repos')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ local: ['.'], registered: { 'host/org/repo': { path: '/somewhere', name: 'repo' } } })
  })

  it('GET /api/repos excludes a local repo from "local" once it is also registered', async () => {
    const siblingPath = join(cwd, 'sibling')
    mkdirSync(join(siblingPath, '.git'), { recursive: true })
    upsertRegistryEntry(registryPath, 'host/org/sibling', { path: siblingPath, name: 'sibling' })
    const app = createUiServer(cwd, registryPath, staticDir)
    const res = await request(app).get('/api/repos')
    expect(res.status).toBe(200)
    expect(res.body.local).toEqual([])
    expect(res.body.registered).toEqual({ 'host/org/sibling': { path: siblingPath, name: 'sibling' } })
  })

  it('GET /api/repos/:repoId/artifacts lists artifacts for a registered repo, repoId URL-encoded', async () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'waycairn-uiserver-repo-'))
    try {
      upsertArtifactTool(join(repoRoot, '.waycairn'), 'diagram', 'a', { nodes: [], edges: [] })
      upsertRegistryEntry(registryPath, 'host/org/repo', { path: repoRoot, name: 'repo' })
      const app = createUiServer(cwd, registryPath, staticDir)
      const res = await request(app).get(`/api/repos/${encodeURIComponent('host/org/repo')}/artifacts?kind=diagram`)
      expect(res.status).toBe(200)
      expect((res.body as Array<{ id: string }>).map((r) => r.id)).toEqual(['a'])
    } finally {
      rmSync(repoRoot, { recursive: true, force: true })
    }
  })

  it('GET /api/repos/:repoId/artifacts defaults kind to "diagram" when omitted', async () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'waycairn-uiserver-repo-'))
    try {
      upsertArtifactTool(join(repoRoot, '.waycairn'), 'diagram', 'a', { nodes: [], edges: [] })
      upsertRegistryEntry(registryPath, 'host/org/repo', { path: repoRoot, name: 'repo' })
      const app = createUiServer(cwd, registryPath, staticDir)
      const res = await request(app).get(`/api/repos/${encodeURIComponent('host/org/repo')}/artifacts`)
      expect(res.status).toBe(200)
      expect((res.body as Array<{ id: string }>).map((r) => r.id)).toEqual(['a'])
    } finally {
      rmSync(repoRoot, { recursive: true, force: true })
    }
  })

  it('GET /api/repos/:repoId/artifacts returns 404 for an unregistered repoId', async () => {
    const app = createUiServer(cwd, registryPath, staticDir)
    const res = await request(app).get(`/api/repos/${encodeURIComponent('host/org/never')}/artifacts`)
    expect(res.status).toBe(404)
  })

  it('GET /api/repos/:repoId/artifacts/:id fetches a single artifact', async () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'waycairn-uiserver-repo-'))
    try {
      upsertArtifactTool(join(repoRoot, '.waycairn'), 'diagram', 'a', { nodes: [], edges: [] })
      upsertRegistryEntry(registryPath, 'host/org/repo', { path: repoRoot, name: 'repo' })
      const app = createUiServer(cwd, registryPath, staticDir)
      const res = await request(app).get(`/api/repos/${encodeURIComponent('host/org/repo')}/artifacts/a`)
      expect(res.status).toBe(200)
      expect(res.body).toMatchObject({ id: 'a', kind: 'diagram' })
    } finally {
      rmSync(repoRoot, { recursive: true, force: true })
    }
  })

  it('GET /api/repos/:repoId/artifacts/:id returns 404 for a missing artifact id', async () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'waycairn-uiserver-repo-'))
    try {
      upsertRegistryEntry(registryPath, 'host/org/repo', { path: repoRoot, name: 'repo' })
      const app = createUiServer(cwd, registryPath, staticDir)
      const res = await request(app).get(`/api/repos/${encodeURIComponent('host/org/repo')}/artifacts/missing`)
      expect(res.status).toBe(404)
    } finally {
      rmSync(repoRoot, { recursive: true, force: true })
    }
  })

  it('serves static files from staticDir', async () => {
    writeFileSync(join(staticDir, 'index.html'), '<html>waycairn ui</html>')
    const app = createUiServer(cwd, registryPath, staticDir)
    const res = await request(app).get('/index.html')
    expect(res.status).toBe(200)
    expect(res.text).toContain('waycairn ui')
  })
})
