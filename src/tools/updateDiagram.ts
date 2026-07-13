import { supabaseForUser } from '../supabaseForUser.js'
import { requireScope } from '../requireScope.js'
import { throwSupabaseError } from '../supabaseError.js'
import type { McpTokenClaims } from '../mcpToken.js'
import { validateDiagramShape } from '../validateDiagramShape.js'
import type { DiagramNodeData, DiagramEdgeData } from '../validateDiagramShape.js'

export async function updateDiagramTool(
  claims: McpTokenClaims,
  projectId: string,
  slug: string,
  content: { nodes: DiagramNodeData[]; edges: DiagramEdgeData[] },
  expectedVersion: number
): Promise<{ version: number } | { conflict: true }> {
  requireScope(claims, 'write')
  // Enforced here, not left to the agent to call validate_diagram first —
  // same reasoning as createDiagramTool. title/notation aren't part of this
  // call's payload (only content changes on update) and don't need
  // re-validating, so a fixed placeholder stands in for them; only
  // content's nodes/edges shape and cross-references are actually checked.
  validateDiagramShape({ id: slug, title: slug, ...content }, slug)

  const supabase = supabaseForUser(claims.supabaseAccessToken)

  const { data, error } = await supabase
    .from('diagrams')
    .update({ content, version: expectedVersion + 1, updated_at: new Date().toISOString() })
    .eq('project_id', projectId)
    .eq('slug', slug)
    .eq('version', expectedVersion)
    .select('version')
    .single()

  // PGRST116 ("no rows returned") is what PostgREST reports both for a
  // genuinely stale version and for an RLS-blocked update — there's no
  // SQL-level way to tell them apart, and both are legitimately "you
  // couldn't write this row right now." Any OTHER error must not be
  // reported as a conflict: an agent seeing { conflict: true } is expected
  // to re-read and retry, which is the wrong response to a real failure
  // (network error, unexpected Supabase error) and would hide it entirely.
  if (error?.code === 'PGRST116') {
    return { conflict: true }
  }
  if (error) throwSupabaseError(error)
  return { version: data.version }
}
