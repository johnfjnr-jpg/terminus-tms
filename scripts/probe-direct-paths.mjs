// CAN AN ORDINARY AUTHENTICATED USER BYPASS THE ROUTE?
// anon (publishable) key + a real user's JWT. No Fastify anywhere in this file.
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { supabaseAdmin as admin } from '/Users/johnfryatt/terminus-tms/src/supabase.js'

const session = JSON.parse(readFileSync('/Users/johnfryatt/terminus-tms/session-ref.json', 'utf8'))
const jwt = session.access_token
const claims = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString())
const USER = claims.sub
console.log(`acting as ${claims.email}  (${USER.slice(0, 8)})`)

const user = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, {
  global: { headers: { Authorization: `Bearer ${jwt}` } },
  auth: { persistSession: false, autoRefreshToken: false },
})

// Is this user an approver on anything? The answer frames every result below.
const { data: mine } = await admin.from('track_approvers').select('track').eq('user_id', USER)
console.log(`track_approvers rows for this user: ${mine.length}  -> ${mine.length ? mine.map(m => m.track).join(', ') : 'NONE, so every decision below is one they are not listed for'}\n`)

const RECORD = 'd86369b3-f1a7-4c79-bb50-4d4ac49d42fa'
const { data: rev } = await admin.from('record_revisions').select('revision_number')
  .eq('record_id', RECORD).order('revision_number', { ascending: false }).limit(1).single()

// ── 0. CAN THE USER EVEN RAISE ONE? The raise route runs as the user. ──────
const raise = await user.from('transition_requests').insert({
  record_id: RECORD, record_type: 'opportunity', from_stage: 'Solution Alignment',
  to_stage: 'Proposal', kind: 'review', status: 'open',
  frozen_revision: rev.revision_number, requested_by: USER,
}).select().single()
console.log(`0. INSERT a request as the user        ${raise.error ? 'REFUSED  ' + raise.error.code + ': ' + String(raise.error.message).slice(0, 60) : 'PERMITTED'}`)

// A review request, raised as the SERVICE ROLE so the probes below have one to
// bind to whatever the answer to 0 was. kind='review' so nothing freezes.
const { data: req } = await admin.from('transition_requests').insert({
  record_id: RECORD, record_type: 'opportunity', from_stage: 'Solution Alignment',
  to_stage: 'Proposal', kind: 'review', status: 'open',
  frozen_revision: rev.revision_number, requested_by: USER,   // the caller IS the requester
}).select().single()

let approvalId = null
try {
  // ── a. INSERT an approval bound to that request, self-approving AND on a
  //       track this user is not listed for. Both violations at once.
  const a = await user.from('approvals').insert({
    record_id: RECORD, request_id: req.id, revision_number: rev.revision_number,
    stage: 'Solution Alignment', track: 'Commercial', approver_id: USER,
    decision: 'approved', decided_at: new Date().toISOString(),
  }).select().single()
  approvalId = a.data?.id ?? null
  console.log(`a. INSERT approvals directly           ${a.error ? 'REFUSED  ' + a.error.code : 'PERMITTED  <-- the route is bypassable'}`)

  // ── b. CALL the function directly.
  const b = await user.rpc('decide_transition_request', {
    p_request_id: req.id, p_track: 'Legal', p_approver: USER,
    p_decision: 'approved', p_reason: null, p_required: ['Legal'],
  })
  console.log(`b. RPC decide_transition_request       ${b.error ? 'REFUSED  ' + b.error.code + ': ' + String(b.error.message).slice(0, 60) : 'PERMITTED  <-- the route is bypassable'}`)
  if (!b.error) console.log(`     it returned: ${JSON.stringify(b.data)}`)

  // ── c. And the one that would matter most: approve on someone else's behalf.
  const c = await user.from('approvals').insert({
    record_id: RECORD, request_id: req.id, revision_number: rev.revision_number,
    stage: 'Solution Alignment', track: 'Technical',
    approver_id: '75425a02-4750-470b-bcdc-fe83d0b01ac2',
    decision: 'approved', decided_at: new Date().toISOString(),
  })
  console.log(`c. INSERT an approval AS JOHN          ${c.error ? 'REFUSED  ' + c.error.code : 'PERMITTED  <-- impersonation'}`)
} finally {
  await admin.from('approvals').delete().eq('request_id', req.id)
  await admin.from('transition_requests').delete().eq('id', req.id)
  if (raise.data) await admin.from('transition_requests').delete().eq('id', raise.data.id)
  const { data: left } = await admin.from('transition_requests').select('id').eq('record_id', RECORD).eq('status', 'open')
  const { data: ap } = await admin.from('approvals').select('id').eq('record_id', RECORD)
  console.log(`\ncleanup: open requests on the record ${left.length}, approvals ${ap.length} (five is correct)`)
}
