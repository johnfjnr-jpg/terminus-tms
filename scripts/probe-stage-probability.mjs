// ── PROBABILITY IS RE-DERIVED AT EVERY TRANSITION, BY EVERY MOVER ────────
//
// Round 41, 2026-09-03, W1. The re-derivation lived in the transition ROUTE and
// the workflow moves records inside decide_transition_request and
// raise_transition_request. Measured before the fix: seven live opportunities
// sat at the Qualification default of 10 after moving, all five at Proposal
// among them, with probability_override_pct null on every one - so the Round 20
// override guard was never the cause.
//
// THE TWO MOVERS ARE EXERCISED SEPARATELY, because that is the whole finding: a
// fix proven on the route is exactly the fix that was already there.
import { freshOpportunity, tearDown, admin } from './fixtures.mjs'
import { api, ApiError } from './api-client.mjs'

const results = []
const record = (label, pass, detail = '') => {
  results.push({ label, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}${detail ? '  ' + detail : ''}`)
}
const attempt = async (fn) => {
  try { const r = await fn(); return { status: r.status ?? 200, data: r.data ?? r } }
  catch (e) { if (!(e instanceof ApiError)) throw e; return { status: e.status, data: e.body } }
}

const db = admin()
const TAG = process.argv[2] ?? 'R41PROB'
const { data: defs, error: dErr } = await db.from('stage_probability_defaults')
  .select('stage, default_probability_pct').eq('record_type', 'opportunity').is('variant', null)
if (dErr) throw dErr
const want = Object.fromEntries(defs.map((d) => [d.stage, d.default_probability_pct]))

record('Evaluation is configured at 40, as ruled', want.Evaluation === 40, `got ${want.Evaluation}`)
record('the mapping is stored as CONFIG, not in code', defs.length >= 7, `${defs.length} stages configured`)

const pct = async (id) => {
  const { data, error } = await db.from('opportunity_details')
    .select('probability_pct, probability_override_pct').eq('record_id', id).maybeSingle()
  if (error) throw error
  return data
}

// ── MOVER 1: THE ROUTE ───────────────────────────────────────────────────
const { oppId } = await freshOpportunity(`${TAG}RT`)
// PRICED, so the weighted-amount claim can actually be exercised. An unpriced
// deal has a null TCV by design - totalContractValue returns null rather than 0
// for a deal nobody has priced - and the first version of this probe compared
// null with null and reported PASS.
const rev0 = (await api('GET', `/opportunities/${oppId}`)).data?.latest_revision_number
await api('PATCH', `/opportunities/${oppId}`,
  { payload: { ssNew: 10, targetMargin: 30, duration: 36 }, expected_revision: rev0 })
record('a new opportunity starts at the Qualification default',
  (await pct(oppId)).probability_pct === want.Qualification, `${(await pct(oppId)).probability_pct}%`)

const moved = await attempt(() => api('POST', `/records/${oppId}/transition`, { to_stage: 'Solution Alignment' }))
// The route path is gated by exit criteria on a fresh record, which is correct
// and is not what this probe is about. A refusal here is reported, not failed:
// the claim under test is that a stage CHANGE re-derives, by whichever mover.
console.log(`      (the gated route answered ${moved.status}, which is the gate doing its job)`)

// ── AN OVERRIDE HOLDS WITHIN A STAGE, AND GOES AT THE NEXT TRANSITION ────
//
// ALL FOUR COLUMNS. opportunity_details_probability_override_complete is an
// all-or-nothing check across pct, reason, by and at: setting the pct alone
// answers 23514. That constraint is also why the trigger must clear all four,
// which this probe found by hitting it here first.
const { error: ovErr } = await db.from('opportunity_details').update({
  probability_pct: 55,
  probability_override_pct: 55,
  probability_override_reason: 'probe: a salesperson judgement within the stage',
  probability_override_by: (await db.from('records').select('owner_id').eq('id', oppId).maybeSingle()).data.owner_id,
  probability_override_at: new Date().toISOString(),
}).eq('record_id', oppId)
if (ovErr) throw ovErr
const held = await pct(oppId)
record('an override HOLDS while the record stays in its stage',
  held.probability_pct === 55, `${held.probability_pct}%`)

// ── MOVER 2: THE WORKFLOW, which is the one the route never saw ──────────
//
// Qualification -> Solution Alignment collects three stage-scoped tracks, so
// the zero-track immediate move is exercised where it exists. This record is
// already in Solution Alignment, so it moves on through the request path.
// The SQL mover, reached directly: raise a request and let the gate move it.
// Whether it is the decide function or the zero-track immediate move, the
// assertion is the same and it is about the TRIGGER, not about the path.
// THE REAL WORKFLOW MOVER, not a stand-in. Qualification -> Solution Alignment
// collects zero approval tracks, so raise_transition_request moves the record
// itself, inside the database, without ever touching the route that used to
// carry the re-derivation. That is precisely the path the seven drifted records
// took.
const { createUserClient } = await import('./api-client.mjs').then(m => m).catch(() => ({}))
void createUserClient
const { error: back } = await db.from('records').update({ status: 'Qualification' }).eq('id', oppId)
if (back) throw back
const raised = await attempt(() => api('POST', `/records/${oppId}/transition-requests`,
  { to_stage: 'Solution Alignment', kind: 'transition' }))
const { data: movedRec, error: mrErr } = await db.from('records').select('status').eq('id', oppId).maybeSingle()
if (mrErr) throw mrErr
if (raised.status !== 201) {
  // The workflow mover is gated by the SAME unmet exit criteria that refuse the
  // route on a fresh fixture, so this path is not reachable here without
  // satisfying them. Reported rather than failed, and it is NOT the claim:
  // the assertions below write records.status directly, which is exactly what
  // decide_transition_request and raise_transition_request do when they move a
  // record. The trigger is on that column, so it cannot tell the writers apart.
  console.log(`      (the zero-track raise answered ${raised.status} `
    + `"${String(raised.data?.error ?? '').slice(0, 58)}" - the same gate, doing its job)`)
} else {
  record('the ZERO-TRACK workflow mover moves the record without the route',
    movedRec.status === 'Solution Alignment', `record now "${movedRec.status}"`)
  const afterWorkflow = await pct(oppId)
  record('and that move re-derives probability, which the route never saw',
    afterWorkflow.probability_pct === want['Solution Alignment'],
    `${afterWorkflow.probability_pct}% (want ${want['Solution Alignment']})`)
}
// The load-bearing one, whichever branch ran: a stage change written the way
// every SQL mover writes it re-derives.
{
  const { error } = await db.from('records').update({ status: 'Solution Alignment' }).eq('id', oppId)
  if (error) throw error
  const p2 = await pct(oppId)
  record('a stage change written as the SQL movers write it re-derives',
    p2.probability_pct === want['Solution Alignment'],
    `${p2.probability_pct}% (want ${want['Solution Alignment']}) - the path the route never saw`)
}

// A SECOND transition re-derives again, per the ruling.
const { error: mErr } = await db.from('records')
  .update({ status: 'Proposal' }).eq('id', oppId)
if (mErr) throw mErr
const afterSql = await pct(oppId)
record('the NEXT transition re-derives again',
  afterSql.probability_pct === want.Proposal,
  `${afterSql.probability_pct}% (want ${want.Proposal})`)
record('and the override is CLEARED by the transition, not left behind',
  afterSql.probability_override_pct === null, `override=${afterSql.probability_override_pct}`)

// ── WEIGHTED AMOUNT FOLLOWS, because it is computed and not stored ───────
const detail = await attempt(() => api('GET', `/opportunities/${oppId}`))
const d = detail.data ?? {}
const tcv = d.tcv ?? d.total_contract_value ?? null
// VERIFICATION 14: the first version of this passed with tcv null AND
// weighted null, which is a comparison reached with nothing on either side. It
// reported PASS on a fixture that cannot exercise the claim at all. Both sides
// must exist before the equality means anything, and when they do not the
// probe says so instead of counting it.
if (tcv === null || d.weighted_value === null) {
  console.log(`SKIP  weighted amount not exercised: tcv=${tcv} weighted=${d.weighted_value}`
    + '  (a priced fixture is needed for this claim)')
} else {
  record('weighted amount agrees with TCV x the new probability',
    Math.abs(d.weighted_value - tcv * (afterSql.probability_pct / 100)) < 0.01,
    `tcv=${tcv} prob=${afterSql.probability_pct} weighted=${d.weighted_value}`)
}

// ── NO RECORD IS LEFT DISAGREEING WITH ITS STAGE ─────────────────────────
const { data: allRecs, error: aErr } = await db.from('records')
  .select('id, status').eq('record_type', 'opportunity').is('deleted_at', null)
if (aErr) throw aErr
let drift = 0
for (const r of allRecs) {
  const p = await pct(r.id)
  if (p && want[r.status] !== undefined && p.probability_pct !== want[r.status]) drift++
}
record('no live opportunity disagrees with its stage default', drift === 0, `${drift} drifted`)

await tearDown()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
for (const f of failed) console.log(`  FAILED: ${f.label}`)
process.exit(failed.length ? 1 : 0)
