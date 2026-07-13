import { supabaseForUser } from '../supabaseForUser.js'
import { requireScope } from '../requireScope.js'
import type { McpTokenClaims } from '../mcpToken.js'
import { validateDiagramShape } from '../validateDiagramShape.js'
import type { DiagramNodeData, DiagramEdgeData, Notation } from '../validateDiagramShape.js'

export async function createDiagramTool(
  claims: McpTokenClaims,
  projectId: string,
  slug: string,
  title: string,
  notation: Notation,
  content: { nodes: DiagramNodeData[]; edges: DiagramEdgeData[] }
): Promise<void> {
  requireScope(claims, 'write')
  // Enforced here, not left to the agent to call validate_diagram first:
  // the standalone tool is advisory only, and getDiagram/the web app's
  // "Edit JSON" tab both throw InvalidDiagramError on read for a malformed
  // shape — an unvalidated write would silently corrupt the diagram until
  // the next read blows up.
  validateDiagramShape({ id: slug, title, notation, ...content }, slug)

  const supabase = supabaseForUser(claims.supabaseAccessToken)
  const { error } = await supabase
    .from('diagrams')
    .insert({ project_id: projectId, slug, title, notation, content })
  if (error) throw error
}
