/**
 * One place that turns a failed write into a response.
 *
 * Round 18A Phase 2, 2026-08-21.
 *
 * WHY THIS EXISTS. A write refused by row-level security raises Postgres
 * `42501`, and every route but three sent that straight to the browser as a
 * 500 carrying the raw string:
 *
 *     new row violates row-level security policy for table "record_revisions"
 *
 * Round 17 Phase 1 recorded what that does to the person who hit it: they are
 * told the server broke, on a record they can open, read and type into, which
 * looks identical to one they own because `records_select` is team-wide while
 * the write policies are not. So they retry, and then they file a bug, when
 * the true answer is a sentence about who owns the record.
 *
 * FOLLOWS THE THREE EXISTING HANDLERS rather than inventing a fourth shape.
 * `test-beds.js` had two and `opportunities.js` one, all of them
 * `if (err.code === '42501') -> 403`, and all three sat immediately after a
 * call to `appendRecordRevision`. The mapping deliberately does NOT live inside
 * that writer: it covered those three sites and none of the other forty-nine,
 * which sit after plain `.insert`, `.update`, `.delete` and `.rpc` calls. The
 * shared thing is not the writer, it is the moment an error becomes a reply.
 *
 * The message names the asymmetry, because the asymmetry is the confusing
 * part. It does not name the owner: that would need a lookup at fifty call
 * sites and would disclose an account to anyone who guessed a record id.
 */
export const OWNERSHIP_REFUSAL =
  'This record belongs to another user. You can view it, but only its owner can change it.'

/** True for a write refused by row-level security, and nothing else. */
export function isRefusal(error) {
  return error?.code === '42501'
}

/**
 * For a route that replies directly. Replaces
 *   return reply.code(500).send({ error: err.message })
 * and preserves that behaviour for every error that is not a refusal.
 */
export function sendWriteError(reply, error) {
  return isRefusal(error)
    ? reply.code(403).send({ error: OWNERSHIP_REFUSAL })
    : reply.code(500).send({ error: error?.message ?? 'write failed' })
}

/**
 * For a helper that returns `{ status, error }` for its caller to send, which
 * is the shape appendPayloadSeriesEntry already used.
 */
export function writeErrorStatus(error) {
  return isRefusal(error)
    ? { status: 403, error: OWNERSHIP_REFUSAL }
    : { status: 500, error: error?.message ?? 'write failed' }
}

/**
 * The same refusal, for the OTHER shape row-level security takes.
 *
 * An INSERT refused by a WITH CHECK raises 42501. An UPDATE is not refused at
 * all: RLS filters the row out, so the statement succeeds and affects zero
 * rows, and nine routes already detected that and replied 403 "not permitted".
 * That is the same person hitting the same wall, so it says the same thing.
 */
export function sendRefusal(reply) {
  return reply.code(403).send({ error: OWNERSHIP_REFUSAL })
}
