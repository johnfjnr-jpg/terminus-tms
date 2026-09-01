// Round 18A Phase 3 - the ownership boundary, exercised as two real users.
// Runs under `npm run test:db`.
//
// WHY THIS FILE EXISTS. The business reported that editing the Summary on a
// Test Bed they could see failed with "new row violates row-level security
// policy for table record_revisions". The suite had reported green roughly
// fifty times across two rounds while that was true, and it could not have
// reported anything else: every database-backed test before this one runs
// through adminClient(), which holds the service key and bypasses row-level
// security completely. A client that never meets a policy cannot tell you
// whether the policy is right. This file is the first thing in the project
// that acts as a user.
//
// WHAT IT PINS. Reads are team-wide and writes are owner-only, and that
// asymmetry surfaces in TWO shapes which look nothing alike:
//
//   shape 1  a refused INSERT raises 42501, loudly, with a Postgres message
//   shape 2  a refused UPDATE raises NOTHING. Row-level security filters the
//            row out of the statement's scope, so it succeeds against zero
//            rows and returns no error at all.
//
// Shape 2 is the one no search could have found, because it produces no
// error to search for. It is the one most worth holding still.
//
// WHAT IT DOES NOT PIN. Whether owner-only writes are the right model. They
// are not: reads were widened team-wide four days after the initial schema
// and writes were not, and two people cannot work on one Test Bed. That is
// recorded as a question for the business, deliberately outside this round.
// If it is answered by widening writes, THESE TESTS SHOULD FAIL. That is
// the point of them. They describe the boundary as it is, so that moving it
// is a visible decision rather than a silent one.

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import {
  adminClient, newRunTag, Fixtures, ensureProbeUser, userClient,
} from '../verify-harness.mjs'
import { isRefusal, writeErrorStatus, OWNERSHIP_REFUSAL } from '../../src/lib/write-errors.js'

// Two fixed users, not two per run. See ensureProbeUser.
const OWNER_EMAIL = 'ownership-owner@terminus-probe.invalid'
const OTHER_EMAIL = 'ownership-other@terminus-probe.invalid'

let admin, fixtures, runTag
let ownerId, otherId, ownerDb, otherDb
let recordId

before(async () => {
  admin = adminClient()
  runTag = newRunTag()
  fixtures = new Fixtures(admin, runTag)

  ownerId = await ensureProbeUser(admin, OWNER_EMAIL)
  otherId = await ensureProbeUser(admin, OTHER_EMAIL)
  assert.notEqual(ownerId, otherId, 'the two probe users must be different people')

  ;({ db: ownerDb } = await userClient(OWNER_EMAIL))
  ;({ db: otherDb } = await userClient(OTHER_EMAIL))

  // The subject: a record owned by the first user, with one revision.
  const rec = await fixtures.createRecord({
    record_type: `harness_${runTag}`, status: 'draft', owner_id: ownerId,
  })
  recordId = rec.id
  const { error } = await admin.from('record_revisions')
    .insert({ record_id: recordId, revision_number: 1, payload: { summary: 'as created' }, created_by: ownerId })
  if (error) throw new Error(`seed revision failed: ${error.message}`)
})

after(async () => {
  const result = await fixtures.teardown()
  console.log(`  teardown verified: ${JSON.stringify(result)}`)
})

// ---------------------------------------------------------------------------
// The read. Without this, every assertion below passes on a record nobody can
// see, which is a different system with the same test results. It is also
// what makes the class visible at all: the defect is not "the write fails",
// it is "the write fails on something the user is looking at".
// ---------------------------------------------------------------------------

test('A NON-OWNER CAN READ the record, which is what makes the refusals a defect rather than a 404', async () => {
  const { data, error } = await otherDb.from('records')
    .select('id, owner_id, record_type').eq('id', recordId)

  assert.equal(error, null, `a non-owner's read errored: ${error?.message}`)
  // Presence before value (Verification 14): an equality between two absent
  // things is not evidence. Assert the row came back, THEN assert which row.
  assert.equal(data?.length, 1, 'a non-owner read back no row at all; the rest of this file would be vacuous')
  assert.equal(data[0].id, recordId)
  assert.notEqual(data[0].owner_id, otherId, 'the reader must not be the owner, or nothing here is being tested')
})

test('A NON-OWNER CAN READ the revisions too, so the payload they are about to fail to edit is on their screen', async () => {
  const { data, error } = await otherDb.from('record_revisions')
    .select('revision_number, payload').eq('record_id', recordId)

  assert.equal(error, null, `a non-owner's revision read errored: ${error?.message}`)
  assert.equal(data?.length, 1, 'a non-owner read back no revisions')
  assert.equal(data[0].payload.summary, 'as created')
})

// ---------------------------------------------------------------------------
// Shape 1: the loud one. A refused INSERT raises 42501.
// ---------------------------------------------------------------------------

test('SHAPE 1: a non-owner INSERTING a revision is refused with 42501, the error the business was shown raw', async () => {
  const { error } = await otherDb.from('record_revisions')
    .insert({ record_id: recordId, revision_number: 91, payload: { summary: 'edited by a non-owner' }, created_by: otherId })

  assert.notEqual(error, null, 'a non-owner INSERT was not refused at all')
  assert.equal(error.code, '42501',
    `expected insufficient_privilege, got ${error.code}: ${error.message}`)
})

