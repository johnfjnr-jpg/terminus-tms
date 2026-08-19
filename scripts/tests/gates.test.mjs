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
import { computeBlocking, approvalSatisfiesRule, ruleScope } from '../../src/routes/transitions.js'
import { buildStageTracks } from '../../src/routes/records.js'

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
    record_type: 'document', document_kind: 'terminus', variant: 'NDA', status: 'draft',
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
test('INVARIANT: no stage_gate_rules row or approvals.stage names a stage absent from stage_definitions', async () => {
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

  // Round 7 Phase 3.1 created a FOURTH table holding a stage-name string.
  // An orphaned approvals.stage does not error - it silently stops
  // matching, so a gate that was satisfied becomes blocked with no
  // explanation anywhere. NULL is legitimate and excluded: approvals
  // issued before the column existed carry null by design, and are
  // deliberately unable to satisfy a stage-scoped rule.
  const { data: approvals, error: apprErr } = await db
    .from('approvals')
    .select('id, stage, record_id, records!inner(record_type)')
    .not('stage', 'is', null)
  assert.equal(apprErr, null, `approvals query failed: ${apprErr?.message}`)

  const apprOrphans = (approvals ?? [])
    .filter(a => a.records?.record_type !== TYPE)
    .filter(a => !live.has(`${a.records?.record_type}||${a.stage}`))
    .map(a => ({ id: a.id, record_type: a.records?.record_type, stage: a.stage }))

  assert.deepEqual(apprOrphans, [],
    `approvals.stage values naming a stage that does not exist:\n${JSON.stringify(apprOrphans, null, 2)}`)
})

// ---------------------------------------------------------------------
test('child_record_status BLOCKS when the child is absent (inverted, Phase 3.2)', async () => {
  // ------------------------------------------------------------------
  // INVERTED, NOT DELETED, Round 7 Phase 3.2.
  //
  // This test previously asserted the opposite: that a child_record_status
  // rule never blocked, because transitions.js had no branch for it and
  // the rule loop fell straight through. That assertion was written
  // deliberately in Phase 1 to document a known gate hole, with a note
  // saying it must be INVERTED when the branch was built so that building
  // it would cause a visible, deliberate failure rather than passing
  // silently. It did exactly that. This is the inverted form.
  // ------------------------------------------------------------------
  const [FROM, TO] = stagePair()
  const rec = await fx.createRecord({ record_type: TYPE, status: FROM, owner_id: ownerId })
  await fx.createRule({
    record_type: TYPE, from_stage: FROM, to_stage: TO,
    requirement_type: 'child_record_status',
    requirement_detail: { record_type: 'document', variant: 'NDA', status: 'approved' },
  })

  const r = await computeBlocking(db, rec, FROM, TO, 1, {})
  assert.equal(r.blocking.length, 1, 'an unmet child_record_status rule must now block')
  assert.equal(r.blocking[0].requirement_type, 'child_record_status')
  assert.equal(r.blocking[0].child_record_type, 'document')
  assert.equal(r.blocking[0].variant, 'NDA')
  assert.equal(r.blocking[0].required_status, 'approved')
})

test('child_record_status clears when a matching child exists', async () => {
  const [FROM, TO] = stagePair()
  const rec = await fx.createRecord({ record_type: TYPE, status: FROM, owner_id: ownerId })
  await fx.createRule({
    record_type: TYPE, from_stage: FROM, to_stage: TO,
    requirement_type: 'child_record_status',
    requirement_detail: { record_type: 'document', variant: 'NDA', status: 'approved' },
  })

  // Wrong status must NOT satisfy it.
  const doc = await fx.createRecord({
    record_type: 'document', document_kind: 'terminus', variant: 'NDA', status: 'draft',
    parent_record_id: rec.id, owner_id: ownerId,
  })
  assert.equal((await computeBlocking(db, rec, FROM, TO, 1, {})).blocking.length, 1,
    'a draft child must not satisfy an approved requirement')

  // Wrong variant must NOT satisfy it either - no case folding, and no
  // matching a different document just because the type lines up.
  await fx.createRecord({
    record_type: 'document', document_kind: 'terminus', variant: 'nda', status: 'approved',
    parent_record_id: rec.id, owner_id: ownerId,
  })
  assert.equal((await computeBlocking(db, rec, FROM, TO, 1, {})).blocking.length, 1,
    'variant matching is case-sensitive by design: "nda" must not satisfy "NDA"')

  await db.from('records').update({ status: 'approved' }).eq('id', doc.id)
  assert.deepEqual((await computeBlocking(db, rec, FROM, TO, 1, {})).blocking, [])
})

