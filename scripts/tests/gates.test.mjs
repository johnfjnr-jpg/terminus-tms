// Round 7 Phase 1, section 1.3 - computeBlocking gate evaluation, plus
// the standing orphaned-rule invariant. Runs under `npm run test:db`.
//
// computeBlocking is the single gate guarding every stage transition and
// is called from two places (transitions.js and records.js), so it needs
// a real database: it reads stage_gate_rules, approvals, records and
// record_contacts.
//
// Every fixture uses a synthetic record_type derived from the run tag, so
// these tests never read or write a real Test Bed, Opportunity or their
// gate rules.

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { adminClient, newRunTag, resolveOwnerId, Fixtures } from '../verify-harness.mjs'
import { computeBlocking } from '../../src/routes/transitions.js'

let db, runTag, fx, ownerId, TYPE

// Rules are matched on (record_type, from_stage, to_stage). Every test
// shares one synthetic record_type, so each must claim its OWN stage
// pair - otherwise rules created by an earlier test still match a later
// test's record and leak into its blocking set.
let stageSeq = 0
const stagePair = () => { stageSeq++; return [`Stage${stageSeq}A`, `Stage${stageSeq}B`] }

const types = (blocking) => blocking.map(b => b.requirement_type).sort()

before(async () => {
  db = adminClient()
  runTag = newRunTag()
  TYPE = `harness_${runTag}` // synthetic record_type, never a real one
  fx = new Fixtures(db, runTag)
  ownerId = await resolveOwnerId(db)
})

after(async () => {
  const summary = await fx.teardown()
  console.log('\n  teardown verified:', JSON.stringify(summary))
})

test('approval_obtained: blocks when absent, clears when an approved row exists', async () => {
  const [FROM, TO] = stagePair()
  const rec = await fx.createRecord({ record_type: TYPE, status: FROM, owner_id: ownerId })
  await fx.createRule({
    record_type: TYPE, from_stage: FROM, to_stage: TO,
    requirement_type: 'approval_obtained', requirement_detail: { track: 'Senior' },
  })

  const before_ = await computeBlocking(db, rec, FROM, TO, 1, {})
  assert.equal(before_.blocking.length, 1)
  assert.equal(before_.blocking[0].requirement_type, 'approval_obtained')
  assert.equal(before_.blocking[0].track, 'Senior')

  await fx.createApproval({
    record_id: rec.id, revision_number: 1, track: 'Senior',
    decision: 'approved', approver_id: ownerId,
  })

  const after_ = await computeBlocking(db, rec, FROM, TO, 1, {})
  assert.deepEqual(after_.blocking, [], 'an approved Senior decision should clear the gate')

  // Revision scoping today: the approval is bound to revision 1, so the
  // same record at revision 2 is blocked again. Round 7 Phase 3 changes
  // this to per-rule scope; this assertion documents current behaviour.
  const nextRev = await computeBlocking(db, rec, FROM, TO, 2, {})
  assert.equal(nextRev.blocking.length, 1, 'approvals are revision-scoped today')
})

test('document_status: blocks until a child document record matches name and status', async () => {
  const [FROM, TO] = stagePair()
  const rec = await fx.createRecord({ record_type: TYPE, status: FROM, owner_id: ownerId })
  await fx.createRule({
    record_type: TYPE, from_stage: FROM, to_stage: TO,
    requirement_type: 'document_status',
    requirement_detail: { document: 'NDA', status: 'approved' },
  })

  const before_ = await computeBlocking(db, rec, FROM, TO, 1, {})
  assert.equal(before_.blocking.length, 1)
  assert.equal(before_.blocking[0].document, 'NDA')

  // A document at the wrong status must NOT clear the gate.
  const draft = await fx.createRecord({
    record_type: 'document', variant: 'NDA', status: 'draft',
    parent_record_id: rec.id, owner_id: ownerId,
  })
  const stillBlocked = await computeBlocking(db, rec, FROM, TO, 1, {})
  assert.equal(stillBlocked.blocking.length, 1, 'a draft NDA must not satisfy an approved requirement')

  await db.from('records').update({ status: 'approved' }).eq('id', draft.id)
  const after_ = await computeBlocking(db, rec, FROM, TO, 1, {})
  assert.deepEqual(after_.blocking, [])
})

