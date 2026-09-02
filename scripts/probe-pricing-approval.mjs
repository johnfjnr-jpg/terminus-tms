// ── THE MANUAL PRICING-APPROVAL REQUEST ──────────────────────────────────
//
// Latest walk, MAIN, ruled 2026-09-02. A requester raises a review request
// against a specific ISSUED major version. It does not freeze the record, the
// approvers' decisions are the standing sign-off, and the from-Proposal
// transition then CHECKS it.
//
// Separate from issuing on purpose: a requester may issue and keep refining
// before asking three people to sign off.
import { freshOpportunity, tearDown, admin } from './fixtures.mjs'
import { readFileSync } from 'fs'
import { api, ApiError } from './api-client.mjs'
import { catalogToRates } from '../src/lib/base-costs.js'
import { resolveRates, frozenRates } from '../src/lib/rate-resolution.js'

const session = JSON.parse(readFileSync('session-ref.json', 'utf8'))
const results = []
const record = (label, pass, detail = '') => {
  results.push({ label, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}${detail ? '  ' + detail : ''}`)
}
// UNWRAPPED. api() answers { status, data }, so the first version read
// `result.data.kind` off the envelope and saw undefined on a 201 that was
// perfectly correct - a check failing for a reason unrelated to its claim.
const attempt = async (fn) => {
  try { const r = await fn(); return { status: r.status ?? 201, data: r.data ?? r } }
  catch (e) { if (!(e instanceof ApiError)) throw e; return { status: e.status, data: e.body } }
}

const TAG = process.argv[2] ?? 'R41PRICE'
const { oppId } = await freshOpportunity(`${TAG}PA`)
const rev = async () => (await api('GET', `/opportunities/${oppId}`)).data?.latest_revision_number
const LIVE = catalogToRates((await api('GET', '/base-costs')).data?.products ?? []).rates
const priced = (i) => frozenRates(resolveRates(i, LIVE))
const INPUTS = { targetMargin: 30 }

// A DRAFT first, so "issue it before asking" is exercised on a real draft.
const draft = (await api('POST', `/opportunities/${oppId}/deal-sheet-versions`,
  { inputs: INPUTS, rates: priced(INPUTS), reason: 'pricing approval probe', expected_revision: await rev() })).data

// `to_stage` names the move the sign-off unlocks. It cannot be the record's own
// stage: raise_transition_request refuses that with "record is already in that
// stage", and an earlier version of this probe took that refusal for the one it
// was testing - two checks passing for a reason unrelated to their claim.
const NEXT = 'Solution Alignment'

const onDraft = await attempt(() => api('POST', `/records/${oppId}/transition-requests`,
  { to_stage: NEXT, kind: 'review', version_id: draft.id }))
record('a DRAFT cannot be sent for approval', onDraft.status === 409 && /Issue it before/.test(onDraft.data?.error ?? ''),
  `-> ${onDraft.status} "${String(onDraft.data?.error ?? '').slice(0, 56)}"`)

const noVersion = await attempt(() => api('POST', `/records/${oppId}/transition-requests`,
  { to_stage: NEXT, kind: 'review' }))
record('a request with NO version is refused', noVersion.status === 400,
  `-> ${noVersion.status} "${String(noVersion.data?.error ?? '').slice(0, 52)}"`)

const issued = (await api('POST', `/deal-sheet-versions/${draft.id}/issue`, {})).data
record('the version issues', issued?.status === 'issued', `V${issued?.major}.${issued?.minor}`)

// ISSUING ALONE MUST NOT ASK ANYBODY, which is the ruled separation.
const afterIssue = (await api('GET', `/records/${oppId}/transition-requests`)).data ?? []
record('issuing alone raises NO approval request',
  afterIssue.filter((r) => r.kind === 'review').length === 0,
  'the requester asks when they are ready, not when they issue')

// BEFORE PROPOSAL THERE IS NOBODY TO ASK. Qualification -> Solution Alignment
// is stage-gated by ruling, so a pricing approval there would open, collect
// nothing, and be decidable by no one.
const tooEarly = await attempt(() => api('POST', `/records/${oppId}/transition-requests`,
  { to_stage: NEXT, kind: 'review', version_id: issued.id }))
record('a pricing approval BEFORE Proposal is refused, with the reason',
  tooEarly.status === 409 && /nobody to ask/.test(tooEarly.data?.error ?? ''),
  `-> ${tooEarly.status} "${String(tooEarly.data?.error ?? '').slice(0, 60)}"`)

// AT PROPOSAL it is the real thing. The stage is set directly: walking the
// whole stage-gated half is probe-version-gate's job, and repeating it here
// would test that path twice and this one once.
await admin().from('records').update({ status: 'Proposal' }).eq('id', oppId)
const asked = await attempt(() => api('POST', `/records/${oppId}/transition-requests`,
  { to_stage: 'Evaluation', kind: 'review', version_id: issued.id }))
record('an ISSUED version can be sent for approval from Proposal',
  asked.status === 201 && asked.data?.kind === 'review' && asked.data?.status === 'open',
  `-> ${asked.status} kind=${asked.data?.kind} status=${asked.data?.status}`)

// IT DOES NOT FREEZE, which is the whole point.
let editable = true
try { await api('PATCH', `/opportunities/${oppId}`, { payload: { warrantyPct: 3 }, expected_revision: await rev() }) }
catch { editable = false }
record('the record stays EDITABLE while approval is pending', editable)

const listed = ((await api('GET', `/records/${oppId}/transition-requests`)).data ?? [])
  .find((r) => r.kind === 'review' && r.status === 'open')
record('the pending request names its VERSION and its tracks',
  listed?.version_label === `V${issued.major}` && (listed?.required ?? []).length === 3,
  `${listed?.version_label} required=${JSON.stringify(listed?.required)}`)

const second = await attempt(() => api('POST', `/records/${oppId}/transition-requests`,
  { to_stage: 'Evaluation', kind: 'review', version_id: issued.id }))
record('a SECOND pricing approval is refused while one is open', second.status === 409,
  `-> ${second.status}`)

// ── DECIDING IT, AT PROPOSAL ──────────────────────────────────────────────
//
// Verification 40 on its own success clause: this probe raised a pricing
// approval and never decided one, so the only write the feature exists for was
// never exercised. Verification 25's population clause is the other half -
// probe-direct-paths DOES decide review requests, all three at Solution
// Alignment, the single stage whose tracks are still stage-scoped. The version
// tracks live from Proposal onward and no decide had ever run there.
//
// The defect that hid behind both: decide_transition_request validated the
// track against required_tracks_for regardless of kind, and 20260902000004
// correctly emptied that set from Proposal onward, so every pricing approval
// was refused 400 and wrote nothing.
const db = admin()
const { data: seats } = await db.from('track_approvers')
  .select('user_id').eq('record_type', 'opportunity')
// A GENUINELY DIFFERENT IDENTITY. Taking the first row is not enough: the
// session user is himself seeded on these tracks, and a fixture that made him
// the requester would measure the self-approval refusal instead.
const otherUser = (seats ?? []).map((r) => r.user_id).find((u) => u !== session.user.id)
if (!otherUser) throw new Error('no second identity in track_approvers')
const openReq = ((await api('GET', `/records/${oppId}/transition-requests`)).data ?? [])
  .find((r) => r.kind === 'review' && r.status === 'open')

// THE SESSION USER MUST NOT BE THE REQUESTER, which is the rule the feature
// enforces and not the one under test here. frozen_revision is re-synced in the
// same write because the editability check above deliberately bumped it: this
// models a request raised and not yet edited against, which is the state an
// approver normally opens.
const currentRev = await rev()
await db.from('transition_requests')
  .update({ requested_by: otherUser, frozen_revision: currentRev }).eq('id', openReq.id)

// A TRACK THE REQUEST DOES NOT COLLECT is still refused. Seeded as a
// record-scoped approver on a track no rule names, because the approver check
// fires before the track check and would otherwise answer first.
// RECORD-SCOPED SEATS for the session user. Finance is the track no rule
// names; Commercial and Legal are the ones under test. Seeded here rather than
// assumed, because a global seat is a configuration fact this probe must not
// depend on: without them the approver check answers first and every result
// below would be a 403 measuring the wrong rule.
const { data: fixtureSeats } = await db.from('track_approvers').insert(
  ['Finance', 'Commercial', 'Legal'].map((track) => ({
    record_type: 'opportunity', track, user_id: session.user.id, record_id: oppId,
  }))).select('id')
const wrongTrack = await attempt(() => api('POST', `/transition-requests/${openReq.id}/approvals`,
  { track: 'Finance', decision: 'approved' }))
record('a track the pricing approval does NOT collect is refused',
  wrongTrack.status === 400 && /decide nothing/.test(wrongTrack.data?.error ?? ''),
  `-> ${wrongTrack.status} "${String(wrongTrack.data?.error ?? '').slice(0, 62)}"`)

// THE CALIBRATION TARGET. Fails against pre-20260902000005 code with
// "The Commercial track is not required to leave Proposal".
const decided = await attempt(() => api('POST', `/transition-requests/${openReq.id}/approvals`,
  { track: 'Commercial', decision: 'approved' }))
record('an authorised approver CAN approve a pricing approval at Proposal',
  decided.status === 201 || decided.status === 200,
  `-> ${decided.status} "${String(decided.data?.error ?? '').slice(0, 68)}"`)

const rows = await db.from('approvals').select('track, decision')
  .eq('request_id', openReq.id).eq('decision', 'approved')
record('the approval is RECORDED, not merely accepted',
  (rows.data ?? []).some((r) => r.track === 'Commercial'),
  `${(rows.data ?? []).length} approved row(s)`)

// SYMMETRY. The check this migration replaced was guarded by
// p_decision = 'approved', so a rejection skipped it entirely: an approver
// could reject a pricing approval and not approve one. Both halves are checked
// now, so a rejection on an uncollected track is refused the same way.
const wrongReject = await attempt(() => api('POST', `/transition-requests/${openReq.id}/approvals`,
  { track: 'Finance', decision: 'rejected', reason: 'symmetry probe' }))
record('a REJECTION on an uncollected track is refused too',
  wrongReject.status === 400 && /decide nothing/.test(wrongReject.data?.error ?? ''),
  `-> ${wrongReject.status} "${String(wrongReject.data?.error ?? '').slice(0, 62)}"`)

// ── NO FREEZE MEETS THE STALENESS CHECK ──────────────────────────────────
//
// Found while calibrating this probe and ruled in the same breath: the decide
// function's frozen_revision check was not kind-aware either, so with the track
// check corrected the FIRST ORDINARY EDIT made a pricing approval undecidable.
// A feature whose point is that it does not freeze must not go stale on the
// record's revision.
await api('PATCH', `/opportunities/${oppId}`,
  { payload: { warrantyPct: 4 }, expected_revision: await rev() })
const afterEdit = await attempt(() => api('POST', `/transition-requests/${openReq.id}/approvals`,
  { track: 'Legal', decision: 'approved' }))
record('a pricing approval survives an ordinary edit to the deal',
  afterEdit.status === 201 || afterEdit.status === 200,
  `-> ${afterEdit.status} "${String(afterEdit.data?.error ?? '').slice(0, 62)}"`)

// AND THE CLAUSE MUST DISCRIMINATE ON KIND, not simply be gone. Verification
// 24: without this, deleting the staleness check outright would pass every
// assertion above. A TRANSITION request still goes stale on the same edit.
const { oppId: txId } = await freshOpportunity(`${TAG}TX`)
await db.from('records').update({ status: 'Solution Alignment' }).eq('id', txId)
// THE EDIT COMES FIRST. A transition request FREEZES the record, so the state
// cannot be built by raising and then editing: the PATCH answers 423. Edit,
// then raise against the revision the record has already left, which is the
// same stale pair from the approver's side.
const txRev = (await api('GET', `/opportunities/${txId}`)).data?.latest_revision_number
await api('PATCH', `/opportunities/${txId}`,
  { payload: { warrantyPct: 5 }, expected_revision: txRev })
const { data: txReq } = await db.from('transition_requests').insert({
  record_id: txId, record_type: 'opportunity', from_stage: 'Solution Alignment',
  to_stage: 'Proposal', kind: 'transition', status: 'open',
  frozen_revision: txRev, requested_by: otherUser,
}).select('id').single()
const { data: txSeat } = await db.from('track_approvers').insert({
  record_type: 'opportunity', track: 'Commercial', user_id: session.user.id, record_id: txId,
}).select('id').single()
const txStale = await attempt(() => api('POST', `/transition-requests/${txReq.id}/approvals`,
  { track: 'Commercial', decision: 'approved' }))
record('a TRANSITION request still goes stale on the same edit',
  txStale.status === 412 && /froze revision/.test(txStale.data?.error ?? ''),
  `-> ${txStale.status} "${String(txStale.data?.error ?? '').slice(0, 58)}"`)
await db.from('track_approvers').delete().eq('id', txSeat.id)

// Teardown: a track_approvers seat is not a record, so the fixture tag cannot
// see it and tearDown() will not remove it.
await db.from('track_approvers').delete().in('id', (fixtureSeats ?? []).map((r) => r.id))

await tearDown()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
for (const f of failed) console.log(`  FAILED: ${f.label}`)
process.exit(failed.length ? 1 : 0)
