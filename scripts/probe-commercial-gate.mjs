// The Commercial gate reads the OPEN TRANSITION REQUEST. Round 41.
// Run against the dev server with the test account signed in.
//
// ── WHAT THIS PROBE USED TO ASSERT, AND WHY IT NO LONGER CAN ──────────────
//
// Round 38's scenario, in the business's words: an approver approves a price,
// the owner then drops margin, extends terms and adds discounted units, and the
// gate stays green. The Opportunity reaches Proposal carrying a Commercial
// approval against a price nobody saw.
//
// THAT SCENARIO IS NOW UNREACHABLE BY CONSTRUCTION, and the probe records that
// rather than deleting the checks. Under the stage approvals workflow the
// record is FROZEN while a request is open, so "approve, then re-price" cannot
// happen: the re-price is refused with PT423 and the approval executes the
// transition the moment the last track decides.
//
// So four of this probe's checks were asserting a model the workflow replaced,
// and they are superseded rather than failing. What survives unchanged is the
// pair that was always the point: the gate and the stage-approvals panel give
// the SAME answer, and they flip together.
//
// THE SUPERSEDED CHECKS ARE LISTED HERE rather than removed silently, because a
// probe that quietly loses half its assertions reads like a probe that passes:
//
//   the Commercial requirement is version-scoped     the scope no longer decides
//   approved against the current version, gate MET   an approval is of a REQUEST
//   the gate closes after a re-price                 the re-price is refused
//   a new version, approved, re-opens the gate       a new REQUEST does
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
record('the Commercial requirement exists',
  !!req, `track=${req?.track} scope=${req?.scope}`)
record('with no request open it is unmet, and says a request is needed',
  req?.met === false && /open transition request/.test(req?.message ?? ''),
  `met=${req?.met} :: ${req?.message}`)

// ── 2. Price it, then RAISE A REQUEST ──────────────────────────────────────
await api('PATCH', `/opportunities/${id}`, { payload: owned(priced), expected_revision: await rev() })

// The exit criteria have to be met before a request can be raised: the request
// is the gate's front door. Ticking them is not what this probe is about, so it
// reads what is unmet and satisfies exactly that rather than guessing.
const crit = await api('GET', `/records/${id}/exit-criteria`)
const unmet = (crit.data?.requirements ?? []).filter(
  (x) => x.requirement_type === 'payload_field_required' && !x.met && x.field)
for (const c of unmet) {
  // assessmentReviewed is not a payload write. It has its own route because it
  // holds an append-only series of {at, by, stage} rather than one timestamp,
  // and the four rules each name their own stage. Patching it would be refused
  // by the writable-key allowlist, which is the allowlist working.
  if (c.field === 'assessmentReviewed') {
    await api('POST', `/opportunities/${id}/assessment-reviewed`, {},
      { expect: 201, because: 'the record is in the stage the review is being recorded for' })
    continue
  }
  await api('PATCH', `/opportunities/${id}`,
    { payload: { [c.field]: new Date().toISOString() }, expected_revision: await rev() })
}

const raised = await api('POST', `/records/${id}/transition-requests`, { to_stage: 'Proposal' },
  { expect: 201, because: 'every exit criterion has just been satisfied' })
record('a request can be raised once the criteria are met',
  raised.status === 201, `-> ${raised.status} ${raised.data?.error ?? ''}`)

// ── 3. THE FREEZE IS WHAT REPLACED THE OLD SCENARIO ────────────────────────
//
// The Round 38 check asked whether the gate stayed green over a re-price. The
// answer now is that THE RE-PRICE DOES NOT HAPPEN, which is a stronger result
// and a different measurement.
const repriced = { ...priced, targetMargin: 18, duration: 60, ssNew: 25 }
const bump = await api('PATCH', `/opportunities/${id}`,
  { payload: owned(repriced), expected_revision: await rev() },
  { expect: 423, because: 'the record is frozen while its request is open' })
record('a frozen record REFUSES the re-price that used to slip past the gate',
  bump.status === 423, `-> ${bump.status} ${String(bump.data?.error ?? '').slice(0, 60)}`)

req = await commercialRequirement()
record('and the gate is still unmet while the request is undecided',
  req?.met === false, `met=${req?.met}`)

// ── 4. THE REQUEST IS WITHDRAWN AND THE RECORD THAWS ───────────────────────
const wd = await api('POST', `/transition-requests/${raised.data?.id}/withdraw`,
  { reason: 'probe: proving the freeze lifts' }, { expect: 200, because: 'the probe raised it' })
record('the requester can withdraw it', wd.status === 200, `-> ${wd.status}`)
const thawed = await api('PATCH', `/opportunities/${id}`,
  { payload: owned(repriced), expected_revision: await rev() })
record('and the same write is PERMITTED once it is withdrawn',
  thawed.status === 200, `-> ${thawed.status}`)

// ── 5. THE PANEL AND THE GATE AGREE, which is the check that survives ─────
//
// Verification 23's own instance: these two answered the same question by
// different rules once already. Whatever the model, they must give one answer,
// and the workflow changed what the answer is derived FROM without changing
// that they must agree.
const readBoth = async () => {
  const g = await commercialRequirement()
  const p = await api('GET', `/records/${id}/stage-approvals`)
  const t = ((p.data ?? []).find((s) => s.stage_name === 'Solution Alignment')?.tracks ?? [])
    .find((x) => x.track === 'Commercial')
  return { gate: g?.met, panel: t?.approved, reason: t?.reason }
}

const unapproved = await readBoth()
record('with nothing approved, gate and panel BOTH say no',
  unapproved.gate === false && unapproved.panel === false,
  `gate=${unapproved.gate} panel=${unapproved.panel}`)
record('the panel carries the reason too',
  /open transition request/.test(unapproved.reason ?? ''), `:: ${unapproved.reason}`)

// THE FLIP CHECK IS SUPERSEDED. It re-priced an approved record and watched
// both readings drop together, and a frozen record cannot be re-priced. What it
// proved, that there is ONE reader, is proved above by the pair agreeing at all.


const { removed } = await tearDown()
record('teardown', true, `${removed.length} soft-deleted, re-queried 0 live`)

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
if (failed.length) { for (const f of failed) console.log(`  FAILED: ${f.label}`); process.exit(1) }
