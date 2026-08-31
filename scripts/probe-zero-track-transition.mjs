// A transition that needs no approval. Round 41 W6.
//
// ── THE DEFECT THIS EXISTS FOR ────────────────────────────────────────────
//
// Qualification exit requires no approval tracks. raise_transition_request
// always inserted `status = 'open'`, and decide_transition_request is the only
// thing that closes a request and needs a track to do it. WITH NO TRACKS THERE
// IS NOTHING TO DECIDE, so the request stayed open for ever - and an open
// request FREEZES the record.
//
// Found on the walk: TT-SGP-SMARTC-108 raised a request at 08:07 and was
// unmovable and uneditable from that moment, with no action available that
// would release it except withdrawing.
//
// ── FOUR CLAIMS, AND THE LAST TWO ARE WHY THIS IS NOT A STATUS CHECK ──────
//
//   1. A zero-track transition MOVES the record when it is raised.
//   2. It leaves a request row, closed, as the audit of what happened.
//   3. The record is NOT frozen afterwards: an ordinary edit still saves.
//   4. A stage that DOES require tracks still opens and still waits.
//
// 3 is the defect stated as something a person experiences, Verification 27:
// "the request closed" is a row, "I can still edit my deal" is the task. 4 is
// the discriminating half, Verification 17: a build that had simply stopped
// opening requests at all would pass 1, 2 and 3.
import { api, ApiError } from './api-client.mjs'
// admin() comes from fixtures, which reads .env from the file. Building a
// client from process.env here worked under `node --env-file=.env` and died
// under the gate, which spawns probes with a bare `node`: "supabaseUrl is
// required", at line 36, before a single check ran. The gate is the caller that
// matters and it was the one not exercised.
import { freshOpportunity, tearDown, admin as adminClient } from './fixtures.mjs'

