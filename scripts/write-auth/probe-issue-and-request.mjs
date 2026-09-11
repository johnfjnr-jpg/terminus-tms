// PHASE 0 ITEM 3: the two proofs the stopped round could not make.
//
// ── EVERY TARGET IS A FIXTURE THIS PROBE BUILT ────────────────────────────
//
// The hygiene round's probe wrote to walk65's real opportunity, which was the
// right call at the time (a fixture owner rather than the business) and is not
// the right call twice. Here the non-owned record is CONSTRUCTED: created by
// this account, then handed to another real auth.users id by an admin write.
//
// Verification 47's clause, with the migration's Round 5 as direct precedent:
// one account cannot produce a record it does not own, the value written is one
// the system itself produces - a real second auth.users id, not a fabricated
// uuid, which the foreign key would refuse - and the surface reads owner_id
// against the session with no opinion about how it got there.
//
// So nothing anybody else owns is touched, and every write that lands is on a
// record this probe made. Their ids are still recorded under R2.
import { api as apiCall } from '../api-client.mjs'
import { admin, tearDown } from '../fixtures.mjs'
import { catalogToRates } from '../../src/lib/base-costs.js'
import { resolveRates, frozenRates } from '../../src/lib/rate-resolution.js'
import { readFileSync } from 'fs'

