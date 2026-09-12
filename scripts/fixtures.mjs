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
// ── EVERY TAG THIS RUN CREATED, NOT JUST THE LAST ────────────────────────
//
// A REGRESSION THE TAG-SCOPING CHANGE ITSELF INTRODUCED, found by counting
// residue and fixed here rather than left. freshOpportunity OVERWRITES the id
// file, so a probe that builds two fixtures under two tags - which
// probe-readonly-view does, readonly-probe then readonly-approver - left the
// FIRST tag unswept. Owner-scoping used to catch it by accident; tag-scoping
// does not, and 12 records accumulated before anybody counted.
//
// This holds TAGS, which are identities, not a list of records. Verification
// 11's objection is to a file that says WHICH RECORDS a run made and goes
// stale on a retry; the set each tag names is still enumerated live.
const TAGS = '/private/tmp/claude-501/-Users-johnfryatt-terminus-tms/2199d6a8-d1e7-4e46-89a0-2df47e6eac14/scratchpad/fixture-tags.json'

// ── A RECORD HANDED AWAY LEAVES tearDown's REACH ─────────────────────────
//
// P2.5. tearDown's candidate set is `owner_id = TEST_USER_ID`, which is what
// makes reaching a business record impossible rather than unlikely. Every
// ownership probe hands a record to another owner - that is the state being
// tested - and the moment it does, the record is outside that set and CANNOT
// BE SWEPT. Measured three times in one phase: the create-from round left 38
// such records, and P2.3 left one on each of its first two runs.
//
// The fix is not to widen the owner filter, which would give up the guarantee.
// It is that HANDING A RECORD OVER IS A LEDGERED ACT: the id is written down
// at the moment ownership moves, and teardown sweeps what the run handed away
// as well as what it still owns.
const HANDOVERS = '/private/tmp/claude-501/-Users-johnfryatt-terminus-tms/2199d6a8-d1e7-4e46-89a0-2df47e6eac14/scratchpad/fixture-handovers.json'

function rememberHandover(recordId) {
  let all = []
  try { all = JSON.parse(readFileSync(HANDOVERS, 'utf8')) } catch { /* first of the run */ }
  if (!all.includes(recordId)) { all.push(recordId); writeFileSync(HANDOVERS, JSON.stringify(all, null, 2)) }
}

/**
 * Hand a record to another owner AND ledger it, so teardown can still reach it.
 *
 * Probes must use this rather than updating owner_id directly, and the reason
 * below is CORRECTED: this docstring used to say a raw update moves the record
 * out of teardown's candidate set. It does not - the tag branch below reaches
 * handed-away records across owners, and was built for that.
 *
 * The real reason, measured 2026-09-10: that tag query carries no range and no
 * order, so PostgREST caps it at 1000 rows. On this database that is 1000 of
 * 23,066 matching rows - 4% - and it reached 0 of the 25 residue records a
 * gate-stage probe had left. The LEDGER does not go through that query, so
 * handOver is reached whatever the tag branch can see.
 *
 * The superseded wording is left visible rather than deleted: a premise failed
 * and the guidance is re-taken, not re-weighed (Verification 29).
 */
export async function handOver(recordId, newOwnerId) {
  const db = admin()
  const { error } = await db.from('records').update({ owner_id: newOwnerId }).eq('id', recordId).select('id')
  if (error) throw new Error(`handOver(${recordId}): ${error.message}`)
  rememberHandover(recordId)
  return recordId
}

export function ledgeredHandovers() {
  try { return JSON.parse(readFileSync(HANDOVERS, 'utf8')) } catch { return [] }
}

function rememberTag(tag) {
  if (!tag) return
  let all = []
  try { all = JSON.parse(readFileSync(TAGS, 'utf8')) } catch { /* first fixture of the run */ }
  if (!all.includes(tag)) { all.push(tag); writeFileSync(TAGS, JSON.stringify(all, null, 2)) }
}

// The account the probes act as. Read from the session rather than written
// down, so a re-issued test user cannot leave a stale id here quietly
// tearing down nothing.
const TEST_USER_ID = SESSION.user?.id
if (!TEST_USER_ID) throw new Error('session-ref.json carries no user id; sign in again')

const admin = () => createClient(ENV.SUPABASE_URL, ENV.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })

