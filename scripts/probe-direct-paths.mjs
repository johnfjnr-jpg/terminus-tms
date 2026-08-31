#!/usr/bin/env node
// CAN AN ORDINARY AUTHENTICATED USER BYPASS THE ROUTE? Round 41.
//
// The publishable key plus a real user's JWT, and NO FASTIFY anywhere in this
// file. That is the whole point: a route guard is a declared policy, and the
// only way to know whether it is an enforcement is to go around it.
//
// Run before migration 4, (a) and (b) were PERMITTED: an ordinary user could
// self-approve on a track they held no role on. This is the same probe, and it
// is also the calibration of the fix.
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { supabaseAdmin as admin } from '../src/supabase.js'

const session = JSON.parse(readFileSync(new URL('../session-ref.json', import.meta.url), 'utf8'))
const jwt = session.access_token
const claims = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString())
const USER = claims.sub
const JOHN = '75425a02-4750-470b-bcdc-fe83d0b01ac2'
const RECORD = 'd86369b3-f1a7-4c79-bb50-4d4ac49d42fa'

const user = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, {
  global: { headers: { Authorization: `Bearer ${jwt}` } },
  auth: { persistSession: false, autoRefreshToken: false },
})

console.log(`acting as ${claims.email} (${USER.slice(0, 8)}), who is not John (${JOHN.slice(0, 8)})\n`)

const results = []
const check = (label, want, err, extra = '') => {
  const got = err ? `REFUSED ${err.code}` : 'PERMITTED'
  const pass = want === 'REFUSED' ? !!err : !err
  results.push({ label, pass })
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${label.padEnd(56)} want ${want.padEnd(9)} got ${got}${extra}`)
}

const { data: rev } = await admin.from('record_revisions').select('revision_number')
  .eq('record_id', RECORD).order('revision_number', { ascending: false }).limit(1).single()

const openReview = async (requestedBy) => {
  const { data, error } = await admin.from('transition_requests').insert({
    record_id: RECORD, record_type: 'opportunity', from_stage: 'Solution Alignment',
    to_stage: 'Proposal', kind: 'review', status: 'open',
    frozen_revision: rev.revision_number, requested_by: requestedBy,
  }).select().single()
  if (error) throw new Error('could not open a review request: ' + error.message)
  return data
}

const made = []
let tempApprover = null
try {
  // ── 0. THE FIX: a user must be able to raise one in their own name ───────
  const mine = await user.from('transition_requests').insert({
    record_id: RECORD, record_type: 'opportunity', from_stage: 'Solution Alignment',
    to_stage: 'Proposal', kind: 'review', status: 'open',
    frozen_revision: rev.revision_number, requested_by: USER,
  }).select().single()
  if (mine.data) made.push(mine.data.id)
  check('0. raise a request in your OWN name', 'PERMITTED', mine.error)

  const asSomeoneElse = await user.from('transition_requests').insert({
    record_id: RECORD, record_type: 'opportunity', from_stage: 'Solution Alignment',
    to_stage: 'Proposal', kind: 'review', status: 'open',
    frozen_revision: rev.revision_number, requested_by: JOHN,
  }).select().single()
  if (asSomeoneElse.data) made.push(asSomeoneElse.data.id)
  check("0b. raise a request in SOMEONE ELSE'S name", 'REFUSED', asSomeoneElse.error)

  const johns = await openReview(JOHN)
  made.push(johns.id)

  // ── a. DIRECT approvals insert, bound to an open request ────────────────
  const a = await user.from('approvals').insert({
    record_id: RECORD, request_id: johns.id, revision_number: rev.revision_number,
    stage: 'Solution Alignment', track: 'Commercial', approver_id: USER,
    decision: 'approved', decided_at: new Date().toISOString(),
  }).select().single()
  check('a. INSERT a request-bound approval directly', 'REFUSED', a.error)
  if (a.data) await admin.from('approvals').delete().eq('id', a.data.id)

  // ── b. THE FUNCTION, as somebody with no role on the track ──────────────
  const b = await user.rpc('decide_transition_request', {
    p_request_id: johns.id, p_track: 'Legal', p_decision: 'approved',
    p_reason: null, p_required: ['Legal'],
  })
  check('b. RPC on a track you hold no role on', 'REFUSED', b.error,
    b.error?.code === 'PT403' ? '  <- the function\'s own check' : '')

  // ── c. IMPERSONATION ────────────────────────────────────────────────────
  const c = await user.from('approvals').insert({
    record_id: RECORD, request_id: null, revision_number: rev.revision_number,
    stage: 'Solution Alignment', track: 'Technical', approver_id: JOHN,
    decision: 'approved', decided_at: new Date().toISOString(),
  }).select().single()
  check('c. INSERT an approval AS SOMEBODY ELSE', 'REFUSED', c.error)
  if (c.data) await admin.from('approvals').delete().eq('id', c.data.id)

  // ── d. SELF-APPROVAL THROUGH THE FUNCTION, by a REAL approver ───────────
  //
  // The case the function's check exists for, and it cannot be tested without
  // making the caller a genuine approver first: refusing somebody who holds no
  // role proves the track rule, not the self-approval rule.
  const { data: temp } = await admin.from('track_approvers').insert({
    record_type: 'opportunity', track: 'Legal', record_id: null, user_id: USER,
  }).select().single()
  tempApprover = temp.id

  const own = await openReview(USER)
  made.push(own.id)
  const d = await user.rpc('decide_transition_request', {
    p_request_id: own.id, p_track: 'Legal', p_decision: 'approved',
    p_reason: null, p_required: ['Legal'],
  })
  check('d. RPC on YOUR OWN request, as a real approver', 'REFUSED', d.error,
    d.error?.code === 'PT403' ? '  <- the self-approval rule' : '')

  // ── e. AND THE POSITIVE CASE, or the four above prove only an outage ────
  const e = await user.rpc('decide_transition_request', {
    p_request_id: johns.id, p_track: 'Legal', p_decision: 'approved',
    p_reason: null, p_required: ['Legal'],
  })
  check("e. RPC on SOMEONE ELSE'S request, as a real approver", 'PERMITTED', e.error)
  if (!e.error) console.log(`       returned: ${JSON.stringify(e.data)}`)
} finally {
  if (tempApprover) await admin.from('track_approvers').delete().eq('id', tempApprover)
  for (const id of made) {
    await admin.from('approvals').delete().eq('request_id', id)
    await admin.from('transition_requests').delete().eq('id', id)
  }
  // OPEN is the number that matters. Closed rows are the audit trail and are
  // supposed to accumulate; counting them all reads as residue when it is not.
  const { data: open } = await admin.from('transition_requests').select('id').eq('status', 'open')
  const { data: ap } = await admin.from('approvals').select('id').eq('record_id', RECORD)
  const { data: ta } = await admin.from('track_approvers').select('id')
  console.log(`\ncleanup: OPEN transition requests ${open.length} (zero is correct), approvals on the record ${ap.length} (five is correct), track_approvers ${ta.length} (three is correct)`)
}

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
if (failed.length) { console.log('FAILED:', failed.map((f) => f.label).join(' | ')); process.exit(1) }
