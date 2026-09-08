// PHASE 1b: the flows the fix must NOT have changed.
//
// A guard that refuses non-owners is only half the claim. The other half is
// that the OWNER's own flows work exactly as they did, and the allowance the
// guard protects is still spent exactly once.
import { api as apiCall } from '../api-client.mjs'
import { admin } from '../fixtures.mjs'

const call = async (m, p, b) => {
  try { const r = await apiCall(m, p, b); return { status: r.status, data: r.data } }
  catch (e) { if (e.name !== 'ApiError') throw e; return { status: e.status, data: e.body } }
}
const body = async (m, p, b) => (await apiCall(m, p, b)).data
const TAG = `cf1b-flows`
const db = admin()
const rnd = () => Math.random().toString(36).slice(2, 7)
const R = []
const ok = (n, cond, detail) => { R.push({ n, cond, detail }); console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${n.padEnd(52)} ${detail}`) }

const industry = (await body('GET', '/industries'))[0]
const mkAccount = async () => (await body('POST', '/accounts', { name: `${TAG}-${rnd()} Acct`, industry_id: industry.id, billingCountry: 'Singapore' })).id
const mkBed = async () => (await body('POST', '/test-beds', {
  name: `${TAG}-${rnd()} bed`, account_id: await mkAccount(), industry_id: industry.id,
  country_code: 'SG', client_organisation: `${TAG} Org`,
})).id

console.log('=== FLOW 1: the owner converts, and the allowance is spent exactly once\n')
const bed = await mkBed()
const c1 = await call('POST', `/test-beds/${bed}/convert`, { opportunity_name: `${TAG} first ${rnd()}` })
ok('the owner\'s first convert succeeds', c1.status === 201, `${c1.status}`)
const c2 = await call('POST', `/test-beds/${bed}/convert`, { opportunity_name: `${TAG} second ${rnd()}` })
const spent = c2.status === 422 && /already been converted/i.test(JSON.stringify(c2.data ?? {}))
ok('the SECOND convert refuses on the allowance', spent, `${c2.status} ${JSON.stringify(c2.data?.error ?? c2.data ?? '').slice(0, 60)}`)
ok('the allowance refusal is NOT ownership-shaped', !/belongs to another user/i.test(JSON.stringify(c2.data ?? {})),
  'the new guard did not displace the old refusal')

console.log('\n=== FLOW 2: the contact\'s owner qualifies their own contact\n')
const acc = await mkAccount()
// Verification 47: built the way the SYSTEM produces the state. The
// Unqualified -> Qualified gate is twelve payload_field_required rows, read
// from stage_gate_rules rather than guessed, so this contact can actually
// qualify through the front door instead of by an admin write.
const contact = await body('POST', '/contacts', {
  name: `${TAG}-${rnd()} person`, company: `${TAG} Ltd`, email: `${TAG}-${rnd()}@example.invalid`,
  mobile: '+65 9000 0008', industry_id: industry.id, source: 'Referral',
  jobRole: 'Head of Operations', address: '1 Marina Boulevard', city: 'Singapore',
  postcode: '018989', country: 'Singapore', region: 'APAC',
  linkedin: 'https://www.linkedin.com/in/example-probe',
  summary: `${TAG} probe contact for the create-from ownership round.`,
})
const link = await call('POST', `/contacts/${contact.id}/link-account`, { account_id: acc })
ok('the owner links an Account', link.status >= 200 && link.status < 300, `${link.status}`)
// The estate's own path, the one scripts/fixtures.mjs:154 uses. A PATCH
// does not move a stage: it answers "body must contain payload or
// industry_id", which is a shape refusal and would have read as a gate.
const q = await call('POST', `/records/${contact.id}/transition`, { to_stage: 'Qualified' })
ok('the owner qualifies their own contact', q.status >= 200 && q.status < 300, `${q.status} ${JSON.stringify(q.data ?? '').slice(0, 140)}`)
const cb = await call('POST', `/contacts/${contact.id}/create-test-bed`, { name: `${TAG} bed ${rnd()}` })
ok('the owner creates a Test Bed from it', cb.status === 201, `${cb.status}`)
const co = await call('POST', `/contacts/${contact.id}/create-opportunity`, { name: `${TAG} opp ${rnd()}` })
ok('the owner creates an Opportunity from it', co.status === 201, `${co.status}`)

const fail = R.filter((r) => !r.cond)
console.log(`\n  ${R.length - fail.length}/${R.length} flows unchanged`)
process.exit(fail.length ? 1 : 0)
