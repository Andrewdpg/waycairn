import { describe, it, expect, vi } from 'vitest'

const single = vi.fn()
vi.mock('../supabaseForUser', () => ({
  supabaseForUser: vi.fn(() => ({
    from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ single }) }) }) }),
  })),
}))

import { getDiagramTool } from './getDiagram.js'
import type { McpTokenClaims } from '../mcpToken.js'

describe('getDiagramTool', () => {
  it('returns the diagram content and version', async () => {
    single.mockResolvedValue({
      data: { title: 'Deployment', notation: 'c4', content: { nodes: [], edges: [] }, version: 2 },
      error: null,
    })
    const claims: McpTokenClaims = { userId: 'u1', scopes: ['read'], supabaseAccessToken: 'tok' }
    const result = await getDiagramTool(claims, 'proj-1', 'deployment')
    expect(result.version).toBe(2)
    expect(result.diagram).toMatchObject({ title: 'Deployment', notation: 'c4' })
  })

  it('rejects when the token lacks read scope', async () => {
    const claims: McpTokenClaims = { userId: 'u1', scopes: [], supabaseAccessToken: 'tok' }
    await expect(getDiagramTool(claims, 'proj-1', 'deployment')).rejects.toThrow(
      /missing required scope: read/
    )
  })
})
