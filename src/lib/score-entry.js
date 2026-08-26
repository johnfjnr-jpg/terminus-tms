/**
 * Recording one score entry, for any record type.
 *
 * Round 25 Phase 3, 2026-08-23. Extracted from POST /test-beds/:id/scores,
 * which was 171 lines of which exactly five were Test Bed specific: two
 * `.eq('record_type', 'test_bed')` filters, two error messages, and the
 * record_type on the audit row. Everything else applies to any record type
 * that carries scoring criteria.
 *
 * The Opportunity route is the second caller and its branch has never run.
 * Rounds 21 and 22 found five separate cases of Test Bed-specific code that
 * silently did nothing for Opportunity, one of them live in production since
 * Round 9. Copying the route would have made a sixth; this makes the two the
 * same code with two arguments.
 *
 * WHY THIS RETURNS { status, body } RATHER THAN TAKING `reply`. A handler that
 * writes to the response cannot be tested without one, and cannot be called
 * from anywhere that is not a route. The caller sends it.
 *
 * MESSAGES ARE PASSED IN, NOT DERIVED. Test Bed's "test bed not found" and
 * "test bed has no revision" are behaviour a user can see, and this round's
 * binding constraint is that Test Bed does not change. Deriving them from the
 * record type would produce "test_bed not found", which is a different string.
 * They are arguments so that byte-identical is guaranteed by construction
 * rather than by careful formatting.
 *
 * appendPayloadSeriesEntry is DELIBERATELY NOT USED, and src/lib/units.js
 * records why at length: it does read-then-write in one call with no hook
 * between, and this path must refuse on the existing series before it appends.
 * Adopting it is a change to that helper rather than a call-site swap, and
 * making it inside a round about a different seam is how a shared helper
 * acquires a second purpose nobody asked for.
 */

import { appendRecordRevision } from './record-revision.js'
import { resolveLevels } from './scoring-levels.js'
import { writeErrorStatus } from './write-errors.js'

/**
 * The currency codes an answer may carry.
 *
 * The same ten the deal panel offers. Kept here rather than imported from the
 * frontend because the server cannot import it, and duplicated deliberately
 * with this note: frontend/app.js CURRENCY_CODES is the other copy, and the
 * two must agree. The alternative was a table, which is a migration for a list
 * that has not changed since the prototype.
 */
export const CURRENCY_CODES = ['USD', 'GBP', 'EUR', 'AED', 'SAR', 'SGD', 'AUD', 'CAD', 'JPY', 'INR']

/**
 * @param {object}   o
 * @param {object}   o.db          a user-scoped Supabase client
 * @param {string}   o.recordType  'test_bed' | 'opportunity'
 * @param {string}   o.recordId
 * @param {object}   o.body        { criterion, score, comment, reason }
 * @param {object}   o.user        { id, email }
 * @param {object}   o.messages    { notFound, noRevision }
 * @param {function} [o.logError]  called as (err, msg) for the two logged failures
 * @returns {Promise<{status:number, body:object}>}
 */
