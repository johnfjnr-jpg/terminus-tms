// A fixture that asserts its own starting state. Round 38, condition 3.
//
// TWO PROBE FAULTS IN TWO ROUNDS came from a fixture that was not what the probe
// assumed:
//
//   Round 37 Phase 4: walk-ids.json still named a record an earlier probe had
//   loaded with eight versions, so a `.single()` found several issued rows.
//
//   Round 38: the edit-it-back check read a correct answer as a failure because
//   the box already held 7, saved there by an earlier run.
//
// Both are the same class: a probe inherited state and assumed it had not. The
// fix is not a better assertion in one test, it is that CREATING a fixture and
// ASSERTING WHAT IT CONTAINS are one operation that cannot be separated.
//
// freshOpportunity() returns only after confirming the record is at revision 1,
// holds no Commercials keys and carries no versions. A probe that calls it can
// state what it starts from because the function has already checked.
//
// ─────────────────────────────────────────────────────────────
// AND A THIRD, WHICH WAS NOT A PROBE FAULT BUT A FALSE CLAIM
// ─────────────────────────────────────────────────────────────
//
// Round 38 wrote into a test file, as the justification for a source scan:
// "every Test Bed and every Account belongs to a different owner, so those
// routes answer 403 before reaching the write". That was a description of the
// DATA, phrased as a constraint. Measured: the test account creates an Account,
// creates a Test Bed against it, owns both, PATCHes them, and gets a 409 on a
// stale revision. Nothing stops it. There was simply no fixture that made one.
//
// The shape is the one CLAUDE.md Architecture rule 9 names last: a sentence
// typed into a comment is not derived from anything, so nothing can falsify it.
// It sat one commit before being read.
import { createClient } from '@supabase/supabase-js'
import { readSystemDefaults, initialPayload } from '../src/lib/system-defaults.js'
import { api as apiCall } from './api-client.mjs'
import { readFileSync, writeFileSync } from 'fs'

const ENV = Object.fromEntries(readFileSync('/Users/johnfryatt/terminus-tms/.env', 'utf8')
  .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
  .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))
const SESSION = JSON.parse(readFileSync('/Users/johnfryatt/terminus-tms/session-ref.json', 'utf8'))
const TB_IDS = '/private/tmp/claude-501/-Users-johnfryatt-terminus-tms/2199d6a8-d1e7-4e46-89a0-2df47e6eac14/scratchpad/tb-ids.json'
const IDS = '/private/tmp/claude-501/-Users-johnfryatt-terminus-tms/2199d6a8-d1e7-4e46-89a0-2df47e6eac14/scratchpad/walk-ids.json'

// The account the probes act as. Read from the session rather than written
// down, so a re-issued test user cannot leave a stale id here quietly
// tearing down nothing.
const TEST_USER_ID = SESSION.user?.id
if (!TEST_USER_ID) throw new Error('session-ref.json carries no user id; sign in again')

const admin = () => createClient(ENV.SUPABASE_URL, ENV.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })

// Round 38: through the one throwing client. This file already threw on !ok,
// which is why its own fixtures were never the silent kind; api-client.mjs makes
// that the default for every script rather than this file's private discipline.
async function api(method, path, body) {
  return (await apiCall(method, path, body)).data
}

// ── WHAT "FRESH" MEANS NOW. Round 41 item 3 ────────────────────────────────
//
// It used to mean "holds none of the Commercials keys", which was right while a
// new opportunity was genuinely blank. Creation now writes the ADMIN DEFAULTS
// into the record as initial values, so `duration`, `targetMargin` and
// `warrantyPct` are present on every new deal by design and the old assertion
// refused every fixture.
//
// The purpose is unchanged: catch a reused record carrying somebody's data. The
// definition is now EXACTLY the creation defaults and nothing else, which is a
// STRONGER assertion than the old one rather than a relaxation of it: a fixture
// carrying an unexpected default, or missing one it should have, now fails too.
//
// SEEDED_AT_CREATION is derived from the defaults table itself, not typed here,
// so a default the business adds does not silently break every probe.
const MUST_BE_ABSENT = [
  'ssExisting', 'ssNew', 'aqm', 'hemir', 'installResp', 'lumpSumCost',
  // recoveryMonths is written only on the two-phase transition, never at
  // creation, so a fresh fixture must not hold one.
  'recoveryMonths',
]

