// Round 17A Phase 1 - append_record_revision atomicity, merge and key removal.
// Runs under `npm run test:db`.
//
// THESE TESTS MUST HIT A REAL DATABASE. The guarantee lives in Postgres, not
// JS: src/lib/record-revision.js only forwards to the append_record_revision
// RPC, which takes a per-record advisory lock and then computes the number and
// merges the patch in one statement. Testing the JS wrapper would prove
// nothing about atomicity, exactly as reference-number.test.mjs says of its
// own subject.
//
// WHAT FAILED BEFORE THIS EXISTED, so a future reader knows what these are
// guarding. Ten call sites read the highest revision_number, added one in JS,
// and inserted. Round 17A Phase 0 measured two concurrent writes to one record
// colliding in 10 of 10 trials and ten concurrent writes losing 82% of
// requests, each failure surfacing as a 500 carrying
// "duplicate key value violates unique constraint
// record_revisions_record_id_revision_number_key".

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { readCode } from '../lib/strip-comments.mjs'
import { adminClient, newRunTag, resolveOwnerId, Fixtures } from '../verify-harness.mjs'

let db, fixtures, ownerId, runTag

before(async () => {
  db = adminClient()
  runTag = newRunTag()
  fixtures = new Fixtures(db, runTag)
  ownerId = await resolveOwnerId(db)
})

after(async () => {
  const result = await fixtures.teardown()
  console.log(`  teardown verified: ${JSON.stringify(result)}`)
})

// A record with its first revision, the state every caller of this function
// is in: creation paths write revision 1 directly and never call it.
async function seedRecord(payload = {}) {
  const rec = await fixtures.createRecord({
    record_type: `harness_${runTag}`, status: 'draft', owner_id: ownerId,
  })
  const { error } = await db.from('record_revisions')
    .insert({ record_id: rec.id, revision_number: 1, payload, created_by: ownerId })
  if (error) throw new Error(`seedRecord revision failed: ${error.message}`)
  return rec.id
}

const append = async (recordId, patch, remove) => {
  const args = { p_record_id: recordId, p_patch: patch, p_created_by: ownerId }
  if (remove !== undefined) args.p_remove = remove
  const { data, error } = await db.rpc('append_record_revision', args)
  return { data, error }
}

const revisionsOf = async (recordId) => {
  const { data, error } = await db.from('record_revisions')
    .select('revision_number, payload').eq('record_id', recordId)
    .order('revision_number', { ascending: true })
  if (error) throw new Error(`revisionsOf failed: ${error.message}`)
  return data
}

test('atomicity: 40 genuinely concurrent appends, no duplicates and no gaps', async () => {
  const recordId = await seedRecord({ seeded: true })
  const N = 40

  // Promise.all so the calls genuinely overlap. A sequential loop would pass
  // even if the function were not atomic at all, which is the whole point of
  // this test - the same reasoning reference-number.test.mjs records for
  // issue_reference_number, and the same trap Verification 13 names.
  const results = await Promise.all(
    Array.from({ length: N }, (_, i) => append(recordId, { [`k${i}`]: i })))

  const failed = results.filter(r => r.error)
  assert.equal(failed.length, 0,
    `expected every concurrent append to succeed, ${failed.length} failed: ${failed[0]?.error?.message}`)

  const revs = await revisionsOf(recordId)
  assert.equal(revs.length, N + 1, `expected ${N + 1} revisions including the seed, got ${revs.length}`)

  // Contiguous, not merely unique. Gate evaluation resolves current state by
  // ordering on this number, so a gap would be correct about uniqueness and
  // wrong about what the number is for.
  const nums = revs.map(r => r.revision_number)
  for (let i = 0; i < nums.length; i++) {
    assert.equal(nums[i], i + 1, `gap or duplicate at position ${i}: got ${nums[i]}`)
  }
})

test('no lost update: every concurrent patch key survives in the final payload', async () => {
  const recordId = await seedRecord({ seeded: true })
  const N = 25

  // This is the half that numbering alone would not fix. Before Phase 1 the
  // payload was merged in JS from a read taken before the write, so two
  // writers merging different keys into the same stale payload would each
  // drop the other's. Phase 0 produced exactly that: three values entered,
  // one stored, one absent, one holding a previous value, row reading "Saved".
  const results = await Promise.all(
    Array.from({ length: N }, (_, i) => append(recordId, { [`field${i}`]: `value${i}` })))
  assert.equal(results.filter(r => r.error).length, 0, 'a concurrent append failed')

  const revs = await revisionsOf(recordId)
  const final = revs[revs.length - 1].payload

  for (let i = 0; i < N; i++) {
    assert.equal(final[`field${i}`], `value${i}`,
      `field${i} was lost: ${N} concurrent patches to distinct keys must all survive`)
  }
  assert.equal(final.seeded, true, 'the seeded key must survive every merge')
})

