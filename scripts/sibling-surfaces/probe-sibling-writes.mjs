// PHASE 0: every Test Bed, Contact and Account write path, as a non-owner.
//
// ── THE OWNER RUN GATES WHETHER THE NON-OWNER RESULT COUNTS ───────────────
//
// This session has now had FOUR refusals that were about nothing - a no-change
// dedupe, a workflow gate, a stale server, a wrong request body - each of which
// would have been reported as an ownership refusal by a check that read only
// the status class. So every path here is run twice and scored by a rule:
//
//   owner FAILS   -> the path is NOT PROBED. Whatever the non-owner got, it
//                    proves nothing, and the table says so with the reason.
//   owner SUCCEEDS -> the non-owner result is meaningful, and is scored on
//                    whether it is REFUSED and whether the refusal is
//                    OWNERSHIP-SHAPED rather than any 4xx.
//
// ── TWO FIXTURES PER SURFACE, NEVER ONE ───────────────────────────────────
//
// The owner counterfactual and the non-owner attempt cannot share a record: a
// successful owner write changes the record's state and the non-owner attempt
// then refuses for that reason instead. Measured the hard way last round.
import { api as apiCall } from '../api-client.mjs'
import { admin } from '../fixtures.mjs'
import { readFileSync } from 'fs'

const call = async (m, p, b) => {
  try { const r = await apiCall(m, p, b); return { status: r.status, data: r.data } }
  catch (e) { if (e.name !== 'ApiError') throw e; return { status: e.status, data: e.body } }
}
const body = async (m, p, b) => (await apiCall(m, p, b)).data
const TAG = `sib-${process.argv[2] ?? 'r0'}`
const ME = JSON.parse(readFileSync('session-ref.json', 'utf8')).user.id
const db = admin()
const ROWS = []
const LANDED = []
const ownershipShaped = (r) => r.status === 403 || /belongs to another user|only its owner/i.test(JSON.stringify(r.data ?? {}))

const { data: users } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 })
const OTHER = users.users.find((u) => u.email === 'ownership-other@terminus-probe.invalid').id
const industry = (await body('GET', '/industries'))[0]

const hand = async (id) => { await db.from('records').update({ owner_id: OTHER }).eq('id', id) }
const mkAccount = async (n) => (await body('POST', '/accounts', { name: `${TAG}-${n} Acct`, industry_id: industry.id, billingCountry: 'Singapore' })).id
const mkContact = async (n, accountId) => {
  const c = await body('POST', '/contacts', {
    jobRole: 'Head of Ops',
    name: `${TAG}-${n} person`, company: `${TAG} Ltd`, email: `${TAG}-${n}@example.invalid`,
    mobile: '+65 9000 0005', industry_id: industry.id, source: 'Referral', country: 'Singapore',
  })
  if (accountId) await body('POST', `/contacts/${c.id}/link-account`, { account_id: accountId })
  await db.from('records').update({ status: 'Qualified' }).eq('id', c.id)
  return c.id
}
const mkBed = async (n, accountId) => (await body('POST', '/test-beds', {
  name: `${TAG}-${n} bed`, account_id: accountId, industry_id: industry.id,
  country_code: 'SG', client_organisation: `${TAG} Org`,
})).id

// Runs one path twice on two separate fixtures and records a row.
async function probe(name, build, attempt) {
  let ownerRes = null, otherRes = null, note = ''
  try {
    const own = await build('own')
    ownerRes = await attempt(own)
    const oth = await build('oth')
    await hand(oth.handId ?? oth.id)
    otherRes = await attempt(oth)
  } catch (e) { note = 'fixture error: ' + e.message.slice(0, 90) }

  const ownerOk = ownerRes && ownerRes.status >= 200 && ownerRes.status < 300
  let verdict, detail
  if (note) { verdict = 'NOT PROBED'; detail = note }
  else if (!ownerOk) { verdict = 'NOT PROBED'; detail = `owner run failed ${ownerRes?.status}: ${JSON.stringify(ownerRes?.data).slice(0, 80)}` }
  else if (otherRes.status >= 200 && otherRes.status < 300) {
    verdict = '*** LANDED ***'
    detail = `non-owner got ${otherRes.status}`
    LANDED.push({ name, id: otherRes.data?.id ?? '(no id returned)', data: JSON.stringify(otherRes.data).slice(0, 140) })
  } else if (!ownershipShaped(otherRes)) {
    verdict = 'REFUSED, NOT ON OWNERSHIP'
    detail = `${otherRes.status} ${JSON.stringify(otherRes.data).slice(0, 80)}`
  } else { verdict = 'MATCH'; detail = `owner ${ownerRes.status} / non-owner ${otherRes.status}` }
  ROWS.push({ name, owner: ownerRes?.status ?? '-', other: otherRes?.status ?? '-', verdict, detail })
  console.log(`  ${verdict.padEnd(26)} ${name.padEnd(38)} owner ${String(ownerRes?.status ?? '-').padEnd(4)} non-owner ${String(otherRes?.status ?? '-').padEnd(4)} ${verdict === 'MATCH' ? '' : detail}`)
}

