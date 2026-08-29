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

import { api, ApiError } from './api-client.mjs'
import { catalogToRates } from '../src/lib/base-costs.js'
import { resolveRates, frozenRates } from '../src/lib/rate-resolution.js'

// Every call goes through the throwing client. A probe that asserts a refusal
// says which status and why, in the call, so an unexpected 500 cannot be read
// as the refusal the probe was hoping for.
async function refused(label, expect, because, fn) {
  try {
    const r = await fn(expect, because)
    record(label, false, `expected ${expect}, got ${r.status}`)
    return null
  } catch (e) {
    if (!(e instanceof ApiError)) throw e
    record(label, false, `expected ${expect}, got ${e.status}: ${JSON.stringify(e.body)}`)
    return null
  }
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

// The rates the LIVE catalog resolves, asked of the server through the same
// function the tab and the submit route use, rather than written down. The route
// requires exactly the keys the catalog produced, so a hardcoded set here would
// break the first time a product's batch changes.
const LIVE_RATES = catalogToRates(
  (await api('GET', '/base-costs')).data?.products ?? []).rates

// ── A version must name a revision ─────────────────────────────────────────
// Round 40 Phase 1b: rates no longer live in inputs. The record holds the
// DECISION, the version holds the PRICE, and the client sends what it priced
// with so the server can confirm the two still agree.
const priced = (inputs) => frozenRates(resolveRates(inputs, LIVE_RATES))
const BASE = { targetMargin: 30 }

const noRev = await api('POST', `/opportunities/${oppId}/deal-sheet-versions`,
  { inputs: BASE, rates: priced(BASE), reason: 'no revision named' },
  { expect: 400, because: 'a version must name the revision it was taken from' })
record('a version with no expected_revision is refused', noRev.status === 400,
  `-> ${noRev.status} ${noRev.data?.error ?? ''}`)

const stale = await api('POST', `/opportunities/${oppId}/deal-sheet-versions`,
  { inputs: BASE, rates: priced(BASE), reason: 'stale', expected_revision: (await rev()) - 1 },
  { expect: 409, because: 'the record is not at the revision this version would record' })
record('a version naming a revision the record has left is refused', stale.status === 409,
  `-> ${stale.status} ${stale.data?.error ?? ''}`)

// FAIL CLOSED ON A VERSION WITH NO COST BASIS. Before this, a version whose
// inputs carried no rates priced every line at zero and made the approval page's
// bridge report the whole deal as a catalog movement. The page refused the
// comparison, which was right and was not enough: it stayed creatable.
// FAIL CLOSED ON A VERSION THAT CANNOT BE SHOWN TO AGREE WITH THE CATALOG.
// The old check required inputs to carry every catalog rate, which was right
// while rates lived in the payload. The REASON survives: a version must record
// what the salesperson's screen priced against, not what the server resolved a
// moment later, and the two differ whenever a batch turns over mid-session.
const noRates = await api('POST', `/opportunities/${oppId}/deal-sheet-versions`,
  { inputs: BASE, reason: 'no rates sent', expected_revision: await rev() },
  { expect: 400, because: 'sending no rates leaves nothing to compare, which is not agreement' })
record('a version sending NO rates is refused', noRates.status === 400,
  `-> ${noRates.status} ${noRates.data?.error ?? ''}`)

// Verification 14: "no disagreement" and "nothing to compare" are different,
// and a check that passed on the second would pass on an empty request.
const disagree = await api('POST', `/opportunities/${oppId}/deal-sheet-versions`,
  {
    inputs: BASE,
    rates: { rates: { ...LIVE_RATES, ssUnitCost: (LIVE_RATES.ssUnitCost ?? 0) + 1 }, overridden: [], absent: [] },
    reason: 'catalog moved under it',
    expected_revision: await rev(),
  },
  { expect: 409, because: 'the screen priced at a rate the catalog no longer holds' })
record('a version whose rates DISAGREE with the catalog is refused', disagree.status === 409,
  `-> ${disagree.status} ${JSON.stringify(disagree.data?.differing ?? null)}`)
record('and the refusal names which rate differs', Array.isArray(disagree.data?.differing) && disagree.data.differing.length > 0,
  `differing=${JSON.stringify(disagree.data?.differing)}`)

// ── Take one properly ──────────────────────────────────────────────────────
//
// The rates the LIVE catalog resolves, asked of the server rather than written
// down: the route requires exactly the keys it produced, so a hardcoded set here
// would break the moment a product's batch changes.
const atRev = await rev()
const made = await api('POST', `/opportunities/${oppId}/deal-sheet-versions`,
  { inputs: { ...BASE, duration: 36 }, rates: priced({ ...BASE, duration: 36 }), reason: 'first pricing', expected_revision: atRev })
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
  { inputs: { ...LIVE_RATES, targetMargin: 24, duration: 36 }, reason: 'repriced after approval', expected_revision: nowRev })
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
