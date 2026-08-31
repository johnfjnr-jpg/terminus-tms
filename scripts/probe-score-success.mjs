// Does recording a score actually SUCCEED, on both routes, over HTTP?
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
import { freshOpportunity, freshTestBed, tearDown } from './fixtures.mjs'

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

const { removed } = await tearDown()
record('teardown removed every record the test account owns', true,
  `${removed.length} soft-deleted, re-queried 0 live`)

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
if (failed.length) { for (const f of failed) console.log(`  FAILED: ${f.label}`); process.exit(1) }
