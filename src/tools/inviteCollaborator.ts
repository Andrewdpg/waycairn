import { supabaseForUser } from '../supabaseForUser.js'
import { requireScope } from '../requireScope.js'
import type { McpTokenClaims } from '../mcpToken.js'

export async function inviteCollaboratorTool(
  claims: McpTokenClaims,
  projectId: string,
  email: string,
  role: 'viewer' | 'editor'
): Promise<void> {
  requireScope(claims, 'admin')
  const supabase = supabaseForUser(claims.supabaseAccessToken)
  const { error } = await supabase.rpc('invite_collaborator_by_email', {
    p_project_id: projectId,
    p_email: email,
    p_role: role,
  })
  if (error) throw new Error(error.message)
}