const body = async (m, p, b) => (await apiCall(m, p, b)).data
const call = async (m, p, b) => {
  try { const r = await apiCall(m, p, b); return { status: r.status, data: r.data } }
  catch (e) { if (e.name !== 'ApiError') throw e; return { status: e.status, data: e.body } }
}
const TAG = `wauth-${process.argv[2] ?? 'r0'}`
const SESSION = JSON.parse(readFileSync('session-ref.json', 'utf8'))
const ME = SESSION.user.id
const db = admin()
const R = []
const EVIDENCE = []
const check = (n, pass, detail = '') => { R.push({ n, pass }); console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${n}${detail ? '  -> ' + detail : ''}`) }

const LIVE_RATES = catalogToRates((await body('GET', '/base-costs'))?.products ?? []).rates
const priced = (i) => frozenRates(resolveRates(i, LIVE_RATES))
const BASE = { targetMargin: 30 }
const revOf = async (id) => (await db.from('record_revisions').select('revision_number')
  .eq('record_id', id).order('revision_number', { ascending: false }).limit(1).single()).data.revision_number

async function freshOpp(label) {
  const industry = (await body('GET', '/industries'))[0]
  const account = await body('POST', '/accounts', { name: `${TAG}-${label} Account`, industry_id: industry.id, billingCountry: 'Singapore' })
  const contact = await body('POST', '/contacts', {
    jobRole: 'Head of Ops',
    name: `${TAG}-${label} person`, company: `${TAG} Ltd`, email: `${TAG}-${label}@example.invalid`,
    mobile: '+65 9000 0003', industry_id: industry.id, source: 'Referral', country: 'Singapore',
  })
  await body('POST', `/contacts/${contact.id}/link-account`, { account_id: account.id })
  await db.from('records').update({ status: 'Qualified' }).eq('id', contact.id)
  return (await body('POST', `/contacts/${contact.id}/create-opportunity`, { name: `${TAG}-${label} deal` })).id
}

try {
  const { data: users } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const other = users.users.find((u) => u.email === 'ownership-other@terminus-probe.invalid')?.id
  if (!other) throw new Error('no second account to hand ownership to')
  console.log(`me: ${ME}\nthe other owner: ${other}  (a probe account)\n`)

  // ══ PROOF A: VERSION ISSUE AS A NON-OWNER ═══════════════════════════════
  //
  // The issue route's ONLY precondition is status === 'draft', read from its
  // source: no approval gate and no ownership check. The update policy behind
  // it is `auth.uid() is not null and status = 'draft'`. So the prediction is
  // that it succeeds for anybody, and the point of running it is that a
  // prediction from a policy is not a measurement of one.
  console.log('=== PROOF A: version ISSUE as a non-owner')
  const oppA = await freshOpp('A')
  const vA = await body('POST', `/opportunities/${oppA}/deal-sheet-versions`,
    { inputs: BASE, rates: priced(BASE), reason: `${TAG} draft taken while I owned it`, expected_revision: await revOf(oppA) })
  check('A1. as the owner, a version can be taken', !!vA?.id, `version ${vA?.id} V${vA?.major}.${vA?.minor} ${vA?.status}`)

  // Hand the record to somebody else. The version stays exactly as it was.
  await db.from('records').update({ owner_id: other }).eq('id', oppA)
  const { data: checkA } = await db.from('records').select('owner_id').eq('id', oppA).single()
  check('A2. the record now belongs to somebody else', checkA.owner_id === other && checkA.owner_id !== ME,
    `owner ${checkA.owner_id}`)

  const issued = await call('POST', `/deal-sheet-versions/${vA.id}/issue`, {})
  console.log(`    issue as NON-OWNER -> ${issued.status}  ${JSON.stringify(issued.data).slice(0, 150)}`)
  const { data: vAfter } = await db.from('deal_sheet_versions').select('id, major, minor, status').eq('id', vA.id).single()
  const landedA = vAfter.status === 'issued'
  if (landedA) EVIDENCE.push({ what: 'version issued by a non-owner', id: vA.id, record: oppA, detail: `V${vAfter.major}.${vAfter.minor} ${vAfter.status}` })
  check('A3. the non-owner ISSUE is refused', !landedA && issued.status >= 400,
    `HTTP ${issued.status}, version is now ${vAfter.status} V${vAfter.major}.${vAfter.minor}`)

  // ══ PROOF B: APPROVAL REQUEST PAST THE WORKFLOW GATE ════════════════════
  //
  // The hygiene round's attempt answered 409 "not ready" for BOTH the owner and
  // the non-owner, so ownership was never reached and the refusal proved
  // nothing about it - Verification 14. This one measures what the gate wants
  // first, satisfies it as the owner, and only then hands the record over.
  console.log('\n=== PROOF B: approval REQUEST, with the workflow gate satisfied first')
  const oppB = await freshOpp('B')
  const blocked = await call('POST', `/records/${oppB}/transition-requests`, { to_stage: 'Solution Alignment' })
  const blocking = blocked.data?.blocking ?? []
  console.log(`    as owner, before satisfying anything -> ${blocked.status}, ${blocking.length} blocking item(s)`)
  for (const b of blocking) console.log(`      ${b.requirement_type}  ${JSON.stringify(b.requirement_detail ?? b).slice(0, 110)}`)
  // ONE BLOCKER, and it has its own route. But the owner's counterfactual and
  // the non-owner's attempt CANNOT SHARE A RECORD.
  //
  // The first version did share one, and B3 came back 400 "record is already in
  // that stage" - because raising the request as the owner MOVED the record
  // (nothing is required at this transition, so it approves and moves at once).
  // That is a refusal for a reason with nothing to do with ownership, scored as
  // a pass by a check that accepted any 4xx. Verification 14, and the identical
  // trap the hygiene round fell into one round earlier.
  //
  // Two records: one to prove the owner can, one handed over untouched.
  const satisfy = async (id) => {
    const r = await call('POST', `/opportunities/${id}/assessment-reviewed`, {})
    return r.status
  }
  console.log(`    satisfying the gate on B as its owner -> ${await satisfy(oppB)}`)
  const ownerRaise = await call('POST', `/records/${oppB}/transition-requests`, { to_stage: 'Solution Alignment' })
  console.log(`    THE COUNTERFACTUAL, owner raises on its own record -> ${ownerRaise.status}`)
  check('B1. the owner CAN raise once the gate is satisfied',
    ownerRaise.status >= 200 && ownerRaise.status < 300, `${ownerRaise.status}`)
  if (ownerRaise.data?.id) EVIDENCE.push({ what: 'transition request raised legitimately by the owner (counterfactual)', id: ownerRaise.data.id, record: oppB, detail: 'expected, owner-raised' })

  // A SECOND record, gate satisfied as owner, then handed over and left alone.
  const oppC = await freshOpp('C')
  console.log(`    satisfying the gate on C as its owner -> ${await satisfy(oppC)}`)
  const { data: cBefore } = await db.from('records').select('status').eq('id', oppC).single()
  await db.from('records').update({ owner_id: other }).eq('id', oppC)
  const { data: cOwner } = await db.from('records').select('owner_id, status').eq('id', oppC).single()
  check('B2. C is gate-satisfied, still at its stage, and now somebody else\'s',
    cOwner.owner_id === other && cOwner.status === cBefore.status,
    `owner ${cOwner.owner_id}, stage ${cOwner.status}`)

  const before = (await db.from('transition_requests').select('id', { count: 'exact', head: true })
    .eq('record_id', oppC)).count ?? 0
  const raised = await call('POST', `/records/${oppC}/transition-requests`, { to_stage: 'Solution Alignment' })
  const after = (await db.from('transition_requests').select('id', { count: 'exact', head: true })
    .eq('record_id', oppC)).count ?? 0
  console.log(`    request as NON-OWNER -> ${raised.status}  ${JSON.stringify(raised.data).slice(0, 150)}`)
  const landedB = after > before
  if (landedB) EVIDENCE.push({ what: 'transition request raised by a NON-OWNER', id: raised.data?.id ?? '(none returned)', record: oppC, detail: `requests ${before} -> ${after}` })

  // THE REFUSAL MUST BE ABOUT OWNERSHIP. Any 4xx is not the claim: the whole
  // reason this proof exists is that the last one accepted a 409 workflow gate
  // as an ownership refusal.
  const ownershipShaped = raised.status === 403 || /belongs to another user|only its owner/i.test(JSON.stringify(raised.data ?? {}))
  check('B3. the non-owner REQUEST does not land', !landedB, `requests ${before} -> ${after}`)
  check('B4. and it is refused ON OWNERSHIP, not by some other gate', ownershipShaped,
    `HTTP ${raised.status} ${JSON.stringify(raised.data).slice(0, 90)}`)

} catch (e) {
  check('99. the probe ran to completion', false, e.message)
} finally {
  console.log('\n=== EVIDENCE ROWS THAT LANDED (R2: kept, never deleted in passing)')
  if (!EVIDENCE.length) console.log('  (none)')
  for (const e of EVIDENCE) console.log(`  ${e.what}\n    id ${e.id}  on record ${e.record}  ${e.detail}`)
  // NOT torn down: R2 keeps what lands. The fixtures these sit on are named
  // above so the close can propose their disposition.
  const { data: left } = await db.from('records').select('id, record_type, owner_id')
    .eq('owner_id', ME).is('deleted_at', null)
  console.log(`\nlive records still owned by this account: ${left?.length ?? '?'}`)
}
const pass = R.filter((r) => r.pass).length
console.log(`\n${pass}/${R.length} pass`)
