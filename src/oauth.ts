import { Router } from 'express'
import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { createClient } from '@supabase/supabase-js'
import { mintMcpToken } from './mcpToken.js'
import { markMcpSession } from './mcpSessions.js'

interface RegisteredClient {
  clientId: string
  redirectUris: string[]
  createdAt: number
}

interface PendingAuthorization {
  codeChallenge: string
  codeChallengeMethod: 'plain' | 'S256'
  scopes: ('read' | 'write' | 'admin')[]
  redirectUri: string
  state?: string
  createdAt: number
  // Filled in by POST /authorize/:flowId/complete once the frontend
  // confirms a real Supabase session — absent until then, which is what
  // GET /token checks to reject a code minted for a flow nobody completed.
  supabaseAccessToken?: string
  userId?: string
}

// In-memory stores — a single-instance dev/first-deploy assumption.
// ponytail: swap for a shared store (Redis, or a Supabase table) if/when
// this service runs as more than one instance behind a load balancer.
const registeredClients = new Map<string, RegisteredClient>()
const pendingFlows = new Map<string, PendingAuthorization>()
const pendingCodes = new Map<string, PendingAuthorization>()
const CLIENT_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days — registrations are meant to be long-lived
const FLOW_TTL_MS = 10 * 60 * 1000
const CODE_TTL_MS = 5 * 60 * 1000
const MAX_PENDING = 10_000

function verifyPkce(verifier: string, challenge: string, method: 'plain' | 'S256'): boolean {
  if (method === 'plain') return verifier === challenge
  const hashed = crypto.createHash('sha256').update(verifier).digest('base64url')
  return hashed === challenge
}

// Where the web app's consent screen lives — GET /authorize redirects the
// user's browser here to actually establish/confirm their Supabase
// session before an authorization code is minted.
const frontendUrl = process.env.MCP_FRONTEND_URL ?? 'http://localhost:5173'

// Used only to verify a bearer token the frontend hands us really is a
// live Supabase session (supabase.auth.getUser makes a real call to Auth
// rather than trusting a decoded-but-unverified JWT) — a network
// round-trip, but this only runs once per OAuth consent, not per tool
// call, so the cost doesn't matter.
const supabaseUrl = process.env.SUPABASE_URL
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables')
}

function pruneExpired<T extends { createdAt: number }>(store: Map<string, T>, ttlMs: number): void {
  const now = Date.now()
  for (const [key, value] of store) {
    if (now - value.createdAt > ttlMs) store.delete(key)
  }
}