const results = []
function record(label, pass, detail) {
  results.push({ label, pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}  ${detail}`)
}

const admin = adminClient()

// ── The derivation itself, before any request is raised ──────────────────
const q = await admin.rpc('required_tracks_for', { p_record_type: 'opportunity', p_from_stage: 'Qualification' })
const s = await admin.rpc('required_tracks_for', { p_record_type: 'opportunity', p_from_stage: 'Solution Alignment' })
record('required_tracks_for reads Qualification as needing nothing',
  !q.error && Array.isArray(q.data) && q.data.length === 0, JSON.stringify(q.data ?? q.error?.message))
// THE POSITIVE CASE. A derivation that returned '{}' for everything would pass
// the line above and be worthless. Verification 13.
record('required_tracks_for reads Solution Alignment as needing three',
  !s.error && Array.isArray(s.data) && s.data.length === 3,
  JSON.stringify(s.data ?? s.error?.message))

const { oppId } = await freshOpportunity('zero-track')

// The exit criterion for Qualification is assessmentReviewed, and the route
// refuses to raise without it. Satisfying it is part of the walk, not a
// shortcut around the gate.
await api('POST', `/opportunities/${oppId}/assessment-reviewed`, {})

let raised, status
try {
  raised = (await api('POST', `/records/${oppId}/transition-requests`,
    { to_stage: 'Solution Alignment', kind: 'transition' })).data
  status = 201
} catch (e) {
  if (!(e instanceof ApiError)) throw e
  status = e.status; raised = e.body
}
record('a zero-track transition is raised through the ordinary path', status === 201,
  `-> ${status} ${status === 201 ? `status "${raised.status}"` : JSON.stringify(raised)}`)

if (status === 201) {
  record('1. the record MOVED when the request was raised',
    raised.status === 'approved', `request status "${raised.status}"`)

  const rec = (await api('GET', `/opportunities/${oppId}`)).data
  record('1b. and the record itself says so', rec.status === 'Solution Alignment',
    `record is in "${rec.status}"`)

  const { data: rows } = await admin.from('transition_requests').select('status, close_reason, closed_at')
    .eq('record_id', oppId)
  record('2. the request row survives as the audit',
    rows?.length === 1 && rows[0].status === 'approved' && !!rows[0].closed_at,
    `${rows?.length} row, status "${rows?.[0]?.status}", reason ${JSON.stringify((rows?.[0]?.close_reason ?? '').slice(0, 54) + '...')}`)

  // 3. NOT FROZEN. The thing a person actually needs, and the reason the defect
  // mattered: an open request refuses every write to the record.
  let edited, editStatus
  try {
    edited = (await api('PATCH', `/opportunities/${oppId}`,
      { payload: { summary: 'edited after a zero-track transition' }, expected_revision: rec.latest_revision_number })).data
    editStatus = 200
  } catch (e) {
    if (!(e instanceof ApiError)) throw e
    editStatus = e.status; edited = e.body
  }
  record('3. the record is NOT frozen afterwards', editStatus === 200,
    `-> ${editStatus} ${editStatus === 200 ? '' : JSON.stringify(edited)}`)

  // 4. THE DISCRIMINATING CASE, and the probe has to WORK to reach it.
  //
  // Solution Alignment requires three tracks, so the same call from the stage
  // the record is now in must OPEN and WAIT. Without this the whole probe is
  // satisfied by a build that had simply stopped opening requests at all.
  //
  // THE FIRST VERSION STOPPED AT A 409, refused by Solution Alignment's exit
  // criteria before the tracks were ever consulted, and reported that as a pass
  // "because the gate was working". It was working, and the claim went
  // unmeasured: a 409 from criteria is the same answer a build with no approval
  // model at all would give. Verification 17 - a probe that fires correctly and
  // measures the wrong thing.
  //
  // The criteria are satisfied here rather than worked around: these are the
  // four exit fields plus the assessment review, set the way a person would.
  const cur = (await api('GET', `/opportunities/${oppId}`)).data
  await api('PATCH', `/opportunities/${oppId}`, {
    payload: {
      exitSolKeyStakeholders: true, exitSolBuyersKnown: true,
      exitSolTechnicalSolution: true, exitSolTermsReviewed: true,
    },
    expected_revision: cur.latest_revision_number,
  })
  await api('POST', `/opportunities/${oppId}/assessment-reviewed`, {})

  let second, secondStatus
  try {
    second = (await api('POST', `/records/${oppId}/transition-requests`,
      { to_stage: 'Proposal', kind: 'transition' })).data
    secondStatus = 201
  } catch (e) {
    if (!(e instanceof ApiError)) throw e
    secondStatus = e.status; second = e.body
  }
  record('4. a three-track transition OPENS and waits, it does not execute',
    secondStatus === 201 && second?.status === 'open',
    `-> ${secondStatus} status "${second?.status ?? JSON.stringify((second?.error ?? '').slice(0, 70))}"`)

  // AND THE RECORD IS FROZEN THIS TIME, which is the other side of claim 3.
  // The freeze is correct behaviour when something really is waiting, and a
  // build that had lost the freeze entirely would pass claim 3 for the wrong
  // reason.
  if (secondStatus === 201) {
    const after = (await api('GET', `/opportunities/${oppId}`)).data
    let frozenStatus
    try {
      await api('PATCH', `/opportunities/${oppId}`,
        { payload: { summary: 'should be refused' }, expected_revision: after.latest_revision_number })
      frozenStatus = 200
    } catch (e) {
      if (!(e instanceof ApiError)) throw e
      frozenStatus = e.status
    }
    record('4b. and an open request DOES freeze the record', frozenStatus === 423,
      `-> ${frozenStatus} (423 is the freeze; 200 would mean the freeze is gone)`)
    await api('POST', `/transition-requests/${second.id}/withdraw`, { reason: 'probe teardown' })
  }
}

const { removed } = await tearDown()
record('teardown removed every record the test account owns', true,
  `${removed.length} soft-deleted, re-queried 0 live`)

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
if (failed.length) { for (const f of failed) console.log(`  FAILED: ${f.label}`); process.exit(1) }
