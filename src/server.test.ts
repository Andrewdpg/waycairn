import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'

vi.mock('./tools/listProjects', () => ({
  listProjectsTool: vi.fn().mockResolvedValue([{ id: 'p1', name: 'Repo' }]),
}))
vi.mock('./mcpToken', async () => {
  const actual = await vi.importActual<typeof import('./mcpToken.js')>('./mcpToken.js')
  return actual
})

import { createApp } from './server.js'
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
