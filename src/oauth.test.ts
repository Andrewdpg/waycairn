import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import jwt from 'jsonwebtoken'

// allowedRedirectUris/supabaseUrl/etc. are read once at oauth.ts's module
// load. Static imports in ESM/TS always evaluate before any of this file's
// own top-level statements, regardless of source order — vi.hoisted runs
// before all imports are resolved, which is what actually gets these env
// vars set in time.
vi.hoisted(() => {
  process.env.MCP_OAUTH_ALLOWED_REDIRECT_URIS = 'https://claude.ai/callback'
  process.env.MCP_FRONTEND_URL = 'http://localhost:5173'
  process.env.SUPABASE_URL = 'http://127.0.0.1:54321'
  process.env.SUPABASE_ANON_KEY = 'anon-key-for-tests'
})

const { mockGetUser } = vi.hoisted(() => ({ mockGetUser: vi.fn() }))
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ auth: { getUser: mockGetUser } }),
}))

vi.mock('./mcpToken', () => ({
  mintMcpToken: vi.fn(() => 'minted-mcp-token'),
}))

vi.mock('./mcpSessions', () => ({
  markMcpSession: vi.fn().mockResolvedValue(undefined),
}))

import { createOAuthRouter } from './oauth.js'
import { markMcpSession } from './mcpSessions.js'

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/oauth', createOAuthRouter())
  return app
}

function fakeSupabaseAccessToken(sessionId: string) {
  return jwt.sign({ sub: 'user-123', session_id: sessionId }, 'irrelevant-not-verified-locally', {
    noTimestamp: true,
  })
}

beforeEach(() => {
  mockGetUser.mockReset()
})

describe('GET /oauth/authorize', () => {
  it('rejects a redirect_uri that is not on the configured allowlist', async () => {
    const res = await request(makeApp()).get('/oauth/authorize').query({
      response_type: 'code',
      client_id: 'claude-code',
      redirect_uri: 'https://attacker.example/steal',
      code_challenge: 'YmFzZTY0dXJsLWNoYWxsZW5nZQ',
      code_challenge_method: 'plain',
      scope: 'read',
      state: 'xyz',
    })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('invalid_request')
  })

  it('redirects to the frontend consent screen, not directly to the client redirect_uri', async () => {
    const res = await request(makeApp()).get('/oauth/authorize').query({
      response_type: 'code',
      client_id: 'claude-code',
      redirect_uri: 'https://claude.ai/callback',
      code_challenge: 'YmFzZTY0dXJsLWNoYWxsZW5nZQ',
      code_challenge_method: 'plain',
      scope: 'read write',
      state: 'xyz',
    })
    expect(res.status).toBe(302)
    const location = new URL(res.headers.location!)
    expect(location.origin + location.pathname).toBe('http://localhost:5173/mcp-authorize')
    expect(location.searchParams.get('flow')).toBeTruthy()
  })
})

describe('POST /oauth/authorize/:flowId/complete', () => {
  it('rejects an unknown or expired flow id', async () => {
    const res = await request(makeApp())
      .post('/oauth/authorize/does-not-exist/complete')
      .send({ access_token: 'whatever' })
    expect(res.status).toBe(400)
  })

  it('rejects when Supabase rejects the access_token (not a real session)', async () => {
    const app = makeApp()
    const authRes = await request(app).get('/oauth/authorize').query({
      redirect_uri: 'https://claude.ai/callback',
      code_challenge: 'YmFzZTY0dXJsLWNoYWxsZW5nZQ',
      code_challenge_method: 'plain',
      scope: 'read',
    })
    const flowId = new URL(authRes.headers.location!).searchParams.get('flow')!

    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'invalid token' } })
    const res = await request(app)
      .post(`/oauth/authorize/${flowId}/complete`)
      .send({ access_token: 'forged-token' })
    expect(res.status).toBe(401)
  })

  it('completes the flow and returns the client redirect_uri carrying a code, once given a real Supabase session', async () => {
    const app = makeApp()
    const authRes = await request(app).get('/oauth/authorize').query({
      redirect_uri: 'https://claude.ai/callback',
      code_challenge: 'YmFzZTY0dXJsLWNoYWxsZW5nZQ',
      code_challenge_method: 'plain',
      scope: 'read write',
      state: 'xyz',
    })
    const flowId = new URL(authRes.headers.location!).searchParams.get('flow')!

    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null })
    const accessToken = fakeSupabaseAccessToken('session-abc')

    const res = await request(app)
      .post(`/oauth/authorize/${flowId}/complete`)
      .send({ access_token: accessToken })

    expect(res.status).toBe(200)
    const redirect = new URL(res.body.redirect_uri)
    expect(redirect.origin + redirect.pathname).toBe('https://claude.ai/callback')
    expect(redirect.searchParams.get('code')).toBeTruthy()
    expect(redirect.searchParams.get('state')).toBe('xyz')
  })
})

describe('POST /oauth/token', () => {
  it('rejects a token exchange for an unknown/expired authorization code', async () => {
    const res = await request(makeApp())
      .post('/oauth/token')
      .send({
        grant_type: 'authorization_code',
        code: 'does-not-exist',
        code_verifier: 'irrelevant',
        client_id: 'claude-code',
      })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('invalid_grant')
  })

  it('exchanges a code from a completed flow + matching PKCE verifier for an mcp access token', async () => {
    const app = makeApp()
    const authRes = await request(app).get('/oauth/authorize').query({
      redirect_uri: 'https://claude.ai/callback',
      code_challenge: 'YmFzZTY0dXJsLWNoYWxsZW5nZQ', // base64url("base64url-challenge")-shaped placeholder
      code_challenge_method: 'plain',
      scope: 'read write',
      state: 'xyz',
    })
    const flowId = new URL(authRes.headers.location!).searchParams.get('flow')!

    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null })
    const accessToken = fakeSupabaseAccessToken('session-abc')
    const completeRes = await request(app)
      .post(`/oauth/authorize/${flowId}/complete`)
      .send({ access_token: accessToken })
    const code = new URL(completeRes.body.redirect_uri).searchParams.get('code')!

    const res = await request(app).post('/oauth/token').send({
      grant_type: 'authorization_code',
      code,
      code_verifier: 'YmFzZTY0dXJsLWNoYWxsZW5nZQ',
      client_id: 'claude-code',
    })
    expect(res.status).toBe(200)
    expect(res.body.access_token).toBe('minted-mcp-token')
    expect(markMcpSession).toHaveBeenCalledWith('session-abc', 'user-123')
  })

  it('rejects a token exchange for a code whose flow was never completed', async () => {
    // Defensive case: pendingCodes should never contain an entry without
    // userId/supabaseAccessToken by construction (only /complete inserts
    // into it), but /token explicitly guards against it anyway.
    const app = makeApp()
    const res = await request(app).post('/oauth/token').send({
      grant_type: 'authorization_code',
      code: 'never-existed',
      code_verifier: 'irrelevant',
    })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('invalid_grant')
  })
})
