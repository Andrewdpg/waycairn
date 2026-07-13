import { Router } from 'express'
import crypto from 'node:crypto'
import { mintMcpToken } from './mcpToken.js'

interface PendingAuthorization {
  codeChallenge: string
  codeChallengeMethod: 'plain' | 'S256'
  scopes: ('read' | 'write' | 'admin')[]
  supabaseAccessToken: string
  userId: string
  redirectUri: string
  createdAt: number
}

// In-memory store — a single-instance dev/first-deploy assumption.
// ponytail: swap for a shared store (Redis, or a Supabase table) if/when
// this service runs as more than one instance behind a load balancer.
const pendingCodes = new Map<string, PendingAuthorization>()
const CODE_TTL_MS = 5 * 60 * 1000

function verifyPkce(verifier: string, challenge: string, method: 'plain' | 'S256'): boolean {
  if (method === 'plain') return verifier === challenge
  const hashed = crypto.createHash('sha256').update(verifier).digest('base64url')
  return hashed === challenge
}

export function createOAuthRouter(): Router {
  const router = Router()

  // NOTE: this handler assumes the caller already has a valid Supabase
  // session (see Task 4's design note) — the query params below stand in
  // for what a real request carries once wired to the frontend's login
  // flow in a later task; this synthesizes a placeholder session for now
  // so the authorization-code + PKCE mechanics can be tested independently
  // of the login UI.
  router.get('/authorize', (req, res) => {
    const { redirect_uri, code_challenge, code_challenge_method, scope, state } = req.query as Record<
      string,
      string
    >

    const code = crypto.randomBytes(24).toString('base64url')
    pendingCodes.set(code, {
      codeChallenge: code_challenge,
      codeChallengeMethod: (code_challenge_method as 'plain' | 'S256') ?? 'S256',
      scopes: (scope ?? 'read').split(' ') as ('read' | 'write' | 'admin')[],
      supabaseAccessToken: 'placeholder-supabase-session-token',
      userId: 'placeholder-user-id',
      redirectUri: redirect_uri,
      createdAt: Date.now(),
    })

    const location = new URL(redirect_uri)
    location.searchParams.set('code', code)
    if (state) location.searchParams.set('state', state)
    res.redirect(location.toString())
  })

  router.post('/token', (req, res) => {
    const { grant_type, code, code_verifier } = req.body as Record<string, string>

    if (grant_type !== 'authorization_code') {
      return res.status(400).json({ error: 'unsupported_grant_type' })
    }

    const pending = pendingCodes.get(code)
    if (!pending || Date.now() - pending.createdAt > CODE_TTL_MS) {
      return res.status(400).json({ error: 'invalid_grant' })
    }
    pendingCodes.delete(code)

    if (!verifyPkce(code_verifier, pending.codeChallenge, pending.codeChallengeMethod)) {
      return res.status(400).json({ error: 'invalid_grant' })
    }

    const accessToken = mintMcpToken({
      userId: pending.userId,
      scopes: pending.scopes,
      supabaseAccessToken: pending.supabaseAccessToken,
    })

    res.json({ access_token: accessToken, token_type: 'Bearer', expires_in: 3600 })
  })

  return router
}