console.log(`me ${ME}\nother ${OTHER}\n`)
console.log('=== TEST BED PATHS')

await probe('PATCH /test-beds/:id',
  async () => ({ id: await mkBed(Math.random().toString(36).slice(2, 7), await mkAccount('a')) }),
  (f) => call('PATCH', `/test-beds/${f.id}`, { payload: { notes: `${TAG} ${Math.random()}` } }))

await probe('POST /test-beds/:id/measurability',
  async () => ({ id: await mkBed(Math.random().toString(36).slice(2, 7), await mkAccount('a')) }),
  (f) => call('POST', `/test-beds/${f.id}/measurability`, { confirmed: true, comment: `${TAG} note` }))

await probe('POST /test-beds/:id/buyer-contacts',
  async () => {
    const acc = await mkAccount('b'); const bed = await mkBed(Math.random().toString(36).slice(2, 7), acc)
    return { id: bed, contact: await mkContact(Math.random().toString(36).slice(2, 7), acc) }
  },
  (f) => call('POST', `/test-beds/${f.id}/buyer-contacts`, { role: 'Client Commercial Buyer', contact_id: f.contact }))

await probe('POST /test-beds/:id/tech-team',
  async () => {
    const acc = await mkAccount('t'); const bed = await mkBed(Math.random().toString(36).slice(2, 7), acc)
    return { id: bed, contact: await mkContact(Math.random().toString(36).slice(2, 7), acc) }
  },
  (f) => call('POST', `/test-beds/${f.id}/tech-team`, { contact_id: f.contact }))

await probe('POST /test-beds/:id/convert',
  async () => ({ id: await mkBed(Math.random().toString(36).slice(2, 7), await mkAccount('c')) }),
  (f) => call('POST', `/test-beds/${f.id}/convert`, { opportunity_name: `${TAG} converted ${Math.random().toString(36).slice(2, 6)}` }))

console.log('\n=== CONTACT PATHS')

await probe('PATCH /contacts/:id',
  async () => ({ id: await mkContact(Math.random().toString(36).slice(2, 7)) }),
  (f) => call('PATCH', `/contacts/${f.id}`, { payload: { notes: `${TAG} ${Math.random()}` } }))

await probe('POST /contacts/:id/link-account',
  async () => ({ id: await mkContact(Math.random().toString(36).slice(2, 7)), acc: await mkAccount('l') }),
  (f) => call('POST', `/contacts/${f.id}/link-account`, { account_id: f.acc }))

await probe('POST /contacts/:id/create-test-bed',
  async () => { const acc = await mkAccount('ctb'); return { id: await mkContact(Math.random().toString(36).slice(2, 7), acc) } },
  (f) => call('POST', `/contacts/${f.id}/create-test-bed`, { name: `${TAG} bed ${Math.random().toString(36).slice(2, 6)}` }))

await probe('POST /contacts/:id/create-opportunity',
  async () => { const acc = await mkAccount('cop'); return { id: await mkContact(Math.random().toString(36).slice(2, 7), acc) } },
  (f) => call('POST', `/contacts/${f.id}/create-opportunity`, { name: `${TAG} opp ${Math.random().toString(36).slice(2, 6)}` }))

console.log('\n=== ACCOUNT PATH (the map says team-editable BY DESIGN; proving the design)')
await probe('PATCH /accounts/:id',
  async () => ({ id: await mkAccount(Math.random().toString(36).slice(2, 7)) }),
  (f) => call('PATCH', `/accounts/${f.id}`, { payload: { notes: `${TAG} ${Math.random()}` } }))

console.log('\n=== RESULTS TABLE')
console.log('  verdict                    path                                   owner  non-owner')
for (const r of ROWS) console.log(`  ${r.verdict.padEnd(26)} ${r.name.padEnd(38)} ${String(r.owner).padEnd(6)} ${r.other}`)

if (LANDED.length) {
  console.log('\n*** STOP: a non-owner write LANDED ***')
  for (const l of LANDED) console.log(`    ${l.name}\n      id ${l.id}\n      ${l.data}`)
  process.exit(2)
}
console.log('\nno non-owner write landed')
