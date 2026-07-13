import { describe, it, expect } from 'vitest'
import { supabaseForUser } from './supabaseForUser.js'

describe('supabaseForUser', () => {
  it('creates a client with the Authorization header set to the given token', () => {
    const client = supabaseForUser('a-user-jwt')
    // @ts-expect-error accessing internal rest client config for the test.
    // client.rest.headers is a Fetch Headers instance in the installed
    // @supabase/supabase-js version, not a plain object — use its real API
    // (.get, case-insensitive) rather than dot-accessing a property.
    const headers: Headers = client.rest.headers
    expect(headers.get('authorization')).toBe('Bearer a-user-jwt')
  })
})
