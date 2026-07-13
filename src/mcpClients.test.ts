import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockInsert, mockMaybeSingle, mockEq, mockSelect, mockFrom, mockCreateClient } = vi.hoisted(() => {
  const mockInsert = vi.fn()
  const mockMaybeSingle = vi.fn()
  const mockEq = vi.fn(() => ({ maybeSingle: mockMaybeSingle }))
  const mockSelect = vi.fn(() => ({ eq: mockEq }))
  const mockFrom = vi.fn(() => ({ insert: mockInsert, select: mockSelect }))
  const mockCreateClient = vi.fn((_url: string, _key: string) => ({ from: mockFrom }))
  return { mockInsert, mockMaybeSingle, mockEq, mockSelect, mockFrom, mockCreateClient }
})

vi.mock('@supabase/supabase-js', () => ({
  createClient: (url: string, key: string) => mockCreateClient(url, key),
}))

import { registerClient, getClient } from './mcpClients.js'

beforeEach(() => {
  mockFrom.mockClear()
  mockInsert.mockClear()
  mockSelect.mockClear()
  mockEq.mockClear()
  mockMaybeSingle.mockClear()
  // mockCreateClient is intentionally NOT cleared — see mcpSessions.test.ts
  // for why (it's only called once, at module import time).
})

describe('registerClient', () => {
  it('inserts a new row with a fresh client_id and the given redirect_uris', async () => {
    mockInsert.mockResolvedValue({ error: null })

    const result = await registerClient(['https://claude.ai/callback'])

    expect(mockFrom).toHaveBeenCalledWith('mcp_oauth_clients')
    expect(mockInsert).toHaveBeenCalledTimes(1)
    const [row] = mockInsert.mock.calls[0]
    expect(row.client_id).toBe(result.clientId)
    expect(row.redirect_uris).toEqual(['https://claude.ai/callback'])
    expect(result.redirectUris).toEqual(['https://claude.ai/callback'])
  })

  it('throws when the insert fails', async () => {
    mockInsert.mockResolvedValue({ error: { message: 'boom' } })
    await expect(registerClient(['https://claude.ai/callback'])).rejects.toThrow('boom')
  })
})

describe('getClient', () => {
  it('returns the registered client for a known client_id', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { client_id: 'abc123', redirect_uris: ['https://claude.ai/callback'] },
      error: null,
    })

    const result = await getClient('abc123')

    expect(mockFrom).toHaveBeenCalledWith('mcp_oauth_clients')
    expect(mockEq).toHaveBeenCalledWith('client_id', 'abc123')
    expect(result).toEqual({ clientId: 'abc123', redirectUris: ['https://claude.ai/callback'] })
  })

  it('returns null for an unknown client_id', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })
    const result = await getClient('never-registered')
    expect(result).toBeNull()
  })

  it('throws when the lookup fails', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: { message: 'boom' } })
    await expect(getClient('abc123')).rejects.toThrow('boom')
  })
})

describe('module setup', () => {
  it('constructs its Supabase client with the service_role key, never the anon key', () => {
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
