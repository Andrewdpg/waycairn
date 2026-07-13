// Some Supabase/PostgREST errors (confirmed empirically: a unique
// constraint violation, code 23505) come back as a plain object, not a
// real PostgrestError/Error instance — `error instanceof Error` is false
// for them, even though PostgrestError.ts itself extends Error. The MCP
// SDK's tool-call error handling does
// `error instanceof Error ? error.message : String(error)`, so a plain
// object throw becomes the literal string "[object Object]" with the
// actual message lost — exactly what surfaced when create_diagram was
// called with an already-used slug. Always throw a real Error so the
// message survives.
export function throwSupabaseError(error: { message?: string; code?: string }): never {
  const message = error.message ?? 'Unknown Supabase error'
  throw new Error(error.code ? `${message} (code: ${error.code})` : message)
}
