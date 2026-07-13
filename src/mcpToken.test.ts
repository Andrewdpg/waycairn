import { describe, it, expect } from 'vitest'
import { mintMcpToken, verifyMcpToken } from './mcpToken'

describe('mcpToken', () => {
  it('round-trips claims through mint and verify', () => {
    const token = mintMcpToken({
      userId: 'user-123',
      scopes: ['read', 'write'],
      supabaseAccessToken: 'supabase-jwt-abc',
    })
    const claims = verifyMcpToken(token)
    expect(claims.userId).toBe('user-123')
    expect(claims.scopes).toEqual(['read', 'write'])
    expect(claims.supabaseAccessToken).toBe('supabase-jwt-abc')
  })

  it('throws on a tampered token', () => {
    const token = mintMcpToken({ userId: 'u', scopes: ['read'], supabaseAccessToken: 't' })
    const tampered = token.slice(0, -2) + 'xx'
    expect(() => verifyMcpToken(tampered)).toThrow()
  })
})
