// src/localServer.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { join } from 'node:path'
import { listArtifactsTool } from './tools/listArtifacts.js'
import { getArtifactTool } from './tools/getArtifact.js'
import { upsertArtifactTool } from './tools/upsertArtifact.js'
import { validateArtifactTool } from './tools/validateArtifact.js'

const repoPathField = z
  .string()
  .describe(
    'Path to the repo, relative to the session\'s working directory. Use "." (the default) for the common case of a single repo open as the session root. Use a subdirectory name (e.g. "auth-service") when the session root is a parent folder containing several sibling repos — call list_repos first to see the valid values.'
  )

function resolveWaycairnDir(cwd: string, repoPath: string): string {
  if (repoPath.includes('..')) {
    throw new Error(`Unsafe repoPath ${JSON.stringify(repoPath)}: must not contain ".."`)
  }
  return join(cwd, repoPath, '.waycairn')
}

export function createLocalMcpServer(cwd: string): McpServer {
  const server = new McpServer({ name: 'waycairn', version: '0.1.0' })

  server.registerTool(
    'list_artifacts',
    {
      description:
        'List every artifact of a given kind stored locally in a repo\'s .waycairn directory (e.g. kind="diagram"). Call this before creating or editing anything — it is the only way to discover what already exists, since get_artifact requires knowing the id up front.',
      inputSchema: z
        .object({
          kind: z.string().describe('Artifact kind, e.g. "diagram".'),
          repoPath: repoPathField.default('.'),
        })
        .strict(),
    },
    async ({ kind, repoPath }) => ({
      content: [{ type: 'text', text: JSON.stringify(listArtifactsTool(resolveWaycairnDir(cwd, repoPath), kind)) }],
    })
  )

  server.registerTool(
    'get_artifact',
    {
      description:
        'Fetch a single artifact by kind and id. If you do not already know the id, call list_artifacts first.',
      inputSchema: z
        .object({
          kind: z.string(),
          id: z.string(),
          repoPath: repoPathField.default('.'),
        })
        .strict(),
    },
    async ({ kind, id, repoPath }) => {
      const record = getArtifactTool(resolveWaycairnDir(cwd, repoPath), kind, id)
      return { content: [{ type: 'text', text: record ? JSON.stringify(record) : 'not found' }] }
    }
  )

  server.registerTool(
    'upsert_artifact',
    {
      description:
        'Create or replace an artifact. This is the ONLY way to write documentation — never edit files under .waycairn/ directly. Validates `data` against the schema for `kind` before writing anything; call validate_artifact first if you want to check without writing.',
      inputSchema: z
        .object({
          kind: z.string().describe('Artifact kind, e.g. "diagram".'),
          id: z.string(),
          data: z.unknown().describe('Shape depends on kind — for kind="diagram": { notation?, nodes, edges }.'),
          repoPath: repoPathField.default('.'),
        })
        .strict(),
    },
    async ({ kind, id, data, repoPath }) => ({
      content: [{ type: 'text', text: JSON.stringify(upsertArtifactTool(resolveWaycairnDir(cwd, repoPath), kind, id, data)) }],
    })
  )

  server.registerTool(
    'validate_artifact',
    {
      description: 'Dry-run validate `data` against the schema for `kind`, without writing anything.',
      inputSchema: z
        .object({
          kind: z.string(),
          data: z.unknown(),
        })
        .strict(),
    },
    async ({ kind, data }) => ({
      content: [{ type: 'text', text: JSON.stringify(validateArtifactTool(kind, data)) }],
    })
  )

  return server
}
