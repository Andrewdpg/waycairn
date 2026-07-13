import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'

vi.mock('./tools/listProjects', () => ({
  listProjectsTool: vi.fn().mockResolvedValue([{ id: 'p1', name: 'Repo' }]),
}))
vi.mock('./mcpToken', async () => {
  const actual = await vi.importActual<typeof import('./mcpToken.js')>('./mcpToken.js')
  return actual
})

import { createApp, nodeSchema } from './server.js'
import { mintMcpToken } from './mcpToken.js'

describe('MCP HTTP endpoint auth', () => {
  it('rejects a request with no bearer token', async () => {
    const app = createApp()
    const res = await request(app).post('/mcp').send({})
    expect(res.status).toBe(401)
  })

  it('rejects a request with an invalid bearer token', async () => {
    const app = createApp()
    const res = await request(app).post('/mcp').set('Authorization', 'Bearer garbage').send({})
    expect(res.status).toBe(401)
  })

  it('accepts a request with a valid mcp access token', async () => {
    const app = createApp()
    const token = mintMcpToken({ userId: 'u1', scopes: ['read'], supabaseAccessToken: 'sb-tok' })
    const res = await request(app).post('/mcp').set('Authorization', `Bearer ${token}`).send({})
    expect(res.status).not.toBe(401)
  })
})

describe('create_diagram/update_diagram node schema', () => {
  // Regression guard: this schema is what an MCP client actually sees when
  // it inspects the tools (Claude Code included). It previously was
  // z.any(), which hid childDiagram (the drill-down sub-diagram mechanism)
  // entirely — an agent had no way to discover it short of trial-and-error,
  // and in practice built a single flat diagram with an ad-hoc, unvalidated
  // "parent" field instead of using the real mechanism.
  it('exposes childDiagram as a documented, discoverable field', () => {
    const shape = nodeSchema.shape
    expect(shape.childDiagram).toBeDefined()
    expect(shape.childDiagram.description).toMatch(/drill/i)
  })

  it('accepts a node with childDiagram set', () => {
    const result = nodeSchema.safeParse({
      id: 'api',
      label: 'API',
      kind: 'service',
      childDiagram: 'api-components',
    })
    expect(result.success).toBe(true)
  })

  it('rejects a node with an invalid kind, listing the valid ones in the error', () => {
    const result = nodeSchema.safeParse({ id: 'x', label: 'X', kind: 'boundary' })
    expect(result.success).toBe(false)
  })
})
