import { describe, it, expect } from 'vitest'
import { throwSupabaseError } from './supabaseError.js'

describe('throwSupabaseError', () => {
  it('throws a real Error instance with the message and code, from a plain (non-Error) object', () => {
    // Regression guard: Supabase/PostgREST does not always return a real
    // PostgrestError instance for every error case — a unique constraint
    // violation (code 23505), confirmed empirically, comes back as a plain
    // object where `x instanceof Error` is false. The MCP SDK's tool error
    // handling does `error instanceof Error ? error.message : String(error)`,
    // so throwing that plain object directly produced the literal string
    // "[object Object]" with the real message lost entirely.
    const plainObjectError = {
      code: '23505',
      message: 'duplicate key value violates unique constraint "diagrams_project_id_slug_key"',
    }

    let caught: unknown
    try {
      throwSupabaseError(plainObjectError)
    } catch (err) {
      caught = err
    }

    expect(caught).toBeInstanceOf(Error)
    expect((caught as Error).message).toContain('duplicate key value violates unique constraint')
    expect((caught as Error).message).toContain('23505')
  })

  it('falls back to a generic message when the error has none', () => {
    let caught: unknown
    try {
      throwSupabaseError({})
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(Error)
    expect((caught as Error).message).toBe('Unknown Supabase error')
  })
})