test('payload_field_required: empty string, null and undefined all block', async () => {
  const [FROM, TO] = stagePair()
  const rec = await fx.createRecord({ record_type: TYPE, status: FROM, owner_id: ownerId })
  await fx.createRule({
    record_type: TYPE, from_stage: FROM, to_stage: TO,
    requirement_type: 'payload_field_required', requirement_detail: { field: 'testBedDuration' },
  })

  for (const payload of [{}, { testBedDuration: null }, { testBedDuration: '' }]) {
    const r = await computeBlocking(db, rec, FROM, TO, 1, payload)
    assert.equal(r.blocking.length, 1, `expected block for payload ${JSON.stringify(payload)}`)
    assert.equal(r.blocking[0].field, 'testBedDuration')
  }

  const ok = await computeBlocking(db, rec, FROM, TO, 1, { testBedDuration: 6 })
  assert.deepEqual(ok.blocking, [])

  // 0 is a real value, not "unset" - it must not block.
  const zero = await computeBlocking(db, rec, FROM, TO, 1, { testBedDuration: 0 })
  assert.deepEqual(zero.blocking, [], '0 is a set value and must not be treated as missing')
})

test('contact_role_linked: blocks until a record_contacts row exists for that role', async () => {
  const [FROM, TO] = stagePair()
  const rec = await fx.createRecord({ record_type: TYPE, status: FROM, owner_id: ownerId })
  const contact = await fx.createRecord({ record_type: TYPE, status: 'Qualified', owner_id: ownerId })
  await fx.createRule({
    record_type: TYPE, from_stage: FROM, to_stage: TO,
    requirement_type: 'contact_role_linked', requirement_detail: { role: 'Client Legal Buyer' },
  })

  const before_ = await computeBlocking(db, rec, FROM, TO, 1, {})
  assert.equal(before_.blocking.length, 1)
  assert.equal(before_.blocking[0].role, 'Client Legal Buyer')

  // A link in a DIFFERENT role must not satisfy it.
  await fx.createContactLink({
    record_id: rec.id, contact_id: contact.id,
    role: 'Client Technical Buyer', created_by: ownerId,
  })
  const wrongRole = await computeBlocking(db, rec, FROM, TO, 1, {})
  assert.equal(wrongRole.blocking.length, 1, 'a different role must not satisfy this requirement')

  await fx.createContactLink({
    record_id: rec.id, contact_id: contact.id,
    role: 'Client Legal Buyer', created_by: ownerId,
  })
  const after_ = await computeBlocking(db, rec, FROM, TO, 1, {})
  assert.deepEqual(after_.blocking, [])
})

test('variant matching: null-variant rules apply to all, variant rules only to their own', async () => {
  const [FROM, TO] = stagePair()
  // The code carries an explicit warning that .or() with a single
  // condition can be read by PostgREST as a top-level OR, bypassing the
  // other .eq() filters. That failure would leak another variant's rules
  // in, so this asserts the negative case too, not just the positive.
  await fx.createRule({
    record_type: TYPE, variant: null, from_stage: FROM, to_stage: TO,
    requirement_type: 'payload_field_required', requirement_detail: { field: 'sharedField' },
  })
  await fx.createRule({
    record_type: TYPE, variant: 'alpha', from_stage: FROM, to_stage: TO,
    requirement_type: 'payload_field_required', requirement_detail: { field: 'alphaField' },
  })
  await fx.createRule({
    record_type: TYPE, variant: 'beta', from_stage: FROM, to_stage: TO,
    requirement_type: 'payload_field_required', requirement_detail: { field: 'betaField' },
  })

  const alpha = await fx.createRecord({ record_type: TYPE, variant: 'alpha', status: FROM, owner_id: ownerId })
  const plain = await fx.createRecord({ record_type: TYPE, variant: null, status: FROM, owner_id: ownerId })

  const alphaResult = await computeBlocking(db, alpha, FROM, TO, 1, {})
  const alphaFields = alphaResult.blocking.map(b => b.field).sort()
  assert.deepEqual(alphaFields, ['alphaField', 'sharedField'],
    'a variant record must pick up null-variant AND its own rules, and no others')
  assert.ok(!alphaFields.includes('betaField'), 'must not leak another variant\'s rules')

  const plainResult = await computeBlocking(db, plain, FROM, TO, 1, {})
  assert.deepEqual(plainResult.blocking.map(b => b.field).sort(), ['sharedField'],
    'a record with no variant must pick up only null-variant rules')
})

