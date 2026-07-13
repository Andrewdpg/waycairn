import { supabaseForUser } from '../supabaseForUser.js'
import { requireScope } from '../requireScope.js'
import { throwSupabaseError } from '../supabaseError.js'
import type { McpTokenClaims } from '../mcpToken.js'

export async function getDiagramTool(
  claims: McpTokenClaims,
  projectId: string,
  slug: string
): Promise<{ diagram: { title: string; notation: string; nodes: unknown; edges: unknown }; version: number }> {
  requireScope(claims, 'read')
  const supabase = supabaseForUser(claims.supabaseAccessToken)
  const { data, error } = await supabase
    .from('diagrams')
    .select('title, notation, content, version')
    .eq('project_id', projectId)
    .eq('slug', slug)
    .single()
  if (error) throwSupabaseError(error)

  const content = data.content as { nodes: unknown; edges: unknown }
  return {
    diagram: { title: data.title, notation: data.notation, nodes: content.nodes, edges: content.edges },
    version: data.version,
  }
}
