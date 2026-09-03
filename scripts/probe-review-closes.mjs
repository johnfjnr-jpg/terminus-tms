// ── A PRICING APPROVAL CLOSES, BY BOTH ROUTES IT CAN CLOSE BY ────────────
//
// W2, 2026-09-03. The walk saw "V1 is waiting on approval" on a record whose V1
// had every track approved and whose pricing had reached V3, and refreshing did
// not clear it. Not a stale read: the row WAS open.
//
// TWO INDEPENDENT CAUSES, and either alone reproduces the stuck banner, so both
// are exercised separately here rather than in one end-to-end sequence.
import { freshOpportunity, tearDown, admin } from './fixtures.mjs'
import { api, ApiError } from './api-client.mjs'
import { catalogToRates } from '../src/lib/base-costs.js'
import { resolveRates, frozenRates } from '../src/lib/rate-resolution.js'
import { readFileSync } from 'fs'

const results = []
const record = (label, pass, detail = '') => {
  results.push({ label, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}${detail ? '  ' + detail : ''}`)
}
const attempt = async (fn) => {
  try { const r = await fn(); return { status: r.status ?? 201, data: r.data ?? r } }
  catch (e) { if (!(e instanceof ApiError)) throw e; return { status: e.status, data: e.body } }
}

const session = JSON.parse(readFileSync('session-ref.json', 'utf8'))
const db = admin()
const TAG = process.argv[2] ?? 'R41CLOSE'
const LIVE = catalogToRates((await api('GET', '/base-costs')).data?.products ?? []).rates
const priced = (i) => frozenRates(resolveRates(i, LIVE))
const INPUTS = { targetMargin: 30, ssNew: 10, duration: 36 }

const { data: allSeats, error: sErr } = await db.from('track_approvers')
  .select('user_id').eq('record_type', 'opportunity')
if (sErr) throw sErr
const otherUser = (allSeats ?? []).map((r) => r.user_id).find((u) => u !== session.user.id)
if (!otherUser) throw new Error('no second identity in track_approvers')

const reqStatus = async (id) => {
  const { data, error } = await db.from('transition_requests')
    .select('status, close_reason').eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

// A record at Proposal with an ISSUED V1 and an open review on it.
const setUp = async (tag) => {
  const { oppId } = await freshOpportunity(tag)
  const rev = async () => (await api('GET', `/opportunities/${oppId}`)).data?.latest_revision_number
  const draft = (await api('POST', `/opportunities/${oppId}/deal-sheet-versions`,
    { inputs: INPUTS, rates: priced(INPUTS), reason: 'W2 probe', expected_revision: await rev() })).data
  const v1 = (await api('POST', `/deal-sheet-versions/${draft.id}/issue`, {})).data
  const { error: uErr } = await db.from('records').update({ status: 'Proposal' }).eq('id', oppId)
  if (uErr) throw uErr
  const raised = await attempt(() => api('POST', `/records/${oppId}/transition-requests`,
    { to_stage: 'Evaluation', kind: 'review', version_id: v1.id }))
  if (raised.status !== 201) throw new Error(`could not raise the review: ${raised.status} ${JSON.stringify(raised.data)}`)
  // The session user must not be the requester, and must hold every track.
  const { error: fErr } = await db.from('transition_requests')
    .update({ requested_by: otherUser }).eq('id', raised.data.id)
  if (fErr) throw fErr
  const { data: seats, error: e2 } = await db.from('track_approvers').insert(
    ['Commercial', 'Legal', 'Technical'].map((track) => ({
      record_type: 'opportunity', track, user_id: session.user.id, record_id: oppId,
    }))).select('id')
  if (e2) throw e2
  return { oppId, v1, reqId: raised.data.id, seatIds: (seats ?? []).map((r) => r.id), rev }
}

// ── CAUSE 1: THE LAST TRACK CLOSES IT ────────────────────────────────────
const a = await setUp(`${TAG}A`)
const tracks = ['Commercial', 'Legal', 'Technical']
let midStatus = null
for (let i = 0; i < tracks.length; i++) {
  const r = await attempt(() => api('POST', `/transition-requests/${a.reqId}/approvals`,
    { track: tracks[i], decision: 'approved' }))
  if (r.status !== 200 && r.status !== 201) throw new Error(`approve ${tracks[i]} -> ${r.status} ${JSON.stringify(r.data)}`)
  if (i === 1) midStatus = (await reqStatus(a.reqId))?.status
}
record('a review stays OPEN while a track is still outstanding',
  midStatus === 'open', `after two of three: "${midStatus}"`)

const closed = await reqStatus(a.reqId)
record('the LAST track approving CLOSES the review as approved',
  closed?.status === 'approved', `status "${closed?.status}"`)

const { data: recA, error: rAerr } = await db.from('records').select('status').eq('id', a.oppId).maybeSingle()
if (rAerr) throw rAerr
record('and it does NOT transition the record (ruling B)',
  recA.status === 'Proposal', `record still "${recA.status}"`)

const { data: standing, error: stErr } = await db.from('approvals')
  .select('track').eq('request_id', a.reqId).eq('decision', 'approved')
if (stErr) throw stErr
record('the approvals STAND as the sign-off after the close',
  (standing ?? []).length === 3, `${(standing ?? []).length} approvals kept`)

const openAfter = ((await api('GET', `/records/${a.oppId}/transition-requests`)).data ?? [])
  .filter((r) => r.kind === 'review' && r.status === 'open')
record('the banner has nothing to show: no OPEN review remains',
  openAfter.length === 0, `${openAfter.length} open review(s)`)

// ── CAUSE 2: ISSUING V2 SUPERSEDES V1'S OPEN REVIEW ──────────────────────
const b = await setUp(`${TAG}B`)
const beforeIssue = await reqStatus(b.reqId)
record('V1\'s review is open before V2 is issued', beforeIssue?.status === 'open', `"${beforeIssue?.status}"`)

const draft2 = (await api('POST', `/opportunities/${b.oppId}/deal-sheet-versions`,
  { inputs: { ...INPUTS, targetMargin: 32 }, rates: priced({ ...INPUTS, targetMargin: 32 }),
    reason: 'W2 probe: a new price', expected_revision: await b.rev() })).data
const v2 = (await api('POST', `/deal-sheet-versions/${draft2.id}/issue`, {})).data
record('V2 issues as a new major', v2?.major === b.v1.major + 1, `V${b.v1.major} -> V${v2?.major}`)

const afterIssue = await reqStatus(b.reqId)
record('issuing V2 CLOSES V1\'s open review',
  afterIssue?.status !== 'open',
  `"${afterIssue?.status}" - "${String(afterIssue?.close_reason ?? '').slice(0, 54)}"`)

const openB = ((await api('GET', `/records/${b.oppId}/transition-requests`)).data ?? [])
  .filter((r) => r.kind === 'review' && r.status === 'open')
record('so the banner clears, and V2 can have its own request',
  openB.length === 0, `${openB.length} open review(s)`)

const fresh = await attempt(() => api('POST', `/records/${b.oppId}/transition-requests`,
  { to_stage: 'Evaluation', kind: 'review', version_id: v2.id }))
record('V2 gets a fresh request of its own', fresh.status === 201,
  `-> ${fresh.status} ${String(fresh.data?.error ?? '').slice(0, 48)}`)

for (const s of [a, b]) {
  const { error } = await db.from('track_approvers').delete().in('id', s.seatIds)
  if (error) throw error
}
await tearDown()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
for (const f of failed) console.log(`  FAILED: ${f.label}`)
process.exit(failed.length ? 1 : 0)
