#!/usr/bin/env node
// THE FIVE-WAY CALIBRATION of the freeze trigger. Round 41.
//
// CLAUDE.md Verification 9: a detector that has never fired is an assertion, not
// a control. The freeze is the whole enforcement of the stage approvals model,
// so it is shown refusing what it must refuse AND permitting what it must
// permit, on the real tables, AS THE SERVICE ROLE.
//
// THE SERVICE ROLE IS THE POINT. 20260827000007 measured that a USING (false)
// policy refuses the application and nothing else, because Postgres exempts
// BYPASSRLS roles from every policy. If this script ran as the application it
// would prove the weaker thing.
//
// It freezes a real record for a few seconds and unfreezes it in a finally
// block, then re-queries to confirm. Nothing is left behind.
import { supabaseAdmin as db } from '../src/supabase.js'

const RECORD = process.env.CAL_RECORD ?? '24d42569-1b0b-4378-aae9-e3aadaea876e'
const JOHN = '75425a02-4750-470b-bcdc-fe83d0b01ac2'

const results = []
const note = (name, expected, err, extra = '') => {
  const code = err?.code ?? null
  const got = err ? `${code}: ${String(err.message).slice(0, 70)}` : 'permitted'
  const pass = expected === 'PT423' ? code === 'PT423' : !err
  results.push({ name, expected, got, pass })
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name.padEnd(52)} expected ${expected.padEnd(10)} got ${got}${extra}`)
}

const { data: rec } = await db.from('records').select('id, record_type, status, owner_id').eq('id', RECORD).single()
const { data: rev } = await db.from('record_revisions').select('revision_number, payload')
  .eq('record_id', RECORD).order('revision_number', { ascending: false }).limit(1).single()
console.log(`calibrating on ${rec.record_type} ${RECORD.slice(0, 8)}, stage ${rec.status}, revision ${rev.revision_number}\n`)

let requestId = null
try {
  // ── FREEZE ──────────────────────────────────────────────────────────────
  const { data: req, error: reqErr } = await db.from('transition_requests').insert({
    record_id: RECORD, record_type: rec.record_type,
    from_stage: rec.status, to_stage: 'Proposal',
    kind: 'transition', status: 'open',
    frozen_revision: rev.revision_number, requested_by: JOHN,
  }).select().single()
  if (reqErr) throw new Error('could not open a request: ' + reqErr.message)
  requestId = req.id
  console.log('  request opened, record is frozen\n')

  // ── 1. record_revisions, the ordinary payload write ─────────────────────
  const r1 = await db.from('record_revisions').insert({
    record_id: RECORD, revision_number: rev.revision_number + 1,
    payload: rev.payload, created_by: JOHN,
  })
  note('record_revisions insert', 'PT423', r1.error)

  // ── 2. opportunity_details ──────────────────────────────────────────────
  const r2 = await db.from('opportunity_details')
    .update({ probability_pct: 21 }).eq('record_id', RECORD)
  note('opportunity_details update', 'PT423', r2.error)

  // ── 3. records, the status change close-lost would make ─────────────────
  //    THE CORRECTION-2 CASE. `records` has no record_id column, and the first
  //    draft of the resolver would have permitted this.
  const r3 = await db.from('records').update({ status: 'Proposal' }).eq('id', RECORD)
  note('records status update  [correction 2]', 'PT423', r3.error)

  // ── 4. record_contact_stances ───────────────────────────────────────────
  //    THE CORRECTION-1 CASE. It reaches its record two joins away, and the
  //    first draft would have permitted this too.
  const { data: link } = await db.from('record_contacts').select('id').eq('record_id', RECORD).limit(1).maybeSingle()
  if (link) {
    const { data: st } = await db.from('contact_stances').select('id').limit(1).single()
    const r4 = await db.from('record_contact_stances').insert({
      record_contact_id: link.id, stance_id: st.id, note: 'calibration', created_by: JOHN,
    })
    note('record_contact_stances insert  [correction 1]', 'PT423', r4.error)
  } else {
    results.push({ name: 'record_contact_stances insert', expected: 'PT423', got: 'NO FIXTURE', pass: false })
    console.log('  SKIP  record_contact_stances: this record has no linked contact to hang a stance on')
  }

  // ── 5. approvals, WHICH MUST BE PERMITTED ───────────────────────────────
  //    The half that makes the other four mean something: a freeze that refuses
  //    everything is not a freeze, it is an outage.
  const r5 = await db.from('approvals').insert({
    record_id: RECORD, request_id: requestId, revision_number: rev.revision_number,
    track: 'Commercial', approver_id: JOHN, decision: 'approved',
    stage: rec.status, decided_at: new Date().toISOString(),
  }).select().single()
  note('approvals insert MUST BE PERMITTED', 'permitted', r5.error)
  if (r5.data) await db.from('approvals').delete().eq('id', r5.data.id)

  // ── 6. the partial unique index ─────────────────────────────────────────
  const r6 = await db.from('transition_requests').insert({
    record_id: RECORD, record_type: rec.record_type, from_stage: rec.status,
    to_stage: 'Evaluation', kind: 'transition', status: 'open',
    frozen_revision: rev.revision_number, requested_by: JOHN,
  })
  const dup = r6.error?.code === '23505'
  results.push({ name: 'a second open request', expected: '23505', got: r6.error?.code ?? 'permitted', pass: dup })
  console.log(`  ${dup ? 'PASS' : 'FAIL'}  ${'a second open request'.padEnd(52)} expected 23505      got ${r6.error?.code ?? 'PERMITTED'}`)
} finally {
  if (requestId) {
    const { error } = await db.from('transition_requests').update({
      status: 'withdrawn', closed_by: JOHN, closed_at: new Date().toISOString(),
      close_reason: 'freeze calibration, withdrawn immediately',
    }).eq('id', requestId)
    if (error) console.log('\n  !! COULD NOT UNFREEZE:', error.message)
  }
}

// ── AND CONFIRM THE UNFREEZE, by re-querying rather than by trusting the update
const { data: open } = await db.from('transition_requests')
  .select('id').eq('record_id', RECORD).eq('status', 'open').eq('kind', 'transition')
console.log(`\n  open transition requests on this record after cleanup: ${open?.length ?? '?'}`)
const after = await db.from('opportunity_details').update({ probability_pct: 20 }).eq('record_id', RECORD)
console.log(`  a write after the withdrawal: ${after.error ? 'REFUSED ' + after.error.code : 'permitted'}`)

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} calibrations passed`)
if (failed.length) { console.log('FAILED:', failed.map((f) => f.name).join(', ')); process.exit(1) }

// ── MIGRATION 2's OWN CALIBRATION, run with CAL_MIGRATION2=1 ───────────────
//
// Migration 1's defect: the pre-workflow uniqueness still governed request-bound
// approvals, so on a record already carrying an approval at the frozen revision
// the FIRST approval through a request was refused with the walk's own error
// message. Migration 2 scopes that uniqueness to `request_id is null`.
//
// The calibration is the collision itself: freeze the record whose revision 34
// already has a Commercial approval, approve Commercial through the request, and
// watch it be PERMITTED where it was refused.
