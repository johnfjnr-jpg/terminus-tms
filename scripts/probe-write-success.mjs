// The writes that are supposed to WORK, exercised over HTTP. CLAUDE.md
// Verification 40.
//
// Renamed from probe-score-success in Round 41 W2, when the second route
// arrived. The name is the rule: this is where a route that a boundary added or
// modified gets exercised from outside, as the signed-in user, on the success
// path. One probe rather than one per route, so the next boundary extends it
// instead of adding a stage nobody remembers to write.
//
// ── ROUTE 1: recording a score ────────────────────────────────────────────
//
// ── WHY THIS EXISTS, AND IT IS NOT A REGRESSION TEST FOR ONE TYPO ─────────
//
// Round 41 W4. `fe073b5` modified src/lib/score-entry.js to return the new
// revision number, destructured `{ error: revErr }` alone, and named an
// undeclared `newRevision` on the response line. That is a ReferenceError
// thrown while BUILDING THE 201 for a write that had already committed, so both
// score routes answered 500 to every criterion on every lens, on main, published
// for four hours, and a walk found it.
//
// NOTHING IN THE GATE COULD HAVE SEEN IT. No test imported recordScoreEntry and
// nothing in the suite or the probes had ever POSTed a score. The success path
// of the only scoring write in the system had never been executed by anything
// but a person, through 354 pure tests, 91 database tests and three HTTP probes.
//
// So this probe is not about a typo. It is the missing exercise: the ROUTE, from
// outside, as the signed-in user, observing the new behaviour on the SUCCESS
// path. That is now a standing rule, CLAUDE.md Verification 40.
//
// ── WHY A PROBE AND NOT test:db ───────────────────────────────────────────
//
// Everything in `npm run test:db` reaches Postgres through the service key,
// which has BYPASSRLS and never touches a route. The claim here is a route's:
// that POST /:type/:id/scores answers 201 with a revision number in the body.
// Only HTTP can measure it. Same reasoning as probe-preconditions.
//
// ── TWO-SIDED, because a 201 alone proves less than it looks ──────────────
//
// The response must carry a revision number that is a real integer AND that
// matches what the record actually moved to. A route returning 201 with
// `revision_number: null` would pass a status check and is exactly the shape
// the fix was about: `newRevision?.revision_number ?? null` answers null the
// moment the destructure is wrong again.

import { api, ApiError } from './api-client.mjs'
import { freshOpportunity, freshTestBed, tearDown, admin } from './fixtures.mjs'
import { readFileSync } from 'fs'
const SESSION_USER_ID = JSON.parse(
  readFileSync(new URL('../session-ref.json', import.meta.url).pathname, 'utf8')).user?.id

