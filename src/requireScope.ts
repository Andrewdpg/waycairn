import type { McpTokenClaims } from './mcpToken.js'

export function requireScope(claims: McpTokenClaims, scope: 'read' | 'write' | 'admin'): void {
  if (!claims.scopes.includes(scope)) {
    throw new Error(`missing required scope: ${scope}`)
  }
}
