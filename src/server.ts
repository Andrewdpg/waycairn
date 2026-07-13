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
import { NODE_KINDS } from './validateDiagramShape.js'

// Mirrors validateDiagramShape.ts's actual accepted node/edge shape. This
// schema is what an MCP client sees when it inspects the create_diagram/
// update_diagram tools (Claude Code included) — before this existed, the
// tool's inputSchema was content: z.object({ nodes: z.array(z.any()), edges:
// z.array(z.any()) }), i.e. "anything." An agent had no way to discover
// childDiagram (the mechanism for drill-down sub-diagrams), valid node
// kinds, or any other field short of trial-and-error against validation
// error messages — which is exactly what happened in practice.
// .strict() on both schemas below matters, not just cosmetic: Zod's
// default z.object() mode is "strip" — it silently DROPS any key not
// listed in the schema before the tool handler ever sees the payload.
// That silently neutralized validateDiagramShape.ts's own unknown-field
// rejection (added to close this exact gap) — an unrecognized field like
// "parent" never reached that check at all, because Zod had already
// stripped it here, upstream. .strict() makes Zod itself reject the
// request with the unknown key name, which is what actually surfaces the
// error back to the calling agent.
export const nodeSchema = z
  .object({
    id: z.string(),
    label: z.string(),
    kind: z
      .enum(['system', 'container', 'component', 'service', 'server', 'database', 'class', 'external', 'bridge'])
      .describe(`One of: ${NODE_KINDS.join(', ')}. Drives the rendered shape (a database is a cylinder, etc).`),
    childDiagram: z
      .string()
      .optional()
      .describe(
        'Slug of another diagram in this project to drill into when this node is clicked. This is how sub-diagrams work: create the child diagram separately (its own create_diagram call, own slug), then set childDiagram here to that slug to link it in as this node\'s detail view. Without this, a node has no drill-down and the child diagram (if it exists) is only reachable via the standalone diagram picker in the web UI, not by clicking this node.'
      ),
    responsibility: z.string().optional().describe('One sentence, always visible on the node face.'),
    techStack: z.array(z.string()).optional(),
    dataOwned: z.string().optional(),
    gotchas: z.array(z.string()).optional(),
    attributes: z.array(z.string()).optional().describe('For a "class" kind node in a uml-structural diagram.'),
    operations: z.array(z.string()).optional().describe('For a "class" kind node in a uml-structural diagram.'),
    sourceRefs: z.array(z.string()).optional().describe('Citations into real source code backing this node.'),
  })
  .strict()

const edgeSchema = z
  .object({
    from: z.string().describe('Must match a node id in the same diagram.'),
    to: z.string().describe('Must match a node id in the same diagram.'),
    label: z.string().optional(),
    relationship: z
      .enum(['association', 'composition', 'inheritance', 'dependency'])
      .optional()
      .describe('For uml-structural class diagrams.'),
    order: z.number().optional().describe('For uml-behavioral sequence diagrams.'),
    async: z.boolean().optional(),
    condition: z.string().optional(),
  })
  .strict()

const diagramContentSchema = z.object({ nodes: z.array(nodeSchema), edges: z.array(edgeSchema) })

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
      description:
        'Create a new diagram in a project. To build a drill-down hierarchy (a diagram whose nodes open other diagrams when clicked), create the child diagrams first, then set childDiagram on the parent node to the child\'s slug — see the content.nodes.childDiagram field description.',
      inputSchema: {
        projectId: z.string(),
        slug: z.string(),
        title: z.string(),
        notation: z.enum(['c4', 'uml-structural', 'uml-behavioral']),
        content: diagramContentSchema,
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
        content: diagramContentSchema,
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
  // OAuth 2.0's token endpoint (RFC 6749 §4.1.3) MUST use
  // application/x-www-form-urlencoded, not JSON — Claude Code (and OAuth
  // clients generally) POST /oauth/token that way. Without this, req.body
  // was undefined for that content type, throwing a raw unhandled
  // TypeError (visible to the client as a malformed HTML error page, not
  // a proper OAuth error response). /register and /authorize/:id/complete
  // are this server's own JSON endpoints and are unaffected — Express only
  // applies each body parser when its Content-Type matches.
  app.use(express.urlencoded({ extended: true }))

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

  // Last-resort error handler: without one, an uncaught throw (a
  // malformed request body Express couldn't parse, a bug in a route) falls
  // through to Express's default HTML error page. OAuth/MCP clients expect
  // JSON error responses on every endpoint here — an HTML body breaks
  // their error parsing outright (the exact "Unrecognized token '<'" this
  // was debugged from), not just looking unpolished.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    res.status(500).json({ error: 'server_error', error_description: err.message })
  })

  return app
}