export async function recordScoreEntry({ db, recordType, recordId, body, user, messages, logError }) {
  const { criterion, score, comment, reason, answer } = body ?? {}
  const log = logError ?? (() => {})

  // The criterion must be real, and real FOR THIS RECORD TYPE. scoring_criteria
  // is unique on (record_type, criterion_key), so the pair is the identity: an
  // Opportunity cannot be scored against a Test Bed criterion that happens to
  // share a key, which is exactly what a single-column lookup would allow.
  const { data: crit, error: critErr } = await db
    .from('scoring_criteria')
    .select('id, criterion_key, name, scale_id')
    .eq('record_type', recordType)
    .eq('criterion_key', criterion ?? '')
    .maybeSingle()
  if (critErr) {
    log(critErr, 'failed to look up scoring criterion')
    return { status: 500, body: { error: critErr.message } }
  }
  if (!crit) return { status: 400, body: { error: 'criterion is not a recognised scoring criterion' } }

  const { levels, error: levelErr } = await resolveLevels(db, crit.scale_id)
  if (levelErr) return { status: 500, body: { error: levelErr.message } }
  if (!levels.length) {
    return { status: 409, body: { error: `no levels are defined for ${crit.name}, so a score cannot be recorded` } }
  }

  const allowed = levels.map(l => l.value)
  if (!Number.isInteger(score) || !allowed.includes(score)) {
    // The legacy 1-to-5 keeps its original wording; only a criterion with a
    // real scale gets the enumerated form. Round A Phase 2's reasoning.
    return {
      status: 400,
      body: {
        error: crit.scale_id
          ? `score must be one of ${[...allowed].sort((a, b) => a - b).join(', ')}`
          : 'score must be a whole number from 1 to 5',
      },
    }
  }

  const { data: record, error: recErr } = await db
    .from('records')
    .select('id, status')
    .eq('id', recordId)
    .eq('record_type', recordType)
    .is('deleted_at', null)
    .maybeSingle()
  if (recErr) return { status: 500, body: { error: recErr.message } }
  if (!record) return { status: 404, body: { error: messages.notFound } }

  const { data: revRow, error: revReadErr } = await db
    .from('record_revisions')
    .select('revision_number, payload')
    .eq('record_id', record.id)
    .order('revision_number', { ascending: false })
    .limit(1)
    .maybeSingle()
  // Round 7 step 3.0's lesson: an unchecked error would read as "no existing
  // series", which would make a revision look like a first score and skip the
  // mandatory reason.
  if (revReadErr) return { status: 500, body: { error: revReadErr.message } }
  if (!revRow) return { status: 404, body: { error: messages.noRevision } }

  const payload = revRow.payload ?? {}
  const existing = Array.isArray(payload[crit.criterion_key]) ? payload[crit.criterion_key] : []

  // The LEVEL says whether a reason is required, Round A Phase 3.
  const chosen = levels.find(l => l.value === score)
  if (chosen?.reason_required && !String(reason ?? '').trim()) {
    return {
      status: 400,
      body: {
        // Round 33 Phase 2: "naming what is missing" was correct for every
        // caller it had and false for the one that arrived.
        //
        // Until this round exactly one scaled level required a reason,
        // Unknown, and a gap is what a reason explains there. The confirmation
        // scale now requires one at Not confirmed AND at Confirmed, where the
        // reason names the licence reference or the DPA clause, so the clause
        // told a scorer confirming a requirement to name what was missing.
        //
        // Architecture rule 8 arriving through DATA rather than through code:
        // no line of this file changed to make the string wrong, a
        // scoring_scale_levels row did.
        //
        // "saying why" is true at every level on both scales and keeps the
        // nudge. The null-scale branch is unchanged and still says "what is
        // missing", because it is Test Bed's and its rule really is a score of
        // 1 or 2.
        error: crit.scale_id
          ? `a reason is required at ${chosen.label}, saying why`
          : 'a reason is required at a score of 1 or 2, naming what is missing',
      },
    }
  }

  // Mandatory on any entry after the first. About the SERIES, not the level.
  if (existing.length > 0 && !String(reason ?? '').trim()) {
    return { status: 400, body: { error: 'a reason for the change is required when revising a score' } }
  }

  // Resolved here, never accepted from the client: a client could otherwise
  // stamp a score with a version whose wording it was never made against,
  // which is the one thing anchor versioning exists to prevent.
  const { data: latestAnchor, error: anchorErr } = await db
    .from('scoring_anchors')
    .select('version')
    .eq('criterion_id', crit.id)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (anchorErr) return { status: 500, body: { error: anchorErr.message } }
  if (!latestAnchor) {
    return { status: 409, body: { error: `no anchors are defined for ${crit.name}, so a score cannot be recorded against a definition` } }
  }

  const entry = {
    at: new Date().toISOString(),
    by: user.email,
    value: score,
    anchorVersion: latestAnchor.version,
    stage: record.status,
  }
  if (String(comment ?? '').trim()) entry.comment = String(comment).trim()
  if (String(reason ?? '').trim()) entry.reason = String(reason).trim()

  // Round 26 Phase 3: the ANSWER a criterion carries beside its score.
  //
  // ITS OWN FIELD, not `comment`. `comment` exists on this shape, is stored,
  // and is sent by nothing on the Opportunity side, which makes it tempting.
  // That is not a reason: it is a free-text note, and putting a figure in it
  // would make one field mean two things depending on which criterion it
  // belongs to. The same argument settled approvals.comment in Round 25.
  //
  // ============================================================================
  // READ THIS BEFORE ADDING A SECOND CRITERION THAT CARRIES AN ANSWER.
  // ============================================================================
  //
  // NOTHING DECLARES WHICH CRITERIA HAVE ONE. The business chose Budget
  // confirmed alone to learn whether a value belongs beside a score before
  // committing to a per-criterion type vocabulary, and accepted the cost that
  // follows: this endpoint will store an `answer` against ANY criterion, and a
  // writer that sends it to the wrong one is not corrected. The shape below is
  // checked; the question of which criteria may carry it is not, because
  // nothing yet knows.
  //
  // The round that decides types is where that gets fixed. Until then the
  // frontend names its one criterion in OPP_VALUE_CAPTURE_KEY, and that
  // constant plus this comment are the whole of the constraint.
  if (answer !== undefined && answer !== null) {
    const amount = Number(answer.amount)
    const currency = String(answer.currency ?? '').trim()
    if (!Number.isFinite(amount) || amount < 0) {
      return { status: 400, body: { error: 'answer.amount must be a number that is not negative' } }
    }
    if (!CURRENCY_CODES.includes(currency)) {
      return { status: 400, body: { error: `answer.currency must be one of ${CURRENCY_CODES.join(', ')}` } }
    }
    entry.answer = { amount, currency }
  }

  const { error: revErr } = await appendRecordRevision(
    db, record.id, { [crit.criterion_key]: [...existing, entry] }, user.id)
  if (revErr) {
    log(revErr, 'failed to save score revision')
    const mapped = writeErrorStatus(revErr)
    return { status: mapped.status, body: { error: mapped.error } }
  }

  await db.from('audit_log').insert({
    record_id: record.id,
    record_type: recordType,
    action: existing.length ? 'score_revised' : 'score_recorded',
    actor_id: user.id,
    detail: { criterion: crit.criterion_key, value: score, anchorVersion: entry.anchorVersion, stage: entry.stage },
  })

  return {
    status: 201,
    body: { criterion: crit.criterion_key, entry, entries: existing.length + 1 },
  }
}
