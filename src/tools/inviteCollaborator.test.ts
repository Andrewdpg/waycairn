import { describe, it, expect, vi } from 'vitest'

const rpc = vi.fn()
vi.mock('../supabaseForUser', () => ({
  supabaseForUser: vi.fn(() => ({ rpc })),
}))

import { inviteCollaboratorTool } from './inviteCollaborator.js'
import type { McpTokenClaims } from '../mcpToken.js'

describe('inviteCollaboratorTool', () => {
  it('calls the invite rpc when the token has admin scope', async () => {
    rpc.mockResolvedValue({ error: null })
    const claims: McpTokenClaims = { userId: 'u1', scopes: ['admin'], supabaseAccessToken: 'tok' }
    await inviteCollaboratorTool(claims, 'proj-1', 'friend@example.com', 'editor')
    expect(rpc).toHaveBeenCalledWith('invite_collaborator_by_email', {
      p_project_id: 'proj-1',
      p_email: 'friend@example.com',
      p_role: 'editor',
    })
  })

  it('rejects when the token lacks admin scope (write is not enough)', async () => {
    const claims: McpTokenClaims = { userId: 'u1', scopes: ['read', 'write'], supabaseAccessToken: 'tok' }
    await expect(
      inviteCollaboratorTool(claims, 'proj-1', 'friend@example.com', 'editor')
    ).rejects.toThrow(/missing required scope: admin/)
  })
})
