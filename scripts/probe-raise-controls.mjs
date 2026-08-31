#!/usr/bin/env node
// MIGRATION 5's CALIBRATION. Round 41.
//
// Four claims: a direct insert is refused, the raise function DERIVES the values
// it no longer accepts, a request that does not describe the record is refused
// at execution, and a genuine request still executes.
//
// The last one moves a real record's stage and puts it back. It is the only way
// to show the execution path working, and a control nobody has watched execute
// is an assertion.
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { supabaseAdmin as admin } from '../src/supabase.js'

const session = JSON.parse(readFileSync(new URL('../session-ref.json', import.meta.url), 'utf8'))
const jwt = session.access_token
const claims = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString())
const USER = claims.sub
const JOHN = '75425a02-4750-470b-bcdc-fe83d0b01ac2'
const RECORD = process.env.PROBE_RECORD ?? '24d42569-1b0b-4378-aae9-e3aadaea876e'

const user = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, {
  global: { headers: { Authorization: `Bearer ${jwt}` } },
  auth: { persistSession: false, autoRefreshToken: false },
})

const results = []
const check = (label, ok, detail = '') => {
  results.push({ label, ok })
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(58)} ${detail}`)
}

const { data: rec } = await admin.from('records').select('id, status, record_type').eq('id', RECORD).single()
const { data: rev } = await admin.from('record_revisions').select('revision_number')
  .eq('record_id', RECORD).order('revision_number', { ascending: false }).limit(1).single()
console.log(`record ${RECORD.slice(0, 8)}, stage ${rec.status}, revision ${rev.revision_number}`)
console.log(`acting as ${claims.email}\n`)

const made = []
const grants = []
const startingStage = rec.status
try {
  // ── 1. A DIRECT INSERT IS REFUSED ───────────────────────────────────────
  const direct = await user.from('transition_requests').insert({
    record_id: RECORD, record_type: 'opportunity', from_stage: rec.status,
    to_stage: 'Proposal', kind: 'review', status: 'open',
    frozen_revision: rev.revision_number, requested_by: USER,
  }).select().single()
  if (direct.data) made.push(direct.data.id)
  check('1. direct INSERT into transition_requests', !!direct.error,
    direct.error ? `REFUSED ${direct.error.code}` : 'PERMITTED')

  // ── 2. THE FUNCTION DERIVES WHAT IT NO LONGER ACCEPTS ───────────────────
  const raised = await user.rpc('raise_transition_request', {
    p_record_id: RECORD, p_to_stage: 'Proposal', p_kind: 'review', p_frozen_version_id: null,
  })
  if (raised.data) made.push(raised.data.id)
  const derived = !raised.error
    && raised.data.from_stage === rec.status
    && raised.data.frozen_revision === rev.revision_number
    && raised.data.record_type === rec.record_type
    && raised.data.requested_by === USER
  check('2. raise via the function derives stage, revision, type, requester', derived,
    raised.error ? `REFUSED ${raised.error.code}` : `from_stage=${raised.data.from_stage} rev=${raised.data.frozen_revision}`)

  // ── 3. A REQUEST THAT DOES NOT DESCRIBE THE RECORD IS REFUSED ───────────
  //
  // Inserted AS THE SERVICE ROLE, which is the only way to make one now: a
  // policy does not bind BYPASSRLS. That is precisely the case PT412 exists for,
  // and it is why the check lives in the function rather than in the policy.
  const { data: liar } = await admin.from('transition_requests').insert({
    record_id: RECORD, record_type: 'opportunity',
    from_stage: 'Negotiating',                       // the record is not in Negotiating
    to_stage: 'Closed Won', kind: 'transition', status: 'open',
    frozen_revision: rev.revision_number, requested_by: JOHN,
  }).select().single()
  made.push(liar.id)

  const { data: g1 } = await admin.from('track_approvers')
    .insert({ record_type: 'opportunity', track: 'Legal', record_id: null, user_id: USER }).select().single()
  grants.push(g1.id)

  const stale = await user.rpc('decide_transition_request', {
    p_request_id: liar.id, p_track: 'Legal', p_decision: 'approved',
    p_reason: null, p_required: ['Legal'],
  })
  check('3. decide a request whose from_stage is a lie', stale.error?.code === 'PT412',
    stale.error ? `REFUSED ${stale.error.code}` : 'PERMITTED  <-- a fabricated request executed')
  await admin.from('transition_requests').update({
    status: 'withdrawn', closed_by: JOHN, closed_at: new Date().toISOString(),
    close_reason: 'calibration',
  }).eq('id', liar.id)

  // ── 4. A GENUINE REQUEST STILL EXECUTES ─────────────────────────────────
  //
  // AND IT DEMONSTRATES THE RESIDUAL IN THE SAME BREATH: this request was
  // inserted by the service role and never went near computeBlocking, and it
  // executes anyway. That is the gap the criteria display resolves.
  const { data: real } = await admin.from('transition_requests').insert({
    record_id: RECORD, record_type: 'opportunity', from_stage: rec.status,
    to_stage: 'Proposal', kind: 'transition', status: 'open',
    frozen_revision: rev.revision_number, requested_by: JOHN,
  }).select().single()
  made.push(real.id)

  for (const track of ['Commercial', 'Technical']) {
    const { data: g } = await admin.from('track_approvers')
      .insert({ record_type: 'opportunity', track, record_id: null, user_id: USER }).select().single()
    grants.push(g.id)
  }

  const required = ['Commercial', 'Legal', 'Technical']
  let last = null
  for (const track of required) {
    last = await user.rpc('decide_transition_request', {
      p_request_id: real.id, p_track: track, p_decision: 'approved',
      p_reason: null, p_required: required,
    })
    if (last.error) break
    console.log(`       ${track} approved, outstanding: ${JSON.stringify(last.data.outstanding)}, transitioned: ${last.data.transitioned}`)
  }
  const { data: after } = await admin.from('records').select('status').eq('id', RECORD).single()
  const moved = !last.error && last.data.transitioned === true && after.status === 'Proposal'
  check('4. three approvals execute the transition', moved,
    last.error ? `REFUSED ${last.error.code}: ${String(last.error.message).slice(0, 50)}` : `record is now ${after.status}`)
} finally {
  await admin.from('records').update({ status: startingStage }).eq('id', RECORD)
  for (const id of grants) await admin.from('track_approvers').delete().eq('id', id)
  for (const id of made) {
    await admin.from('approvals').delete().eq('request_id', id)
    await admin.from('transition_requests').delete().eq('id', id)
  }
  const { data: back } = await admin.from('records').select('status').eq('id', RECORD).single()
  const { data: open } = await admin.from('transition_requests').select('id').eq('status', 'open')
  const { data: ta } = await admin.from('track_approvers').select('id')
  console.log(`\ncleanup: record back to ${back.status} (${startingStage} is correct), OPEN requests ${open.length}, track_approvers ${ta.length} (three is correct)`)
}

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
if (failed.length) process.exit(1)
