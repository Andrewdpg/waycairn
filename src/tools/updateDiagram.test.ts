import { describe, it, expect, vi } from 'vitest'

const single = vi.fn()
vi.mock('../supabaseForUser', () => ({
  supabaseForUser: vi.fn(() => ({
    from: () => ({
      update: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ select: () => ({ single }) }) }) }) }),
    }),
  })),
}))

import { updateDiagramTool } from './updateDiagram.js'
import type { McpTokenClaims } from '../mcpToken.js'

const claims: McpTokenClaims = { userId: 'u1', scopes: ['write'], supabaseAccessToken: 'tok' }

describe('updateDiagramTool', () => {
  it('returns the new version on a successful versioned update', async () => {
    single.mockResolvedValue({ data: { version: 5 }, error: null })
    const result = await updateDiagramTool(claims, 'proj-1', 'deployment', { nodes: [], edges: [] }, 4)
    expect(result).toEqual({ version: 5 })
  })

  it('returns a conflict when the expected version does not match', async () => {
    single.mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
    const result = await updateDiagramTool(claims, 'proj-1', 'deployment', { nodes: [], edges: [] }, 4)
    expect(result).toEqual({ conflict: true })
  })

  it('rejects when the token lacks write scope', async () => {
    const readOnly: McpTokenClaims = { userId: 'u1', scopes: ['read'], supabaseAccessToken: 'tok' }
    await expect(
      updateDiagramTool(readOnly, 'proj-1', 'deployment', { nodes: [], edges: [] }, 1)
    ).rejects.toThrow(/missing required scope: write/)
  })

  it('rejects malformed content instead of writing it to the database', async () => {
    const callsBefore = single.mock.calls.length
    await expect(
      updateDiagramTool(
        claims,
        'proj-1',
        'deployment',
        { nodes: [{ id: 'a', label: 'A', kind: 'service' }], edges: [{ from: 'a', to: 'ghost' } as any] },
        4
      )
    ).rejects.toThrow(/references unknown node "ghost"/)
    expect(single.mock.calls.length).toBe(callsBefore)
  })
})
