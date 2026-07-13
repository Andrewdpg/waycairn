import { describe, it, expect, vi, beforeEach } from 'vitest'

const projectInsertSingle = vi.fn()
const grantInsert = vi.fn()
const diagramInsert = vi.fn()
const projectDeleteEq = vi.fn()
vi.mock('../supabaseForUser', () => ({
  supabaseForUser: vi.fn(() => ({
    from: (table: string) => {
      if (table === 'projects') {
        return {
          insert: () => ({ select: () => ({ single: projectInsertSingle }) }),
          delete: () => ({ eq: projectDeleteEq }),
        }
      }
      if (table === 'mcp_project_grants') {
        return { insert: grantInsert }
      }
      if (table === 'diagrams') {
        return { insert: diagramInsert }
      }
      throw new Error(`unexpected table ${table}`)
    },
  })),
}))

import { createProjectTool } from './createProject.js'
import type { McpTokenClaims } from '../mcpToken.js'

beforeEach(() => {
  projectDeleteEq.mockReset()
  projectDeleteEq.mockResolvedValue({ error: null })
})

describe('createProjectTool', () => {
  it('creates the project, auto-grants mcp access, and seeds an empty deployment diagram', async () => {
    projectInsertSingle.mockResolvedValue({ data: { id: 'new-p', name: 'New' }, error: null })
    grantInsert.mockResolvedValue({ error: null })
    diagramInsert.mockResolvedValue({ error: null })
    const claims: McpTokenClaims = { userId: 'u1', scopes: ['write'], supabaseAccessToken: 'tok' }

    const result = await createProjectTool(claims, 'New')

    expect(result).toEqual({ id: 'new-p', name: 'New' })
    expect(grantInsert).toHaveBeenCalledWith({ project_id: 'new-p', user_id: 'u1' })
    expect(diagramInsert).toHaveBeenCalledWith({
      project_id: 'new-p',
      slug: 'deployment',
      title: 'Deployment',
      notation: 'c4',
      content: { nodes: [], edges: [] },
    })
    expect(projectDeleteEq).not.toHaveBeenCalled()
  })

  it('rejects when the token lacks write scope', async () => {
    const claims: McpTokenClaims = { userId: 'u1', scopes: ['read'], supabaseAccessToken: 'tok' }
    await expect(createProjectTool(claims, 'New')).rejects.toThrow(/missing required scope: write/)
  })

  it('rolls back the created project if the mcp grant insert fails', async () => {
    projectInsertSingle.mockResolvedValue({ data: { id: 'new-p', name: 'New' }, error: null })
    grantInsert.mockResolvedValue({ error: { message: 'grant insert failed' } })
    const claims: McpTokenClaims = { userId: 'u1', scopes: ['write'], supabaseAccessToken: 'tok' }

    await expect(createProjectTool(claims, 'New')).rejects.toThrow('grant insert failed')
    expect(projectDeleteEq).toHaveBeenCalledWith('id', 'new-p')
  })

  it('rolls back the created project if seeding the deployment diagram fails', async () => {
    projectInsertSingle.mockResolvedValue({ data: { id: 'new-p', name: 'New' }, error: null })
    grantInsert.mockResolvedValue({ error: null })
    diagramInsert.mockResolvedValue({ error: { message: 'diagram insert failed' } })
    const claims: McpTokenClaims = { userId: 'u1', scopes: ['write'], supabaseAccessToken: 'tok' }

    await expect(createProjectTool(claims, 'New')).rejects.toThrow('diagram insert failed')
    expect(projectDeleteEq).toHaveBeenCalledWith('id', 'new-p')
  })
})
