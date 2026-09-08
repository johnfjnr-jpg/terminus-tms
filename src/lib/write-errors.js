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
 * A UNIQUE CONSTRAINT, SAID IN WORDS. Round 41, sixth walk V1/V2/V4.
 *
 * The walk pressed Issue and got
 *
 *   duplicate key value violates unique constraint
 *   deal_sheet_versions_record_id_major_minor_key
 *
 * on screen. 23505 was mapped nowhere in this file, so every duplicate-key
 * collision in the application surfaces its constraint name to whoever hit it.
 *
 * MAPPED BY CONSTRAINT NAME, not by a generic "that already exists". A unique
 * index encodes a business rule, and the rule is what the person needs: the
 * version one means a version with that number has already been issued, which
 * tells them to reload rather than to try again.
 *
 * THE FALLBACK IS DELIBERATELY VAGUE AND SAYS SO. An unrecognised constraint
 * gets a sentence that admits it does not know which value collided, because
 * inventing a specific one would be worse than admitting the gap - and the gap
 * is the named raw-error sweep, not something to paper over here.
 *
 * 409, because a duplicate key IS a conflict: the state moved under the caller
 * and reloading is the remedy.
 */
const UNIQUE_MESSAGES = {
  deal_sheet_versions_record_id_major_minor_key:
    'A version with that number has already been issued. Reload the record to see the current versions.',
};

export const DUPLICATE_STATUS = 409;

/** True for a write refused by a unique index, and nothing else. */
export function isDuplicate(error) {
  return error?.code === '23505';
}

/** The sentence for a duplicate, by constraint name where one is known. */
export function duplicateMessage(error) {
  const raw = `${error?.message ?? ''} ${error?.details ?? ''}`;
  for (const [constraint, message] of Object.entries(UNIQUE_MESSAGES)) {
    if (raw.includes(constraint)) return message;
  }
  return 'That would duplicate a value this record already has. Reload and try again.';
}

/**
 * A WRITE REFUSED BY THE FREEZE. Round 41.
 *
 * PT423 is raised by refuse_write_while_frozen() on every table that carries a
 * record's state, for every role, whenever a transition request is open on it.
 *
 * MAPPED HERE RATHER THAN IN EACH ROUTE, and the reason is the measurement that
 * found it missing: the plan said "every frozen endpoint catches PT423 and
 * returns 423" and NOT ONE OF THEM DID, so the first real freeze produced a 500
 * with the trigger's careful sentence buried in it. Sixteen endpoints can hit
 * this. Sixteen chances to forget is not a design.
 *
 * 423 rather than 409: a conflict says "reload and try again", a freeze says
 * "this is waiting for somebody else", and the two need different words on the
 * screen.
 */
export function isFrozen(error) {
  return error?.code === 'PT423'
}

export const FROZEN_STATUS = 423

/**
 * A WRITE REFUSED BY A DATA-DRIVEN LIMIT. Round 42, the convert atomicity round.
 *
 * PT422 is raised by convert_test_bed() when the Test Bed has already been
 * converted as many times as conversion_criteria.condition allows. The limit is
 * a database row, not a constant, so the refusal is a business rule being
 * enforced rather than anything the caller can fix by reloading.
 *
 * MAPPED HERE RATHER THAN IN THE ROUTE, and the reason is PT423's, one rule
 * later: the note above says sixteen chances to forget is not a design, and the
 * count for this one is smaller only because the feature is newer.
 *
 * 422 rather than 409, and rather than 423. The route already answered 422 for
 * this case before the check moved into the function, with this exact sentence,
 * so the status is preserved rather than chosen. And the three are genuinely
 * different things to say: a conflict says "reload and try again", a freeze
 * says "this is waiting for somebody else", and a limit says "this is not
 * allowed, and reloading will not change that".
 *
 * NOT PT409, deliberately. PT409 means the record moved under you. A conversion
 * limit is not a staleness conflict and the two need different words on screen.
 */
export function isLimit(error) {
  return error?.code === 'PT422'
}

export const LIMIT_STATUS = 422

/**
 * THE SOURCE IS GONE. Raised by convert_test_bed and
 * create_opportunity_from_contact when the record named no longer resolves.
 *
 * Both routes read the source record and answer 404 before calling their
 * function, so this fires only on the race between that read and the call. It
 * is mapped here rather than inline in each route for the same reason as the
 * two above: two routes today, and a third that forgets is the failure mode.
 */
export function isMissing(error) {
  return error?.code === 'PT404'
}

export const MISSING_STATUS = 404

/**
 * For a route that replies directly. Replaces
 *   return reply.code(500).send({ error: err.message })
 * and preserves that behaviour for every error that is not a refusal.
 */
export function sendWriteError(reply, error) {
  if (isFrozen(error)) return reply.code(FROZEN_STATUS).send({ error: error.message, frozen: true })
  if (isLimit(error)) return reply.code(LIMIT_STATUS).send({ error: error.message })
  if (isMissing(error)) return reply.code(MISSING_STATUS).send({ error: error.message })
  // BOTH MAPPERS, ALWAYS. These two functions answer the same question for two
  // caller shapes, and the round that added PT423 to one and not the other is
  // the reason that is written down here: a mapper that knows a code and a twin
  // that does not is worse than neither, because the route that happens to use
  // the second one looks covered.
  if (isDuplicate(error)) return reply.code(DUPLICATE_STATUS).send({ error: duplicateMessage(error) })
  return isRefusal(error)
    ? reply.code(403).send({ error: OWNERSHIP_REFUSAL })
    : reply.code(500).send({ error: error?.message ?? 'write failed' })
}

/**
 * For a helper that returns `{ status, error }` for its caller to send, which
 * is the shape appendPayloadSeriesEntry already used.
 */
export function writeErrorStatus(error) {
  if (isFrozen(error)) return { status: FROZEN_STATUS, error: error.message, frozen: true }
  if (isLimit(error)) return { status: LIMIT_STATUS, error: error.message }
  if (isMissing(error)) return { status: MISSING_STATUS, error: error.message }
  if (isDuplicate(error)) return { status: DUPLICATE_STATUS, error: duplicateMessage(error) }
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
