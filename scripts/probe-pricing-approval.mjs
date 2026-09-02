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
import { api, ApiError } from './api-client.mjs'
import { catalogToRates } from '../src/lib/base-costs.js'
import { resolveRates, frozenRates } from '../src/lib/rate-resolution.js'

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

await tearDown()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
for (const f of failed) console.log(`  FAILED: ${f.label}`)
process.exit(failed.length ? 1 : 0)
