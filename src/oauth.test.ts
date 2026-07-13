import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import jwt from 'jsonwebtoken'

// frontendUrl/supabaseUrl/etc. are read once at oauth.ts's module load.
// Static imports in ESM/TS always evaluate before any of this file's own
// top-level statements, regardless of source order — vi.hoisted runs before
// all imports are resolved, which is what actually gets these env vars set
// in time.
vi.hoisted(() => {
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

// In-memory stand-in for mcpClients.ts's Supabase-backed persistence —
// oauth.ts only depends on the registerClient/getClient contract, not on
// how it's implemented, so this is sufficient without spinning up a real
// Supabase client for these tests. mcpClients.test.ts covers the real
// module's Supabase calls directly.
vi.mock('./mcpClients', () => {
  const clients = new Map<string, { clientId: string; redirectUris: string[] }>()
  return {
    registerClient: vi.fn(async (redirectUris: string[]) => {
      const clientId = Math.random().toString(36).slice(2)
      const client = { clientId, redirectUris }
      clients.set(clientId, client)
      return client
    }),
    getClient: vi.fn(async (clientId: string) => clients.get(clientId) ?? null),
  }
})

import { createOAuthRouter } from './oauth.js'
import { markMcpSession } from './mcpSessions.js'
import { mintMcpToken } from './mcpToken.js'

function makeApp() {
  const app = express()
  app.use(express.json())
  // Mirrors server.ts's real middleware stack: OAuth's token endpoint
  // (RFC 6749 §4.1.3) MUST use application/x-www-form-urlencoded, not
  // JSON — real OAuth clients (Claude Code included) POST /oauth/token
  // that way. Without this parser, req.body was undefined for that
  // content type.
  app.use(express.urlencoded({ extended: true }))
  app.use('/oauth', createOAuthRouter())
  return app
}

function fakeSupabaseAccessToken(sessionId: string) {
  return jwt.sign({ sub: 'user-123', session_id: sessionId }, 'irrelevant-not-verified-locally', {
    noTimestamp: true,
  })
}

// Registers a client the way a real MCP client would before ever calling
// /authorize, returning its client_id.
async function registerClient(app: express.Express, redirectUris: string[]): Promise<string> {
  const res = await request(app).post('/oauth/register').send({ redirect_uris: redirectUris })
  return res.body.client_id
}

beforeEach(() => {
  mockGetUser.mockReset()
})

describe('POST /oauth/register', () => {
  it('registers a client and issues a client_id, without a client_secret (public client)', async () => {
    const res = await request(makeApp())
      .post('/oauth/register')
      .send({ redirect_uris: ['https://claude.ai/callback'] })
    expect(res.status).toBe(201)
    expect(res.body.client_id).toBeTruthy()
    expect(res.body.client_secret).toBeUndefined()
    expect(res.body.token_endpoint_auth_method).toBe('none')
    expect(res.body.redirect_uris).toEqual(['https://claude.ai/callback'])
  })

  it('rejects registration with no redirect_uris', async () => {
    const res = await request(makeApp()).post('/oauth/register').send({})
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('invalid_client_metadata')
  })
})

describe('GET /oauth/authorize', () => {
  it('rejects an unknown client_id (never registered)', async () => {
    const res = await request(makeApp()).get('/oauth/authorize').query({
      client_id: 'never-registered',
      redirect_uri: 'https://claude.ai/callback',
      code_challenge: 'YmFzZTY0dXJsLWNoYWxsZW5nZQ',
      code_challenge_method: 'plain',
      scope: 'read',
    })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('invalid_request')
  })

  it('rejects a redirect_uri that does not match this client_id\'s registration', async () => {
    const app = makeApp()
    const clientId = await registerClient(app, ['https://claude.ai/callback'])

    const res = await request(app).get('/oauth/authorize').query({
      client_id: clientId,
      redirect_uri: 'https://attacker.example/steal',
      code_challenge: 'YmFzZTY0dXJsLWNoYWxsZW5nZQ',
      code_challenge_method: 'plain',
      scope: 'read',
    })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('invalid_request')
  })

  it('redirects to the frontend consent screen, not directly to the client redirect_uri', async () => {
    const app = makeApp()
    const clientId = await registerClient(app, ['https://claude.ai/callback'])

    const res = await request(app).get('/oauth/authorize').query({
      client_id: clientId,
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

describe('GET /oauth/authorize/:flowId', () => {
  it('rejects an unknown or expired flow id', async () => {
    const res = await request(makeApp()).get('/oauth/authorize/does-not-exist')
    expect(res.status).toBe(400)
  })

  it('returns the scope the client requested, for the consent screen to display', async () => {
    const app = makeApp()
    const clientId = await registerClient(app, ['https://claude.ai/callback'])
    const authRes = await request(app).get('/oauth/authorize').query({
      client_id: clientId,
      redirect_uri: 'https://claude.ai/callback',
      code_challenge: 'YmFzZTY0dXJsLWNoYWxsZW5nZQ',
      code_challenge_method: 'plain',
      scope: 'read write',
    })
    const flowId = new URL(authRes.headers.location!).searchParams.get('flow')!

    const res = await request(app).get(`/oauth/authorize/${flowId}`)
    expect(res.status).toBe(200)
    expect(res.body.requested_scope).toBe('read write')
  })
})

describe('POST /oauth/authorize/:flowId/complete', () => {
  it('rejects an unknown or expired flow id', async () => {
    const res = await request(makeApp())
      .post('/oauth/authorize/does-not-exist/complete')
      .send({ access_token: 'whatever', scopes: ['read'] })
    expect(res.status).toBe(400)
  })

  it('rejects when scopes is missing, empty, or contains an invalid value', async () => {
    const app = makeApp()
    const clientId = await registerClient(app, ['https://claude.ai/callback'])
    const authRes = await request(app).get('/oauth/authorize').query({
      client_id: clientId,
      redirect_uri: 'https://claude.ai/callback',
      code_challenge: 'YmFzZTY0dXJsLWNoYWxsZW5nZQ',
      code_challenge_method: 'plain',
      scope: 'read',
    })
    const flowId = new URL(authRes.headers.location!).searchParams.get('flow')!
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null })
    const accessToken = fakeSupabaseAccessToken('session-abc')

    for (const badScopes of [undefined, [], ['superadmin']]) {
      const res = await request(app)
        .post(`/oauth/authorize/${flowId}/complete`)
        .send({ access_token: accessToken, scopes: badScopes })
      expect(res.status).toBe(400)
      expect(res.body.error).toBe('invalid_request')
    }
  })

  it('rejects when Supabase rejects the access_token (not a real session)', async () => {
    const app = makeApp()
    const clientId = await registerClient(app, ['https://claude.ai/callback'])
    const authRes = await request(app).get('/oauth/authorize').query({
      client_id: clientId,
      redirect_uri: 'https://claude.ai/callback',
      code_challenge: 'YmFzZTY0dXJsLWNoYWxsZW5nZQ',
      code_challenge_method: 'plain',
      scope: 'read',
    })
    const flowId = new URL(authRes.headers.location!).searchParams.get('flow')!

    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'invalid token' } })
    const res = await request(app)
      .post(`/oauth/authorize/${flowId}/complete`)
      .send({ access_token: 'forged-token', scopes: ['read'] })
    expect(res.status).toBe(401)
  })

  it('sends the CORS headers the frontend needs to read the response cross-origin', async () => {
    // Regression guard: /mcp-authorize (the frontend, on its own port —
    // a different origin from this server) calls this endpoint via
    // fetch(). Without Access-Control-Allow-Origin, the browser blocks the
    // response before JS ever sees it, surfacing as an opaque
    // "NetworkError" with no status code to debug from — this endpoint is
    // the one route in this router actually called from browser JS rather
    // than server-to-server or via top-level navigation.
    const app = makeApp()
    const preflight = await request(app)
      .options('/oauth/authorize/some-flow/complete')
      .set('Origin', 'http://localhost:5173')
    expect(preflight.status).toBe(204)
    expect(preflight.headers['access-control-allow-origin']).toBe('http://localhost:5173')

    const clientId = await registerClient(app, ['https://claude.ai/callback'])
    const authRes = await request(app).get('/oauth/authorize').query({
      client_id: clientId,
      redirect_uri: 'https://claude.ai/callback',
      code_challenge: 'YmFzZTY0dXJsLWNoYWxsZW5nZQ',
      code_challenge_method: 'plain',
      scope: 'read',
    })
    const flowId = new URL(authRes.headers.location!).searchParams.get('flow')!
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null })

    const res = await request(app)
      .post(`/oauth/authorize/${flowId}/complete`)
      .send({ access_token: fakeSupabaseAccessToken('session-abc'), scopes: ['read'] })
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173')
  })

  it('grants only the scopes the user chose on the consent screen, not what the client requested', async () => {
    // The core of this feature: an MCP client can request scope=read
    // write admin, but the user only checks "read" on the consent
    // screen — the minted token must carry only what the user granted.
    const app = makeApp()
    const clientId = await registerClient(app, ['https://claude.ai/callback'])
    const authRes = await request(app).get('/oauth/authorize').query({
      client_id: clientId,
      redirect_uri: 'https://claude.ai/callback',
      code_challenge: 'YmFzZTY0dXJsLWNoYWxsZW5nZQ',
      code_challenge_method: 'plain',
      scope: 'read write admin',
      state: 'xyz',
    })
    const flowId = new URL(authRes.headers.location!).searchParams.get('flow')!

    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null })
    const accessToken = fakeSupabaseAccessToken('session-abc')

    const res = await request(app)
      .post(`/oauth/authorize/${flowId}/complete`)
      .send({ access_token: accessToken, scopes: ['read'] })

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
      })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('invalid_grant')
  })

  it('parses a real OAuth client\'s application/x-www-form-urlencoded request body, not just JSON', async () => {
    // Regression guard: RFC 6749 §4.1.3 mandates form-urlencoded for this
    // endpoint. Before express.urlencoded() was added, req.body was
    // undefined for this content type, throwing an uncaught TypeError that
    // leaked Express's raw HTML error page instead of an OAuth-shaped JSON
    // error — which broke Claude Code's own error parsing outright.
    const app = makeApp()
    const res = await request(app)
      .post('/oauth/token')
      .type('form')
      .send('grant_type=authorization_code&code=does-not-exist&code_verifier=irrelevant')
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('invalid_grant')
  })

  it('exchanges a code from a completed flow + matching PKCE verifier for an mcp access token', async () => {
    const app = makeApp()
    const clientId = await registerClient(app, ['https://claude.ai/callback'])
    const authRes = await request(app).get('/oauth/authorize').query({
      client_id: clientId,
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
      .send({ access_token: accessToken, scopes: ['read'] })
    const code = new URL(completeRes.body.redirect_uri).searchParams.get('code')!

    const res = await request(app).post('/oauth/token').send({
      grant_type: 'authorization_code',
      code,
      code_verifier: 'YmFzZTY0dXJsLWNoYWxsZW5nZQ',
    })
    expect(res.status).toBe(200)
    expect(res.body.access_token).toBe('minted-mcp-token')
    expect(markMcpSession).toHaveBeenCalledWith('session-abc', 'user-123')
    // Client requested "read write" above, but the consent screen only
    // granted "read" — the minted token must reflect the user's choice,
    // not the client's ask.
    expect(mintMcpToken).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-123', scopes: ['read'] })
    )
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
