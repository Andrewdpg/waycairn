import { supabaseForUser } from '../supabaseForUser.js'
import { requireScope } from '../requireScope.js'
import { throwSupabaseError } from '../supabaseError.js'
import type { McpTokenClaims } from '../mcpToken.js'

export async function createProjectTool(
  claims: McpTokenClaims,
  name: string
): Promise<{ id: string; name: string }> {
  requireScope(claims, 'write')
  const supabase = supabaseForUser(claims.supabaseAccessToken)

  const { data, error } = await supabase
    .from('projects')
    .insert({ name, owner_id: claims.userId })
    .select('id, name')
    .single()
  if (error) throwSupabaseError(error)

  // No multi-table transaction available over PostgREST — if either step
  // below fails, roll back the just-created project rather than leaving an
  // orphan the owner can see in list_projects but that has no
  // mcp_project_grants row (so the MCP itself can never reach it again) or
  // no 'deployment' diagram (so the web UI 404s the instant it's opened).
  try {
    const { error: grantError } = await supabase
      .from('mcp_project_grants')
      .insert({ project_id: data.id, user_id: claims.userId })
    if (grantError) throwSupabaseError(grantError)

    // resolveDiagramPath (frontend) always resolves a project's root as its
    // 'deployment' slug — without seeding one, a project created via MCP has
    // no diagram to open in the web UI.
    const { error: diagramError } = await supabase.from('diagrams').insert({
      project_id: data.id,
      slug: 'deployment',
      title: 'Deployment',
      notation: 'c4',
      content: { nodes: [], edges: [] },
    })
    if (diagramError) throwSupabaseError(diagramError)
  } catch (err) {
    await supabase.from('projects').delete().eq('id', data.id)
    throw err
  }

  return data
}