export function createOAuthRouter(): Router {
  const router = Router()

  // OAuth 2.0 Dynamic Client Registration (RFC 7591). MCP clients (Claude
  // Code, etc.) call this before /authorize to obtain a client_id, rather
  // than a pre-shared one — this server is a public client registrar (no
  // client_secret issued; PKCE is required on every /authorize instead).
  // Each client's redirect_uris are recorded here and are the ONLY
  // redirect_uri /authorize will accept for that client_id — replacing a
  // single global allowlist, since different MCP clients legitimately use
  // different (sometimes dynamically-chosen loopback) redirect URIs.
  router.post('/register', (req, res) => {
    const { redirect_uris: redirectUris } = req.body as { redirect_uris?: unknown }

    if (!Array.isArray(redirectUris) || redirectUris.length === 0 || !redirectUris.every((u) => typeof u === 'string')) {
      return res
        .status(400)
        .json({ error: 'invalid_client_metadata', error_description: 'redirect_uris must be a non-empty string array' })
    }

    pruneExpired(registeredClients, CLIENT_TTL_MS)
    if (registeredClients.size >= MAX_PENDING) {
      return res.status(503).json({ error: 'temporarily_unavailable' })
    }

    const clientId = crypto.randomBytes(16).toString('hex')
    const createdAt = Date.now()
    registeredClients.set(clientId, { clientId, redirectUris, createdAt })

    res.status(201).json({
      client_id: clientId,
      client_id_issued_at: Math.floor(createdAt / 1000),
      redirect_uris: redirectUris,
      grant_types: ['authorization_code'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    })
  })

  router.get('/authorize', (req, res) => {
    const { client_id: clientId, redirect_uri: redirectUri, code_challenge: codeChallenge, code_challenge_method: codeChallengeMethod, scope, state } =
      req.query as Record<string, string>

    const client = clientId ? registeredClients.get(clientId) : undefined
    if (!client) {
      return res.status(400).json({ error: 'invalid_request', error_description: 'unknown client_id — call /register first' })
    }
    if (!redirectUri || !client.redirectUris.includes(redirectUri)) {
      return res
        .status(400)
        .json({ error: 'invalid_request', error_description: 'redirect_uri does not match this client\'s registration' })
    }
    if (!codeChallenge) {
      return res.status(400).json({ error: 'invalid_request', error_description: 'missing code_challenge' })
    }

    pruneExpired(pendingFlows, FLOW_TTL_MS)
    if (pendingFlows.size >= MAX_PENDING) {
      return res.status(503).json({ error: 'temporarily_unavailable' })
    }

    const flowId = crypto.randomBytes(24).toString('base64url')
    pendingFlows.set(flowId, {
      codeChallenge,
      codeChallengeMethod: (codeChallengeMethod as 'plain' | 'S256') ?? 'S256',
      scopes: (scope ?? 'read').split(' ') as ('read' | 'write' | 'admin')[],
      redirectUri,
      state,
      createdAt: Date.now(),
    })

    const consentUrl = new URL('/mcp-authorize', frontendUrl)
    consentUrl.searchParams.set('flow', flowId)
    res.redirect(consentUrl.toString())
  })

  // Called by the frontend's /mcp-authorize consent screen once the user
  // has a real Supabase session and clicks "Authorize" — completes the
  // pending flow with their real identity and returns the URL the
  // frontend should redirect the browser to next (the MCP client's own
  // redirect_uri, carrying the authorization code).
  router.post('/authorize/:flowId/complete', async (req, res) => {
    const { flowId } = req.params
    const { access_token: accessToken } = req.body as Record<string, string>

    pruneExpired(pendingFlows, FLOW_TTL_MS)
    const pending = pendingFlows.get(flowId)
    if (!pending) {
      return res.status(400).json({ error: 'invalid_request', error_description: 'unknown or expired flow' })
    }

    if (!accessToken) {
      return res.status(400).json({ error: 'invalid_request', error_description: 'missing access_token' })
    }

    // Verifies the token against Supabase Auth itself (not just decoding
    // the JWT locally) — this is the actual authentication check the
    // placeholder this replaces never performed.
    const supabase = createClient(supabaseUrl!, supabaseAnonKey!)
    const { data, error } = await supabase.auth.getUser(accessToken)
    if (error || !data.user) {
      return res.status(401).json({ error: 'invalid_grant', error_description: 'invalid Supabase session' })
    }

    const claims = jwt.decode(accessToken) as { session_id?: string } | null
    if (!claims?.session_id) {
      return res.status(400).json({ error: 'invalid_grant', error_description: 'malformed session token' })
    }

    pendingFlows.delete(flowId)

    pruneExpired(pendingCodes, CODE_TTL_MS)
    if (pendingCodes.size >= MAX_PENDING) {
      return res.status(503).json({ error: 'temporarily_unavailable' })
    }

    const code = crypto.randomBytes(24).toString('base64url')
    pendingCodes.set(code, {
      ...pending,
      supabaseAccessToken: accessToken,
      userId: data.user.id,
      createdAt: Date.now(),
    })

    const location = new URL(pending.redirectUri)
    location.searchParams.set('code', code)
    if (pending.state) location.searchParams.set('state', pending.state)
    res.json({ redirect_uri: location.toString() })
  })

  router.post('/token', async (req, res) => {
    const { grant_type, code, code_verifier } = req.body as Record<string, string>

    if (grant_type !== 'authorization_code') {
      return res.status(400).json({ error: 'unsupported_grant_type' })
    }

    const pending = pendingCodes.get(code)
    if (!pending || Date.now() - pending.createdAt > CODE_TTL_MS || !pending.userId || !pending.supabaseAccessToken) {
      return res.status(400).json({ error: 'invalid_grant' })
    }
    pendingCodes.delete(code)

    if (!verifyPkce(code_verifier, pending.codeChallenge, pending.codeChallengeMethod)) {
      return res.status(400).json({ error: 'invalid_grant' })
    }

    // Marks the specific Supabase auth.sessions row backing
    // pending.supabaseAccessToken as MCP-originated, so the
    // custom_access_token_hook Postgres function (see the mcp_sessions
    // migration) stamps is_mcp_request: true only on tokens re-issued for
    // THIS session — which is what the mcp_project_grants RLS policies
    // actually check. Decoded (not re-verified) here: this token was
    // already verified against Supabase Auth in /authorize/:flowId/complete
    // above; this server only needs to read its session_id claim now.
    const supabaseClaims = jwt.decode(pending.supabaseAccessToken) as { session_id?: string } | null
    if (!supabaseClaims?.session_id) {
      return res.status(400).json({ error: 'invalid_grant' })
    }
    await markMcpSession(supabaseClaims.session_id, pending.userId)

    const accessToken = mintMcpToken({
      userId: pending.userId,
      scopes: pending.scopes,
      supabaseAccessToken: pending.supabaseAccessToken,
    })

    res.json({ access_token: accessToken, token_type: 'Bearer', expires_in: 3600 })
  })

  return router
}