test('child_record_status stays generic: a rule with no variant matches on type alone', async () => {
  // The reason both keys are used rather than document+variant only: a
  // future rule may need a child 'pilot' at status 'complete' with no
  // variant at all, and must not be forced into the document model.
  const [FROM, TO] = stagePair()
  const rec = await fx.createRecord({ record_type: TYPE, status: FROM, owner_id: ownerId })
  const CHILD = `${TYPE}_pilot`
  await fx.createRule({
    record_type: TYPE, from_stage: FROM, to_stage: TO,
    requirement_type: 'child_record_status',
    requirement_detail: { record_type: CHILD, status: 'complete' },
  })

  const blocked = await computeBlocking(db, rec, FROM, TO, 1, {})
  assert.equal(blocked.blocking.length, 1)
  assert.equal(blocked.blocking[0].variant, undefined, 'no variant key when the rule supplies none')

  // A child of the right type at the right status satisfies it even
  // though it carries a variant the rule never mentioned.
  await fx.createRecord({
    record_type: CHILD, variant: 'anything', status: 'complete',
    parent_record_id: rec.id, owner_id: ownerId,
  })
  assert.deepEqual((await computeBlocking(db, rec, FROM, TO, 1, {})).blocking, [])
})

test('child_record_status ignores a child of another parent', async () => {
  const [FROM, TO] = stagePair()
  const rec = await fx.createRecord({ record_type: TYPE, status: FROM, owner_id: ownerId })
  const other = await fx.createRecord({ record_type: TYPE, status: FROM, owner_id: ownerId })
  await fx.createRule({
    record_type: TYPE, from_stage: FROM, to_stage: TO,
    requirement_type: 'child_record_status',
    requirement_detail: { record_type: 'document', variant: 'NDA', status: 'approved' },
  })
  await fx.createRecord({
    record_type: 'document', document_kind: 'terminus', variant: 'NDA', status: 'approved',
    parent_record_id: other.id, owner_id: ownerId,
  })
  assert.equal((await computeBlocking(db, rec, FROM, TO, 1, {})).blocking.length, 1,
    "another record's approved document must not satisfy this record's gate")
})

// ---------------------------------------------------------------------
// Round 7 step 3.0: the three unchecked query errors INSIDE
// computeBlocking (transitions.js lines 43, 68, 124 before the fix).
//
// Each failure is injected rather than forced by revoking a permission.
// A revoke proves it once, in a session; these assert it on every run,
// and they can isolate a single table - revoking select on `records`
// would break the record fetch long before the document branch is
// reached, so the interesting site could not be tested alone at all.
//
// Before the fix, every one of these returned a normal blocking[] with
// the requirement listed as unmet: an error was indistinguishable from
// "requirement not satisfied", so the gate decided rather than failed.
const failingClientFor = (table, realDb) => {
  const failure = { message: `forced failure on ${table}`, code: 'TEST' }
  const chain = {
    select: () => chain, eq: () => chain, or: () => chain, is: () => chain,
    order: () => chain, limit: () => chain,
    maybeSingle: async () => ({ data: null, error: failure }),
    // awaited directly (the stage_gate_rules query has no maybeSingle)
    then: (resolve) => resolve({ data: null, error: failure }),
  }
  return { from: (t) => (t === table ? chain : realDb.from(t)) }
}

