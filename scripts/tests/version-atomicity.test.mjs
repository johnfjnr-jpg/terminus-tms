// A version cannot be created without the revision it names, and it is taken
// under the record's own lock. Round 38. Runs under `npm run test:db`.
//
// ─────────────────────────────────────────────────────────────
// WHY THIS IS A DATABASE TEST AND NOT A ROUTE TEST
// ─────────────────────────────────────────────────────────────
//
// The requirement used to live in one route: `if (!Number.isInteger(...)) 400`.
// That is a guarantee remembered rather than enforced, which is the exact shape
// this round removed from eleven revision writers. A second writer inserting a
// version without a revision would produce one that cannot be approved, and
// nothing would say so.
//
// So the claim under test is a DATABASE claim, and the only way to test it is to
// try the thing the route would never do. Every insert here goes straight at the
// table with the service key, bypassing the route entirely, which is precisely
// the caller the constraint exists for.

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { adminClient, newRunTag, Fixtures, resolveOwnerId } from '../verify-harness.mjs'

let db, fixtures, ownerId, recordId

// The minimum a version must carry. deal_sheet_versions_has_cost_basis refuses
// one with no catalog rate at all, so `{}` is no longer a valid version and the
// fixtures in this file say so rather than working around it.
const COST_BASIS = { ssUnitCost: 1200 }

before(async () => {
  db = adminClient()
  fixtures = new Fixtures(db, newRunTag())
  ownerId = await resolveOwnerId(db)
  const rec = await fixtures.createRecord({
    record_type: 'opportunity', status: 'Qualification', owner_id: ownerId,
  })
  recordId = rec.id
  const { error } = await db.rpc('append_record_revision', {
    p_record_id: recordId, p_patch: { targetMargin: 30 }, p_created_by: ownerId,
    p_remove: [], p_expected_revision: null,
  })
  assert.equal(error, null, 'the fixture record needs one revision to version against')
})

after(async () => { await fixtures.teardown() })

// ─────────────────────────────────────────────────────────────
// The requirement is the database's, not the route's
// ─────────────────────────────────────────────────────────────

test('a direct insert with no revision_number is REFUSED', async () => {
  const { error } = await db.from('deal_sheet_versions').insert({
    record_id: recordId, major: 0, minor: 99, status: 'draft',
    reason: 'no revision named', inputs: COST_BASIS, rates: {}, sections: [],
    created_by: ownerId,
  }).select('id').single()

  assert.ok(error, 'a version with no revision must not be insertable at all')
  assert.match(error.message, /deal_sheet_versions_revision_required/,
    'and it must be the named constraint refusing it, not something incidental')
})

test('the SAME insert carrying a revision succeeds', async () => {
  // The calibration. Without it the test above passes for any reason at all -
  // a bad column, a policy, a typo - and proves nothing about the constraint.
  const { data, error } = await db.from('deal_sheet_versions').insert({
    record_id: recordId, major: 0, minor: 98, status: 'draft',
    reason: 'revision named', revision_number: 1, inputs: COST_BASIS, rates: {}, sections: [],
    created_by: ownerId,
  }).select('id').single()

  assert.equal(error, null, error?.message)
  fixtures.versions.push(data.id)
})

test('NOT VALID left history alone: the pre-existing null row is still there', async () => {
  // The constraint was added NOT VALID precisely so the one version taken before
  // the column existed keeps its null. If this ever reads zero, either the row
  // was rewritten - which the no-backfill rule forbids - or the constraint was
  // validated, which would have failed loudly instead.
  const { data, error } = await db.from('deal_sheet_versions')
    .select('id').is('revision_number', null)
  assert.equal(error, null, error?.message)
  assert.ok(data.length >= 1,
    'the legacy null version should still exist; a zero here means history moved')
})

// ─────────────────────────────────────────────────────────────
// The lock
// ─────────────────────────────────────────────────────────────

test('insert_deal_sheet_version refuses a revision the record is not at', async () => {
  const { error } = await db.rpc('insert_deal_sheet_version', {
    p_record_id: recordId, p_expected_revision: 999, p_reason: 'stale',
    p_inputs: COST_BASIS, p_rates: {}, p_sections: [], p_batch_id: null,
    p_created_by: ownerId, p_created_by_email: null,
  })
  assert.ok(error, 'a stale expectation must be refused')
  assert.equal(error.code, 'PT409',
    'and with the code the route maps to 409, not a 500')
})

