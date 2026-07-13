# architecture-map MCP server

Remote MCP server (Streamable HTTP + OAuth 2.1/PKCE) that lets an
MCP-compatible AI agent (e.g. Claude Code) read and write a user's
architecture-map projects and diagrams, subject to the same per-project
access grants and read/write/admin scopes the user controls from
`/settings/integrations` in the web app.

## Local development

Requires the Supabase backend (`../supabase`, see the repo root README) running:

    supabase start   # from the repo root

Then:

    cp .env.example .env
    # fill in SUPABASE_URL / SUPABASE_ANON_KEY from `supabase start`'s output,
    # and a random MCP_JWT_SIGNING_SECRET
    npm install
    npm run dev

## Testing

    npm test

## Tools exposed

| Tool | Scope | Notes |
|---|---|---|
| `list_projects` | read | |
| `get_diagram` | read | |
| `create_project` | write | auto-grants MCP access to the created project |
| `create_diagram` | write | |
| `update_diagram` | write | optimistic-locking: pass the `version` from a prior `get_diagram` call; a mismatch returns `{ conflict: true }` |
| `validate_diagram` | none | dry-run shape validation, no DB write |
| `invite_collaborator` | admin | |

## Known limitations

- `/oauth/authorize`'s session check is a placeholder (see
  `docs/superpowers/plans/2026-07-12-mcp-server.md` Task 4's follow-up note)
  — wiring it to a real Supabase session via the web app's login flow is a
  deployment-integration step not yet implemented.
- `delete_project` and `remove_collaborator` are intentionally not exposed
  (see the design doc's "explicitly deferred" section).