test('SHAPE 1 POSITIVE CASE: the OWNER inserting the same revision succeeds, so the refusal above is about ownership and not about the row', async () => {
  const { data, error } = await ownerDb.from('record_revisions')
    .insert({ record_id: recordId, revision_number: 2, payload: { summary: 'edited by the owner' }, created_by: ownerId })
    .select('revision_number')

  assert.equal(error, null, `the owner's own insert was refused: ${error?.message}`)
  assert.equal(data?.length, 1, 'the owner inserted no row')
})

// ---------------------------------------------------------------------------
// Shape 2: the silent one. This is the assertion the project did not have.
// ---------------------------------------------------------------------------

test('SHAPE 2: a non-owner UPDATING the record raises NO ERROR and affects ZERO ROWS', async () => {
  const { data, error } = await otherDb.from('records')
    .update({ status: 'active' }).eq('id', recordId).select('id')

  // Both halves matter, and the first is the surprising one. If this ever
  // starts erroring, the two shapes have become one and every route's
  // zero-row check has quietly become dead code.
  assert.equal(error, null,
    `a refused UPDATE is expected to return no error; it returned ${error?.code}: ${error?.message}`)
  assert.equal(data?.length, 0,
    'a non-owner UPDATE affected rows; the ownership boundary on records_update is not holding')
})

test('SHAPE 2 POSITIVE CASE: the OWNER updating the same field affects exactly one row', async () => {
  // Without this, the zero above is unmeasured (Verification 13). Zero rows
  // is also what a wrong id, a wrong column or a deleted record returns.
  const { data, error } = await ownerDb.from('records')
    .update({ status: 'active' }).eq('id', recordId).select('id')

  assert.equal(error, null, `the owner's own update errored: ${error?.message}`)
  assert.equal(data?.length, 1,
    'the owner updated zero rows, so the zero in the previous test measures nothing')
})

test('SHAPE 2 is invisible to the reader: the record is unchanged and the non-owner is told nothing', async () => {
  const { data, error } = await otherDb.from('records').select('status').eq('id', recordId)
  assert.equal(error, null)
  assert.equal(data?.length, 1)
  // 'active' because the OWNER set it above. The non-owner's attempt left
  // nothing behind and reported nothing, which is why nine routes each had
  // to detect this locally by counting rows.
  assert.equal(data[0].status, 'active')
})

// ---------------------------------------------------------------------------
// The message. Ties the database fact to what the person actually reads,
// using the real error object rather than a hand-built one.
// ---------------------------------------------------------------------------

test('THE REAL 42501 maps to a readable 403 through the shared helper', async () => {
  const { error } = await otherDb.from('record_revisions')
    .insert({ record_id: recordId, revision_number: 92, payload: {}, created_by: otherId })

  assert.notEqual(error, null, 'no refusal to map')
  assert.equal(isRefusal(error), true, 'the real refusal was not recognised as one')

  const reply = writeErrorStatus(error)
  assert.equal(reply.status, 403)
  assert.equal(reply.error, OWNERSHIP_REFUSAL)
  assert.match(reply.error, /belongs to another user/)
  assert.doesNotMatch(reply.error, /row-level security|42501|record_revisions/,
    'the refusal is leaking database vocabulary to the person who hit it')
})

test('A GENUINE FAILURE is not dressed up as a refusal', async () => {
  // The helper must distinguish, or every 500 becomes a misleading 403.
  const { error } = await ownerDb.from('record_revisions')
    .insert({ record_id: recordId, revision_number: 2, payload: {}, created_by: ownerId })

  assert.notEqual(error, null, 'expected a duplicate-key violation')
  assert.equal(isRefusal(error), false, `a ${error.code} was treated as an ownership refusal`)

  // ── THE NUMBER CHANGED AND THE PROPERTY DID NOT. Round 41, sixth walk ───
  //
  // This asserted 500, correctly, while 23505 was mapped nowhere. V1 mapped it,
  // because the walk had a raw constraint name on screen, and this test failed -
  // which is it working: a mapping change reached a status somebody had pinned.
  //
  // 409 IS NOT DRESSING UP, and that distinction is the whole of this test. A
  // duplicate revision_number is two writers racing for one number, which is
  // precisely a conflict, and "reload and try again" is the true remedy. What
  // this test forbids is a failure wearing a status that implies the caller did
  // something wrong they can fix by asking differently - a 403, or a 200.
  assert.equal(writeErrorStatus(error).status, 409,
    'a duplicate key is a conflict, and the mapper should say so')
  assert.match(writeErrorStatus(error).error, /duplicate|already/i,
    'the message must still say what happened rather than a generic failure')

  // AND AN ERROR THE MAPPER DOES NOT RECOGNISE IS STILL A 500. That is the half
  // that keeps this honest: mapping known codes must not become mapping
  // everything to something reassuring.
  const unknown = { code: '22003', message: 'numeric field overflow' }
  assert.equal(writeErrorStatus(unknown).status, 500,
    'an unrecognised database error must stay a 500')
  assert.equal(writeErrorStatus(unknown).error, 'numeric field overflow')
})
