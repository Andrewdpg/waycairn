import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceRoleKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables')
}

// service_role is required here, same reasoning as mcpSessions.ts: these
// writes happen during OAuth Dynamic Client Registration and lookup,
// before any user-scoped RLS context exists (no user is authenticated yet
// when a client registers), and mcp_oauth_clients intentionally has no
// authenticated-role grant. This is a deliberate exception to "every
// Supabase call runs as the authenticated end user," same as mcp_sessions.
const supabase = createClient(url, serviceRoleKey)

export interface RegisteredClient {
  clientId: string
  redirectUris: string[]
}

export async function registerClient(redirectUris: string[]): Promise<RegisteredClient> {
  const clientId = crypto.randomUUID().replace(/-/g, '')
  const { error } = await supabase.from('mcp_oauth_clients').insert({
    client_id: clientId,
    redirect_uris: redirectUris,
  })
  if (error) throw new Error(error.message)
  return { clientId, redirectUris }
}

export async function getClient(clientId: string): Promise<RegisteredClient | null> {
  const { data, error } = await supabase
    .from('mcp_oauth_clients')
    .select('client_id, redirect_uris')
    .eq('client_id', clientId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return { clientId: data.client_id, redirectUris: data.redirect_uris }
}