test('and accepts the revision the record IS at', async () => {
  const v = await fixtures.createVersion({
    record_id: recordId, expected_revision: 1, created_by: ownerId, reason: 'current',
  })
  assert.equal(v.revision_number, 1)
  assert.equal(v.status, 'draft')
})

test('CONCURRENT versions get distinct numbers', async () => {
  // The numbering race. major/minor used to be read by the route and written
  // back, so two saves at once both read the same highest number. The unique
  // constraint caught it and surfaced a raw 23505, which is a collision handled
  // rather than removed. Under the lock there is no collision to catch.
  //
  // Six at once through PostgREST, which means six connections and real
  // concurrency rather than six awaits in a row.
  const results = await Promise.all(Array.from({ length: 6 }, (_, i) =>
    db.rpc('insert_deal_sheet_version', {
      p_record_id: recordId, p_expected_revision: 1, p_reason: `concurrent ${i}`,
      p_inputs: COST_BASIS, p_rates: {}, p_sections: [], p_batch_id: null,
      p_created_by: ownerId, p_created_by_email: null,
    })))

  const errors = results.filter((r) => r.error).map((r) => `${r.error.code}: ${r.error.message}`)
  assert.deepEqual(errors, [], 'every concurrent version must land, not race for a number')

  const rows = results.map((r) => r.data)
  for (const row of rows) fixtures.versions.push(row.id)

  const labels = rows.map((r) => `${r.major}.${r.minor}`)
  assert.equal(new Set(labels).size, 6,
    `six concurrent versions produced ${new Set(labels).size} distinct numbers: ${labels.join(', ')}`)
  // And every one of them records the revision it was taken from.
  assert.deepEqual([...new Set(rows.map((r) => r.revision_number))], [1])
})

test('CALIBRATION: the same six done the OLD way collide', async () => {
  // Without this the test above is not a measurement. Six concurrent calls
  // returning six distinct numbers proves the lock works ONLY if six concurrent
  // calls could have produced a collision, and if PostgREST were serialising
  // these for some unrelated reason the result would look identical.
  //
  // So: the same six, done the way the route used to do it. Read the highest
  // number, add one in JavaScript, insert. If this also comes back clean, the
  // test above measured nothing and this file needs rewriting.
  const oldWay = async (i) => {
    const { data: latest } = await db.from('deal_sheet_versions')
      .select('major, minor').eq('record_id', recordId)
      .order('major', { ascending: false }).order('minor', { ascending: false })
      .limit(1).maybeSingle()
    const major = latest?.major ?? 0
    const minor = (latest?.minor ?? 0) + 1
    return db.from('deal_sheet_versions').insert({
      record_id: recordId, major, minor, status: 'draft',
      reason: `old way ${i}`, revision_number: 1, inputs: COST_BASIS, rates: {}, sections: [],
      created_by: ownerId,
    }).select('id').single()
  }

  const results = await Promise.all(Array.from({ length: 6 }, (_, i) => oldWay(i)))
  for (const r of results) if (r.data) fixtures.versions.push(r.data.id)

  const collisions = results.filter((r) => r.error?.code === '23505')
  assert.ok(collisions.length > 0,
    'the read-then-insert pattern produced no collision across six concurrent calls, '
    + 'so these calls are not actually concurrent and the test above proves nothing')
})

// ─────────────────────────────────────────────────────────────
// `inconsistent` must stay meaning a data fault
// ─────────────────────────────────────────────────────────────

test('a version naming a revision that does not exist is REFUSED', async () => {
  // version-approval.js reads a version whose revision the record has not
  // reached as `inconsistent`, documented as a data fault. That is only true if
  // no ordinary mistake can produce one. Before the composite foreign key, this
  // insert succeeded and the state was reachable by a typo.
  const { error } = await db.from('deal_sheet_versions').insert({
    record_id: recordId, major: 0, minor: 97, status: 'draft',
    reason: 'names a revision that never happened', revision_number: 9999,
    inputs: COST_BASIS, rates: {}, sections: [], created_by: ownerId,
  }).select('id').single()

  assert.ok(error, 'a version naming a nonexistent revision must not be insertable')
  assert.match(error.message, /deal_sheet_versions_revision_exists/,
    'and it must be the foreign key refusing it')
})