// EXPORTED, Round 41 W6. A probe that built its own client from process.env
// worked under `node --env-file=.env` and died under the gate, which spawns
// probes with a bare `node`. The env is read from the file HERE, once, and
// every probe that needs the service role now asks for the same client rather
// than each discovering its own way to find the key.
export { admin }

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
  // COMPARED BY TYPE, not by Number(). Round 41 W3: this read
  // `Number(payload[k]) !== Number(expected[k])`, which was right while every
  // default was numeric and BREAKS ON THE FIRST ONE THAT IS NOT - Number('USD')
  // is NaN, NaN !== NaN is true, and every currency key would report as "a
  // default that is not the configured one" on every fixture in the suite.
  //
  // A false failure rather than a false pass, so it would have been noticed
  // immediately, but it is the same assumption the reader carried one layer
  // down and it is worth fixing in the same change rather than after the gate
  // goes red. Architecture 8: correct for every caller that exists.
  const same = (a, b) => {
    const na = Number(a), nb = Number(b);
    return (Number.isFinite(na) && Number.isFinite(nb)) ? na === nb : String(a) === String(b);
  };
  const wrong = Object.keys(expected).filter((k) => !same(payload[k], expected[k]))
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
  rememberTag(tag)
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
  rememberTag(tag)
  return state
}

// ─────────────────────────────────────────────────────────────
// Teardown, enumerated from the DATABASE by TAG
// ─────────────────────────────────────────────────────────────
//
// Not from walk-ids.json, and not from any file. Verification 11: a bookkeeping
// file records what a run MEANT to create, and a rebuild, a retry or a killed
// run leaves records it no longer names.
//
// ── SUPERSEDED, 2026-09-08, and the old reasoning is left visible ─────
//
// This scoped by OWNER, and justified it in these words:
//
//   "The test account owns nothing the business created, so 'every live
//    record owned by the test account' is the complete set by construction."
//
// THE PREMISE IS FALSE, and Verification 19 names the shape: a category name
// asserting a property nobody measured. It is the complete set only while
// nothing ELSE owns live records under that account. The moment two rounds'
// fixtures are live at once, "everything I own" is not "everything I made".
//
// MEASURED: during the create-from ownership round, a single gate run soft
// deleted 66 of that round's evidence records in ONE bulk update, while
// probe-commercial-gate printed "2 soft-deleted". The estate's own method is
// that data changes are proposed before they are applied; this one applied on
// every gate run, unproposed and unreported.
//
// So the decision is RE-TAKEN rather than re-weighed (Verification 29): the
// owner is now the CANDIDATE set, which is cheap to query and can never reach
// a record the business owns, and the TAG is the SELECTOR. Both are required.
//
// THE FILE SUPPLIES THE TAG; THE DATABASE SUPPLIES THE RECORDS. That is the
// distinction Verification 11 is actually about. Its objection to a file is
// that a file lists WHICH RECORDS a run meant to create and goes stale on a
// rebuild or a retry. A tag is the run's identity, not its inventory, and the
// set it names is enumerated live.
//
// AND WHERE NO TAG CAN BE DETERMINED, THIS REFUSES. It does not fall back to
// sweeping by owner, because that fallback IS the defect.
//
// SOFT delete only, and reference_number_counters is never touched: records
// carries ON DELETE RESTRICT from record_revisions, approvals and audit_log, and
// a counter deleted while a soft-deleted record still holds a code from it
// restarts and collides.
// The tags this run is entitled to remove. An explicit argument wins; failing
// that, the tags THIS run's own fixture files record. Nothing else is swept.
export function tagsToSweep(explicit) {
  // An explicit ARRAY is the caller stating the set outright, empty included.
  // `tearDown([])` therefore means "sweep nothing", and reaches the refusal.
  // Without this the refusal is unreachable whenever a fixture file exists,
  // which is almost always - an untestable guard is Verification 9's own case.
  if (Array.isArray(explicit)) return [...new Set(explicit.filter(Boolean))]
  if (explicit) return [explicit]
  const tags = []
  // Every tag this run recorded, then the two id files as a fallback for a run
  // that predates the ledger.
  try { tags.push(...JSON.parse(readFileSync(TAGS, 'utf8'))) } catch { /* none yet */ }
  for (const f of [IDS, TB_IDS]) {
    try { const t = JSON.parse(readFileSync(f, 'utf8')).tag; if (t) tags.push(t) }
    catch { /* a run that created no fixture of this kind has no file */ }
  }
  return [...new Set(tags.filter(Boolean))]
}