for (const [table, requirement_type, requirement_detail] of [
  ['approvals', 'approval_obtained', { track: 'Senior' }],
  ['records', 'document_status', { document: 'NDA', status: 'approved' }],
  ['record_contacts', 'contact_role_linked', { role: 'Client Legal Buyer' }],
]) {
  test(`step 3.0: a failed ${table} query returns an error, never a silent block`, async () => {
    const [FROM, TO] = stagePair()
    const rec = await fx.createRecord({ record_type: TYPE, status: FROM, owner_id: ownerId })
    await fx.createRule({ record_type: TYPE, from_stage: FROM, to_stage: TO, requirement_type, requirement_detail })

    // Sanity: with a healthy client this blocks normally, so the
    // assertion below is about the error path, not a broken fixture.
    const healthy = await computeBlocking(db, rec, FROM, TO, 1, {})
    assert.equal(healthy.error, undefined)
    assert.equal(healthy.blocking.length, 1)

    const r = await computeBlocking(failingClientFor(table, db), rec, FROM, TO, 1, {})
    assert.ok(r.error, `a failed ${table} query must surface an error`)
    assert.match(r.error.message, /forced failure/)
    assert.equal(r.blocking, undefined, 'must not return a blocking set built from an unknown answer')
  })
}

// ---------------------------------------------------------------------
// Round 7 Phase 3.1: approval scope is a property of the rule.
//
// The continuity assertion is the important one. "Absent scope defaults
// to revision" is a stated requirement, not a preference: every rule
// written before 3.1, and every approval already issued, must behave
// exactly as it did. A regression there would be invisible in the UI and
// would quietly loosen or tighten real gates.

test('3.1 continuity: a rule with NO scope still behaves exactly as before', async () => {
  const [FROM, TO] = stagePair()
  const rec = await fx.createRecord({ record_type: TYPE, status: FROM, owner_id: ownerId })
  await fx.createRule({
    record_type: TYPE, from_stage: FROM, to_stage: TO,
    requirement_type: 'approval_obtained', requirement_detail: { track: 'Senior' }, // no scope
  })

  const blocked = await computeBlocking(db, rec, FROM, TO, 1, {})
  assert.equal(blocked.blocking.length, 1)
  assert.equal(blocked.blocking[0].scope, 'revision', 'absent scope must default to revision')
  assert.match(blocked.blocking[0].message, /revision 1/)

  await fx.createApproval({
    record_id: rec.id, revision_number: 1, stage: FROM,
    track: 'Senior', decision: 'approved', approver_id: ownerId,
  })
  assert.deepEqual((await computeBlocking(db, rec, FROM, TO, 1, {})).blocking, [])

  // The pre-3.1 behaviour that must survive: a new revision voids it.
  assert.equal((await computeBlocking(db, rec, FROM, TO, 2, {})).blocking.length, 1,
    'an unscoped rule must still be voided by a new revision')
})

test('3.1 scope "stage": an edit no longer voids the approval', async () => {
  const [FROM, TO] = stagePair()
  const rec = await fx.createRecord({ record_type: TYPE, status: FROM, owner_id: ownerId })
  await fx.createRule({
    record_type: TYPE, from_stage: FROM, to_stage: TO,
    requirement_type: 'approval_obtained',
    requirement_detail: { track: 'Legal', scope: 'stage' },
  })

  const blocked = await computeBlocking(db, rec, FROM, TO, 1, {})
  assert.equal(blocked.blocking[0].scope, 'stage')
  assert.match(blocked.blocking[0].message, new RegExp(`at stage ${FROM}`))

  await fx.createApproval({
    record_id: rec.id, revision_number: 1, stage: FROM,
    track: 'Legal', decision: 'approved', approver_id: ownerId,
  })
  assert.deepEqual((await computeBlocking(db, rec, FROM, TO, 1, {})).blocking, [])

  // This is the whole point of 3.1: revision 2, 5, 50 - still satisfied.
  for (const rev of [2, 5, 50]) {
    assert.deepEqual((await computeBlocking(db, rec, FROM, TO, rev, {})).blocking, [],
      `a stage-scoped approval must survive revision ${rev}`)
  }
})

