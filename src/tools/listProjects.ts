import { supabaseForUser } from '../supabaseForUser.js'
import { requireScope } from '../requireScope.js'
import { throwSupabaseError } from '../supabaseError.js'
import type { McpTokenClaims } from '../mcpToken.js'

export async function listProjectsTool(
  claims: McpTokenClaims
): Promise<{ id: string; name: string }[]> {
  requireScope(claims, 'read')
  const supabase = supabaseForUser(claims.supabaseAccessToken)
  const { data, error } = await supabase.from('projects').select('id, name')
  if (error) throwSupabaseError(error)
  return data ?? []
}
