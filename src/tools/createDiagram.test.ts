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

  it('surfaces the real Supabase error message for a duplicate slug, not "[object Object]"', async () => {
    // Regression guard for the exact bug reported in practice: inserting a
    // diagram with an already-used (project_id, slug) violates a unique
    // constraint (Postgres code 23505). Supabase-js returns that as a
    // plain object, not a real Error instance — throwing it directly (the
    // old `if (error) throw error`) made the MCP SDK's error handling
    // stringify it as the literal text "[object Object]", with the actual
    // "duplicate key value..." message lost.
    insert.mockResolvedValue({
      error: { code: '23505', message: 'duplicate key value violates unique constraint "diagrams_project_id_slug_key"' },
    })
    const claims: McpTokenClaims = { userId: 'u1', scopes: ['write'], supabaseAccessToken: 'tok' }
    await expect(
      createDiagramTool(claims, 'proj-1', 'dup-slug', 'D', 'c4', { nodes: [], edges: [] })
    ).rejects.toThrow(/duplicate key value/)
  })
})
