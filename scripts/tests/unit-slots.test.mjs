// Round 17A Phase 3 - unit slot derivation and the index rule.
// Runs under `npm run test:db`.
//
// WHY THIS EXISTS. The index rule was governed by a comment claiming "a slot
// is never reissued after a removal", and that comment was false the day it
// was written: the next index is computed from loadUnits, which excludes
// soft-deleted rows, so max(index) never sees a removed slot. Round 17A
// Phase 3 decided that reissuing IS the right behaviour and corrected the
// comment. These tests exist so the decision is enforced rather than
// described, per Verification 5 - a rule that lives only in prose is one the
// next round reads as true without checking.

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { adminClient, newRunTag, resolveOwnerId, Fixtures } from '../verify-harness.mjs'
import { loadUnits, deriveMissingUnitSlots } from '../../src/lib/units.js'

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

// A parent to hang slots from. deriveMissingUnitSlots only uses the id, so a
// harness record type is enough and keeps this clear of real Test Beds.
async function seedBed() {
  const rec = await fixtures.createRecord({
    record_type: `harness_${runTag}`, status: 'draft', owner_id: ownerId,
  })
  return rec.id
}

// Slots are record_type 'unit', so Fixtures does not know about them unless
// they are handed over. Tracked here so teardown soft deletes and RE-QUERIES
// them like everything else.
async function derive(bedId, counts) {
  const { created, error } = await deriveMissingUnitSlots(db, bedId, counts, ownerId)
  if (error) throw new Error(`derive failed: ${error.message}`)
  for (const c of created) fixtures.records.push(c.id)
  return created
}

const liveIndexes = async (bedId, type) => {
  const { units, error } = await loadUnits(db, bedId)
  if (error) throw new Error(`loadUnits failed: ${error.message}`)
  return units.filter(u => u.type === type).map(u => u.index).sort((a, b) => a - b)
}

test('derivation creates exactly the slots the counts imply, numbered from 1', async () => {
  const bedId = await seedBed()
  const created = await derive(bedId, { safesightCameras: 3, airQualitySensors: 1 })
  assert.equal(created.length, 4)
  assert.deepEqual(await liveIndexes(bedId, 'SafeSight'), [1, 2, 3])
  assert.deepEqual(await liveIndexes(bedId, 'Air Quality'), [1])
  // Types are numbered independently: index 1 exists in both.
  assert.deepEqual(await liveIndexes(bedId, 'HEMIR'), [])
})

test('derivation is idempotent: running it again creates nothing', async () => {
  const bedId = await seedBed()
  await derive(bedId, { safesightCameras: 2 })
  const second = await derive(bedId, { safesightCameras: 2 })
  assert.equal(second.length, 0, 'a second run must create no slots')
  assert.deepEqual(await liveIndexes(bedId, 'SafeSight'), [1, 2])
})

test('raising a count derives only the shortfall', async () => {
  const bedId = await seedBed()
  await derive(bedId, { safesightCameras: 2 })
  const more = await derive(bedId, { safesightCameras: 5 })
  assert.equal(more.length, 3, 'only the three missing slots')
  assert.deepEqual(await liveIndexes(bedId, 'SafeSight'), [1, 2, 3, 4, 5])
})

test('AN INDEX IS REISSUED after its slot is removed, and live indexes stay 1..N', async () => {
  const bedId = await seedBed()
  await derive(bedId, { safesightCameras: 3 })
  assert.deepEqual(await liveIndexes(bedId, 'SafeSight'), [1, 2, 3])

  // A downward correction soft deletes the HIGHEST index first. Reproduced
  // here directly rather than through the route, because this test is about
  // what derivation does next.
  const { units } = await loadUnits(db, bedId)
  const highest = units.filter(u => u.type === 'SafeSight').sort((a, b) => b.index - a.index)[0]
  const { error } = await db.from('records')
    .update({ deleted_at: new Date().toISOString() }).eq('id', highest.id)
  assert.equal(error, null)
  assert.deepEqual(await liveIndexes(bedId, 'SafeSight'), [1, 2])

  const restored = await derive(bedId, { safesightCameras: 3 })
  assert.equal(restored.length, 1)
  assert.equal(restored[0].index, 3,
    'the decided behaviour is REISSUE: the restored slot takes the removed slot\'s number back')
  assert.deepEqual(await liveIndexes(bedId, 'SafeSight'), [1, 2, 3],
    'live indexes must remain exactly 1..N, which is what the units table displays')

  // And the consequence that Round 18 has to know about: a dead slot and a
  // live slot now share an index, so history must key on the record id.
  const { data: all } = await db.from('records')
    .select('id, deleted_at, record_revisions(payload)')
    .eq('parent_record_id', bedId).eq('record_type', 'unit')
  const three = all.filter(u => (u.record_revisions ?? []).some(r => r.payload?.unitIndex === 3))
  assert.equal(three.length, 2, 'index 3 is held by two records, one dead and one live')
  assert.equal(three.filter(u => u.deleted_at).length, 1)
  assert.equal(three.filter(u => !u.deleted_at).length, 1)
})

test('a count of zero derives nothing and leaves existing slots alone', async () => {
  const bedId = await seedBed()
  await derive(bedId, { safesightCameras: 2 })
  const none = await derive(bedId, {})
  assert.equal(none.length, 0)
  // Derivation never removes: reducing a count is the correction path's job,
  // and it refuses to remove anything that is not Planned.
  assert.deepEqual(await liveIndexes(bedId, 'SafeSight'), [1, 2])
})