// ── EVERY ROW, NOT THE FIRST PAGE OF THEM ────────────────────────────────
//
// A1, 2026-09-10. PostgREST answers an unranged select with its first 1,000
// rows and no indication that it did so. Measured on this database: the tag
// branch below matched 23,210 revision rows covering 7,938 records and the
// query returned 1,000 rows covering 414 - so teardown was deciding what to
// sweep from 5.2% of the records it was asking about.
//
// THE PAGE CAP WAS HIDING A SECOND FAULT. Range paging without a stable
// ORDER BY can return a row twice or skip it entirely, because an unordered
// query has no obligation to be consistent between requests. Every helper here
// orders by `id`, which is unique on all four tables teardown touches. Paging
// without that is not a fix; it is the same bug with more round trips.
const PAGE_SIZE = 1000
const IN_CHUNK = 150
const MAX_PAGES = 500

/**
 * F5's HEADROOM RECORD. The slowest single statement any paged scan has run
 * this process, so a caller can assert margin against the statement timeout
 * rather than only that today's run happened to finish.
 *
 * A test that passes because the table is small enough TODAY is the shape F5
 * was: it passed for two rounds while its failing case climbed 15,957 to
 * 19,887ms, and nothing in the suite was watching the number.
 */
export const pageTiming = { slowestMs: 0, slowestWhat: null, pages: 0 }

/**
 * F5: how many tags travel in one `.or()`, and therefore how much work one
 * STATEMENT does. Exported because the guard in teardown-scoping.test.mjs
 * times the real shape, and a guard that retypes this number is timing a
 * statement the code does not run.
 */
export const TAG_CHUNK_SIZE = 6

export async function pagedSelect(makeQuery, what) {
  const rows = []
  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE_SIZE
    const t0 = Date.now()
    const { data, error } = await makeQuery()
      .order('id', { ascending: true }).range(from, from + PAGE_SIZE - 1)
    const ms = Date.now() - t0
    pageTiming.pages++
    if (ms > pageTiming.slowestMs) { pageTiming.slowestMs = ms; pageTiming.slowestWhat = `${what} page ${page}` }
    if (error) throw new Error(`${what} (page ${page}, ${ms}ms): ${error.message}`)
    rows.push(...data)
    if (data.length < PAGE_SIZE) return rows
  }
  throw new Error(`${what}: still returning full pages after ${MAX_PAGES}; refusing to loop`)
}

// An `.in()` list travels in the URL, so a long one fails on length rather than
// on the cap. Different limit, same class: the query answers about less than it
// was asked. Chunked and paged, because a chunk can itself exceed a page.
export async function pagedSelectIn(table, cols, column, values, what, modify = (q) => q) {
  const out = []
  for (let i = 0; i < values.length; i += IN_CHUNK) {
    const chunk = values.slice(i, i + IN_CHUNK)
    out.push(...await pagedSelect(
      () => modify(admin().from(table).select(cols).in(column, chunk)), `${what}[${i}]`))
  }
  return out
}

// A write carries the same list in the same URL and has the same limit.
async function chunkedWrite(table, column, values, apply, what) {
  for (let i = 0; i < values.length; i += IN_CHUNK) {
    const { error } = await apply(admin().from(table)).in(column, values.slice(i, i + IN_CHUNK))
    if (error) throw new Error(`${what}[${i}]: ${error.message}`)
  }
}

