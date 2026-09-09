// R10: A NON-OWNER WRITE AGAINST OPPORTUNITY TABLES IS REJECTED AT THE SERVER.
//
// ── THE IDENTITY, AND WHY IT IS NOT THE SERVICE ROLE ───────────────────────
//
// Every write below is attempted as a REAL SIGNED-IN USER over HTTP through
// the app's own routes. The service role appears nowhere in the attempt path.
// A policy is not an enforcement, and `USING (false)` is dead code against a
// role that bypasses RLS, so a probe driven by the service key would report a
// clean sweep against a database with no policies at all.
//
// The service key IS used for two things that are not the attempt: creating
// the fixture, and HANDING IT to another owner. The system cannot produce
// "a record this user does not own" with one account, and the surface reads
// owner_id and has no opinion on who set it (Verification 47's clause).
//
// ── THE STOP CLAUSE IS LIVE ────────────────────────────────────────────────
//
// If any write LANDS on the healthy policy this stops immediately, prints the
// record ids, and waits. That is a live security finding and it belongs to
// John before anything else moves.
import { api as apiCall } from '../api-client.mjs'
import { admin, freshOpportunity, tearDown } from '../fixtures.mjs'
import { readFileSync } from 'fs'

const TAG = process.env.R10_TAG ?? 'r10reject'
const db = admin()
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const call = async (m, p, b) => {
  try { const r = await apiCall(m, p, b); return { status: r.status, data: r.data } }
  catch (e) { if (e.name !== 'ApiError') throw e; return { status: e.status, data: e.body } }
}
const ME = JSON.parse(readFileSync('/Users/johnfryatt/terminus-tms/session-ref.json', 'utf8')).user.id

const { data: users } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 })
const OTHER = users.users.find((u) => u.email === 'ownership-other@terminus-probe.invalid')?.id
if (!OTHER) throw new Error('the probe account does not exist; refusing to guess an owner id')

console.log(`  acting as   ${users.users.find((u) => u.id === ME)?.email}  (a real user JWT)`)
console.log(`  record owner ${users.users.find((u) => u.id === OTHER)?.email}\n`)

const { oppId, contactId } = await freshOpportunity(TAG)
// A key-contact link to aim the stance and delete routes at. Created while the
// record is still mine, because those routes need a link id to exist.
const linkRes = await call('POST', `/opportunities/${oppId}/key-contacts`,
  { contact_id: contactId, role_other: 'Probe decision maker' })
const linkId = linkRes.data?.id ?? linkRes.data?.link?.id ?? null

// HAND IT OVER. From here this session is a non-owner of oppId.
must(await db.from('records').update({ owner_id: OTHER }).eq('id', oppId).select('id'), 'hand over')

const CLOSE_LOST_REASON = must(await db.from('closed_lost_reasons')
  .select('id').eq('active', true).limit(1), 'close lost reason')[0]?.id
if (!CLOSE_LOST_REASON) throw new Error('no active closed_lost_reason; refusing to guess one')

// AND THE TWO LINK-SCOPED ATTEMPTS MUST NOT BE SILENTLY SKIPPED. The first run
// built the link with a body the route refused, so linkId was null and the
// `...(linkId ? [...] : [])` spread dropped stance and delete without a word -
// Verification 14's guarded-loop shape, in my own probe.
if (!linkId) console.log('  WARNING: no key-contact link was created, so stance and delete are NOT attempted\n')

const STANCE = must(await db.from('contact_stances').select('id').limit(1), 'stance')[0]?.id
if (!STANCE) throw new Error('no contact_stance; refusing to guess one')

// REFUSED BY DESIGN is a THIRD category, not an unproven one. The superseded
// approvals route answers 409 for a workflow record type on purpose
// (Verification 41: a superseded route must refuse, because callers are found
// by looking and a refusal is found by testing). Counting that as "ownership
// not reached" would report a working control as a gap.
const BY_DESIGN = /recorded against its transition request/i

const OWNERSHIP = /belongs to another user|only its owner|not authori[sz]ed|forbidden/i
const ATTEMPTS = [
  // The two the census PROVED reachable from the screen, first.
  // BODIES BUILT FROM THE ROUTES AND THE DATABASE, not guessed. The first run
  // of this probe had NINE of eleven refused on body validation before the
  // ownership question was ever asked, which is a refusal for the wrong reason
  // and proves nothing. `criterion` not `criterion_key`; a real level value
  // from scoring_scale_levels; a real id from closed_lost_reasons.
  { name: 'scores (the assessment inputs)', m: 'POST', p: `/opportunities/${oppId}/scores`,
    b: { criterion: 'assessCommBudgetConfirmed', score: 4, reason: 'r10 probe attempt' } },
  { name: 'close-lost (Mark Closed Lost)', m: 'POST', p: `/opportunities/${oppId}/close-lost`,
    b: { reason_id: CLOSE_LOST_REASON } },
  // Then the rest of the Opportunity write surface, enumerated from the routes.
  { name: 'PATCH the record', m: 'PATCH', p: `/opportunities/${oppId}`,
    b: { payload: { targetMargin: 33 } } },
  { name: 'close-date-move', m: 'POST', p: `/opportunities/${oppId}/close-date-move`,
    b: { date: '2027-01-31', reason: 'r10 probe attempt' } },
  { name: 'probability-override', m: 'PUT', p: `/opportunities/${oppId}/probability-override`,
    b: { probability_pct: 90, reason: 'r10 probe attempt' } },
  { name: 'assessment-reviewed', m: 'POST', p: `/opportunities/${oppId}/assessment-reviewed`, b: {} },
  { name: 'key-contacts add', m: 'POST', p: `/opportunities/${oppId}/key-contacts`,
    b: { contact_id: contactId, role_other: 'Probe influencer' } },
  ...(linkId ? [
    { name: 'key-contact stance', m: 'POST', p: `/opportunities/${oppId}/key-contacts/${linkId}/stance`,
      b: { stance_id: STANCE } },
    { name: 'key-contact delete', m: 'DELETE', p: `/opportunities/${oppId}/key-contacts/${linkId}`, b: {} },
  ] : []),
  { name: 'deal-sheet-version', m: 'POST', p: `/opportunities/${oppId}/deal-sheet-versions`,
    b: { reason: 'r10 probe attempt', inputs: {}, rates: {}, expected_revision: 1, status: 'draft' } },
  { name: 'transition-request', m: 'POST', p: `/records/${oppId}/transition-requests`,
    b: { to_stage: 'Proposal', kind: 'review' } },
  { name: 'transition', m: 'POST', p: `/records/${oppId}/transition`, b: { to_stage: 'Solution Alignment' } },
  { name: 'approvals (superseded route)', m: 'POST', p: `/records/${oppId}/approvals`,
    b: { track: 'Commercial', decision: 'approved' } },
]