test('a version naming ANOTHER record\'s revision is refused too', async () => {
  // The composite key is (record_id, revision_number), not revision_number
  // alone. Revision 1 exists on plenty of records; it must exist on THIS one.
  const other = await fixtures.createRecord({
    record_type: 'opportunity', status: 'Qualification', owner_id: ownerId,
  })
  const { error } = await db.from('deal_sheet_versions').insert({
    record_id: other.id, major: 0, minor: 1, status: 'draft',
    reason: 'revision 1 exists, but not on this record', revision_number: 1,
    inputs: COST_BASIS, rates: {}, sections: [], created_by: ownerId,
  }).select('id').single()

  assert.ok(error, 'a revision number that exists elsewhere must not satisfy this key')
  assert.match(error.message, /deal_sheet_versions_revision_exists/)
})

test('and the revision a version names cannot then be deleted', async () => {
  // NO ACTION rather than CASCADE, deliberately. record_revisions is append-only
  // and has no delete policy, so this is a second reason rather than a new rule -
  // but the service key bypasses policies, and this is what stops a cleanup
  // script from quietly removing the revision an approved version cites.
  const { error } = await db.from('record_revisions')
    .delete().eq('record_id', recordId).eq('revision_number', 1)
  assert.ok(error, 'a revision cited by a version must not be deletable')
  assert.match(error.message, /deal_sheet_versions_revision_exists/)
})

// ─────────────────────────────────────────────────────────────
// A version cannot be created without the costs it was priced at
// ─────────────────────────────────────────────────────────────

test('a version with NO catalog rate is REFUSED by the database', async () => {
  // The approval page detects a rate-less baseline and refuses the comparison,
  // which is right and is not enough: it left non-comparable versions creatable
  // by ordinary mistake, so the caveat path would have been permanent rather
  // than a legacy accommodation. Named debt is fine; creatable debt is not.
  const { error } = await db.from('deal_sheet_versions').insert({
    record_id: recordId, major: 0, minor: 96, status: 'draft',
    reason: 'no cost basis', revision_number: 1,
    // Round 40 Phase 1b: the floor moved from inputs to rates, because that is
    // where the cost basis now lives. The RULE is unchanged and so is this
    // test's purpose: the approval page detecting a rate-less baseline is right
    // and is not enough, because it leaves non-comparable versions creatable.
    inputs: { targetMargin: 30, duration: 36 }, rates: { rates: {} }, sections: [],
    created_by: ownerId,
  }).select('id').single()

  assert.ok(error, 'a version with no rates must not be insertable')
  assert.match(error.message, /deal_sheet_versions_rates_have_cost_basis/)
})

test('and ONE rate is enough for the database floor', async () => {
  // The calibration, and the boundary. catalogToRates emits keys only for
  // products with a current batch, so requiring all ten would refuse a version
  // the business can legitimately take when a batch is missing. The exact rule -
  // every key the catalog actually resolved - lives in the route, which is the
  // only place that knows which products resolved.
  const { data, error } = await db.from('deal_sheet_versions').insert({
    record_id: recordId, major: 0, minor: 95, status: 'draft',
    reason: 'one rate', revision_number: 1,
    // The calibration, and the boundary, now on the rates column: catalogToRates
    // emits keys only for products with a current batch, so requiring all ten
    // would refuse a version the business can legitimately take when a batch is
    // missing.
    inputs: { targetMargin: 30 }, rates: { rates: { ssUnitCost: 1200 } }, sections: [], created_by: ownerId,
  }).select('id').single()
  assert.equal(error, null, error?.message)
  fixtures.versions.push(data.id)
})

test('NOT VALID left the rate-less legacy version alone', async () => {
  const { data, error } = await db.from('deal_sheet_versions')
    .select('id, inputs').is('revision_number', null)
  assert.equal(error, null, error?.message)
  assert.ok(data.length >= 1, 'the legacy version must still be readable')
})
