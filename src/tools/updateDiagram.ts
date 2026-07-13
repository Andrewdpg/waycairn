import { supabaseForUser } from '../supabaseForUser.js'
import { requireScope } from '../requireScope.js'
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

  if (error || !data) {
    return { conflict: true }
  }
  return { version: data.version }
}
