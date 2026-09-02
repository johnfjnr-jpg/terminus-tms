// ── THE VERSION GATE FROM PROPOSAL ONWARD ────────────────────────────────
//
// Internal review item 4. The from-Proposal transition is a SYNCHRONOUS
// CHECK-AND-GO: the salesperson asks, the gate checks whether the current issued
// major carries all three version-track approvals, and the record either moves
// THERE AND THEN or is refused. No freeze, no wait, no auto-transition.
//
// Both halves are exercised on one record, because "it moved" only means
// something once "it refused" has been shown on the same setup: a transition
// that always succeeds is indistinguishable from no gate at all.
import { freshOpportunity, tearDown, admin } from './fixtures.mjs'
import { api, ApiError } from './api-client.mjs'
import { catalogToRates } from '../src/lib/base-costs.js'
import { resolveRates, frozenRates } from '../src/lib/rate-resolution.js'
import { readFileSync } from 'fs'

const uid = JSON.parse(readFileSync(new URL('../session-ref.json', import.meta.url).pathname, 'utf8')).user.id
const results = []
const record = (label, pass, detail = '') => {
  results.push({ label, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}${detail ? '  ' + detail : ''}`)
}
const tryPost = async (path, body) => {
  try { return { status: 201, data: (await api('POST', path, body)).data } }
  catch (e) { if (!(e instanceof ApiError)) throw e; return { status: e.status, data: e.body } }
}

const TAG = process.argv[2] ?? 'R41VGATE'
const { oppId } = await freshOpportunity(`${TAG}VG`)
const rev = async () => (await api('GET', `/opportunities/${oppId}`)).data?.latest_revision_number
const stage = async () => (await api('GET', `/records/${oppId}/pulse`)).data?.status

// ── Walk it to Proposal through the UNCHANGED stage-gated path ───────────
await api('POST', `/opportunities/${oppId}/assessment-reviewed`, {})
await api('POST', `/records/${oppId}/transition-requests`, { to_stage: 'Solution Alignment' })
await api('PATCH', `/opportunities/${oppId}`, {
  payload: { exitSolKeyStakeholders: true, exitSolBuyersKnown: true,
    exitSolTechnicalSolution: true, exitSolTermsReviewed: true },
  expected_revision: await rev(),
})
await api('POST', `/opportunities/${oppId}/assessment-reviewed`, {})

const sa = await tryPost(`/records/${oppId}/transition-requests`, { to_stage: 'Proposal', kind: 'transition' })
record('SA -> Proposal still OPENS AND WAITS, unchanged',
  sa.status === 201 && sa.data?.status === 'open',
  `-> ${sa.status} status "${sa.data?.status ?? JSON.stringify(sa.data?.error ?? '').slice(0, 60)}"`)

// The record is frozen here, which is the stage-gate model working.
let frozen = false
try { await api('PATCH', `/opportunities/${oppId}`, { payload: { targetMargin: 31 }, expected_revision: await rev() }) }
catch (e) { frozen = e.status === 423 }
record('and it FREEZES the record, as the stage-gate model does', frozen)

// Approve all three to get to Proposal.
const reqId = sa.data?.id
for (const track of ['Commercial', 'Legal', 'Technical']) {
  await admin().from('approvals').insert({
    record_id: oppId, request_id: reqId, revision_number: sa.data.frozen_revision,
    stage: 'Solution Alignment', track, approver_id: uid, decision: 'approved',
    comment: 'version-gate probe', decided_at: new Date().toISOString() })
}
await admin().from('transition_requests').update({
  status: 'approved', closed_by: uid, closed_at: new Date().toISOString() }).eq('id', reqId)
await admin().from('records').update({ status: 'Proposal' }).eq('id', oppId)
record('the record reaches Proposal', await stage() === 'Proposal', `at ${await stage()}`)

// ── FROM PROPOSAL: the check refuses an unapproved price ─────────────────
const blocked = await tryPost(`/records/${oppId}/transition-requests`, { to_stage: 'Evaluation', kind: 'transition' })
record('an UNAPPROVED pricing version REFUSES the transition',
  blocked.status === 409 && /not approved for issue/i.test(blocked.data?.error ?? ''),
  `-> ${blocked.status} "${String(blocked.data?.error ?? '').slice(0, 62)}"`)
record('and the record has NOT moved', await stage() === 'Proposal', `still ${await stage()}`)
record('and it is NOT frozen by the refusal',
  (await admin().from('transition_requests').select('id').eq('record_id', oppId)
    .eq('status', 'open').maybeSingle()).data === null,
  'no open request was left behind')

// ── AND THE GO HALF: an APPROVED version moves the record there and then ──
//
// The refusal above only means something once this is shown on the same record.
// A gate that always refuses is as useless as one that always passes, and the
// two halves together are what make it a gate.
const LIVE = catalogToRates((await api('GET', '/base-costs')).data?.products ?? []).rates
const priced = (i) => frozenRates(resolveRates(i, LIVE))
const INPUTS = { targetMargin: 30 }
const version = (await api('POST', `/opportunities/${oppId}/deal-sheet-versions`,
  { inputs: INPUTS, rates: priced(INPUTS), reason: 'priced for the version gate',
    expected_revision: await rev() })).data
const issued = (await api('POST', `/deal-sheet-versions/${version.id}/issue`, {})).data
record('a major version is issued', issued?.status === 'issued' && issued?.minor === 0,
  `V${issued?.major}.${issued?.minor}`)

// The record's pricing is brought into line with what was issued, so the
// staleness comparison passes and what is being tested is the APPROVAL.
await api('PATCH', `/opportunities/${oppId}`,
  { payload: { targetMargin: 30 }, expected_revision: await rev() })

// The three version-track sign-offs, recorded against the issued version's
// revision the way the evaluator reads them.
for (const track of ['Commercial', 'Legal', 'Technical']) {
  const { error } = await admin().from('approvals').insert({
    record_id: oppId, revision_number: issued.revision_number, stage: 'Proposal',
    track, approver_id: uid, decision: 'approved',
    comment: 'Proposal/Pricing approved for issue', decided_at: new Date().toISOString() })
  if (error) record(`the ${track} sign-off records`, false, error.message)
}

// A write BEFORE the transition, proving the record was never frozen while the
// sign-offs were gathered. That is the whole no-freeze claim, on this record.
let editable = true
try { await api('PATCH', `/opportunities/${oppId}`, { payload: { warrantyPct: 3 }, expected_revision: await rev() }) }
catch { editable = false }
record('the record stayed EDITABLE while sign-offs were collected', editable)

// Proposal's own exit criteria, satisfied the way a person would, so what the
// transition is refused for (or not) is the APPROVAL and not something else.
// `proposalIssued` is set by issuing the version above, not by hand.
await api('PATCH', `/opportunities/${oppId}`, {
  payload: { exitPropImplSchedule: true, exitPropDocumentation: true, exitPropContractTerms: true },
  expected_revision: await rev(),
})
await api('POST', `/opportunities/${oppId}/assessment-reviewed`, {})

const go = await tryPost(`/records/${oppId}/transition-requests`, { to_stage: 'Evaluation', kind: 'transition' })
record('an APPROVED version TRANSITIONS IMMEDIATELY on request',
  go.status === 201 && go.data?.status === 'approved',
  `-> ${go.status} status "${go.data?.status ?? String(go.data?.error ?? '').slice(0, 60)}"`)
record('and the record HAS moved, with no wait',
  await stage() === 'Evaluation', `now ${await stage()}`)
record('and nothing is left open, so nothing is frozen',
  (await admin().from('transition_requests').select('id').eq('record_id', oppId)
    .eq('status', 'open').maybeSingle()).data === null)

let stillEditable = true
try { await api('PATCH', `/opportunities/${oppId}`, { payload: { warrantyPct: 4 }, expected_revision: await rev() }) }
catch { stillEditable = false }
record('and the record is STILL editable afterwards', stillEditable)

await tearDown()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
for (const f of failed) console.log(`  FAILED: ${f.label}`)
process.exit(failed.length ? 1 : 0)
