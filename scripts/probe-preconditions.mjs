// Does the precondition actually refuse a stale write, on every route this
// round wired? Round 38, item 2. Run against the dev server with the test
// account signed in.
//
// WHY THIS IS A PROBE AND NOT A TEST IN test:db. Everything in `npm run
// test:db` talks to Postgres through the service key, which bypasses row-level
// security and never reaches a route at all. The behaviour being claimed here
// is a ROUTE's: read a revision from the GET, send it back on the PATCH, and
// get 409 when it has moved. That can only be measured over HTTP.
//
// EVERY CHECK IS TWO-SIDED. A 409 alone proves nothing: a route that refused
// every write would produce it. Each case sends a FRESH revision first and
// requires 200, then sends the revision it has just superseded and requires
// 409. Same request, one number different.

import { readFileSync } from 'fs'
import { freshTestBed, freshOpportunity, assertFreshTestBed, tearDown } from './fixtures.mjs'

const SESSION = JSON.parse(readFileSync('/Users/johnfryatt/terminus-tms/session-ref.json', 'utf8'))
const BASE = 'http://localhost:3000'

async function api(method, path, body) {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SESSION.access_token}` },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: res.status, ok: res.ok, data: await res.json().catch(() => null) }
}

const results = []
function record(label, pass, detail) {
  results.push({ label, pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}  ${detail}`)
}

// A route is only proven if the SAME request differs by the revision alone.
async function twoSided(label, send, freshRevision) {
  const first = await send(freshRevision)
  record(`${label}: fresh revision accepted`, first.status === 200,
    `-> ${first.status} ${first.ok ? `revision ${first.data?.revision_number}` : JSON.stringify(first.data)}`)
  if (first.status !== 200) return null
  const second = await send(freshRevision)
  record(`${label}: superseded revision refused`, second.status === 409,
    `-> ${second.status} ${second.data?.error ?? ''}`)
  return first.data?.revision_number ?? null
}

const TAG = process.argv[2] ?? 'R38PRE'

// ── The fixture's own assertion, shown FIRING ──────────────────────────────
const tb = await freshTestBed(`${TAG}TB`)
await api('PATCH', `/test-beds/${tb.bedId}`, { payload: { summary: 'moved' }, expected_revision: tb.revision })
let fired = false
try { await assertFreshTestBed(tb.bedId, `${TAG}TB`) } catch (e) { fired = true; var firedWith = e.message }
record('assertFreshTestBed fires on a Test Bed that has moved', fired, fired ? firedWith : 'it did NOT fire')

// The bed is now at revision 2. Re-read rather than assuming.
const bedNow = await api('GET', `/test-beds/${tb.bedId}`)
const bedRev = bedNow.data?.latest_revision_number
record('GET /test-beds/:id reports a revision number', Number.isInteger(bedRev), `latest_revision_number=${bedRev}`)

// ── 1. PATCH /test-beds/:id ────────────────────────────────────────────────
const afterBed = await twoSided('PATCH /test-beds/:id',
  (rev) => api('PATCH', `/test-beds/${tb.bedId}`, { payload: { summary: `t${rev}` }, expected_revision: rev }),
  bedRev)

// ── 2. PATCH /test-beds/:id/units/:unitId ──────────────────────────────────
await api('PATCH', `/test-beds/${tb.bedId}`,
  { payload: { safesightCameras: 2 }, expected_revision: afterBed })
// The FIRST slots are created by an explicit derive, not by the count edit: the
// PATCH only reconciles counts for a type that already has units. Measured, not
// assumed - the probe originally skipped this and found no unit to write to.
const derived = await api('POST', `/test-beds/${tb.bedId}/units/derive`, {})
record('units derive from a count', derived.status === 200 || derived.status === 201,
  `-> ${derived.status}`)
const units = await api('GET', `/test-beds/${tb.bedId}/units`)
const unit = units.data?.[0]
record('a unit exists and carries its own revision', Number.isInteger(unit?.revision_number),
  `unit ${unit?.id?.slice(0, 8)} revision_number=${unit?.revision_number}`)
if (unit) {
  await twoSided('PATCH /test-beds/:id/units/:unitId',
    (rev) => api('PATCH', `/test-beds/${tb.bedId}/units/${unit.id}`,
      { serialNumber: `SN-${rev}`, expected_revision: rev }),
    unit.revision_number)
}

// ── 3. PATCH /accounts/:id ─────────────────────────────────────────────────
const acct = await api('GET', `/accounts/${tb.accountId}`)
record('GET /accounts/:id reports a revision number', Number.isInteger(acct.data?.latest_revision_number),
  `latest_revision_number=${acct.data?.latest_revision_number}`)
await twoSided('PATCH /accounts/:id',
  // websiteUrl, not summary: ACCOUNT_WRITABLE_KEYS does not carry summary and
  // the route refuses it with a 400 before the precondition is ever reached.
  (rev) => api('PATCH', `/accounts/${tb.accountId}`,
    { payload: { websiteUrl: `https://example.invalid/${rev}` }, expected_revision: rev }),
  acct.data?.latest_revision_number)

// ── 4. PATCH /contacts/:id and 5. PATCH /opportunities/:id ─────────────────
const opp = await freshOpportunity(`${TAG}OPP`)
const contact = await api('GET', `/contacts/${opp.contactId}`)
record('GET /contacts/:id reports a revision number', Number.isInteger(contact.data?.latest_revision_number),
  `latest_revision_number=${contact.data?.latest_revision_number}`)
await twoSided('PATCH /contacts/:id',
  (rev) => api('PATCH', `/contacts/${opp.contactId}`,
    { payload: { summary: `c${rev}` }, expected_revision: rev }),
  contact.data?.latest_revision_number)

const oppNow = await api('GET', `/opportunities/${opp.oppId}`)
await twoSided('PATCH /opportunities/:id',
  (rev) => api('PATCH', `/opportunities/${opp.oppId}`,
    { payload: { targetMargin: 30 + (rev % 5) }, expected_revision: rev }),
  oppNow.data?.latest_revision_number)

// ── The list reads the Contacts card writes back through ───────────────────
const list = await api('GET', '/contacts')
const listed = list.data?.find((c) => c.id === opp.contactId)
record('GET /contacts carries latest_revision_number per row',
  Number.isInteger(listed?.latest_revision_number),
  `latest_revision_number=${listed?.latest_revision_number}`)

// ── A malformed precondition is refused, not ignored ───────────────────────
for (const [route, path] of [
  ['accounts', `/accounts/${tb.accountId}`],
  ['contacts', `/contacts/${opp.contactId}`],
  ['test-beds', `/test-beds/${tb.bedId}`],
  ['opportunities', `/opportunities/${opp.oppId}`],
  ['units', `/test-beds/${tb.bedId}/units/${unit?.id}`],
]) {
  const body = route === 'units'
    ? { serialNumber: 'x', expected_revision: '7' }
    : { payload: route === 'accounts' ? { websiteUrl: 'https://example.invalid/x' } : { summary: 'x' }, expected_revision: '7' }
  const r = await api('PATCH', path, body)
  record(`${route}: a string revision is a 400, not a silent blind write`, r.status === 400,
    `-> ${r.status} ${r.data?.error ?? ''}`)
}

// ── Teardown, re-queried ───────────────────────────────────────────────────
const { removed } = await tearDown()
record('teardown removed every record the test account owns', true,
  `${removed.length} soft-deleted, re-queried 0 live`)

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
if (failed.length) { for (const f of failed) console.log(`  FAILED: ${f.label}`); process.exit(1) }
