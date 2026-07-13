import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import { createOAuthRouter } from './oauth.js'

vi.mock('./mcpToken', () => ({
  mintMcpToken: vi.fn(() => 'minted-mcp-token'),
}))

describe('POST /oauth/token', () => {
  let app: express.Express

  beforeEach(() => {
    app = express()
    app.use(express.json())
    app.use('/oauth', createOAuthRouter())
  })

  it('rejects a token exchange for an unknown/expired authorization code', async () => {
    const res = await request(app)
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

  it('exchanges a valid code + matching PKCE verifier for an mcp access token', async () => {
    const authRes = await request(app).get('/oauth/authorize').query({
      response_type: 'code',
      client_id: 'claude-code',
      redirect_uri: 'https://claude.ai/callback',
      code_challenge: 'YmFzZTY0dXJsLWNoYWxsZW5nZQ', // base64url("base64url-challenge")-shaped placeholder
      code_challenge_method: 'plain',
      scope: 'read write',
      state: 'xyz',
    })
    // /authorize redirects with ?code=... in a real browser flow; the test
    // extracts the code from the Location header the same way a client would.
    const location = new URL(authRes.headers.location!)
    const code = location.searchParams.get('code')!

    const res = await request(app).post('/oauth/token').send({
      grant_type: 'authorization_code',
      code,
      code_verifier: 'YmFzZTY0dXJsLWNoYWxsZW5nZQ',
      client_id: 'claude-code',
    })
    expect(res.status).toBe(200)
    expect(res.body.access_token).toBe('minted-mcp-token')
  })
})
