import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockUpsert, mockFrom, mockCreateClient } = vi.hoisted(() => {
  const mockUpsert = vi.fn()
  const mockFrom = vi.fn(() => ({ upsert: mockUpsert }))
  const mockCreateClient = vi.fn((_url: string, _key: string) => ({ from: mockFrom }))
  return { mockUpsert, mockFrom, mockCreateClient }
})

vi.mock('@supabase/supabase-js', () => ({
  createClient: (url: string, key: string) => mockCreateClient(url, key),
}))

import { markMcpSession } from './mcpSessions.js'

beforeEach(() => {
  mockFrom.mockClear()
  mockUpsert.mockClear()
  // mockCreateClient is NOT cleared here: it's only ever called once, when
  // the top-level `import { markMcpSession }` above first evaluates
  // mcpSessions.ts's module-level `createClient(...)` call — clearing it
  // per-test would erase that one recorded call before the "constructs its
  // Supabase client..." test below gets to assert on it.
})

describe('markMcpSession', () => {
  it('upserts an mcp_sessions row for the given user with a future expiry', async () => {
    mockUpsert.mockResolvedValue({ error: null })

    await markMcpSession('user-123')

    expect(mockFrom).toHaveBeenCalledWith('mcp_sessions')
    expect(mockUpsert).toHaveBeenCalledTimes(1)
    const [row] = mockUpsert.mock.calls[0]
    expect(row.user_id).toBe('user-123')
    expect(new Date(row.expires_at).getTime()).toBeGreaterThan(Date.now())
  })

  it('throws when the upsert fails', async () => {
    mockUpsert.mockResolvedValue({ error: { message: 'boom' } })

    await expect(markMcpSession('user-123')).rejects.toThrow('boom')
  })

  it('constructs its Supabase client with the service_role key, never the anon key', () => {
    // createClient runs once at module load (singleton pattern), not per
    // call — assert against the call recorded when this test file's
    // top-level `import { markMcpSession }` first evaluated the module.
    expect(mockCreateClient).toHaveBeenCalledWith(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
    expect(mockCreateClient).not.toHaveBeenCalledWith(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    )
  })
})