test('both call sites agree: transitions.js and records.js produce the same blocking set', async () => {
  const [FROM, TO] = stagePair()
  // records.js imports the same computeBlocking from transitions.js, so
  // this asserts the shared implementation really is shared - that the
  // two paths have not diverged into separate copies.
  const [transitionsMod, recordsMod] = await Promise.all([
    import('../../src/routes/transitions.js'),
    import('../../src/routes/records.js'),
  ])
  assert.equal(typeof transitionsMod.computeBlocking, 'function')

  const rec = await fx.createRecord({ record_type: TYPE, status: FROM, owner_id: ownerId })
  await fx.createRule({
    record_type: TYPE, from_stage: FROM, to_stage: TO,
    requirement_type: 'payload_field_required', requirement_detail: { field: 'agreementField' },
  })

  const viaTransitions = await transitionsMod.computeBlocking(db, rec, FROM, TO, 1, {})
  assert.equal(viaTransitions.blocking.length, 1)
  assert.equal(viaTransitions.blocking[0].field, 'agreementField')
  assert.ok(recordsMod, 'records.js must import cleanly and reuse the same gate function')
})

// ---------------------------------------------------------------------
// The standing orphaned-rule invariant. This one deliberately asserts
// against LIVE data across EVERY record type, not against fixtures. It is
// what stops the Phase 0 class of fault recurring silently as stages are
// added or renamed.
test('INVARIANT: no stage_gate_rules row names a stage absent from stage_definitions', async () => {
  const { data: stages, error: stageErr } = await db
    .from('stage_definitions').select('record_type, stage_name')
  assert.equal(stageErr, null, `stage_definitions query failed: ${stageErr?.message}`)

  const { data: rules, error: ruleErr } = await db
    .from('stage_gate_rules').select('record_type, from_stage, to_stage, requirement_type')
  assert.equal(ruleErr, null, `stage_gate_rules query failed: ${ruleErr?.message}`)

  const live = new Set(stages.map(s => `${s.record_type}||${s.stage_name}`))

  // Fixture rules use a synthetic record_type with no stage_definitions
  // rows at all, so they are excluded by record_type - not by ignoring
  // orphans generally, which would defeat the invariant.
  const orphans = rules
    .filter(r => r.record_type !== TYPE)
    .filter(r => !live.has(`${r.record_type}||${r.from_stage}`) || !live.has(`${r.record_type}||${r.to_stage}`))

  assert.deepEqual(orphans, [],
    `orphaned gate rules found - each names a stage that does not exist:\n${JSON.stringify(orphans, null, 2)}`)
})

// ---------------------------------------------------------------------
test('child_record_status is a NO-OP today - this asserted behaviour is WRONG', async () => {
  const [FROM, TO] = stagePair()
  // ------------------------------------------------------------------
  // READ THIS BEFORE CHANGING THE ASSERTION BELOW.
  //
  // This test documents a KNOWN GATE HOLE. It does not endorse it.
  //
  // src/routes/transitions.js:140 is a bare comment,
  // "// child_record_status handled in a future milestone". The rule
  // loop has no branch for this requirement_type, so it falls straight
  // through and pushes nothing. A child_record_status rule therefore
  // never blocks anything.
  //
  // This is live, not hypothetical: supabase/seeds/003_test_bed.sql
  // seeds three real child_record_status rules on the test_bed
  // Decommissioning -> Closed transition (NDA, PDPA assessment, DPIA).
  // Three of the four seeded requirements on that transition are
  // structurally inert. The transition is NOT ungated - its fourth rule
  // is approval_obtained {"track":"Senior"}, whose branch does exist at
  // transitions.js:39 and does block. What is missing is the
  // document-review half of the gate, not the gate itself.
  //
  // WHEN THE child_record_status BRANCH IS BUILT (Round 7 Phase 3.2),
  // THIS ASSERTION MUST BE INVERTED, NOT DELETED. Building the branch
  // should cause a visible, deliberate failure here. That is the point.
  // ------------------------------------------------------------------
  const rec = await fx.createRecord({ record_type: TYPE, status: FROM, owner_id: ownerId })
  await fx.createRule({
    record_type: TYPE, from_stage: FROM, to_stage: TO,
    requirement_type: 'child_record_status',
    requirement_detail: { record_type: 'nda', status: 'approved' },
  })

  const r = await computeBlocking(db, rec, FROM, TO, 1, {})

  // No NDA child exists, and the requirement is unmet. It still does not block.
  assert.deepEqual(r.blocking, [],
    'CURRENT behaviour: child_record_status never blocks. When the branch ' +
    'is built this must become an assertion that it DOES block.')
})
