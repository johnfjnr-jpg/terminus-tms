// tearDown() is scoped by TAG, not by owner.
//
// THE DEFECT THIS EXISTS TO PREVENT, measured 2026-09-08: a single gate run
// soft deleted 66 records belonging to another round, in one bulk update,
// while the probe that triggered it printed "2 soft-deleted". The teardown
// swept every live record owned by the test account and called that "the
// complete set by construction".
//
// BOTH DIRECTIONS IN ONE TEST, deliberately. A test that only proves the
// sweep works would pass against the old code too: the old code swept
// everything, so it swept its own fixtures correctly. The claim that
// discriminates is the SURVIVOR.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { admin, tearDown, tagsToSweep } from '../fixtures.mjs'

const db = admin()
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const stamp = () => Math.random().toString(36).slice(2, 8)

// Built the way the SYSTEM produces the state (Verification 47): a record the
// test account owns, carrying a tag in its payload name, exactly as every
// fixture helper writes one.
async function tagged(tag, owner) {
  const rec = must(await db.from('records').insert({
    record_type: 'opportunity', status: 'Qualification', owner_id: owner,
  }).select('id').single(), 'insert record')
  must(await db.from('record_revisions').insert({
    record_id: rec.id, revision_number: 1,
    payload: { name: `${tag} Opportunity` }, created_by: owner,
  }).select('id').single(), 'insert revision')
  return rec.id
}
const isLive = async (id) => {
  const r = must(await db.from('records').select('id, deleted_at').eq('id', id), 'read')
  return r.length === 1 && !r[0].deleted_at
}
const purge = async (ids) => {
  await db.from('record_revisions').delete().in('record_id', ids)
  await db.from('records').delete().in('id', ids)
}

test('tearDown sweeps its own tag AND leaves another round\'s tag standing', async () => {
  const session = JSON.parse((await import('fs')).readFileSync(
    '/Users/johnfryatt/terminus-tms/session-ref.json', 'utf8'))
  const owner = session.user.id
  const mineTag = `tdscope-mine-${stamp()}`
  const theirsTag = `tdscope-theirs-${stamp()}`

  const mine = await tagged(mineTag, owner)
  const theirs = await tagged(theirsTag, owner)
  // A UNIT CARRIES NO NAME IN ITS PAYLOAD, so no tag can ever match it. It has
  // to be reached as a CHILD of a record that does match. Without this the
  // descendant rule is a claim nothing asserts, and an injection removing it
  // would come back silent (Verification 51).
  const child = must(await db.from('records').insert({
    record_type: 'unit', status: 'Active', owner_id: owner, parent_record_id: mine,
  }).select('id').single(), 'insert child').id

  try {
    assert.equal(await isLive(mine), true, 'precondition: my record starts live')
    assert.equal(await isLive(theirs), true, 'precondition: their record starts live')

    const { removed } = await tearDown(mineTag)

    // DIRECTION ONE: the sweep works.
    assert.equal(await isLive(mine), false, 'the tagged record was NOT swept')
    assert.ok(removed.some((r) => r.id === mine), 'the swept record is not in the returned list')

    // DIRECTION TWO: and it stopped there. This is the assertion the old
    // owner-scoped code fails, and the only one that can tell them apart.
    assert.equal(await isLive(theirs), true,
      'ANOTHER ROUND\'S TAGGED RECORD WAS DESTROYED - this is the 66-record defect')
    assert.ok(!removed.some((r) => r.id === theirs),
      'another round\'s record appears in the removed list')

    // The unnamed child goes with its parent.
    assert.equal(await isLive(child), false,
      'the unit child was left live - a tag cannot match it, so it must be swept as a descendant')
  } finally {
    await purge([child, mine, theirs])
  }
})

test('tearDown REFUSES when no tag can be determined, never sweeping by owner', async () => {
  // An explicit empty ARRAY, not '': a falsy string means "no explicit tag,
  // use the files", and while a fixture file exists that path finds tags and
  // the refusal is never reached. Measured, not assumed - the first version of
  // this test passed '' and swept the recorded tags instead of refusing.
  await assert.rejects(() => tearDown([]), /will NOT fall back/,
    'with no tag it must refuse, because the fallback IS the defect')
})

test('tagsToSweep prefers an explicit tag over the recorded files', () => {
  assert.deepEqual(tagsToSweep('explicit-wins'), ['explicit-wins'])
  assert.deepEqual(tagsToSweep([]), [], 'an explicit empty array is a set, not an absence')
})
