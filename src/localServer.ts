// src/localServer.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { listArtifactsTool } from './tools/listArtifacts.js'
import { getArtifactTool } from './tools/getArtifact.js'
import { upsertArtifactTool } from './tools/upsertArtifact.js'
import { validateArtifactTool } from './tools/validateArtifact.js'
import { listRepos } from './tools/listRepos.js'
import { readRegistry } from './registry.js'

const repoPathField = z
  .string()
  .describe(
    'Path to the repo, relative to the session\'s working directory. Use "." (the default) for the common case of a single repo open as the session root. Use a subdirectory name (e.g. "auth-service") when the session root is a parent folder containing several sibling repos — call list_repos first to see the valid values.'
  )

const repoIdField = z
  .string()
  .describe(
    'Alternative to repoPath: a repoId from list_repos\' "registered" field, for a repo registered on this machine (via `waycairn init`) but not physically under the session\'s working directory. Mutually exclusive with repoPath.'
  )

export class AmbiguousRepoSelectorError extends Error {
  constructor() {
    super('Provide either repoPath or repoId, not both.')
    this.name = 'AmbiguousRepoSelectorError'
  }
}

export class RepoNotRegisteredError extends Error {
  constructor(repoId: string) {
    super(
      `repoId ${JSON.stringify(repoId)} is not in this machine's registry (~/.waycairn/registry.json). Call list_repos to see registered repos.`
    )
    this.name = 'RepoNotRegisteredError'
  }
}

function resolveWaycairnDir(cwd: string, repoPath: string): string {
  if (repoPath.includes('..')) {
    throw new Error(`Unsafe repoPath ${JSON.stringify(repoPath)}: must not contain ".."`)
  }
  return join(cwd, repoPath, '.waycairn')
}

function resolveRepoDir(
  cwd: string,
  registryPath: string,
  selector: { repoPath?: string; repoId?: string }
): string {
  if (selector.repoPath !== undefined && selector.repoId !== undefined) {
    throw new AmbiguousRepoSelectorError()
  }
  if (selector.repoId !== undefined) {
    const registry = readRegistry(registryPath)
    const entry = registry[selector.repoId]
    if (!entry) throw new RepoNotRegisteredError(selector.repoId)
    return join(entry.path, '.waycairn')
  }
  return resolveWaycairnDir(cwd, selector.repoPath ?? '.')
}

export function createLocalMcpServer(
  cwd: string,
  registryPath: string = join(homedir(), '.waycairn', 'registry.json')
): McpServer {
  const server = new McpServer({ name: 'waycairn', version: '0.1.0' })

  server.registerTool(
    'list_artifacts',
    {
      description:
        'List every artifact of a given kind stored locally in a repo\'s .waycairn directory (e.g. kind="diagram"). Call this before creating or editing anything — it is the only way to discover what already exists, since get_artifact requires knowing the id up front.',
      inputSchema: z
        .object({
          kind: z.string().describe('Artifact kind, e.g. "diagram".'),
          repoPath: repoPathField.optional(),
          repoId: repoIdField.optional(),
        })
        .strict(),
    },
    async ({ kind, repoPath, repoId }) => ({
      content: [
        { type: 'text', text: JSON.stringify(listArtifactsTool(resolveRepoDir(cwd, registryPath, { repoPath, repoId }), kind)) },
      ],
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
          repoPath: repoPathField.optional(),
          repoId: repoIdField.optional(),
        })
        .strict(),
    },
    async ({ kind, id, repoPath, repoId }) => {
      const record = getArtifactTool(resolveRepoDir(cwd, registryPath, { repoPath, repoId }), kind, id)
      return { content: [{ type: 'text', text: record ? JSON.stringify(record) : 'not found' }] }
    }
  )

  server.registerTool(
    'upsert_artifact',
    {
      description:
        'Create or replace an artifact. This is the ONLY way to write documentation — never edit files under .waycairn/ directly. Validates `data` against the schema for `kind` before writing anything; call validate_artifact first if you want to check without writing. Scoped to repoPath only — cannot write into a different registered repo.',
      inputSchema: z
        .object({
          kind: z.string().describe('Artifact kind, e.g. "diagram".'),
          id: z.string(),
          data: z
            .record(z.string(), z.unknown())
            .describe('Shape depends on kind — for kind="diagram": { notation?, nodes, edges }.'),
          repoPath: repoPathField.default('.'),
        })
        .strict(),
    },
    async ({ kind, id, data, repoPath }) => ({
      content: [
        { type: 'text', text: JSON.stringify(upsertArtifactTool(resolveWaycairnDir(cwd, repoPath), kind, id, data, registryPath)) },
      ],
    })
  )

  server.registerTool(
    'validate_artifact',
    {
      description: 'Dry-run validate `data` against the schema for `kind`, without writing anything.',
      inputSchema: z
        .object({
          kind: z.string(),
          data: z.record(z.string(), z.unknown()),
        })
        .strict(),
    },
    async ({ kind, data }) => ({
      content: [{ type: 'text', text: JSON.stringify(validateArtifactTool(kind, data)) }],
    })
  )

  server.registerTool(
    'list_repos',
    {
      description:
        'List repos this MCP server can reach: "local" repoPath values under the session\'s working directory (as before), and "registered" repos from this machine\'s global registry (populated by `waycairn init`), keyed by repoId — usable with get_artifact/list_artifacts\' repoId parameter to reach a repo outside the current session.',
      inputSchema: z.object({}).strict(),
    },
    async () => ({
      content: [{ type: 'text', text: JSON.stringify({ local: listRepos(cwd), registered: readRegistry(registryPath) }) }],
    })
  )

  return server
}
