import { describe, it, expect, vi } from 'vitest'

const insert = vi.fn()
vi.mock('../supabaseForUser', () => ({
  supabaseForUser: vi.fn(() => ({ from: () => ({ insert }) })),
}))

import { createDiagramTool } from './createDiagram.js'
import type { McpTokenClaims } from '../mcpToken.js'

describe('createDiagramTool', () => {
  it('inserts a new diagram row', async () => {
    insert.mockResolvedValue({ error: null })
    const claims: McpTokenClaims = { userId: 'u1', scopes: ['write'], supabaseAccessToken: 'tok' }
    await createDiagramTool(claims, 'proj-1', 'deployment', 'Deployment', 'c4', { nodes: [], edges: [] })
    expect(insert).toHaveBeenCalledWith({
      project_id: 'proj-1',
      slug: 'deployment',
      title: 'Deployment',
      notation: 'c4',
      content: { nodes: [], edges: [] },
    })
  })

  it('rejects when the token lacks write scope', async () => {
    const claims: McpTokenClaims = { userId: 'u1', scopes: ['read'], supabaseAccessToken: 'tok' }
    await expect(
      createDiagramTool(claims, 'proj-1', 'd', 'D', 'c4', { nodes: [], edges: [] })
    ).rejects.toThrow(/missing required scope: write/)
  })

  it('rejects malformed content instead of writing it to the database', async () => {
    const claims: McpTokenClaims = { userId: 'u1', scopes: ['write'], supabaseAccessToken: 'tok' }
    const callsBefore = insert.mock.calls.length
    await expect(
      createDiagramTool(claims, 'proj-1', 'd', 'D', 'c4', {
        nodes: [{ id: 'a', label: 'A', kind: 'not-a-real-kind' } as any],
        edges: [],
      })
    ).rejects.toThrow(/invalid "kind"/)
    expect(insert.mock.calls.length).toBe(callsBefore)
  })
})
