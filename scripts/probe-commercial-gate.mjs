// The Commercial gate reads the approval page's own answer. Round 38.
// Run against the dev server with the test account signed in.
//
// THE SCENARIO THIS EXISTS FOR, in the business's words: an approver approves a
// price, the owner then drops margin, extends terms and adds discounted units,
// and the gate stays green. The Opportunity reaches Proposal carrying a
// Commercial approval against a price nobody saw.
//
// Every check is two-sided. "The gate is blocked" proves nothing on its own - a
// gate that refused everything would produce it - so each half is measured
// against the state immediately before the thing that is supposed to change it.

import { api } from './api-client.mjs'
import { resolveRates, frozenRates } from '../src/lib/rate-resolution.js'
import { freshOpportunity, tearDown } from './fixtures.mjs'
import { catalogToRates } from '../src/lib/base-costs.js'

const results = []
function record(label, pass, detail) {
  results.push({ label, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}  ${detail}`)
}

const TAG = process.argv[2] ?? 'R38GATE'
const opp = await freshOpportunity(`${TAG}OPP`)
const id = opp.oppId

const LIVE_RATES = catalogToRates((await api('GET', '/base-costs')).data?.products ?? []).rates
const rev = async () => (await api('GET', `/opportunities/${id}`)).data?.latest_revision_number

// The Commercial requirement on the transition out of Solution Alignment.
async function commercialRequirement() {
  const r = await api('GET', `/records/${id}/exit-criteria`)
  const all = r.data?.requirements ?? r.data?.criteria ?? []
  return all.find((x) => x.requirement_type === 'approval_obtained' && x.track === 'Commercial') ?? null
}

const OWNED = ['ssExisting', 'ssNew', 'aqm', 'hemir', 'installResp', 'lumpSumCost', 'targetMargin',
  'marginOverrides', 'warrantyPct', 'whtPct', 'gstPct', 'grossUp', 'duration', 'structure',
  'recoveryMonths', 'invoicing', 'milestones', 'contractorMilestones', 'factoring']
const owned = (p) => Object.fromEntries(OWNED.filter((k) => k in p).map((k) => [k, p[k]]))

const priced = {
  ...LIVE_RATES, ssExisting: 40, ssNew: 10, aqm: 6, hemir: 2,
  targetMargin: 30, warrantyPct: 2, whtPct: 10, gstPct: 7, grossUp: false,
  duration: 36, recoveryMonths: 12, invoicing: 'annual', structure: 'twoPhase',
  installResp: 'Terminus Contractor - Lump Sum', lumpSumCost: 60000,
}

// Move the record to Solution Alignment, where the Commercial gate sits.
// Qualification's own gate wants an assessment review first, which is not what
// this probe is about, so it is satisfied rather than worked around: a probe
// that skipped the transition would measure the WRONG stage's requirements and
// report undefined as though it were false.
await api('POST', `/opportunities/${id}/assessment-reviewed`, {})
const moved = await api('POST', `/records/${id}/transition`, { to_stage: 'Solution Alignment' })
record('the record reaches the stage the Commercial gate sits on',
  moved.status === 200, `-> ${moved.status}`)

// ── 1. Nothing approved ────────────────────────────────────────────────────
let req = await commercialRequirement()
record('the Commercial requirement exists and is version-scoped',
  req?.scope === 'version', `scope=${req?.scope}`)
record('with nothing approved it is unmet, and says a version is needed',
  req?.met === false && /No Deal Sheet version has been approved/.test(req?.message ?? ''),
  `met=${req?.met} :: ${req?.message}`)

// Round 40 Phase 1b: a version records the rates its screen priced against, so
// the server can confirm they still agree with the catalog. Asked of the live
// catalog rather than written down, for the same reason the old probe did.
const LIVE = catalogToRates((await api('GET', '/base-costs')).data?.products ?? []).rates
const pricedWith = (inputs) => frozenRates(resolveRates(inputs, LIVE))

// ── 2. Price it, version it, approve it ────────────────────────────────────
await api('PATCH', `/opportunities/${id}`, { payload: owned(priced), expected_revision: await rev() })
await api('POST', `/opportunities/${id}/deal-sheet-versions`,
  { inputs: priced, rates: pricedWith(priced), reason: 'Initial pricing at list', expected_revision: await rev() })
await api('POST', `/records/${id}/approvals`, { track: 'Commercial', decision: 'approved' })

req = await commercialRequirement()
record('approved against the current version, the gate is MET',
  req?.met === true, `met=${req?.met} :: ${req?.message}`)

// ── 3. THE SCENARIO. Drop margin, extend terms, add discounted units ───────
const before = req?.met
const repriced = { ...priced, targetMargin: 18, duration: 60, ssNew: 25, marginOverrides: { hwSs: 12 } }
const bump = await api('PATCH', `/opportunities/${id}`,
  { payload: owned(repriced), expected_revision: await rev() })
record('the owner re-prices after approval', bump.status === 200, `-> revision ${bump.data?.revision_number}`)

req = await commercialRequirement()
record('THE GATE CLOSES. It does not stay green over a price nobody saw',
  before === true && req?.met === false,
  `${before} -> ${req?.met}`)
record('and the reason names what happened rather than saying nothing is approved',
  /moved on \d+ save/.test(req?.message ?? ''), `:: ${req?.message}`)

// ── 4. The remedy works ────────────────────────────────────────────────────
await api('POST', `/opportunities/${id}/deal-sheet-versions`,
  { inputs: repriced, rates: pricedWith(repriced), reason: 'Repriced: margin conceded and term extended', expected_revision: await rev() })
await api('POST', `/records/${id}/approvals`, { track: 'Commercial', decision: 'approved' })
req = await commercialRequirement()
record('a new version, approved, re-opens the gate', req?.met === true, `met=${req?.met}`)

// ── 5. The panel and the gate agree ────────────────────────────────────────
const panel = await api('GET', `/records/${id}/stage-approvals`)
const sa = (panel.data ?? []).find((s) => s.stage_name === 'Solution Alignment')
const commercialTrack = (sa?.tracks ?? []).find((t) => t.track === 'Commercial')
record('the stage-approvals panel agrees with the gate',
  commercialTrack?.approved === true,
  `panel approved=${commercialTrack?.approved}, gate met=${req?.met}`)

// And disagree-check: move it again, both must flip together.
await api('PATCH', `/opportunities/${id}`, { payload: { targetMargin: 21 }, expected_revision: await rev() })
const req2 = await commercialRequirement()
const panel2 = await api('GET', `/records/${id}/stage-approvals`)
const t2 = ((panel2.data ?? []).find((s) => s.stage_name === 'Solution Alignment')?.tracks ?? [])
  .find((t) => t.track === 'Commercial')
record('and they flip TOGETHER, which is the whole point of one reader',
  req2?.met === false && t2?.approved === false,
  `gate met=${req2?.met}, panel approved=${t2?.approved}`)
record('the panel carries the reason too', !!t2?.reason, `:: ${t2?.reason}`)

const { removed } = await tearDown()
record('teardown', true, `${removed.length} soft-deleted, re-queried 0 live`)

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
if (failed.length) { for (const f of failed) console.log(`  FAILED: ${f.label}`); process.exit(1) }
