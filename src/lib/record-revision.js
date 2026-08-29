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
/**
 * THE PRECONDITION IS REQUIRED. Round 38, after conditions 5a and 6a.
 *
 * p_expected_revision was optional, which meant unprotected by default: one
 * writer sent it and ten did not, and any writer that omits it can still
 * blindly overwrite a record that moved. An invariant that cannot be violated
 * beats one that has to be remembered - which is the same argument that
 * deleted the version reason box's guard rather than adding a third event to
 * it.
 *
 * So every call site must now state, in the call, which of three things it is.
 * Omitting the argument throws rather than defaulting to unprotected.
 */

/**
 * SINGLE_KEY_RMW: this write reads a value, recomputes it in JavaScript, and
 * writes the whole new value back, one payload key wide.
 *
 * IT WAS CALLED APPEND_ONLY AND THAT WAS A CLAIM I DID NOT CHECK. Round 38.
 * Every one of the six sites so labelled reads a prior array or counter from an
 * EARLIER, SEPARATE read, builds the new value in JavaScript, and writes it:
 *
 *   score-entry.js          [...existing, entry]   existing from a prior read
 *   assessment-reviewed     [...existing, entry]   existing from a prior read
 *   test-bed score series   [...existing, entry]   existing from a prior read
 *   contact link-account    [note, ...notes]       notes from a prior read
 *   close-date-move         closeMoves + 1, and a note prepend
 *
 * None of them is an append in the database's sense. The advisory-locked merge
 * protects OTHER keys; it does not protect the key being written, because the
 * value being written was computed before the lock was taken. TWO CONCURRENT
 * WRITES TO THE SAME KEY STILL LOSE ONE - which record-revision.js has said
 * since Round 17A and which the APPEND_ONLY name quietly contradicted.
 *
 * THE REAL FIX IS AN ATOMIC APPEND inside append_record_revision: a patch that
 * says "add this element to this array key" rather than "set this key to this
 * array", evaluated under the lock against the current value. That removes the
 * read-modify-write instead of guarding it, and it is the right shape for all
 * five array sites. Not built here; named so it is a design with an owner
 * rather than a comment.
 *
 * Using this symbol means: a lost update on THIS ONE KEY is understood and
 * accepted for now, and failing the write because an unrelated key moved would
 * be the worse outcome.
 */
export const SINGLE_KEY_RMW = Symbol('single-key read-modify-write: same-key lost update accepted')

export const CLIENT_UNWIRED = Symbol('whole-form write: client not yet sending a revision')

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} db - a
 *   request-scoped user client. RLS applies: the function is security
 *   INVOKER precisely so record_revisions_insert stays in force.
 * @param {string} recordId
 * @param {object} patch - the keys being changed, nothing else
 * @param {string} createdBy - request.user.id
 * @param {string[]} remove - payload keys to DELETE
 * @param {number|symbol} precondition - the revision this write expects the
 *   record to be at, or SINGLE_KEY_RMW, or CLIENT_UNWIRED. REQUIRED.
 * @returns {Promise<{ data?: { revision_number: number, payload: object }, error?: object }>}
 */
export async function appendRecordRevision(db, recordId, patch, createdBy, remove, precondition) {
  if (precondition === undefined) {
    // Thrown, not returned as an error: a caller that forgot this has a bug in
    // the caller, and returning {error} would let it be logged and swallowed
    // exactly like a database failure.
    throw new Error(
      'appendRecordRevision: a precondition is required. Pass the expected revision number, ' +
      'or SINGLE_KEY_RMW for a single-key read-modify-write, or CLIENT_UNWIRED for a screen not yet sending one.')
  }
  const expected =
    (precondition === SINGLE_KEY_RMW || precondition === CLIENT_UNWIRED) ? null : precondition

  if (expected !== null && !Number.isInteger(expected)) {
    throw new Error(`appendRecordRevision: precondition must be a whole number, SINGLE_KEY_RMW or CLIENT_UNWIRED, got ${String(precondition)}`)
  }

  const { data, error } = await db.rpc('append_record_revision', {
    p_record_id: recordId,
    p_patch: patch ?? {},
    p_created_by: createdBy,
    p_remove: remove ?? [],
    p_expected_revision: expected,
  })
  if (error) return { error }
  return { data }
}

/**
 * The precondition as it arrives from a client, read and validated once.
 *
 * Round 38. Written because three routes were about to grow a fourth and fifth
 * copy of the same eight lines, and the two copies that already existed had
 * already drifted apart in shape: opportunities.js validates then branches on
 * undefined-or-null at the call, test-beds.js branches on Number.isInteger at
 * the call and never validates at all, so a client sending
 * expected_revision: "7" got a silent blind write from one route and a 400
 * from the other. One computation path per concern.
 *
 * ABSENT IS STILL CLIENT_UNWIRED RATHER THAN A REFUSAL, and that is the
 * remaining debt rather than the design. Making it required is a refusal, and
 * a refusal is a write-path decision: every caller that does not send one
 * starts failing the moment it lands. The callers are enumerated and wired in
 * this same change, and `wired` is returned so a route can tell the two apart
 * without re-deriving it.
 *
 * @param {object} body - request.body
 * @returns {{ precondition?: number|symbol, wired?: boolean, error?: string }}
 */
export function readExpectedRevision(body) {
  const raw = body?.expected_revision
  if (raw === undefined || raw === null) return { precondition: CLIENT_UNWIRED, wired: false }
  if (!Number.isInteger(raw)) return { error: 'expected_revision must be a whole number' }
  return { precondition: raw, wired: true }
}

/**
 * Did this write fail because the record moved under the screen?
 *
 * PT409 is the SQLSTATE append_record_revision raises for a failed
 * compare-and-swap. It must never reach sendWriteError, which answers 500: a
 * stale write is a conflict the person resolves by reloading, not a server
 * fault, and a 500 tells them to give up rather than to refresh.
 */
export function isStaleWrite(error) {
  return error?.code === 'PT409'
}