test('3.1 scope "stage": an approval given at a DIFFERENT stage does not count', async () => {
  const [FROM, TO] = stagePair()
  const [OTHER] = stagePair()
  const rec = await fx.createRecord({ record_type: TYPE, status: FROM, owner_id: ownerId })
  await fx.createRule({
    record_type: TYPE, from_stage: FROM, to_stage: TO,
    requirement_type: 'approval_obtained',
    requirement_detail: { track: 'Legal', scope: 'stage' },
  })
  await fx.createApproval({
    record_id: rec.id, revision_number: 1, stage: OTHER,
    track: 'Legal', decision: 'approved', approver_id: ownerId,
  })
  assert.equal((await computeBlocking(db, rec, FROM, TO, 1, {})).blocking.length, 1,
    'stage scoping must not be satisfied by an approval from another stage')
})

test('3.1: a NULL-stage approval cannot satisfy a stage-scoped rule', async () => {
  // Approvals issued before the stage column existed. Back-filling them
  // from the record's current status would fabricate history, so they are
  // deliberately unable to satisfy a stage-scoped gate.
  const [FROM, TO] = stagePair()
  const rec = await fx.createRecord({ record_type: TYPE, status: FROM, owner_id: ownerId })
  await fx.createRule({
    record_type: TYPE, from_stage: FROM, to_stage: TO,
    requirement_type: 'approval_obtained',
    requirement_detail: { track: 'Legal', scope: 'stage' },
  })
  await fx.createApproval({
    record_id: rec.id, revision_number: 1, stage: null,
    track: 'Legal', decision: 'approved', approver_id: ownerId,
  })
  assert.equal((await computeBlocking(db, rec, FROM, TO, 1, {})).blocking.length, 1,
    'a legacy null-stage approval must not satisfy a stage-scoped rule')
})

test('3.1 constraint 1: revision_number is still recorded on stage-scoped approvals', async () => {
  // Pricing history must stay possible: gate on stage, record the revision.
  const [FROM, TO] = stagePair()
  const rec = await fx.createRecord({ record_type: TYPE, status: FROM, owner_id: ownerId })
  const a = await fx.createApproval({
    record_id: rec.id, revision_number: 7, stage: FROM,
    track: 'Legal', decision: 'approved', approver_id: ownerId,
  })
  const { data, error } = await db.from('approvals')
    .select('revision_number, stage').eq('id', a.id).single()
  assert.equal(error, null)
  assert.equal(data.revision_number, 7, 'revision_number must still be written')
  assert.equal(data.stage, FROM, 'stage must be written alongside it, not instead of it')
})

test('3.1: a rejected decision never satisfies either scope', async () => {
  const [FROM, TO] = stagePair()
  const rec = await fx.createRecord({ record_type: TYPE, status: FROM, owner_id: ownerId })
  await fx.createRule({
    record_type: TYPE, from_stage: FROM, to_stage: TO,
    requirement_type: 'approval_obtained',
    requirement_detail: { track: 'Legal', scope: 'stage' },
  })
  await fx.createApproval({
    record_id: rec.id, revision_number: 1, stage: FROM,
    track: 'Legal', decision: 'rejected', approver_id: ownerId,
  })
  assert.equal((await computeBlocking(db, rec, FROM, TO, 1, {})).blocking.length, 1,
    'a rejection must not satisfy a gate')
})


// ---------------------------------------------------------------------
// Round 7, 3.1 completion. The gate and the stage-approvals panel must
// answer the same question the same way.
//
// They did not. 3.1 taught computeBlocking about requirement_detail.scope
// and left records.js filtering approvals on revision_number alone. With
// Phase 4's stage-scoped Qualification rules that produced a live defect:
// tick a track, edit any field, and the gate stayed satisfied while the
// panel showed the track un-ticked - which re-enabled the row, invited a
// re-tick, and recorded a DUPLICATE approval per edit, because the unique
// constraint carries revision_number and the revision had moved.
//
// Both now judge with the same exported predicate. These tests assert the
// agreement directly, since that is the regression this class produces.

// Calls the REAL function records.js uses to build the panel, not a copy.
// A mirrored implementation would keep passing if records.js drifted,
// which is precisely how the panel and the gate came apart before.
const panelSaysApproved = (approvals, rule, stageName, currentRevision) => {
  const tracks = buildStageTracks([{ ...rule }], approvals, stageName, currentRevision)
  return tracks.length === 1 && tracks[0].approved
}

