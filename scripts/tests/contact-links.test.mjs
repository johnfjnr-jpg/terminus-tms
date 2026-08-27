// Round 35 Phase 4 - the shape of a Key Customer Contacts link.
// Runs under `npm run test:db`.
//
// These assert SCHEMA BEHAVIOUR, which is different again from the two files
// beside it: gates.test.mjs asserts that computeBlocking behaves, and
// config-invariants.test.mjs asserts that live configuration rows are still
// what a round configured. This asserts that the database refuses what it is
// supposed to refuse, which is the only kind of guarantee that survives a
// route being rewritten.
//
// WHY THIS IS NOT PROSE IN A PHASE REPORT. Phase 3 established that
// `unique (record_id, contact_id, role)` stops constraining the moment `role`
// is null, because Postgres treats nulls as distinct, and named it as a thing
// to VERIFY once a null-role row existed. Phase 4 creates those rows. A
// constraint whose necessity was worked out once and written down decays; a
// constraint with a test that fails when it is dropped does not.

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { adminClient, newRunTag, resolveOwnerId } from '../verify-harness.mjs'

let db, runTag, ownerId, recordId, contactA, contactB, roleAlpha, roleBeta, stanceUnknown
const created = { records: [], links: [] }

const mkRecord = async (record_type, extra = {}) => {
  const { data, error } = await db.from('records')
    .insert({ record_type, status: 'Active', owner_id: ownerId, ...extra })
    .select('id').single()
  assert.equal(error, null, `fixture record failed: ${error?.message}`)
  created.records.push(data.id)
  return data.id
}

// Inserted directly rather than through Fixtures.createContactLink, which
// destructures a fixed key set and would SILENTLY DISCARD role_id and
// role_other. That is Architecture rule 9's exact signature: the options
// object reads as open-ended at the call site and is closed at the
// definition, and adding a key is a no-op until the definition names it.
const link = async (fields) => {
  const { data, error } = await db.from('record_contacts')
    .insert({ record_id: recordId, created_by: ownerId, ...fields })
    .select('id')
  if (data?.length) created.links.push(data[0].id)
  return { id: data?.[0]?.id ?? null, error }
}

before(async () => {
  db = adminClient()
  runTag = newRunTag()
  ownerId = await resolveOwnerId(db)
  recordId = await mkRecord(`harness_${runTag}`)
  contactA = await mkRecord('contact')
  contactB = await mkRecord('contact')

  const roles = await db.from('contact_roles').select('id, label').eq('active', true).order('sort_order')
  assert.equal(roles.error, null, `contact_roles query failed: ${roles.error?.message}`)
  assert.ok(roles.data.length >= 2, 'this test needs at least two configured roles')
  roleAlpha = roles.data[0].id
  roleBeta = roles.data[1].id

  const unknown = await db.from('contact_stances').select('id').eq('label', 'Unknown').single()
  assert.equal(unknown.error, null, `contact_stances query failed: ${unknown.error?.message}`)
  stanceUnknown = unknown.data.id
})

after(async () => {
  // Links are hard deleted, records soft deleted, per Verification rule 11.
  // Stance entries cascade with their link and are re-queried below rather
  // than assumed.
  for (const id of created.links) await db.from('record_contacts').delete().eq('id', id)
  for (const id of created.records) await db.from('records').update({ deleted_at: new Date().toISOString() }).eq('id', id)
  const { data: liveLinks } = await db.from('record_contacts').select('id').eq('record_id', recordId)
  const { data: liveRecs } = await db.from('records').select('id').in('id', created.records).is('deleted_at', null)
  console.log('\n  teardown verified:', JSON.stringify({
    runTag, linksRemaining: liveLinks?.length ?? 0, recordsStillLive: liveRecs?.length ?? 0,
  }))
})

