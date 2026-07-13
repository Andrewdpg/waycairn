import { describe, it, expect } from 'vitest'
import { requireScope } from './requireScope.js'
import type { McpTokenClaims } from './mcpToken.js'

const claims: McpTokenClaims = { userId: 'u1', scopes: ['read'], supabaseAccessToken: 't' }

describe('requireScope', () => {
  it('does not throw when the scope is present', () => {
    expect(() => requireScope(claims, 'read')).not.toThrow()
  })

  it('throws when the scope is missing', () => {
    expect(() => requireScope(claims, 'write')).toThrow(/missing required scope: write/)
  })
})
