import jwt from 'jsonwebtoken'

export interface McpTokenClaims {
  userId: string
  scopes: ('read' | 'write' | 'admin')[]
  supabaseAccessToken: string
}

const secret = process.env.MCP_JWT_SIGNING_SECRET
if (!secret) {
  throw new Error('Missing MCP_JWT_SIGNING_SECRET environment variable')
}

export function mintMcpToken(claims: McpTokenClaims): string {
  return jwt.sign(claims, secret!, { expiresIn: '1h' })
}

export function verifyMcpToken(token: string): McpTokenClaims {
  return jwt.verify(token, secret!) as McpTokenClaims & { iat: number; exp: number }
}
