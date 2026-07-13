import { describe, it, expect, vi } from 'vitest'

vi.mock('../supabaseForUser', () => ({
  supabaseForUser: vi.fn(() => ({
    from: () => ({ select: () => Promise.resolve({ data: [{ id: 'p1', name: 'Repo' }], error: null }) }),
  })),
}))

import { listProjectsTool } from './listProjects.js'
import type { McpTokenClaims } from '../mcpToken.js'

describe('listProjectsTool', () => {
  it('returns projects visible to the calling user', async () => {
    const claims: McpTokenClaims = { userId: 'u1', scopes: ['read'], supabaseAccessToken: 'tok' }
    const result = await listProjectsTool(claims)
    expect(result).toEqual([{ id: 'p1', name: 'Repo' }])
  })

  it('rejects when the token lacks read scope', async () => {
    const claims: McpTokenClaims = { userId: 'u1', scopes: [], supabaseAccessToken: 'tok' }
    await expect(listProjectsTool(claims)).rejects.toThrow(/missing required scope: read/)
  })
})
