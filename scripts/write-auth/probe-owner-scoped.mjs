// PHASE 1b: the calibration, both directions, on every changed policy.
//
// UNRUNNABLE UNTIL THE MIGRATION IS APPLIED. This session reaches Postgres only
// through PostgREST - no psql, no supabase CLI, no pg module, no connection
// string, no exec-SQL RPC - re-verified for this round rather than recalled.
// The probe stops with a named message rather than scoring a run that measured
// the old policies (Verification 48).
//
// WHAT IT PROVES, and each half is required:
//   REFUSED   the three writes that landed in Phase 0, replayed exactly
//   ALLOWED   the same three by the OWNER, so the refusals are not a route
//             that refuses everything (Verification 40's clause)
//   PRESERVED the flows the map ruled MATCH and must keep working: a non-owner
//             APPROVER approving, and audit self-signing
import { api as apiCall } from '../api-client.mjs'
import { admin } from '../fixtures.mjs'
import { catalogToRates } from '../../src/lib/base-costs.js'
import { resolveRates, frozenRates } from '../../src/lib/rate-resolution.js'
import { readFileSync } from 'fs'

const body = async (m, p, b) => (await apiCall(m, p, b)).data
const call = async (m, p, b) => {
  try { const r = await apiCall(m, p, b); return { status: r.status, data: r.data } }
  catch (e) { if (e.name !== 'ApiError') throw e; return { status: e.status, data: e.body } }
}
const TAG = `wafix-${process.argv[2] ?? 'r1'}`
const ME = JSON.parse(readFileSync('session-ref.json', 'utf8')).user.id
const db = admin()
const R = []
const check = (n, pass, d = '') => { R.push({ n, pass }); console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${n}${d ? '  -> ' + d : ''}`) }
const ownershipShaped = (r) => r.status === 403 || /belongs to another user|only its owner/i.test(JSON.stringify(r.data ?? {}))

const LIVE_RATES = catalogToRates((await body('GET', '/base-costs'))?.products ?? []).rates
const priced = (i) => frozenRates(resolveRates(i, LIVE_RATES))
const BASE = { targetMargin: 30 }
const revOf = async (id) => (await db.from('record_revisions').select('revision_number')
  .eq('record_id', id).order('revision_number', { ascending: false }).limit(1).single()).data.revision_number

async function freshOpp(label) {
  const industry = (await body('GET', '/industries'))[0]
  const account = await body('POST', '/accounts', { name: `${TAG}-${label} Acct`, industry_id: industry.id, billingCountry: 'Singapore' })
  const contact = await body('POST', '/contacts', {
    name: `${TAG}-${label} person`, company: `${TAG} Ltd`, email: `${TAG}-${label}@example.invalid`,
    mobile: '+65 9000 0004', industry_id: industry.id, source: 'Referral', country: 'Singapore',
  })
  await body('POST', `/contacts/${contact.id}/link-account`, { account_id: account.id })
  await db.from('records').update({ status: 'Qualified' }).eq('id', contact.id)
  return (await body('POST', `/contacts/${contact.id}/create-opportunity`, { name: `${TAG}-${label} deal` })).id
}

const { data: users } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 })
const other = users.users.find((u) => u.email === 'ownership-other@terminus-probe.invalid')?.id

// ── PREFLIGHT: is the migration applied? ──────────────────────────────────
// The only detector available is the behaviour itself, so one throwaway attempt
// decides whether to run at all. Reported as a STOP, never scored.
const pf = await freshOpp('PF')
await db.from('records').update({ owner_id: other }).eq('id', pf)
const probe = await call('POST', `/opportunities/${pf}/deal-sheet-versions`,
  { inputs: BASE, rates: priced(BASE), reason: `${TAG} preflight`, expected_revision: await revOf(pf) })
if (probe.status >= 200 && probe.status < 300) {
  console.log('\nSTOP: a non-owner version insert still answers ' + probe.status + '.')
  console.log('20260908000002_writes_are_owner_scoped.sql has not been applied.')
  console.log('This session cannot apply it: no psql, no supabase CLI, no pg module,')
  console.log('no connection string, and rpc exec_sql answers PGRST202. Apply it, then')
  console.log('re-run this probe unchanged.')
  console.log(`(the preflight fixture is ${pf}; its stray version is ${probe.data?.id ?? 'n/a'})`)
  process.exit(3)
}
console.log(`preflight: a non-owner insert answers ${probe.status} - the migration is applied\n`)

// ── REFUSED: the three writes that landed, replayed ───────────────────────
console.log('=== REFUSED: the Phase 0 writes, replayed exactly')

// 1. version insert, on a record handed away.
const a = await freshOpp('A')
const vOwn = await body('POST', `/opportunities/${a}/deal-sheet-versions`,
  { inputs: BASE, rates: priced(BASE), reason: `${TAG} owner draft`, expected_revision: await revOf(a) })
await db.from('records').update({ owner_id: other }).eq('id', a)
// DIFFERENT INPUTS, deliberately. With BASE repeated, the route answers
// "No change since V0.1. A version records a decision, so there is nothing to
// record." - a refusal that arrives BEFORE ownership is asked and says nothing
// about it. The first run of this probe scored that as a pass on check 1 and
// only 1b caught it.
const CHANGED = { targetMargin: 32 }
const ins = await call('POST', `/opportunities/${a}/deal-sheet-versions`,
  { inputs: CHANGED, rates: priced(CHANGED), reason: `${TAG} must be refused`, expected_revision: await revOf(a) })
check('1. version INSERT by a non-owner is refused', ins.status >= 400, `${ins.status}`)
check('1b. and the refusal is about ownership', ownershipShaped(ins), JSON.stringify(ins.data).slice(0, 80))

// 2. version ISSUE, on that same handed-away record, of a draft taken while owned.
const iss = await call('POST', `/deal-sheet-versions/${vOwn.id}/issue`, {})
const { data: vAfter } = await db.from('deal_sheet_versions').select('status').eq('id', vOwn.id).single()
check('2. version ISSUE by a non-owner is refused', iss.status >= 400 && vAfter.status === 'draft',
  `HTTP ${iss.status}, version still ${vAfter.status}`)
check('2b. and the refusal is about ownership', ownershipShaped(iss), JSON.stringify(iss.data).slice(0, 80))

// 3. transition request, gate satisfied as owner first.
const b = await freshOpp('B')
await call('POST', `/opportunities/${b}/assessment-reviewed`, {})
const beforeB = (await db.from('transition_requests').select('id', { count: 'exact', head: true }).eq('record_id', b)).count ?? 0
await db.from('records').update({ owner_id: other }).eq('id', b)
const req = await call('POST', `/records/${b}/transition-requests`, { to_stage: 'Solution Alignment' })
const afterB = (await db.from('transition_requests').select('id', { count: 'exact', head: true }).eq('record_id', b)).count ?? 0
check('3. transition REQUEST by a non-owner is refused', req.status >= 400 && afterB === beforeB,
  `HTTP ${req.status}, requests ${beforeB} -> ${afterB}`)
check('3b. and the refusal is about ownership', ownershipShaped(req), JSON.stringify(req.data).slice(0, 80))

// 4. THE EVIDENCE ROW'S EXACT WRITE, on the real record it landed on. R2: the
// real-world positive control, and the fixed policy must refuse exactly this.
const EVID_RECORD = '29e98c46-9377-4790-99b3-2045323f9265'
const evidRev = await revOf(EVID_RECORD)
// THE INPUTS MUST DIFFER FROM THE EVIDENCE ROW'S, or the route refuses this as
// "No change since V0.2" before ownership is ever asked - measured, 409, not
// ownership-shaped. The replay has to be a write that can REACH the policy, or
// it proves the route's dedupe rather than the fix. Third time this class has
// bitten in two rounds.
const REPLAY = { targetMargin: 37 }
const replay = await call('POST', `/opportunities/${EVID_RECORD}/deal-sheet-versions`,
  { inputs: REPLAY, rates: priced(REPLAY), reason: `${TAG} replay of the evidence write`, expected_revision: evidRev })
check('4. THE EVIDENCE WRITE, replayed on the real record, is refused', replay.status >= 400, `${replay.status}`)
check('4c. and refused ON OWNERSHIP, not by the no-change dedupe', ownershipShaped(replay),
  JSON.stringify(replay.data).slice(0, 90))
check('4b. and the evidence row itself is untouched (R2)',
  !!(await db.from('deal_sheet_versions').select('id').eq('id', '5f1517b2-27df-41af-bb10-9261f70e146c').maybeSingle()).data,
  'version 5f1517b2 still present')

// ── ALLOWED: the owner's same writes ──────────────────────────────────────
console.log('\n=== ALLOWED: the owner doing the same things')
const c = await freshOpp('C')
const vc = await call('POST', `/opportunities/${c}/deal-sheet-versions`,
  { inputs: BASE, rates: priced(BASE), reason: `${TAG} owner may save`, expected_revision: await revOf(c) })
check('5. the OWNER may save a version', vc.status === 201, `${vc.status}`)
const ic = await call('POST', `/deal-sheet-versions/${vc.data?.id}/issue`, {})
check('6. the OWNER may issue it', ic.status >= 200 && ic.status < 300, `${ic.status}`)
await call('POST', `/opportunities/${c}/assessment-reviewed`, {})
const rc = await call('POST', `/records/${c}/transition-requests`, { to_stage: 'Solution Alignment' })
check('7. the OWNER may raise a transition request', rc.status === 201, `${rc.status}`)

// ── PRESERVED: the MATCH verdicts must keep working ───────────────────────
console.log('\n=== PRESERVED: what the map ruled MATCH and must not break')
const { count: auditRows } = await db.from('audit_log')
  .select('id', { count: 'exact', head: true }).eq('record_id', c).eq('actor_id', ME)
check('8. audit self-signing still works (identity-shaped, ruled MATCH)', (auditRows ?? 0) > 0,
  `${auditRows} audit row(s) written by me on my own record`)
console.log('  9. a non-owner APPROVER approving: needs a record with a required track and')
console.log('     an approver seat, which this probe does not construct. Named as NOT')
console.log('     COVERED here rather than asserted - probe-pricing-approval and')
console.log('     probe-commercial-gate in the gate exercise that path and must stay green.')

const pass = R.filter((r) => r.pass).length
console.log(`\n${pass}/${R.length} pass`)
console.log('\nFixtures created by this run are left in place; teardown is proposed at the close per R8.')
process.exit(pass === R.length ? 0 : 1)