// ── THE OWNER COUNTERFACTUAL, ON ITS OWN FIXTURE ──────────────────────────
//
// R10 asks for the rejecting direction AND a passing one. Weakening the POLICY
// is not available here: measured, these refusals arrive as Postgres 42501
// through isRefusal(), so they are RLS at the database, and this session
// reaches Postgres only through PostgREST (CLAUDE.md rule 14). There is no
// psql, so no policy can be weakened and restored.
//
// The discriminating pair that IS available is the IDENTITY: the same request,
// the same body, against a record this user OWNS. A rejection with no owner
// row beside it cannot tell "ownership refused it" from "the request was
// malformed" or "the route is broken" - which is exactly what nine 400s looked
// like on the first run of this probe.
//
// A SEPARATE FIXTURE, because close-lost terminates a record and would block
// every later write on the same one.
const ownerRun = await freshOpportunity(`${TAG}own`)
const ownerLink = await call('POST', `/opportunities/${ownerRun.oppId}/key-contacts`,
  { contact_id: ownerRun.contactId, role_other: 'Probe decision maker' })
const ownerLinkId = ownerLink.data?.id ?? ownerLink.data?.link?.id ?? null
const asOwner = {}
for (const a of ATTEMPTS) {
  const path = a.p.replace(oppId, ownerRun.oppId).replace(String(linkId), String(ownerLinkId))
  const body = a.b && JSON.parse(JSON.stringify(a.b).replace(contactId, ownerRun.contactId))
  const r = await call(a.m, path, body)
  asOwner[a.name] = { status: r.status, landed: r.status >= 200 && r.status < 300 }
}

const rows = []
for (const a of ATTEMPTS) {
  const r = await call(a.m, a.p, a.b)
  const landed = r.status >= 200 && r.status < 300
  const body = JSON.stringify(r.data ?? {})
  // A REFUSAL FOR THE WRONG REASON IS NOT A PROOF. A 400 on body shape means
  // the request never reached the ownership question, so it is reported as
  // NOT PROVEN rather than counted as a rejection.
  const shaped = OWNERSHIP.test(body) || r.status === 403
  const byDesign = !landed && !shaped && BY_DESIGN.test(body)
  const verdict = landed ? 'LANDED' : shaped ? 'REJECTED' : byDesign ? 'BY DESIGN' : `refused ${r.status}, not on ownership`
  const own = asOwner[a.name] ?? { status: '-', landed: false }
  rows.push({ ...a, status: r.status, landed, shaped, byDesign, verdict, ownerStatus: own.status, ownerLanded: own.landed, msg: body.slice(0, 88) })
  console.log(`  ${(landed ? 'LANDED   ' : shaped ? 'REJECTED ' : byDesign ? 'BY DESIGN' : 'unproven ')} ${a.name.padEnd(30)} owner ${String(own.status).padEnd(4)}${own.landed ? ' OK ' : '    '} non-owner ${String(r.status).padEnd(4)} ${body.slice(0, 40)}`)
}

const landed = rows.filter((r) => r.landed)
const proven = rows.filter((r) => r.shaped && !r.landed)
const design = rows.filter((r) => r.byDesign)
const unproven = rows.filter((r) => !r.shaped && !r.landed && !r.byDesign)

const discriminating = rows.filter((r) => r.ownerLanded && r.shaped && !r.landed)
console.log(`\n  ${discriminating.length}/${rows.length} prove BOTH DIRECTIONS: the owner's identical write LANDS, the non-owner's is REJECTED`)
console.log(`  ${proven.length}/${rows.length} REJECTED ownership-shaped`)
console.log(`  ${design.length}/${rows.length} refused BY DESIGN (a superseded route that must refuse)`)
console.log(`  ${unproven.length}/${rows.length} refused for another reason - NOT PROVEN, the ownership question was never reached`)
for (const u of unproven) console.log(`      ${u.name}: ${u.status} ${u.msg}`)

if (landed.length) {
  console.log(`\n  *** STOP. ${landed.length} NON-OWNER WRITE(S) LANDED ON THE HEALTHY POLICY ***`)
  console.log(`  opportunity id: ${oppId}`)
  console.log(`  contact id:     ${contactId}`)
  for (const l of landed) console.log(`      ${l.m} ${l.p} -> ${l.status}`)
  console.log(`  Fixtures are NOT torn down: they are the evidence. Tag ${TAG}.`)
  process.exit(2)
}

await tearDown(TAG)
await tearDown(`${TAG}own`)
console.log(`\n  fixtures swept by tags ${TAG} and ${TAG}own`)
process.exit(0)