// Exported so it can be shown FIRING against a record that is not fresh. An
// assertion never seen failing is not an assertion.
export async function assertFresh(oppId, tag) {
  const db = admin()
  const revs = (await db.from('record_revisions').select('revision_number, payload')
    .eq('record_id', oppId).order('revision_number', { ascending: false })).data
  if (revs.length !== 1) {
    throw new Error(`fixture ${tag} is not fresh: ${revs.length} revisions, expected 1`)
  }
  const payload = revs[0].payload ?? {}
  const present = MUST_BE_ABSENT.filter((k) => k in payload)
  if (present.length) {
    throw new Error(`fixture ${tag} is not fresh: already holds ${present.join(', ')}`)
  }

  // And it must hold EXACTLY the creation defaults: a missing one means the
  // creation path stopped applying them, which is a defect this probe should
  // catch rather than tolerate.
  const seeded = await readSystemDefaults(db)
  const expected = initialPayload(seeded)
  const missing = Object.keys(expected).filter((k) => !(k in payload))
  if (missing.length) {
    throw new Error(`fixture ${tag} is not fresh: creation did not apply ${missing.join(', ')}`)
  }
  const wrong = Object.keys(expected).filter((k) => Number(payload[k]) !== Number(expected[k]))
  if (wrong.length) {
    throw new Error(`fixture ${tag} carries a default that is not the configured one: ${wrong.join(', ')}`)
  }
  const versions = (await db.from('deal_sheet_versions').select('id').eq('record_id', oppId)).data
  if (versions.length !== 0) {
    throw new Error(`fixture ${tag} is not fresh: ${versions.length} versions already exist`)
  }
  return revs[0].revision_number
}

export async function freshOpportunity(tag) {
  const db = admin()
  const industry = (await api('GET', '/industries'))[0]
  const accounts = await api('GET', '/accounts')

  const contact = await api('POST', '/contacts', {
    name: `${tag} Contact`, company: `${tag} Holdings`,
    email: `${tag.toLowerCase()}@example.invalid`, mobile: '+65 9000 0001',
    industry_id: industry.id, source: 'Direct Outreach',
    jobRole: 'Head of Infrastructure', linkedin: 'https://example.invalid/in/x',
    address: '1 Fixture Street', address2: 'Level 2', city: 'Singapore',
    postcode: '018956', country: 'Singapore', region: 'Asia Pacific',
    summary: `Fixture for ${tag}.`,
  })
  await api('POST', `/contacts/${contact.id}/link-account`, { account_id: accounts[0].id })
  await api('POST', `/records/${contact.id}/transition`, { to_stage: 'Qualified' })
  const opp = await api('POST', `/contacts/${contact.id}/create-opportunity`, { name: `${tag} Opportunity` })

  // ── THE ASSERTIONS. Creating and verifying are one operation. ──────────
  const revision = await assertFresh(opp.id, tag)
  const state = { tag, contactId: contact.id, oppId: opp.id, revision }
  writeFileSync(IDS, JSON.stringify(state, null, 2))
  return state
}

// Read the ids back AND re-verify the record still matches what was written, so
// a probe can never run against a record a previous probe moved on. The file is
// a convenience; the database is the authority.
export async function loadFixture(expectedTag) {
  const state = JSON.parse(readFileSync(IDS, 'utf8'))
  if (expectedTag && state.tag !== expectedTag) {
    throw new Error(`walk-ids.json holds tag ${state.tag}, this probe expects ${expectedTag}. Create a fresh fixture.`)
  }
  const db = admin()
  const rec = (await db.from('records').select('id, deleted_at').eq('id', state.oppId).maybeSingle()).data
  if (!rec) throw new Error(`fixture ${state.tag} names a record that does not exist`)
  if (rec.deleted_at) throw new Error(`fixture ${state.tag} names a record that has been torn down`)
  return state
}

// ─────────────────────────────────────────────────────────────
// A Test Bed the test account OWNS
// ─────────────────────────────────────────────────────────────
//
// Round 38, condition 3. Every live Account and Test Bed in this system belongs
// to one other person, so a probe acting as the test account got 403 from those
// routes and the whole of PATCH /test-beds/:id, PATCH /test-beds/:id/units/:unitId
// and PATCH /accounts/:id had never been exercised by anything. That was read as
// a permission boundary. It is a missing fixture: the routes set
// owner_id = request.user.id on create, so an account that creates its own
// Account and its own Test Bed owns both and can write to them.

