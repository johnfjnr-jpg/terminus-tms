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
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync } from 'fs'

const ENV = Object.fromEntries(readFileSync('/Users/johnfryatt/terminus-tms/.env', 'utf8')
  .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
  .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))
const SESSION = JSON.parse(readFileSync('/Users/johnfryatt/terminus-tms/session-ref.json', 'utf8'))
const BASE = 'http://localhost:3000'
const IDS = '/private/tmp/claude-501/-Users-johnfryatt-terminus-tms/2199d6a8-d1e7-4e46-89a0-2df47e6eac14/scratchpad/walk-ids.json'

const admin = () => createClient(ENV.SUPABASE_URL, ENV.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })

async function api(method, path, body) {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SESSION.access_token}` },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${JSON.stringify(data)}`)
  return data
}

// The Commercials keys a fresh fixture must NOT already hold. If any is
// present the fixture is not fresh, whatever the file says.
const MUST_BE_ABSENT = [
  'ssExisting', 'ssNew', 'aqm', 'hemir', 'duration', 'targetMargin',
  'warrantyPct', 'installResp', 'lumpSumCost', 'recoveryMonths',
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
  const present = MUST_BE_ABSENT.filter((k) => k in (revs[0].payload ?? {}))
  if (present.length) {
    throw new Error(`fixture ${tag} is not fresh: already holds ${present.join(', ')}`)
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

if (process.argv[2]) {
  const s = await freshOpportunity(process.argv[2])
  console.log(`fresh fixture ${s.tag}: opp ${s.oppId} at revision ${s.revision}, no Commercials keys, no versions`)
}
