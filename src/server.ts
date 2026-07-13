import express, { type Request, type Response, type NextFunction } from 'express'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { z } from 'zod'
import { createOAuthRouter } from './oauth.js'
import { verifyMcpToken, type McpTokenClaims } from './mcpToken.js'
import { listProjectsTool } from './tools/listProjects.js'
import { getDiagramTool } from './tools/getDiagram.js'
import { createProjectTool } from './tools/createProject.js'
import { createDiagramTool } from './tools/createDiagram.js'
import { updateDiagramTool } from './tools/updateDiagram.js'
import { validateDiagramTool } from './tools/validateDiagram.js'
import { inviteCollaboratorTool } from './tools/inviteCollaborator.js'

declare global {
  namespace Express {
    interface Request {
      mcpClaims?: McpTokenClaims
    }
  }
}

function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'missing bearer token' })
  }
  try {
    req.mcpClaims = verifyMcpToken(header.slice('Bearer '.length))
    next()
  } catch {
    res.status(401).json({ error: 'invalid or expired token' })
  }
}

function buildMcpServer(claims: McpTokenClaims): McpServer {
  const server = new McpServer({ name: 'architecture-map', version: '0.1.0' })

  server.registerTool(
    'list_projects',
    { description: 'List projects accessible to the authenticated user' },
    async () => ({ content: [{ type: 'text', text: JSON.stringify(await listProjectsTool(claims)) }] })
  )

  server.registerTool(
    'get_diagram',
    {
      description: 'Fetch a diagram by project id and slug',
      inputSchema: { projectId: z.string(), slug: z.string() },
    },
    async ({ projectId, slug }) => ({
      content: [{ type: 'text', text: JSON.stringify(await getDiagramTool(claims, projectId, slug)) }],
    })
  )

  server.registerTool(
    'create_project',
    { description: 'Create a new project', inputSchema: { name: z.string() } },
    async ({ name }) => ({
      content: [{ type: 'text', text: JSON.stringify(await createProjectTool(claims, name)) }],
    })
  )

  server.registerTool(
    'create_diagram',
    {
      description: 'Create a new diagram in a project',
      inputSchema: {
        projectId: z.string(),
        slug: z.string(),
        title: z.string(),
        notation: z.enum(['c4', 'uml-structural', 'uml-behavioral']),
        content: z.object({ nodes: z.array(z.any()), edges: z.array(z.any()) }),
      },
    },
    async ({ projectId, slug, title, notation, content }) => {
      await createDiagramTool(claims, projectId, slug, title, notation, content)
      return { content: [{ type: 'text', text: 'ok' }] }
    }
  )

  server.registerTool(
    'update_diagram',
    {
      description: 'Update a diagram, guarded by optimistic locking',
      inputSchema: {
        projectId: z.string(),
        slug: z.string(),
        content: z.object({ nodes: z.array(z.any()), edges: z.array(z.any()) }),
        expectedVersion: z.number(),
      },
    },
    async ({ projectId, slug, content, expectedVersion }) => ({
      content: [
        {
          type: 'text',
          text: JSON.stringify(await updateDiagramTool(claims, projectId, slug, content, expectedVersion)),
        },
      ],
    })
  )

  server.registerTool(
    'validate_diagram',
    { description: 'Validate a diagram payload before writing it', inputSchema: { content: z.any() } },
    async ({ content }) => ({ content: [{ type: 'text', text: JSON.stringify(validateDiagramTool(content)) }] })
  )

  server.registerTool(
    'invite_collaborator',
    {
      description: 'Invite a collaborator to a project by email (requires admin scope)',
      inputSchema: { projectId: z.string(), email: z.string(), role: z.enum(['viewer', 'editor']) },
    },
    async ({ projectId, email, role }) => {
      await inviteCollaboratorTool(claims, projectId, email, role)
      return { content: [{ type: 'text', text: 'ok' }] }
    }
  )

  return server
}

export function createApp(): express.Express {
  const app = express()
  app.use(express.json())

  // OAuth 2.0 Authorization Server Metadata (RFC 8414). MCP clients fetch
  // this before /authorize to discover the actual endpoint paths rather
  // than assuming the spec's defaults — required for Claude Code and other
  // MCP clients to find /oauth/register, /oauth/authorize, /oauth/token
  // (this server nests them under /oauth/, not at the root paths the MCP
  // spec's fallback table assumes).
  app.get('/.well-known/oauth-authorization-server', (_req, res) => {
    const base = `${_req.protocol}://${_req.get('host')}`
    res.json({
      issuer: base,
      authorization_endpoint: `${base}/oauth/authorize`,
      token_endpoint: `${base}/oauth/token`,
      registration_endpoint: `${base}/oauth/register`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code'],
      code_challenge_methods_supported: ['S256', 'plain'],
      token_endpoint_auth_methods_supported: ['none'],
    })
  })

  app.use('/oauth', createOAuthRouter())

  app.post('/mcp', authenticate, async (req: Request, res: Response) => {
    const server = buildMcpServer(req.mcpClaims!)
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
    await server.connect(transport)
    await transport.handleRequest(req, res, req.body)
  })

  return app
}