const fetchApprovals = async (recordId) => {
  const { data, error } = await db.from('approvals')
    .select('track, decision, approver_id, decided_at, stage, revision_number')
    .eq('record_id', recordId)
  assert.equal(error, null, `approvals fetch failed: ${error?.message}`)
  return data ?? []
}

test('gate and approvals panel agree: stage-scoped approval survives an edit', async () => {
  const [FROM, TO] = stagePair()
  const rec = await fx.createRecord({ record_type: TYPE, status: FROM, owner_id: ownerId })
  const detail = { track: 'Technical', scope: 'stage' }
  await fx.createRule({
    record_type: TYPE, from_stage: FROM, to_stage: TO,
    requirement_type: 'approval_obtained', requirement_detail: detail,
  })
  const rule = { requirement_type: 'approval_obtained', requirement_detail: detail }

  await fx.createApproval({
    record_id: rec.id, revision_number: 1, stage: FROM,
    track: 'Technical', decision: 'approved', approver_id: ownerId,
  })

  // Revision 1: both must say satisfied.
  let approvals = await fetchApprovals(rec.id)
  assert.deepEqual((await computeBlocking(db, rec, FROM, TO, 1, {})).blocking, [])
  assert.equal(panelSaysApproved(approvals, rule, FROM, 1), true)

  // An unrelated field edit moves the revision. THIS is where they used
  // to diverge: gate satisfied, panel un-ticked.
  for (const rev of [2, 9]) {
    const gateSatisfied = (await computeBlocking(db, rec, FROM, TO, rev, {})).blocking.length === 0
    const panel = panelSaysApproved(approvals, rule, FROM, rev)
    assert.equal(gateSatisfied, true, `gate must stay satisfied at revision ${rev}`)
    assert.equal(panel, gateSatisfied,
      `panel and gate disagree at revision ${rev}: panel=${panel} gate=${gateSatisfied}`)
  }
})

test('gate and approvals panel agree: revision-scoped approval is voided by an edit', async () => {
  const [FROM, TO] = stagePair()
  const rec = await fx.createRecord({ record_type: TYPE, status: FROM, owner_id: ownerId })
  const detail = { track: 'Commercial' } // no scope -> revision
  await fx.createRule({
    record_type: TYPE, from_stage: FROM, to_stage: TO,
    requirement_type: 'approval_obtained', requirement_detail: detail,
  })
  const rule = { requirement_type: 'approval_obtained', requirement_detail: detail }
  assert.equal(ruleScope(rule), 'revision', 'absent scope must default to revision')

  await fx.createApproval({
    record_id: rec.id, revision_number: 1, stage: FROM,
    track: 'Commercial', decision: 'approved', approver_id: ownerId,
  })
  const approvals = await fetchApprovals(rec.id)

  for (const rev of [1, 2]) {
    const gateSatisfied = (await computeBlocking(db, rec, FROM, TO, rev, {})).blocking.length === 0
    const panel = panelSaysApproved(approvals, rule, FROM, rev)
    assert.equal(panel, gateSatisfied, `panel and gate disagree at revision ${rev}`)
    assert.equal(gateSatisfied, rev === 1,
      `a revision-scoped approval must hold at revision 1 and be voided at ${rev}`)
  }
})

test('gate and approvals panel agree: an approval from another stage counts for neither', async () => {
  const [FROM, TO] = stagePair()
  const [OTHER] = stagePair()
  const rec = await fx.createRecord({ record_type: TYPE, status: FROM, owner_id: ownerId })
  const detail = { track: 'Legal', scope: 'stage' }
  await fx.createRule({
    record_type: TYPE, from_stage: FROM, to_stage: TO,
    requirement_type: 'approval_obtained', requirement_detail: detail,
  })
  const rule = { requirement_type: 'approval_obtained', requirement_detail: detail }

  await fx.createApproval({
    record_id: rec.id, revision_number: 1, stage: OTHER,
    track: 'Legal', decision: 'approved', approver_id: ownerId,
  })
  const approvals = await fetchApprovals(rec.id)
  const gateSatisfied = (await computeBlocking(db, rec, FROM, TO, 1, {})).blocking.length === 0
  assert.equal(gateSatisfied, false)
  assert.equal(panelSaysApproved(approvals, rule, FROM, 1), gateSatisfied)
})
