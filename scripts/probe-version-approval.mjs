// Approval is of a version, and a revision after it voids the approval.
// Round 38. Run against the dev server with the test account signed in.
//
// WHAT THIS PROBE LEAVES BEHIND, STATED RATHER THAN DISCOVERED LATER. Records
// are soft-deleted by tearDown(), but the approval rows it writes are NOT
// removed: `approvals` is history, and deleting history to tidy a test run is
// the thing this system refuses to do everywhere else. Each run therefore adds
// two rows to the Commercial track, attached to soft-deleted records. Measured:
// CURRENT_STATE.md's approvals table moved 233 -> 237 across two runs. The 642
// rows already there arrived the same way.
//
// TWO-SIDED THROUGHOUT. "Superseded" alone proves nothing: a route that called
// everything superseded would produce it. Every claim here is measured against
// the state immediately before the thing that is supposed to change it.

import { readFileSync } from 'fs'
import { freshOpportunity, tearDown } from './fixtures.mjs'

const SESSION = JSON.parse(readFileSync('/Users/johnfryatt/terminus-tms/session-ref.json', 'utf8'))
const BASE = 'http://localhost:3000'

async function api(method, path, body) {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SESSION.access_token}` },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: res.status, ok: res.ok, data: await res.json().catch(() => null) }
}

const results = []
function record(label, pass, detail) {
  results.push({ label, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}  ${detail}`)
}

const TAG = process.argv[2] ?? 'R38VER'
const opp = await freshOpportunity(`${TAG}OPP`)
const oppId = opp.oppId

const rev = async () => (await api('GET', `/opportunities/${oppId}`)).data?.latest_revision_number
const versions = async () => (await api('GET', `/opportunities/${oppId}/deal-sheet-versions`)).data
const stateOf = async (id) => (await versions()).find((v) => v.id === id)?.approval?.state

// ── A version must name a revision ─────────────────────────────────────────
const noRev = await api('POST', `/opportunities/${oppId}/deal-sheet-versions`,
  { inputs: { targetMargin: 30 }, reason: 'no revision named' })
record('a version with no expected_revision is refused', noRev.status === 400,
  `-> ${noRev.status} ${noRev.data?.error ?? ''}`)

const stale = await api('POST', `/opportunities/${oppId}/deal-sheet-versions`,
  { inputs: { targetMargin: 30 }, reason: 'stale', expected_revision: (await rev()) - 1 })
record('a version naming a revision the record has left is refused', stale.status === 409,
  `-> ${stale.status} ${stale.data?.error ?? ''}`)

// ── Take one properly ──────────────────────────────────────────────────────
const atRev = await rev()
const made = await api('POST', `/opportunities/${oppId}/deal-sheet-versions`,
  { inputs: { targetMargin: 30, duration: 36 }, reason: 'first pricing', expected_revision: atRev })
record('a version naming the current revision is accepted', made.status === 200 || made.status === 201,
  `-> ${made.status}`)
const vid = made.data?.id

const listed = (await versions()).find((v) => v.id === vid)
record('the version carries the revision it was taken from',
  listed?.revision_number === atRev, `revision_number=${listed?.revision_number}, record at ${atRev}`)
record('and it is not approved yet', listed?.approval?.state === 'none',
  `state=${listed?.approval?.state}`)

// ── Approve it, at the revision it names ───────────────────────────────────
const appr = await api('POST', `/records/${oppId}/approvals`,
  { track: 'Commercial', decision: 'approved', comment: 'probe' })
record('an approval is recorded', appr.status === 200 || appr.status === 201,
  `-> ${appr.status} ${appr.ok ? `at revision ${appr.data?.revision_number}` : JSON.stringify(appr.data)}`)

const approvedState = await stateOf(vid)
record('approving that revision approves the version', approvedState === 'approved',
  `state=${approvedState}`)

// ── The rule: ONE revision after approval voids it ─────────────────────────
const before = await stateOf(vid)
const bump = await api('PATCH', `/opportunities/${oppId}`,
  { payload: { targetMargin: 24 }, expected_revision: await rev() })
record('a save lands', bump.status === 200, `-> ${bump.status} revision ${bump.data?.revision_number}`)
const after = await stateOf(vid)

record('ONE revision after approval voids it',
  before === 'approved' && after === 'superseded',
  `${before} -> ${after}`)

const supersededRow = (await versions()).find((v) => v.id === vid)
record('and the page can say how far it has moved',
  supersededRow?.approval?.revisionsSince === 1,
  `revisionsSince=${supersededRow?.approval?.revisionsSince}`)

// ── The remedy the state names: a new version, approved ────────────────────
const nowRev = await rev()
const v2 = await api('POST', `/opportunities/${oppId}/deal-sheet-versions`,
  { inputs: { targetMargin: 24, duration: 36 }, reason: 'repriced after approval', expected_revision: nowRev })
await api('POST', `/records/${oppId}/approvals`, { track: 'Commercial', decision: 'approved', comment: 'probe 2' })
record('a new version approved at the current revision reads approved',
  (await stateOf(v2.data?.id)) === 'approved', `state=${await stateOf(v2.data?.id)}`)
record('and the superseded one STAYS superseded',
  (await stateOf(vid)) === 'superseded', `state=${await stateOf(vid)}`)

const { removed } = await tearDown()
record('teardown', true, `${removed.length} soft-deleted, re-queried 0 live`)

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
if (failed.length) { for (const f of failed) console.log(`  FAILED: ${f.label}`); process.exit(1) }
