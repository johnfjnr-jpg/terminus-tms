// PHASE 1b: all six create-from paths, both directions.
//
// BOTH DIRECTIONS PER PATH, always. The reverted guard would have passed any
// refusal-only check while locking owners out, so a REFUSED row is worth
// nothing here without the ADMITTED row beside it.
import { api as apiCall } from '../api-client.mjs'
import { admin } from '../fixtures.mjs'
import { readFileSync } from 'fs'

const call = async (m, p, b) => {
  try { const r = await apiCall(m, p, b); return { status: r.status, data: r.data } }
  catch (e) { if (e.name !== 'ApiError') throw e; return { status: e.status, data: e.body } }
}
const body = async (m, p, b) => (await apiCall(m, p, b)).data
const TAG = `cf1b-${process.argv[2] ?? 'r0'}`
const ME = JSON.parse(readFileSync('session-ref.json', 'utf8')).user.id
const db = admin()
const rnd = () => Math.random().toString(36).slice(2, 7)
const ROWS = []
const own = (r) => r.status === 403 || /belongs to another user|only its owner/i.test(JSON.stringify(r.data ?? {}))

const { data: users } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 })
const OTHER = users.users.find((u) => u.email === 'ownership-other@terminus-probe.invalid').id
const industry = (await body('GET', '/industries'))[0]
const mkAccount = async () => (await body('POST', '/accounts', { name: `${TAG}-${rnd()} Acct`, industry_id: industry.id, billingCountry: 'Singapore' })).id
const mkBed = async () => (await body('POST', '/test-beds', {
  name: `${TAG}-${rnd()} bed`, account_id: await mkAccount(), industry_id: industry.id,
  country_code: 'SG', client_organisation: `${TAG} Org`,
})).id
const mkContact = async () => {
  const acc = await mkAccount()
  const c = await body('POST', '/contacts', {
    jobRole: 'Head of Ops',
    name: `${TAG}-${rnd()} person`, company: `${TAG} Ltd`, email: `${TAG}-${rnd()}@example.invalid`,
    mobile: '+65 9000 0007', industry_id: industry.id, source: 'Referral', country: 'Singapore',
  })
  await body('POST', `/contacts/${c.id}/link-account`, { account_id: acc })
  await db.from('records').update({ status: 'Qualified' }).eq('id', c.id)
  return c.id
}
const hand = async (id) => { await db.from('records').update({ owner_id: OTHER }).eq('id', id) }

async function both(name, build, attempt) {
  const o = await attempt(await build())
  const f = await build(); await hand(f.id)
  const x = await attempt(f)
  const admitted = o.status >= 200 && o.status < 300
  const refused = x.status >= 400
  const shaped = own(x)
  const verdict = !admitted ? `OWNER LOCKED OUT (${o.status})`
    : !refused ? `STILL LANDS (${x.status})`
    : !shaped ? `refused, not on ownership (${x.status})`
    : 'BOTH DIRECTIONS'
  ROWS.push({ name, o: o.status, x: x.status, verdict })
  console.log(`  ${verdict.padEnd(28)} ${name.padEnd(42)} owner ${String(o.status).padEnd(4)} non-owner ${x.status}`)
}

console.log(`=== ALL SIX, BOTH DIRECTIONS\n`)
await both('POST /test-beds/:id/customer-documents', async () => ({ id: await mkBed() }),
  (f) => call('POST', `/test-beds/${f.id}/customer-documents`, { name: `${TAG} doc ${rnd()}`, url: `https://example.invalid/${rnd()}` }))
await both('POST /test-beds/:id/complete-document', async () => ({ id: await mkBed() }),
  (f) => call('POST', `/test-beds/${f.id}/complete-document`, { document_type: `${TAG}-${rnd()}`, document_location: `https://example.invalid/${rnd()}`, approve: false }))
await both('POST /test-beds/:id/units/derive',
  async () => { const b = await mkBed(); await call('PATCH', `/test-beds/${b}`, { payload: { safesightCameras: 2 } }); return { id: b } },
  (f) => call('POST', `/test-beds/${f.id}/units/derive`, {}))
await both('POST /contacts/:id/create-test-bed', async () => ({ id: await mkContact() }),
  (f) => call('POST', `/contacts/${f.id}/create-test-bed`, { name: `${TAG} bed ${rnd()}` }))
await both('POST /test-beds/:id/convert', async () => ({ id: await mkBed() }),
  (f) => call('POST', `/test-beds/${f.id}/convert`, { opportunity_name: `${TAG} opp ${rnd()}` }))
await both('POST /contacts/:id/create-opportunity', async () => ({ id: await mkContact() }),
  (f) => call('POST', `/contacts/${f.id}/create-opportunity`, { name: `${TAG} opp ${rnd()}` }))

const done = ROWS.filter((r) => r.verdict === 'BOTH DIRECTIONS')
console.log(`\n  ${done.length}/6 paths prove both directions`)
const lands = ROWS.filter((r) => r.verdict.startsWith('STILL LANDS'))
if (lands.length) {
  console.log('\n  STILL LANDING - these are the FUNCTION-mediated paths if the migration')
  console.log('  20260908000003 has not been applied. Route-level paths landing here would')
  console.log('  be a real failure.')
  for (const r of lands) console.log(`    ${r.name}`)
}
const locked = ROWS.filter((r) => r.verdict.startsWith('OWNER LOCKED OUT'))
if (locked.length) { console.log('\n  *** OWNERS LOCKED OUT - the near-miss, live ***'); for (const r of locked) console.log(`    ${r.name}`) }
process.exit(locked.length ? 2 : 0)
