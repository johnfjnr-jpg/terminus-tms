// ── THE G2/G3 BLIND-SPOT TABLE, INVERTED ──────────────────────────────────
//
// Round 41, tenth walk. Every event that read "pulse moves: false" must now
// move records.freshness_at, and a pulse READ must move nothing.
//
// The events are driven through the ROUTES where a route exists. An earlier
// version raised a request by raw insert, was refused by the freeze trigger,
// and reported a STILL that was about the insert rather than about the trigger
// under test - a check failing for a reason unrelated to its claim.
import { freshOpportunity, tearDown, admin } from './fixtures.mjs'
import { api } from './api-client.mjs'
import { readFileSync } from 'fs'

const uid = JSON.parse(readFileSync(new URL('../session-ref.json', import.meta.url).pathname, 'utf8')).user.id
const results = []
const record = (label, pass, detail = '') => {
  results.push({ label, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}${detail ? '  ' + detail : ''}`)
}

const { oppId } = await freshOpportunity('R41FRESH')
// Freshness lives OFF the record. 20260902000002: a bump on `records` inherits
// the freeze guard and the append advisory lock, and broke both.
const fresh = async () => (await admin().from('record_freshness')
  .select('freshness_at').eq('record_id', oppId).maybeSingle()).data?.freshness_at

const moves = async (label, fn) => {
  const before = await fresh()
  await new Promise((r) => setTimeout(r, 60))
  // ONLY A STRING IS AN ERROR. The first version treated any returned value as
  // one, so a successful route call - which returns a response object - printed
  // "the write itself failed" beside a PASS. A report that says a write failed
  // when it succeeded is worse than one that says nothing.
  let err = null
  try {
    const r = await fn()
    if (typeof r === 'string') err = r
  } catch (e) { err = e.body?.error ?? String(e).slice(0, 70) }
  const after = await fresh()
  record(label, before !== after, err ? `(the write itself failed: ${String(err).slice(0, 60)})` : '')
}

// THE CONTROL FIRST, so the instrument is shown able to move before any zero is
// read from it.
await moves('control: a payload write moves freshness', async () => {
  const g = await api('GET', `/opportunities/${oppId}`)
  await api('PATCH', `/opportunities/${oppId}`,
    { payload: { targetMargin: 45 }, expected_revision: g.data?.latest_revision_number })
})

// ── WRITTEN DIRECTLY, WHICH IS THE LIKE-FOR-LIKE COMPARISON ──────────────
//
// The G2/G3 blind-spot table was measured with direct writes, so inverting it
// means measuring the same way. It is also the stronger test: a trigger must
// fire for EVERY writer, including a dashboard paste and a route nobody has
// written yet, which is the whole reason this is a trigger and not application
// code.
//
// Routing these through the API instead made two rows fail for a reason
// unrelated to the claim - unmet exit criteria refused the raise, so nothing
// was written and the STILL was about the gate rather than the trigger. That
// is a check reporting on something other than what it names.
// ── THE TWO ROWS THE BLIND-SPOT TABLE NAMED AND NOTHING HAD PROVEN ───────
//
// Raised THROUGH THE ROUTE, because that is the event the poll was blind to and
// because a raw insert was refused by the freeze guard - twice reporting a
// STILL that was about the setup rather than about the trigger. The exit
// criterion is satisfied first so the raise is not refused for an unrelated
// reason.
await api('POST', `/opportunities/${oppId}/assessment-reviewed`, {}).catch(() => {})
const stage = (await admin().from('records').select('status').eq('id', oppId).single()).data?.status
await moves('a transition REQUEST is raised, through the route', () =>
  api('POST', `/records/${oppId}/transition-requests`, { to_stage: 'Solution Alignment' }))

// Qualification exit carries no approval track, so that raise EXECUTES. The one
// that OPENS AND WAITS is Solution Alignment -> Proposal, and its four exit
// fields are satisfied the way a person would rather than worked around. Recipe
// taken from probe-zero-track-transition, which already reaches this state, so
// there are not two ways of getting there.
const cur = (await api('GET', `/opportunities/${oppId}`)).data
await api('PATCH', `/opportunities/${oppId}`, {
  payload: {
    exitSolKeyStakeholders: true, exitSolBuyersKnown: true,
    exitSolTechnicalSolution: true, exitSolTermsReviewed: true,
  },
  expected_revision: cur.latest_revision_number,
})
await api('POST', `/opportunities/${oppId}/assessment-reviewed`, {})
await moves('a three-track REQUEST is raised and WAITS', () =>
  api('POST', `/records/${oppId}/transition-requests`, { to_stage: 'Proposal', kind: 'transition' }))

const { data: openReq } = await admin().from('transition_requests')
  .select('id, from_stage, status').eq('record_id', oppId).eq('status', 'open').maybeSingle()
const req = openReq ?? null
console.log(`  (open request: ${req ? req.id.slice(0, 8) + ' from ' + req.from_stage : 'none'})`)

for (const track of ['Commercial', 'Technical']) {
  await moves(`an APPROVAL lands (${track})`, async () => {
    const { error } = await admin().from('approvals').insert({
      record_id: oppId, request_id: req?.id, revision_number: 1,
      stage: req?.from_stage ?? stage, track, approver_id: uid, decision: 'approved',
      comment: 'freshness calibration', decided_at: new Date().toISOString() })
    return error?.message
  })
}

if (req?.id) {
  // THROUGH THE ROUTE, requester-only, which the fixture owner is.
  await moves('the request is WITHDRAWN, through the route', () =>
    api('POST', `/transition-requests/${req.id}/withdraw`, { reason: 'freshness calibration' }))
} else {
  record('the request is WITHDRAWN, through the route', false,
    '(no open request existed, so this measured nothing rather than passing)')
}

await moves('an AUDIT LOG row', async () => {
  const { error } = await admin().from('audit_log').insert({
    record_id: oppId, record_type: 'opportunity', actor_id: uid,
    action: 'freshness_calibration', detail: {} })
  return error?.message
})

await moves('a DEAL SHEET VERSION row', async () => {
  const { error } = await admin().from('deal_sheet_versions').insert({
    record_id: oppId, major: 0, minor: 99, status: 'draft', revision_number: 1,
    inputs: { targetMargin: 30 }, rates: {}, reason: 'calibration', created_by: uid })
  return error?.message
})

// ── AND A READ MOVES NOTHING. On its OWN record, so a mutation above cannot
// explain the result either way.
const { oppId: quiet } = await freshOpportunity('R41QUIET')
const quietFresh = async () => (await admin().from('record_freshness')
  .select('freshness_at').eq('record_id', quiet).maybeSingle()).data?.freshness_at
const q0 = await quietFresh()
await api('GET', `/records/${quiet}/pulse`)
await api('GET', `/records/${quiet}/pulse`)
await api('GET', `/records/${quiet}/pulse`)
record('three pulse READS move nothing', q0 === await quietFresh(),
  'a SELECT writes nothing, so no trigger fires and the poll cannot fire on itself')

await tearDown()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
for (const f of failed) console.log(`  FAILED: ${f.label}`)
process.exit(failed.length ? 1 : 0)