test('the patch is a shallow top-level merge, matching the JS spread it replaced', async () => {
  const recordId = await seedRecord({ keep: 'me', nested: { a: 1, b: 2 } })
  const { error } = await append(recordId, { nested: { a: 99 } })
  assert.equal(error, null)

  const revs = await revisionsOf(recordId)
  const final = revs[revs.length - 1].payload
  assert.equal(final.keep, 'me', 'an untouched top-level key must survive')
  // Shallow, deliberately: `{ ...old, ...patch }` replaced the whole `nested`
  // object too. Deep-merging here would be a behaviour change smuggled in.
  assert.deepEqual(final.nested, { a: 99 }, 'a patched key is replaced, not deep-merged')
})

test('p_remove deletes keys, which a jsonb merge cannot express', async () => {
  const recordId = await seedRecord({ gone: 'x', stays: 'y' })
  const { error } = await append(recordId, { added: 'z' }, ['gone'])
  assert.equal(error, null)

  const revs = await revisionsOf(recordId)
  const final = revs[revs.length - 1].payload
  assert.ok(!('gone' in final), 'p_remove must DELETE the key, not null it')
  assert.equal(final.stays, 'y')
  assert.equal(final.added, 'z')
})

test('the unique constraint remains as a backstop, not as the mechanism', async () => {
  const recordId = await seedRecord()
  const revs = await revisionsOf(recordId)
  const existing = revs[revs.length - 1].revision_number

  // Injecting a real violating case rather than asserting the constraint
  // exists (Verification 9). A direct insert bypasses the function entirely,
  // which is what a future call site added without it would do.
  const { error } = await db.from('record_revisions')
    .insert({ record_id: recordId, revision_number: existing, payload: {}, created_by: ownerId })

  assert.ok(error, 'a duplicate revision number must still be refused')
  assert.match(error.message, /record_revisions_record_id_revision_number_key/,
    'the refusal must come from the unique constraint')

  const after = await revisionsOf(recordId)
  assert.equal(after.length, revs.length, 'a refused insert must write nothing')
})

test('the migration declares no SECURITY DEFINER, so record_revisions_insert still applies', () => {
  // NAMED FOR WHAT IT ACTUALLY CHECKS. This asserts the migration's wording,
  // not the deployed function: pg_catalog is not reachable through PostgREST,
  // so this suite cannot read prosecdef, and saying otherwise would be a
  // check that looks stronger than it is.
  //
  // It is still worth having. A security definer version of this function
  // would bypass record_revisions_insert and let any authenticated user write
  // a revision to any record, which is a silent and severe permission
  // widening. Postgres defaults to invoker, so the guarantee is precisely
  // that these words never appear here. Same shape as this suite's existing
  // stylesheet invariant: parse the real source file and assert a property
  // of it.
  const sql = readCode(
    new URL('../../supabase/migrations/20260821000001_atomic_record_revision_key_removal.sql', import.meta.url))

  // Calibration, per Verification 13: prove the reader can see this file and
  // that the pattern can match something, so a clean result is a measurement
  // rather than a failure to read.
  assert.match(sql, /create or replace function public\.append_record_revision/,
    'the migration could not be read, or no longer defines this function')

  const body = sql.slice(sql.indexOf('create or replace function public.append_record_revision'))
  const declaration = body.slice(0, body.indexOf('as $$'))
  assert.doesNotMatch(declaration, /security\s+definer/i,
    'append_record_revision must stay SECURITY INVOKER: definer would bypass record_revisions_insert')
})

test('required arguments raise rather than silently writing', async () => {
  const { error: noId } = await append(null, {})
  assert.ok(noId, 'a null record id must raise')
  assert.match(noId.message, /p_record_id is required/)

  const recordId = await seedRecord()
  const { data, error } = await db.rpc('append_record_revision',
    { p_record_id: recordId, p_patch: {}, p_created_by: null })
  assert.ok(error, 'a null created_by must raise')
  assert.match(error.message, /p_created_by is required/)
  assert.equal(data, null)

  // And nothing was written by either refusal.
  const revs = await revisionsOf(recordId)
  assert.equal(revs.length, 1, 'a refused call must leave only the seeded revision')
})