export async function tearDown(explicitTag) {
  const db = admin()
  const tags = tagsToSweep(explicitTag)
  if (!tags.length) {
    throw new Error(
      'tearDown: no tag to scope by, and it will NOT fall back to sweeping by owner. ' +
      'That fallback destroyed 66 records of another round mid-gate. ' +
      'Pass a tag, or run a fixture helper first so a tag is recorded.')
  }

  // ── OWNER IS THE CANDIDATE SET, TAG IS THE SELECTOR ──────────────────
  //
  // The owner filter is kept because it is cheap and because it makes reaching
  // a record the business owns impossible rather than merely unlikely. It is no
  // longer what decides WHAT goes.
  const candidates = await pagedSelect(() => db.from('records')
    .select('id, record_type, reference_code, parent_record_id')
    .eq('owner_id', TEST_USER_ID).is('deleted_at', null), 'candidates')

  // The tag reaches the DATABASE through the payload name: every fixture
  // helper writes `${tag} Contact`, `${tag} Opportunity`, `${tag} Account`,
  // `${tag} Test Bed`. So the selector is read from the record, not the file.
  // Its population is every REVISION of every candidate, so it passes the cap
  // long before the candidate count does: a few hundred fixtures with a
  // handful of revisions each is already over. This one was never the reported
  // fault and had the same one.
  const revs = await pagedSelectIn('record_revisions', 'id, record_id, payload',
    'record_id', candidates.map((r) => r.id), 'revs')
  const named = new Map()
  for (const r of revs) if (!named.has(r.record_id)) named.set(r.record_id, r.payload?.name ?? '')
  const mine = (id) => tags.some((t) => String(named.get(id) ?? '').startsWith(t))

  // A UNIT CARRIES NO NAME, so it can never match a tag. It is reached as a
  // CHILD of a record that does. Build discipline 8: enumerate everything the
  // actor writes, not the part the selector happens to see.
  // ── HANDED-AWAY RECORDS, FOUND STRUCTURALLY ──────────────────────────
  //
  // A ledger only works if every caller remembers to write to it, and FOURTEEN
  // probes hand ownership over by a raw update. Converting all fourteen is the
  // multi-site change this estate keeps being caught by, and most of them are
  // historical round scripts that will never run again.
  //
  // So the tag does the work here too. A record carrying THIS RUN'S TAG is this
  // run's whatever it now belongs to, and the tag is a stronger safety net than
  // the owner filter it replaces on this branch: a business record can never
  // carry one, where it could in principle be owned by the test account.
  //
  // handOver() and its ledger remain the explicit path for new probes - it is
  // better hygiene to say so at the moment ownership moves - but teardown no
  // longer depends on anyone having used it.
  const ledgered = ledgeredHandovers()
  // THE ONE THE ROUND WAS CALLED FOR. Also `.data ?? []` before, which is the
  // idiom Verification 8 names: it silences the error path at exactly the point
  // where the answer becomes a number somebody quotes. Here it was worse than
  // that, because there was no error to silence - the query succeeded and
  // answered truthfully about a page nobody asked for.
  //
  // The tag list travels in the `.or()` string, so it is chunked for the same
  // reason `.in()` is: 30 tags is 967 characters today and nothing stops it
  // growing.
  // F5: 25 cost ~1,459ms warm per statement, and roughly 6x that cold, which
  // is past the 8s statement timeout. 6 costs ~578ms warm. More statements,
  // each far under the ceiling, same rows.
  const TAG_CHUNK = TAG_CHUNK_SIZE
  const taggedRevs = []
  for (let i = 0; i < tags.length; i += TAG_CHUNK) {
    const or = tags.slice(i, i + TAG_CHUNK).map((t) => `payload->>name.ilike.${t}%`).join(',')
    // ── F5's HARDENING, AND A MEASUREMENT I GOT WRONG FIRST ──────────────
    //
    // `payload` was selected here and never read - only `record_id` is taken
    // off these rows - so dropping it is free. It is NOT the fix, and the
    // superseded reasoning is left visible because the error is the useful
    // part:
    //
    //   ~~with payload 7,879ms, without 1,308ms, SIX TIMES~~
    //
    // Those two numbers are real and the conclusion was false. They were run
    // in that order, so the first paid for a COLD CACHE and the second did
    // not. Alternated and warm, the honest ratio is **1.17x**:
    //
    //     without payload   1107, 1077, 1079, 1080   median 1080ms
    //     with payload      1197, 1260, 1161, 1335   median 1260ms
    //
    // Caught by the calibration, not by re-reading: the guard below was
    // supposed to fire when the defect was reinjected and it did not.
    //
    // ── WHAT THE 7,879ms ACTUALLY WAS, AND WHY IT MATTERS ────────────────
    //
    // The cold first statement. Which is exactly what a gate run hits: the
    // first teardown scan of a fresh process, against a cold cache, on a
    // table that grows daily. That is F5.
    //
    // THE TIMEOUT IS PER STATEMENT, so the fix is to bound per-statement
    // work. Measured, one page against the number of tags in the OR:
    //
    //     25 tags  1,459ms      6 tags   578ms
    //     12 tags  1,025ms      3 tags   410ms
    //                           1 tag    214ms
    //
    // Roughly linear, so TAG_CHUNK is the lever. Total work is unchanged -
    // the same rows are matched over more statements - and the coverage
    // claim is untouched, which is the only kind of fix available here.
    taggedRevs.push(...await pagedSelect(
      () => db.from('record_revisions').select('id, record_id').or(or), `taggedRevs[${i}]`))
  }
  const taggedIds = [...new Set(taggedRevs.map((r) => r.record_id))]
  const candidateIds = new Set(candidates.map((c) => c.id))
  const reachIds = [...new Set([...taggedIds, ...ledgered])].filter((id) => !candidateIds.has(id))
  // `deleted_at` is filtered AT THE QUERY, not afterwards. Filtering in JS on a
  // column the select does not name reads as a filter and keeps everything,
  // which is how a soft-deleted record gets torn down a second time.
  const handedRows = await pagedSelectIn('records',
    'id, record_type, reference_code, parent_record_id', 'id', reachIds, 'handedRows',
    (q) => q.is('deleted_at', null))
  const handed = ledgered

  const direct = [...candidates.filter((r) => mine(r.id)), ...handedRows]
  const directIds = new Set(direct.map((r) => r.id))
  const children = candidates.filter((r) => !directIds.has(r.id)
    && r.parent_record_id && directIds.has(r.parent_record_id))
  const live = [...direct, ...children]

  if (live.length) {
    // ── A FROZEN RECORD CANNOT BE TORN DOWN. Round 41 ────────────────────
    //
    // refuse_write_while_frozen() refuses every write to a record with an open
    // transition request, INCLUDING the soft delete, and for every role. A
    // probe that dies between raising a request and withdrawing it therefore
    // leaves a record teardown cannot remove, and the next run fails on the
    // residue rather than on its own work.
    //
    // Found by exactly that: a crashed run of probe-commercial-gate left an
    // open request, and the next teardown threw PT423 with the trigger's
    // message and no explanation of what a teardown was doing hitting it.
    //
    // THE REQUEST IS CLOSED, NOT DELETED. It is the audit trail of what the
    // probe did, and Verification 11 is that fixtures are soft deleted.
    const ids = live.map((r) => r.id)
    const open = await pagedSelectIn('transition_requests', 'id', 'record_id', ids,
      'open requests', (q) => q.eq('status', 'open'))
    if (open.length) {
      await chunkedWrite('transition_requests', 'id', open.map((r) => r.id), (q) => q.update({
        status: 'withdrawn',
        closed_by: TEST_USER_ID,
        closed_at: new Date().toISOString(),
        close_reason: 'teardown: the fixture this request froze is being removed',
      }), 'close requests')
    }

    // ── A RECORD-SCOPED APPROVER SEAT IS NOT A RECORD ────────────────────
    //
    // Round 41, 2026-09-03. track_approvers rows scoped to a fixture record are
    // written by three probes and were invisible to this teardown, which
    // enumerates records by owner. A crashed run left four of them pointing at
    // torn-down fixtures, granting approval rights on records that no longer
    // exist.
    //
    // Build discipline 8: enumerate everything the actor writes, not the one
    // thing the failing check named. Scoped to the ids being torn down, so a
    // real configuration seat is never touched.
    await chunkedWrite('track_approvers', 'record_id', ids, (q) => q.delete(), 'seats')

    const stamp = new Date().toISOString()
    await chunkedWrite('records', 'id', ids, (q) => q.update({ deleted_at: stamp }), 'soft delete')
  }

  // Re-query rather than trusting the update's own result, SCOPED TO THE SAME
  // SET. Asserting owner-wide zero here would throw the moment another round
  // has a live fixture, which is the very state this rescoping exists to
  // permit - and a teardown that fails on somebody else's records would push
  // the next person straight back to sweeping by owner.
  const still = await pagedSelectIn('records', 'id, record_type', 'id',
    live.map((r) => r.id), 'still live', (q) => q.is('deleted_at', null))
  if (still.length) {
    throw new Error(`teardown left ${still.length} live records: ${still.map((r) => r.record_type).join(', ')}`)
  }
  // The ledger is cleared once its records are gone, so a later run cannot
  // inherit ids it never created.
  if (handed.length) { try { writeFileSync(HANDOVERS, JSON.stringify([], null, 2)) } catch { /* best effort */ } }
  return { removed: live, remaining: 0, tags, handedBack: handedRows.length }
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
  const { removed, tags } = await tearDown(tag)
  console.log(`torn down ${removed.length} records tagged ${tags.join(', ')}:`)
  for (const r of removed) console.log(`  ${r.record_type} ${r.id} ${r.reference_code ?? ''}`)
  console.log('re-queried within that tag: 0 live remain. reference_number_counters untouched.')
} else if (command) {
  // The old single-argument form created an Opportunity. Keeping it silently
  // would mean `fixtures.mjs teardown` creating a fixture called "teardown".
  console.error(`unknown command "${command}". Use: opportunity <tag> | test-bed <tag> | teardown`)
  process.exit(1)
}