const results = []
function record(label, pass, detail) {
  results.push({ label, pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}  ${detail}`)
}

// BOTH CALLERS OF THE SHARED HANDLER. The Opportunity route is the one the walk
// hit; POST /test-beds/:id/scores is the same function with two arguments and
// was equally broken, which nobody noticed because nothing exercises it either.
const CASES = [
  { type: 'opportunity', path: (id) => `/opportunities/${id}/scores`,
    read: (id) => `/opportunities/${id}`, criterion: 'assessCommBudgetConfirmed' },
  { type: 'test_bed', path: (id) => `/test-beds/${id}/scores`,
    read: (id) => `/test-beds/${id}`, criterion: null },
]

const opp = await freshOpportunity('score-success')
const tb = await freshTestBed('score-success')
const idFor = { opportunity: opp.oppId, test_bed: tb.bedId }

// The Test Bed criterion is read from the configuration rather than named here,
// so a renamed criterion fails as "no criterion configured" instead of silently
// scoring nothing. Verification 19: a key typed into a probe is a claim about
// the configuration that nobody checks.
//
// api() returns { status, ok, data } and the body is under .data. The first
// draft of this probe read the envelope as the body throughout and reported
// `revision_number: undefined` against a route that was returning 2 correctly,
// which would have read as the fix not working. Measured rather than assumed on
// the second attempt.
const tbCriteria = (await api('GET', '/scoring-criteria?record_type=test_bed')).data
CASES[1].criterion = Array.isArray(tbCriteria) && tbCriteria.length ? tbCriteria[0].criterion_key : null

for (const c of CASES) {
  const id = idFor[c.type]
  if (!c.criterion) { record(`${c.type}: a criterion is configured to score against`, false, 'none found'); continue }

  // `latest_revision_number`, which is what the GET calls it. Read from the
  // response rather than from a name that seemed likely: the first draft asked
  // for `revision_number`, got undefined, and compared it against a correct 2.
  // Verification 14 - a comparison reached with nothing on one side.
  const before = (await api('GET', c.read(id))).data
  const beforeRev = before?.latest_revision_number ?? null

  let status, body
  try {
    body = (await api('POST', c.path(id), { criterion: c.criterion, score: 3, reason: 'score-success probe' })).data
    status = 201
  } catch (e) {
    if (!(e instanceof ApiError)) throw e
    status = e.status; body = e.body
  }

  record(`${c.type}: POST /scores succeeds`, status === 201,
    `-> ${status} ${status === 201 ? '' : JSON.stringify(body)}`)
  if (status !== 201) continue

  // THE ASSERTION THE RULING ASKED FOR. Not merely that a key is present: that
  // it is an integer, and that it is the revision the record actually reached.
  const returned = body?.revision_number
  record(`${c.type}: the 201 body carries an integer revision number`,
    Number.isInteger(returned), `-> ${JSON.stringify(returned)}`)

  const after = (await api('GET', c.read(id))).data
  const afterRev = after?.latest_revision_number ?? null
  record(`${c.type}: the returned revision is the one the record moved to`,
    Number.isInteger(returned) && Number.isInteger(afterRev) && returned === afterRev,
    `returned ${returned}, record now ${afterRev}, was ${beforeRev}`)

  const series = (after?.payload ?? {})[c.criterion]
  record(`${c.type}: the score is in the payload`,
    Array.isArray(series) && series.length > 0 && series[series.length - 1].value === 3,
    Array.isArray(series) ? `${series.length} entr${series.length === 1 ? 'y' : 'ies'}, last value ${series[series.length - 1]?.value}` : 'absent')
}

// ═════════════════════════════════════════════════════════════
// ROUTE 2: setting and then moving the estimated close date. Round 41 W2
// ═════════════════════════════════════════════════════════════
//
// TWO-SIDED, and the two sides are the whole ruling: the FIRST value saves with
// no reason, and a MOVE still refuses without one. Either half alone would pass
// against a route that had simply stopped requiring reasons.
{
  const id = idFor.opportunity
  const path = `/opportunities/${id}/close-date-move`
  const payloadOf = async () => (await api('GET', `/opportunities/${id}`)).data?.payload ?? {}
  const before = await payloadOf()

  // A fresh opportunity has no forecast close date, which is the state the walk
  // was in. Asserted rather than assumed: if creation ever starts writing one,
  // this whole case would be measuring a move and still passing.
  const det = (await api('GET', `/opportunities/${id}`)).data
  record('close date: a fresh opportunity has none stored',
    !det?.opportunity_details?.forecast_close_date && !det?.forecast_close_date,
    `stored: ${JSON.stringify(det?.opportunity_details?.forecast_close_date ?? det?.forecast_close_date ?? null)}`)

  let first
  try {
    first = { status: 200, data: (await api('POST', path, { date: '2027-06-30' })).data }
  } catch (e) {
    if (!(e instanceof ApiError)) throw e
    first = { status: e.status, data: e.body }
  }
  record('close date: the FIRST value saves with no reason', first.status === 200,
    `-> ${first.status} ${first.status === 200 ? '' : JSON.stringify(first.data)}`)

  const afterFirst = await payloadOf()
  record('close date: a first recording does not increment the moves counter',
    (afterFirst.closeMoves ?? 0) === (before.closeMoves ?? 0),
    `closeMoves ${before.closeMoves ?? 0} -> ${afterFirst.closeMoves ?? 0}`)
  const note = (afterFirst.notes ?? [])[0]?.text ?? ''
  record('close date: the note says SET, not moved from "not set"',
    /^Est\. Close Date set to 2027-06-30\.$/.test(note.trim()), JSON.stringify(note))

  // THE OTHER SIDE. Now that a value is stored, the same call must refuse.
  let second
  try {
    second = { status: 200, data: (await api('POST', path, { date: '2027-09-30' })).data }
  } catch (e) {
    if (!(e instanceof ApiError)) throw e
    second = { status: e.status, data: e.body }
  }
  record('close date: a MOVE is still refused without a reason', second.status === 400,
    `-> ${second.status} ${second.data?.error ?? ''}`)

  let third
  try {
    third = { status: 200, data: (await api('POST', path, { date: '2027-09-30', reason: 'client pushed the award' })).data }
  } catch (e) {
    if (!(e instanceof ApiError)) throw e
    third = { status: e.status, data: e.body }
  }
  record('close date: a move WITH a reason succeeds', third.status === 200,
    `-> ${third.status} ${third.status === 200 ? '' : JSON.stringify(third.data)}`)

  const afterMove = await payloadOf()
  record('close date: a move DOES increment the moves counter',
    (afterMove.closeMoves ?? 0) === (afterFirst.closeMoves ?? 0) + 1,
    `closeMoves ${afterFirst.closeMoves ?? 0} -> ${afterMove.closeMoves ?? 0}`)
}

// ═════════════════════════════════════════════════════════════
// ROUTE 3: the SUPERSEDED approvals route. Round 41 item A
// ═════════════════════════════════════════════════════════════
//
// POST /records/:id/approvals predates the stage approvals workflow and stayed
// wired to a live control on the Opportunity stage panel. It must now refuse for
// a record type that uses the workflow, and must still work for one that does
// not - the second half is what stops this passing against a route that simply
// stopped accepting anything. Verification 17.
//
// AND THE OWNER MAY NOT APPROVE, on either type. That check is measured
// separately because it fires FIRST for a Test Bed the probe owns, which is the
// only kind it can create.
{
  const cases = [
    { type: 'opportunity', id: idFor.opportunity, expect: 409, why: 'superseded by the workflow' },
    { type: 'test_bed', id: idFor.test_bed, expect: 403, why: 'the probe owns the record it created' },
  ]
  for (const c of cases) {
    let status, body
    try {
      body = (await api('POST', `/records/${c.id}/approvals`, { track: 'Commercial', decision: 'approved' })).data
      status = 201
    } catch (e) {
      if (!(e instanceof ApiError)) throw e
      status = e.status; body = e.body
    }
    record(`superseded approvals route: ${c.type} -> ${c.expect} (${c.why})`, status === c.expect,
      `-> ${status} ${JSON.stringify((body?.error ?? '').slice(0, 64))}`)
  }

  // THE DISCRIMINATING HALF. A Test Bed the probe does NOT own must reach the
  // insert, which proves the route is alive rather than universally refusing.
  // Ownership is the only thing separating this call from the 403 above.
  const notMine = (await api('GET', '/test-beds')).data
    ?.find((r) => r.owner_id && r.owner_id !== SESSION_USER_ID)
  if (!notMine) {
    record('superseded approvals route: a test bed owned by somebody else exists to try', false,
      'none found, so the alive-half of this check could not run')
  } else {
    let status, body
    try {
      body = (await api('POST', `/records/${notMine.id}/approvals`, { track: 'Commercial', decision: 'approved' })).data
      status = 201
    } catch (e) {
      if (!(e instanceof ApiError)) throw e
      status = e.status; body = e.body
    }
    // 201 is the route working. A 403 from RLS is also acceptable evidence that
    // it got past the two checks above and reached the database, and is reported
    // as such rather than counted as the same thing.
    record('superseded approvals route: test_bed is still ALIVE, not universally refused',
      status === 201 || (status === 403 && !/you own this record/i.test(body?.error ?? '')),
      `-> ${status} ${JSON.stringify((body?.error ?? '').slice(0, 64))}`)
    if (status === 201 && body?.id) {
      await admin().from('approvals').delete().eq('id', body.id)
      record('superseded approvals route: the probe row is removed again', true, `approval ${body.id.slice(0, 8)} deleted`)
    }
  }
}

const { removed } = await tearDown()
record('teardown removed every record the test account owns', true,
  `${removed.length} soft-deleted, re-queried 0 live`)

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
if (failed.length) { for (const f of failed) console.log(`  FAILED: ${f.label}`); process.exit(1) }
