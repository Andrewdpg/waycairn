import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { listArtifactsTool } from './tools/listArtifacts.js'
import { getArtifactTool } from './tools/getArtifact.js'
import { upsertArtifactTool } from './tools/upsertArtifact.js'
import { validateArtifactTool } from './tools/validateArtifact.js'

export function createLocalMcpServer(waycairnDir: string): McpServer {
  const server = new McpServer({ name: 'waycairn', version: '0.1.0' })

  server.registerTool(
    'list_artifacts',
    {
      description:
        'List every artifact of a given kind stored locally in this repo\'s .waycairn directory (e.g. kind="diagram"). Call this before creating or editing anything — it is the only way to discover what already exists, since get_artifact requires knowing the id up front.',
      inputSchema: { kind: z.string().describe('Artifact kind, e.g. "diagram".') },
    },
    async ({ kind }) => ({ content: [{ type: 'text', text: JSON.stringify(listArtifactsTool(waycairnDir, kind)) }] })
  )

  server.registerTool(
    'get_artifact',
    {
      description:
        'Fetch a single artifact by kind and id. If you do not already know the id, call list_artifacts first.',
      inputSchema: { kind: z.string(), id: z.string() },
    },
    async ({ kind, id }) => {
      const record = getArtifactTool(waycairnDir, kind, id)
      return { content: [{ type: 'text', text: record ? JSON.stringify(record) : 'not found' }] }
    }
  )

  server.registerTool(
    'upsert_artifact',
    {
      description:
        'Create or replace an artifact. This is the ONLY way to write documentation — never edit files under .waycairn/ directly. Validates `data` against the schema for `kind` before writing anything; call validate_artifact first if you want to check without writing.',
      inputSchema: {
        kind: z.string().describe('Artifact kind, e.g. "diagram".'),
        id: z.string(),
        data: z.unknown().describe('Shape depends on kind — for kind="diagram": { notation?, nodes, edges }.'),
      },
    },
    async ({ kind, id, data }) => ({
      content: [{ type: 'text', text: JSON.stringify(upsertArtifactTool(waycairnDir, kind, id, data)) }],
    })
  )

  server.registerTool(
    'validate_artifact',
    {
      description: 'Dry-run validate `data` against the schema for `kind`, without writing anything.',
      inputSchema: { kind: z.string(), data: z.unknown() },
    },
    async ({ kind, data }) => ({
      content: [{ type: 'text', text: JSON.stringify(validateArtifactTool(kind, data)) }],
    })
  )

  return server
}