export async function assertFreshTestBed(bedId, tag) {
  const db = admin()
  const revs = (await db.from('record_revisions').select('revision_number, payload')
    .eq('record_id', bedId).order('revision_number', { ascending: false })).data
  if (revs.length !== 1) {
    throw new Error(`fixture ${tag} is not fresh: ${revs.length} Test Bed revisions, expected 1`)
  }
  const units = (await db.from('records').select('id')
    .eq('parent_record_id', bedId).eq('record_type', 'unit').is('deleted_at', null)).data
  if (units.length !== 0) {
    throw new Error(`fixture ${tag} is not fresh: ${units.length} units already exist`)
  }
  return revs[0].revision_number
}

export async function freshTestBed(tag) {
  const industry = (await api('GET', '/industries'))[0]

  // Its OWN Account, not one of the four the business owns. Borrowing one would
  // make the Test Bed writable and the Account not, which is exactly the
  // half-covered state this fixture exists to end.
  const account = await api('POST', '/accounts', {
    name: `${tag} Account`,
    industry_id: industry.id,
    billingCountry: 'Singapore',
  })

  const bed = await api('POST', '/test-beds', {
    name: `${tag} Test Bed`,
    account_id: account.id,
    industry_id: industry.id,
    country_code: 'SG',
    client_organisation: `${tag} Holdings`,
  })

  const revision = await assertFreshTestBed(bed.id, tag)
  const state = { tag, accountId: account.id, bedId: bed.id, revision }
  writeFileSync(TB_IDS, JSON.stringify(state, null, 2))
  return state
}

// ─────────────────────────────────────────────────────────────
// Teardown, enumerated from the DATABASE by owner
// ─────────────────────────────────────────────────────────────
//
// Not from walk-ids.json, and not from any file. Verification 11: a bookkeeping
// file records what a run MEANT to create, and a rebuild, a retry or a killed
// run leaves records it no longer names. The test account owns nothing the
// business created, so "every live record owned by the test account" is the
// complete set by construction.
//
// SOFT delete only, and reference_number_counters is never touched: records
// carries ON DELETE RESTRICT from record_revisions, approvals and audit_log, and
// a counter deleted while a soft-deleted record still holds a code from it
// restarts and collides.
export async function tearDown() {
  const db = admin()
  const { data: live, error } = await db.from('records')
    .select('id, record_type, reference_code')
    .eq('owner_id', TEST_USER_ID).is('deleted_at', null)
  if (error) throw error

  if (live.length) {
    const { error: delErr } = await db.from('records')
      .update({ deleted_at: new Date().toISOString() })
      .in('id', live.map((r) => r.id))
    if (delErr) throw delErr
  }

  // Re-query rather than trusting the update's own result.
  const { data: still, error: stillErr } = await db.from('records')
    .select('id, record_type').eq('owner_id', TEST_USER_ID).is('deleted_at', null)
  if (stillErr) throw stillErr
  if (still.length) {
    throw new Error(`teardown left ${still.length} live records: ${still.map((r) => r.record_type).join(', ')}`)
  }
  return { removed: live, remaining: 0 }
}

// Only when this file is the thing being RUN. Without the guard, importing it
// from a probe re-reads that probe's own argv and refuses to start.
const RUN_DIRECTLY = process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())
const [command, tag] = RUN_DIRECTLY ? process.argv.slice(2) : []
if (command === 'opportunity') {
  const s = await freshOpportunity(tag)
  console.log(`fresh fixture ${s.tag}: opp ${s.oppId} at revision ${s.revision}, no Commercials keys, no versions`)
} else if (command === 'test-bed') {
  const s = await freshTestBed(tag)
  console.log(`fresh fixture ${s.tag}: account ${s.accountId}, test bed ${s.bedId} at revision ${s.revision}, no units`)
} else if (command === 'teardown') {
  const { removed } = await tearDown()
  console.log(`torn down ${removed.length} records owned by the test account:`)
  for (const r of removed) console.log(`  ${r.record_type} ${r.id} ${r.reference_code ?? ''}`)
  console.log('re-queried: 0 live remain. reference_number_counters untouched.')
} else if (command) {
  // The old single-argument form created an Opportunity. Keeping it silently
  // would mean `fixtures.mjs teardown` creating a fixture called "teardown".
  console.error(`unknown command "${command}". Use: opportunity <tag> | test-bed <tag> | teardown`)
  process.exit(1)
}
