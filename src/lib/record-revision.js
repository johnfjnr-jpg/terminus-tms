/**
 * The one JS entry point for appending a record revision.
 *
 * Round 17A Phase 1, 2026-08-21. Deliberately shaped like
 * src/lib/reference-number.js: a thin wrapper around a Postgres function,
 * not a second implementation of the logic. The atomicity guarantee lives
 * in append_record_revision() (migration 20260821000000), and a guarantee
 * that lives in more than one place is not a guarantee.
 *
 * WHY THIS EXISTS AT ALL. Nine call sites each read the highest
 * revision_number, added one in JS, and inserted. Two writers to one record
 * both read N, both computed N+1, and the unique constraint refused the
 * loser with a raw 23505 surfaced as a 500. Round 17A Phase 0 measured two
 * concurrent writes colliding in 10 of 10 trials.
 *
 * THE PATCH IS A PATCH, NOT A PAYLOAD. Pass only the keys being changed.
 * The function merges them into the current payload inside the same
 * statement that computes the number, so the read supplying the number and
 * the read supplying the payload are the same read. Passing a whole payload
 * assembled from an earlier read would reintroduce exactly the lost update
 * this function exists to remove: the merge would be against data that had
 * already moved.
 *
 * The merge is jsonb `||`, a shallow top-level merge, which is what every
 * call site's `{ ...revRow.payload, ...payload }` did before this. Per-key
 * semantics are unchanged. Two writers touching the SAME key still resolve
 * last-writer-wins, which is a separate concern from this one and is
 * Phase 2's.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} db - a
 *   request-scoped user client. RLS applies: the function is security
 *   INVOKER precisely so record_revisions_insert stays in force.
 * @param {string} recordId
 * @param {object} patch - the keys being changed, nothing else
 * @param {string} createdBy - request.user.id
 * @param {string[]} [remove] - payload keys to DELETE. A jsonb merge cannot
 *   express a deletion, and PATCH /test-beds/:id genuinely deletes exit
 *   criterion keys sent as null rather than storing null, so removal has to
 *   be part of the same statement or that route's behaviour would change.
 * @returns {Promise<{ data?: { revision_number: number, payload: object }, error?: object }>}
 *   The Supabase error object is returned rather than thrown so every call
 *   site keeps checking `error` exactly as it does today, per Verification 8.
 */
export async function appendRecordRevision(db, recordId, patch, createdBy, remove = []) {
  const { data, error } = await db.rpc('append_record_revision', {
    p_record_id: recordId,
    p_patch: patch ?? {},
    p_created_by: createdBy,
    p_remove: remove ?? [],
  })
  if (error) return { error }
  return { data }
}