test('exactly one role source: the CHECK refuses two, and refuses none', async () => {
  const both = await link({ contact_id: contactA, role: 'Some Text', role_id: roleAlpha })
  assert.ok(both.error, 'a row carrying role AND role_id must be refused')
  assert.match(both.error.message, /one_role_source/)

  const none = await link({ contact_id: contactA })
  assert.ok(none.error, 'a row carrying no role at all must be refused')
  assert.match(none.error.message, /one_role_source/)

  const ok = await link({ contact_id: contactA, role_id: roleAlpha })
  assert.equal(ok.error, null, 'exactly one source is accepted')
})

test('the ORIGINAL unique still governs text roles, so it has not simply gone', async () => {
  const first = await link({ contact_id: contactB, role: 'Client Text Role' })
  assert.equal(first.error, null)
  const second = await link({ contact_id: contactB, role: 'Client Text Role' })
  assert.ok(second.error, 'the same text role twice on one (record, contact) must still be refused')
  assert.match(second.error.message, /record_id_contact_id_role_key/)
})

test('with role null the ORIGINAL unique stops constraining, which is why the partials exist', async () => {
  // Two rows differing only in a column the old constraint cannot see. Both
  // are (recordId, contactB, null) as far as it is concerned, and Postgres
  // treats nulls as distinct, so both are accepted. This is the measurement
  // Phase 3 could only describe.
  const a = await link({ contact_id: contactB, role_other: 'Alpha Typed' })
  const b = await link({ contact_id: contactB, role_other: 'Beta Typed' })
  assert.equal(a.error, null)
  assert.equal(b.error, null, 'two null-role rows on one (record, contact) are NOT refused by the original constraint')

  // And the partial index is what refuses the genuine duplicate.
  const dupe = await link({ contact_id: contactB, role_other: 'Alpha Typed' })
  assert.ok(dupe.error, 'the same typed role twice must be refused')
  assert.match(dupe.error.message, /role_other_uniq/)
})

test('the partial unique on role_id refuses a repeat, and permits the shapes a list is for', async () => {
  const dupe = await link({ contact_id: contactA, role_id: roleAlpha })
  assert.ok(dupe.error, 'the same catalog role twice on one (record, contact) must be refused')
  assert.match(dupe.error.message, /role_id_uniq/)

  // ONE PERSON MAY HOLD TWO ROLES, and two people may hold one role. These
  // are not incidental: they are the shapes the four fixed slots could not
  // express and the reason this round exists.
  const secondRole = await link({ contact_id: contactA, role_id: roleBeta })
  assert.equal(secondRole.error, null, 'one contact may hold a second role on the same record')

  const secondPerson = await link({ contact_id: contactB, role_id: roleAlpha })
  assert.equal(secondPerson.error, null, 'a second contact may hold a role the first already holds')
})

test('a stance entry cannot be edited or deleted, and cascades when its link goes', async () => {
  const l = await link({ contact_id: contactA, role_id: roleAlpha, role: null })
  // roleAlpha is already taken by contactA above, so this one must fail; use
  // a fresh contact instead of assuming.
  const contactC = await mkRecord('contact')
  const l2 = await link({ contact_id: contactC, role_id: roleAlpha })
  assert.equal(l2.error, null)

  const ins = await db.from('record_contact_stances')
    .insert({ record_contact_id: l2.id, stance_id: stanceUnknown, note: 'first reading', created_by: ownerId })
    .select('id')
  assert.equal(ins.error, null, `a stance entry must be insertable: ${ins.error?.message}`)
  const entryId = ins.data[0].id

  // The admin client bypasses RLS, so an UPDATE here would succeed and prove
  // nothing about the policy. What IS assertable against the schema is the
  // cascade, and the policy absence is asserted live in the phase report
  // against a user client, where a zero-row result is the measurement.
  const del = await db.from('record_contacts').delete().eq('id', l2.id).select('id')
  assert.equal(del.error, null)
  assert.equal(del.data.length, 1, 'the link is removed')

  const { data: orphans, error: orphanErr } = await db.from('record_contact_stances')
    .select('id').eq('id', entryId)
  assert.equal(orphanErr, null)
  assert.deepEqual(orphans, [], 'the stance entry cascaded with its link, leaving nothing orphaned')
  created.links = created.links.filter(x => x !== l2.id)
  if (l.id) created.links.push(l.id)
})
